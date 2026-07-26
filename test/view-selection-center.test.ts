import { describe, expect, it, vi } from "vitest";
import { PeopleAtlasBasesView } from "../src/bases/people-atlas-bases-view";
import type { AtlasNode, AtlasSnapshot, ProjectionCenterMode, ProjectionMode } from "../src/domain/types";
import { isResolvedAtlasPersonNode } from "../src/domain/node-capabilities";
import type { AtlasSelectionSource } from "../src/render/atlas-renderer";
import { DEFAULT_VIEW_STATE, type AtlasViewState } from "../src/settings/view-state";
import { PeopleAtlasView } from "../src/view/people-atlas-view";

const alice: AtlasNode = {
	id: "alice",
	personId: "alice",
	kind: "person",
	label: "Alice",
	filePath: "People/Alice.md",
	organisations: [],
	isCenter: false,
};

const ghost: AtlasNode = {
	id: "ghost:Missing",
	kind: "ghost",
	label: "Missing",
	organisations: [],
	isCenter: false,
};

const ambiguous: AtlasNode = {
	id: "ambiguous:duplicate",
	personId: "duplicate",
	kind: "person",
	label: "Duplicate",
	filePath: "People/Duplicate.md",
	organisations: [],
	isCenter: false,
};

const fullSnapshot: AtlasSnapshot = {
	nodes: [alice, ghost, ambiguous],
	edges: [],
	diagnostics: [],
	hiddenNodeCount: 0,
	hiddenEdgeCount: 0,
	generatedAt: 1,
};

interface StandaloneHarness {
	selectedPath: string | undefined;
	selectedCenterPath: string | undefined;
	centerMode: ProjectionCenterMode;
	projectionMode: ProjectionMode;
	viewState: AtlasViewState;
	viewConfigurationKey: string;
	fullSnapshot: AtlasSnapshot;
	plugin: { index: { getSnapshot(): { people: Array<{ id: string; filePath: string }> } } };
	renderer: { setGraph: ReturnType<typeof vi.fn> };
	handleNodeSelection(node: AtlasNode | undefined, source: AtlasSelectionSource): void;
	canCreateRelationship(node: AtlasNode | undefined): boolean;
}

interface BasesHarness {
	selectedPath: string | undefined;
	selectedCenterPath: string | undefined;
	plugin: { index: { getSnapshot(): { people: Array<{ id: string; filePath: string }> } } };
	handleNodeSelection(node: AtlasNode | undefined, source: AtlasSelectionSource): void;
	canCreateRelationship(node: AtlasNode | undefined): boolean;
	renderSelectionActions: ReturnType<typeof vi.fn>;
	readCenterMode: ReturnType<typeof vi.fn>;
	onDataUpdated: ReturnType<typeof vi.fn>;
}

function standaloneHarness(): StandaloneHarness {
	const harness = Object.create(PeopleAtlasView.prototype) as StandaloneHarness;
	Object.assign(harness, {
		selectedPath: undefined,
		selectedCenterPath: undefined,
		centerMode: "selected-node" satisfies ProjectionCenterMode,
		projectionMode: "ego" satisfies ProjectionMode,
		viewState: { ...structuredClone(DEFAULT_VIEW_STATE), centerMode: "selected-node", projectionMode: "ego", hops: 0 },
		viewConfigurationKey: "standalone",
		fullSnapshot,
		plugin: { index: { getSnapshot: () => ({ people: [{ id: alice.id, filePath: alice.filePath as string }] }) } },
		renderer: { setGraph: vi.fn() },
	});
	return harness;
}

function basesHarness(): BasesHarness {
	const harness = Object.create(PeopleAtlasBasesView.prototype) as BasesHarness;
	Object.assign(harness, {
		selectedPath: undefined,
		selectedCenterPath: undefined,
		plugin: { index: { getSnapshot: () => ({ people: [{ id: alice.id, filePath: alice.filePath as string }] }) } },
		renderSelectionActions: vi.fn(),
		readCenterMode: vi.fn(() => "selected-node"),
		onDataUpdated: vi.fn(),
	});
	return harness;
}

describe("owning-view selected-node center", () => {
	it("standalone centers a valid canvas person, clears ghosts and ambiguous people, and ignores List for centering", () => {
		const view = standaloneHarness();

		view.handleNodeSelection(alice, "canvas");
		expect(view.selectedCenterPath).toBe(alice.filePath);
		let projected = view.renderer.setGraph.mock.calls.at(-1)?.[0] as AtlasSnapshot;
		expect(projected.nodes.map((node) => node.id)).toEqual([alice.id]);
		expect(projected.nodes[0]?.isCenter).toBe(true);

		for (const nonResolved of [ghost, ambiguous]) {
			view.handleNodeSelection(nonResolved, "canvas");
			expect(view.selectedCenterPath).toBeUndefined();
			projected = view.renderer.setGraph.mock.calls.at(-1)?.[0] as AtlasSnapshot;
			expect(projected.nodes.every((node) => !node.isCenter)).toBe(true);
			expect(isResolvedAtlasPersonNode(nonResolved)).toBe(false);
		}

		view.handleNodeSelection(alice, "canvas");
		view.renderer.setGraph.mockClear();
		view.handleNodeSelection(ghost, "list");
		expect(view.selectedCenterPath).toBe(alice.filePath);
		expect(view.renderer.setGraph).not.toHaveBeenCalled();
	});

	it("Bases schedules selected-node projection with a valid canvas path and clears it for ghost and ambiguous selections", () => {
		const view = basesHarness();

		view.handleNodeSelection(alice, "canvas");
		expect(view.selectedCenterPath).toBe(alice.filePath);
		expect(view.onDataUpdated).toHaveBeenCalledOnce();

		for (const nonResolved of [ghost, ambiguous]) {
			view.onDataUpdated.mockClear();
			view.handleNodeSelection(nonResolved, "canvas");
			expect(view.selectedCenterPath).toBeUndefined();
			expect(view.onDataUpdated).toHaveBeenCalledOnce();
			expect(isResolvedAtlasPersonNode(nonResolved)).toBe(false);
		}

		view.handleNodeSelection(alice, "canvas");
		view.onDataUpdated.mockClear();
		view.handleNodeSelection(ambiguous, "list");
		expect(view.selectedCenterPath).toBe(alice.filePath);
		expect(view.onDataUpdated).not.toHaveBeenCalled();
	});

	it("both adapters grant Create only to the exact current canonical stable node", () => {
		const staleSamePath: AtlasNode = { ...alice, id: "stale-alice" };
		const staleSameId: AtlasNode = { ...alice, filePath: "People/Alice moved.md" };
		for (const view of [standaloneHarness(), basesHarness()]) {
			expect(view.canCreateRelationship(alice)).toBe(true);
			expect(view.canCreateRelationship(staleSamePath)).toBe(false);
			expect(view.canCreateRelationship(staleSameId)).toBe(false);
			expect(view.canCreateRelationship(ghost)).toBe(false);
			expect(view.canCreateRelationship(ambiguous)).toBe(false);
		}
	});
});
