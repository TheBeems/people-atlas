import { describe, expect, it } from "vitest";
import type { ContactMomentRecord, PersonRecord, RelationshipRecord } from "../src/domain/types";
import { IndexState } from "../src/index/index-state";
import type { ParsedAtlasFile } from "../src/index/frontmatter";

function person(id: string, filePath: string, contacts: PersonRecord["contacts"] = []): PersonRecord {
	return { id, filePath, name: id, aliases: [], organisations: [], emails: [], phones: [], contacts };
}

function referenceKind(target: string): "id" | "path" {
	return target.includes("/") || target.toLowerCase().endsWith(".md") ? "path" : "id";
}

function relationship(id: string, filePath: string, from: string, to: string): RelationshipRecord {
	return {
		id,
		filePath,
		from: { raw: from, target: from, kind: "id" },
		to: { raw: to, target: to, kind: "id" },
		types: [],
	};
}

function contactMoment(
	id: string,
	filePath: string,
	people: string[],
	relationshipTarget?: string,
): ContactMomentRecord {
	return {
		id,
		filePath,
		people: people.map((target) => ({ raw: target, target, kind: referenceKind(target) })),
		relationship: relationshipTarget
			? { raw: relationshipTarget, target: relationshipTarget, kind: referenceKind(relationshipTarget) }
			: undefined,
		occurredOn: "2026-07-30",
		followUpOn: "2026-08-01",
		personIds: [],
		actionable: true,
		followUpActionable: true,
	};
}

