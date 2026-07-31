import { getAllTags, type App, type CachedMetadata, type TFile } from "obsidian";
import { parsePersonBirthDate, validatePersonEmails, validatePersonPhones } from "../domain/person-profile";
import { parsePersonReference, referenceKey } from "../domain/wikilink";
import type {
	AtlasDiagnostic,
	ContactMomentFollowUpStatus,
	ContactMomentRecord,
	PersonRecord,
	PersonReference,
	RelationshipRecord,
	RelationshipReference,
	RelationshipStatus,
} from "../domain/types";
import type { PeopleAtlasSettings } from "../settings/types";

export interface ParsedAtlasFile {
	filePath: string;
	person?: PersonRecord;
	relationship?: RelationshipRecord;
	contactMoment?: ContactMomentRecord;
	diagnostics: AtlasDiagnostic[];
}

type Frontmatter = Record<string, unknown>;

function readString(frontmatter: Frontmatter, property: string): string | undefined {
	const value = frontmatter[property];
	if (value === null || value === undefined) return undefined;
	const result = String(value).trim();
	return result.length > 0 ? result : undefined;
}

function readStringList(frontmatter: Frontmatter, property: string): string[] {
	const value = frontmatter[property];
	if (Array.isArray(value)) {
		return value
			.map(String)
			.map((entry) => entry.trim())
			.filter(Boolean);
	}
	const single = readString(frontmatter, property);
	return single ? [single] : [];
}

function readNumber(frontmatter: Frontmatter, property: string): number | undefined {
	const value = frontmatter[property];
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

function isFullIsoCalendarDate(raw: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
	const date = match ? new Date(`${raw}T00:00:00Z`) : undefined;
	return Boolean(
		date &&
			date.getUTCFullYear() === Number(match?.[1]) &&
			date.getUTCMonth() + 1 === Number(match?.[2]) &&
			date.getUTCDate() === Number(match?.[3]),
	);
}

function readIsoDate(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	diagnostics: AtlasDiagnostic[],
): string | undefined {
	const raw = readString(frontmatter, property);
	if (!raw) return undefined;
	if (!isFullIsoCalendarDate(raw)) {
		diagnostics.push({
			id: `invalid-date:${filePath}:${property}`,
			severity: "error",
			code: "invalid-relationship-date",
			message: `Relationship “${filePath}” has an invalid ${property} date “${raw}”; expected YYYY-MM-DD.`,
			filePaths: [filePath],
		});
		return undefined;
	}
	return raw;
}

function readStatus(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
): {
	status: RelationshipStatus | undefined;
	diagnostic?: AtlasDiagnostic;
} {
	const raw = readString(frontmatter, property);
	if (!raw) return { status: undefined };
	const normalized = raw.toLowerCase();
	if (normalized === "active" || normalized === "dormant" || normalized === "ended") return { status: normalized };
	return {
		status: undefined,
		diagnostic: {
			id: `invalid-status:${filePath}`,
			severity: "error",
			code: "invalid-relationship-status",
			message: `Relationship “${filePath}” has an invalid status “${raw}”.`,
			filePaths: [filePath],
		},
	};
}

function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}

function isPerson(cache: CachedMetadata | null, frontmatter: Frontmatter, settings: PeopleAtlasSettings): boolean {
	const typeValue = readString(frontmatter, settings.typeProperty)?.toLowerCase();
	if (typeValue === settings.personTypeValue.toLowerCase()) return true;
	if (typeValue !== undefined) return false;
	const expectedTag = normalizeTag(settings.personTag);
	if (!expectedTag || !cache) return false;
	return getAllTags(cache)?.some((tag) => normalizeTag(tag) === expectedTag) ?? false;
}

function isRelationship(frontmatter: Frontmatter, settings: PeopleAtlasSettings): boolean {
	return readString(frontmatter, settings.typeProperty)?.toLowerCase() === settings.relationshipTypeValue.toLowerCase();
}

function isContactMoment(frontmatter: Frontmatter, settings: PeopleAtlasSettings): boolean {
	return (
		readString(frontmatter, settings.typeProperty)?.toLowerCase() === settings.contactMomentTypeValue.toLowerCase()
	);
}

