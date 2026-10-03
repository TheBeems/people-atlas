import { afterEach, describe, expect, it, vi } from "vitest";
import type { App, PluginManifest } from "obsidian";
import PeopleAtlasPlugin from "../../src/main";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import { DEFAULT_VIEW_STATE } from "../../src/settings/view-state";
import { ControlledObsidianRuntime } from "../obsidian-stub";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.12.4",
	minAppVersion: "1.13.0",
	description: "Synthetic discovery regression",
	author: "People Atlas",
} as PluginManifest;
const cleanups: Array<() => Promise<void>> = [];
function button(container: ParentNode, text: string): HTMLButtonElement {
	const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!found) throw new Error(`Missing button: ${text}`);
	return found;
}
function widen(container: ParentNode, surface: "people" | "follow-ups") {
	const select = container.querySelector<HTMLSelectElement>(`[data-population-surface="${surface}"]`)!;
	select.value = "all";
	select.dispatchEvent(new Event("change", { bubbles: true }));
}
function graph(view: unknown): AtlasSnapshot {
	return (view as { projectedSnapshot: AtlasSnapshot }).projectedSnapshot;
}
async function load(runtime: ControlledObsidianRuntime) {
	const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
	await plugin.load();
	runtime.triggerLayoutReady();
	runtime.emitMetadata("resolved");
	cleanups.push(async () => plugin.unload());
	return plugin;
}
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("discovery and stable reopening in controlled Obsidian", () => {
	it("restores an explicit center and browse choices by stable ID after a rename", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		runtime.seedFile("People/Alice.md", { type: "person", person_id: "alice", name: "Same name", aliases: ["Elodie"] });
		runtime.seedFile("People/Bob.md", { type: "person", person_id: "bob", name: "Same name" });
		const plugin = await load(runtime);
		const writes = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
		const initial = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		button(initial.leaf.contentEl, "People").click();
		widen(initial.leaf.contentEl, "people");
		initial.leaf.contentEl.querySelector<HTMLButtonElement>('[data-node-id="alice"]')!.click();
		button(initial.leaf.contentEl, "Use as center").click();
		widen(initial.leaf.contentEl, "follow-ups");
		expect(graph(initial.view).nodes.map((node) => node.id)).toEqual(["alice"]);
		await initial.view.unload();
		initial.leaf.contentEl.style.display = "none";
		runtime.renameFile("People/Alice.md", "People/Alice renamed.md");
		const reopened = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		cleanups.push(async () => reopened.view.unload());
		expect(graph(reopened.view).nodes.map((node) => node.id)).toEqual(["alice"]);
		expect(graph(reopened.view).nodes[0]?.filePath).toBe("People/Alice renamed.md");
		expect(graph(reopened.view).nodes[0]?.isCenter).toBe(true);
		expect(button(reopened.leaf.contentEl, "People").getAttribute("aria-pressed")).toBe("true");
		expect(reopened.leaf.contentEl.querySelector<HTMLSelectElement>('[data-population-surface="people"]')?.value).toBe(
			"all",
		);
		expect(
			reopened.leaf.contentEl.querySelector<HTMLSelectElement>('[data-population-surface="follow-ups"]')?.value,
		).toBe("all");
		expect(plugin.getViewState("standalone").selectedCenterId).toBe("alice");
		expect(writes).not.toHaveBeenCalled();
	});

	it("keeps removed and duplicate remembered centers diagnostic without guessing another same-name person", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		runtime.seedFile("People/Alice.md", { type: "person", person_id: "alice", name: "Same name" });
		runtime.seedFile("People/Alice duplicate.md", { type: "person", person_id: "alice", name: "Same name" });
		runtime.seedFile("People/Bob.md", { type: "person", person_id: "bob", name: "Same name" });
		const plugin = await load(runtime);
		await plugin.saveViewState("standalone", {
			...structuredClone(DEFAULT_VIEW_STATE),
			centerMode: "selected-node",
			selectedCenterId: "alice",
			centerHistory: ["alice"],
		});
		const duplicate = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		expect(graph(duplicate.view).nodes.some((node) => node.isCenter)).toBe(false);
		expect(graph(duplicate.view).diagnostics.some((item) => item.code === "projection-center-ambiguous")).toBe(true);
		await duplicate.view.unload();
		runtime.deleteFile("People/Alice.md");
		runtime.deleteFile("People/Alice duplicate.md");
		const missing = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		cleanups.push(async () => missing.view.unload());
		expect(graph(missing.view).nodes.some((node) => node.isCenter)).toBe(false);
		expect(graph(missing.view).diagnostics.some((item) => item.code === "projection-center-unresolved")).toBe(true);
		expect(plugin.getViewState("standalone").selectedCenterId).toBe("alice");
	});

	it("shows shared follow-ups outside an ego graph while all-in-Base cannot reveal an excluded person, moment or diagnostic", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "alice",
			name: "Alice",
			aliases: ["Elodie"],
		});
		const bob = runtime.seedFile("People/Private Bob.md", {
			type: "person",
			person_id: "bob",
			name: "Private Bob",
			emails: ["invalid email"],
		});
		runtime.seedFile("People/Contact moments/Shared.md", {
			type: "contact_moment",
			contact_moment_id: "shared",
			people: ["alice", "bob"],
			occurred_on: "2026-10-01",
			follow_up_on: "2999-01-01",
			summary: "Private shared conversation",
		});
		const plugin = await load(runtime);
		await plugin.saveViewState("standalone", { ...structuredClone(DEFAULT_VIEW_STATE), centerHistory: ["alice"] });
		const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		cleanups.push(async () => standalone.view.unload());
		button(standalone.leaf.contentEl, "Follow-up").click();
		expect(standalone.leaf.contentEl.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(0);
		widen(standalone.leaf.contentEl, "follow-ups");
		expect(standalone.leaf.contentEl.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(1);
		const entry = runtime.createBasesEntry(alice, {
			"note.person_id": "alice",
			"note.name": "Alice",
			"note.aliases": ["Elodie"],
		});
		const base = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [entry], "Alice only");
		cleanups.push(async () => base.view.unload());
		button(base.parent, "Follow-up").click();
		widen(base.parent, "follow-ups");
		button(base.parent, "People").click();
		widen(base.parent, "people");
		expect(base.parent.querySelectorAll(".people-atlas-person-button")).toHaveLength(1);
		expect(base.parent.textContent).not.toContain("Private Bob");
		expect(base.parent.textContent).not.toContain("Private shared conversation");
		const full = (base.view as unknown as { fullSnapshot: AtlasSnapshot }).fullSnapshot;
		expect(full.contactMoments).toEqual([]);
		expect(full.nodes[0]?.aliases).toEqual(["Elodie"]);
		expect(JSON.stringify(full.diagnostics)).not.toContain(bob.path);
		await base.view.unload();
		cleanups.pop();
		const reopenedBase = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [entry], "Alice only");
		cleanups.push(async () => reopenedBase.view.unload());
		expect(button(reopenedBase.parent, "People").getAttribute("aria-pressed")).toBe("true");
		expect(reopenedBase.parent.querySelector<HTMLSelectElement>('[data-population-surface="people"]')?.value).toBe(
			"all",
		);
	});
});
