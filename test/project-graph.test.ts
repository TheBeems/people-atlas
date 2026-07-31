import { describe, expect, it } from "vitest";
import { projectGraph } from "../src/graph/project-graph";
import type { AtlasSnapshot } from "../src/domain/types";

const snapshot: AtlasSnapshot = {
	generatedAt: 1,
	diagnostics: [],
	hiddenNodeCount: 0,
	hiddenEdgeCount: 0,
	hiddenContactMomentCount: 0,
	contactMoments: [],
	nodes: ["a", "b", "c", "d"].map((id) => ({
		id,
		kind: "person" as const,
		personId: id,
		label: id,
		organisations: [],
		emails: [],
		phones: [],
		isCenter: false,
	})),
	edges: [
		{ id: "ab", sourceId: "a", targetId: "b", types: [], inferred: true },
		{ id: "bc", sourceId: "b", targetId: "c", types: [], inferred: true },
		{ id: "cd", sourceId: "c", targetId: "d", types: [], inferred: true },
	],
};

function requiredAt<T>(values: readonly T[], index: number): T {
	const value = values[index];
	if (value === undefined) throw new Error(`Fixture value ${index} is missing.`);
	return value;
}

describe("projectGraph", () => {
	it("projects the requested number of hops", () => {
		const projected = projectGraph(snapshot, { centerId: "a", hops: 1, maxNodes: 100 });
		expect(projected.nodes.map((node) => node.id).sort()).toEqual(["a", "b"]);
		expect(projected.nodes.find((node) => node.id === "a")?.isCenter).toBe(true);
	});

	it("keeps free-network projections uncentered and preserves counts", () => {
		const projected = projectGraph(
			{ ...snapshot, hiddenNodeCount: 2, hiddenEdgeCount: 1 },
			{
				centerMode: "configured",
				centerId: "a",
				projectionMode: "free-network",
			},
		);

		expect(projected.nodes.every((node) => !node.isCenter)).toBe(true);
		expect(projected.hiddenNodeCount).toBe(2);
		expect(projected.hiddenEdgeCount).toBe(1);
		expect(projected.generatedAt).toBe(snapshot.generatedAt);
	});

	it("orders contact-health edges oldest first and leaves status untouched", () => {
		const projected = projectGraph(
			{
				...snapshot,
				edges: [
					{ ...requiredAt(snapshot.edges, 0), id: "new", lastContact: "2026-02-01", status: "active" },
					{ ...requiredAt(snapshot.edges, 1), id: "old", lastContact: "2024-02-01", status: "ended" },
					{ ...requiredAt(snapshot.edges, 2), id: "unknown", lastContact: undefined, status: "dormant" },
				],
			},
			{ centerMode: "none", projectionMode: "contact-health" },
		);

		expect(projected.edges.map((edge) => edge.id)).toEqual(["old", "new", "unknown"]);
		expect(projected.edges.map((edge) => edge.status)).toEqual(["ended", "active", "dormant"]);
	});

	it("does not guess an ambiguous configured center", () => {
		const projected = projectGraph(
			{
				...snapshot,
				nodes: [
					{ ...requiredAt(snapshot.nodes, 0), id: "ambiguous:a", personId: "duplicate" },
					{ ...requiredAt(snapshot.nodes, 1), id: "ambiguous:b", personId: "duplicate" },
				],
				edges: [],
			},
			{ centerMode: "configured", projectionMode: "ego", centerId: "duplicate" },
		);

		expect(projected.nodes.every((node) => !node.isCenter)).toBe(true);
		expect(projected.edges).toEqual([]);
		expect(projected.diagnostics.some((diagnostic) => diagnostic.code === "projection-center-ambiguous")).toBe(true);
	});

	it("uses an explicit path for active-note and selected-node centers", () => {
		const people = snapshot.nodes.map((node) => ({ ...node, filePath: `${node.id}.md`, personId: node.id }));
		const active = projectGraph(
			{ ...snapshot, nodes: people },
			{ centerMode: "active-note", centerPath: "b.md", projectionMode: "ego", hops: 0 },
		);
		const selected = projectGraph(
			{ ...snapshot, nodes: people },
			{ centerMode: "selected-node", centerPath: "c.md", projectionMode: "ego", hops: 0 },
		);

		expect(active.nodes.find((node) => node.isCenter)?.id).toBe("b");
		expect(selected.nodes.find((node) => node.isCenter)?.id).toBe("c");
	});

	it("counts nodes and edges omitted by an ego projection", () => {
		const projected = projectGraph(snapshot, {
			centerId: "a",
			centerMode: "configured",
			projectionMode: "ego",
			hops: 1,
			maxNodes: 100,
		});

		expect(projected.hiddenNodeCount).toBe(2);
		expect(projected.hiddenEdgeCount).toBe(2);
	});

	it("filters multi-person and linked contact summaries after ego and node-limit projection exactly once", () => {
		const withMoments: AtlasSnapshot = {
			...snapshot,
			contactMoments: [
				{
					id: "multi",
					filePath: "Moments/Multi.md",
					personIds: ["a", "b"],
					occurredOn: "2026-07-30",
				},
				{
					id: "linked",
					filePath: "Moments/Linked.md",
					personIds: ["a"],
					relationshipId: "ab",
					occurredOn: "2026-07-31",
				},
			],
			hiddenContactMomentCount: 2,
			edges: [
				{ id: "ab", sourceId: "a", targetId: "b", types: ["friend"], inferred: false },
				...snapshot.edges.slice(1),
			],
		};

		const projected = projectGraph(withMoments, {
			centerId: "a",
			centerMode: "configured",
			projectionMode: "ego",
			hops: 0,
			maxNodes: 1,
		});

		expect(projected.contactMoments).toEqual([]);
		expect(projected.hiddenContactMomentCount).toBe(4);
		expect(projected.hiddenNodeCount).toBe(3);
		expect(projected.hiddenEdgeCount).toBe(3);
	});
});
