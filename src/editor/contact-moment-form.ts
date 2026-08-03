import type { TFile } from "obsidian";
import type {
	ContactMomentFollowUpStatus,
	ContactMomentRecord,
	PersonRecord,
	PersonReference,
	RelationshipRecord,
	RelationshipReference,
} from "../domain/types";
import { peopleCollectionPaths } from "../domain/people-paths";
import type {
	ContactMomentMutationInput,
	ContactMomentMutationResult,
	ContactMomentEditSourceBaseline,
	ContactMomentRelationshipRetryResult,
	ContactMomentRelationshipRetryToken,
	ContactMomentUpdates,
} from "../mutations/contact-moment";
import { contactMomentWikilink, shortContactMomentId } from "../mutations/contact-moment";
import { sanitizeNoteName } from "../mutations/validation";
import { resolveCanonicalPersonByPath } from "./relationship-form";

export interface ContactMomentFormValues {
	path: string;
	contactMomentId: string;
	peoplePaths: string[];
	relationshipPath: string;
	occurredOn: string;
	channel: string;
	summary: string;
	followUpOn: string;
	followUpStatus: ContactMomentFollowUpStatus | "";
	advanceRelationshipLastContact: boolean;
}

export interface ContactMomentFormContext {
	people: PersonRecord[];
	relationships: RelationshipRecord[];
	resolveLink(target: string, sourcePath: string): string | undefined;
}

export interface CreateContactMomentFormOptions {
	peopleRootFolder: string;
	contactMomentId: string;
	today: string;
	people: PersonRecord[];
	prefilledPersonPaths?: string[] | undefined;
}

export interface ContactMomentMutationPort {
	createContactMoment(
		input: ContactMomentMutationInput,
		options: { advanceRelationshipLastContact: boolean },
	): Promise<ContactMomentMutationResult>;
	updateContactMoment(
		file: TFile,
		input: ContactMomentMutationInput,
		updates: ContactMomentUpdates,
		options: {
			advanceRelationshipLastContact: boolean;
			expectedContactMomentId: string;
			sourceBaseline: ContactMomentEditSourceBaseline;
		},
	): Promise<ContactMomentMutationResult>;
	retryContactMomentRelationship(
		retry: ContactMomentRelationshipRetryToken,
	): Promise<ContactMomentRelationshipRetryResult>;
}

export type ContactMomentFormSessionMode =
	| { kind: "create" }
	| {
			kind: "edit";
			file: TFile;
			original: ContactMomentFormValues;
			expectedContactMomentId: string;
			sourceBaseline: ContactMomentEditSourceBaseline;
	  };

export type ContactMomentSubmitResult =
	| ContactMomentMutationResult
	| { status: "error"; message: string }
	| { status: "busy" }
	| { status: "cancelled" };

export type ContactMomentRetrySubmitResult =
	| ContactMomentRelationshipRetryResult
	| { status: "busy" }
	| { status: "cancelled" };

export function createContactMomentFormValues(options: CreateContactMomentFormOptions): ContactMomentFormValues {
	const peoplePaths = uniqueCanonicalPersonPaths(options.prefilledPersonPaths ?? [], options.people);
	const values: ContactMomentFormValues = {
		path: "",
		contactMomentId: options.contactMomentId.trim(),
		peoplePaths,
		relationshipPath: "",
		occurredOn: options.today.trim(),
		channel: "",
		summary: "",
		followUpOn: "",
		followUpStatus: "",
		advanceRelationshipLastContact: false,
	};
	values.path = proposeContactMomentPath(values, options.people, options.peopleRootFolder);
	return values;
}

