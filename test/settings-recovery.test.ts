import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { loadPluginSettings } from "../src/settings/load";
import { required } from "./recovery-test-helpers";
import {
	canRecoverSettings,
	loadSettingsRecoveryBackup,
	previewSettingsRecovery,
	saveReviewedSettingsRecovery,
	SETTINGS_RECOVERY_KEY,
	settingsDataWithBackup,
} from "../src/settings/recovery";

const old = {
	schemaVersion: 7,
	peopleFolder: "Private/People",
	contactMomentsFolder: "Private/Moments",
	showLabels: false,
	nameProperty: "display_name",
	myPersonId: "my-authored-id",
	unknownOldSetting: { keep: [1, "raw"] },
};
const originalText = ` {\n  "schemaVersion": 7,\n  "peopleFolder": "Private/People",\n  "contactMomentsFolder": "Private/Moments",\n  "showLabels": false,\n  "nameProperty": "display_name",\n  "myPersonId": "my-authored-id",\n  "unknownOldSetting": {"keep": [1, "raw"]}\n}\n`;

describe("reviewed schema-7 settings recovery", () => {
	it("keeps startup rejection intact and writes nothing during preview", () => {
		const source = structuredClone(old);
		expect(loadPluginSettings(source).writeEnabled).toBe(false);
		expect(canRecoverSettings(source)).toBe(true);
		const preview = previewSettingsRecovery(source, originalText, "New People");
		expect(source).toEqual(old);
		expect(preview.settings).toMatchObject({
			peopleRootFolder: "New People",
			showLabels: false,
			nameProperty: "display_name",
			myPersonId: "my-authored-id",
		});
		expect(preview.backup.originalText).toBe(originalText);
		expect(preview.entries).toContainEqual({ key: "peopleFolder", before: "Private/People", status: "unsupported" });
		expect(preview.entries.some((entry) => entry.status === "reset")).toBe(true);
	});
	it("requires an explicitly valid root instead of interpreting removed folders", () => {
		for (const root of ["", "../Private", "/absolute", "C:/Private"])
			expect(() => previewSettingsRecovery(old, originalText, root)).toThrow();
		expect(previewSettingsRecovery(old, originalText, "My/Chosen root").settings.peopleRootFolder).toBe(
			"My/Chosen root",
		);
	});
	it("accurately marks normalized values as adjusted instead of claiming exact retention", () => {
		const source = { schemaVersion: 7, myPersonId: "  authored-id  " };
		const preview = previewSettingsRecovery(source, JSON.stringify(source), "People");
		expect(preview.entries).toContainEqual({
			key: "myPersonId",
			before: "  authored-id  ",
			after: "authored-id",
			status: "changed",
		});
	});
	it("accepts current data with defaults without exposing an older recovery", () => {
		expect(
			loadPluginSettings({ schemaVersion: DEFAULT_SETTINGS.schemaVersion, showLabels: false }).settings.untilProperty,
		).toBe(DEFAULT_SETTINGS.untilProperty);
		expect(canRecoverSettings(DEFAULT_SETTINGS)).toBe(false);
		expect(() => previewSettingsRecovery(DEFAULT_SETTINGS, JSON.stringify(DEFAULT_SETTINGS), "People")).toThrow();
	});
	it.each([
		undefined,
		null,
		[],
		{ schemaVersion: 9 },
		{ schemaVersion: 6 },
		{ schemaVersion: 7, showLabels: "yes" },
		{ schemaVersion: 7, peopleFolder: 42 },
		{ schemaVersion: 7, nameProperty: "bad:key" },
	])("refuses unsupported/malformed source %# without changing it", (source) => {
		const before = structuredClone(source);
		expect(canRecoverSettings(source)).toBe(false);
		expect(() => previewSettingsRecovery(source, JSON.stringify(source) ?? "null", "People")).toThrow();
		expect(source).toEqual(before);
	});
	it("saves only reviewed settings and exact backup; later ordinary saves and reload retain the backup", async () => {
		const preview = previewSettingsRecovery(old, originalText, "New People");
		const save = vi.fn(async (_data: Record<string, unknown>) => undefined);
		await saveReviewedSettingsRecovery(preview, async () => originalText, save);
		const first = required(save.mock.calls[0])[0];
		expect(first[SETTINGS_RECOVERY_KEY]).toEqual(preview.backup);
		const loaded = loadPluginSettings(first);
		expect(loaded.writeEnabled).toBe(true);
		expect(loaded.recoveryBackup?.originalText).toBe(originalText);
		const later = settingsDataWithBackup(
			{ ...loaded.settings, showLabels: true, viewStates: {} },
			loaded.recoveryBackup,
		);
		expect(loadPluginSettings(later).recoveryBackup).toEqual(preview.backup);
		expect((later[SETTINGS_RECOVERY_KEY] as { originalText: string }).originalText).toBe(originalText);
	});
	it("rejects stale exact source text and tampered preview without saving", async () => {
		const preview = previewSettingsRecovery(old, originalText, "New People");
		const save = vi.fn();
		await expect(saveReviewedSettingsRecovery(preview, async () => JSON.stringify(old), save)).rejects.toThrow(
			"changed after review",
		);
		preview.settings.showLabels = true;
		await expect(saveReviewedSettingsRecovery(preview, async () => originalText, save)).rejects.toThrow(
			"reviewed settings changed",
		);
		expect(save).not.toHaveBeenCalled();
	});
	it("surfaces save errors while retaining original recovery inputs", async () => {
		const preview = previewSettingsRecovery(old, originalText, "New People");
		const before = structuredClone(preview);
		const save = vi.fn(async () => {
			throw new Error("Disk full");
		});
		await expect(saveReviewedSettingsRecovery(preview, async () => originalText, save)).rejects.toThrow("Disk full");
		expect(preview).toEqual(before);
		expect(old.schemaVersion).toBe(7);
		expect(preview.backup.originalText).toBe(originalText);
	});
	it("rejects a coherently substituted root and copied previews before reading or saving", async () => {
		const preview = previewSettingsRecovery(old, originalText, "Reviewed root");
		const read = vi.fn(async () => originalText);
		const save = vi.fn();
		const replacement = previewSettingsRecovery(old, originalText, "Other root");
		Object.assign(preview, replacement);
		await expect(saveReviewedSettingsRecovery(preview, read, save)).rejects.toThrow("reviewed settings changed");
		await expect(saveReviewedSettingsRecovery(structuredClone(replacement), read, save)).rejects.toThrow(
			"reviewed settings changed",
		);
		expect(read).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});
	it("rejects coherent preview substitution while the original source is being read", async () => {
		const preview = previewSettingsRecovery(old, originalText, "Reviewed root");
		let resolveRead: ((text: string) => void) | undefined;
		const save = vi.fn();
		const saving = saveReviewedSettingsRecovery(
			preview,
			() =>
				new Promise((resolve) => {
					resolveRead = resolve;
				}),
			save,
		);
		Object.assign(preview, previewSettingsRecovery(old, originalText, "Other root"));
		required(resolveRead)(originalText);
		await expect(saving).rejects.toThrow("reviewed settings changed");
		expect(save).not.toHaveBeenCalled();
	});
	it("returns the detached persisted payload when the public preview changes during the save", async () => {
		const preview = previewSettingsRecovery(old, originalText, "Reviewed root");
		let finishSave: (() => void) | undefined;
		const save = vi.fn(
			async (_data: Record<string, unknown>) =>
				new Promise<void>((resolve) => {
					finishSave = resolve;
				}),
		);
		const saving = saveReviewedSettingsRecovery(preview, async () => originalText, save);
		await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
		Object.assign(preview, previewSettingsRecovery(old, originalText, "Other root"));
		preview.settings.showLabels = true;
		required(finishSave)();
		const saved = await saving;
		expect(saved.settings).toMatchObject({ peopleRootFolder: "Reviewed root", showLabels: false });
		expect(saved.backup.peopleRootFolder).toBe("Reviewed root");
		expect(saved.backup.originalText).toBe(originalText);
		expect(required(save.mock.calls[0])[0]).toMatchObject({
			peopleRootFolder: "Reviewed root",
			showLabels: false,
			[SETTINGS_RECOVERY_KEY]: saved.backup,
		});
		expect(saved).not.toBe(preview);
	});
	it("rejects malformed retained backups rather than dropping them during a save", () => {
		const raw = { ...DEFAULT_SETTINGS, [SETTINGS_RECOVERY_KEY]: { status: "recovered", originalText: "broken" } };
		expect(() => loadSettingsRecoveryBackup(raw)).toThrow();
		expect(loadPluginSettings(raw).writeEnabled).toBe(false);
	});
});
