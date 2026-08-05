import { afterEach, describe, expect, it, vi } from "vitest";
import type { App, PluginManifest } from "obsidian";
import PeopleAtlasPlugin from "../../src/main";
import { createTranslator } from "../../src/i18n";
import type { ContactMomentSummary } from "../../src/domain/types";
import { PeopleAtlasSettingTab } from "../../src/settings/settings-tab";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { ControlledObsidianRuntime, notices, setTestLanguage } from "../obsidian-stub";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Controlled integration manifest",
	author: "People Atlas",
} as PluginManifest;

type SettingDefinition = {
	type?: string;
	heading?: string;
	name?: string;
	desc?: string;
	control?: { key?: string; placeholder?: string };
	items?: SettingDefinition[];
};

function settingLabels(tab: PeopleAtlasSettingTab): string[] {
	const labels: string[] = [];
	const visit = (definitions: SettingDefinition[]): void => {
		for (const definition of definitions) {
			if (definition.heading) labels.push(definition.heading);
			if (definition.name) labels.push(definition.name);
			visit(definition.items ?? []);
		}
	};
	visit(tab.getSettingDefinitions() as SettingDefinition[]);
	return labels;
}

function settingDefinition(tab: PeopleAtlasSettingTab, key: string): SettingDefinition | undefined {
	const visit = (definitions: SettingDefinition[]): SettingDefinition | undefined => {
		for (const definition of definitions) {
			if (definition.control?.key === key) return definition;
			const nested = visit(definition.items ?? []);
			if (nested) return nested;
		}
		return undefined;
	};
	return visit(tab.getSettingDefinitions() as SettingDefinition[]);
}

async function loadPluginFor(
	language: string,
	pluginData: unknown = null,
	frontmatter: Record<string, unknown> | undefined = undefined,
) {
	setTestLanguage(language);
	const runtime = new ControlledObsidianRuntime(document);
	runtime.pluginData = structuredClone(pluginData);
	const initialFile = frontmatter ? runtime.seedFile("People/Alice.md", frontmatter) : undefined;
	const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
	await plugin.load();
	const tab = [...runtime.settingTabs].find((candidate) => candidate instanceof PeopleAtlasSettingTab);
	if (!tab) throw new Error("Expected the People Atlas Settings tab.");
	return { plugin, runtime, tab, initialFile };
}

afterEach(() => {
	setTestLanguage("en");
	notices.splice(0);
	document.body.replaceChildren();
});

