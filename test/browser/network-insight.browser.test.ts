import { afterEach, describe, expect, it, vi } from "vitest";
import type { AtlasEdge, AtlasNode, AtlasSnapshot } from "../../src/domain/types";
import { createTranslator } from "../../src/i18n";
import { AtlasRenderer } from "../../src/render/atlas-renderer";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";

const renderers: AtlasRenderer[] = [];
afterEach(() => {
	for (const renderer of renderers.splice(0)) renderer.destroy();
	document.body.replaceChildren();
});
function node(id: string): AtlasNode {
	return {
		id,
		kind: "person",
		personId: id,
		label: id === "c" ? "Bridge" : "Same name",
		filePath: `People/${id}.md`,
		organisations: [],
		emails: [],
		phones: [],
		isCenter: false,
	};
}
function edge(id: string, sourceId: string, targetId: string, inferred = false): AtlasEdge {
	return { id, sourceId, targetId, types: [], inferred, filePath: inferred ? undefined : `Relationships/${id}.md` };
}
function snapshot(): AtlasSnapshot {
	return {
		nodes: [node("a"), node("b"), node("c")],
		edges: [edge("ac", "a", "c"), edge("cb", "c", "b", true)],
		contactMoments: [],
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount: 0,
		generatedAt: 1,
	};
}

describe("shared accessible network insight", () => {
	it("uses explicit ID choices and accessible read-only path/common results", () => {
		const container = document.createElement("div");
		container.style.cssText = "width:800px;height:700px";
		document.body.append(container);
		const writes = vi.fn();
		const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, {
			onOpenNode: vi.fn(),
			onCenterNode: writes,
			onSelectNode: vi.fn(),
			onEditPerson: writes,
		});
		renderers.push(renderer);
		renderer.setGraph(snapshot());
		container.querySelector<HTMLButtonElement>(".people-atlas-list-mode")!.click();
		container.querySelector<HTMLButtonElement>('[data-node-id="a"]')!.click();
		const compare = container.querySelector<HTMLSelectElement>("[data-network-counterpart]")!;
		expect(compare.getAttribute("aria-label")).toBe("Compare selected person with");
		expect(
			Array.from(compare.options)
				.filter((option) => option.textContent?.includes("Same name"))
				.map((option) => option.value),
		).toEqual(["a", "b"]);
		compare.value = "b";
		compare.dispatchEvent(new Event("change", { bubbles: true }));
		const result = container.querySelector<HTMLElement>("[data-network-results]")!;
		expect(result.getAttribute("aria-live")).toBe("polite");
		expect(result.textContent).toContain("Shortest connection path");
		expect(result.querySelectorAll("ol li")).toHaveLength(2);
		expect(result.textContent).toContain("Linked people");
		expect(result.querySelector('[data-network-common-person-id="c"]')).not.toBeNull();
		expect(writes).not.toHaveBeenCalled();
	});
	it("removes an unavailable counterpart rather than revealing excluded snapshot people", () => {
		const container = document.createElement("div");
		document.body.append(container);
		const renderer = new AtlasRenderer(
			container,
			() => DEFAULT_SETTINGS,
			{ onOpenNode: vi.fn(), onCenterNode: vi.fn(), onSelectNode: vi.fn() },
			createTranslator("nl"),
		);
		renderers.push(renderer);
		renderer.setGraph(snapshot());
		container.querySelector<HTMLButtonElement>(".people-atlas-list-mode")!.click();
		container.querySelector<HTMLButtonElement>('[data-node-id="a"]')!.click();
		const compare = container.querySelector<HTMLSelectElement>("[data-network-counterpart]")!;
		compare.value = "b";
		compare.dispatchEvent(new Event("change", { bubbles: true }));
		const restricted = { ...snapshot(), nodes: [node("a")], edges: [] };
		renderer.setGraph(restricted, undefined, restricted);
		expect(Array.from(compare.options).map((option) => option.value)).toEqual(["", "a"]);
		expect(compare.value).toBe("");
		expect(container.querySelector("[data-network-results]")?.textContent).not.toContain("Bridge");
	});
});
