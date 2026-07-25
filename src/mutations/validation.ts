import type { RelationshipDirection, RelationshipStatus } from "../domain/types";
import type { PeopleAtlasSettings } from "../settings/types";

export interface PersonMutationInput {
	name: string;
	personId?: string;
	aliases?: string[];
	organisations?: string[];
	photo?: string;
	contacts?: string[];
}

export interface RelationshipMutationInput {
	path: string;
	relationshipId?: string;
	from: string;
	to: string;
	types?: string[];
	direction?: RelationshipDirection;
	closeness?: number;
	since?: string;
	lastContact?: string;
	status?: RelationshipStatus;
}

export interface PersonUpdates {
	name?: string | null;
	personId?: string | null;
	aliases?: string[] | null;
	organisations?: string[] | null;
	photo?: string | null;
	contacts?: string[] | null;
}

export interface RelationshipUpdates {
	relationshipId?: string | null;
	from?: string | null;
	to?: string | null;
	types?: string[] | null;
	direction?: RelationshipDirection | null;
	closeness?: number | null;
	since?: string | null;
	lastContact?: string | null;
	status?: RelationshipStatus | null;
}

export function validateFolderPath(value: string): string | undefined {
	const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	if (!normalized) return "A destination folder is required.";
	if (normalized.split("/").some((part) => part === "." || part === ".." || !part.trim())) return "The destination folder is invalid.";
	return undefined;
}

export function validateNotePath(value: string): string | undefined {
	const normalized = value.trim().replace(/\\/g, "/");
	if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => part === ".." || part === "." || !part.trim())) return "The note path is invalid.";
	if (!normalized.toLowerCase().endsWith(".md")) return "The note path must be a Markdown file.";
	return undefined;
}

export function sanitizeNoteName(value: string): string {
	return value.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").replace(/[-. ]+$/g, "");
}

export function validatePersonInput(input: PersonMutationInput, settings: PeopleAtlasSettings): string[] {
	const errors: string[] = [];
	if (!input.name.trim()) errors.push("A person name is required.");
	if (input.personId !== undefined && !input.personId.trim()) errors.push("person_id cannot be empty when provided.");
	if (settings.typeProperty === settings.personIdProperty || settings.typeProperty === settings.nameProperty || settings.personIdProperty === settings.nameProperty) {
		errors.push("Person type, ID and name properties must be distinct.");
	}
	return errors;
}

function validDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
}

export function validateRelationshipInput(input: RelationshipMutationInput, settings: PeopleAtlasSettings): string[] {
	const errors: string[] = [];
	if (validateNotePath(input.path)) errors.push("A safe Markdown relationship path is required.");
	if (!input.from.trim() || !input.to.trim()) errors.push("Both relationship endpoints are required.");
	if (input.relationshipId !== undefined && !input.relationshipId.trim()) errors.push("relationship_id cannot be empty when provided.");
	if (input.direction !== undefined && input.direction !== "undirected" && input.direction !== "source-to-target") errors.push("Relationship direction is invalid.");
	if (input.status !== undefined && input.status !== "active" && input.status !== "dormant" && input.status !== "ended") errors.push("Relationship status is invalid.");
	if (input.closeness !== undefined && (!Number.isFinite(input.closeness) || input.closeness < 1 || input.closeness > 5)) errors.push("Closeness must be between 1 and 5.");
	for (const date of [input.since, input.lastContact]) if (date !== undefined && !validDate(date)) errors.push("Relationship dates must use valid YYYY-MM-DD values.");
	const keys = [settings.typeProperty, settings.relationshipIdProperty, settings.relationshipFromProperty, settings.relationshipToProperty];
	if (new Set(keys).size !== keys.length) errors.push("Relationship identity and endpoint properties must be distinct.");
	return errors;
}

export function yamlValue(value: string | string[]): string {
	return JSON.stringify(value);
}
