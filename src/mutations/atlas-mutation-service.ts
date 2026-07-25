import { normalizePath, type App, type TFile } from "obsidian";
import { resolveRelationshipId } from "../domain/identity";
import type { PersonIndex } from "../index/person-index";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	validateFolderPath,
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

export class AtlasMutationService {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly canWrite: () => boolean,
		private readonly index: Pick<PersonIndex, "getPeoplePathsById" | "getRelationshipPathsById">,
		private readonly generateId: () => string = () => `person-${crypto.randomUUID()}`,
	) {}

	async createPerson(input: PersonMutationInput): Promise<TFile> {
		this.assertWritable();
		const settings = this.getSettings();
		const errors = validatePersonInput(input, settings);
		const folder = normalizePath(settings.peopleFolder);
		if (validateFolderPath(folder)) errors.push("The configured People folder is invalid.");
		const fileName = sanitizeNoteName(input.name);
		if (!fileName) errors.push("The person name cannot produce a valid note name.");
		const path = normalizePath(`${folder}/${fileName}.md`);
		const personId = input.personId?.trim() || this.generateId();
		if (this.index.getPeoplePathsById(personId).length > 0) errors.push(`person_id “${personId}” is already in use.`);
		if (this.app.vault.getAbstractFileByPath(path)) errors.push(`A note already exists at “${path}”.`);
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		await this.ensureFolder(folder);
		const frontmatter = this.personFrontmatter(input, personId, settings);
		return this.app.vault.create(path, `---\n${frontmatter}---\n`);
	}

	async createRelationship(input: RelationshipMutationInput): Promise<TFile> {
		this.assertWritable();
		const settings = this.getSettings();
		const path = normalizePath(input.path);
		const errors = validateRelationshipInput({ ...input, path }, settings);

		const relationshipId = input.relationshipId?.trim() || resolveRelationshipId(undefined, path);
		if (this.index.getRelationshipPathsById(relationshipId).length > 0) errors.push(`relationship_id “${relationshipId}” is already in use.`);
		if (this.app.vault.getAbstractFileByPath(path)) errors.push(`A note already exists at “${path}”.`);
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
		const frontmatter = this.relationshipFrontmatter({ ...input, path, relationshipId }, settings);
		return this.app.vault.create(path, `---\n${frontmatter}---\n`);
	}

	async updatePerson(file: TFile, updates: PersonUpdates): Promise<void> {
		this.assertWritable();
		const settings = this.getSettings();
		const current = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		const name = updates.name === null ? "" : updates.name ?? String(current[settings.nameProperty] ?? file.basename);
		const personId = updates.personId === null ? undefined : updates.personId ?? (typeof current[settings.personIdProperty] === "string" ? current[settings.personIdProperty] : undefined);
		const errors = validatePersonInput({ name, personId }, settings);
		if (personId && this.index.getPeoplePathsById(personId).some((path) => path !== file.path)) errors.push(`person_id “${personId}” is already in use.`);
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			this.apply(frontmatter, settings.nameProperty, updates.name);
			this.apply(frontmatter, settings.personIdProperty, updates.personId);
			this.apply(frontmatter, settings.aliasesProperty, updates.aliases);
			this.apply(frontmatter, settings.organisationsProperty, updates.organisations);
			this.apply(frontmatter, settings.photoProperty, updates.photo);
			this.apply(frontmatter, settings.contactsProperty, updates.contacts);
		});
	}

	async updateRelationship(file: TFile, updates: RelationshipUpdates): Promise<void> {
		this.assertWritable();
		const settings = this.getSettings();
		const current = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		const value = <T>(key: string, update: T | null | undefined): T | undefined => update === null ? undefined : update ?? current[key] as T | undefined;
		const path = file.path;
		const relationshipId = value<string>(settings.relationshipIdProperty, updates.relationshipId);
		const input: RelationshipMutationInput = {
			path,
			from: value<string>(settings.relationshipFromProperty, updates.from) ?? "",
			to: value<string>(settings.relationshipToProperty, updates.to) ?? "",
		};
		if (relationshipId !== undefined) input.relationshipId = relationshipId;
		const types = value<string[]>(settings.relationshipTypesProperty, updates.types);
		if (types !== undefined) input.types = types;
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
		if (relationshipId && this.index.getRelationshipPathsById(relationshipId).some((existing) => existing !== file.path)) errors.push(`relationship_id “${relationshipId}” is already in use.`);
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			this.apply(frontmatter, settings.relationshipIdProperty, updates.relationshipId);
			this.apply(frontmatter, settings.relationshipFromProperty, updates.from);
			this.apply(frontmatter, settings.relationshipToProperty, updates.to);
			this.apply(frontmatter, settings.relationshipTypesProperty, updates.types);
			this.apply(frontmatter, settings.directionProperty, updates.direction);
			this.apply(frontmatter, settings.closenessProperty, updates.closeness);
			this.apply(frontmatter, settings.sinceProperty, updates.since);
			this.apply(frontmatter, settings.lastContactProperty, updates.lastContact);
			this.apply(frontmatter, settings.statusProperty, updates.status);
		});
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
			if (existing && !Array.isArray((existing as { children?: unknown }).children)) throw new MutationError(`The destination “${current}” is not a folder.`);
			if (!existing) await this.app.vault.createFolder(current);
		}
	}

	private personFrontmatter(input: PersonMutationInput, personId: string, settings: PeopleAtlasSettings): string {
		return [
			`${settings.typeProperty}: ${yamlValue(settings.personTypeValue)}`,
			`${settings.personIdProperty}: ${yamlValue(personId)}`,
			`${settings.nameProperty}: ${yamlValue(input.name.trim())}`,
			...(input.aliases?.length ? [`${settings.aliasesProperty}: ${yamlValue(input.aliases)}`] : []),
			...(input.organisations?.length ? [`${settings.organisationsProperty}: ${yamlValue(input.organisations)}`] : []),
			...(input.photo ? [`${settings.photoProperty}: ${yamlValue(input.photo)}`] : []),
			...(input.contacts?.length ? [`${settings.contactsProperty}: ${yamlValue(input.contacts)}`] : []),
		].join("\n") + "\n";
	}

	private relationshipFrontmatter(input: RelationshipMutationInput & { relationshipId: string }, settings: PeopleAtlasSettings): string {
		return [
			`${settings.typeProperty}: ${yamlValue(settings.relationshipTypeValue)}`,
			`${settings.relationshipIdProperty}: ${yamlValue(input.relationshipId)}`,
			`${settings.relationshipFromProperty}: ${yamlValue(input.from.trim())}`,
			`${settings.relationshipToProperty}: ${yamlValue(input.to.trim())}`,
			...(input.types?.length ? [`${settings.relationshipTypesProperty}: ${yamlValue(input.types)}`] : []),
			...(input.direction ? [`${settings.directionProperty}: ${yamlValue(input.direction)}`] : []),
			...(input.closeness !== undefined ? [`${settings.closenessProperty}: ${input.closeness}`] : []),
			...(input.since ? [`${settings.sinceProperty}: ${yamlValue(input.since)}`] : []),
			...(input.lastContact ? [`${settings.lastContactProperty}: ${yamlValue(input.lastContact)}`] : []),
			...(input.status ? [`${settings.statusProperty}: ${yamlValue(input.status)}`] : []),
		].join("\n") + "\n";
	}

	private apply(frontmatter: Record<string, unknown>, key: string, value: unknown): void {
		if (value === undefined) return;
		if (value === null || (Array.isArray(value) && value.length === 0) || value === "") delete frontmatter[key];
		else frontmatter[key] = value;
	}
}
