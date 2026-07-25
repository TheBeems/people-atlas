import { DEFAULT_SETTINGS } from "./defaults";
import type { PeopleAtlasSettings } from "./types";

const STRING_KEYS: Array<keyof PeopleAtlasSettings> = [
	"peopleFolder",
	"typeProperty",
	"personTypeValue",
	"relationshipTypeValue",
	"personTag",
	"personIdProperty",
	"nameProperty",
	"aliasesProperty",
	"organisationsProperty",
	"photoProperty",
	"contactsProperty",
	"relationshipIdProperty",
	"relationshipFromProperty",
	"relationshipToProperty",
	"relationshipTypesProperty",
	"directionProperty",
	"closenessProperty",
	"sinceProperty",
	"lastContactProperty",
	"statusProperty",
	"defaultCenterPersonId",
];

export function validateSettings(raw: unknown): PeopleAtlasSettings {
	const result: PeopleAtlasSettings = structuredClone(DEFAULT_SETTINGS);
	if (!raw || typeof raw !== "object") return result;

	const source = raw as Partial<Record<keyof PeopleAtlasSettings, unknown>>;
	for (const key of STRING_KEYS) {
		const value = source[key];
		if (typeof value === "string") {
			(result as unknown as Record<string, unknown>)[key] = value.trim();
		}
	}

	for (const key of ["enableBases", "showLabels", "showDiagnostics"] as const) {
		if (typeof source[key] === "boolean") result[key] = source[key];
	}

	return result;
}

export function validatePropertyName(value: string): string | undefined {
	if (!value.trim()) return "Enter a property name.";
	if (/\s/.test(value)) return "Property names cannot contain whitespace.";
	return undefined;
}

export function validatePeopleFolder(value: string): string | undefined {
	const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	if (!normalized) return "Enter a People folder.";
	if (normalized.split("/").some((part) => part === ".." || part === ".")) return "The People folder must stay inside the vault.";
	return undefined;
}
