import { PLUGIN_DATA_SCHEMA_VERSION } from "../constants";
import { DEFAULT_SETTINGS } from "./defaults";
import { validateStoredRelationshipPresets } from "./relationship-presets";
import {
	validateContactMomentPropertyMappings,
	validateNoteTypeValues,
	validatePeopleRootFolder,
	validatePersonPropertyMappings,
	validateRelationshipRoleFormatSetting,
	validateSettings,
} from "./validate";
import type { PeopleAtlasSettings } from "./types";
import { validateStoredViewStates } from "./view-state";

export interface PluginSettingsLoadResult {
	settings: PeopleAtlasSettings;
	writeEnabled: boolean;
	error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStoredShape(value: Record<string, unknown>): string | undefined {
	for (const [key, raw] of Object.entries(value)) {
		if (key === "schemaVersion") {
			if (raw !== PLUGIN_DATA_SCHEMA_VERSION) {
				return `schemaVersion must be ${PLUGIN_DATA_SCHEMA_VERSION}.`;
			}
			continue;
		}
		if (key === "enableBases" || key === "showLabels" || key === "showDiagnostics") {
			if (typeof raw !== "boolean") return `${key} must be a boolean.`;
			continue;
		}
		if (key === "viewStates") {
			const viewStateError = validateStoredViewStates(raw);
			if (viewStateError) return viewStateError;
			continue;
		}
		if (key === "relationshipPresets") {
			const presetError = validateStoredRelationshipPresets(raw);
			if (presetError) return presetError;
			continue;
		}
		if (
			key in DEFAULT_SETTINGS &&
			typeof DEFAULT_SETTINGS[key as keyof PeopleAtlasSettings] === "string" &&
			typeof raw !== "string"
		) {
			return `${key} must be a string.`;
		}
	}
	return undefined;
}

export function loadPluginSettings(raw: unknown): PluginSettingsLoadResult {
	if (raw === null || raw === undefined) {
		return { settings: structuredClone(DEFAULT_SETTINGS), writeEnabled: true };
	}
	if (!isRecord(raw)) {
		return {
			settings: structuredClone(DEFAULT_SETTINGS),
			writeEnabled: false,
			error: "People Atlas settings are not an object.",
		};
	}
	if (raw.schemaVersion !== PLUGIN_DATA_SCHEMA_VERSION) {
		return {
			settings: structuredClone(DEFAULT_SETTINGS),
			writeEnabled: false,
			error: `People Atlas settings use unsupported schema version ${String(raw.schemaVersion)}; recreate the test vault or delete the plugin data file.`,
		};
	}
	const shapeError = validateStoredShape(raw);
	if (shapeError) {
		return {
			settings: structuredClone(DEFAULT_SETTINGS),
			writeEnabled: false,
			error: `People Atlas settings are invalid: ${shapeError}`,
		};
	}
	try {
		const rawPeopleRootFolderError =
			typeof raw.peopleRootFolder === "string" ? validatePeopleRootFolder(raw.peopleRootFolder) : undefined;
		if (rawPeopleRootFolderError) throw new Error(`peopleRootFolder is invalid: ${rawPeopleRootFolderError}`);
		const settings = validateSettings(raw);
		const peopleRootFolderError = validatePeopleRootFolder(settings.peopleRootFolder);
		if (peopleRootFolderError) throw new Error(`peopleRootFolder is invalid: ${peopleRootFolderError}`);
		const personPropertyError = validatePersonPropertyMappings(settings);
		if (personPropertyError) throw new Error(personPropertyError);
		const contactMomentPropertyError = validateContactMomentPropertyMappings(settings);
		if (contactMomentPropertyError) throw new Error(contactMomentPropertyError);
		const noteTypeValueError = validateNoteTypeValues(settings);
		if (noteTypeValueError) throw new Error(noteTypeValueError);
		const roleFormatError = validateRelationshipRoleFormatSetting(settings.relationshipRoleFormat);
		if (roleFormatError) throw new Error(roleFormatError);
		return { settings, writeEnabled: true };
	} catch (error) {
		return {
			settings: structuredClone(DEFAULT_SETTINGS),
			writeEnabled: false,
			error: `People Atlas settings validation failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