describe("primary i18n UI", () => {
	it("uses the initial Obsidian locale for commands, ribbon and the four-item Settings surface without writes", async () => {
		const dutch = await loadPluginFor("nl-NL");
		const english = await loadPluginFor("en-US");
		try {
			const dutchCommands = [...dutch.runtime.commands.values()].map(({ id, name }) => ({ id, name }));
			const englishCommands = [...english.runtime.commands.values()].map(({ id, name }) => ({ id, name }));
			expect(dutchCommands.map(({ id }) => id)).toEqual(englishCommands.map(({ id }) => id));
			expect(dutchCommands.map(({ name }) => name)).toEqual([
				"Atlas openen",
				"Opvolgacties openen",
				"Persoon aanmaken",
				"Huidige persoon bewerken",
				"Relatie aanmaken",
				"Huidige relatie bewerken",
				"Contactmoment vastleggen",
				"Huidig contactmoment bewerken",
			]);
			expect(englishCommands.map(({ name }) => name)).toEqual([
				"Open atlas",
				"Open follow-ups",
				"Create person",
				"Edit current person",
				"Create relationship",
				"Edit current relationship",
				"Log contact",
				"Edit current contact moment",
			]);
			expect([...dutch.runtime.ribbonItems].map((item) => item.title)).toEqual(["People Atlas openen"]);
			expect([...english.runtime.ribbonItems].map((item) => item.title)).toEqual(["Open People Atlas"]);
			expect(settingLabels(dutch.tab)).toEqual([
				"Algemeen",
				"Hoofdmap voor personen",
				"Mijn persoon",
				"Relatiesjablonen",
				"Labels tonen",
			]);
			expect(settingLabels(english.tab)).toEqual([
				"General",
				"People root folder",
				"My person",
				"Relationship templates",
				"Show labels",
			]);
			expect(dutch.plugin.settings).toEqual(english.plugin.settings);
			expect(dutch.runtime.savedPluginData).toEqual([]);
			expect(english.runtime.savedPluginData).toEqual([]);
			expect(dutch.runtime.vault.markdownScanCount).toBe(0);
			expect(english.runtime.vault.markdownScanCount).toBe(0);
		} finally {
			await dutch.plugin.unload();
			await english.plugin.unload();
		}
	});

	it("localizes the shared read-only Settings notice without changing persisted state or indexing", async () => {
		const pluginData = { ...structuredClone(DEFAULT_SETTINGS), myPersonId: "alice-id" };
		const frontmatter = { type: "person", person_id: "alice-id", name: "Alice", aliases: ["Al"] };
		const dutch = await loadPluginFor("nl", pluginData, frontmatter);
		const english = await loadPluginFor("en", pluginData, frontmatter);
		try {
			for (const plugin of [dutch.plugin, english.plugin]) {
				(plugin as unknown as { settingsWriteEnabled: boolean }).settingsWriteEnabled = false;
			}
			const dutchBefore = structuredClone(dutch.plugin.settings);
			const englishBefore = structuredClone(english.plugin.settings);
			const dutchRebuild = vi.spyOn(dutch.plugin.index, "rebuildAll");
			const englishRebuild = vi.spyOn(english.plugin.index, "rebuildAll");

			notices.splice(0);
			await dutch.plugin.updateSetting("showLabels", false);
			expect(notices).toEqual(["People Atlas-instellingen zijn alleen-lezen totdat de plugingegevens zijn hersteld."]);
			notices.splice(0);
			await english.plugin.updateSetting("showLabels", false);
			expect(notices).toEqual(["People Atlas settings are read-only until the plugin data is repaired."]);
			expect(dutch.plugin.settings).toEqual(dutchBefore);
			expect(english.plugin.settings).toEqual(englishBefore);
			expect(dutch.plugin.settings).toEqual(english.plugin.settings);
			expect(dutch.plugin.settings.myPersonId).toBe("alice-id");
			expect(english.plugin.settings.myPersonId).toBe("alice-id");
			expect(dutch.runtime.pluginData).toEqual(pluginData);
			expect(english.runtime.pluginData).toEqual(pluginData);
			expect(dutch.initialFile && dutch.runtime.metadataCache.getFileCache(dutch.initialFile)?.frontmatter).toEqual(
				frontmatter,
			);
			expect(
				english.initialFile && english.runtime.metadataCache.getFileCache(english.initialFile)?.frontmatter,
			).toEqual(frontmatter);
			expect(dutch.runtime.savedPluginData).toEqual([]);
			expect(english.runtime.savedPluginData).toEqual([]);
			expect(dutch.runtime.vault.markdownScanCount).toBe(0);
			expect(english.runtime.vault.markdownScanCount).toBe(0);
			expect(dutchRebuild).not.toHaveBeenCalled();
			expect(englishRebuild).not.toHaveBeenCalled();
		} finally {
			await dutch.plugin.unload();
			await english.plugin.unload();
		}
	});

	it("localizes unavailable My person Settings text without changing its stored ID or writing", async () => {
		const pluginData = { ...structuredClone(DEFAULT_SETTINGS), myPersonId: "missing-id" };
		const dutch = await loadPluginFor("nl", pluginData);
		const english = await loadPluginFor("en", pluginData);
		try {
			expect(settingDefinition(dutch.tab, "myPersonId")).toMatchObject({
				desc: "Er zijn nog geen geldige persoonsnotities geïndexeerd. Maak of herstel een canonieke persoonsnotitie en selecteer die hier. Waarschuwing: Persoons-ID “missing-id” is niet beschikbaar in de canonieke index.",
				control: { placeholder: "Selecteer een persoonsnotitie" },
			});
			expect(settingDefinition(english.tab, "myPersonId")).toMatchObject({
				desc: "No valid person notes are indexed yet. Create or repair a canonical person note, then select it here. Warning: My person ID “missing-id” is not available in the canonical index.",
				control: { placeholder: "Select a person note" },
			});
			expect(dutch.plugin.settings.myPersonId).toBe("missing-id");
			expect(english.plugin.settings.myPersonId).toBe("missing-id");
			expect(dutch.runtime.savedPluginData).toEqual([]);
			expect(english.runtime.savedPluginData).toEqual([]);
			expect(dutch.runtime.vault.markdownScanCount).toBe(0);
			expect(english.runtime.vault.markdownScanCount).toBe(0);
		} finally {
			await dutch.plugin.unload();
			await english.plugin.unload();
		}
	});

	it("localizes successful follow-up action feedback without changing reviewed values", async () => {
		const moment: ContactMomentSummary = {
			id: "moment-follow-up",
			filePath: "People/Contact moments/Alice.md",
			personIds: ["person-alice"],
			occurredOn: "2026-08-01",
			followUpOn: "2026-08-02",
			followUpStatus: "open",
		};
		const updateContactMomentFollowUpStatus = vi.fn(async () => undefined);
		const plugin = Object.assign(Object.create(PeopleAtlasPlugin.prototype), {
			t: createTranslator("nl"),
			canWritePeopleAtlasData: () => true,
			canUpdateContactMomentFollowUp: () => true,
			resolveCanonicalContactMomentSummary: () => ({}),
			resolveIndexedContactMomentSummary: () => ({
				actionable: true,
				followUpActionable: true,
				followUpOn: moment.followUpOn,
				followUpStatus: "open",
			}),
			mutations: { updateContactMomentFollowUpStatus },
		}) as {
			updateContactMomentFollowUp: (moment: ContactMomentSummary, status: "done" | "dismissed") => Promise<boolean>;
		};

		await expect(plugin.updateContactMomentFollowUp(moment, "done")).resolves.toBe(true);
		await expect(plugin.updateContactMomentFollowUp(moment, "dismissed")).resolves.toBe(true);

		expect(notices).toEqual(["Opvolging gemarkeerd als afgerond.", "Opvolging genegeerd."]);
		expect(updateContactMomentFollowUpStatus).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				filePath: "People/Contact moments/Alice.md",
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedOccurredOn: "2026-08-01",
				reviewedFollowUpOn: "2026-08-02",
				reviewedFollowUpStatus: "open",
				status: "done",
			}),
		);
	});
});
