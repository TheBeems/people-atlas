import { describe, expect, it } from "vitest";
import type { AtlasEdge, AtlasNode, AtlasSnapshot } from "../src/domain/types";
import { buildIncidentRelationshipRows, relationshipActionAccessibleName } from "../src/render/relationship-rows";

const alice: AtlasNode = {
	id: "person-alice",
	personId: "person-alice",
	kind: "person",
	label: "Alice",
	filePath: "People/Alice.md",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: true,
};

const bob: AtlasNode = {
	id: "person-bob",
	personId: "person-bob",
	kind: "person",
	label: "Bob",
	filePath: "People/Bob.md",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

const ghost: AtlasNode = {
	id: "ghost:Missing",
	kind: "ghost",
	label: "Missing",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

const ambiguous: AtlasNode = {
	id: "ambiguous:duplicate-person",
	personId: "duplicate-person",
	kind: "person",
	label: "Duplicate person",
	filePath: "People/Duplicate.md",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

function snapshot(edges: AtlasEdge[], nodes: AtlasNode[] = [alice, bob, ghost]): AtlasSnapshot {
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

describe("incident relationship rows", () => {
	it("preserves exact parallel edge identity, path and metadata in source order", () => {
		const work: AtlasEdge = {
			id: "relationship-work",
			sourceId: alice.id,
			targetId: bob.id,
			types: ["colleague"],
			fromRole: "Collega",
			toRole: "Collega",
			status: "active",
			since: "2024-01-01",
			lastContact: "2026-07-30",
			filePath: "Relationships/Alice Bob work.md",
			inferred: false,
		};
		const sport: AtlasEdge = {
			id: "relationship-sport",
			sourceId: alice.id,
			targetId: bob.id,
			types: ["teamgenoot"],
			filePath: "Relationships/Alice Bob sport.md",
			inferred: false,
		};

		const rows = buildIncidentRelationshipRows(snapshot([work, sport]), alice, "{role} van {person}");

		expect(rows).toHaveLength(2);
		expect(rows[0]?.edge).toBe(work);
		expect(rows[1]?.edge).toBe(sport);
		expect(rows[0]).toMatchObject({
			counterpart: bob,
			noteBacked: true,
			description: "Collega van Bob. Types: colleague. Status: active. Since: 2024-01-01. Last contact: 2026-07-30.",
		});
		expect(relationshipActionAccessibleName("edit", rows[0] as NonNullable<(typeof rows)[number]>)).not.toBe(
			relationshipActionAccessibleName("edit", rows[1] as NonNullable<(typeof rows)[number]>),
		);
		expect(relationshipActionAccessibleName("open", rows[0] as NonNullable<(typeof rows)[number]>)).toContain(
			work.filePath,
		);
	});

	it("keeps inferred links visible and ineligible for relationship-note actions", () => {
		const inferred: AtlasEdge = {
			id: "contact-missing",
			sourceId: alice.id,
			targetId: ghost.id,
			types: ["contact"],
			inferred: true,
		};

		expect(buildIncidentRelationshipRows(snapshot([inferred]), alice, "{role} van {person}")).toEqual([
			{
				edge: inferred,
				counterpart: ghost,
				description: "Linked person: Missing (unresolved).",
				noteBacked: false,
				actionContext: "Missing (unresolved)",
			},
		]);
	});

	it("requires a real non-empty note path and uses the selected endpoint role", () => {
		const pathless: AtlasEdge = {
			id: "relationship-pathless",
			sourceId: alice.id,
			targetId: bob.id,
			types: ["parent-child"],
			fromRole: "Kind",
			toRole: "Ouder",
			filePath: " ",
			inferred: false,
		};

		const fromAlice = buildIncidentRelationshipRows(snapshot([pathless]), alice, "{role} van {person}");
		const fromBob = buildIncidentRelationshipRows(snapshot([pathless]), bob, "{role} van {person}");

		expect(fromAlice[0]).toMatchObject({ noteBacked: false, description: "Kind van Bob. Types: parent-child." });
		expect(fromBob[0]).toMatchObject({ noteBacked: false, description: "Ouder van Alice. Types: parent-child." });
	});

	it("keeps an ambiguous path-resolved counterpart visibly ambiguous while targeting the relationship note", () => {
		const relationship: AtlasEdge = {
			id: "relationship-ambiguous-counterpart",
			sourceId: alice.id,
			targetId: ambiguous.id,
			types: ["family"],
			filePath: "Relationships/Alice Duplicate.md",
			inferred: false,
		};

		expect(
			buildIncidentRelationshipRows(snapshot([relationship], [alice, ambiguous]), alice, "{role} van {person}"),
		).toEqual([
			{
				edge: relationship,
				counterpart: ambiguous,
				description: "Connected to Duplicate person (ambiguous). Types: family.",
				noteBacked: true,
				actionContext: "Duplicate person (ambiguous), family, Relationships/Alice Duplicate.md",
			},
		]);
	});

	it("omits non-incident edges and rows whose counterpart is absent from the snapshot", () => {
		const absentCounterpart: AtlasEdge = {
			id: "relationship-absent",
			sourceId: alice.id,
			targetId: "person-absent",
			types: [],
			filePath: "Relationships/Absent.md",
			inferred: false,
		};
		const unrelated: AtlasEdge = {
			id: "relationship-unrelated",
			sourceId: bob.id,
			targetId: ghost.id,
			types: [],
			filePath: "Relationships/Unrelated.md",
			inferred: false,
		};

		expect(
			buildIncidentRelationshipRows(snapshot([absentCounterpart, unrelated]), alice, "{role} van {person}"),
		).toEqual([]);
	});
});
