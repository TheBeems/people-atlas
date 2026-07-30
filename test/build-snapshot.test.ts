import { describe, expect, it } from "vitest";
import { buildAtlasSnapshot } from "../src/graph/build-snapshot";
import { buildGraphSnapshot } from "../src/graph/graph-source";
import type { RawIndexSnapshot } from "../src/domain/types";

const raw: RawIndexSnapshot = {
	people: [
		{
			id: "alice",
			filePath: "People/Alice.md",
			name: "Alice",
			aliases: [],
			organisations: [],
			contacts: [{ raw: "[[Bob]]", target: "Bob" }],
		},
		{
			id: "bob",
			filePath: "People/Bob.md",
			name: "Bob",
			aliases: [],
			organisations: [],
			contacts: [],
		},
	],
	relationships: [],
};

describe("buildAtlasSnapshot", () => {
	it("resolves contact wikilinks through file paths", () => {
		const snapshot = buildAtlasSnapshot(raw, (target) => (target === "Bob" ? "People/Bob.md" : undefined));
		expect(snapshot.nodes).toHaveLength(2);
		expect(snapshot.edges).toHaveLength(1);
		expect(snapshot.edges[0]?.targetId).toBe("bob");
	});

	it("creates a ghost and diagnostic for an unresolved contact", () => {
		const snapshot = buildAtlasSnapshot(raw, () => undefined);
		expect(snapshot.nodes.some((node) => node.kind === "ghost")).toBe(true);
		expect(snapshot.diagnostics.some((item) => item.code === "unresolved-contact")).toBe(true);
	});

	it("preserves rich metadata and parallel relationship entities", () => {
		const people = raw.people.map((person) => ({ ...person, contacts: [] }));
		const relationshipSnapshot: RawIndexSnapshot = {
			people,
			relationships: [
				{
					id: "rel-friend",
					filePath: "Relationships/Alice-Bob-friend.md",
					from: { raw: "[[Alice]]", target: "Alice" },
					to: { raw: "[[Bob]]", target: "Bob" },
					presetId: "friend",
					fromRole: "Friend",
					toRole: "Friend",
					direction: "source-to-target",
					types: ["friend"],
					closeness: 4,
					since: "2018-03-01",
					lastContact: "2026-07-18",
					status: "active",
				},
				{
					id: "rel-colleague",
					filePath: "Relationships/Alice-Bob-colleague.md",
					from: { raw: "[[Alice]]", target: "Alice" },
					to: { raw: "[[Bob]]", target: "Bob" },
					direction: "undirected",
					types: ["colleague"],
				},
			],
		};

		const snapshot = buildAtlasSnapshot(relationshipSnapshot, (target) => `People/${target}.md`);
		const edges = snapshot.edges.filter((edge) => !edge.inferred);
		expect(edges).toHaveLength(2);
		expect(edges[0]).toMatchObject({
			id: "rel-friend",
			presetId: "friend",
			direction: "source-to-target",
			types: ["friend"],
			fromRole: "Friend",
			toRole: "Friend",
			closeness: 4,
			since: "2018-03-01",
			lastContact: "2026-07-18",
			status: "active",
		});
	});

	it("does not resolve a duplicate person ID by first match", () => {
		const duplicatePeople: RawIndexSnapshot = {
			people: [
				{ id: "duplicate", filePath: "People/Alice.md", name: "Alice", aliases: [], organisations: [], contacts: [] },
				{ id: "duplicate", filePath: "People/Bob.md", name: "Bob", aliases: [], organisations: [], contacts: [] },
				{
					id: "carol",
					filePath: "People/Carol.md",
					name: "Carol",
					aliases: [],
					organisations: [],
					contacts: [{ raw: "duplicate", target: "duplicate" }],
				},
			],
			relationships: [],
		};

		const snapshot = buildAtlasSnapshot(duplicatePeople, () => undefined);
		expect(snapshot.diagnostics.some((item) => item.code === "duplicate-person-id")).toBe(true);
		expect(snapshot.diagnostics.some((item) => item.code === "ambiguous-person-reference")).toBe(true);
		expect(snapshot.diagnostics.some((item) => item.code === "unresolved-contact")).toBe(false);
		expect(snapshot.edges.some((edge) => edge.targetId === "duplicate")).toBe(false);
	});

	it("keeps a resolved relationship to a filtered person distinct from unresolved data", () => {
		const alice = raw.people[0];
		const bob = raw.people[1];
		if (!alice || !bob) throw new Error("Test fixture is incomplete.");
		const visibleAlice = { ...alice, contacts: [] };
		const relationship = {
			id: "rel-filtered",
			filePath: "Relationships/Alice-Bob.md",
			from: { raw: "[[Alice]]", target: "Alice" },
			to: { raw: "[[Bob]]", target: "Bob" },
			direction: "undirected" as const,
			types: ["friend"],
		};
		const snapshot = buildGraphSnapshot(
			{
				visible: { people: [visibleAlice], relationships: [] },
				canonical: { people: [alice, bob], relationships: [relationship] },
			},
			(target) => (target === "Alice" ? "People/Alice.md" : "People/Bob.md"),
		);

		expect(snapshot.edges).toHaveLength(0);
		expect(snapshot.hiddenNodeCount).toBe(1);
		expect(snapshot.hiddenEdgeCount).toBe(1);
		expect(snapshot.diagnostics.some((item) => item.code === "filtered-endpoint")).toBe(true);
		expect(snapshot.diagnostics.some((item) => item.code === "unresolved-relationship-endpoint")).toBe(false);
	});

	it("accounts for contacts originating from a filtered person", () => {
		const alice = raw.people[0];
		const bob = raw.people[1];
		if (!alice || !bob) throw new Error("Test fixture is incomplete.");
		const snapshot = buildGraphSnapshot(
			{
				visible: { people: [bob], relationships: [] },
				canonical: raw,
			},
			(target) => (target === "Bob" ? "People/Bob.md" : undefined),
		);

		expect(snapshot.edges).toHaveLength(0);
		expect(snapshot.hiddenEdgeCount).toBe(1);
		expect(snapshot.diagnostics.some((item) => item.code === "filtered-endpoint")).toBe(true);
	});
});
