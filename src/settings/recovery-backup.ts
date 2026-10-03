import { PLUGIN_DATA_SCHEMA_VERSION } from "../constants";
import type { PeopleAtlasSettings } from "./types";
import { validatePeopleRootFolder } from "../domain/people-root";

export const SETTINGS_RECOVERY_KEY = "_peopleAtlasRecovery";
export interface SettingsRecoveryBackup {
	status: "recovered";
	sourceSchemaVersion: 7;
	targetSchemaVersion: number;
	peopleRootFolder: string;
	originalText: string;
}
export function isSettingsRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function exactSettingsDataSignature(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(exactSettingsDataSignature).join(",")}]`;
	if (isSettingsRecord(value))
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, entry]) => `${JSON.stringify(key)}:${exactSettingsDataSignature(entry)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "undefined";
}
export function loadSettingsRecoveryBackup(raw: unknown): SettingsRecoveryBackup | undefined {
	if (!isSettingsRecord(raw) || raw[SETTINGS_RECOVERY_KEY] === undefined) return undefined;
	const backup = raw[SETTINGS_RECOVERY_KEY];
	if (
		!isSettingsRecord(backup) ||
		backup.status !== "recovered" ||
		backup.sourceSchemaVersion !== 7 ||
		backup.targetSchemaVersion !== PLUGIN_DATA_SCHEMA_VERSION ||
		typeof backup.peopleRootFolder !== "string" ||
		validatePeopleRootFolder(backup.peopleRootFolder) ||
		typeof backup.originalText !== "string"
	)
		throw new Error("The retained settings recovery backup is malformed; plugin data remains read-only.");
	let original: unknown;
	try {
		original = JSON.parse(backup.originalText);
	} catch {
		throw new Error("The retained original settings data is malformed; plugin data remains read-only.");
	}
	if (!isSettingsRecord(original) || original.schemaVersion !== 7)
		throw new Error("The retained original settings schema is unsupported; plugin data remains read-only.");
	return structuredClone(backup) as unknown as SettingsRecoveryBackup;
}
export function settingsDataWithBackup(
	settings: PeopleAtlasSettings,
	backup?: SettingsRecoveryBackup,
): Record<string, unknown> {
	return backup ? { ...settings, [SETTINGS_RECOVERY_KEY]: structuredClone(backup) } : { ...settings };
}
