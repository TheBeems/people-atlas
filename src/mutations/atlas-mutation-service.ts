import { getAllTags, normalizePath, TFile, type App, type CachedMetadata, type TAbstractFile } from "obsidian";
import { normalizePathIdentity } from "../domain/identity";
import { canonicalPersonPhotoWikilink, dossierPersonPhotoAssets } from "../domain/person-photo";
import {
	peopleCollectionPaths,
	personDossierPath,
	personDossierPathFromProfile,
	personDossierSuffix,
	personProfilePath,
} from "../domain/people-paths";
import { parsePersonReference } from "../domain/wikilink";
import type { RelationshipPresetValues } from "../settings/relationship-presets";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	contactMomentWikilink,
	contactMomentEditSourceMatches,
	decideLastContactAdvance,
	normalizeContactMomentFollowUpStatusMutationInput,
	normalizeContactMomentMutationInput,
	validateContactMomentFollowUpStatusMutationInput,
	validateContactMomentMutationInput,
	type CanonicalContactMomentRelationshipTarget,
	type ContactMomentFollowUpStatusMutationInput,
	type ContactMomentFollowUpStatusMutationResult,
	type ContactMomentMutationInput,
	type ContactMomentMutationResult,
	type ContactMomentRelationshipAdvanceResult,
	type ContactMomentRelationshipRetryResult,
	type ContactMomentRelationshipRetryToken,
	type ContactMomentSaveOptions,
	type ContactMomentSettings,
	type ContactMomentUpdateOptions,
	type ContactMomentUpdates,
	type LastContactAdvanceDecision,
} from "./contact-moment";
import {
	frontmatterHasPersonTag,
	personSourceStatMatches,
	verifyPersonEditSourceBaseline,
	type PersonEditSourceBaseline,
	type PersonTagSource,
} from "./person-source-guard";
import {
	validateFolderPath,
	validateNotePath,
	validatePersonInput,
	validatePersonUpdates,
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

function normalizeStoredId(value: string | undefined): string {
	return value?.trim() ?? "";
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
	expectedPersonId?: string | undefined;
	expectedClassification?: "type" | "tag" | undefined;
	sourceBaseline?: PersonEditSourceBaseline | undefined;
}

export interface PersonEditResult {
	file: TFile;
	renamed: boolean;
}

export interface RelationshipPresetSyncUpdates {
	types: string[];
	fromRole: string;
	toRole: string;
}

export type RelationshipPresetSyncMutationResult = { status: "updated" } | { status: "already-current" };

interface MutationIndex {
	getPeoplePathsById(id: string): string[];
	getRelationshipPathsById(id: string): string[];
	getContactMomentPathsById?(id: string): string[];
}

interface ContactMomentNoteBaseline {
	path: string;
	source: string;
	frontmatter?: Record<string, unknown> | undefined;
	frontmatterSignature?: string | undefined;
	mtime?: number | undefined;
	size?: number | undefined;
}

interface PreparedRelationshipAdvance {
	status: "prepared";
	file: TFile;
	target: CanonicalContactMomentRelationshipTarget;
	momentPersonIds: string[];
	baseline: ContactMomentNoteBaseline;
	decision: LastContactAdvanceDecision;
}

interface ContactMomentRetryState {
	momentFile: TFile;
	relationshipFile: TFile;
	target: CanonicalContactMomentRelationshipTarget;
	momentPersonIds: string[];
	momentBaseline?: ContactMomentNoteBaseline | undefined;
	relationshipBaseline?: ContactMomentNoteBaseline | undefined;
	occurredOn: string;
	completed: boolean;
	completedResult?: ContactMomentRelationshipAdvanceResult | undefined;
}

type RelationshipAdvancePlan = PreparedRelationshipAdvance | ContactMomentRelationshipAdvanceResult;

export const STALE_RELATIONSHIP_PRESET_PREVIEW_MESSAGE =
	"The relationship changed after this preview was opened. Review a new preview.";
export const STALE_PERSON_EDIT_MESSAGE =
	"The person note changed after the editor was opened. Reopen it before saving.";

const RELATIONSHIP_PRESET_ALREADY_CURRENT = new Error("Relationship template values are already current.");
const PERSON_EDIT_GUARD_ONLY = new Error("Person edit live-state guard completed.");

export class AtlasMutationService {
	private mutationQueue: Promise<void> = Promise.resolve();
	// 10x: reservations bridge plugin-owned writes until the asynchronous index
	// observes them; replace with index acknowledgements if that lifecycle gains
	// an awaitable commit API.
	private readonly reservedPersonIds = new Map<string, string>();
	private readonly reservedRelationshipIds = new Map<string, string>();
	private readonly reservedContactMomentIds = new Map<string, string>();
	private readonly contactMomentRetries = new WeakMap<ContactMomentRelationshipRetryToken, ContactMomentRetryState>();

	constructor(
		private readonly app: App,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly canWrite: () => boolean,
		private readonly index: MutationIndex,
		private readonly generateId: () => string = () => `person-${crypto.randomUUID()}`,
		private readonly generateContactMomentId: () => string = () => `contact-moment-${crypto.randomUUID()}`,
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

	createContactMoment(
		input: ContactMomentMutationInput,
		options: ContactMomentSaveOptions,
	): Promise<ContactMomentMutationResult> {
		return this.runExclusive(() => this.createContactMomentExclusive(input, options));
	}

	updateContactMoment(
		file: TFile,
		input: ContactMomentMutationInput,
		updates: ContactMomentUpdates,
		options: ContactMomentUpdateOptions,
	): Promise<ContactMomentMutationResult> {
		return this.runExclusive(() => this.updateContactMomentExclusive(file, input, updates, options));
	}

	updateContactMomentFollowUpStatus(
		input: ContactMomentFollowUpStatusMutationInput,
	): Promise<ContactMomentFollowUpStatusMutationResult> {
		return this.runExclusive(() => this.updateContactMomentFollowUpStatusExclusive(input));
	}

	retryContactMomentRelationship(
		retry: ContactMomentRelationshipRetryToken,
	): Promise<ContactMomentRelationshipRetryResult> {
		return this.runExclusive(() => this.retryContactMomentRelationshipExclusive(retry));
	}

	syncRelationshipPreset(
		file: TFile,
		approvedBefore: RelationshipPresetValues,
		updates: RelationshipPresetSyncUpdates,
	): Promise<RelationshipPresetSyncMutationResult> {
		return this.runExclusive(() => this.syncRelationshipPresetExclusive(file, approvedBefore, updates));
	}

	private async createPersonExclusive(input: PersonMutationInput): Promise<TFile> {
		this.assertWritable();
		const settings = this.getSettings();
		const normalizedInput = this.normalizePersonInput(input);
		const errors = validatePersonInput(normalizedInput, settings);
		const reviewedPath = normalizedInput.reviewedPath?.trim() ?? "";
		if (validateNotePath(reviewedPath)) errors.push("A safe reviewed person path is required for person create.");
		if (normalizedInput.photo?.trim()) {
			errors.push("Person create cannot include a photo; add it in a separate edit after the dossier exists.");
		}
		const folder = normalizePath(settings.peopleRootFolder);
		if (validateFolderPath(folder)) errors.push("The configured People root folder is invalid.");
		const personId = normalizedInput.personId?.trim() ?? "";
		if (!personDossierSuffix(personId)) errors.push("An explicit UUID-backed person_id is required for person create.");
		const dossierPath = personDossierPath(folder, normalizedInput.name, personId);
		const proposedPath = personProfilePath(folder, normalizedInput.name, personId);
		if (!dossierPath || !proposedPath)
			errors.push("The person name and person_id cannot produce a valid dossier path.");
		const path = proposedPath;
		if (reviewedPath !== path) {
			errors.push("The reviewed person path changed before Save. Review the current destination and try again.");
		}
		if (this.identityInUse(personId, path, this.reservedPersonIds, (id) => this.index.getPeoplePathsById(id))) {
			errors.push(`person_id “${personId}” is already in use.`);
		}
		if (dossierPath && this.app.vault.getAbstractFileByPath(dossierPath)) {
			errors.push(`A dossier already exists at “${dossierPath}”.`);
		}
		if (this.app.vault.getAbstractFileByPath(path)) errors.push(`A note already exists at “${path}”.`);
		if (errors.length > 0) throw new MutationError(errors.join(" "));
		const createdFolders = await this.ensureFolder(dossierPath);
		const createdDossier = createdFolders.get(dossierPath);
		if (!createdDossier || this.app.vault.getAbstractFileByPath(dossierPath) !== createdDossier) {
			throw new MutationError(`The dossier “${dossierPath}” was not created by this transaction.`);
		}
		const frontmatter = this.personFrontmatter(normalizedInput, personId, settings);
		let file: TFile;
		try {
			if (this.identityInUse(personId, path, this.reservedPersonIds, (id) => this.index.getPeoplePathsById(id))) {
				throw new MutationError(`person_id “${personId}” is already in use.`);
			}
			file = await this.app.vault.create(path, `---\n${frontmatter}---\n`);
		} catch (error) {
			const createdDossier = createdFolders.get(dossierPath);
			const liveDossier = this.app.vault.getAbstractFileByPath(dossierPath);
			const liveChildren = (liveDossier as { children?: unknown } | null)?.children;
			if (
				createdDossier &&
				liveDossier === createdDossier &&
				Array.isArray(liveChildren) &&
				liveChildren.length === 0
			) {
				try {
					await this.app.fileManager.trashFile(createdDossier);
				} catch {
					// The profile-note failure remains primary; an undeleted empty dossier is safer than masking it.
				}
			}
			throw error;
		}
		this.rememberIdentity(this.reservedPersonIds, personId, path);
		return file;
	}

	private async createRelationshipExclusive(input: RelationshipMutationInput): Promise<TFile> {
		this.assertWritable();
		const settings = this.getSettings();
		const path = normalizePath(input.path);
		const errors = validateRelationshipInput({ ...input, path }, settings);
		const relationshipsFolder = peopleCollectionPaths(settings.peopleRootFolder).relationships;
		if (path.split("/").slice(0, -1).join("/") !== relationshipsFolder) {
			errors.push(`New relationships must use the configured central collection “${relationshipsFolder}”.`);
		}

		const relationshipId = input.relationshipId?.trim() || this.generateId();
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

	private async createContactMomentExclusive(
		input: ContactMomentMutationInput,
		options: ContactMomentSaveOptions,
	): Promise<ContactMomentMutationResult> {
		this.assertWritable();
		const settings = this.getSettings();
		const contactSettings: ContactMomentSettings = settings;
		const generatedId = input.contactMomentId?.trim() || this.generateContactMomentId();
		const normalizedInput = normalizeContactMomentMutationInput({
			...input,
			contactMomentId: generatedId,
		});
		const errors = validateContactMomentMutationInput(normalizedInput, contactSettings);
		const relationshipFile = this.validateCanonicalContactMomentTargets(normalizedInput, settings, errors);
		const path = normalizePath(normalizedInput.path);
		const contactMomentsFolder = peopleCollectionPaths(settings.peopleRootFolder).contactMoments;
		if (path.split("/").slice(0, -1).join("/") !== contactMomentsFolder) {
			errors.push(`New contact moments must use the configured central collection “${contactMomentsFolder}”.`);
		}
		const contactMomentId = normalizedInput.contactMomentId ?? generatedId;
		if (
			this.identityInUse(
				contactMomentId,
				path,
				this.reservedContactMomentIds,
				(id) => this.index.getContactMomentPathsById?.(id) ?? [],
			)
		) {
			errors.push(`contact_moment_id “${contactMomentId}” is already in use.`);
		}
		if (this.app.vault.getAbstractFileByPath(path)) errors.push(`A note already exists at “${path}”.`);
		this.validateDestinationFolder(path.split("/").slice(0, -1).join("/"), errors);
		if (errors.length > 0) throw new MutationError([...new Set(errors)].join(" "));

		const relationshipPlan = await this.prepareRelationshipAdvance(
			normalizedInput,
			options,
			contactSettings,
			relationshipFile,
		);
		await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
		const frontmatter = this.contactMomentFrontmatter(normalizedInput, contactMomentId, contactSettings);
		const file = await this.app.vault.create(path, `---\n${frontmatter}---\n`);
		this.rememberIdentity(this.reservedContactMomentIds, contactMomentId, path);
		return this.finishContactMomentRelationship(
			file,
			true,
			normalizedInput.occurredOn,
			relationshipPlan,
			contactSettings,
		);
	}

	private async updateContactMomentExclusive(
		file: TFile,
		input: ContactMomentMutationInput,
		updates: ContactMomentUpdates,
		options: ContactMomentUpdateOptions,
	): Promise<ContactMomentMutationResult> {
		this.assertWritable();
		const settings = this.getSettings();
		const contactSettings: ContactMomentSettings = settings;
		const normalizedInput = normalizeContactMomentMutationInput(input);
		const errors = validateContactMomentMutationInput(normalizedInput, contactSettings);
		if (normalizePath(normalizedInput.path) !== normalizePath(file.path)) {
			errors.push("Editing a contact moment cannot rename or move its note.");
		}
		errors.push(...this.contactMomentUpdateConsistencyErrors(normalizedInput, updates));

		const cache = this.app.metadataCache.getFileCache(file);
		const current = cache?.frontmatter ?? {};
		if (!contactMomentEditSourceMatches(current, contactSettings, options.sourceBaseline)) {
			errors.push("The contact moment changed after the editor was opened. Reopen it before saving.");
		}
		if (
			this.readString(current, contactSettings.typeProperty)?.toLowerCase() !==
			contactSettings.contactMomentTypeValue.trim().toLowerCase()
		) {
			errors.push("The contact-moment note is no longer canonical.");
		}
		const currentExplicitId = this.readString(current, contactSettings.contactMomentIdProperty);
		const currentId = normalizeStoredId(currentExplicitId);
		const expectedId = options.expectedContactMomentId.trim();
		if (currentId !== expectedId) errors.push("The contact-moment identity changed after the editor was opened.");
		const resultingExplicitId = normalizedInput.contactMomentId ?? currentExplicitId;
		const resultingId = normalizeStoredId(resultingExplicitId);
		const indexedCurrentPaths = this.index.getContactMomentPathsById?.(currentId);
		if (
			indexedCurrentPaths &&
			(indexedCurrentPaths.length !== 1 || !indexedCurrentPaths.some((path) => this.sameVaultPath(path, file.path)))
		) {
			errors.push("The contact-moment identity is missing or ambiguous in the canonical index.");
		}
		if (
			this.identityInUse(
				resultingId,
				file.path,
				this.reservedContactMomentIds,
				(id) => this.index.getContactMomentPathsById?.(id) ?? [],
			)
		) {
			errors.push(`contact_moment_id “${resultingId}” is already in use.`);
		}
		const relationshipFile = this.validateCanonicalContactMomentTargets(normalizedInput, settings, errors);
		if (errors.length > 0) throw new MutationError([...new Set(errors)].join(" "));

		const momentBaseline = await this.captureContactMomentBaseline(file, true);
		const relationshipPlan = await this.prepareRelationshipAdvance(
			normalizedInput,
			options,
			contactSettings,
			relationshipFile,
		);
		if (Object.values(updates).some((value) => value !== undefined)) {
			await this.assertContactMomentBaseline(momentBaseline, file, "contact moment");
			await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
				if (
					momentBaseline.frontmatterSignature !== this.stableFrontmatterSignature(frontmatter) ||
					this.readString(frontmatter, contactSettings.typeProperty)?.toLowerCase() !==
						contactSettings.contactMomentTypeValue.trim().toLowerCase() ||
					normalizeStoredId(this.readString(frontmatter, contactSettings.contactMomentIdProperty)) !== currentId
				) {
					throw new MutationError("The contact moment changed while it was being saved. Reopen it before editing.");
				}
				this.applyContactMomentUpdates(frontmatter, normalizedInput, updates, contactSettings);
			});
		}
		this.rememberIdentity(this.reservedContactMomentIds, resultingId, file.path);
		return this.finishContactMomentRelationship(
			file,
			false,
			normalizedInput.occurredOn,
			relationshipPlan,
			contactSettings,
		);
	}

	private async updateContactMomentFollowUpStatusExclusive(
		rawInput: ContactMomentFollowUpStatusMutationInput,
	): Promise<ContactMomentFollowUpStatusMutationResult> {
		this.assertWritable();
		const settings = this.getSettings();
		const contactSettings: ContactMomentSettings = settings;
		const input = normalizeContactMomentFollowUpStatusMutationInput(rawInput);
		const errors = validateContactMomentFollowUpStatusMutationInput(input);
		const indexedPaths = this.index.getContactMomentPathsById?.(input.contactMomentId) ?? [];
		if (
			indexedPaths.length !== 1 ||
			!indexedPaths.some((indexedPath) => this.sameVaultPath(indexedPath, input.filePath))
		) {
			errors.push("The contact-moment follow-up is missing or ambiguous in the canonical index.");
		}
		const file = this.noteFileAt(input.filePath);
		if (!file) errors.push(`The contact-moment note is no longer available at “${input.filePath}”.`);
		if (file) errors.push(...this.contactMomentFollowUpStatusTargetErrors(file, input, settings));
		if (errors.length > 0 || !file) throw new MutationError([...new Set(errors)].join(" "));

		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			const liveIndexedPaths = this.index.getContactMomentPathsById?.(input.contactMomentId) ?? [];
			const liveErrors =
				liveIndexedPaths.length === 1 &&
				liveIndexedPaths.some((indexedPath) => this.sameVaultPath(indexedPath, input.filePath))
					? []
					: ["The contact-moment follow-up is missing or ambiguous in the canonical index."];
			liveErrors.push(...this.contactMomentFollowUpStatusTargetErrors(file, input, settings, frontmatter));
			if (liveErrors.length > 0) throw new MutationError([...new Set(liveErrors)].join(" "));
			this.apply(frontmatter, contactSettings.contactMomentFollowUpStatusProperty, input.status);
		});
		return { file, status: input.status };
	}

	private contactMomentFollowUpStatusTargetErrors(
		file: TFile,
		input: ContactMomentFollowUpStatusMutationInput,
		settings: PeopleAtlasSettings,
		frontmatter: Record<string, unknown> = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {},
	): string[] {
		const errors: string[] = [];
		if (!this.sameVaultPath(file.path, input.filePath)) {
			errors.push("The contact-moment follow-up path changed after it was reviewed.");
		}
		const currentType = this.readStrictOptionalString(frontmatter, settings.typeProperty);
		if (
			!currentType.validShape ||
			currentType.value?.toLowerCase() !== settings.contactMomentTypeValue.trim().toLowerCase()
		) {
			errors.push("The contact-moment follow-up is no longer a canonical contact-moment note.");
		}
		const currentExplicitId = this.readStrictOptionalString(frontmatter, settings.contactMomentIdProperty);
		const currentId = normalizeStoredId(currentExplicitId.value);
		if (!currentExplicitId.validShape || currentId !== input.contactMomentId) {
			errors.push("The contact-moment follow-up identity changed after it was reviewed.");
		}
		const rawPeople = frontmatter[settings.contactMomentPeopleProperty];
		const hasCanonicalPeopleShape =
			Array.isArray(rawPeople) && rawPeople.length > 0 && rawPeople.every((raw) => typeof raw === "string");
		if (!hasCanonicalPeopleShape) {
			errors.push("The contact-moment people are no longer a non-empty list of text references.");
		}
		const currentPeople = hasCanonicalPeopleShape
			? rawPeople.map((raw) =>
					this.resolveExpectedRelationshipEndpointId(raw, input.reviewedPersonIds, file.path, settings),
				)
			: [];
		if (
			currentPeople.length !== input.reviewedPersonIds.length ||
			currentPeople.some((personId, index) => personId !== input.reviewedPersonIds[index])
		) {
			errors.push("The contact-moment people changed or are no longer canonical after the follow-up was reviewed.");
		}
		const currentOccurredOn = this.readStrictOptionalString(frontmatter, settings.contactMomentOccurredOnProperty);
		if (!currentOccurredOn.validShape || currentOccurredOn.value !== input.reviewedOccurredOn) {
			errors.push("The contact-moment occurred-on date changed after the follow-up was reviewed.");
		}
		const rawRelationship = frontmatter[settings.contactMomentRelationshipProperty];
		const hasCanonicalRelationshipShape =
			input.reviewedRelationshipId === undefined
				? rawRelationship === null || rawRelationship === undefined
				: typeof rawRelationship === "string" && rawRelationship.trim().length > 0;
		if (!hasCanonicalRelationshipShape) {
			errors.push("The contact-moment relationship no longer has the reviewed canonical value shape.");
		}
		if (
			!this.reviewedContactMomentRelationshipIsCanonical(
				typeof rawRelationship === "string" ? rawRelationship.trim() || undefined : undefined,
				input.reviewedRelationshipId,
				input.reviewedPersonIds,
				file.path,
				settings,
			)
		) {
			errors.push(
				"The contact-moment relationship changed or is no longer canonical after the follow-up was reviewed.",
			);
		}
		const currentFollowUpOn = this.readStrictOptionalString(frontmatter, settings.contactMomentFollowUpOnProperty);
		if (!currentFollowUpOn.validShape || currentFollowUpOn.value !== input.reviewedFollowUpOn) {
			errors.push("The contact-moment follow-up date changed after it was reviewed.");
		}
		const currentStatus = this.readStrictOptionalString(frontmatter, settings.contactMomentFollowUpStatusProperty);
		if (!currentStatus.validShape || currentStatus.value?.toLowerCase() !== input.reviewedFollowUpStatus) {
			errors.push("The contact-moment follow-up status changed after it was reviewed.");
		}
		return errors;
	}

	private async retryContactMomentRelationshipExclusive(
		retry: ContactMomentRelationshipRetryToken,
	): Promise<ContactMomentRelationshipRetryResult> {
		this.assertWritable();
		const state = this.contactMomentRetries.get(retry);
		if (!state) {
			return {
				status: "error",
				message: "This relationship retry is unavailable. Review the saved contact moment before trying again.",
			};
		}
		if (state.completed && state.completedResult) {
			return { status: "success", relationship: state.completedResult };
		}
		if (!state.momentBaseline || !state.relationshipBaseline) {
			return {
				status: "error",
				message:
					"The saved notes could not be baselined after the partial save. Review both notes before updating the relationship.",
			};
		}

		const settings = this.getSettings();
		const contactSettings: ContactMomentSettings = settings;
		try {
			await this.assertContactMomentBaseline(state.momentBaseline, state.momentFile, "contact moment");
			await this.assertContactMomentBaseline(state.relationshipBaseline, state.relationshipFile, "relationship");
			const errors: string[] = [];
			const relationshipFile = this.validateCanonicalContactMomentRelationshipTarget(
				state.target,
				settings,
				errors,
				new Set(state.momentPersonIds),
			);
			if (!relationshipFile || errors.length > 0) {
				throw new MutationError(errors.join(" ") || "The linked relationship is no longer canonical.");
			}
			const current = this.app.metadataCache.getFileCache(relationshipFile)?.frontmatter ?? {};
			const decision = decideLastContactAdvance(
				this.readString(current, contactSettings.lastContactProperty),
				state.occurredOn,
			);
			const plan: PreparedRelationshipAdvance = {
				status: "prepared",
				file: relationshipFile,
				target: state.target,
				momentPersonIds: state.momentPersonIds,
				baseline: state.relationshipBaseline,
				decision,
			};
			const relationship = await this.commitRelationshipAdvance(plan, state.occurredOn, contactSettings);
			state.completed = true;
			state.completedResult = relationship;
			return { status: "success", relationship };
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async updatePersonExclusive(
		file: TFile,
		updates: PersonUpdates,
		options: PersonEditOptions,
	): Promise<PersonEditResult> {
		this.assertWritable();
		const settings = this.getSettings();
		const cache = this.app.metadataCache.getFileCache(file);
		const current = cache?.frontmatter ?? {};
		const targetPath = options.targetPath ? normalizePath(options.targetPath) : undefined;
		const renameRequired = targetPath !== undefined && targetPath !== file.path;
		const writeUpdates = this.normalizePersonUpdates(updates);
		const explicitPersonId =
			typeof current[settings.personIdProperty] === "string" && current[settings.personIdProperty].trim()
				? current[settings.personIdProperty].trim()
				: undefined;
		const name =
			writeUpdates.name === null ? "" : (writeUpdates.name ?? String(current[settings.nameProperty] ?? file.basename));
		const cachedPersonId = explicitPersonId ?? this.reservedIdentityForPath(this.reservedPersonIds, file.path);
		const expectedCurrentPersonId = options.expectedPersonId?.trim() || normalizeStoredId(cachedPersonId);
		const expectedClassification =
			options.expectedClassification ?? this.personClassification(cache, current, settings);
		const personId = writeUpdates.personId === null ? undefined : (writeUpdates.personId ?? cachedPersonId);
		const errors = [...validatePersonInput({ name, personId }, settings), ...validatePersonUpdates(writeUpdates)];
		if (!cachedPersonId) errors.push("The person note must define a non-empty person_id before it can be edited.");
		if (writeUpdates.photo !== undefined && writeUpdates.photo !== null) {
			const photoError = this.explicitPersonPhotoError(writeUpdates.photo, settings, file.path, explicitPersonId ?? "");
			if (photoError) errors.push(photoError);
		}
		if (
			!expectedClassification ||
			!this.personClassificationMatches(cache, current, settings, expectedClassification)
		) {
			errors.push(STALE_PERSON_EDIT_MESSAGE);
		}
		const resultingPersonId = normalizeStoredId(personId);
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
		let tagSources: PersonTagSource[] | undefined;
		if (expectedClassification === "tag") {
			tagSources = options.sourceBaseline
				? await verifyPersonEditSourceBaseline(this.app, file, settings.personTag, options.sourceBaseline)
				: undefined;
			if (!tagSources) throw new MutationError(STALE_PERSON_EDIT_MESSAGE);
		}
		const propertiesChanged = Object.keys(writeUpdates).length > 0;
		if (propertiesChanged || renameRequired) {
			// processFrontMatter exposes frontmatter atomically, so a frontmatter tag is
			// rechecked inside its callback. Body tags are guarded by exact source plus
			// stat checks here; the host API leaves a narrow residual race between this
			// last check and its internal read that cannot be closed without replacing
			// Obsidian's supported frontmatter mutation path.
			if (
				expectedClassification === "tag" &&
				(!options.sourceBaseline || !personSourceStatMatches(file, options.sourceBaseline))
			) {
				throw new MutationError(STALE_PERSON_EDIT_MESSAGE);
			}
			try {
				await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
					const liveType = this.readString(frontmatter, settings.typeProperty)?.toLowerCase();
					const livePersonId = normalizeStoredId(this.readString(frontmatter, settings.personIdProperty));
					if (
						!this.livePersonClassificationMatches(
							liveType,
							frontmatter,
							settings,
							expectedClassification,
							tagSources,
						) ||
						livePersonId !== expectedCurrentPersonId
					) {
						throw new MutationError(STALE_PERSON_EDIT_MESSAGE);
					}
					if (writeUpdates.photo !== undefined && writeUpdates.photo !== null) {
						const liveSettings = this.getSettings();
						const livePhotoPersonId = normalizeStoredId(this.readString(frontmatter, liveSettings.personIdProperty));
						const photoError = this.explicitPersonPhotoError(
							writeUpdates.photo,
							liveSettings,
							file.path,
							livePhotoPersonId,
						);
						if (photoError) throw new MutationError(photoError);
						// The supported host API has no note-plus-asset transaction. A narrow
						// residual window remains after this callback returns and before the host
						// commits the frontmatter draft.
					}
					if (!propertiesChanged) throw PERSON_EDIT_GUARD_ONLY;
					this.apply(frontmatter, settings.nameProperty, writeUpdates.name);
					this.apply(frontmatter, settings.personIdProperty, writeUpdates.personId);
					this.apply(frontmatter, settings.aliasesProperty, writeUpdates.aliases);
					this.apply(frontmatter, settings.organisationsProperty, writeUpdates.organisations);
					this.apply(frontmatter, settings.photoProperty, writeUpdates.photo);
					this.apply(frontmatter, settings.contactsProperty, writeUpdates.contacts);
					this.apply(frontmatter, settings.birthDateProperty, writeUpdates.birthDate);
					this.apply(frontmatter, settings.pronounsProperty, writeUpdates.pronouns);
					this.apply(frontmatter, settings.genderProperty, writeUpdates.gender);
					this.apply(frontmatter, settings.emailsProperty, writeUpdates.emails);
					this.apply(frontmatter, settings.phonesProperty, writeUpdates.phones);
					this.apply(frontmatter, settings.jobTitleProperty, writeUpdates.jobTitle);
				});
			} catch (error) {
				if (error !== PERSON_EDIT_GUARD_ONLY) throw error;
			}
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

	private explicitPersonPhotoError(
		photo: string,
		settings: PeopleAtlasSettings,
		profilePath: string,
		personId: string,
	): string | undefined {
		let photoPath = "";
		if (photo.startsWith("[[") && photo.endsWith("]]")) {
			const candidatePath = photo.slice(2, -2);
			try {
				if (canonicalPersonPhotoWikilink(candidatePath) === photo) photoPath = candidatePath;
			} catch {
				// The shared canonicalizer supplies the supported vault-path grammar.
			}
		}
		if (!photoPath) return "A changed photo must be one exact canonical wikilink to a supported vault image.";
		const dossierPath = personDossierPathFromProfile(settings.peopleRootFolder, profilePath, personId);
		const photoFile = this.app.vault.getAbstractFileByPath(photoPath);
		if (!(photoFile instanceof TFile) || photoFile.path !== photoPath) {
			return `The changed photo “${photoPath}” is missing or is not a supported vault file.`;
		}
		if (
			!dossierPath ||
			dossierPersonPhotoAssets(
				[{ path: photoFile.path, basename: photoFile.basename, extension: photoFile.extension }],
				dossierPath,
			).length !== 1
		) {
			return "A changed photo must be inside the person's current canonical dossier.";
		}
		return undefined;
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
		const closeness = value<number>(settings.closenessProperty, updates.closeness);
		if (closeness !== undefined) input.closeness = closeness;
		const since = value<string>(settings.sinceProperty, updates.since);
		if (since !== undefined) input.since = since;
		const lastContact = value<string>(settings.lastContactProperty, updates.lastContact);
		if (lastContact !== undefined) input.lastContact = lastContact;
		const status = value<"active" | "dormant" | "ended">(settings.statusProperty, updates.status);
		if (status !== undefined) input.status = status;
		const errors = validateRelationshipInput(input, settings);
		const resultingRelationshipId = normalizeStoredId(relationshipId);
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
			this.apply(frontmatter, settings.closenessProperty, updates.closeness);
			this.apply(frontmatter, settings.sinceProperty, updates.since);
			this.apply(frontmatter, settings.lastContactProperty, updates.lastContact);
			this.apply(frontmatter, settings.statusProperty, updates.status);
		});
		this.rememberIdentity(this.reservedRelationshipIds, resultingRelationshipId, file.path);
	}

	private validateCanonicalContactMomentTargets(
		input: ContactMomentMutationInput,
		settings: PeopleAtlasSettings,
		errors: string[],
	): TFile | undefined {
		for (const person of input.people) {
			const indexedPaths = this.index.getPeoplePathsById(person.id);
			if (indexedPaths.length !== 1 || !indexedPaths.some((path) => this.sameVaultPath(path, person.filePath))) {
				errors.push(`Person “${person.filePath}” is missing or ambiguous in the canonical index.`);
				continue;
			}
			const file = this.noteFileAt(person.filePath);
			const cache = file ? this.app.metadataCache.getFileCache(file) : null;
			const frontmatter = cache?.frontmatter ?? {};
			if (
				!file ||
				!this.personClassification(cache, frontmatter, settings) ||
				normalizeStoredId(this.readString(frontmatter, settings.personIdProperty)) !== person.id
			) {
				errors.push(`Person “${person.filePath}” is no longer a canonical person note.`);
			}
		}
		if (input.relationship?.kind !== "canonical") return undefined;
		return this.validateCanonicalContactMomentRelationshipTarget(
			input.relationship,
			settings,
			errors,
			new Set(input.people.map((person) => person.id)),
		);
	}

	private validateCanonicalContactMomentRelationshipTarget(
		target: CanonicalContactMomentRelationshipTarget,
		settings: PeopleAtlasSettings,
		errors: string[],
		momentPersonIds: ReadonlySet<string>,
	): TFile | undefined {
		const indexedPaths = this.index.getRelationshipPathsById(target.id);
		if (indexedPaths.length !== 1 || !indexedPaths.some((path) => this.sameVaultPath(path, target.filePath))) {
			errors.push(`Relationship “${target.filePath}” is missing or ambiguous in the canonical index.`);
			return undefined;
		}
		const file = this.noteFileAt(target.filePath);
		const frontmatter = file ? (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) : {};
		if (
			!file ||
			this.readString(frontmatter, settings.typeProperty)?.toLowerCase() !==
				settings.relationshipTypeValue.trim().toLowerCase() ||
			normalizeStoredId(this.readString(frontmatter, settings.relationshipIdProperty)) !== target.id
		) {
			errors.push(`Relationship “${target.filePath}” is no longer a canonical relationship note.`);
			return undefined;
		}
		const fromId = this.resolveExpectedRelationshipEndpointId(
			this.readString(frontmatter, settings.relationshipFromProperty),
			target.personIds,
			file.path,
			settings,
		);
		const toId = this.resolveExpectedRelationshipEndpointId(
			this.readString(frontmatter, settings.relationshipToProperty),
			target.personIds,
			file.path,
			settings,
		);
		if (target.personIds.length !== 2 || fromId !== target.personIds[0] || toId !== target.personIds[1]) {
			errors.push(`Relationship “${target.filePath}” endpoints no longer match the reviewed canonical relationship.`);
			return undefined;
		}
		if (!target.personIds.some((personId) => momentPersonIds.has(personId))) {
			errors.push(`Relationship “${target.filePath}” no longer shares a canonical person with the contact moment.`);
			return undefined;
		}
		return file;
	}

	private resolveExpectedRelationshipEndpointId(
		raw: string | undefined,
		expectedPersonIds: readonly string[],
		sourcePath: string,
		settings: PeopleAtlasSettings,
	): string | undefined {
		if (!raw) return undefined;
		const reference = parsePersonReference(raw);
		if (!reference) return undefined;
		const candidatePersonIds = [...new Set(expectedPersonIds)];
		const resolvedIds = new Set<string>();
		const directMatches = candidatePersonIds.filter(
			(personId) => personId === reference.target && this.canonicalPersonPathForId(personId, settings) !== undefined,
		);
		if (directMatches.length > 1) return undefined;
		if (directMatches[0]) resolvedIds.add(directMatches[0]);

		const resolvedPath = this.app.metadataCache.getFirstLinkpathDest(reference.target, sourcePath)?.path;
		if (resolvedPath) {
			const pathMatches = candidatePersonIds.filter((personId) => {
				const personPath = this.canonicalPersonPathForId(personId, settings);
				return personPath !== undefined && this.sameVaultPath(personPath, resolvedPath);
			});
			if (pathMatches.length !== 1) return undefined;
			if (pathMatches[0]) resolvedIds.add(pathMatches[0]);
		}

		const exactPathMatches = candidatePersonIds.filter((personId) => {
			const personPath = this.canonicalPersonPathForId(personId, settings);
			return (
				personPath !== undefined &&
				(this.sameVaultPath(personPath, reference.target) ||
					this.sameVaultPath(personPath.replace(/\.md$/i, ""), reference.target))
			);
		});
		if (exactPathMatches.length > 1) return undefined;
		if (exactPathMatches[0]) resolvedIds.add(exactPathMatches[0]);
		return resolvedIds.size === 1 ? [...resolvedIds][0] : undefined;
	}

	private reviewedContactMomentRelationshipIsCanonical(
		raw: string | undefined,
		reviewedRelationshipId: string | undefined,
		momentPersonIds: readonly string[],
		sourcePath: string,
		settings: PeopleAtlasSettings,
	): boolean {
		if (reviewedRelationshipId === undefined) return raw === undefined;
		if (!raw) return false;
		const relationshipFile = this.canonicalRelationshipFileForId(reviewedRelationshipId, settings);
		if (!relationshipFile) return false;
		const reference = parsePersonReference(raw);
		if (!reference) return false;
		let matched = false;
		if (reference.target === reviewedRelationshipId) matched = true;

		const resolvedPath = this.app.metadataCache.getFirstLinkpathDest(reference.target, sourcePath)?.path;
		if (resolvedPath) {
			if (!this.sameVaultPath(resolvedPath, relationshipFile.path)) return false;
			matched = true;
		}

		const exactFile =
			this.noteFileAt(reference.target) ??
			this.noteFileAt(reference.target.replace(/\.md$/i, "")) ??
			this.noteFileAt(`${reference.target.replace(/\.md$/i, "")}.md`);
		if (exactFile) {
			if (!this.sameVaultPath(exactFile.path, relationshipFile.path)) return false;
			matched = true;
		}
		if (!matched) return false;

		const frontmatter = this.app.metadataCache.getFileCache(relationshipFile)?.frontmatter ?? {};
		const rawFrom = this.readStrictOptionalString(frontmatter, settings.relationshipFromProperty);
		const rawTo = this.readStrictOptionalString(frontmatter, settings.relationshipToProperty);
		if (!rawFrom.validShape || !rawTo.validShape) return false;
		const fromId = this.resolveCanonicalPersonReferenceId(rawFrom.value, relationshipFile.path, settings);
		const toId = this.resolveCanonicalPersonReferenceId(rawTo.value, relationshipFile.path, settings);
		return Boolean(
			fromId && toId && fromId !== toId && (momentPersonIds.includes(fromId) || momentPersonIds.includes(toId)),
		);
	}

	private canonicalRelationshipFileForId(relationshipId: string, settings: PeopleAtlasSettings): TFile | undefined {
		const indexedPaths = this.index.getRelationshipPathsById(relationshipId);
		if (indexedPaths.length !== 1) return undefined;
		const path = indexedPaths[0];
		if (!path) return undefined;
		const file = this.noteFileAt(path);
		const frontmatter = file ? (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) : {};
		const relationshipType = this.readStrictOptionalString(frontmatter, settings.typeProperty);
		const explicitRelationshipId = this.readStrictOptionalString(frontmatter, settings.relationshipIdProperty);
		if (
			!file ||
			!relationshipType.validShape ||
			relationshipType.value?.toLowerCase() !== settings.relationshipTypeValue.trim().toLowerCase() ||
			!explicitRelationshipId.validShape ||
			normalizeStoredId(explicitRelationshipId.value) !== relationshipId
		) {
			return undefined;
		}
		return file;
	}

	private resolveCanonicalPersonReferenceId(
		raw: string | undefined,
		sourcePath: string,
		settings: PeopleAtlasSettings,
	): string | undefined {
		if (!raw) return undefined;
		const reference = parsePersonReference(raw);
		if (!reference) return undefined;
		const candidateIds = new Set<string>();

		const directPaths = this.index.getPeoplePathsById(reference.target);
		if (directPaths.length > 1) return undefined;
		const directPath = directPaths[0];
		if (directPath) {
			const directId = this.canonicalPersonIdForPath(directPath, settings);
			if (directId !== reference.target) return undefined;
			candidateIds.add(directId);
		}

		const resolvedPath = this.app.metadataCache.getFirstLinkpathDest(reference.target, sourcePath)?.path;
		if (resolvedPath) {
			const resolvedId = this.canonicalPersonIdForPath(resolvedPath, settings);
			if (!resolvedId) return undefined;
			candidateIds.add(resolvedId);
		}

		const exactFiles = new Map<string, TFile>();
		for (const candidatePath of [
			reference.target,
			reference.target.replace(/\.md$/i, ""),
			`${reference.target.replace(/\.md$/i, "")}.md`,
		]) {
			const file = this.noteFileAt(candidatePath);
			if (file) exactFiles.set(normalizePathIdentity(file.path), file);
		}
		for (const file of exactFiles.values()) {
			const exactId = this.canonicalPersonIdForPath(file.path, settings);
			if (!exactId) return undefined;
			candidateIds.add(exactId);
		}
		return candidateIds.size === 1 ? [...candidateIds][0] : undefined;
	}

	private canonicalPersonIdForPath(path: string, settings: PeopleAtlasSettings): string | undefined {
		const file = this.noteFileAt(path);
		const cache = file ? this.app.metadataCache.getFileCache(file) : null;
		const frontmatter = cache?.frontmatter ?? {};
		if (!file || !this.personClassification(cache, frontmatter, settings)) return undefined;
		const personId = normalizeStoredId(this.readString(frontmatter, settings.personIdProperty));
		const indexedPaths = this.index.getPeoplePathsById(personId);
		return indexedPaths.length === 1 && indexedPaths.some((indexedPath) => this.sameVaultPath(indexedPath, file.path))
			? personId
			: undefined;
	}

	private canonicalPersonPathForId(personId: string, settings: PeopleAtlasSettings): string | undefined {
		const indexedPaths = this.index.getPeoplePathsById(personId);
		if (indexedPaths.length !== 1) return undefined;
		const path = indexedPaths[0];
		if (!path) return undefined;
		const file = this.noteFileAt(path);
		const cache = file ? this.app.metadataCache.getFileCache(file) : null;
		const frontmatter = cache?.frontmatter ?? {};
		if (
			!file ||
			!this.personClassification(cache, frontmatter, settings) ||
			normalizeStoredId(this.readString(frontmatter, settings.personIdProperty)) !== personId
		) {
			return undefined;
		}
		return file.path;
	}

	private async prepareRelationshipAdvance(
		input: ContactMomentMutationInput,
		options: ContactMomentSaveOptions,
		settings: ContactMomentSettings,
		relationshipFile: TFile | undefined,
	): Promise<RelationshipAdvancePlan> {
		if (!options.advanceRelationshipLastContact) {
			return {
				status: "not-requested",
				message: "Linked relationship last-contact advancement was not requested.",
			};
		}
		if (input.relationship?.kind !== "canonical" || !relationshipFile) {
			throw new MutationError("Last contact can be advanced only for one current canonical linked relationship.");
		}
		const baseline = await this.captureContactMomentBaseline(relationshipFile, true);
		const currentLastContact = this.readString(baseline.frontmatter ?? {}, settings.lastContactProperty);
		let decision: LastContactAdvanceDecision;
		try {
			decision = decideLastContactAdvance(currentLastContact, input.occurredOn);
		} catch (error) {
			throw new MutationError(error instanceof Error ? error.message : String(error));
		}
		return {
			status: "prepared",
			file: relationshipFile,
			target: input.relationship,
			momentPersonIds: input.people.map((person) => person.id),
			baseline,
			decision,
		};
	}

	private async finishContactMomentRelationship(
		file: TFile,
		created: boolean,
		occurredOn: string,
		plan: RelationshipAdvancePlan,
		settings: ContactMomentSettings,
	): Promise<ContactMomentMutationResult> {
		if (plan.status !== "prepared") {
			return { status: "success", file, created, relationship: plan };
		}
		try {
			const relationship = await this.commitRelationshipAdvance(plan, occurredOn, settings);
			return { status: "success", file, created, relationship };
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			const retry: ContactMomentRelationshipRetryToken = Object.freeze({
				attemptId: `contact-moment-retry-${crypto.randomUUID()}`,
				momentPath: file.path,
				relationshipPath: plan.file.path,
				occurredOn,
			});
			const [momentBaseline, relationshipBaseline] = await Promise.all([
				this.captureContactMomentBaselineSafely(file, false),
				this.captureContactMomentBaselineSafely(plan.file, true),
			]);
			this.contactMomentRetries.set(retry, {
				momentFile: file,
				relationshipFile: plan.file,
				target: plan.target,
				momentPersonIds: plan.momentPersonIds,
				momentBaseline,
				relationshipBaseline,
				occurredOn,
				completed: false,
			});
			return {
				status: "partial-success",
				file,
				created,
				momentPath: file.path,
				relationshipPath: plan.file.path,
				reason,
				retry,
			};
		}
	}

	private async commitRelationshipAdvance(
		plan: PreparedRelationshipAdvance,
		occurredOn: string,
		settings: ContactMomentSettings,
	): Promise<ContactMomentRelationshipAdvanceResult> {
		await this.assertContactMomentBaseline(plan.baseline, plan.file, "relationship");
		if (plan.decision.status === "unchanged") {
			return {
				status: "unchanged",
				relationshipPath: plan.file.path,
				currentLastContact: plan.decision.currentLastContact,
				reason: plan.decision.reason,
				message:
					plan.decision.reason === "equal"
						? `The linked relationship already has last contact ${plan.decision.currentLastContact}; it was left unchanged.`
						: `The linked relationship has the later last contact ${plan.decision.currentLastContact}; it was left unchanged.`,
			};
		}
		await this.app.fileManager.processFrontMatter(plan.file, (frontmatter: Record<string, unknown>) => {
			if (
				plan.baseline.frontmatterSignature !== this.stableFrontmatterSignature(frontmatter) ||
				this.readString(frontmatter, settings.typeProperty)?.toLowerCase() !==
					settings.relationshipTypeValue.trim().toLowerCase() ||
				normalizeStoredId(this.readString(frontmatter, settings.relationshipIdProperty)) !== plan.target.id
			) {
				throw new MutationError(
					"The linked relationship changed before last contact could be updated. Review current values.",
				);
			}
			this.apply(frontmatter, settings.lastContactProperty, occurredOn);
		});
		const result: ContactMomentRelationshipAdvanceResult = {
			status: "advanced",
			relationshipPath: plan.file.path,
			lastContact: occurredOn,
			message: plan.decision.previousLastContact
				? `The linked relationship last contact advanced from ${plan.decision.previousLastContact} to ${occurredOn}.`
				: `The linked relationship last contact was set to ${occurredOn}.`,
		};
		if (plan.decision.previousLastContact !== undefined) {
			result.previousLastContact = plan.decision.previousLastContact;
		}
		return result;
	}

	private contactMomentUpdateConsistencyErrors(
		input: ContactMomentMutationInput,
		updates: ContactMomentUpdates,
	): string[] {
		const errors: string[] = [];
		if (updates.contactMomentId !== undefined && updates.contactMomentId.trim() !== (input.contactMomentId ?? "")) {
			errors.push("The contact-moment ID update does not match the reviewed form values.");
		}
		if (updates.people !== undefined && !this.sameContactMomentPeople(updates.people, input.people)) {
			errors.push("The contact-moment people update does not match the reviewed form values.");
		}
		if (updates.relationship !== undefined) {
			if (updates.relationship === null) {
				if (input.relationship !== undefined) {
					errors.push("The relationship removal does not match the reviewed form values.");
				}
			} else if (!this.sameContactMomentRelationship(updates.relationship, input.relationship)) {
				errors.push("The relationship update does not match the reviewed form values.");
			}
		}
		this.validateContactMomentScalarUpdate("Occurred-on", updates.occurredOn, input.occurredOn, errors);
		this.validateContactMomentScalarUpdate("Channel", updates.channel, input.channel, errors);
		this.validateContactMomentScalarUpdate("Summary", updates.summary, input.summary, errors);
		this.validateContactMomentScalarUpdate("Follow-up date", updates.followUpOn, input.followUpOn, errors);
		this.validateContactMomentScalarUpdate("Follow-up status", updates.followUpStatus, input.followUpStatus, errors);
		return errors;
	}

	private validateContactMomentScalarUpdate(
		label: string,
		update: string | null | undefined,
		reviewed: string | undefined,
		errors: string[],
	): void {
		if (update === undefined) return;
		if (update === null ? reviewed !== undefined : update.trim() !== reviewed) {
			errors.push(`${label} update does not match the reviewed form values.`);
		}
	}

	private sameContactMomentPeople(
		left: ContactMomentMutationInput["people"],
		right: ContactMomentMutationInput["people"],
	): boolean {
		return (
			left.length === right.length &&
			left.every(
				(person, index) =>
					person.id.trim() === right[index]?.id && this.sameVaultPath(person.filePath, right[index]?.filePath ?? ""),
			)
		);
	}

	private sameContactMomentRelationship(
		left: NonNullable<ContactMomentMutationInput["relationship"]>,
		right: ContactMomentMutationInput["relationship"],
	): boolean {
		if (!right || left.kind !== right.kind) return false;
		return (
			left.id.trim() === right.id &&
			this.sameVaultPath(left.filePath, right.filePath) &&
			left.personIds.length === right.personIds.length &&
			left.personIds.every((personId, index) => personId.trim() === right.personIds[index])
		);
	}

	private applyContactMomentUpdates(
		frontmatter: Record<string, unknown>,
		input: ContactMomentMutationInput,
		updates: ContactMomentUpdates,
		settings: ContactMomentSettings,
	): void {
		if (updates.contactMomentId !== undefined) {
			this.apply(frontmatter, settings.contactMomentIdProperty, input.contactMomentId);
		}
		if (updates.people !== undefined) {
			this.apply(
				frontmatter,
				settings.contactMomentPeopleProperty,
				input.people.map((person) => contactMomentWikilink(person.filePath)),
			);
		}
		if (updates.relationship !== undefined) {
			this.apply(
				frontmatter,
				settings.contactMomentRelationshipProperty,
				updates.relationship === null ? null : this.contactMomentRelationshipValue(input.relationship),
			);
		}
		if (updates.occurredOn !== undefined) {
			this.apply(frontmatter, settings.contactMomentOccurredOnProperty, input.occurredOn);
		}
		if (updates.channel !== undefined) {
			this.apply(frontmatter, settings.contactMomentChannelProperty, updates.channel === null ? null : input.channel);
		}
		if (updates.summary !== undefined) {
			this.apply(frontmatter, settings.contactMomentSummaryProperty, updates.summary === null ? null : input.summary);
		}
		if (updates.followUpOn !== undefined) {
			this.apply(
				frontmatter,
				settings.contactMomentFollowUpOnProperty,
				updates.followUpOn === null ? null : input.followUpOn,
			);
		}
		if (updates.followUpStatus !== undefined) {
			this.apply(
				frontmatter,
				settings.contactMomentFollowUpStatusProperty,
				updates.followUpStatus === null ? null : input.followUpStatus,
			);
		}
	}

	private contactMomentFrontmatter(
		input: ContactMomentMutationInput,
		contactMomentId: string,
		settings: ContactMomentSettings,
	): string {
		const relationship = this.contactMomentRelationshipValue(input.relationship);
		return `${[
			`${settings.typeProperty}: ${yamlValue(settings.contactMomentTypeValue)}`,
			`${settings.contactMomentIdProperty}: ${yamlValue(contactMomentId)}`,
			`${settings.contactMomentPeopleProperty}: ${yamlValue(
				input.people.map((person) => contactMomentWikilink(person.filePath)),
			)}`,
			...(relationship ? [`${settings.contactMomentRelationshipProperty}: ${yamlValue(relationship)}`] : []),
			`${settings.contactMomentOccurredOnProperty}: ${yamlValue(input.occurredOn)}`,
			...(input.channel ? [`${settings.contactMomentChannelProperty}: ${yamlValue(input.channel)}`] : []),
			...(input.summary ? [`${settings.contactMomentSummaryProperty}: ${yamlValue(input.summary)}`] : []),
			...(input.followUpOn ? [`${settings.contactMomentFollowUpOnProperty}: ${yamlValue(input.followUpOn)}`] : []),
			...(input.followUpStatus
				? [`${settings.contactMomentFollowUpStatusProperty}: ${yamlValue(input.followUpStatus)}`]
				: []),
		].join("\n")}\n`;
	}

	private contactMomentRelationshipValue(relationship: ContactMomentMutationInput["relationship"]): string | undefined {
		if (!relationship) return undefined;
		return relationship.kind === "canonical"
			? contactMomentWikilink(relationship.filePath)
			: relationship.raw.trim() || undefined;
	}

	private validateDestinationFolder(folder: string, errors: string[]): void {
		let current = "";
		for (const part of folder.split("/").filter(Boolean)) {
			current = current ? `${current}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing && !Array.isArray((existing as { children?: unknown }).children)) {
				errors.push(`The destination “${current}” is not a folder.`);
				return;
			}
		}
	}

	private noteFileAt(path: string): TFile | undefined {
		const candidate = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (
			!candidate ||
			Array.isArray((candidate as { children?: unknown }).children) ||
			!candidate.path.toLowerCase().endsWith(".md")
		) {
			return undefined;
		}
		return candidate as TFile;
	}

	private sameVaultPath(left: string, right: string): boolean {
		return normalizePathIdentity(left) === normalizePathIdentity(right);
	}

	private async captureContactMomentBaseline(
		file: TFile,
		includeFrontmatter: boolean,
	): Promise<ContactMomentNoteBaseline> {
		const before = this.contactMomentFileStat(file);
		const source = await this.app.vault.read(file);
		const after = this.contactMomentFileStat(file);
		if (before && after && (before.mtime !== after.mtime || before.size !== after.size)) {
			throw new MutationError(`The note “${file.path}” changed while it was being inspected.`);
		}
		const baseline: ContactMomentNoteBaseline = { path: file.path, source };
		const stat = after ?? before;
		if (stat) {
			baseline.mtime = stat.mtime;
			baseline.size = stat.size;
		}
		if (includeFrontmatter) {
			const frontmatter = structuredClone(this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<
				string,
				unknown
			>;
			baseline.frontmatter = frontmatter;
			baseline.frontmatterSignature = this.stableFrontmatterSignature(frontmatter);
		}
		return baseline;
	}

	private async captureContactMomentBaselineSafely(
		file: TFile,
		includeFrontmatter: boolean,
	): Promise<ContactMomentNoteBaseline | undefined> {
		try {
			return await this.captureContactMomentBaseline(file, includeFrontmatter);
		} catch {
			return undefined;
		}
	}

	private async assertContactMomentBaseline(
		baseline: ContactMomentNoteBaseline,
		file: TFile,
		label: string,
	): Promise<void> {
		const currentFile = this.noteFileAt(baseline.path);
		if (!currentFile || !this.sameVaultPath(currentFile.path, file.path)) {
			throw new MutationError(`The ${label} note is no longer available at “${baseline.path}”.`);
		}
		const current = await this.captureContactMomentBaseline(currentFile, baseline.frontmatterSignature !== undefined);
		if (
			current.source !== baseline.source ||
			(baseline.mtime !== undefined && current.mtime !== baseline.mtime) ||
			(baseline.size !== undefined && current.size !== baseline.size) ||
			(baseline.frontmatterSignature !== undefined && current.frontmatterSignature !== baseline.frontmatterSignature)
		) {
			throw new MutationError(
				`The ${label} note changed after the partial save. Review current values before retrying.`,
			);
		}
	}

	private contactMomentFileStat(file: TFile): { mtime: number; size: number } | undefined {
		const stat = (file as TFile & { stat?: { mtime?: number; size?: number } }).stat;
		return stat && typeof stat.mtime === "number" && typeof stat.size === "number"
			? { mtime: stat.mtime, size: stat.size }
			: undefined;
	}

	private stableFrontmatterSignature(frontmatter: Record<string, unknown>): string {
		return JSON.stringify(this.stableContactMomentValue(frontmatter));
	}

	private stableContactMomentValue(value: unknown): unknown {
		if (Array.isArray(value)) return value.map((entry) => this.stableContactMomentValue(entry));
		if (value && typeof value === "object") {
			const entries = Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, this.stableContactMomentValue(entry)]);
			return Object.fromEntries(entries);
		}
		return value;
	}

	private async syncRelationshipPresetExclusive(
		file: TFile,
		approvedBefore: RelationshipPresetValues,
		updates: RelationshipPresetSyncUpdates,
	): Promise<RelationshipPresetSyncMutationResult> {
		this.assertWritable();
		const settings = this.getSettings();
		let writtenRelationshipId: string | undefined;
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
				if (
					this.readString(frontmatter, settings.typeProperty)?.toLowerCase() !==
					settings.relationshipTypeValue.trim().toLowerCase()
				) {
					throw new MutationError(STALE_RELATIONSHIP_PRESET_PREVIEW_MESSAGE);
				}
				const liveValues = this.relationshipPresetValues(frontmatter, settings);
				const approvedPresetId = this.normalizedString(approvedBefore.presetId);
				if (liveValues.presetId === approvedPresetId && this.sameRelationshipPresetOwnedValues(liveValues, updates)) {
					throw RELATIONSHIP_PRESET_ALREADY_CURRENT;
				}
				if (!this.sameRelationshipPresetValues(liveValues, approvedBefore)) {
					throw new MutationError(STALE_RELATIONSHIP_PRESET_PREVIEW_MESSAGE);
				}

				const relationshipId = this.readString(frontmatter, settings.relationshipIdProperty);
				const input: RelationshipMutationInput = {
					path: file.path,
					from: this.readString(frontmatter, settings.relationshipFromProperty) ?? "",
					to: this.readString(frontmatter, settings.relationshipToProperty) ?? "",
					types: [...updates.types],
					fromRole: updates.fromRole,
					toRole: updates.toRole,
				};
				if (relationshipId !== undefined) input.relationshipId = relationshipId;
				const presetId = this.readString(frontmatter, settings.relationshipPresetProperty);
				if (presetId !== undefined) input.presetId = presetId;
				const closeness = this.readNumber(frontmatter, settings.closenessProperty);
				if (closeness !== undefined) input.closeness = closeness;
				const since = this.readString(frontmatter, settings.sinceProperty);
				if (since !== undefined) input.since = since;
				const lastContact = this.readString(frontmatter, settings.lastContactProperty);
				if (lastContact !== undefined) input.lastContact = lastContact;
				const status = this.readString(frontmatter, settings.statusProperty);
				if (status !== undefined) input.status = status as "active" | "dormant" | "ended";

				const errors = validateRelationshipInput(input, settings);
				const resultingRelationshipId = normalizeStoredId(relationshipId);
				if (
					this.identityInUse(resultingRelationshipId, file.path, this.reservedRelationshipIds, (id) =>
						this.index.getRelationshipPathsById(id),
					)
				) {
					errors.push(`relationship_id “${resultingRelationshipId}” is already in use.`);
				}
				if (errors.length > 0) throw new MutationError(errors.join(" "));

				this.apply(frontmatter, settings.relationshipTypesProperty, [...updates.types]);
				this.apply(frontmatter, settings.relationshipFromRoleProperty, updates.fromRole);
				this.apply(frontmatter, settings.relationshipToRoleProperty, updates.toRole);
				writtenRelationshipId = resultingRelationshipId;
			});
		} catch (error) {
			if (error === RELATIONSHIP_PRESET_ALREADY_CURRENT) return { status: "already-current" };
			throw error;
		}
		if (writtenRelationshipId !== undefined) {
			this.rememberIdentity(this.reservedRelationshipIds, writtenRelationshipId, file.path);
		}
		if (writtenRelationshipId === undefined) throw new MutationError("The relationship note could not be inspected.");
		return { status: "updated" };
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

	private personClassification(
		cache: CachedMetadata | null,
		frontmatter: Record<string, unknown>,
		settings: PeopleAtlasSettings,
	): "type" | "tag" | undefined {
		if (
			this.readString(frontmatter, settings.typeProperty)?.toLowerCase() ===
			settings.personTypeValue.trim().toLowerCase()
		) {
			return "type";
		}
		const expectedTag = this.normalizeTag(settings.personTag);
		if (!expectedTag) return undefined;
		return cache && getAllTags(cache)?.some((tag) => this.normalizeTag(tag) === expectedTag) ? "tag" : undefined;
	}

	private personClassificationMatches(
		cache: CachedMetadata | null,
		frontmatter: Record<string, unknown>,
		settings: PeopleAtlasSettings,
		expected: "type" | "tag",
	): boolean {
		const liveType = this.readString(frontmatter, settings.typeProperty)?.toLowerCase();
		const personType = settings.personTypeValue.trim().toLowerCase();
		if (expected === "type") return liveType === personType;
		if (liveType !== undefined) return liveType === personType;
		const expectedTag = this.normalizeTag(settings.personTag);
		return (
			Boolean(expectedTag) &&
			(cache ? (getAllTags(cache)?.some((tag) => this.normalizeTag(tag) === expectedTag) ?? false) : false)
		);
	}

	private livePersonClassificationMatches(
		liveType: string | undefined,
		frontmatter: Record<string, unknown>,
		settings: PeopleAtlasSettings,
		expected: "type" | "tag" | undefined,
		tagSources: PersonTagSource[] | undefined,
	): boolean {
		if (!expected) return false;
		const personType = settings.personTypeValue.trim().toLowerCase();
		if (expected === "type") return liveType === personType;
		if (liveType !== undefined) return liveType === personType;
		return (
			Boolean(tagSources?.includes("body")) ||
			(Boolean(tagSources?.includes("frontmatter")) && frontmatterHasPersonTag(frontmatter, settings.personTag))
		);
	}

	private normalizeTag(tag: string): string {
		return tag.trim().replace(/^#/, "").toLowerCase();
	}

	private relationshipPresetValues(
		frontmatter: Record<string, unknown>,
		settings: PeopleAtlasSettings,
	): RelationshipPresetValues {
		return {
			presetId: this.readString(frontmatter, settings.relationshipPresetProperty),
			types: this.readStringList(frontmatter, settings.relationshipTypesProperty),
			fromRole: this.readString(frontmatter, settings.relationshipFromRoleProperty),
			toRole: this.readString(frontmatter, settings.relationshipToRoleProperty),
		};
	}

	private sameRelationshipPresetValues(
		liveValues: RelationshipPresetValues,
		approvedValues: RelationshipPresetValues,
	): boolean {
		const approved = {
			presetId: this.normalizedString(approvedValues.presetId),
			types: this.normalizedStringList(approvedValues.types),
			fromRole: this.normalizedString(approvedValues.fromRole),
			toRole: this.normalizedString(approvedValues.toRole),
		};
		return (
			liveValues.presetId === approved.presetId &&
			liveValues.fromRole === approved.fromRole &&
			liveValues.toRole === approved.toRole &&
			liveValues.types.length === approved.types.length &&
			liveValues.types.every((type, index) => type === approved.types[index])
		);
	}

	private sameRelationshipPresetOwnedValues(
		liveValues: RelationshipPresetValues,
		updates: RelationshipPresetSyncUpdates,
	): boolean {
		const types = this.normalizedStringList(updates.types);
		return (
			liveValues.fromRole === this.normalizedString(updates.fromRole) &&
			liveValues.toRole === this.normalizedString(updates.toRole) &&
			liveValues.types.length === types.length &&
			liveValues.types.every((type, index) => type === types[index])
		);
	}

	private readString(frontmatter: Record<string, unknown>, property: string): string | undefined {
		return this.normalizedString(frontmatter[property]);
	}

	private readStrictOptionalString(
		frontmatter: Record<string, unknown>,
		property: string,
	): { validShape: boolean; value: string | undefined } {
		const raw = frontmatter[property];
		if (raw === null || raw === undefined) return { validShape: true, value: undefined };
		if (typeof raw !== "string") return { validShape: false, value: undefined };
		const value = raw.trim();
		return { validShape: true, value: value || undefined };
	}

	private readStringList(frontmatter: Record<string, unknown>, property: string): string[] {
		return this.normalizedStringList(frontmatter[property]);
	}

	private normalizedString(value: unknown): string | undefined {
		if (value === null || value === undefined) return undefined;
		const result = String(value).trim();
		return result.length > 0 ? result : undefined;
	}

	private normalizedStringList(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value.map((entry) => this.normalizedString(entry)).filter((entry): entry is string => entry !== undefined);
		}
		const single = this.normalizedString(value);
		return single ? [single] : [];
	}

	private readNumber(frontmatter: Record<string, unknown>, property: string): number | undefined {
		const value = frontmatter[property];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		const stringValue = typeof value === "string" ? value.trim() : "";
		if (!stringValue) return undefined;
		const parsed = Number(stringValue);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	private assertWritable(): void {
		if (!this.canWrite()) throw new MutationError("People Atlas writes are disabled until plugin data is repaired.");
	}

	private async ensureFolder(folder: string): Promise<Map<string, TAbstractFile>> {
		const created = new Map<string, TAbstractFile>();
		if (!folder) return created;
		let current = "";
		for (const part of folder.split("/")) {
			current = current ? `${current}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing && !Array.isArray((existing as { children?: unknown }).children))
				throw new MutationError(`The destination “${current}” is not a folder.`);
			if (!existing) created.set(current, await this.app.vault.createFolder(current));
		}
		return created;
	}

	private personFrontmatter(input: PersonMutationInput, personId: string, settings: PeopleAtlasSettings): string {
		return `${[
			`${settings.typeProperty}: ${yamlValue(settings.personTypeValue)}`,
			`${settings.personIdProperty}: ${yamlValue(personId)}`,
			`${settings.nameProperty}: ${yamlValue(input.name.trim())}`,
			...(input.aliases?.length ? [`${settings.aliasesProperty}: ${yamlValue(input.aliases)}`] : []),
			...(input.organisations?.length ? [`${settings.organisationsProperty}: ${yamlValue(input.organisations)}`] : []),
			...(input.contacts?.length ? [`${settings.contactsProperty}: ${yamlValue(input.contacts)}`] : []),
			...(input.birthDate ? [`${settings.birthDateProperty}: ${yamlValue(input.birthDate)}`] : []),
			...(input.pronouns ? [`${settings.pronounsProperty}: ${yamlValue(input.pronouns)}`] : []),
			...(input.gender ? [`${settings.genderProperty}: ${yamlValue(input.gender)}`] : []),
			...(input.emails?.length ? [`${settings.emailsProperty}: ${yamlValue(input.emails)}`] : []),
			...(input.phones?.length ? [`${settings.phonesProperty}: ${yamlValue(input.phones)}`] : []),
			...(input.jobTitle ? [`${settings.jobTitleProperty}: ${yamlValue(input.jobTitle)}`] : []),
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

	private normalizePersonInput(input: PersonMutationInput): PersonMutationInput {
		const normalized: PersonMutationInput = { ...input, name: input.name.trim() };
		if (input.personId !== undefined) normalized.personId = input.personId.trim();
		if (input.birthDate !== undefined) normalized.birthDate = input.birthDate.trim();
		if (input.pronouns !== undefined) normalized.pronouns = input.pronouns.trim();
		if (input.gender !== undefined) normalized.gender = input.gender.trim();
		if (input.emails !== undefined) normalized.emails = input.emails.map((value) => value.trim());
		if (input.phones !== undefined) normalized.phones = input.phones.map((value) => value.trim());
		if (input.jobTitle !== undefined) normalized.jobTitle = input.jobTitle.trim();
		return normalized;
	}

	private normalizePersonUpdates(updates: PersonUpdates): PersonUpdates {
		const normalized = { ...updates };
		if (typeof updates.birthDate === "string") normalized.birthDate = updates.birthDate.trim();
		if (typeof updates.pronouns === "string") normalized.pronouns = updates.pronouns.trim();
		if (typeof updates.gender === "string") normalized.gender = updates.gender.trim();
		if (Array.isArray(updates.emails)) normalized.emails = updates.emails.map((value) => value.trim());
		if (Array.isArray(updates.phones)) normalized.phones = updates.phones.map((value) => value.trim());
		if (typeof updates.jobTitle === "string") normalized.jobTitle = updates.jobTitle.trim();
		return normalized;
	}
}