export function editContactMomentFormValues(
	record: ContactMomentRecord,
	context: ContactMomentFormContext,
): ContactMomentFormValues {
	const peoplePaths = record.people.map((reference) => {
		const person = resolveCanonicalPersonReference(reference, record.filePath, context);
		if (!person) {
			throw new Error(`Contact moment “${record.filePath}” has a person reference that is not currently canonical.`);
		}
		return person.filePath;
	});
	if (new Set(peoplePaths).size !== peoplePaths.length || peoplePaths.length === 0) {
		throw new Error(`Contact moment “${record.filePath}” does not have a unique canonical people list.`);
	}

	let relationshipPath = "";
	if (record.relationship) {
		const canonical = resolveCanonicalContactMomentRelationship(record, peoplePaths, context);
		if (!canonical) {
			throw new Error(`Contact moment “${record.filePath}” has a relationship that is not currently canonical.`);
		}
		relationshipPath = canonical.filePath;
	}
	return {
		path: record.filePath,
		contactMomentId: record.id,
		peoplePaths,
		relationshipPath,
		occurredOn: record.occurredOn,
		channel: record.channel ?? "",
		summary: record.summary ?? "",
		followUpOn: record.followUpOn ?? "",
		followUpStatus: record.followUpStatus ?? "",
		advanceRelationshipLastContact: false,
	};
}

export function proposeContactMomentPath(
	values: Pick<ContactMomentFormValues, "occurredOn" | "contactMomentId" | "peoplePaths">,
	people: PersonRecord[],
	peopleRootFolder: string,
): string {
	const primary = resolveCanonicalPersonByPath(people, values.peoplePaths[0] ?? "");
	const label = primary ? sanitizeNoteName(primary.name) : "";
	const occurredOn = values.occurredOn.trim();
	const shortId = shortContactMomentId(values.contactMomentId);
	if (!label || !occurredOn || !shortId) return "";
	const folder = peopleCollectionPaths(peopleRootFolder).contactMoments;
	return `${folder}/${occurredOn} - ${label} - ${shortId}.md`;
}

