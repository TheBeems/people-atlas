import { normalizePath, type App, type TFile } from "obsidian";
import { resolvePersonId, resolveRelationshipId } from "../domain/identity";
import type { PersonIndex } from "../index/person-index";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	validateFolderPath,
	validateNotePath,
	validatePersonInput,
	validateRelationshipInput,
	sanitizeNoteName,
	yamlValue,
	type PersonMutationInput,
	type PersonUpdates,
	type RelationshipMutationInput,
	type RelationshipUpdates,
} from "./validation";

export class MutationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MutationError";
	}
}

export class PartialPersonMutationError extends MutationError {
	readonly propertiesSaved = true as const;

	constructor(
		message: string,
		readonly currentPath: string,
		readonly targetPath: string,
	) {
		super(message);
		this.name = "PartialPersonMutationError";
	}
}

export interface PersonEditOptions {
	targetPath?: string | undefined;
}

export interface PersonEditResult {
	file: TFile;
	renamed: boolean;
}

export class AtlasMutationService {
	private mutationQueue: Promise<void> = Promise.resolve();
	// 10x: reservations bridge plugin-owned writes until the asynchronous index
	// observes them; replace with index acknowledgements if that lifecycle gains
	// an awaitable commit API.
	private readonly reservedPersonIds = new Map<string, string>();
	private readonly reservedRelationshipIds = new Map<string, string>();

	constructor(
		private readonly app: App,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly canWrite: () => boolean,
		private readonly index: Pick<PersonIndex, "getPeoplePathsById" | "getRelationshipPathsById">,
		private readonly generateId: () => string = () => `person-${crypto.randomUUID()}`,
	) {}

	createPerson(input: PersonMutationInput): Promise<TFile> {
		return this.runExclusive(() => this.createPersonExclusive(input));
	}

	createRelationship(input: RelationshipMutationInput): Promise<TFile> {
		return this.runExclusive(() => this.createRelationshipExclusive(input));
	}

	updatePerson(file: TFile, updates: PersonUpdates, options: PersonEditOptions = {}): Promise<PersonEditResult> {
		return this.runExclusive(() => this.updatePersonExclusive(file, updates, options));
	}

	updateRelationship(file: TFile, updates: RelationshipUpdates): Promise<void> {
		return this.runExclusive(() => this.updateRelationshipExclusive(file, updates));
	}

	private async createPersonExclusive(input: PersonMutationInput): Promise<TFile> {
		this.assertWritable();
		const settings = this.getSettings();
		const errors = validatePersonInput(input, settings);
		const folder = normalizePath(settings.peopleFolder);
		if (validateFolderPath(folder)) errors.push("The configured People folder is invalid.");
		const fileName = sanitizeNoteName(input.name);
		if (!fileName) errors.push("The person name cannot produce a valid note name.");
		const path = normalizePath(`${folder}/${fileName}.md`);
		const personId = input.personId?.trim() || this.generateId();
		if (this.identityInUse(personId, path, this.reservedPersonIds, (id) => this.index.getPeoplePathsById(id))) {
			errors.push(`person_id “${personId}” is already in use.`);
		}
		if (this.app.vault.getAbstractFileByPath(path)) errors.push(`A note already exists at “${path}”.`);
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		await this.ensureFolder(folder);
		const frontmatter = this.personFrontmatter(input, personId, settings);
		const file = await this.app.vault.create(path, `---\n${frontmatter}---\n`);
		this.rememberIdentity(this.reservedPersonIds, personId, path);
		return file;
	}

	private async createRelationshipExclusive(input: RelationshipMutationInput): Promise<TFile> {
		this.assertWritable();
		const settings = this.getSettings();
		const path = normalizePath(input.path);
		const errors = validateRelationshipInput({ ...input, path }, settings);

		const relationshipId = input.relationshipId?.trim() || resolveRelationshipId(undefined, path);
		if (
			this.identityInUse(relationshipId, path, this.reservedRelationshipIds, (id) =>
				this.index.getRelationshipPathsById(id),
			)
		) {
			errors.push(`relationship_id “${relationshipId}” is already in use.`);
		}
		if (this.app.vault.getAbstractFileByPath(path)) errors.push(`A note already exists at “${path}”.`);
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
		const frontmatter = this.relationshipFrontmatter({ ...input, path, relationshipId }, settings);
		const file = await this.app.vault.create(path, `---\n${frontmatter}---\n`);
		this.rememberIdentity(this.reservedRelationshipIds, relationshipId, path);
		return file;
	}

