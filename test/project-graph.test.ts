import { describe, expect, it } from "vitest";
import { projectGraph } from "../src/graph/project-graph";
import type { AtlasSnapshot } from "../src/domain/types";

const snapshot: AtlasSnapshot = {
	generatedAt: 1,
	diagnostics: [],
	hiddenNodeCount: 0,
	hiddenEdgeCount: 0,
	nodes: ["a", "b", "c", "d"].map((id) => ({
		id,
		kind: "person" as const,
		label: id,
		organisations: [],
		isCenter: false,
	})),
	edges: [
		{ id: "ab", sourceId: "a", targetId: "b", types: [], direction: "undirected", inferred: true },
		{ id: "bc", sourceId: "b", targetId: "c", types: [], direction: "undirected", inferred: true },
		{ id: "cd", sourceId: "c", targetId: "d", types: [], direction: "undirected", inferred: true },
	],
};

describe("projectGraph", () => {
	it("projects the requested number of hops", () => {
		const projected = projectGraph(snapshot, { centerId: "a", hops: 1, maxNodes: 100 });
		expect(projected.nodes.map((node) => node.id).sort()).toEqual(["a", "b"]);
		expect(projected.nodes.find((node) => node.id === "a")?.isCenter).toBe(true);
	});
});
