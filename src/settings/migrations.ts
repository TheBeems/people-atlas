import { PLUGIN_DATA_SCHEMA_VERSION } from "../constants";
import { DEFAULT_SETTINGS } from "./defaults";
import { validatePeopleFolder, validateSettings } from "./validate";
import type { PeopleAtlasSettings } from "./types";

export interface PluginSettingsLoadResult {
	settings: PeopleAtlasSettings;
	writeEnabled: boolean;
	migrated: boolean;
	error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStoredShape(value: Record<string, unknown>): string | undefined {
	for (const [key, raw] of Object.entries(value)) {
		if (key === "schemaVersion") {
			if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) return "schemaVersion must be a positive integer.";
			continue;
		}
		if (key === "enableBases" || key === "showLabels" || key === "showDiagnostics") {
			if (typeof raw !== "boolean") return `${key} must be a boolean.`;
			continue;
		}
		if (key in DEFAULT_SETTINGS && typeof DEFAULT_SETTINGS[key as keyof PeopleAtlasSettings] === "string" && typeof raw !== "string") {
			return `${key} must be a string.`;
		}
	}
	return undefined;
}

function migrateV1ToV2(value: Record<string, unknown>): Record<string, unknown> {
	return {
		...value,
		peopleFolder: typeof value.peopleFolder === "string" && value.peopleFolder.trim() ? value.peopleFolder : DEFAULT_SETTINGS.peopleFolder,
		schemaVersion: 2,
	};
}

const MIGRATIONS: Record<number, (value: Record<string, unknown>) => Record<string, unknown>> = {
	1: migrateV1ToV2,
};

export function loadPluginSettings(raw: unknown): PluginSettingsLoadResult {
	if (raw === null || raw === undefined) {
		return { settings: structuredClone(DEFAULT_SETTINGS), writeEnabled: true, migrated: false };
	}
	if (!isRecord(raw)) {
		return { settings: structuredClone(DEFAULT_SETTINGS), writeEnabled: false, migrated: false, error: "People Atlas settings are not an object." };
	}
	const shapeError = validateStoredShape(raw);
	if (shapeError) {
		return { settings: structuredClone(DEFAULT_SETTINGS), writeEnabled: false, migrated: false, error: `People Atlas settings are invalid: ${shapeError}` };
	}
	const sourceVersion = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1;
	if (sourceVersion > PLUGIN_DATA_SCHEMA_VERSION) {
		return { settings: structuredClone(DEFAULT_SETTINGS), writeEnabled: false, migrated: false, error: `People Atlas settings use unsupported schema version ${sourceVersion}.` };
	}
	let migratedData = structuredClone(raw);
	let migrated = false;
	try {
		for (let version = sourceVersion; version < PLUGIN_DATA_SCHEMA_VERSION; version += 1) {
			const migration = MIGRATIONS[version];
			if (!migration) throw new Error(`No migration is registered for schema version ${version}.`);
			migratedData = migration(migratedData);
			migrated = true;
		}
		const migratedShapeError = validateStoredShape(migratedData);
		if (migratedShapeError) throw new Error(migratedShapeError);
		const settings = validateSettings(migratedData);
		if (validatePeopleFolder(settings.peopleFolder)) throw new Error("peopleFolder is invalid.");
		return { settings, writeEnabled: true, migrated };
	} catch (error) {
		return {
			settings: structuredClone(DEFAULT_SETTINGS),
			writeEnabled: false,
			migrated: false,
			error: `People Atlas settings migration failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
