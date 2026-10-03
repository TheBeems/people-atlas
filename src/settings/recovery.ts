import { PLUGIN_DATA_SCHEMA_VERSION } from "../constants";
import { DEFAULT_SETTINGS } from "./defaults";
import { loadPluginSettings } from "./load";
import type { PeopleAtlasSettings } from "./types";
import { validatePeopleRootFolder } from "./validate";
import {
	SETTINGS_RECOVERY_KEY,
	exactSettingsDataSignature,
	isSettingsRecord as isRecord,
	settingsDataWithBackup,
	type SettingsRecoveryBackup,
} from "./recovery-backup";
export {
	SETTINGS_RECOVERY_KEY,
	exactSettingsDataSignature,
	loadSettingsRecoveryBackup,
	settingsDataWithBackup,
	type SettingsRecoveryBackup,
} from "./recovery-backup";

export interface SettingsRecoveryEntry {
	key: string;
	before: unknown;
	after?: unknown;
	status: "retained" | "changed" | "reset" | "unsupported";
}
export interface SettingsRecoveryPreview {
	settings: PeopleAtlasSettings;
	backup: SettingsRecoveryBackup;
	entries: SettingsRecoveryEntry[];
}
interface SettingsRecoveryBaseline {
	reviewed: string;
	payload: SettingsRecoveryPreview;
}
const reviewedPreviews = new WeakMap<SettingsRecoveryPreview, SettingsRecoveryBaseline>();

export function canRecoverSettings(raw: unknown): boolean {
	if (!isRecord(raw) || raw.schemaVersion !== 7 || raw[SETTINGS_RECOVERY_KEY] !== undefined) return false;
	try {
		return Boolean(previewSettingsRecovery(raw, JSON.stringify(raw), DEFAULT_SETTINGS.peopleRootFolder));
	} catch {
		return false;
	}
}

/** Schema 7 is the inspected pre-dossier contract; older schemas are unproven. */
export function previewSettingsRecovery(
	raw: unknown,
	originalText: string,
	chosenRoot: string,
): SettingsRecoveryPreview {
	if (!isRecord(raw) || raw.schemaVersion !== 7 || raw[SETTINGS_RECOVERY_KEY] !== undefined)
		throw new Error("Only valid, unrecovered schema 7 settings are supported.");
	const root = chosenRoot.trim();
	if (!root) throw new Error("Choose the target People root explicitly.");
	const rootError = validatePeopleRootFolder(chosenRoot);
	if (rootError) throw new Error(rootError);
	let original: unknown;
	try {
		original = JSON.parse(originalText);
	} catch {
		throw new Error("The original plugin data cannot be backed up exactly.");
	}
	if (exactSettingsDataSignature(original) !== exactSettingsDataSignature(raw))
		throw new Error("The original plugin data changed. Open a new recovery preview.");
	for (const key of ["peopleFolder", "contactMomentsFolder"] as const) {
		if (raw[key] !== undefined && (typeof raw[key] !== "string" || validatePeopleRootFolder(raw[key] as string)))
			throw new Error(`The legacy ${key} setting is malformed.`);
	}
	const common: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw))
		if (Object.hasOwn(DEFAULT_SETTINGS, key) && key !== "schemaVersion" && key !== "peopleRootFolder")
			common[key] = value;
	const loaded = loadPluginSettings({ ...common, schemaVersion: PLUGIN_DATA_SCHEMA_VERSION, peopleRootFolder: root });
	if (!loaded.writeEnabled)
		throw new Error(loaded.error ?? "The common settings are not valid under the current contract.");
	const settings = loaded.settings;
	const entries: SettingsRecoveryEntry[] = [];
	for (const [key, after] of Object.entries(settings)) {
		if (key === "schemaVersion" || key === "peopleRootFolder") continue;
		entries.push({
			key,
			before: raw[key],
			after,
			status: !Object.hasOwn(raw, key)
				? "reset"
				: exactSettingsDataSignature(raw[key]) === exactSettingsDataSignature(after)
					? "retained"
					: "changed",
		});
	}
	for (const [key, before] of Object.entries(raw))
		if (!Object.hasOwn(DEFAULT_SETTINGS, key) && key !== "schemaVersion")
			entries.push({ key, before, status: "unsupported" });
	const preview: SettingsRecoveryPreview = {
		settings,
		entries,
		backup: {
			status: "recovered",
			sourceSchemaVersion: 7,
			targetSchemaVersion: PLUGIN_DATA_SCHEMA_VERSION,
			peopleRootFolder: root,
			originalText,
		},
	};
	reviewedPreviews.set(preview, {
		reviewed: exactSettingsDataSignature(preview),
		payload: structuredClone(preview),
	});
	return preview;
}

/** Save then publish: a failed persistence call never replaces the usable state. */
export async function saveReviewedSettingsRecovery(
	preview: SettingsRecoveryPreview,
	readOriginalText: () => Promise<string>,
	save: (data: Record<string, unknown>) => Promise<void>,
): Promise<SettingsRecoveryPreview> {
	const baseline = reviewedPreviews.get(preview);
	if (!baseline || exactSettingsDataSignature(preview) !== baseline.reviewed)
		throw new Error("The reviewed settings changed. Open a new preview.");
	const approved = structuredClone(baseline.payload);
	const currentText = await readOriginalText();
	if (currentText !== approved.backup.originalText)
		throw new Error("The original settings file changed after review. Open a new preview.");
	if (exactSettingsDataSignature(preview) !== baseline.reviewed)
		throw new Error("The reviewed settings changed. Open a new preview.");
	const canonical = previewSettingsRecovery(JSON.parse(currentText), currentText, approved.backup.peopleRootFolder);
	if (exactSettingsDataSignature(canonical) !== baseline.reviewed)
		throw new Error("The reviewed settings changed. Open a new preview.");
	await save(structuredClone(settingsDataWithBackup(approved.settings, approved.backup)));
	return approved;
}
