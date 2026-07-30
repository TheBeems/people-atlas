import { getAllTags, type App, type CachedMetadata, type TFile } from "obsidian";
import { resolvePersonId, resolveRelationshipId } from "../domain/identity";
import { parsePersonReference } from "../domain/wikilink";
import type {
	AtlasDiagnostic,
	PersonRecord,
	RelationshipDirection,
	RelationshipRecord,
	RelationshipStatus,
} from "../domain/types";
import type { PeopleAtlasSettings } from "../settings/types";

export interface ParsedAtlasFile {
	filePath: string;
	person?: PersonRecord;
	relationship?: RelationshipRecord;
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

function readIsoDate(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
	diagnostics: AtlasDiagnostic[],
): string | undefined {
	const raw = readString(frontmatter, property);
	if (!raw) return undefined;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
	const date = match ? new Date(`${raw}T00:00:00Z`) : undefined;
	const valid = Boolean(
		date &&
			date.getUTCFullYear() === Number(match?.[1]) &&
			date.getUTCMonth() + 1 === Number(match?.[2]) &&
			date.getUTCDate() === Number(match?.[3]),
	);
	if (!valid) {
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

function readDirection(
	frontmatter: Frontmatter,
	property: string,
	filePath: string,
): {
	direction: RelationshipDirection;
	diagnostic?: AtlasDiagnostic;
} {
	const raw = readString(frontmatter, property);
	if (!raw) return { direction: "undirected" };
	const normalized = raw.toLowerCase();
	if (normalized === "undirected" || normalized === "source-to-target") return { direction: normalized };
	return {
		direction: "undirected",
		diagnostic: {
			id: `invalid-direction:${filePath}`,
			severity: "error",
			code: "invalid-relationship-direction",
			message: `Relationship “${filePath}” has an invalid direction “${raw}”.`,
			filePaths: [filePath],
		},
	};
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
	const expectedTag = normalizeTag(settings.personTag);
	if (!expectedTag || !cache) return false;
	return getAllTags(cache)?.some((tag) => normalizeTag(tag) === expectedTag) ?? false;
}

function isRelationship(frontmatter: Frontmatter, settings: PeopleAtlasSettings): boolean {
	return readString(frontmatter, settings.typeProperty)?.toLowerCase() === settings.relationshipTypeValue.toLowerCase();
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

export function parseAtlasFile(
	app: App,
	file: TFile,
	cache: CachedMetadata | null,
	settings: PeopleAtlasSettings,
): ParsedAtlasFile {
	const frontmatter: Frontmatter = cache?.frontmatter ?? {};
	const diagnostics: AtlasDiagnostic[] = [];

	if (isPerson(cache, frontmatter, settings)) {
		const explicitId = readString(frontmatter, settings.personIdProperty);
		const contacts = readStringList(frontmatter, settings.contactsProperty)
			.map(parsePersonReference)
			.filter((value): value is NonNullable<typeof value> => value !== undefined);

		return {
			filePath: file.path,
			person: {
				id: resolvePersonId(explicitId, file.path),
				filePath: file.path,
				name: readString(frontmatter, settings.nameProperty) ?? file.basename,
				aliases: readStringList(frontmatter, settings.aliasesProperty),
				organisations: readStringList(frontmatter, settings.organisationsProperty),
				photoPath: resolvePhotoPath(app, readString(frontmatter, settings.photoProperty), file.path, diagnostics),
				contacts,
			},
			diagnostics,
		};
	}

	if (isRelationship(frontmatter, settings)) {
		const from = parsePersonReference(readString(frontmatter, settings.relationshipFromProperty) ?? "");
		const to = parsePersonReference(readString(frontmatter, settings.relationshipToProperty) ?? "");
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
		const direction = readDirection(frontmatter, settings.directionProperty, file.path);
		const status = readStatus(frontmatter, settings.statusProperty, file.path);
		const fromRole = readString(frontmatter, settings.relationshipFromRoleProperty);
		const toRole = readString(frontmatter, settings.relationshipToRoleProperty);
		if (direction.diagnostic) diagnostics.push(direction.diagnostic);
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
				id: resolveRelationshipId(readString(frontmatter, settings.relationshipIdProperty), file.path),
				filePath: file.path,
				from,
				to,
				presetId: readString(frontmatter, settings.relationshipPresetProperty),
				fromRole,
				toRole,
				direction: direction.direction,
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
