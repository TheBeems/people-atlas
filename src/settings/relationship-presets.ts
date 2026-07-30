import type { RelationshipDirection } from "../domain/types";

export const DEFAULT_RELATIONSHIP_ROLE_FORMAT = "{role} of {person}";

export interface RelationshipPreset {
	id: string;
	name: string;
	types: string[];
	direction: RelationshipDirection;
	fromRole: string;
	toRole: string;
}

export interface RelationshipPresetValues {
	presetId?: string | undefined;
	types: string[];
	direction: RelationshipDirection;
	fromRole?: string | undefined;
	toRole?: string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedStrings(value: unknown): string[] | undefined {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return undefined;
	return value.map((entry) => entry.trim());
}

export function relationshipPresetSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function validateRelationshipRoleFormat(value: string): string | undefined {
	const format = value.trim();
	if (!format) return "Enter a relationship role format.";
	if ((format.match(/\{role\}/g) ?? []).length !== 1 || (format.match(/\{person\}/g) ?? []).length !== 1) {
		return "The relationship role format must contain {role} and {person} exactly once.";
	}
	return undefined;
}

export function formatRelationshipRole(format: string, role: string, person: string): string {
	return format.replace("{role}", role).replace("{person}", person);
}

export function validateRelationshipPreset(preset: RelationshipPreset, existingIds: Iterable<string> = []): string[] {
	const errors: string[] = [];
	if (!preset.id.trim()) errors.push("A preset ID is required.");
	else if (relationshipPresetSlug(preset.id) !== preset.id) {
		errors.push("The preset ID must be a lowercase slug containing only letters, numbers and hyphens.");
	}
	if ([...existingIds].some((id) => id === preset.id)) errors.push(`Preset ID “${preset.id}” is already in use.`);
	if (!preset.name.trim()) errors.push("A preset name is required.");
	if (preset.types.length === 0 || preset.types.some((type) => !type.trim())) {
		errors.push("At least one non-empty relationship type is required.");
	}
	if (new Set(preset.types.map((type) => type.trim().toLowerCase())).size !== preset.types.length) {
		errors.push("Relationship types in a preset must be unique.");
	}
	if (preset.direction !== "undirected" && preset.direction !== "source-to-target") {
		errors.push("Preset direction is invalid.");
	}
	if (!preset.fromRole.trim() || !preset.toRole.trim()) errors.push("Both endpoint roles are required.");
	return errors;
}

export function validateStoredRelationshipPresets(value: unknown): string | undefined {
	if (!Array.isArray(value)) return "relationshipPresets must be an array.";
	const ids = new Set<string>();
	for (const [index, raw] of value.entries()) {
		if (!isRecord(raw)) return `relationshipPresets[${index}] must be an object.`;
		const types = normalizedStrings(raw.types);
		const preset: RelationshipPreset = {
			id: typeof raw.id === "string" ? raw.id.trim() : "",
			name: typeof raw.name === "string" ? raw.name.trim() : "",
			types: types ?? [],
			direction:
				raw.direction === "source-to-target" || raw.direction === "undirected"
					? raw.direction
					: (raw.direction as never),
			fromRole: typeof raw.fromRole === "string" ? raw.fromRole.trim() : "",
			toRole: typeof raw.toRole === "string" ? raw.toRole.trim() : "",
		};
		const errors = validateRelationshipPreset(preset, ids);
		if (types === undefined) errors.unshift("Preset types must be an array of strings.");
		if (errors.length > 0) return `relationshipPresets[${index}] is invalid: ${errors.join(" ")}`;
		ids.add(preset.id);
	}
	return undefined;
}

export function normalizeRelationshipPresets(value: unknown): RelationshipPreset[] {
	if (validateStoredRelationshipPresets(value)) return [];
	return (value as RelationshipPreset[]).map((preset) => ({
		id: preset.id.trim(),
		name: preset.name.trim(),
		types: preset.types.map((type) => type.trim()),
		direction: preset.direction,
		fromRole: preset.fromRole.trim(),
		toRole: preset.toRole.trim(),
	}));
}

export function relationshipPresetMatches(values: RelationshipPresetValues, preset: RelationshipPreset): boolean {
	return (
		values.presetId === preset.id &&
		values.direction === preset.direction &&
		values.fromRole === preset.fromRole &&
		values.toRole === preset.toRole &&
		values.types.length === preset.types.length &&
		values.types.every((type, index) => type === preset.types[index])
	);
}