function resolveReference(app: App, raw: string, sourcePath: string): PersonReference | undefined {
	const reference = parsePersonReference(raw);
	if (!reference) return undefined;
	const resolved = app.metadataCache.getFirstLinkpathDest(reference.target, sourcePath);
	return resolved ? { ...reference, resolvedPath: resolved.path } : reference;
}

function readContactMomentPeople(
	app: App,
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	diagnostics: AtlasDiagnostic[],
): { people: PersonReference[]; valid: boolean } {
	const raw = frontmatter[property];
	const people: PersonReference[] = [];
	let valid = true;
	if (!Array.isArray(raw)) {
		diagnostics.push({
			id: `invalid-contact-moment-people:${filePath}:${property}`,
			severity: "error",
			code: "invalid-contact-moment-people",
			message: `Contact moment “${filePath}” must define ${property} as a non-empty list of person references.`,
			filePaths: [filePath],
		});
		return { people, valid: false };
	}
	if (raw.length === 0) {
		diagnostics.push({
			id: `invalid-contact-moment-people:${filePath}:${property}:empty`,
			severity: "error",
			code: "invalid-contact-moment-people",
			message: `Contact moment “${filePath}” must reference at least one person.`,
			filePaths: [filePath],
		});
		valid = false;
	}
	const seen = new Set<string>();
	for (const [index, value] of raw.entries()) {
		if (typeof value !== "string") {
			diagnostics.push({
				id: `invalid-contact-moment-people:${filePath}:${property}:${index}`,
				severity: "error",
				code: "invalid-contact-moment-people",
				message: `Contact moment “${filePath}” has a non-text ${property} entry at position ${index + 1}.`,
				filePaths: [filePath],
			});
			valid = false;
			continue;
		}
		const reference = resolveReference(app, value, filePath);
		if (!reference) {
			diagnostics.push({
				id: `invalid-contact-moment-people:${filePath}:${property}:${index}`,
				severity: "error",
				code: "invalid-contact-moment-people",
				message: `Contact moment “${filePath}” has an empty person reference at position ${index + 1}.`,
				filePaths: [filePath],
			});
			valid = false;
			continue;
		}
		people.push(reference);
		const key = referenceKey(reference);
		if (seen.has(key)) {
			diagnostics.push({
				id: `duplicate-contact-moment-person:${filePath}:${key}`,
				severity: "error",
				code: "duplicate-contact-moment-person",
				message: `Contact moment “${filePath}” references person “${reference.target}” more than once.`,
				filePaths: [filePath],
				targetPath: reference.resolvedPath ?? reference.target,
			});
			valid = false;
		} else {
			seen.add(key);
		}
	}
	if (people.length === 0 && raw.length > 0) valid = false;
	return { people, valid };
}

function readContactMomentRelationship(
	app: App,
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	diagnostics: AtlasDiagnostic[],
): { relationship?: RelationshipReference | undefined; valid: boolean } {
	const raw = frontmatter[property];
	if (raw === null || raw === undefined) return { valid: true };
	if (typeof raw !== "string") {
		diagnostics.push({
			id: `unresolved-contact-moment-relationship:${filePath}:${property}`,
			severity: "error",
			code: "unresolved-contact-moment-relationship",
			message: `Contact moment “${filePath}” has a non-text relationship reference.`,
			filePaths: [filePath],
		});
		return { valid: false };
	}
	const relationship = resolveReference(app, raw, filePath);
	if (!relationship) {
		diagnostics.push({
			id: `unresolved-contact-moment-relationship:${filePath}:${property}`,
			severity: "error",
			code: "unresolved-contact-moment-relationship",
			message: `Contact moment “${filePath}” has an empty relationship reference.`,
			filePaths: [filePath],
		});
		return { valid: false };
	}
	return { relationship, valid: true };
}

function readContactMomentDate(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	code: "invalid-contact-moment-occurred-on" | "invalid-contact-moment-follow-up-date",
	required: boolean,
	diagnostics: AtlasDiagnostic[],
): { value?: string | undefined; valid: boolean } {
	const raw = readString(frontmatter, property);
	if (!raw) {
		if (!required) return { valid: true };
		diagnostics.push({
			id: `${code}:${filePath}:${property}`,
			severity: "error",
			code,
			message: `Contact moment “${filePath}” must define ${property} as a full YYYY-MM-DD date.`,
			filePaths: [filePath],
		});
		return { value: "", valid: false };
	}
	if (isFullIsoCalendarDate(raw)) return { value: raw, valid: true };
	diagnostics.push({
		id: `${code}:${filePath}:${property}`,
		severity: "error",
		code,
		message: `Contact moment “${filePath}” has an invalid ${property} date “${raw}”; expected YYYY-MM-DD.`,
		filePaths: [filePath],
	});
	return { value: raw, valid: false };
}

