import { afterEach, describe, expect, it } from "vitest";
import type { App, PluginManifest } from "obsidian";
import { BASES_OPTION_KEYS } from "../../src/bases/options";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import PeopleAtlasPlugin from "../../src/main";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { DEFAULT_VIEW_STATE } from "../../src/settings/view-state";
import { type Component, ControlledObsidianRuntime } from "../obsidian-stub";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Controlled My person test manifest",
	author: "People Atlas",
} as PluginManifest;

function person(personId: string | undefined, name: string): Record<string, unknown> {
	return {
		type: "person",
		...(personId ? { person_id: personId } : {}),
		name,
	};
}

async function loadPlugin(runtime: ControlledObsidianRuntime, triggerLayoutReady = true): Promise<PeopleAtlasPlugin> {
	const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
	await (plugin as unknown as Component).load();
	if (triggerLayoutReady) runtime.triggerLayoutReady();
	return plugin;
}

async function unloadPlugin(plugin: PeopleAtlasPlugin): Promise<void> {
	await (plugin as unknown as Component).unload();
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("My person identity and navigation boundary", () => {
	it("offers only unique explicit person IDs and ignores notes without one", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		runtime.seedFile("People/Me.md", person("me-123", "Me"));
		runtime.seedFile("People/Aardvark.md", person("aardvark", "Aardvark"));
		runtime.seedFile("People/No explicit ID.md", person(undefined, "Fallback"));
		runtime.seedFile("People/Path collision.md", person("path:people/no explicit id.md", "Path collision"));
		runtime.seedFile("People/Duplicate one.md", person("duplicate", "Duplicate one"));
		runtime.seedFile("People/Duplicate two.md", person("duplicate", "Duplicate two"));
		const plugin = await loadPlugin(runtime);

		try {
			expect(plugin.getMyPersonCandidates()).toEqual([
				{ id: "aardvark", name: "Aardvark", filePath: "People/Aardvark.md" },
				{ id: "me-123", name: "Me", filePath: "People/Me.md" },
				{
					id: "path:people/no explicit id.md",
					name: "Path collision",
					filePath: "People/Path collision.md",
				},
			]);

			plugin.settings.myPersonId = "me-123";
			expect(plugin.resolveMyPerson()).toEqual(
				expect.objectContaining({
					id: "me-123",
					filePath: "People/Me.md",
				}),
			);
			expect(plugin.getMyPersonWarning()).toBeUndefined();

			plugin.settings.myPersonId = "missing";
			expect(plugin.resolveMyPerson()).toBeUndefined();
			expect(plugin.getMyPersonWarning()).toContain("not available");

			plugin.settings.myPersonId = "duplicate";
			expect(plugin.resolveMyPerson()).toBeUndefined();
			expect(plugin.getMyPersonWarning()).toContain("ambiguous across 2 person notes");

			plugin.settings.myPersonId = "path:people/no explicit id.md";
			expect(plugin.resolveMyPerson()?.filePath).toBe("People/Path collision.md");
			expect(plugin.getMyPersonWarning()).toBeUndefined();

			plugin.settings.myPersonId = "";
			expect(plugin.resolveMyPerson()).toBeUndefined();
			expect(plugin.getMyPersonWarning()).toBeUndefined();
		} finally {
			await unloadPlugin(plugin);
		}
	});

	it("initializes standalone and Bases centers from My person without recentering open views after a setting change", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const meFile = runtime.seedFile("People/Me.md", person("me", "Me"));
		const otherFile = runtime.seedFile("People/Other.md", person("other", "Other"));
		runtime.pluginData = { ...structuredClone(DEFAULT_SETTINGS), myPersonId: "me" };
		const plugin = await loadPlugin(runtime);

		try {
			const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
			const bases = await runtime.openBasesView(
				BASES_VIEW_TYPE_PEOPLE_ATLAS,
				[
					runtime.createBasesEntry(meFile, {
						"note.person_id": "me",
						"note.name": "Me",
						"note.organisations": [],
						"note.contacts": [],
					}),
					runtime.createBasesEntry(otherFile, {
						"note.person_id": "other",
						"note.name": "Other",
						"note.organisations": [],
						"note.contacts": [],
					}),
				],
				"People",
			);
			const standaloneState = standalone.view as unknown as { centerId?: string };
			const basesState = bases.view as unknown as {
				readConfiguredCenterId(state: typeof DEFAULT_VIEW_STATE): string | undefined;
			};

			expect(standaloneState.centerId).toBe("me");
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:People"))).toBe("me");

			expect(await plugin.updateSetting("myPersonId", "other")).toBe(true);
			expect(plugin.resolveMyPerson()?.id).toBe("other");
			expect(standaloneState.centerId).toBe("me");
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:People"))).toBe("me");

			bases.controller.config.set(BASES_OPTION_KEYS.centerPersonId, "other");
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:People"))).toBe("other");
			expect(plugin.settings.myPersonId).toBe("other");
		} finally {
			await unloadPlugin(plugin);
		}
	});

	it("defers My person initialization for restored views until the canonical index starts", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const meFile = runtime.seedFile("People/Me.md", person("me", "Me"));
		runtime.pluginData = { ...structuredClone(DEFAULT_SETTINGS), myPersonId: "me" };
		const plugin = await loadPlugin(runtime, false);

		try {
			const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
			const bases = await runtime.openBasesView(
				BASES_VIEW_TYPE_PEOPLE_ATLAS,
				[
					runtime.createBasesEntry(meFile, {
						"note.person_id": "me",
						"note.name": "Me",
						"note.organisations": [],
						"note.contacts": [],
					}),
				],
				"People",
			);
			const standaloneState = standalone.view as unknown as { centerId?: string };
			const basesState = bases.view as unknown as {
				readConfiguredCenterId(state: typeof DEFAULT_VIEW_STATE): string | undefined;
			};

			expect(standaloneState.centerId).toBeUndefined();
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:People"))).toBeUndefined();

			runtime.triggerLayoutReady();

			expect(standaloneState.centerId).toBe("me");
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:People"))).toBe("me");
		} finally {
			await unloadPlugin(plugin);
		}
	});

	it("does not apply a deferred fallback after My person changes on an already open view", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const meFile = runtime.seedFile("People/Me.md", person("me", "Me"));
		runtime.seedFile("People/Other.md", person("other", "Other"));
		runtime.pluginData = { ...structuredClone(DEFAULT_SETTINGS), myPersonId: "me" };
		const plugin = await loadPlugin(runtime, false);

		try {
			const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
			const bases = await runtime.openBasesView(
				BASES_VIEW_TYPE_PEOPLE_ATLAS,
				[
					runtime.createBasesEntry(meFile, {
						"note.person_id": "me",
						"note.name": "Me",
						"note.organisations": [],
						"note.contacts": [],
					}),
				],
				"People",
			);
			const standaloneState = standalone.view as unknown as { centerId?: string };
			const basesState = bases.view as unknown as {
				readConfiguredCenterId(state: typeof DEFAULT_VIEW_STATE): string | undefined;
			};

			expect(await plugin.updateSetting("myPersonId", "other")).toBe(true);
			runtime.triggerLayoutReady();

			expect(plugin.resolveMyPerson()?.id).toBe("other");
			expect(standaloneState.centerId).toBeUndefined();
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:People"))).toBeUndefined();
		} finally {
			await unloadPlugin(plugin);
		}
	});

	it("maps canonical My person identity to a Bases-specific visible ID by the resolved note path", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const meFile = runtime.seedFile("People/Me.md", person("me", "Me"));
		runtime.pluginData = { ...structuredClone(DEFAULT_SETTINGS), myPersonId: "me" };
		const plugin = await loadPlugin(runtime);

		try {
			const bases = await runtime.openBasesView(
				BASES_VIEW_TYPE_PEOPLE_ATLAS,
				[
					runtime.createBasesEntry(meFile, {
						"note.person_id": "me",
						"note.custom_id": "visible-me",
						"note.name": "Me",
						"note.organisations": [],
						"note.contacts": [],
					}),
				],
				"Mapped people",
			);
			const basesState = bases.view as unknown as {
				fullSnapshot: { nodes: Array<{ id: string; filePath?: string }> };
				readConfiguredCenterId(state: typeof DEFAULT_VIEW_STATE): string | undefined;
			};

			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:Mapped people"))).toBe("me");
			bases.controller.config.set(BASES_OPTION_KEYS.idProperty, "note.custom_id");
			bases.view.onDataUpdated();

			expect(basesState.fullSnapshot.nodes).toContainEqual(
				expect.objectContaining({ id: "visible-me", filePath: "People/Me.md" }),
			);
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:Mapped people"))).toBe("visible-me");
			expect(plugin.resolveMyPerson()?.id).toBe("me");

			runtime.renameFile("People/Me.md", "People/Renamed me.md");
			expect(basesState.fullSnapshot.nodes).toContainEqual(
				expect.objectContaining({ id: "visible-me", filePath: "People/Renamed me.md" }),
			);
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:Mapped people"))).toBe("visible-me");

			runtime.deleteFile("People/Renamed me.md");
			const replacementFile = runtime.createFile("People/Renamed me.md", person("replacement", "Replacement"));
			bases.controller.setEntries([
				runtime.createBasesEntry(replacementFile, {
					"note.person_id": "replacement",
					"note.custom_id": "visible-replacement",
					"note.name": "Replacement",
					"note.organisations": [],
					"note.contacts": [],
				}),
			]);
			bases.view.onDataUpdated();

			expect(plugin.resolveMyPerson()).toBeUndefined();
			expect(basesState.fullSnapshot.nodes).toContainEqual(
				expect.objectContaining({ id: "visible-replacement", filePath: "People/Renamed me.md" }),
			);
			expect(basesState.readConfiguredCenterId(plugin.getViewState("bases:Mapped people"))).toBe("visible-me");
		} finally {
			await unloadPlugin(plugin);
		}
	});

	it("keeps saved history and the navigation-only default ahead of My person", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		runtime.seedFile("People/Me.md", person("me", "Me"));
		runtime.seedFile("People/Default.md", person("default", "Default"));
		runtime.seedFile("People/History.md", person("history", "History"));
		runtime.pluginData = {
			...structuredClone(DEFAULT_SETTINGS),
			myPersonId: "me",
			defaultCenterPersonId: "default",
			viewStates: {
				standalone: {
					...structuredClone(DEFAULT_VIEW_STATE),
					centerHistory: ["history"],
				},
				"bases:History people": {
					...structuredClone(DEFAULT_VIEW_STATE),
					centerHistory: ["history"],
				},
			},
		};
		const plugin = await loadPlugin(runtime);

		try {
			const withHistory = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
			expect((withHistory.view as unknown as { centerId?: string }).centerId).toBe("history");
			await withHistory.view.unload();

			await plugin.saveViewState("standalone", structuredClone(DEFAULT_VIEW_STATE));
			await plugin.flushViewState("standalone");
			const withDefault = runtime.createStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
			expect((withDefault as unknown as { centerId?: string }).centerId).toBe("default");

			const basesWithHistory = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [], "History people");
			const basesWithDefault = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [], "Default people");
			const historyState = basesWithHistory.view as unknown as {
				readConfiguredCenterId(state: typeof DEFAULT_VIEW_STATE): string | undefined;
			};
			const defaultState = basesWithDefault.view as unknown as {
				readConfiguredCenterId(state: typeof DEFAULT_VIEW_STATE): string | undefined;
			};

			expect(historyState.readConfiguredCenterId(plugin.getViewState("bases:History people"))).toBe("history");
			expect(defaultState.readConfiguredCenterId(plugin.getViewState("bases:Default people"))).toBe("default");
			await basesWithHistory.view.unload();
			await basesWithDefault.view.unload();
		} finally {
			await unloadPlugin(plugin);
		}
	});
});
