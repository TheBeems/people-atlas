import { describe, expect, it } from "vitest";
import type { AtlasEdge, AtlasNode, AtlasSnapshot } from "../src/domain/types";
import { createFamilyLayout } from "../src/graph/family-layout";
import { commonContacts, shortestPath } from "../src/graph/network-insight";

function node(id: string, overrides: Partial<AtlasNode> = {}): AtlasNode {
	return {
		id,
		personId: id,
		kind: "person",
		label: "Same name",
		filePath: `People/${id}.md`,
		organisations: [],
		emails: [],
		phones: [],
		isCenter: false,
		...overrides,
	};
}
function edge(id: string, sourceId: string, targetId: string, overrides: Partial<AtlasEdge> = {}): AtlasEdge {
	return { id, sourceId, targetId, inferred: false, filePath: `${id}.md`, types: [], ...overrides };
}
function snapshot(nodes: AtlasNode[], edges: AtlasEdge[]): AtlasSnapshot {
	return {
		nodes,
		edges,
		contactMoments: [],
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount: 0,
		generatedAt: 1,
	};
}

describe("canonical network insight", () => {
	it("finds the deterministic shortest undirected path through cycles and keeps parallel evidence", () => {
		const input = snapshot(
			["d", "c", "b", "a"].map((id) => node(id)),
			[
				edge("bd", "b", "d"),
				edge("cd", "c", "d"),
				edge("ac", "a", "c"),
				edge("linked", "a", "b", { inferred: true, filePath: undefined }),
				edge("ab", "b", "a"),
				edge("bc", "b", "c"),
			],
		);
		const path = shortestPath(input, "a", "d");
		expect(path.status).toBe("found");
		expect(path.nodes.map((item) => item.id)).toEqual(["a", "b", "d"]);
		expect(path.steps[0]?.edges.map((item) => [item.id, item.inferred])).toEqual([
			["ab", false],
			["linked", true],
		]);
		expect(
			shortestPath({ ...input, nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }, "a", "d"),
		).toEqual(path);
	});
	it("distinguishes same-person, disconnected and unavailable identities without choosing a name", () => {
		const input = snapshot(
			[node("a"), node("b"), node("ghost:z", { kind: "ghost", filePath: undefined }), node("ambiguous:x")],
			[edge("ag", "a", "ghost:z"), edge("gb", "ghost:z", "b")],
		);
		expect(shortestPath(input, "a", "a").status).toBe("same-person");
		expect(shortestPath(input, "a", "b").status).toBe("disconnected");
		expect(shortestPath(input, "a", "Same name").status).toBe("invalid-person");
		expect(shortestPath(input, "a", "ambiguous:x").status).toBe("invalid-person");
		expect(
			shortestPath({ ...input, nodes: [...input.nodes, node("a", { filePath: "duplicate.md" })] }, "a", "b").status,
		).toBe("invalid-person");
	});
	it("lists distinct mutual neighbors and the two existing connection sources", () => {
		const input = snapshot(
			["a", "b", "c", "d"].map((id) => node(id)),
			[
				edge("ac", "a", "c"),
				edge("bc", "b", "c", { inferred: true }),
				edge("ad", "a", "d"),
				edge("bd", "b", "d"),
				edge("ab", "a", "b"),
			],
		);
		const result = commonContacts(input, "a", "b");
		expect(result.status).toBe("found");
		expect(result.contacts.map((item) => item.person.id)).toEqual(["c", "d"]);
		expect(result.contacts[0]?.firstEdges[0]?.inferred).toBe(false);
		expect(result.contacts[0]?.secondEdges[0]?.inferred).toBe(true);
		expect(commonContacts(input, "a", "a")).toEqual({ status: "same-person", contacts: [] });
		expect(commonContacts(input, "a", "missing")).toEqual({ status: "invalid-person", contacts: [] });
	});
});

describe("explicit-role family layout", () => {
	it("uses parent/child generations regardless of endpoint order, with deterministic unrelated components", () => {
		const input = snapshot(
			["parent", "child", "grandchild", "unrelated"].map((id) => node(id)),
			[
				edge("pc", "parent", "child", { fromRole: "parent", toRole: "child" }),
				edge("gc", "grandchild", "child", { fromRole: "child", toRole: "parent" }),
			],
		);
		const positions = createFamilyLayout(input);
		expect(positions.get("parent")?.y).toBe(0);
		expect(positions.get("child")?.y).toBe(180);
		expect(positions.get("grandchild")?.y).toBe(360);
		expect([
			...createFamilyLayout({ ...input, nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }),
		]).toEqual([...positions]);
	});
	it("does not infer parents from siblings, partners, inferred links or gendered display terms", () => {
		for (const roles of [
			{ fromRole: "sibling", toRole: "sibling" },
			{ fromRole: "partner", toRole: "partner" },
			{ fromRole: "mother", toRole: "son" },
			{ fromRole: "parent", toRole: "child", inferred: true },
		]) {
			const positions = createFamilyLayout(snapshot([node("a"), node("b")], [edge("r", "a", "b", roles)]));
			expect(positions.get("a")?.y).toBe(positions.get("b")?.y);
		}
	});
	it("falls back to finite stable rows for cyclic and conflicting generation constraints", () => {
		const nodes = ["a", "b", "c"].map((id) => node(id));
		const edges = [
			edge("ab", "a", "b", { fromRole: "parent", toRole: "child" }),
			edge("bc", "b", "c", { fromRole: "parent", toRole: "child" }),
			edge("ca", "c", "a", { fromRole: "parent", toRole: "child" }),
		];
		for (const input of [
			snapshot(nodes, edges),
			snapshot(nodes, [...edges.slice(0, 1), edge("ba", "a", "b", { fromRole: "child", toRole: "parent" })]),
		]) {
			const positions = createFamilyLayout(input);
			expect(positions.size).toBe(3);
			expect([...positions.values()].every((point) => Number.isFinite(point.x) && point.y === 0)).toBe(true);
			expect([...createFamilyLayout({ ...input, edges: [...input.edges].reverse() })]).toEqual([...positions]);
		}
	});
});
