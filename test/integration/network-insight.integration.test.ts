import { afterEach, describe, expect, it, vi } from "vitest";
import type { App, PluginManifest } from "obsidian";
import PeopleAtlasPlugin from "../../src/main";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import { relationshipContactCadence } from "../../src/graph/relationship-periods";
import { DEFAULT_VIEW_STATE } from "../../src/settings/view-state";
import { ControlledObsidianRuntime } from "../obsidian-stub";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.12.4",
	minAppVersion: "1.13.0",
	description: "Synthetic network regression",
	author: "People Atlas",
} as PluginManifest;
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});
function select(container: ParentNode, label: string, value: string) {
	const control = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
	control.value = value;
	control.dispatchEvent(new Event("change", { bubbles: true }));
}
function setDate(container: ParentNode, value: string) {
	const control = container.querySelector<HTMLInputElement>('input[aria-label="Relationships on date"]')!;
	control.value = value;
	control.dispatchEvent(new Event("change", { bubbles: true }));
}
function button(container: ParentNode, text: string): HTMLButtonElement {
	const candidate = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
		(item) => item.textContent === text,
	);
	if (!candidate) throw new Error(`Missing button: ${text}`);
	return candidate;
}
async function load(runtime: ControlledObsidianRuntime) {
	const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
	await plugin.load();
	runtime.triggerLayoutReady();
	runtime.emitMetadata("resolved");
	cleanups.push(async () => plugin.unload());
	return plugin;
}
function graph(view: unknown): AtlasSnapshot {
	return (view as { projectedSnapshot: AtlasSnapshot }).projectedSnapshot;
}

