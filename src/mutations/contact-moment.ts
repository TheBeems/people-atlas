import type { TFile } from "obsidian";
import { validateNotePath } from "./validation";

export type ContactMomentFollowUpStatus = "open" | "done" | "dismissed";

export interface ContactMomentSettings {
	typeProperty: string;
	personTypeValue: string;
	relationshipTypeValue: string;
	personIdProperty: string;
	contactMomentTypeValue: string;
	contactMomentIdProperty: string;
	contactMomentPeopleProperty: string;
	contactMomentRelationshipProperty: string;
	contactMomentOccurredOnProperty: string;
	contactMomentChannelProperty: string;
	contactMomentSummaryProperty: string;
	contactMomentFollowUpOnProperty: string;
	contactMomentFollowUpStatusProperty: string;
	relationshipIdProperty: string;
	relationshipFromProperty: string;
	relationshipToProperty: string;
	lastContactProperty: string;
}

export interface ContactMomentPersonTarget {
	id: string;
	filePath: string;
}

export interface CanonicalContactMomentRelationshipTarget {
	kind: "canonical";
	id: string;
	filePath: string;
	personIds: string[];
	raw: string;
}

export type ContactMomentRelationshipTarget = CanonicalContactMomentRelationshipTarget;

export interface ContactMomentMutationInput {
	path: string;
	contactMomentId?: string | undefined;
	people: ContactMomentPersonTarget[];
	relationship?: ContactMomentRelationshipTarget | undefined;
	occurredOn: string;
	channel?: string | undefined;
	summary?: string | undefined;
	followUpOn?: string | undefined;
	followUpStatus?: ContactMomentFollowUpStatus | undefined;
}

export interface ContactMomentUpdates {
	contactMomentId?: string | undefined;
	people?: ContactMomentPersonTarget[] | undefined;
	relationship?: ContactMomentRelationshipTarget | null | undefined;
	occurredOn?: string | undefined;
	channel?: string | null | undefined;
	summary?: string | null | undefined;
	followUpOn?: string | null | undefined;
	followUpStatus?: ContactMomentFollowUpStatus | null | undefined;
}

export interface ContactMomentSaveOptions {
	advanceRelationshipLastContact: boolean;
}

export interface ContactMomentEditSourceBaseline {
	readonly signature: string;
}

export interface ContactMomentUpdateOptions extends ContactMomentSaveOptions {
	expectedContactMomentId: string;
	sourceBaseline: ContactMomentEditSourceBaseline;
}

export type ContactMomentTerminalFollowUpStatus = "done" | "dismissed";

export interface ContactMomentFollowUpStatusMutationInput {
	filePath: string;
	contactMomentId: string;
	reviewedPersonIds: string[];
	reviewedRelationshipId?: string | undefined;
	reviewedOccurredOn: string;
	reviewedFollowUpOn: string;
	reviewedFollowUpStatus: "open" | undefined;
	status: ContactMomentTerminalFollowUpStatus;
}

export interface ContactMomentFollowUpStatusMutationResult {
	file: TFile;
	status: ContactMomentTerminalFollowUpStatus;
}

export type ContactMomentRelationshipAdvanceResult =
	| {
			status: "not-requested";
			message: string;
	  }
	| {
			status: "advanced";
			relationshipPath: string;
			previousLastContact?: string | undefined;
			lastContact: string;
			message: string;
	  }
	| {
			status: "unchanged";
			relationshipPath: string;
			currentLastContact: string;
			reason: "equal" | "later";
			message: string;
	  };

export interface ContactMomentRelationshipRetryToken {
	readonly attemptId: string;
	readonly momentPath: string;
	readonly relationshipPath: string;
	readonly occurredOn: string;
}

export type ContactMomentMutationResult =
	| {
			status: "success";
			file: TFile;
			created: boolean;
			relationship: ContactMomentRelationshipAdvanceResult;
	  }
	| {
			status: "partial-success";
			file: TFile;
			created: boolean;
			momentPath: string;
			relationshipPath: string;
			reason: string;
			retry: ContactMomentRelationshipRetryToken;
	  };

export type ContactMomentRelationshipRetryResult =
	| {
			status: "success";
			relationship: ContactMomentRelationshipAdvanceResult;
	  }
	| {
			status: "error";
			message: string;
	  };

export type LastContactAdvanceDecision =
	| { status: "advance"; previousLastContact?: string | undefined }
	| { status: "unchanged"; currentLastContact: string; reason: "equal" | "later" };

export function normalizeContactMomentFollowUpStatusMutationInput(
	input: ContactMomentFollowUpStatusMutationInput,
): ContactMomentFollowUpStatusMutationInput {
	return {
		filePath: normalizeVaultPath(input.filePath),
		contactMomentId: input.contactMomentId.trim(),
		reviewedPersonIds: input.reviewedPersonIds.map((personId) => personId.trim()),
		...(input.reviewedRelationshipId !== undefined
			? { reviewedRelationshipId: input.reviewedRelationshipId.trim() }
			: {}),
		reviewedOccurredOn: input.reviewedOccurredOn.trim(),
		reviewedFollowUpOn: input.reviewedFollowUpOn.trim(),
		reviewedFollowUpStatus: input.reviewedFollowUpStatus,
		status: input.status,
	};
}

