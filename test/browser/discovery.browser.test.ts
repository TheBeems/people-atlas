import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { AtlasNode, AtlasSnapshot, ContactMomentSummary } from "../../src/domain/types";
import { projectGraph } from "../../src/graph/project-graph";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { createTranslator } from "../../src/i18n";
import "../../styles.css";

const renderers: AtlasRenderer[] = [];
function person(index: number): AtlasNode {
	const id = `person-${String(index).padStart(3, "0")}`;
	return {
		id,
		personId: id,
		kind: "person",
		label: "Duplicate name",
		filePath: `People/${id}.md`,
		aliases: [`alias-${index}`],
		organisations: [],
		emails: [`${index}@example.com`],
		phones: ["+31 6 1234 5678"],
		isCenter: false,
	};
}
function snapshot(nodes: AtlasNode[], contactMoments: ContactMomentSummary[] = []): AtlasSnapshot {
	return {
		nodes,
		edges: [],
		contactMoments,
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount: 0,
		generatedAt: 1,
	};
}
function mount(graph: AtlasSnapshot, permitted: AtlasSnapshot, initialState = {}) {
	const container = document.createElement("div");
	container.className = "people-atlas-graph";
	container.style.width = "350px";
	container.style.height = "600px";
	document.body.append(container);
	const callbacks = {
		onOpenNode: vi.fn(),
		onCenterNode: vi.fn(),
		onSelectNode: vi.fn(),
		onLayoutChanged: vi.fn(),
		canEditPerson: () => true,
		onEditPerson: vi.fn(),
		canCreateRelationship: () => true,
		onCreateRelationship: vi.fn(),
		canLogContact: () => true,
		onLogContact: vi.fn(),
		onBrowseStateChanged: vi.fn(),
		canOpenContactMoment: () => true,
		onOpenContactMoment: vi.fn(),
	};
	const renderer = new AtlasRenderer(
		container,
		() => DEFAULT_SETTINGS,
		callbacks as AtlasRendererCallbacks,
		createTranslator("en"),
		{ initialState },
	);
	renderer.setGraph(graph, undefined, permitted);
	renderers.push(renderer);
	return { container, renderer, callbacks };
}
function widen(container: HTMLElement, surface: "people" | "follow-ups") {
	const select = container.querySelector<HTMLSelectElement>(`select[data-population-surface="${surface}"]`)!;
	select.value = "all";
	select.dispatchEvent(new Event("change", { bubbles: true }));
	return select;
}
afterEach(() => {
	for (const renderer of renderers.splice(0)) renderer.destroy();
	document.body.replaceChildren();
});

describe("explicit discovery populations", () => {
	it("finds and acts on a person beyond 500 only after widening, without changing center or camera", async () => {
		const permitted = snapshot(Array.from({ length: 503 }, (_, index) => person(index)));
		const graph = projectGraph(permitted, { projectionMode: "free-network", maxNodes: 500 });
		const { container, renderer, callbacks } = mount(graph, permitted);
		const before = renderer.getLayoutSnapshot();
		await page.getByRole("button", { name: "People", exact: true }).click();
		await page.getByRole("searchbox").fill("alias-502");
		expect(container.querySelectorAll(".people-atlas-person-button")).toHaveLength(0);
		widen(container, "people");
		const result = container.querySelector<HTMLButtonElement>('[data-node-id="person-502"]')!;
		result.click();
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: "person-502", filePath: "People/person-502.md" }),
			"list",
		);
		await page.getByRole("button", { name: "Edit person", exact: true }).click();
		expect(callbacks.onEditPerson).toHaveBeenCalledWith(expect.objectContaining({ id: "person-502" }));
		const selectedResult = container.querySelector<HTMLButtonElement>('[data-node-id="person-502"]')!;
		selectedResult.focus();
		selectedResult.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(callbacks.onOpenNode).toHaveBeenCalledWith(expect.objectContaining({ id: "person-502" }));
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();
		expect(callbacks.onLayoutChanged).not.toHaveBeenCalled();
		expect(renderer.getLayoutSnapshot()).toEqual(before);
		renderer.setGraph(graph, before, permitted);
		expect(document.activeElement?.getAttribute("data-node-id")).toBe("person-502");
		expect(container.querySelector('[data-node-id="person-502"]')?.getAttribute("aria-pressed")).toBe("true");
		expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
		await page.getByRole("searchbox").fill("example.com");
		expect(container.querySelectorAll(".people-atlas-person-button")).toHaveLength(503);
	});

	it("uses independent follow-up scope for a shared moment outside the ego graph", async () => {
		const alice = person(0);
		const bob = person(1);
		const moment: ContactMomentSummary = {
			id: "shared",
			filePath: "Moments/Shared.md",
			personIds: [alice.id, bob.id],
			occurredOn: "2026-10-01",
			followUpOn: "2999-01-01",
			summary: "Shared follow-up",
		};
		const permitted = snapshot([alice, bob], [moment]);
		const graph = projectGraph(permitted, { centerMode: "configured", centerId: alice.id, hops: 1 });
		const { container, renderer, callbacks } = mount(graph, permitted);
		await page.getByRole("button", { name: "Follow-up", exact: true }).click();
		expect(container.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(0);
		widen(container, "follow-ups");
		expect(container.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(1);
		expect(renderer.getBrowseState()).toEqual({
			rendererMode: "follow-ups",
			peopleScope: "current",
			followUpScope: "all",
		});
		await page.getByRole("button", { name: /Open contact moment/ }).click();
		expect(callbacks.onOpenContactMoment).toHaveBeenCalledWith(moment, expect.any(HTMLButtonElement));
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();
	});

	it("restores optional browse state without persistence or selection side effects", () => {
		const permitted = snapshot([person(0), person(1)]);
		const { renderer, container, callbacks } = mount(snapshot([person(0)]), permitted, {
			rendererMode: "list",
			peopleScope: "all",
			followUpScope: "all",
		});
		expect(renderer.getBrowseState()).toEqual({ rendererMode: "list", peopleScope: "all", followUpScope: "all" });
		expect(container.querySelectorAll(".people-atlas-person-button")).toHaveLength(2);
		expect(callbacks.onBrowseStateChanged).not.toHaveBeenCalled();
		expect(callbacks.onSelectNode).not.toHaveBeenCalled();
		expect(callbacks.onLayoutChanged).not.toHaveBeenCalled();
	});
});