export function matchingContactMomentRelationships(
	peoplePaths: readonly string[],
	context: ContactMomentFormContext,
): RelationshipRecord[] {
	const selectedPeople = uniqueCanonicalPersonPaths(peoplePaths, context.people)
		.map((path) => resolveCanonicalPersonByPath(context.people, path))
		.filter((person): person is PersonRecord => person !== undefined);
	if (selectedPeople.length !== peoplePaths.length || selectedPeople.length === 0) return [];
	const selectedIds = new Set(selectedPeople.map((person) => person.id));
	return context.relationships
		.filter((relationship) => {
			if (!isUniqueCanonicalRelationship(relationship, context)) return false;
			const endpointIds = relationshipPersonIds(relationship, context);
			return endpointIds?.some((id) => selectedIds.has(id)) ?? false;
		})
		.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

export function buildContactMomentMutationInput(
	values: ContactMomentFormValues,
	context: ContactMomentFormContext,
): ContactMomentMutationInput {
	const people = values.peoplePaths.map((path) => {
		const person = resolveCanonicalPersonByPath(context.people, path);
		if (!person) throw new Error(`Person “${path}” must be selected from canonical indexed people.`);
		return { id: person.id, filePath: person.filePath };
	});
	const input: ContactMomentMutationInput = {
		path: values.path.trim(),
		people,
		occurredOn: values.occurredOn.trim(),
	};
	const contactMomentId = optionalString(values.contactMomentId);
	const relationship = contactMomentRelationshipTarget(values, context);
	const channel = optionalString(values.channel);
	const summary = optionalString(values.summary);
	const followUpOn = optionalString(values.followUpOn);
	const followUpStatus = values.followUpStatus || (followUpOn ? "open" : undefined);
	if (contactMomentId !== undefined) input.contactMomentId = contactMomentId;
	if (relationship !== undefined) input.relationship = relationship;
	if (channel !== undefined) input.channel = channel;
	if (summary !== undefined) input.summary = summary;
	if (followUpOn !== undefined) input.followUpOn = followUpOn;
	if (followUpStatus !== undefined) input.followUpStatus = followUpStatus;
	return input;
}

export function buildContactMomentUpdates(
	values: ContactMomentFormValues,
	original: ContactMomentFormValues,
	context: ContactMomentFormContext,
): ContactMomentUpdates {
	const updates: ContactMomentUpdates = {};
	const input = buildContactMomentMutationInput(values, context);
	if (values.contactMomentId.trim() !== original.contactMomentId.trim()) {
		updates.contactMomentId = input.contactMomentId ?? "";
	}
	if (!sameStrings(values.peoplePaths, original.peoplePaths)) updates.people = input.people;
	if (values.relationshipPath !== original.relationshipPath) {
		updates.relationship = input.relationship ?? null;
	}
	if (values.occurredOn.trim() !== original.occurredOn.trim()) updates.occurredOn = input.occurredOn;
	if (values.channel.trim() !== original.channel.trim()) updates.channel = input.channel ?? null;
	if (values.summary.trim() !== original.summary.trim()) updates.summary = input.summary ?? null;
	const followUpChanged = values.followUpOn.trim() !== original.followUpOn.trim();
	if (followUpChanged) updates.followUpOn = input.followUpOn ?? null;
	if (values.followUpStatus !== original.followUpStatus || (followUpChanged && input.followUpOn)) {
		updates.followUpStatus = input.followUpStatus ?? null;
	}
	return updates;
}

export class ContactMomentFormSession {
	private pending = false;
	private cancelled = false;
	private completed = false;
	private partialResult: Extract<ContactMomentMutationResult, { status: "partial-success" }> | undefined;

	constructor(
		private readonly mode: ContactMomentFormSessionMode,
		context: ContactMomentFormContext,
		private readonly mutations: ContactMomentMutationPort,
		private readonly getCurrentContext: () => ContactMomentFormContext = () => context,
	) {}

	cancel(): void {
		if (!this.pending && !this.completed && !this.partialResult) this.cancelled = true;
	}

	async submit(values: ContactMomentFormValues): Promise<ContactMomentSubmitResult> {
		if (this.cancelled || this.completed) return { status: "cancelled" };
		if (this.partialResult) return this.partialResult;
		if (this.pending) return { status: "busy" };
		this.pending = true;
		try {
			const context = this.getCurrentContext();
			const input = buildContactMomentMutationInput(values, context);
			const result =
				this.mode.kind === "create"
					? await this.mutations.createContactMoment(input, {
							advanceRelationshipLastContact: values.advanceRelationshipLastContact,
						})
					: await this.mutations.updateContactMoment(
							this.mode.file,
							input,
							buildContactMomentUpdates(values, this.mode.original, context),
							{
								advanceRelationshipLastContact: values.advanceRelationshipLastContact,
								expectedContactMomentId: this.mode.expectedContactMomentId,
								sourceBaseline: this.mode.sourceBaseline,
							},
						);
			if (result.status === "partial-success") this.partialResult = result;
			else this.completed = true;
			return result;
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			};
		} finally {
			this.pending = false;
		}
	}

	async retryRelationship(): Promise<ContactMomentRetrySubmitResult> {
		if (this.cancelled || this.completed) return { status: "cancelled" };
		if (this.pending) return { status: "busy" };
		if (!this.partialResult) {
			return { status: "error", message: "There is no pending relationship update to retry." };
		}
		this.pending = true;
		try {
			const result = await this.mutations.retryContactMomentRelationship(this.partialResult.retry);
			if (result.status === "success") this.completed = true;
			return result;
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			};
		} finally {
			this.pending = false;
		}
	}
}

function contactMomentRelationshipTarget(
	values: Pick<ContactMomentFormValues, "peoplePaths" | "relationshipPath">,
	context: ContactMomentFormContext,
): ContactMomentMutationInput["relationship"] {
	if (values.relationshipPath) {
		const matches = matchingContactMomentRelationships(values.peoplePaths, context).filter(
			(relationship) => relationship.filePath === values.relationshipPath,
		);
		const relationship = matches.length === 1 ? matches[0] : undefined;
		const personIds = relationship ? relationshipPersonIds(relationship, context) : undefined;
		if (!relationship || !personIds) {
			throw new Error(
				`Relationship “${values.relationshipPath}” must be selected from matching canonical relationships.`,
			);
		}
		return {
			kind: "canonical",
			id: relationship.id,
			filePath: relationship.filePath,
			personIds,
			raw: contactMomentWikilink(relationship.filePath),
		};
	}
	return undefined;
}

