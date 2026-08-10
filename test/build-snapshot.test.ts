import { describe, expect, it } from "vitest";
import { buildAtlasSnapshot } from "../src/graph/build-snapshot";
import { buildGraphSnapshot } from "../src/graph/graph-source";
import type { ContactMomentRecord, PersonRecord, RawIndexSnapshot } from "../src/domain/types";

const raw: RawIndexSnapshot = {
	people: [
		{
			id: "alice",
			filePath: "People/Alice.md",
			name: "Alice",
			aliases: [],
			organisations: [],
			birthDate: "--02-29",
			pronouns: "she/her",
			gender: "woman",
			emails: ["alice@example.test"],
			phones: ["+31 6 1234"],
			jobTitle: "Engineer",
			contacts: [{ raw: "[[Bob]]", target: "Bob", kind: "wikilink" as const }],
		},
		{
			id: "bob",
			filePath: "People/Bob.md",
			name: "Bob",
			aliases: [],
			organisations: [],
			emails: [],
			phones: [],
			contacts: [],
		},
	],
	relationships: [],
};

function contactMoment(
	id: string,
	filePath: string,
	personIds: string[],
	overrides: Partial<ContactMomentRecord> = {},
): ContactMomentRecord {
	return {
		id,
		filePath,
		people: personIds.map((target) => ({ raw: target, target, kind: "id" as const })),
		occurredOn: "2026-07-30",
		personIds,
		actionable: true,
		followUpActionable: false,
		...overrides,
	};
}

