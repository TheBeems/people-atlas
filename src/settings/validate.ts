import { validatePeopleRootFolder } from "../domain/people-root";
import { DEFAULT_SETTINGS } from "./defaults";
import {
	normalizeRelationshipPresets,
	validateRelationshipRoleFormat,
	validateStoredRelationshipPresets,
} from "./relationship-presets";
import { normalizeViewStates } from "./view-state";
import type { PeopleAtlasSettings } from "./types";

export { validatePeopleRootFolder };

const STRING_KEYS: Array<keyof PeopleAtlasSettings> = [
	"peopleRootFolder",
	"typeProperty",
	"personTypeValue",
	"relationshipTypeValue",
	"contactMomentTypeValue",
	"personTag",
	"personIdProperty",
	"nameProperty",
	"aliasesProperty",
	"organisationsProperty",
	"photoProperty",
	"contactsProperty",
	"birthDateProperty",
	"pronounsProperty",
	"genderProperty",
	"emailsProperty",
	"phonesProperty",
	"jobTitleProperty",
	"relationshipIdProperty",
	"relationshipFromProperty",
	"relationshipToProperty",
	"relationshipTypesProperty",
	"relationshipPresetProperty",
	"relationshipFromRoleProperty",
	"relationshipToRoleProperty",
	"closenessProperty",
	"sinceProperty",
	"lastContactProperty",
	"statusProperty",
	"contactMomentIdProperty",
	"contactMomentPeopleProperty",
	"contactMomentRelationshipProperty",
	"contactMomentOccurredOnProperty",
	"contactMomentChannelProperty",
	"contactMomentSummaryProperty",
	"contactMomentFollowUpOnProperty",
	"contactMomentFollowUpStatusProperty",
	"myPersonId",
	"defaultCenterPersonId",
	"relationshipRoleFormat",
];

export const PERSON_OWNED_PROPERTY_SETTING_KEYS = [
	"typeProperty",
	"personIdProperty",
	"nameProperty",
	"aliasesProperty",
	"organisationsProperty",
	"photoProperty",
	"contactsProperty",
	"birthDateProperty",
	"pronounsProperty",
	"genderProperty",
	"emailsProperty",
	"phonesProperty",
	"jobTitleProperty",
] as const satisfies ReadonlyArray<keyof PeopleAtlasSettings>;

export const CONTACT_MOMENT_OWNED_PROPERTY_SETTING_KEYS = [
	"typeProperty",
	"contactMomentIdProperty",
	"contactMomentPeopleProperty",
	"contactMomentRelationshipProperty",
	"contactMomentOccurredOnProperty",
	"contactMomentChannelProperty",
	"contactMomentSummaryProperty",
	"contactMomentFollowUpOnProperty",
	"contactMomentFollowUpStatusProperty",
] as const satisfies ReadonlyArray<keyof PeopleAtlasSettings>;

export const NOTE_TYPE_VALUE_SETTING_KEYS = [
	"personTypeValue",
	"relationshipTypeValue",
	"contactMomentTypeValue",
] as const satisfies ReadonlyArray<keyof PeopleAtlasSettings>;

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
	if (source.viewStates !== undefined) result.viewStates = normalizeViewStates(source.viewStates);
	if (source.relationshipPresets !== undefined && !validateStoredRelationshipPresets(source.relationshipPresets)) {
		result.relationshipPresets = normalizeRelationshipPresets(source.relationshipPresets);
	}

	return result;
}

export function validatePropertyName(value: string): string | undefined {
	if (!value.trim()) return "Enter a property name.";
	if (/\s/.test(value)) return "Property names cannot contain whitespace.";
	return undefined;
}

export function validatePersonPropertyMappings(settings: PeopleAtlasSettings): string | undefined {
	const owners = new Map<string, (typeof PERSON_OWNED_PROPERTY_SETTING_KEYS)[number]>();
	for (const key of PERSON_OWNED_PROPERTY_SETTING_KEYS) {
		const value = settings[key];
		const propertyError = validatePropertyName(value);
		if (propertyError) return `${key} is invalid: ${propertyError}`;
		const existing = owners.get(value);
		if (existing) {
			return `Person-owned properties must be distinct: ${existing} and ${key} both use “${value}”.`;
		}
		owners.set(value, key);
	}
	return undefined;
}

export function validateContactMomentPropertyMappings(settings: PeopleAtlasSettings): string | undefined {
	const owners = new Map<string, (typeof CONTACT_MOMENT_OWNED_PROPERTY_SETTING_KEYS)[number]>();
	for (const key of CONTACT_MOMENT_OWNED_PROPERTY_SETTING_KEYS) {
		const value = settings[key];
		const propertyError = validatePropertyName(value);
		if (propertyError) return `${key} is invalid: ${propertyError}`;
		const existing = owners.get(value);
		if (existing) {
			return `Contact-moment properties must be distinct: ${existing} and ${key} both use “${value}”.`;
		}
		owners.set(value, key);
	}
	return undefined;
}

export function validateNoteTypeValues(settings: PeopleAtlasSettings): string | undefined {
	const owners = new Map<string, (typeof NOTE_TYPE_VALUE_SETTING_KEYS)[number]>();
	for (const key of NOTE_TYPE_VALUE_SETTING_KEYS) {
		const value = settings[key].trim();
		if (!value) return `${key} is invalid: Enter a type value.`;
		const normalized = value.toLowerCase();
		const existing = owners.get(normalized);
		if (existing) {
			return `Person, relationship and contact-moment type values must be distinct: ${existing} and ${key} both use “${value}”.`;
		}
		owners.set(normalized, key);
	}
	return undefined;
}

export function validateRelationshipRoleFormatSetting(value: string): string | undefined {
	return validateRelationshipRoleFormat(value);
}
