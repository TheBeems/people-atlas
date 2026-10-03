import type { App, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import PeopleAtlasPlugin from "../../src/main";
import { SettingsRecoveryModal } from "../../src/settings/recovery-modal";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import {
	SETTINGS_RECOVERY_KEY,
	previewSettingsRecovery,
	type SettingsRecoveryPreview,
} from "../../src/settings/recovery";
import { ControlledObsidianRuntime } from "../obsidian-stub";
import { required } from "../recovery-test-helpers";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Synthetic recovery integration",
	author: "People Atlas",
} as PluginManifest;
const plugins: PeopleAtlasPlugin[] = [];
const opened: SettingsRecoveryModal[] = [];
function button(modal: SettingsRecoveryModal, text: string): HTMLButtonElement {
	const result = Array.from(modal.contentEl.querySelectorAll<HTMLButtonElement>("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!result) throw new Error(`Missing ${text}`);
	return result;
}
async function setup(raw: unknown) {
	const runtime = new ControlledObsidianRuntime(document);
	runtime.pluginData = structuredClone(raw);
	runtime.seedFile("Existing/Unmoved.md", { type: "person", person_id: "existing-id", name: "Existing person" });
	const text = `${JSON.stringify(raw, null, 3)}\n`;
	const read = vi.fn(async (_path: string) => text);
	Object.assign(runtime.vault, { configDir: ".obsidian", adapter: { read } });
	const noteWrite = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
	const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
	plugins.push(plugin);
	await plugin.load();
	return { runtime, plugin, read, text, noteWrite };
}
function installModalMount() {
	vi.spyOn(SettingsRecoveryModal.prototype, "open").mockImplementation(function (this: SettingsRecoveryModal) {
		const root = document.createElement("div");
		this.titleEl = document.createElement("h2");
		this.contentEl = document.createElement("div");
		root.append(this.titleEl, this.contentEl);
		document.body.append(root);
		this.close = () => {
			this.onClose();
			root.remove();
		};
		this.onOpen();
		opened.push(this);
	});
}
function review(modal: SettingsRecoveryModal, plugin: PeopleAtlasPlugin) {
	const root = required(modal.contentEl.querySelector<HTMLInputElement>("input"));
	root.value = "Chosen root";
	root.dispatchEvent(new Event("input"));
	button(modal, plugin.t.recovery.reviewSettings).click();
}
afterEach(async () => {
	for (const modal of opened.splice(0)) modal.close();
	for (const plugin of plugins.splice(0)) await plugin.unload();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("controlled explicit settings recovery", () => {
	it("wires an explicit command, preserves exact original bytes across later saves and reloads, and never mutates notes", async () => {
		installModalMount();
		const h = await setup({
			schemaVersion: 7,
			peopleFolder: "Old people",
			contactMomentsFolder: "Old moments",
			showLabels: false,
			enableBases: false,
			myPersonId: "existing-id",
		});
		expect(h.plugin.canWritePeopleAtlasData()).toBe(false);
		expect(h.plugin.canRecoverOlderSettings()).toBe(true);
		expect(h.runtime.savedPluginData).toEqual([]);
		expect(h.read).not.toHaveBeenCalled();
		h.runtime.commands.get("recover-older-settings")?.callback?.();
		await vi.waitFor(() => expect(opened).toHaveLength(1));
		const modal = required(opened[0]);
		expect(h.read).toHaveBeenCalledWith(".obsidian/plugins/people-atlas/data.json");
		review(modal, h.plugin);
		expect(h.runtime.savedPluginData).toEqual([]);
		button(modal, h.plugin.t.recovery.confirmSettings).click();
		await vi.waitFor(() => expect(h.plugin.canWritePeopleAtlasData()).toBe(true));
		expect(h.plugin.settings).toMatchObject({
			peopleRootFolder: "Chosen root",
			showLabels: false,
			enableBases: false,
			myPersonId: "existing-id",
		});
		expect(
			(h.runtime.pluginData as Record<string, { originalText?: string }>)[SETTINGS_RECOVERY_KEY]?.originalText,
		).toBe(h.text);
		expect(h.noteWrite).not.toHaveBeenCalled();
		expect(h.runtime.vault.files.has("Existing/Unmoved.md")).toBe(true);
		await h.plugin.updateSetting("showLabels", true);
		await h.plugin.saveViewState("synthetic-recovery", h.plugin.getViewState("synthetic-recovery"));
		await h.plugin.flushViewState("synthetic-recovery");
		expect(
			(h.runtime.pluginData as Record<string, { originalText?: string }>)[SETTINGS_RECOVERY_KEY]?.originalText,
		).toBe(h.text);
		expect(h.noteWrite).not.toHaveBeenCalled();
		await h.plugin.unload();
		plugins.splice(plugins.indexOf(h.plugin), 1);
		const reloaded = new PeopleAtlasPlugin(h.runtime.app as unknown as App, manifest);
		plugins.push(reloaded);
		await reloaded.load();
		expect(reloaded.canWritePeopleAtlasData()).toBe(true);
		expect(reloaded.canRecoverOlderSettings()).toBe(false);
		await reloaded.updateSetting("showLabels", false);
		expect(
			(h.runtime.pluginData as Record<string, { originalText?: string }>)[SETTINGS_RECOVERY_KEY]?.originalText,
		).toBe(h.text);
	});
	it("cancellation and failed persistence leave old settings read-only and available for recovery", async () => {
		installModalMount();
		const raw = { schemaVersion: 7, peopleFolder: "Old", showLabels: false };
		const h = await setup(raw);
		await h.plugin.openSettingsRecovery();
		const first = required(opened[0]);
		review(first, h.plugin);
		button(first, h.plugin.t.recovery.cancel).click();
		expect(h.runtime.savedPluginData).toEqual([]);
		expect(h.runtime.pluginData).toEqual(raw);
		await h.plugin.openSettingsRecovery();
		const modal = required(opened[1]);
		review(modal, h.plugin);
		vi.spyOn(h.plugin, "saveData").mockRejectedValue(new Error("Disk full"));
		button(modal, h.plugin.t.recovery.confirmSettings).click();
		await vi.waitFor(() => expect(modal.contentEl.textContent).toContain("Disk full"));
		expect(h.runtime.pluginData).toEqual(raw);
		expect(h.plugin.settings).toEqual(DEFAULT_SETTINGS);
		expect(h.plugin.canWritePeopleAtlasData()).toBe(false);
		expect(h.plugin.canRecoverOlderSettings()).toBe(true);
		expect(h.noteWrite).not.toHaveBeenCalled();
	});
	it("future and malformed schema-7 data stay unchanged without a recovery dialog or note writes", async () => {
		installModalMount();
		for (const raw of [
			{ schemaVersion: 9, unknown: "future" },
			{ schemaVersion: 7, showLabels: "broken" },
		]) {
			const h = await setup(raw);
			await h.plugin.openSettingsRecovery();
			expect(h.plugin.canRecoverOlderSettings()).toBe(false);
			expect(h.runtime.pluginData).toEqual(raw);
			expect(h.runtime.savedPluginData).toEqual([]);
			expect(h.read).not.toHaveBeenCalled();
			expect(h.noteWrite).not.toHaveBeenCalled();
		}
		expect(opened).toEqual([]);
	});
	it("publishes exactly the persisted reviewed settings when the public preview changes during a pending save", async () => {
		const raw = { schemaVersion: 7, peopleFolder: "Old", showLabels: false };
		const h = await setup(raw);
		const preview = previewSettingsRecovery(raw, h.text, "Reviewed root");
		let finishSave: (() => void) | undefined;
		const originalSave = h.plugin.saveData.bind(h.plugin);
		const save = vi.spyOn(h.plugin, "saveData").mockImplementation(async (data: unknown) => {
			await new Promise<void>((resolve) => {
				finishSave = resolve;
			});
			await originalSave(data);
		});
		const recovering = (
			h.plugin as unknown as { recoverReviewedSettings(preview: SettingsRecoveryPreview): Promise<void> }
		).recoverReviewedSettings(preview);
		await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
		Object.assign(preview, previewSettingsRecovery(raw, h.text, "Injected root"));
		preview.settings.showLabels = true;
		required(finishSave)();
		await recovering;
		expect(h.plugin.canWritePeopleAtlasData()).toBe(true);
		expect(h.plugin.settings).toMatchObject({ peopleRootFolder: "Reviewed root", showLabels: false });
		expect(h.runtime.pluginData).toMatchObject({
			peopleRootFolder: "Reviewed root",
			showLabels: false,
			[SETTINGS_RECOVERY_KEY]: { peopleRootFolder: "Reviewed root", originalText: h.text },
		});
		expect(h.noteWrite).not.toHaveBeenCalled();
	});
});
