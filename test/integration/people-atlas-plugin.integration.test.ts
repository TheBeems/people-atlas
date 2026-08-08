import { afterEach, describe, expect, it, vi } from "vitest";
import type { App, BasesOptions, PluginManifest } from "obsidian";
import PeopleAtlasPlugin from "../../src/main";
import { PeopleAtlasView } from "../../src/view/people-atlas-view";
import { PeopleAtlasBasesView } from "../../src/bases/people-atlas-bases-view";
import { BASES_OPTION_KEYS } from "../../src/bases/options";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import { RelationshipModal } from "../../src/editor/relationship-modal";
import { type Component, ControlledObsidianRuntime, TFile, type ControlledBasesEntry } from "../obsidian-stub";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Controlled integration manifest",
	author: "People Atlas",
} as PluginManifest;

function person(id: string, name: string, contacts: string[] = []): Record<string, unknown> {
	return {
		type: "person",
		person_id: id,
		name,
		contacts,
	};
}

function relationship(
	id: string,
	from: string,
	to: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		type: "relationship",
		relationship_id: id,
		from,
		to,
		relationship_types: ["friend"],
		direction: "source-to-target",
		closeness: 4,
		since: "2020-01-02",
		last_contact: "2026-07-20",
		status: "active",
		...overrides,
	};
}

function basesEntry(
	runtime: ControlledObsidianRuntime,
	file: Parameters<ControlledObsidianRuntime["createBasesEntry"]>[0],
	id: string,
	name: string,
	contacts: string[] = [],
): ControlledBasesEntry {
	return runtime.createBasesEntry(file, {
		"note.person_id": id,
		"note.name": name,
		"note.organisations": [],
		"note.contacts": contacts,
	});
}

function fullSnapshot(view: unknown): AtlasSnapshot {
	const snapshot = (view as { fullSnapshot?: AtlasSnapshot }).fullSnapshot;
	if (!snapshot) throw new Error("The production view has not published a full snapshot.");
	return snapshot;
}

function stableNodeIds(container: ParentNode): string[] {
	return Array.from(container.querySelectorAll<HTMLElement>(".people-atlas-person-button"))
		.map((element) => element.dataset.nodeId)
		.filter((id): id is string => id !== undefined)
		.sort();
}

function openStableNode(container: ParentNode, id: string): void {
	const node = Array.from(container.querySelectorAll<HTMLButtonElement>(".people-atlas-person-button")).find(
		(button) => button.dataset.nodeId === id,
	);
	if (!node) throw new Error(`The production semantic surface has no node ${id}.`);
	node.click();
	const open = container.querySelector<HTMLButtonElement>(".people-atlas-semantic-details button[data-action='open']");
	if (!open) throw new Error(`The production semantic surface has no Open note action for ${id}.`);
	open.click();
}

function createRelationshipFromStableNode(container: ParentNode, id: string, actionLabel: string): void {
	const node = Array.from(container.querySelectorAll<HTMLButtonElement>(".people-atlas-person-button")).find(
		(button) => button.dataset.nodeId === id,
	);
	if (!node) throw new Error(`The production semantic surface has no node ${id}.`);
	node.click();
	const create = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
		(button) => button.textContent === actionLabel,
	);
	if (!create) throw new Error(`The production surface has no ${actionLabel} action for ${id}.`);
	create.click();
}

