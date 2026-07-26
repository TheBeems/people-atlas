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
	renderer: { setGraph: ReturnType<typeof vi.fn> };
	handleNodeSelection(node: AtlasNode | undefined, source: AtlasSelectionSource): void;
}

interface BasesHarness {
	selectedPath: string | undefined;
	selectedCenterPath: string | undefined;
	handleNodeSelection(node: AtlasNode | undefined, source: AtlasSelectionSource): void;
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
		renderer: { setGraph: vi.fn() },
	});
	return harness;
}

function basesHarness(): BasesHarness {
	const harness = Object.create(PeopleAtlasBasesView.prototype) as BasesHarness;
	Object.assign(harness, {
		selectedPath: undefined,
		selectedCenterPath: undefined,
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
});