	private async updatePersonExclusive(
		file: TFile,
		updates: PersonUpdates,
		options: PersonEditOptions,
	): Promise<PersonEditResult> {
		this.assertWritable();
		const settings = this.getSettings();
		const current = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		const targetPath = options.targetPath ? normalizePath(options.targetPath) : undefined;
		const renameRequired = targetPath !== undefined && targetPath !== file.path;
		const writeUpdates: PersonUpdates = { ...updates };
		const explicitPersonId =
			typeof current[settings.personIdProperty] === "string" && current[settings.personIdProperty].trim()
				? current[settings.personIdProperty].trim()
				: undefined;
		if (renameRequired && explicitPersonId === undefined) {
			writeUpdates.personId = resolvePersonId(undefined, file.path);
		}
		const name =
			writeUpdates.name === null ? "" : (writeUpdates.name ?? String(current[settings.nameProperty] ?? file.basename));
		const cachedPersonId = explicitPersonId ?? this.reservedIdentityForPath(this.reservedPersonIds, file.path);
		const personId = writeUpdates.personId === null ? undefined : (writeUpdates.personId ?? cachedPersonId);
		const errors = validatePersonInput({ name, personId }, settings);
		const resultingPersonId = resolvePersonId(personId, file.path);
		if (renameRequired && targetPath) {
			if (validateNotePath(targetPath)) errors.push("A safe Markdown person path is required.");
			const currentParent = file.path.split("/").slice(0, -1).join("/");
			const targetParent = targetPath.split("/").slice(0, -1).join("/");
			if (currentParent !== targetParent) errors.push("Editing a person may rename the note but cannot move it.");
			const expectedName = sanitizeNoteName(name);
			if (!expectedName || targetPath !== normalizePath(`${targetParent ? `${targetParent}/` : ""}${expectedName}.md`))
				errors.push("The person note path must match the configured display name.");
			const existing = this.app.vault.getAbstractFileByPath(targetPath);
			if (existing && existing !== file) errors.push(`A note already exists at “${targetPath}”.`);
		}
		if (
			this.identityInUse(resultingPersonId, file.path, this.reservedPersonIds, (id) =>
				this.index.getPeoplePathsById(id),
			)
		) {
			errors.push(`person_id “${resultingPersonId}” is already in use.`);
		}
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		const propertiesChanged = Object.keys(writeUpdates).length > 0;
		if (propertiesChanged) {
			await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
				this.apply(frontmatter, settings.nameProperty, writeUpdates.name);
				this.apply(frontmatter, settings.personIdProperty, writeUpdates.personId);
				this.apply(frontmatter, settings.aliasesProperty, writeUpdates.aliases);
				this.apply(frontmatter, settings.organisationsProperty, writeUpdates.organisations);
				this.apply(frontmatter, settings.photoProperty, writeUpdates.photo);
				this.apply(frontmatter, settings.contactsProperty, writeUpdates.contacts);
			});
		}
		this.rememberIdentity(this.reservedPersonIds, resultingPersonId, file.path);
		if (renameRequired && targetPath) {
			try {
				await this.app.fileManager.renameFile(file, targetPath);
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				if (propertiesChanged) {
					throw new PartialPersonMutationError(
						`The person properties were saved, but the note could not be renamed: ${reason}`,
						file.path,
						targetPath,
					);
				}
				throw new MutationError(`The person note could not be renamed: ${reason}`);
			}
			this.rememberIdentity(this.reservedPersonIds, resultingPersonId, file.path);
			return { file, renamed: true };
		}
		return { file, renamed: false };
	}

	private async updateRelationshipExclusive(file: TFile, updates: RelationshipUpdates): Promise<void> {
		this.assertWritable();
		const settings = this.getSettings();
		const current = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		const value = <T>(key: string, update: T | null | undefined): T | undefined =>
			update === null ? undefined : (update ?? (current[key] as T | undefined));
		const path = file.path;
		const cachedRelationshipId =
			typeof current[settings.relationshipIdProperty] === "string"
				? current[settings.relationshipIdProperty]
				: this.reservedIdentityForPath(this.reservedRelationshipIds, file.path);
		const relationshipId =
			updates.relationshipId === null ? undefined : (updates.relationshipId ?? cachedRelationshipId);
		const input: RelationshipMutationInput = {
			path,
			from: value<string>(settings.relationshipFromProperty, updates.from) ?? "",
			to: value<string>(settings.relationshipToProperty, updates.to) ?? "",
		};
		if (relationshipId !== undefined) input.relationshipId = relationshipId;
		const presetId = value<string>(settings.relationshipPresetProperty, updates.presetId);
		if (presetId !== undefined) input.presetId = presetId;
		const types = value<string[]>(settings.relationshipTypesProperty, updates.types);
		if (types !== undefined) input.types = types;
		const fromRole = value<string>(settings.relationshipFromRoleProperty, updates.fromRole);
		if (fromRole !== undefined) input.fromRole = fromRole;
		const toRole = value<string>(settings.relationshipToRoleProperty, updates.toRole);
		if (toRole !== undefined) input.toRole = toRole;
		const direction = value<"undirected" | "source-to-target">(settings.directionProperty, updates.direction);
		if (direction !== undefined) input.direction = direction;
		const closeness = value<number>(settings.closenessProperty, updates.closeness);
		if (closeness !== undefined) input.closeness = closeness;
		const since = value<string>(settings.sinceProperty, updates.since);
		if (since !== undefined) input.since = since;
		const lastContact = value<string>(settings.lastContactProperty, updates.lastContact);
		if (lastContact !== undefined) input.lastContact = lastContact;
		const status = value<"active" | "dormant" | "ended">(settings.statusProperty, updates.status);
		if (status !== undefined) input.status = status;
		const errors = validateRelationshipInput(input, settings);
		const resultingRelationshipId = resolveRelationshipId(relationshipId, file.path);
		if (
			this.identityInUse(resultingRelationshipId, file.path, this.reservedRelationshipIds, (id) =>
				this.index.getRelationshipPathsById(id),
			)
		) {
			errors.push(`relationship_id “${resultingRelationshipId}” is already in use.`);
		}
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			this.apply(frontmatter, settings.relationshipIdProperty, updates.relationshipId);
			this.apply(frontmatter, settings.relationshipFromProperty, updates.from);
			this.apply(frontmatter, settings.relationshipToProperty, updates.to);
			this.apply(frontmatter, settings.relationshipTypesProperty, updates.types);
			this.apply(frontmatter, settings.relationshipPresetProperty, updates.presetId);
			this.apply(frontmatter, settings.relationshipFromRoleProperty, updates.fromRole);
			this.apply(frontmatter, settings.relationshipToRoleProperty, updates.toRole);
			this.apply(frontmatter, settings.directionProperty, updates.direction);
			this.apply(frontmatter, settings.closenessProperty, updates.closeness);
			this.apply(frontmatter, settings.sinceProperty, updates.since);
			this.apply(frontmatter, settings.lastContactProperty, updates.lastContact);
			this.apply(frontmatter, settings.statusProperty, updates.status);
		});
		this.rememberIdentity(this.reservedRelationshipIds, resultingRelationshipId, file.path);
	}

	private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.mutationQueue.then(operation, operation);
		this.mutationQueue = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	private identityInUse(
		id: string,
		currentPath: string,
		reservations: Map<string, string>,
		getIndexedPaths: (id: string) => string[],
	): boolean {
		const indexedPaths = getIndexedPaths(id);
		const reservedPath = reservations.get(id);
		if (reservedPath && (indexedPaths.includes(reservedPath) || !this.app.vault.getAbstractFileByPath(reservedPath))) {
			reservations.delete(id);
		}
		const activeReservation = reservations.get(id);
		return (
			indexedPaths.some((path) => path !== currentPath) ||
			(activeReservation !== undefined && activeReservation !== currentPath)
		);
	}

	private rememberIdentity(reservations: Map<string, string>, id: string, path: string): void {
		for (const [reservedId, reservedPath] of reservations) {
			if (reservedPath === path && reservedId !== id) reservations.delete(reservedId);
		}
		reservations.set(id, path);
	}

	private reservedIdentityForPath(reservations: Map<string, string>, path: string): string | undefined {
		for (const [id, reservedPath] of reservations) {
			if (reservedPath === path) return id;
		}
		return undefined;
	}

	private assertWritable(): void {
		if (!this.canWrite()) throw new MutationError("People Atlas writes are disabled until plugin data is repaired.");
	}

	private async ensureFolder(folder: string): Promise<void> {
		if (!folder) return;
		let current = "";
		for (const part of folder.split("/")) {
			current = current ? `${current}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing && !Array.isArray((existing as { children?: unknown }).children))
				throw new MutationError(`The destination “${current}” is not a folder.`);
			if (!existing) await this.app.vault.createFolder(current);
		}
	}

	private personFrontmatter(input: PersonMutationInput, personId: string, settings: PeopleAtlasSettings): string {
		return `${[
			`${settings.typeProperty}: ${yamlValue(settings.personTypeValue)}`,
			`${settings.personIdProperty}: ${yamlValue(personId)}`,
			`${settings.nameProperty}: ${yamlValue(input.name.trim())}`,
			...(input.aliases?.length ? [`${settings.aliasesProperty}: ${yamlValue(input.aliases)}`] : []),
			...(input.organisations?.length ? [`${settings.organisationsProperty}: ${yamlValue(input.organisations)}`] : []),
			...(input.photo ? [`${settings.photoProperty}: ${yamlValue(input.photo)}`] : []),
			...(input.contacts?.length ? [`${settings.contactsProperty}: ${yamlValue(input.contacts)}`] : []),
		].join("\n")}\n`;
	}

	private relationshipFrontmatter(
		input: RelationshipMutationInput & { relationshipId: string },
		settings: PeopleAtlasSettings,
	): string {
		return `${[
			`${settings.typeProperty}: ${yamlValue(settings.relationshipTypeValue)}`,
			`${settings.relationshipIdProperty}: ${yamlValue(input.relationshipId)}`,
			`${settings.relationshipFromProperty}: ${yamlValue(input.from.trim())}`,
			`${settings.relationshipToProperty}: ${yamlValue(input.to.trim())}`,
			...(input.types?.length ? [`${settings.relationshipTypesProperty}: ${yamlValue(input.types)}`] : []),
			...(input.presetId ? [`${settings.relationshipPresetProperty}: ${yamlValue(input.presetId)}`] : []),
			...(input.fromRole ? [`${settings.relationshipFromRoleProperty}: ${yamlValue(input.fromRole)}`] : []),
			...(input.toRole ? [`${settings.relationshipToRoleProperty}: ${yamlValue(input.toRole)}`] : []),
			...(input.direction ? [`${settings.directionProperty}: ${yamlValue(input.direction)}`] : []),
			...(input.closeness !== undefined ? [`${settings.closenessProperty}: ${input.closeness}`] : []),
			...(input.since ? [`${settings.sinceProperty}: ${yamlValue(input.since)}`] : []),
			...(input.lastContact ? [`${settings.lastContactProperty}: ${yamlValue(input.lastContact)}`] : []),
			...(input.status ? [`${settings.statusProperty}: ${yamlValue(input.status)}`] : []),
		].join("\n")}\n`;
	}

	private apply(frontmatter: Record<string, unknown>, key: string, value: unknown): void {
		if (value === undefined) return;
		if (value === null || (Array.isArray(value) && value.length === 0) || value === "") delete frontmatter[key];
		else frontmatter[key] = value;
	}
}
