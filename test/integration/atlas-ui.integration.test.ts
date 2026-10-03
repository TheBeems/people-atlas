import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import type { App, PluginManifest } from "obsidian";
import PeopleAtlasPlugin from "../../src/main";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import { ControlledObsidianRuntime, setTestLanguage } from "../obsidian-stub";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Controlled UI regression tests",
	author: "People Atlas",
} as PluginManifest;

const cleanups: Array<() => Promise<void>> = [];

async function openAtlas(language = "en") {
	setTestLanguage(language);
	const runtime = new ControlledObsidianRuntime(document);
	const alice = runtime.seedFile("People/Alice.md", {
		type: "person",
		person_id: "alice",
		name: "Alice",
		contacts: ["[[Missing]]"],
	});
	runtime.seedFile("People/Bob.md", { type: "person", person_id: "bob", name: "Bob" });
	const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
	await plugin.load();
	runtime.triggerLayoutReady();
	plugin.settings = { ...plugin.settings, defaultCenterPersonId: "alice" };
	const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
	standalone.leaf.contentEl.style.height = "720px";
	standalone.leaf.contentEl.style.width = "100%";
	cleanups.push(async () => {
		await standalone.view.unload();
		await plugin.unload();
	});
	return { runtime, plugin, standalone, alice };
}

afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	setTestLanguage("en");
	document.body.replaceChildren();
	await page.viewport(800, 600);
});

function visibleDetails(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(".people-atlas-semantic-details")).filter(
		(element) => element.getBoundingClientRect().height > 0,
	);
}

describe("atlas interface consistency", () => {
	it("keeps one standalone detail surface while Bases retains its inline details and actions", async () => {
		const { runtime, standalone, alice } = await openAtlas();
		await page.getByRole("button", { name: "People", exact: true }).click();
		await page.getByRole("button", { name: "Alice", exact: true }).click();
		expect(visibleDetails(standalone.leaf.contentEl)).toHaveLength(1);
		expect(standalone.leaf.contentEl.querySelectorAll('button[data-action="log-contact"]')).toHaveLength(1);
		expect(standalone.leaf.contentEl.querySelector(".people-atlas-diagnostics")?.textContent).toContain("Missing");
		await page.getByRole("button", { name: "Network", exact: true }).click();
		expect(visibleDetails(standalone.leaf.contentEl)).toHaveLength(1);
		await page.getByRole("button", { name: "Follow-up", exact: true }).click();
		expect(visibleDetails(standalone.leaf.contentEl)).toHaveLength(1);
		expect(standalone.leaf.contentEl.querySelector('button[data-action="open"]')).not.toBeNull();

		standalone.leaf.contentEl.style.display = "none";
		const bases = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [
			runtime.createBasesEntry(alice, { "note.person_id": "alice", "note.name": "Alice" }),
		]);
		cleanups.push(async () => bases.view.unload());
		bases.parent.style.height = "500px";
		await page.getByRole("button", { name: "People", exact: true }).click();
		await page.getByRole("button", { name: "Alice", exact: true }).click();
		expect(visibleDetails(bases.parent)).toHaveLength(1);
		expect(bases.parent.querySelector('button[data-action="log-contact"]')).not.toBeNull();
	});

	it.each([
		"en",
		"nl",
	])("shows whole-network context without changing the retained center choice (%s)", async (language) => {
		const { standalone } = await openAtlas(language);
		const [center, scope] = Array.from(
			standalone.leaf.contentEl.querySelectorAll<HTMLSelectElement>(".people-atlas-toolbar select"),
		);
		if (!center || !scope) throw new Error("Expected center and scope controls.");
		expect(center.selectedOptions[0]?.textContent).toContain("Alice");
		scope.value = "free-network";
		scope.dispatchEvent(new Event("change", { bubbles: true }));
		expect(center.disabled).toBe(true);
		expect(center.value).toBe("configured");
		expect(center.selectedOptions[0]?.textContent).toBe(language === "nl" ? "Hele netwerk" : "Whole network");
		const projected = (standalone.view as unknown as { projectedSnapshot: AtlasSnapshot }).projectedSnapshot;
		expect(projected.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(["alice", "bob"]));
		expect(projected.nodes.every((node) => !node.isCenter)).toBe(true);
		scope.value = "ego";
		scope.dispatchEvent(new Event("change", { bubbles: true }));
		expect(center.disabled).toBe(false);
		expect(center.value).toBe("configured");
		expect(center.selectedOptions[0]?.textContent).toContain("Alice");
	});

	it.each([
		{ viewport: 1200, pane: 450 },
		{ viewport: 390, pane: 390 },
	])("reflows a $pane px pane inside a $viewport px viewport", async ({ viewport, pane }) => {
		await page.viewport(viewport, 844);
		const { standalone } = await openAtlas("nl");
		const container = standalone.leaf.contentEl;
		container.style.width = `${pane}px`;
		await page.getByRole("button", { name: "Personen", exact: true }).click();
		await page.getByRole("button", { name: "Alice", exact: true }).click();
		const graph = container.querySelector<HTMLElement>(".people-atlas-graph");
		const sidebar = container.querySelector<HTMLElement>(".people-atlas-sidebar");
		if (!graph || !sidebar) throw new Error("Expected graph and sidebar.");
		expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
		expect(graph.scrollWidth).toBeLessThanOrEqual(graph.clientWidth);
		expect(sidebar.getBoundingClientRect().top).toBeGreaterThanOrEqual(graph.getBoundingClientRect().bottom);
		for (const button of Array.from(container.querySelectorAll<HTMLButtonElement>(".people-atlas-view-modes button"))) {
			const box = button.getBoundingClientRect();
			expect(box.left).toBeGreaterThanOrEqual(graph.getBoundingClientRect().left);
			expect(box.right).toBeLessThanOrEqual(graph.getBoundingClientRect().right);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
	});
});