describe("buildAtlasSnapshot", () => {
	it("resolves contact wikilinks through file paths", () => {
		const snapshot = buildAtlasSnapshot(raw, (target) => (target === "Bob" ? "People/Bob.md" : undefined));
		expect(snapshot.nodes).toHaveLength(2);
		expect(snapshot.edges).toHaveLength(1);
		expect(snapshot.edges[0]?.targetId).toBe("bob");
		expect(snapshot.nodes.find((node) => node.id === "alice")).toMatchObject({
			birthDate: "--02-29",
			pronouns: "she/her",
			gender: "woman",
			emails: ["alice@example.test"],
			phones: ["+31 6 1234"],
			jobTitle: "Engineer",
		});
	});

	it("uses stored resolved-path evidence for a relative explicit person contact", () => {
		const source: PersonRecord = {
			id: "source",
			filePath: "People/Source.md",
			name: "Source",
			aliases: [],
			organisations: [],
			emails: [],
			phones: [],
			contacts: [
				{
					raw: "Bob.md",
					target: "Bob.md",
					kind: "path",
					resolvedPath: "People/Bob.md",
				},
			],
		};
		const alice = raw.people[0];
		const bob = raw.people[1];
		if (!alice || !bob) throw new Error("Test fixture is incomplete.");
		const idOwned = { ...alice, id: "Bob", filePath: "People/A.md", name: "ID-owned Bob", contacts: [] };
		const pathOwned = { ...bob, id: "person-bob", filePath: "People/Bob.md", name: "Path-owned Bob" };
		const snapshot = buildAtlasSnapshot({ people: [source, idOwned, pathOwned], relationships: [] }, () => undefined);

		expect(snapshot.edges).toEqual([
			expect.objectContaining({ sourceId: "source", targetId: "person-bob", inferred: true }),
		]);
		expect(snapshot.diagnostics).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "ambiguous-person-reference" })]),
		);
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
					from: { raw: "[[Alice]]", target: "Alice", kind: "wikilink" as const },
					to: { raw: "[[Bob]]", target: "Bob", kind: "wikilink" as const },
					presetId: "friend",
					fromRole: "Friend",
					toRole: "Friend",
					types: ["friend"],
					closeness: 4,
					since: "2018-03-01",
					lastContact: "2026-07-18",
					status: "active",
				},
				{
					id: "rel-colleague",
					filePath: "Relationships/Alice-Bob-colleague.md",
					from: { raw: "[[Alice]]", target: "Alice", kind: "wikilink" as const },
					to: { raw: "[[Bob]]", target: "Bob", kind: "wikilink" as const },
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
			types: ["friend"],
			fromRole: "Friend",
			toRole: "Friend",
			closeness: 4,
			since: "2018-03-01",
			lastContact: "2026-07-18",
			status: "active",
		});
		expect(edges.every((edge) => !("direction" in edge))).toBe(true);
	});

	it("does not resolve a duplicate person ID by first match", () => {
		const duplicatePeople: RawIndexSnapshot = {
			people: [
				{
					id: "duplicate",
					filePath: "People/Alice.md",
					name: "Alice",
					aliases: [],
					organisations: [],
					emails: [],
					phones: [],
					contacts: [],
				},
				{
					id: "duplicate",
					filePath: "People/Bob.md",
					name: "Bob",
					aliases: [],
					organisations: [],
					emails: [],
					phones: [],
					contacts: [],
				},
				{
					id: "carol",
					filePath: "People/Carol.md",
					name: "Carol",
					aliases: [],
					organisations: [],
					emails: [],
					phones: [],
					contacts: [{ raw: "duplicate", target: "duplicate", kind: "id" }],
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

	it("fails closed when a wikilink path conflicts with another person's ID", () => {
		const source: PersonRecord = {
			id: "source",
			filePath: "People/Source.md",
			name: "Source",
			aliases: [],
			organisations: [],
			emails: [],
			phones: [],
			contacts: [
				{
					raw: "[[Bob]]",
					target: "Bob",
					kind: "wikilink" as const,
					resolvedPath: "People/Bob.md",
				},
			],
		};
		const alice = raw.people[0];
		const bob = raw.people[1];
		if (!alice || !bob) throw new Error("Test fixture is incomplete.");
		const idOwned = { ...alice, id: "Bob", filePath: "People/A.md", name: "ID-owned Bob", contacts: [] };
		const pathOwned = { ...bob, id: "person-bob", filePath: "People/Bob.md", name: "Path-owned Bob" };
		const relationship: RawIndexSnapshot["relationships"][number] = {
			id: "relationship-source-bob",
			filePath: "Relationships/Source-Bob.md",
			from: { raw: "source", target: "source", kind: "id" },
			to: {
				raw: "[[Bob]]",
				target: "Bob",
				kind: "wikilink" as const,
				resolvedPath: "People/Bob.md",
			},
			types: ["friend"],
		};

		const snapshot = buildAtlasSnapshot(
			{ people: [source, idOwned, pathOwned], relationships: [relationship] },
			() => undefined,
		);

		expect(snapshot.edges).toEqual([]);
		expect(snapshot.nodes.some((node) => node.kind === "ghost")).toBe(false);
		expect(snapshot.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "ambiguous-person-reference",
					filePaths: ["People/Source.md", "People/A.md", "People/Bob.md"],
				}),
				expect.objectContaining({
					code: "ambiguous-person-reference",
					filePaths: ["Relationships/Source-Bob.md", "People/A.md", "People/Bob.md"],
				}),
			]),
		);
	});

	it("keeps a resolved relationship to a filtered person distinct from unresolved data", () => {
		const alice = raw.people[0];
		const bob = raw.people[1];
		if (!alice || !bob) throw new Error("Test fixture is incomplete.");
		const visibleAlice = { ...alice, contacts: [] };
		const relationship = {
			id: "rel-filtered",
			filePath: "Relationships/Alice-Bob.md",
			from: { raw: "[[Alice]]", target: "Alice", kind: "wikilink" as const },
			to: { raw: "[[Bob]]", target: "Bob", kind: "wikilink" as const },
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

	it("projects only unique actionable contact moments and sanitizes invalid follow-up metadata", () => {
		const people = raw.people.map((person) => ({ ...person, contacts: [] }));
		const relationship = {
			id: "rel-alice-bob",
			filePath: "Relationships/Alice-Bob.md",
			from: { raw: "alice", target: "alice", kind: "id" as const },
			to: { raw: "bob", target: "bob", kind: "id" as const },
			types: ["friend"],
		};
		const valid = contactMoment("valid", "Moments/Valid.md", ["alice", "bob"], {
			relationship: { raw: "rel-alice-bob", target: "rel-alice-bob", kind: "id" as const },
			relationshipId: "rel-alice-bob",
			channel: " call ",
			summary: " caught up ",
			followUpOn: "2026-08-01",
			followUpActionable: true,
		});
		const terminal = contactMoment("terminal", "Moments/Terminal.md", ["alice"], {
			followUpOn: "2026-08-02",
			followUpStatus: "done",
		});
		const invalidDate = contactMoment("invalid-date", "Moments/Invalid date.md", ["alice"], {
			followUpOn: "2026-02-30",
		});
		const invalidStatus = contactMoment("invalid-status", "Moments/Invalid status.md", ["alice"], {
			followUpOn: "2026-08-03",
			followUpStatus: undefined,
			followUpActionable: false,
		});
		const duplicateA = contactMoment("duplicate", "Moments/Duplicate A.md", ["alice"]);
		const duplicateB = contactMoment("duplicate", "Moments/Duplicate B.md", ["alice"]);
		const malformed = contactMoment("malformed", "Moments/Malformed.md", ["alice"], { actionable: false });
		const withoutMoments = buildAtlasSnapshot({ people, relationships: [relationship] }, () => undefined);
		const snapshot = buildAtlasSnapshot(
			{
				people,
				relationships: [relationship],
				contactMoments: [valid, terminal, invalidDate, invalidStatus, duplicateA, duplicateB, malformed],
			},
			() => undefined,
		);

		expect(snapshot.contactMoments).toEqual([
			expect.objectContaining({ id: "invalid-date", personIds: ["alice"] }),
			expect.objectContaining({ id: "invalid-status", personIds: ["alice"] }),
			expect.objectContaining({
				id: "terminal",
				followUpOn: "2026-08-02",
				followUpStatus: "done",
			}),
			expect.objectContaining({
				id: "valid",
				personIds: ["alice", "bob"],
				relationshipId: "rel-alice-bob",
				channel: "call",
				summary: "caught up",
				followUpOn: "2026-08-01",
			}),
		]);
		expect(snapshot.contactMoments.find((moment) => moment.id === "invalid-date")).not.toHaveProperty("followUpOn");
		expect(snapshot.contactMoments.find((moment) => moment.id === "invalid-status")).not.toHaveProperty("followUpOn");
		expect(snapshot.hiddenContactMomentCount).toBe(0);
		expect(snapshot.nodes).toEqual(withoutMoments.nodes);
		expect(snapshot.edges).toEqual(withoutMoments.edges);
		expect(snapshot.hiddenEdgeCount).toBe(withoutMoments.hiddenEdgeCount);
	});

	it("hides Bases moments once unless every participant and linked relationship endpoint is visible", () => {
		const people = [
			...raw.people.map((person) => ({ ...person, contacts: [] })),
			{
				id: "carol",
				filePath: "People/Carol.md",
				name: "Carol",
				aliases: [],
				organisations: [],
				emails: [],
				phones: [],
				contacts: [],
			},
		];
		const alice = people.find((person) => person.id === "alice");
		if (!alice) throw new Error("Alice fixture is missing.");
		const relationship = {
			id: "rel-alice-bob",
			filePath: "Relationships/Alice-Bob.md",
			from: { raw: "alice", target: "alice", kind: "id" as const },
			to: { raw: "bob", target: "bob", kind: "id" as const },
			types: ["friend"],
		};
		const hiddenMulti = contactMoment("hidden-multi", "Moments/Alice, Bob and Carol.md", ["alice", "bob", "carol"]);
		const hiddenRelationship = contactMoment("hidden-relationship", "Moments/Alice relationship.md", ["alice"], {
			relationship: { raw: "rel-alice-bob", target: "rel-alice-bob", kind: "id" as const },
			relationshipId: "rel-alice-bob",
		});
		const visible = contactMoment("visible", "Moments/Alice.md", ["alice"]);
		const invalid = contactMoment("invalid", "Moments/Alice invalid.md", ["alice"], { actionable: false });
		const canonical: RawIndexSnapshot = {
			people,
			relationships: [relationship],
			contactMoments: [hiddenMulti, hiddenRelationship, visible, invalid],
			diagnostics: [
				{
					id: "invalid-contact-moment-follow-up-status:Moments/Alice, Bob and Carol.md",
					severity: "error",
					code: "invalid-contact-moment-follow-up-status",
					message: "Hidden Bob must not leak.",
					filePaths: [hiddenMulti.filePath],
				},
				{
					id: "invalid-contact-moment-occurred-on:Moments/Alice invalid.md",
					severity: "error",
					code: "invalid-contact-moment-occurred-on",
					message: "Visible invalid moment.",
					filePaths: [invalid.filePath],
				},
			],
		};
		const snapshot = buildGraphSnapshot(
			{
				visible: { people: [alice], relationships: [], diagnostics: [] },
				canonical,
			},
			() => undefined,
		);

		expect(snapshot.contactMoments.map((moment) => moment.id)).toEqual(["visible"]);
		expect(snapshot.hiddenContactMomentCount).toBe(2);
		expect(snapshot.diagnostics.map((diagnostic) => diagnostic.id)).not.toContain(
			"invalid-contact-moment-follow-up-status:Moments/Alice, Bob and Carol.md",
		);
		expect(snapshot.diagnostics.map((diagnostic) => diagnostic.id)).toContain(
			"invalid-contact-moment-occurred-on:Moments/Alice invalid.md",
		);
	});
});
