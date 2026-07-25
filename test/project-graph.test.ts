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

	it("keeps free-network projections uncentered and preserves counts", () => {
		const projected = projectGraph({ ...snapshot, hiddenNodeCount: 2, hiddenEdgeCount: 1 }, {
			centerMode: "configured",
			centerId: "a",
			projectionMode: "free-network",
		});

		expect(projected.nodes.every((node) => !node.isCenter)).toBe(true);
		expect(projected.hiddenNodeCount).toBe(2);
		expect(projected.hiddenEdgeCount).toBe(1);
		expect(projected.generatedAt).toBe(snapshot.generatedAt);
	});

	it("orders contact-health edges oldest first and leaves status untouched", () => {
		const projected = projectGraph({
			...snapshot,
			edges: [
				{ ...snapshot.edges[0]!, id: "new", lastContact: "2026-02-01", status: "active" },
				{ ...snapshot.edges[1]!, id: "old", lastContact: "2024-02-01", status: "ended" },
				{ ...snapshot.edges[2]!, id: "unknown", lastContact: undefined, status: "dormant" },
			],
		}, { centerMode: "none", projectionMode: "contact-health" });

		expect(projected.edges.map((edge) => edge.id)).toEqual(["old", "new", "unknown"]);
		expect(projected.edges.map((edge) => edge.status)).toEqual(["ended", "active", "dormant"]);
	});

	it("does not guess an ambiguous configured center", () => {
		const projected = projectGraph({
			...snapshot,
			nodes: [
				{ ...snapshot.nodes[0]!, id: "ambiguous:a", personId: "duplicate" },
				{ ...snapshot.nodes[1]!, id: "ambiguous:b", personId: "duplicate" },
			],
			edges: [],
		}, { centerMode: "configured", projectionMode: "ego", centerId: "duplicate" });

		expect(projected.nodes.every((node) => !node.isCenter)).toBe(true);
		expect(projected.edges).toEqual([]);
		expect(projected.diagnostics.some((diagnostic) => diagnostic.code === "projection-center-ambiguous")).toBe(true);
	});

	it("uses an explicit path for active-note and selected-node centers", () => {
		const people = snapshot.nodes.map((node) => ({ ...node, filePath: `${node.id}.md`, personId: node.id }));
		const active = projectGraph({ ...snapshot, nodes: people }, { centerMode: "active-note", centerPath: "b.md", projectionMode: "ego", hops: 0 });
		const selected = projectGraph({ ...snapshot, nodes: people }, { centerMode: "selected-node", centerPath: "c.md", projectionMode: "ego", hops: 0 });

		expect(active.nodes.find((node) => node.isCenter)?.id).toBe("b");
		expect(selected.nodes.find((node) => node.isCenter)?.id).toBe("c");
	});

	it("counts nodes and edges omitted by an ego projection", () => {
		const projected = projectGraph(snapshot, { centerId: "a", centerMode: "configured", projectionMode: "ego", hops: 1, maxNodes: 100 });

		expect(projected.hiddenNodeCount).toBe(2);
		expect(projected.hiddenEdgeCount).toBe(2);
	});
});
