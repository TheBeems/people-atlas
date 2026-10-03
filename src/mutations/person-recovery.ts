import { TFile, type App } from "obsidian";
import type { PersonRecord } from "../domain/types";
import { personDossierPathFromProfile, personIdCrockfordBase32 } from "../domain/people-paths";
import { parseRecoverySource } from "../index/recovery-source";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	PERSON_OWNED_PROPERTY_SETTING_KEYS,
	validateConfiguredPropertyNames,
	validatePersonPropertyMappings,
} from "../settings/validate";

export type PersonRecoveryKind = "missing-id" | "duplicate-id" | "adopt";
export interface RecoveryPropertyChange {
	property: string;
	before: unknown;
	after: unknown;
}
export interface PersonRecoveryPreview {
	filePath: string;
	kind: PersonRecoveryKind;
	classification: "type" | "tag" | "unclassified";
	personId: string;
	changes: RecoveryPropertyChange[];
	mappings: Array<{ setting: string; property: string }>;
	eligible: boolean;
	error?: string;
}
export interface PersonRecoveryResult {
	filePath: string;
	status: "saved" | "skipped" | "failed";
	message?: string;
	blockedSourcePath?: string;
}
interface RecoveryBaseline {
	file: TFile;
	reviewed: string;
	payload: PersonRecoveryPreview;
	mapping: string;
	owned: string;
	classification: PersonRecoveryPreview["classification"];
	completed: boolean;
}
interface SourceStat {
	path: string;
	file: TFile;
	mtime: number;
	size: number;
}
class IdentityValidationSourceError extends Error {
	constructor(
		readonly sourcePath: string,
		error: unknown,
	) {
		super(
			`Identity validation is blocked by “${sourcePath}”: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function signature(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(signature).join(",")}]`;
	if (value && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, entry]) => `${JSON.stringify(key)}:${signature(entry)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "undefined";
}
function ownedSignature(frontmatter: Record<string, unknown>, settings: PeopleAtlasSettings): string {
	return signature([
		...PERSON_OWNED_PROPERTY_SETTING_KEYS.map((key) => [settings[key], frontmatter[settings[key]]]),
		["tags", frontmatter.tags],
		["tag", frontmatter.tag],
	]);
}
function mappingSignature(settings: PeopleAtlasSettings): string {
	return signature([
		settings.peopleRootFolder,
		settings.personTypeValue,
		settings.personTag,
		...PERSON_OWNED_PROPERTY_SETTING_KEYS.map((key) => settings[key]),
	]);
}
function explicitId(frontmatter: Record<string, unknown>, settings: PeopleAtlasSettings): string {
	const raw = frontmatter[settings.personIdProperty];
	if (raw === undefined || raw === null || raw === "") return "";
	if (typeof raw !== "string") throw new Error("The person ID must be text before it can be reviewed.");
	return raw.trim();
}
function placeholderPerson(filePath: string, id: string): PersonRecord {
	return { filePath, id, name: "", aliases: [], organisations: [], emails: [], phones: [], contacts: [] };
}

/** Rare, reviewed repairs share the ordinary mutation service's exclusive queue. */
export class PersonRecoveryService {
	private readonly baselines = new WeakMap<PersonRecoveryPreview, RecoveryBaseline>();
	constructor(
		private readonly app: App,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly canWrite: () => boolean,
		private readonly getPeople: () => PersonRecord[],
		private readonly exclusive: <T>(operation: () => Promise<T>) => Promise<T>,
		private readonly identityAvailable: (id: string, path: string) => boolean,
		private readonly rememberIdentity: (id: string, path: string) => void,
		private readonly generateId: () => string = () => `person-${crypto.randomUUID()}`,
	) {}

	async preview(filePath: string, kind: PersonRecoveryKind): Promise<PersonRecoveryPreview> {
		const settings = structuredClone(this.getSettings());
		const preview: PersonRecoveryPreview = {
			filePath,
			kind,
			classification: "unclassified",
			personId: "",
			changes: [],
			eligible: false,
			mappings: PERSON_OWNED_PROPERTY_SETTING_KEYS.map((setting) => ({ setting, property: settings[setting] })),
		};
		try {
			this.assertSettings(settings);
			const file = this.file(filePath);
			const { source } = await this.readStable(file);
			const parsed = parseRecoverySource(source, settings);
			preview.classification = parsed.classification;
			const oldId = explicitId(parsed.frontmatter, settings);
			if (kind !== "adopt" && parsed.classification === "unclassified")
				throw new Error("This note is no longer classified as a person.");
			if (kind === "missing-id" && oldId) throw new Error("This note already has a person ID; review it again.");
			if (kind === "duplicate-id" && (!oldId || this.getPeople().filter((person) => person.id === oldId).length < 2))
				throw new Error("The selected person ID is no longer duplicated.");
			const personId = kind === "adopt" && oldId ? oldId : this.generateId();
			if (!(kind === "adopt" && oldId) && !personIdCrockfordBase32(personId))
				throw new Error("A valid UUID-backed new person ID is required.");
			if (!this.identityAvailable(personId, filePath)) throw new Error("The proposed person ID is already in use.");
			preview.personId = personId;
			if (oldId !== personId)
				preview.changes.push({
					property: settings.personIdProperty,
					before: parsed.frontmatter[settings.personIdProperty],
					after: personId,
				});
			if (kind === "adopt" && parsed.classification === "unclassified") {
				const rawType = parsed.frontmatter[settings.typeProperty];
				if (rawType !== null && rawType !== undefined && String(rawType).trim())
					throw new Error("This note has another classification; it cannot be adopted as a person.");
				preview.changes.push({ property: settings.typeProperty, before: rawType, after: settings.personTypeValue });
			}
			if (kind === "duplicate-id" && filePath.split("/").at(-2)?.includes(" · "))
				this.assertDossier(filePath, personId, settings);
			preview.eligible = true;
			this.baselines.set(preview, {
				file,
				reviewed: signature(preview),
				payload: structuredClone(preview),
				mapping: mappingSignature(settings),
				owned: ownedSignature(parsed.frontmatter, settings),
				classification: parsed.classification,
				completed: false,
			});
		} catch (error) {
			preview.error = error instanceof Error ? error.message : String(error);
		}
		return preview;
	}

	async apply(preview: PersonRecoveryPreview): Promise<PersonRecoveryResult> {
		const baseline = this.baselines.get(preview);
		if (!baseline)
			return {
				filePath: preview.filePath,
				status: "skipped",
				message: preview.error ?? "Review a new preview before applying this change.",
			};
		const approved = structuredClone(baseline.payload);
		return this.exclusive(async () => {
			if (signature(preview) !== baseline.reviewed)
				return {
					filePath: approved.filePath,
					status: "skipped",
					message: "The preview changed. Review a new preview before applying it.",
				};
			if (baseline.completed)
				return {
					filePath: approved.filePath,
					status: "skipped",
					message: "Already applied; the saved identity is unchanged.",
				};
			try {
				const settings = structuredClone(this.getSettings());
				this.assertSettings(settings);
				if (!this.canWrite()) throw new Error("People Atlas data is read-only.");
				if (mappingSignature(settings) !== baseline.mapping)
					throw new Error("The configured mappings or People root changed. Review a new preview.");
				const file = this.file(approved.filePath);
				if (file !== baseline.file) throw new Error("The reviewed note was replaced. Review a new preview.");
				const { source, stat } = await this.readStable(file);
				const parsed = parseRecoverySource(source, settings);
				if (
					parsed.classification !== baseline.classification ||
					ownedSignature(parsed.frontmatter, settings) !== baseline.owned
				)
					throw new Error("The reviewed person fields or classification changed. Review a new preview.");
				const collisionStats = await this.verifyIdAcrossSources(approved.personId, approved.filePath, settings);
				if (!this.identityAvailable(approved.personId, approved.filePath))
					throw new Error("The proposed person ID is already in use. Review a new preview.");
				if (signature(preview) !== baseline.reviewed)
					throw new Error("The preview changed before the write. Review a new preview.");
				if (
					!this.canWrite() ||
					mappingSignature(this.getSettings()) !== baseline.mapping ||
					!this.statMatches(stat) ||
					collisionStats.some((entry) => !this.statMatches(entry))
				)
					throw new Error("The source or mappings changed during validation. Review a new preview.");
				if (approved.changes.length > 0) {
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						if (
							!this.canWrite() ||
							signature(preview) !== baseline.reviewed ||
							mappingSignature(this.getSettings()) !== baseline.mapping ||
							this.file(approved.filePath) !== file ||
							!this.statMatches(stat)
						)
							throw new Error("The source, mappings or preview changed before the write. Review a new preview.");
						const paths = this.app.vault
							.getMarkdownFiles()
							.map((entry) => entry.path)
							.sort();
						if (
							signature(paths) !== signature(collisionStats.map((entry) => entry.path).sort()) ||
							collisionStats.some((entry) => !this.statMatches(entry))
						)
							throw new Error("A note changed during identity validation. Review a new preview.");
						if (
							ownedSignature(frontmatter, settings) !== baseline.owned ||
							!this.identityAvailable(approved.personId, approved.filePath)
						)
							throw new Error("The person fields or ID uniqueness changed before the write. Review a new preview.");
						for (const change of approved.changes) frontmatter[change.property] = change.after;
					});
				}
				this.rememberIdentity(approved.personId, approved.filePath);
				baseline.completed = true;
				return { filePath: approved.filePath, status: "saved" };
			} catch (error) {
				return {
					filePath: approved.filePath,
					status: "failed",
					message: error instanceof Error ? error.message : String(error),
					...(error instanceof IdentityValidationSourceError ? { blockedSourcePath: error.sourcePath } : {}),
				};
			}
		});
	}

	private assertSettings(settings: PeopleAtlasSettings): void {
		const error = validateConfiguredPropertyNames(settings) ?? validatePersonPropertyMappings(settings);
		if (error) throw new Error(error);
	}
	private file(path: string): TFile {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile) || file.path !== path || file.extension !== "md")
			throw new Error(`The exact Markdown note “${path}” is unavailable.`);
		return file;
	}
	private async readStable(file: TFile): Promise<{ source: string; stat: SourceStat }> {
		const stat = { path: file.path, file, mtime: file.stat.mtime, size: file.stat.size };
		const source = await this.app.vault.read(file);
		if (!this.statMatches(stat)) throw new Error("The note changed while it was being read. Review a new preview.");
		return { source, stat };
	}
	private statMatches(stat: SourceStat): boolean {
		return (
			this.app.vault.getAbstractFileByPath(stat.path) === stat.file &&
			stat.file.path === stat.path &&
			stat.file.stat.mtime === stat.mtime &&
			stat.file.stat.size === stat.size
		);
	}
	private assertDossier(path: string, id: string, settings: PeopleAtlasSettings): void {
		const people = [...this.getPeople().filter((person) => person.filePath !== path), placeholderPerson(path, id)];
		if (
			!personDossierPathFromProfile(
				settings.peopleRootFolder,
				path,
				id,
				this.app.vault.getAllLoadedFiles().map((entry) => entry.path),
				people,
			)
		)
			throw new Error(
				"This note is outside a supported, uniquely owned person dossier. Choose a note under the configured Profiles collection; no notes or folders are moved.",
			);
	}
	private async verifyIdAcrossSources(id: string, path: string, settings: PeopleAtlasSettings): Promise<SourceStat[]> {
		const stats: SourceStat[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			try {
				const read = await this.readStable(file);
				stats.push(read.stat);
				if (file.path === path) continue;
				const parsed = parseRecoverySource(read.source, settings);
				if (parsed.classification !== "unclassified" && explicitId(parsed.frontmatter, settings) === id)
					throw new Error("The proposed person ID is already present in another note. Review a new preview.");
			} catch (error) {
				throw new IdentityValidationSourceError(file.path, error);
			}
		}
		return stats;
	}
}