function readContactMomentFollowUpStatus(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	hasFollowUpDate: boolean,
	diagnostics: AtlasDiagnostic[],
): { status?: ContactMomentFollowUpStatus | undefined; valid: boolean } {
	const raw = readString(frontmatter, property);
	if (!raw) return { valid: true };
	const normalized = raw.toLowerCase();
	if (normalized !== "open" && normalized !== "done" && normalized !== "dismissed") {
		diagnostics.push({
			id: `invalid-contact-moment-follow-up-status:${filePath}:${property}`,
			severity: "error",
			code: "invalid-contact-moment-follow-up-status",
			message: `Contact moment “${filePath}” has an invalid follow-up status “${raw}”.`,
			filePaths: [filePath],
		});
		return { valid: false };
	}
	if (!hasFollowUpDate) {
		diagnostics.push({
			id: `invalid-contact-moment-follow-up-status:${filePath}:${property}:without-date`,
			severity: "error",
			code: "invalid-contact-moment-follow-up-status",
			message: `Contact moment “${filePath}” has follow-up status “${normalized}” without a follow-up date.`,
			filePaths: [filePath],
		});
		return { status: normalized, valid: false };
	}
	return { status: normalized, valid: true };
}

function resolvePhotoPath(
	app: App,
	raw: string | undefined,
	sourcePath: string,
	diagnostics: AtlasDiagnostic[],
): string | undefined {
	if (!raw) return undefined;
	const reference = parsePersonReference(raw);
	const target = reference?.target ?? raw;
	const resolved = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	if (!resolved) {
		diagnostics.push({
			id: `missing-asset:${sourcePath}:${target}`,
			severity: "warning",
			code: "missing-asset",
			message: `The photo asset “${target}” referenced by “${sourcePath}” could not be found.`,
			filePaths: [sourcePath],
			targetPath: target,
		});
	}
	return resolved?.path ?? target;
}

function readPersonBirthDate(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	diagnostics: AtlasDiagnostic[],
): string | undefined {
	const raw = frontmatter[property];
	if (raw === null || raw === undefined || raw === "") return undefined;
	const parsed = parsePersonBirthDate(raw);
	if (parsed.valid) return parsed.value;
	diagnostics.push({
		id: `invalid-person-birth-date:${filePath}:${property}`,
		severity: "error",
		code: "invalid-person-birth-date",
		message: `Person “${filePath}” has an invalid ${property} value “${String(raw)}”. ${parsed.error}`,
		filePaths: [filePath],
	});
	return undefined;
}

function readPersonEmails(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	diagnostics: AtlasDiagnostic[],
): string[] {
	const typed = readTypedPersonList(frontmatter, property);
	for (const issue of typed.issues) {
		const location = issue.index === undefined ? "list" : issue.index;
		diagnostics.push({
			id: `invalid-person-email:${filePath}:${property}:${location}`,
			severity: "error",
			code: "invalid-person-email",
			message: `Person “${filePath}” has an invalid ${property} value: ${issue.message}`,
			filePaths: [filePath],
		});
	}
	const validated = validatePersonEmails(typed.entries.map((entry) => entry.value));
	for (const issue of validated.issues) {
		const originalIndex = typed.entries[issue.index]?.index ?? issue.index;
		diagnostics.push({
			id: `invalid-person-email:${filePath}:${property}:${originalIndex}`,
			severity: "error",
			code: "invalid-person-email",
			message: `Person “${filePath}” has an invalid ${property} entry ${originalIndex + 1}: ${issue.message}`,
			filePaths: [filePath],
		});
	}
	return validated.values;
}