function resolveCanonicalContactMomentRelationship(
	record: ContactMomentRecord,
	peoplePaths: string[],
	context: ContactMomentFormContext,
): RelationshipRecord | undefined {
	const matching = matchingContactMomentRelationships(peoplePaths, context);
	if (record.relationshipId) {
		const idMatches = matching.filter((relationship) => relationship.id === record.relationshipId);
		if (idMatches.length === 1) return idMatches[0];
	}
	if (!record.relationship) return undefined;
	const path = resolveRelationshipReferencePath(record.relationship, record.filePath, context);
	const pathMatches = matching.filter((relationship) => relationship.filePath === path);
	return pathMatches.length === 1 ? pathMatches[0] : undefined;
}

function isUniqueCanonicalRelationship(relationship: RelationshipRecord, context: ContactMomentFormContext): boolean {
	return (
		context.relationships.filter((candidate) => candidate.id === relationship.id).length === 1 &&
		context.relationships.filter((candidate) => candidate.filePath === relationship.filePath).length === 1 &&
		relationshipPersonIds(relationship, context) !== undefined
	);
}

function relationshipPersonIds(
	relationship: RelationshipRecord,
	context: ContactMomentFormContext,
): string[] | undefined {
	const from = resolveCanonicalPersonReference(relationship.from, relationship.filePath, context);
	const to = resolveCanonicalPersonReference(relationship.to, relationship.filePath, context);
	return from && to ? [from.id, to.id] : undefined;
}

function resolveCanonicalPersonReference(
	reference: PersonReference,
	sourcePath: string,
	context: ContactMomentFormContext,
): PersonRecord | undefined {
	const candidates = new Map<string, PersonRecord>();
	const idMatches = context.people.filter((person) => person.id === reference.target);
	if (idMatches.length > 1) return undefined;
	const idMatch = idMatches[0];
	if (idMatch) {
		const canonical = resolveCanonicalPersonByPath(context.people, idMatch.filePath);
		if (!canonical) return undefined;
		candidates.set(canonical.id, canonical);
	}

	const resolvedPaths = new Set(
		[reference.resolvedPath, context.resolveLink(reference.target, sourcePath)].filter((path): path is string =>
			Boolean(path),
		),
	);
	for (const path of resolvedPaths) {
		const pathMatches = context.people.filter((person) => person.filePath === path);
		if (pathMatches.length !== 1) return undefined;
		const canonical = resolveCanonicalPersonByPath(context.people, path);
		if (!canonical) return undefined;
		candidates.set(canonical.id, canonical);
	}

	const exact = context.people.filter(
		(person) => person.filePath === reference.target || person.filePath.replace(/\.md$/i, "") === reference.target,
	);
	if (exact.length > 1) return undefined;
	const exactMatch = exact[0];
	if (exactMatch) {
		const canonical = resolveCanonicalPersonByPath(context.people, exactMatch.filePath);
		if (!canonical) return undefined;
		candidates.set(canonical.id, canonical);
	}
	return candidates.size === 1 ? [...candidates.values()][0] : undefined;
}

function resolveRelationshipReferencePath(
	reference: RelationshipReference,
	sourcePath: string,
	context: ContactMomentFormContext,
): string | undefined {
	const idMatches = context.relationships.filter((relationship) => relationship.id === reference.target);
	if (idMatches.length === 1) return idMatches[0]?.filePath;
	if (idMatches.length > 1) return undefined;
	return reference.resolvedPath ?? context.resolveLink(reference.target, sourcePath);
}

function uniqueCanonicalPersonPaths(paths: readonly string[], people: PersonRecord[]): string[] {
	const result: string[] = [];
	const seen = new Set<string>();
	for (const path of paths) {
		const person = resolveCanonicalPersonByPath(people, path);
		if (!person || seen.has(person.filePath)) continue;
		seen.add(person.filePath);
		result.push(person.filePath);
	}
	return result;
}

function optionalString(value: string): string | undefined {
	const normalized = value.trim();
	return normalized || undefined;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}
