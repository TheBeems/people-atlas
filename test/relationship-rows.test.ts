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
	gender: "woman",
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
	gender: "man",
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
	gender: "woman",
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

	it("derives family terms from each selected endpoint's own gender through the configured format", () => {
		const parentChild: AtlasEdge = {
			id: "relationship-parent-child",
			sourceId: alice.id,
			targetId: bob.id,
			types: ["family"],
			fromRole: "parent",
			toRole: "child",
			filePath: "Relationships/Alice Bob family.md",
			inferred: false,
		};
		const sibling: AtlasEdge = {
			...parentChild,
			id: "relationship-sibling",
			fromRole: "sibling",
			toRole: "sibling",
		};

		expect(buildIncidentRelationshipRows(snapshot([parentChild]), alice, "{person}: {role}")[0]?.description).toBe(
			"Bob: mother. Types: family.",
		);
		expect(buildIncidentRelationshipRows(snapshot([parentChild]), bob, "{person}: {role}")[0]?.description).toBe(
			"Alice: son. Types: family.",
		);
		expect(buildIncidentRelationshipRows(snapshot([sibling]), alice, "{role} of {person}")[0]?.description).toBe(
			"sister of Bob. Types: family.",
		);
		expect(buildIncidentRelationshipRows(snapshot([sibling]), bob, "{role} of {person}")[0]?.description).toBe(
			"brother of Alice. Types: family.",
		);
	});

	it("keeps canonical partner roles literal rather than deriving a gendered family term", () => {
		const partner: AtlasEdge = {
			id: "relationship-partner",
			sourceId: alice.id,
			targetId: bob.id,
			types: [],
			fromRole: "partner",
			toRole: "partner",
			filePath: "Relationships/Alice Bob partner.md",
			inferred: false,
		};

		expect(buildIncidentRelationshipRows(snapshot([partner]), alice, "{role} of {person}")[0]?.description).toBe(
			"partner of Bob.",
		);
		expect(buildIncidentRelationshipRows(snapshot([partner]), bob, "{role} of {person}")[0]?.description).toBe(
			"partner of Alice.",
		);
	});

	it("uses neutral canonical terms for ghost and ambiguous role holders and preserves custom roles literally", () => {
		const parentChild: AtlasEdge = {
			id: "relationship-ghost-child",
			sourceId: alice.id,
			targetId: ghost.id,
			types: [],
			fromRole: "parent",
			toRole: "child",
			filePath: "Relationships/Alice Missing.md",
			inferred: false,
		};
		const literal: AtlasEdge = {
			...parentChild,
			id: "relationship-literal",
			sourceId: alice.id,
			targetId: bob.id,
			fromRole: "Moeder",
			toRole: "Dochter",
		};

		expect(buildIncidentRelationshipRows(snapshot([parentChild]), ghost, "{role} of {person}")[0]?.description).toBe(
			"child of Alice.",
		);
		const ambiguousParent: AtlasEdge = {
			...parentChild,
			id: "relationship-ambiguous-parent",
			sourceId: ambiguous.id,
			targetId: alice.id,
			fromRole: "parent",
			toRole: "child",
		};
		expect(
			buildIncidentRelationshipRows(snapshot([ambiguousParent], [ambiguous, alice]), ambiguous, "{role} of {person}")[0]
				?.description,
		).toBe("parent of Alice.");
		const ambiguousChild: AtlasEdge = {
			...ambiguousParent,
			id: "relationship-ambiguous-child",
			fromRole: "child",
			toRole: "parent",
		};
		expect(
			buildIncidentRelationshipRows(snapshot([ambiguousChild], [ambiguous, alice]), ambiguous, "{role} of {person}")[0]
				?.description,
		).toBe("child of Alice.");
		const ambiguousMan: AtlasNode = {
			...ambiguous,
			id: "ambiguous:duplicate-person-man",
			gender: "man",
		};
		const ambiguousSibling: AtlasEdge = {
			...ambiguousParent,
			id: "relationship-ambiguous-sibling",
			sourceId: ambiguousMan.id,
			fromRole: "sibling",
			toRole: "sibling",
		};
		expect(
			buildIncidentRelationshipRows(
				snapshot([ambiguousSibling], [ambiguousMan, alice]),
				ambiguousMan,
				"{role} of {person}",
			)[0]?.description,
		).toBe("sibling of Alice.");
		expect(buildIncidentRelationshipRows(snapshot([literal]), alice, "{role} of {person}")[0]?.description).toBe(
			"Moeder of Bob.",
		);
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