describe("IndexState", () => {
	it("keeps duplicate IDs addressable by path", () => {
		const state = new IndexState();
		state.upsert({ filePath: "People/Alice.md", person: person("same", "People/Alice.md"), diagnostics: [] });
		state.upsert({ filePath: "People/Bob.md", person: person("same", "People/Bob.md"), diagnostics: [] });

		expect(state.getPeoplePathsById("same")).toEqual(["People/Alice.md", "People/Bob.md"]);
		expect(state.getDuplicatePersonIds()).toEqual(["same"]);
	});

	it("updates relationship ID indexes and adjacency without rebuilding the vault", () => {
		const state = new IndexState();
		state.upsert({
			filePath: "Relationships/A-B.md",
			relationship: relationship("rel-1", "Relationships/A-B.md", "alice", "bob"),
			diagnostics: [],
		});
		state.upsert({
			filePath: "Relationships/A-B-2.md",
			relationship: relationship("rel-1", "Relationships/A-B-2.md", "alice", "bob"),
			diagnostics: [],
		});

		expect(state.getRelationshipPathsById("rel-1")).toEqual(["Relationships/A-B-2.md", "Relationships/A-B.md"]);
		expect(state.getDuplicateRelationshipIds()).toEqual(["rel-1"]);
		expect(state.getAdjacency("alice")).toEqual(["Relationships/A-B-2.md", "Relationships/A-B.md"]);

		state.remove("Relationships/A-B.md");
		expect(state.getRelationshipPathsById("rel-1")).toEqual(["Relationships/A-B-2.md"]);
		expect(state.getAdjacency("alice")).toEqual(["Relationships/A-B-2.md"]);
	});

	it("marks reference dependents as affected when an identity changes", () => {
		const state = new IndexState();
		state.upsert({ filePath: "People/Alice.md", person: person("alice", "People/Alice.md"), diagnostics: [] });
		state.upsert({
			filePath: "People/Carol.md",
			person: person("carol", "People/Carol.md", [{ raw: "alice", target: "alice", kind: "id" }]),
			diagnostics: [],
		});

		const change = state.upsert({
			filePath: "People/Alice.md",
			person: person("alice-new", "People/Alice.md"),
			diagnostics: [],
		});
		expect(change.affectedPaths).toContain("People/Carol.md");
	});

	it("keeps delta revisions monotonic across rebuilds", () => {
		const state = new IndexState();
		const first = state.upsert({
			filePath: "People/Alice.md",
			person: person("alice", "People/Alice.md"),
			diagnostics: [],
		});
		state.clear();
		const second = state.upsert({ filePath: "People/Bob.md", person: person("bob", "People/Bob.md"), diagnostics: [] });
		expect(second.revision).toBeGreaterThan(first.revision);
	});

	it("resolves canonical contact-moment people and a matching note-backed relationship", () => {
		const state = new IndexState();
		state.upsert({ filePath: "People/Alice.md", person: person("alice", "People/Alice.md"), diagnostics: [] });
		state.upsert({ filePath: "People/Bob.md", person: person("bob", "People/Bob.md"), diagnostics: [] });
		state.upsert({
			filePath: "Relationships/Alice-Bob.md",
			relationship: relationship("rel-1", "Relationships/Alice-Bob.md", "alice", "bob"),
			diagnostics: [],
		});
		const moment = contactMoment(
			"moment-1",
			"People/Contact moments/Alice-Bob.md",
			["People/Alice.md", "bob"],
			"rel-1",
		);
		state.upsert({ filePath: moment.filePath, contactMoment: moment, diagnostics: [] });

		expect(state.getSnapshot().contactMoments).toEqual([
			expect.objectContaining({
				id: "moment-1",
				personIds: ["alice", "bob"],
				relationshipId: "rel-1",
				actionable: true,
				followUpActionable: true,
			}),
		]);
		expect(state.getSnapshot().diagnostics).toEqual([]);
		expect(state.getAdjacency("moment-1")).toEqual([]);
	});

	it("uses stored resolved-path evidence for relative contact-moment people", () => {
		const state = new IndexState();
		state.upsert({ filePath: "People/Id-owned.md", person: person("Bob", "People/Id-owned.md"), diagnostics: [] });
		state.upsert({
			filePath: "People/Bob.md",
			person: person("person-bob", "People/Bob.md"),
			diagnostics: [],
		});
		const moment = contactMoment("relative-path", "Moments/Relative path.md", []);
		moment.people = [
			{
				raw: "Bob.md",
				target: "Bob.md",
				kind: "path",
				resolvedPath: "People/Bob.md",
			},
		];
		state.upsert({ filePath: moment.filePath, contactMoment: moment, diagnostics: [] });

		expect(state.getSnapshot().contactMoments).toEqual([
			expect.objectContaining({ id: "relative-path", personIds: ["person-bob"], actionable: true }),
		]);
		expect(state.getSnapshot().diagnostics).toEqual([]);
	});

	it("keeps unresolved, ambiguous and mismatched contact moments indexed without first-match resolution", () => {
		const state = new IndexState();
		state.upsert({ filePath: "People/Alice.md", person: person("same", "People/Alice.md"), diagnostics: [] });
		state.upsert({ filePath: "People/Alicia.md", person: person("same", "People/Alicia.md"), diagnostics: [] });
		state.upsert({ filePath: "People/Bob.md", person: person("bob", "People/Bob.md"), diagnostics: [] });
		state.upsert({ filePath: "People/Carol.md", person: person("carol", "People/Carol.md"), diagnostics: [] });
		state.upsert({
			filePath: "Relationships/Bob-Carol.md",
			relationship: relationship("rel-bc", "Relationships/Bob-Carol.md", "bob", "carol"),
			diagnostics: [],
		});
		const ambiguous = contactMoment("moment-a", "Moments/Ambiguous.md", ["same", "missing"], "missing-rel");
		const mismatch = contactMoment("moment-b", "Moments/Mismatch.md", ["People/Alice.md"], "rel-bc");
		state.upsert({ filePath: ambiguous.filePath, contactMoment: ambiguous, diagnostics: [] });
		state.upsert({ filePath: mismatch.filePath, contactMoment: mismatch, diagnostics: [] });

		const snapshot = state.getSnapshot();
		expect(snapshot.contactMoments).toEqual([
			expect.objectContaining({ id: "moment-a", personIds: [], actionable: false, followUpActionable: false }),
			expect.objectContaining({ id: "moment-b", personIds: [], relationshipId: "rel-bc", actionable: false }),
		]);
		expect(snapshot.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual([
			"ambiguous-contact-moment-person",
			"unresolved-contact-moment-person",
			"unresolved-contact-moment-relationship",
			"ambiguous-contact-moment-person",
			"contact-moment-relationship-person-mismatch",
		]);
		expect(
			snapshot.diagnostics?.find((diagnostic) => diagnostic.code === "ambiguous-contact-moment-person")?.filePaths,
		).toEqual(["Moments/Ambiguous.md", "People/Alice.md", "People/Alicia.md"]);
	});

	it("treats conflicting ID and path evidence as ambiguous for people and relationships", () => {
		const alice = person("alice", "People/Alice.md");
		const bob = person("bob", "People/Bob.md");
		const idOwnedPerson = person("People/Path-owned.md", "People/Id-owned.md");
		const pathOwnedPerson = person("path-owned-person", "People/Path-owned.md");
		const idOwnedRelationship = relationship("relationship-token", "Relationships/Id-owned.md", "alice", "bob");
		const pathOwnedRelationship = relationship(
			"path-owned-relationship",
			"Relationships/Path-owned.md",
			"alice",
			"bob",
		);
		const personConflict = contactMoment("person-conflict", "Moments/Person conflict.md", ["People/Path-owned.md"]);
		personConflict.people = [
			{
				raw: "[[People/Path-owned.md]]",
				target: "People/Path-owned.md",
				kind: "wikilink",
				resolvedPath: "People/Path-owned.md",
			},
		];
		const relationshipConflict = contactMoment(
			"relationship-conflict",
			"Moments/Relationship conflict.md",
			["alice"],
			"relationship-token",
		);
		relationshipConflict.relationship = {
			raw: "[[relationship-token]]",
			target: "relationship-token",
			kind: "wikilink",
			resolvedPath: "Relationships/Path-owned.md",
		};
		const records: ParsedAtlasFile[] = [
			{ filePath: alice.filePath, person: alice, diagnostics: [] },
			{ filePath: bob.filePath, person: bob, diagnostics: [] },
			{ filePath: idOwnedPerson.filePath, person: idOwnedPerson, diagnostics: [] },
			{ filePath: pathOwnedPerson.filePath, person: pathOwnedPerson, diagnostics: [] },
			{
				filePath: idOwnedRelationship.filePath,
				relationship: idOwnedRelationship,
				diagnostics: [],
			},
			{
				filePath: pathOwnedRelationship.filePath,
				relationship: pathOwnedRelationship,
				diagnostics: [],
			},
			{ filePath: personConflict.filePath, contactMoment: personConflict, diagnostics: [] },
			{
				filePath: relationshipConflict.filePath,
				contactMoment: relationshipConflict,
				diagnostics: [],
			},
		];
		const snapshots = [records, [...records].reverse()].map((orderedRecords) => {
			const state = new IndexState();
			for (const record of orderedRecords) state.upsert(record);
			return state.getSnapshot();
		});
		const comparable = snapshots.map((snapshot) => ({
			moments: [...(snapshot.contactMoments ?? [])].sort((left, right) => left.filePath.localeCompare(right.filePath)),
			diagnostics: [...(snapshot.diagnostics ?? [])]
				.map((diagnostic) => ({ ...diagnostic, filePaths: [...diagnostic.filePaths].sort() }))
				.sort((left, right) => left.id.localeCompare(right.id)),
		}));

		expect(comparable[0]).toEqual(comparable[1]);
		expect(comparable[0]?.moments).toEqual([
			expect.objectContaining({
				id: "person-conflict",
				personIds: [],
				actionable: false,
			}),
			expect.objectContaining({
				id: "relationship-conflict",
				personIds: ["alice"],
				relationshipId: undefined,
				actionable: false,
			}),
		]);
		expect(comparable[0]?.diagnostics).toEqual([
			expect.objectContaining({
				code: "ambiguous-contact-moment-person",
				filePaths: ["Moments/Person conflict.md", "People/Id-owned.md", "People/Path-owned.md"],
			}),
			expect.objectContaining({
				code: "ambiguous-contact-moment-relationship",
				filePaths: ["Moments/Relationship conflict.md", "Relationships/Id-owned.md", "Relationships/Path-owned.md"],
			}),
		]);
	});

	it("does not resolve an unresolved wikilink through a matching person ID", () => {
		const state = new IndexState();
		const idOwnedPerson = person("Bob", "People/Id-owned.md");
		const moment = contactMoment("unresolved-wikilink", "Moments/Unresolved wikilink.md", []);
		moment.people = [{ raw: "[[Bob]]", target: "Bob", kind: "wikilink" }];
		state.upsert({ filePath: idOwnedPerson.filePath, person: idOwnedPerson, diagnostics: [] });
		state.upsert({ filePath: moment.filePath, contactMoment: moment, diagnostics: [] });

		const snapshot = state.getSnapshot();
		expect(snapshot.contactMoments).toEqual([
			expect.objectContaining({ id: moment.id, personIds: [], actionable: false }),
		]);
		expect(snapshot.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "unresolved-contact-moment-person",
				filePaths: [moment.filePath],
			}),
		);
	});

	it("marks every duplicate contact-moment ID invalid and invalidates reference dependents incrementally", () => {
		const state = new IndexState();
		state.upsert({ filePath: "People/Alice.md", person: person("alice", "People/Alice.md"), diagnostics: [] });
		state.upsert({ filePath: "People/Bob.md", person: person("bob", "People/Bob.md"), diagnostics: [] });
		state.upsert({
			filePath: "Relationships/Alice-Bob.md",
			relationship: relationship("rel-1", "Relationships/Alice-Bob.md", "alice", "bob"),
			diagnostics: [],
		});
		const first = contactMoment("duplicate", "Moments/First.md", ["alice"], "rel-1");
		const second = contactMoment("duplicate", "Moments/Second.md", ["alice"], "rel-1");
		state.upsert({ filePath: first.filePath, contactMoment: first, diagnostics: [] });
		const duplicateChange = state.upsert({ filePath: second.filePath, contactMoment: second, diagnostics: [] });

		expect(duplicateChange.affectedPaths).toEqual(new Set(["Moments/Second.md", "Moments/First.md"]));
		expect(state.getDuplicateContactMomentIds()).toEqual(["duplicate"]);
		expect(state.getContactMomentPathsById("duplicate")).toEqual(["Moments/First.md", "Moments/Second.md"]);
		expect(state.getSnapshot().contactMoments?.every((moment) => !moment.actionable)).toBe(true);
		expect(state.getSnapshot().diagnostics).toContainEqual(
			expect.objectContaining({
				code: "duplicate-contact-moment-id",
				filePaths: ["Moments/First.md", "Moments/Second.md"],
			}),
		);

		const personChange = state.upsert({
			filePath: "People/Alice.md",
			person: person("alice-new", "People/Alice.md"),
			diagnostics: [],
		});
		expect([...personChange.affectedPaths]).toEqual(expect.arrayContaining(["Moments/First.md", "Moments/Second.md"]));
		const relationshipChange = state.upsert({
			filePath: "Relationships/Alice-Bob.md",
			relationship: relationship("rel-2", "Relationships/Alice-Bob.md", "alice-new", "bob"),
			diagnostics: [],
		});
		expect([...relationshipChange.affectedPaths]).toEqual(
			expect.arrayContaining(["Moments/First.md", "Moments/Second.md"]),
		);
	});
});