function readPersonPhones(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	diagnostics: AtlasDiagnostic[],
): string[] {
	const typed = readTypedPersonList(frontmatter, property);
	for (const issue of typed.issues) {
		const location = issue.index === undefined ? "list" : issue.index;
		diagnostics.push({
			id: `invalid-person-phone:${filePath}:${property}:${location}`,
			severity: "error",
			code: "invalid-person-phone",
			message: `Person “${filePath}” has an invalid ${property} value: ${issue.message}`,
			filePaths: [filePath],
		});
	}
	const validated = validatePersonPhones(typed.entries.map((entry) => entry.value));
	for (const issue of validated.issues) {
		const originalIndex = typed.entries[issue.index]?.index ?? issue.index;
		diagnostics.push({
			id: `invalid-person-phone:${filePath}:${property}:${originalIndex}`,
			severity: "error",
			code: "invalid-person-phone",
			message: `Person “${filePath}” has an invalid ${property} entry ${originalIndex + 1}: ${issue.message}`,
			filePaths: [filePath],
		});
	}
	return validated.values;
}

function readTypedPersonList(
	frontmatter: Frontmatter,
	property: string,
): {
	entries: Array<{ index: number; value: string }>;
	issues: Array<{ index?: number | undefined; message: string }>;
} {
	const raw = frontmatter[property];
	if (raw === null || raw === undefined) return { entries: [], issues: [] };
	if (!Array.isArray(raw)) {
		return { entries: [], issues: [{ message: `${property} must be a list of strings.` }] };
	}
	const entries: Array<{ index: number; value: string }> = [];
	const issues: Array<{ index?: number | undefined; message: string }> = [];
	for (const [index, value] of raw.entries()) {
		if (typeof value !== "string") {
			issues.push({ index, message: `${property} entry ${index + 1} must be text.` });
			continue;
		}
		entries.push({ index, value });
	}
	return { entries, issues };
}