describe("network insight in the controlled host", () => {
	it("persists explicit family/date choices, shows ID-selected results and retains observations in a dated full network", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		runtime.seedFile("People/A.md", { type: "person", person_id: "a", name: "A" });
		runtime.seedFile("People/B.md", { type: "person", person_id: "b", name: "B", contacts: ["c"] });
		runtime.seedFile("People/C.md", { type: "person", person_id: "c", name: "C" });
		runtime.seedFile("People/Relationships/AB.md", {
			type: "relationship",
			relationship_id: "ab",
			from: "a",
			to: "b",
			from_role: "parent",
			to_role: "child",
			since: "2024-02-29",
			until: "2024-03-01",
			contact_interval_days: 30,
		});
		runtime.seedFile("People/Contact moments/AB.md", {
			type: "contact_moment",
			contact_moment_id: "m",
			people: ["a", "b"],
			relationship: "ab",
			occurred_on: "2024-03-01",
		});
		const plugin = await load(runtime);
		const writes = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
		await plugin.saveViewState("standalone", {
			...structuredClone(DEFAULT_VIEW_STATE),
			centerMode: "none",
			projectionMode: "free-network",
		});
		const opened = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		select(opened.leaf.contentEl, "Layout", "family");
		setDate(opened.leaf.contentEl, "2024-03-01");
		button(opened.leaf.contentEl, "People").click();
		opened.leaf.contentEl.querySelector<HTMLButtonElement>('[data-node-id="a"]')!.click();
		select(opened.leaf.contentEl, "Compare selected person with", "c");
		expect(opened.leaf.contentEl.querySelectorAll("[data-network-results] ol li")).toHaveLength(2);
		const renderer = (
			opened.view as unknown as { renderer: { getLayoutSnapshot(): { positions: Record<string, { y: number }> } } }
		).renderer;
		expect(renderer.getLayoutSnapshot().positions.a?.y).toBeLessThan(renderer.getLayoutSnapshot().positions.b?.y ?? -1);
		setDate(opened.leaf.contentEl, "2024-03-02");
		expect(graph(opened.view).edges.map((edge) => edge.id)).not.toContain("ab");
		expect(graph(opened.view).contactMoments.map((moment) => moment.id)).toContain("m");
		expect(opened.leaf.contentEl.querySelector("[data-network-results]")?.textContent).toContain(
			"No connection path exists",
		);
		await opened.view.unload();
		const reopened = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		cleanups.push(async () => reopened.view.unload());
		expect(reopened.leaf.contentEl.querySelector<HTMLSelectElement>('select[aria-label="Layout"]')?.value).toBe(
			"family",
		);
		expect(
			reopened.leaf.contentEl.querySelector<HTMLInputElement>('input[aria-label="Relationships on date"]')?.value,
		).toBe("2024-03-02");
		expect(plugin.getViewState("standalone")).toMatchObject({ layoutMode: "family", relationshipDate: "2024-03-02" });
		expect(writes).not.toHaveBeenCalled();
	});

	it("filters periods before standalone and Bases ego membership and hides observations with omitted participants", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const a = runtime.seedFile("People/A.md", { type: "person", person_id: "a", name: "A" });
		const b = runtime.seedFile("People/B.md", { type: "person", person_id: "b", name: "B", contacts: ["c"] });
		const c = runtime.seedFile("People/C.md", { type: "person", person_id: "c", name: "C" });
		runtime.seedFile("People/Relationships/AB.md", {
			type: "relationship",
			relationship_id: "ab",
			from: "a",
			to: "b",
			until: "2024-03-01",
		});
		runtime.seedFile("People/Contact moments/AB.md", {
			type: "contact_moment",
			contact_moment_id: "m",
			people: ["a", "b"],
			relationship: "ab",
			occurred_on: "2024-03-01",
		});
		const plugin = await load(runtime);
		await plugin.saveViewState("standalone", {
			...structuredClone(DEFAULT_VIEW_STATE),
			centerMode: "configured",
			centerHistory: ["a"],
			projectionMode: "ego",
			relationshipDate: "2024-03-02",
		});
		const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		cleanups.push(async () => standalone.view.unload());
		expect(graph(standalone.view).nodes.map((node) => node.id)).toEqual(["a"]);
		expect(graph(standalone.view).contactMoments).toEqual([]);
		const entries = [a, b, c].map((file) =>
			runtime.createBasesEntry(file, { "note.person_id": file.basename.toLowerCase(), "note.name": file.basename }),
		);
		const base = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, entries, "Historical ego");
		cleanups.push(async () => base.view.unload());
		base.controller.config.set("centerPersonId", "a");
		base.controller.config.set("centerMode", "configured");
		base.controller.config.set("projectionMode", "ego");
		base.controller.config.set("hops", 2);
		base.controller.config.set("relationshipDate", "2024-03-02");
		(base.view as unknown as { onDataUpdated(): void }).onDataUpdated();
		const baseRenderer = (base.view as unknown as { renderer: { getPersonSnapshot(): AtlasSnapshot } }).renderer;
		expect(baseRenderer.getPersonSnapshot().nodes.map((node) => node.id)).toEqual(["a"]);
		expect(baseRenderer.getPersonSnapshot().contactMoments).toEqual([]);
	});

	it("keeps all-in-Base insight and cadence behind the admitted population and canonical ambiguity", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const a = runtime.seedFile("People/A.md", { type: "person", person_id: "a", name: "A" });
		const c = runtime.seedFile("People/C.md", { type: "person", person_id: "c", name: "C" });
		runtime.seedFile("Private/Hidden.md", { type: "person", person_id: "hidden", name: "Hidden person" });
		runtime.seedFile("People/Relationships/Visible.md", {
			type: "relationship",
			relationship_id: "duplicate",
			from: "a",
			to: "c",
			last_contact: "2024-02-01",
			contact_interval_days: 1,
		});
		runtime.seedFile("Private/Hidden relationship.md", {
			type: "relationship",
			relationship_id: "duplicate",
			from: "a",
			to: "hidden",
			last_contact: "2024-02-01",
			contact_interval_days: 1,
		});
		await load(runtime);
		const entries = [a, c].map((file) =>
			runtime.createBasesEntry(file, { "note.person_id": file.basename.toLowerCase(), "note.name": file.basename }),
		);
		const base = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, entries, "Admitted people");
		cleanups.push(async () => base.view.unload());
		const openDiagnostics = vi
			.spyOn((base.view as unknown as { plugin: PeopleAtlasPlugin }).plugin, "openDiagnostics")
			.mockImplementation(() => undefined);
		base.parent.querySelector<HTMLButtonElement>(".people-atlas-base-diagnostics")!.click();
		expect(openDiagnostics).toHaveBeenCalledOnce();
		const [reviewedDiagnostics, sources] = openDiagnostics.mock.calls[0] ?? [];
		expect(reviewedDiagnostics?.some((diagnostic) => diagnostic.code === "duplicate-relationship-id")).toBe(true);
		expect(Array.from(sources ?? [])).not.toContain("Private/Hidden relationship.md");
		expect(Array.from(sources ?? [])).not.toContain("Private/Hidden.md");
		expect(JSON.stringify(reviewedDiagnostics)).not.toContain("Private/");
		button(base.parent, "People").click();
		const scope = base.parent.querySelector<HTMLSelectElement>('[data-population-surface="people"]')!;
		scope.value = "all";
		scope.dispatchEvent(new Event("change", { bubbles: true }));
		base.parent.querySelector<HTMLButtonElement>('[data-node-id="a"]')!.click();
		const compare = base.parent.querySelector<HTMLSelectElement>("[data-network-counterpart]")!;
		expect(Array.from(compare.options).map((option) => option.value)).not.toContain("hidden");
		expect(base.parent.textContent).not.toContain("Hidden person");
		const full = (base.view as unknown as { fullSnapshot: AtlasSnapshot }).fullSnapshot;
		expect(relationshipContactCadence(full, "2024-03-02")).toEqual([]);
		expect(JSON.stringify(full.diagnostics)).not.toContain("Private/Hidden relationship.md");
	});
});