export function validateContactMomentFollowUpStatusMutationInput(
	input: ContactMomentFollowUpStatusMutationInput,
): string[] {
	const errors: string[] = [];
	if (validateNotePath(input.filePath)) errors.push("A safe Markdown contact-moment path is required.");
	if (!input.contactMomentId.trim()) errors.push("A reviewed contact-moment ID is required.");
	const reviewedPersonIds = input.reviewedPersonIds.map((personId) => personId.trim());
	if (
		reviewedPersonIds.length === 0 ||
		reviewedPersonIds.some((personId) => !personId) ||
		new Set(reviewedPersonIds).size !== reviewedPersonIds.length
	) {
		errors.push("Reviewed contact-moment people must be a non-empty ordered list of unique stable IDs.");
	}
	if (input.reviewedRelationshipId !== undefined && !input.reviewedRelationshipId.trim()) {
		errors.push("Reviewed relationship ID cannot be empty when provided.");
	}
	if (!isFullCalendarDate(input.reviewedOccurredOn)) {
		errors.push("The reviewed occurred-on date must use a valid YYYY-MM-DD value.");
	}
	if (!isFullCalendarDate(input.reviewedFollowUpOn)) {
		errors.push("The reviewed follow-up date must use a valid YYYY-MM-DD value.");
	}
	if (input.reviewedFollowUpStatus !== undefined && input.reviewedFollowUpStatus !== "open") {
		errors.push("Only a reviewed open follow-up can be completed or dismissed.");
	}
	if (input.status !== "done" && input.status !== "dismissed") {
		errors.push("Follow-up status action must be done or dismissed.");
	}
	return errors;
}

export function normalizeContactMomentMutationInput(input: ContactMomentMutationInput): ContactMomentMutationInput {
	const normalized: ContactMomentMutationInput = {
		path: normalizeVaultPath(input.path),
		people: input.people.map((person) => ({
			id: person.id.trim(),
			filePath: normalizeVaultPath(person.filePath),
		})),
		occurredOn: input.occurredOn.trim(),
	};
	const contactMomentId = optionalString(input.contactMomentId);
	const relationship = normalizeRelationship(input.relationship);
	const channel = optionalString(input.channel);
	const summary = optionalString(input.summary);
	const followUpOn = optionalString(input.followUpOn);
	const followUpStatus = optionalString(input.followUpStatus) as ContactMomentFollowUpStatus | undefined;
	if (contactMomentId !== undefined) normalized.contactMomentId = contactMomentId;
	if (relationship !== undefined) normalized.relationship = relationship;
	if (channel !== undefined) normalized.channel = channel;
	if (summary !== undefined) normalized.summary = summary;
	if (followUpOn !== undefined) normalized.followUpOn = followUpOn;
	if (followUpStatus !== undefined) normalized.followUpStatus = followUpStatus;
	if (followUpOn !== undefined && followUpStatus === undefined) normalized.followUpStatus = "open";
	return normalized;
}

export function validateContactMomentMutationInput(
	input: ContactMomentMutationInput,
	settings: ContactMomentSettings,
): string[] {
	const errors: string[] = [];
	if (validateNotePath(input.path)) errors.push("A safe Markdown contact-moment path is required.");
	if (input.contactMomentId !== undefined && !input.contactMomentId.trim()) {
		errors.push("contact_moment_id cannot be empty when provided.");
	}
	if (input.people.length === 0) errors.push("At least one canonical person is required.");
	const personIds = new Set<string>();
	const personPaths = new Set<string>();
	for (const person of input.people) {
		if (!person.id.trim() || validateNotePath(person.filePath)) {
			errors.push("Every contact-moment person must be one canonical indexed person.");
			continue;
		}
		if (personIds.has(person.id) || personPaths.has(person.filePath)) {
			errors.push("Contact-moment people must be unique.");
		}
		personIds.add(person.id);
		personPaths.add(person.filePath);
	}
	if (!isFullCalendarDate(input.occurredOn)) {
		errors.push("Occurred-on date must use a valid YYYY-MM-DD value.");
	}
	if (input.followUpOn !== undefined && !isFullCalendarDate(input.followUpOn)) {
		errors.push("Follow-up date must use a valid YYYY-MM-DD value.");
	}
	if (
		input.followUpStatus !== undefined &&
		input.followUpStatus !== "open" &&
		input.followUpStatus !== "done" &&
		input.followUpStatus !== "dismissed"
	) {
		errors.push("Follow-up status must be open, done or dismissed.");
	}
	if (input.followUpStatus !== undefined && input.followUpOn === undefined) {
		errors.push("Follow-up status requires a valid follow-up date.");
	}
	if (input.relationship) {
		if (
			!input.relationship.id.trim() ||
			validateNotePath(input.relationship.filePath) ||
			!input.relationship.raw.trim()
		) {
			errors.push("The linked relationship must be one canonical note-backed relationship.");
		}
		if (input.relationship.personIds.length !== 2 || input.relationship.personIds.some((id) => !id.trim())) {
			errors.push("The linked relationship must expose both canonical endpoint identities.");
		}
		if (!input.relationship.personIds.some((personId) => personIds.has(personId))) {
			errors.push("The linked relationship must share at least one contact-moment person.");
		}
	}
	const typeValues = [
		settings.personTypeValue.trim().toLowerCase(),
		settings.relationshipTypeValue.trim().toLowerCase(),
		settings.contactMomentTypeValue.trim().toLowerCase(),
	];
	if (typeValues.some((value) => !value) || new Set(typeValues).size !== typeValues.length) {
		errors.push("Person, relationship and contact-moment type values must be non-empty and distinct.");
	}
	const properties = [
		settings.typeProperty,
		settings.contactMomentIdProperty,
		settings.contactMomentPeopleProperty,
		settings.contactMomentRelationshipProperty,
		settings.contactMomentOccurredOnProperty,
		settings.contactMomentChannelProperty,
		settings.contactMomentSummaryProperty,
		settings.contactMomentFollowUpOnProperty,
		settings.contactMomentFollowUpStatusProperty,
	].map((property) => property.trim());
	if (properties.some((property) => !property) || new Set(properties).size !== properties.length) {
		errors.push("Contact-moment type and owned property names must be non-empty and distinct.");
	}
	return [...new Set(errors)];
}