export function parseAtlasFile(
	app: App,
	file: TFile,
	cache: CachedMetadata | null,
	settings: PeopleAtlasSettings,
): ParsedAtlasFile {
	const frontmatter: Frontmatter = cache?.frontmatter ?? {};
	const diagnostics: AtlasDiagnostic[] = [];

	if (isContactMoment(frontmatter, settings)) {
		const id = readRequiredId(
			frontmatter,
			settings.contactMomentIdProperty,
			file.path,
			"contact moment",
			"missing-contact-moment-id",
			diagnostics,
		);
		if (!id) return { filePath: file.path, diagnostics };
		const people = readContactMomentPeople(
			app,
			frontmatter,
			settings.contactMomentPeopleProperty,
			file.path,
			diagnostics,
		);
		const relationship = readContactMomentRelationship(
			app,
			frontmatter,
			settings.contactMomentRelationshipProperty,
			file.path,
			diagnostics,
		);
		const occurredOn = readContactMomentDate(
			frontmatter,
			settings.contactMomentOccurredOnProperty,
			file.path,
			"invalid-contact-moment-occurred-on",
			true,
			diagnostics,
		);
		const followUpOn = readContactMomentDate(
			frontmatter,
			settings.contactMomentFollowUpOnProperty,
			file.path,
			"invalid-contact-moment-follow-up-date",
			false,
			diagnostics,
		);
		const followUpStatus = readContactMomentFollowUpStatus(
			frontmatter,
			settings.contactMomentFollowUpStatusProperty,
			file.path,
			followUpOn.value !== undefined,
			diagnostics,
		);
		const actionable = people.valid && relationship.valid && occurredOn.valid;
		return {
			filePath: file.path,
			contactMoment: {
				id,
				filePath: file.path,
				people: people.people,
				relationship: relationship.relationship,
				occurredOn: occurredOn.value ?? "",
				channel: readString(frontmatter, settings.contactMomentChannelProperty),
				summary: readString(frontmatter, settings.contactMomentSummaryProperty),
				followUpOn: followUpOn.value,
				followUpStatus: followUpStatus.status,
				personIds: [],
				relationshipId: undefined,
				actionable,
				followUpActionable:
					actionable &&
					followUpOn.valid &&
					followUpOn.value !== undefined &&
					followUpStatus.valid &&
					(followUpStatus.status === undefined || followUpStatus.status === "open"),
			},
			diagnostics,
		};
	}

	if (isPerson(cache, frontmatter, settings)) {
		const id = readRequiredId(
			frontmatter,
			settings.personIdProperty,
			file.path,
			"person",
			"missing-person-id",
			diagnostics,
		);
		if (!id) return { filePath: file.path, diagnostics };
		const contacts = readStringList(frontmatter, settings.contactsProperty)
			.map(parsePersonReference)
			.filter((value): value is NonNullable<typeof value> => value !== undefined);

		return {
			filePath: file.path,
			person: {
				id,
				filePath: file.path,
				name: readString(frontmatter, settings.nameProperty) ?? file.basename,
				aliases: readStringList(frontmatter, settings.aliasesProperty),
				organisations: readStringList(frontmatter, settings.organisationsProperty),
				photoPath: resolvePhotoPath(app, readString(frontmatter, settings.photoProperty), file.path, diagnostics),
				birthDate: readPersonBirthDate(frontmatter, settings.birthDateProperty, file.path, diagnostics),
				pronouns: readString(frontmatter, settings.pronounsProperty),
				gender: readString(frontmatter, settings.genderProperty),
				emails: readPersonEmails(frontmatter, settings.emailsProperty, file.path, diagnostics),
				phones: readPersonPhones(frontmatter, settings.phonesProperty, file.path, diagnostics),
				jobTitle: readString(frontmatter, settings.jobTitleProperty),
				contacts,
			},
			diagnostics,
		};
	}

	if (isRelationship(frontmatter, settings)) {
		const id = readRequiredId(
			frontmatter,
			settings.relationshipIdProperty,
			file.path,
			"relationship",
			"missing-relationship-id",
			diagnostics,
		);
		if (!id) return { filePath: file.path, diagnostics };
		const from = resolveReference(app, readString(frontmatter, settings.relationshipFromProperty) ?? "", file.path);
		const to = resolveReference(app, readString(frontmatter, settings.relationshipToProperty) ?? "", file.path);
		if (!from || !to) {
			diagnostics.push({
				id: `relationship-endpoint:${file.path}`,
				severity: "error",
				code: "unresolved-relationship-endpoint",
				message: `Relationship “${file.path}” is missing a valid endpoint.`,
				filePaths: [file.path],
			});
			return { filePath: file.path, diagnostics };
		}
		const rawCloseness = readNumber(frontmatter, settings.closenessProperty);
		const status = readStatus(frontmatter, settings.statusProperty, file.path);
		const fromRole = readString(frontmatter, settings.relationshipFromRoleProperty);
		const toRole = readString(frontmatter, settings.relationshipToRoleProperty);
		if (status.diagnostic) diagnostics.push(status.diagnostic);
		if (Boolean(fromRole) !== Boolean(toRole)) {
			diagnostics.push({
				id: `incomplete-relationship-roles:${file.path}`,
				severity: "warning",
				code: "incomplete-relationship-roles",
				message: `Relationship “${file.path}” must define both endpoint roles or neither.`,
				filePaths: [file.path],
			});
		}

		return {
			filePath: file.path,
			relationship: {
				id,
				filePath: file.path,
				from,
				to,
				presetId: readString(frontmatter, settings.relationshipPresetProperty),
				fromRole,
				toRole,
				types: readStringList(frontmatter, settings.relationshipTypesProperty),
				closeness: rawCloseness === undefined ? undefined : Math.min(5, Math.max(1, rawCloseness)),
				since: readIsoDate(frontmatter, settings.sinceProperty, file.path, diagnostics),
				lastContact: readIsoDate(frontmatter, settings.lastContactProperty, file.path, diagnostics),
				status: status.status,
			},
			diagnostics,
		};
	}

	return { filePath: file.path, diagnostics };
}

function readRequiredId(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	label: "person" | "relationship" | "contact moment",
	code: "missing-person-id" | "missing-relationship-id" | "missing-contact-moment-id",
	diagnostics: AtlasDiagnostic[],
): string | undefined {
	const id = readString(frontmatter, property);
	if (id) return id;
	diagnostics.push({
		id: `${code}:${filePath}:${property}`,
		severity: "error",
		code,
		message: `${label[0]?.toUpperCase()}${label.slice(1)} “${filePath}” must define a non-empty ${property}.`,
		filePaths: [filePath],
	});
	return undefined;
}