async function waitForObservation(observation: () => boolean, message: string, timeoutMs = 1_000): Promise<void> {
	const deadline = performance.now() + timeoutMs;
	while (!observation()) {
		if (performance.now() >= deadline) throw new Error(message);
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
	}
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("controlled People Atlas Obsidian integration", () => {
	it("drives registered plugin, index, standalone and Bases lifecycles through targeted events and teardown", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const unresolvedCarol = "[[People/Carol|Shared person]]";
		const aliceFile = runtime.seedFile("People/Alice.md", person("alice", "Shared person", [unresolvedCarol]));
		const bobFile = runtime.seedFile("People/Bob.md", person("bob", "Different person"));
		runtime.seedFile("Relationships/Alice-Bob.md", relationship("rel-alice-bob", "alice", "bob"));
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const pluginComponent = plugin as unknown as Component;

		await pluginComponent.load();

		expect(runtime.viewRegistrations.has(VIEW_TYPE_PEOPLE_ATLAS)).toBe(true);
		expect(runtime.basesRegistrations.has(BASES_VIEW_TYPE_PEOPLE_ATLAS)).toBe(true);
		const basesOptions = (runtime.basesRegistrations.get(BASES_VIEW_TYPE_PEOPLE_ATLAS)?.options() ??
			[]) as BasesOptions[];
		expect(basesOptions.map((option) => option.key).sort()).toEqual(Object.values(BASES_OPTION_KEYS).sort());
		for (const key of [
			BASES_OPTION_KEYS.birthDateProperty,
			BASES_OPTION_KEYS.pronounsProperty,
			BASES_OPTION_KEYS.genderProperty,
			BASES_OPTION_KEYS.emailsProperty,
			BASES_OPTION_KEYS.phonesProperty,
			BASES_OPTION_KEYS.jobTitleProperty,
		]) {
			expect(basesOptions.find((option) => option.key === key)).toMatchObject({ type: "property", key });
		}
		expect(basesOptions.find((option) => option.key === BASES_OPTION_KEYS.contactsProperty)).toMatchObject({
			type: "property",
			displayName: "Linked people property",
		});
		expect(runtime.commands.size).toBe(9);
		expect([...runtime.commands.values()].map((command) => command.name)).toEqual([
			"Open atlas",
			"Open follow-ups",
			"Create person",
			"Edit current person",
			"Create relationship",
			"Edit current relationship",
			"Log contact",
			"Edit current contact moment",
			"Rebuild People Atlas index",
		]);
		expect(
			[...runtime.commands.values()].every(
				(command) => !command.name.includes("People Atlas") || command.id === "rebuild-index",
			),
		).toBe(true);
		expect(runtime.ribbonItems.size).toBe(1);
		expect(runtime.settingTabs.size).toBe(1);
		expect(runtime.editorSuggests.size).toBe(1);
		expect(runtime.workspace.pendingLayoutReadyCount).toBe(1);
		expect(runtime.vault.markdownScanCount).toBe(0);
		expect(plugin.index.getSnapshot()).toEqual({
			people: [],
			relationships: [],
			contactMoments: [],
			diagnostics: [],
		});

		runtime.triggerLayoutReady();

		expect(runtime.vault.markdownScanCount).toBe(1);
		expect(pluginComponent.childCount).toBe(1);
		expect((plugin.index as unknown as Component).isLoaded()).toBe(true);
		expect(runtime.listenerCount("vault")).toBe(4);
		expect(runtime.listenerCount("metadataCache")).toBe(3);
		expect(plugin.index.getSnapshot().people.map((record) => record.id)).toEqual(["alice", "bob"]);
		expect(plugin.index.getSnapshot().relationships).toEqual([
			expect.objectContaining({
				id: "rel-alice-bob",
				filePath: "Relationships/Alice-Bob.md",
				types: ["friend"],
				closeness: 4,
				since: "2020-01-02",
				lastContact: "2026-07-20",
				status: "active",
			}),
		]);
		expect(plugin.index.getSnapshot().relationships[0]).not.toHaveProperty("direction");
		expect(
			(plugin.index.getSnapshot().diagnostics ?? []).some((diagnostic) => diagnostic.code.includes("direction")),
		).toBe(false);

		const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		const aliceEntry = basesEntry(runtime, aliceFile, "alice", "Shared person", [unresolvedCarol]);
		const bobEntry = basesEntry(runtime, bobFile, "bob", "Different person");
		const bases = await runtime.openBasesView(
			BASES_VIEW_TYPE_PEOPLE_ATLAS,
			[aliceEntry, bobEntry],
			"People integration",
		);

		expect(standalone.view).toBeInstanceOf(PeopleAtlasView);
		expect(bases.view).toBeInstanceOf(PeopleAtlasBasesView);
		expect(stableNodeIds(standalone.leaf.contentEl)).toEqual(expect.arrayContaining(["alice", "bob"]));
		expect(stableNodeIds(bases.parent)).toEqual(expect.arrayContaining(["alice", "bob"]));
		plugin.settings = { ...plugin.settings, myPersonId: "alice" };
		const openRelationshipModal = vi.spyOn(RelationshipModal.prototype, "open").mockImplementation(() => undefined);
		createRelationshipFromStableNode(standalone.leaf.contentEl, "bob", "Create relationship");
		createRelationshipFromStableNode(bases.parent, "bob", "Create relationship with Different person");
		expect(openRelationshipModal).toHaveBeenCalledTimes(2);
		for (const modal of openRelationshipModal.mock.instances as unknown as Array<{
			values: { fromPath: string; toPath: string };
		}>) {
			expect(modal.values).toMatchObject({
				fromPath: "People/Alice.md",
				toPath: "People/Bob.md",
			});
		}
		openRelationshipModal.mockRestore();
		plugin.settings = { ...plugin.settings, myPersonId: "" };
		for (const snapshot of [fullSnapshot(standalone.view), fullSnapshot(bases.view)]) {
			expect(snapshot.nodes.filter((node) => node.kind === "ghost")).toEqual([
				expect.objectContaining({ label: "Shared person" }),
			]);
			expect(snapshot.diagnostics.some((diagnostic) => diagnostic.code === "unresolved-contact")).toBe(true);
			expect(snapshot.edges.find((edge) => edge.id === "rel-alice-bob")).toEqual(
				expect.objectContaining({
					sourceId: "alice",
					targetId: "bob",
					status: "active",
					inferred: false,
				}),
			);
		}
		expect(runtime.listenerCount("workspace", "active-leaf-change")).toBe(2);

		runtime.createFile(
			"Relationships/Alice-Carol.md",
			relationship("rel-alice-carol", "alice", unresolvedCarol, {
				relationship_types: ["mentor"],
				status: "dormant",
			}),
		);
		expect(plugin.index.getSnapshot().relationships.map((record) => record.id)).toEqual([
			"rel-alice-bob",
			"rel-alice-carol",
		]);
		for (const snapshot of [fullSnapshot(standalone.view), fullSnapshot(bases.view)]) {
			expect(snapshot.edges.some((edge) => edge.id === "rel-alice-carol")).toBe(false);
			expect(snapshot.nodes.some((node) => node.kind === "ghost" && node.label === "Shared person")).toBe(true);
			expect(snapshot.diagnostics.some((diagnostic) => diagnostic.code === "unresolved-relationship-endpoint")).toBe(
				true,
			);
		}

		runtime.createFile("People/Shared-name-decoy.md", person("decoy", "Shared person"));
		expect(
			plugin.index
				.getSnapshot()
				.people.map((record) => record.id)
				.sort(),
		).toEqual(["alice", "bob", "decoy"]);
		expect(fullSnapshot(standalone.view).nodes.filter((node) => node.label === "Shared person")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "alice", kind: "person" }),
				expect.objectContaining({ id: "decoy", kind: "person" }),
				expect.objectContaining({ kind: "ghost" }),
			]),
		);
		expect(fullSnapshot(standalone.view).edges.some((edge) => edge.id === "rel-alice-carol")).toBe(false);
		expect(
			fullSnapshot(standalone.view).diagnostics.some(
				(diagnostic) => diagnostic.code === "unresolved-relationship-endpoint",
			),
		).toBe(true);

		const carolFile = runtime.createFile("People/Carol.md", person("carol", "Shared person"));
		expect(stableNodeIds(standalone.leaf.contentEl)).toEqual(
			expect.arrayContaining(["alice", "bob", "carol", "decoy"]),
		);
		expect(stableNodeIds(bases.parent)).toEqual(expect.arrayContaining(["alice", "bob"]));
		expect(
			fullSnapshot(standalone.view).nodes.some((node) => node.kind === "ghost" && node.label === "Shared person"),
		).toBe(true);
		expect(fullSnapshot(standalone.view).edges.some((edge) => edge.id === "rel-alice-carol")).toBe(false);
		expect(
			fullSnapshot(standalone.view).diagnostics.some(
				(diagnostic) => diagnostic.code === "unresolved-relationship-endpoint",
			),
		).toBe(true);
		expect(runtime.vault.markdownScanCount).toBe(1);

		runtime.changeMetadata(
			"Relationships/Alice-Bob.md",
			relationship("rel-alice-bob", "alice", "bob", {
				relationship_types: ["colleague", "neighbour"],
				closeness: 2,
				last_contact: "2026-07-25",
				status: "ended",
			}),
		);
		for (const snapshot of [fullSnapshot(standalone.view), fullSnapshot(bases.view)]) {
			expect(snapshot.edges.find((edge) => edge.id === "rel-alice-bob")).toEqual(
				expect.objectContaining({
					types: ["colleague", "neighbour"],
					closeness: 2,
					lastContact: "2026-07-25",
					status: "ended",
				}),
			);
		}

		runtime.resolveLink("People/Alice.md", "People/Carol", carolFile.path);
		runtime.resolveLink("Relationships/Alice-Carol.md", "People/Carol", carolFile.path);
		const standaloneResolved = fullSnapshot(standalone.view);
		const resolvedRelationship = standaloneResolved.edges.find((edge) => edge.id === "rel-alice-carol");
		expect(resolvedRelationship).toEqual(
			expect.objectContaining({
				sourceId: "alice",
				targetId: "carol",
				inferred: false,
			}),
		);
		expect(resolvedRelationship?.targetId).not.toBe("decoy");
		expect(
			standaloneResolved.edges.some((edge) => edge.inferred && edge.sourceId === "alice" && edge.targetId === "carol"),
		).toBe(true);
		expect(standaloneResolved.nodes.some((node) => node.kind === "ghost")).toBe(false);
		expect(
			fullSnapshot(standalone.view).diagnostics.some(
				(diagnostic) => diagnostic.code === "unresolved-relationship-endpoint",
			),
		).toBe(false);
		expect(fullSnapshot(bases.view).edges.map((edge) => edge.id)).toEqual(["rel-alice-bob"]);
		expect(fullSnapshot(bases.view).nodes.some((node) => node.kind === "ghost")).toBe(false);
		expect(fullSnapshot(bases.view).hiddenNodeCount).toBe(2);
		expect(fullSnapshot(bases.view).hiddenEdgeCount).toBe(2);
		expect(fullSnapshot(bases.view).diagnostics.some((diagnostic) => diagnostic.code === "filtered-endpoint")).toBe(
			true,
		);

		await plugin.mutations.updatePerson(
			bobFile as unknown as import("obsidian").TFile,
			{ name: "Robert" },
			{ targetPath: "People/Robert.md" },
		);
		expect(plugin.index.getPeoplePathsById("bob")).toEqual(["People/Robert.md"]);
		expect(fullSnapshot(standalone.view).nodes.find((node) => node.id === "bob")?.filePath).toBe("People/Robert.md");
		expect(fullSnapshot(bases.view).nodes.find((node) => node.id === "bob")?.filePath).toBe("People/Robert.md");
		expect(fullSnapshot(standalone.view).nodes.some((node) => node.filePath === "People/Bob.md")).toBe(false);
		expect(fullSnapshot(bases.view).nodes.some((node) => node.filePath === "People/Bob.md")).toBe(false);
		openStableNode(standalone.leaf.contentEl, "bob");
		openStableNode(bases.parent, "bob");
		expect(runtime.openedPaths.slice(-2)).toEqual(["People/Robert.md", "People/Robert.md"]);

		runtime.deleteFile("Relationships/Alice-Carol.md");
		expect(plugin.index.getSnapshot().relationships.map((record) => record.id)).toEqual(["rel-alice-bob"]);
		expect(
			fullSnapshot(standalone.view)
				.edges.filter((edge) => !edge.inferred)
				.map((edge) => edge.id),
		).toEqual(["rel-alice-bob"]);
		expect(fullSnapshot(bases.view).edges.map((edge) => edge.id)).toEqual(["rel-alice-bob"]);

		runtime.createFile("People/Non-Markdown-decoy.png", person("ignored", "Shared person"));
		expect(
			plugin.index
				.getSnapshot()
				.people.map((record) => record.id)
				.sort(),
		).toEqual(["alice", "bob", "carol", "decoy"]);
		expect(runtime.vault.markdownScanCount).toBe(1);

		bases.controller.setEntries([aliceEntry]);
		bases.view.onDataUpdated();
		expect(stableNodeIds(bases.parent)).toEqual(["alice"]);
		expect(stableNodeIds(standalone.leaf.contentEl)).toEqual(["alice", "bob", "carol", "decoy"]);
		expect(plugin.index.getSnapshot().relationships.map((record) => record.id)).toEqual(["rel-alice-bob"]);
		expect(fullSnapshot(bases.view).edges).toEqual([]);
		expect(fullSnapshot(bases.view).hiddenNodeCount).toBe(3);
		expect(fullSnapshot(bases.view).hiddenEdgeCount).toBe(2);
		expect(fullSnapshot(bases.view).diagnostics.some((diagnostic) => diagnostic.code === "filtered-endpoint")).toBe(
			true,
		);

		const savesBeforeClose = runtime.savedPluginData.length;
		const standaloneSnapshotAtClose = fullSnapshot(standalone.view);
		await standalone.view.unload();
		expect(standalone.leaf.contentEl.querySelector(".people-atlas-renderer")).toBeNull();
		expect(standalone.view.registeredEventCount).toBe(0);
		expect(runtime.listenerCount("workspace", "active-leaf-change")).toBe(1);
		expect(runtime.savedPluginData.length).toBeGreaterThan(savesBeforeClose);

		const basesBeforeStandalonePostCloseEvent = fullSnapshot(bases.view);
		runtime.createFile(
			"Relationships/After-Standalone-Close.md",
			relationship("rel-after-standalone-close", "alice", "bob"),
		);
		expect(fullSnapshot(standalone.view)).toBe(standaloneSnapshotAtClose);
		expect(fullSnapshot(bases.view)).not.toBe(basesBeforeStandalonePostCloseEvent);
		expect(plugin.index.getSnapshot().relationships.some((record) => record.id === "rel-after-standalone-close")).toBe(
			true,
		);

		const basesSnapshotAtClose = fullSnapshot(bases.view);
		const savesBeforeBasesClose = runtime.savedPluginData.length;
		await bases.view.unload();
		await waitForObservation(
			() => runtime.savedPluginData.length > savesBeforeBasesClose,
			"The Bases production unload did not complete its asynchronous view-state flush.",
		);
		expect(bases.parent.childElementCount).toBe(0);
		expect(bases.view.registeredEventCount).toBe(0);
		expect(runtime.listenerCount("workspace", "active-leaf-change")).toBe(0);
		expect((runtime.savedPluginData.at(-1) as { viewStates?: Record<string, unknown> })?.viewStates).toHaveProperty(
			"bases:People integration",
		);

		runtime.changeMetadata(
			"Relationships/After-Standalone-Close.md",
			relationship("rel-after-standalone-close", "alice", "bob", { status: "ended" }),
		);
		expect(
			plugin.index.getSnapshot().relationships.find((record) => record.id === "rel-after-standalone-close")?.status,
		).toBe("ended");
		expect(fullSnapshot(bases.view)).toBe(basesSnapshotAtClose);

		await pluginComponent.unload();
		expect(pluginComponent.childCount).toBe(0);
		expect(pluginComponent.registeredEventCount).toBe(0);
		expect((plugin.index as unknown as Component).isLoaded()).toBe(false);
		expect(runtime.listenerCount("vault")).toBe(0);
		expect(runtime.listenerCount("metadataCache")).toBe(0);
		expect(runtime.listenerCount("workspace")).toBe(0);
		expect(runtime.viewRegistrations.size).toBe(0);
		expect(runtime.basesRegistrations.size).toBe(0);
		expect(runtime.commands.size).toBe(0);
		expect(runtime.ribbonItems.size).toBe(0);
		expect(runtime.settingTabs.size).toBe(0);
		expect(runtime.editorSuggests.size).toBe(0);
		expect(plugin.index.getSnapshot()).toEqual({
			people: [],
			relationships: [],
			contactMoments: [],
			diagnostics: [],
		});

		const scanCountAfterTeardown = runtime.vault.markdownScanCount;
		const savesAfterTeardown = runtime.savedPluginData.length;
		const outputAfterTeardown = document.body.textContent;
		runtime.emitVault("create", new TFile("People/Late.md"));
		runtime.emitMetadata("changed", aliceFile);
		runtime.emitMetadata("resolve", carolFile);
		runtime.workspace.setActiveFile(aliceFile);
		runtime.triggerLayoutReady();
		await Promise.resolve();

		expect(runtime.vault.markdownScanCount).toBe(scanCountAfterTeardown);
		expect(runtime.savedPluginData.length).toBe(savesAfterTeardown);
		expect(document.body.textContent).toBe(outputAfterTeardown);
		expect(plugin.index.getSnapshot()).toEqual({
			people: [],
			relationships: [],
			contactMoments: [],
			diagnostics: [],
		});
	});

	it("does not attach or scan the index when the plugin unloads before layout is ready", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const pluginComponent = plugin as unknown as Component;

		await pluginComponent.load();
		expect(runtime.workspace.pendingLayoutReadyCount).toBe(1);
		await pluginComponent.unload();

		runtime.triggerLayoutReady();

		expect(pluginComponent.childCount).toBe(0);
		expect(runtime.vault.markdownScanCount).toBe(0);
		expect((plugin.index as unknown as Component).isLoaded()).toBe(false);
	});

	it("executes the stored rebuild-index callback without consuming a pending readiness retry", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const pluginComponent = plugin as unknown as Component;

		await pluginComponent.load();
		runtime.triggerLayoutReady();
		expect(runtime.vault.markdownScanCount).toBe(1);

		const rebuildCommand = runtime.commands.get("rebuild-index");
		if (!rebuildCommand) throw new Error("Expected the stored rebuild-index command callback.");
		if (!rebuildCommand.callback) throw new Error("Expected a callable rebuild-index command callback.");
		rebuildCommand.callback();
		expect(runtime.vault.markdownScanCount).toBe(2);
		expect(plugin.index.getSnapshot().people).toEqual([]);

		runtime.seedFile("People/Alice.md", person("alice", "Alice"));
		runtime.emitMetadata("resolved");
		expect(runtime.vault.markdownScanCount).toBe(3);
		expect(plugin.index.getPeoplePathsById("alice")).toEqual(["People/Alice.md"]);

		runtime.emitMetadata("resolved");
		expect(runtime.vault.markdownScanCount).toBe(3);

		await pluginComponent.unload();
	});
});