export function decideLastContactAdvance(
	currentLastContact: string | undefined,
	occurredOn: string,
): LastContactAdvanceDecision {
	if (!isFullCalendarDate(occurredOn)) {
		throw new Error("Occurred-on date must use a valid YYYY-MM-DD value.");
	}
	const current = optionalString(currentLastContact);
	if (current === undefined) return { status: "advance" };
	if (!isFullCalendarDate(current)) {
		throw new Error("The linked relationship has an invalid current last-contact date.");
	}
	if (current === occurredOn) {
		return { status: "unchanged", currentLastContact: current, reason: "equal" };
	}
	if (current > occurredOn) {
		return { status: "unchanged", currentLastContact: current, reason: "later" };
	}
	return { status: "advance", previousLastContact: current };
}

export function contactMomentWikilink(filePath: string): string {
	return `[[${normalizeVaultPath(filePath).replace(/\.md$/i, "")}]]`;
}

export function captureContactMomentEditSourceBaseline(
	frontmatter: Record<string, unknown>,
	settings: ContactMomentSettings,
): ContactMomentEditSourceBaseline {
	return Object.freeze({
		signature: contactMomentOwnedSourceSignature(frontmatter, settings),
	});
}

export function contactMomentEditSourceMatches(
	frontmatter: Record<string, unknown>,
	settings: ContactMomentSettings,
	baseline: ContactMomentEditSourceBaseline,
): boolean {
	return contactMomentOwnedSourceSignature(frontmatter, settings) === baseline.signature;
}

export function isFullCalendarDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return (
		date.getUTCFullYear() === Number(match[1]) &&
		date.getUTCMonth() + 1 === Number(match[2]) &&
		date.getUTCDate() === Number(match[3])
	);
}

export function shortContactMomentId(value: string): string {
	const compact = value.trim().replace(/[^a-z0-9]+/gi, "");
	return compact.slice(-8) || "moment";
}

function normalizeRelationship(
	relationship: ContactMomentRelationshipTarget | undefined,
): ContactMomentRelationshipTarget | undefined {
	if (!relationship) return undefined;
	return {
		kind: "canonical",
		id: relationship.id.trim(),
		filePath: normalizeVaultPath(relationship.filePath),
		personIds: relationship.personIds.map((personId) => personId.trim()).filter(Boolean),
		raw: relationship.raw.trim(),
	};
}

function normalizeVaultPath(value: string): string {
	return value.trim().replace(/\\/g, "/");
}

function contactMomentOwnedSourceSignature(
	frontmatter: Record<string, unknown>,
	settings: ContactMomentSettings,
): string {
	const properties = [
		settings.typeProperty,
		settings.contactMomentIdProperty,
		settings.contactMomentPeopleProperty,
		settings.contactMomentRelationshipProperty,
		settings.contactMomentOccurredOnProperty,
		settings.contactMomentChannelProperty,
		settings.contactMomentSummaryProperty,
		settings.contactMomentFollowUpOnProperty,
		settings.contactMomentFollowUpStatusProperty,
	];
	const owned = Object.fromEntries(properties.map((property) => [property, frontmatter[property]]));
	return JSON.stringify(stableSourceValue(owned));
}

function stableSourceValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((entry) => stableSourceValue(entry));
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, stableSourceValue(entry)]),
		);
	}
	return value;
}

function optionalString(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized || undefined;
}
