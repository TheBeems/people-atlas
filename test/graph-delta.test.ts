import { describe, expect, it } from "vitest";
import { applyGraphDelta } from "../src/graph/graph-delta";
import { buildAtlasSnapshot } from "../src/graph/build-snapshot";
import type {
	AtlasSnapshot,
	IndexDelta,
	PersonRecord,
	RawIndexSnapshot,
	RelationshipRecord,
} from "../src/domain/types";

function person(id: string, filePath: string, contacts: string[] = []): PersonRecord {
	return {
		id,
		filePath,
		name: id,
		aliases: [],
		organisations: [],
		contacts: contacts.map((target) => ({ raw: `[[${target}]]`, target })),
	};
}

const resolve = (target: string) => `People/${target}.md`;

function comparable(snapshot: AtlasSnapshot) {
	return {
		nodes: [...snapshot.nodes].sort((left, right) => left.id.localeCompare(right.id)),
		edges: [...snapshot.edges].sort((left, right) => left.id.localeCompare(right.id)),
		diagnostics: snapshot.diagnostics
			.map((diagnostic) => ({ ...diagnostic, filePaths: [...diagnostic.filePaths].sort() }))
			.sort((left, right) => left.id.localeCompare(right.id)),
		hiddenNodeCount: snapshot.hiddenNodeCount,
		hiddenEdgeCount: snapshot.hiddenEdgeCount,
	};
}

describe("applyGraphDelta", () => {
	it("matches a full rebuild when a single contact file changes", () => {
		const alice = person("alice", "People/Alice.md", ["bob"]);
		const bob = person("bob", "People/Bob.md");
		const carol = person("carol", "People/Carol.md");
		const before: RawIndexSnapshot = { people: [alice, bob, carol], relationships: [], diagnostics: [] };
		const previous = buildAtlasSnapshot(before, resolve);
		const changedAlice = person("alice", "People/Alice.md", ["carol"]);
		const after: RawIndexSnapshot = { people: [changedAlice, bob, carol], relationships: [], diagnostics: [] };
		const delta: IndexDelta = {
			revision: 1,
			changedPaths: ["People/Alice.md"],
			removedPaths: [],
			affectedPersonIds: ["alice"],
			affectedRelationshipIds: [],
			addedPeople: [],
			updatedPeople: [changedAlice],
			removedPeople: [],
			addedRelationships: [],
			updatedRelationships: [],
			removedRelationships: [],
			affectedPeople: [changedAlice],
			affectedRelationships: [],
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
		};

		const incremental = applyGraphDelta(previous, delta, resolve, { resolutionPeople: after.people });
		const rebuilt = buildAtlasSnapshot(after, resolve);
		expect(incremental.nodes.sort((left, right) => String(left.id).localeCompare(String(right.id)))).toEqual(
			rebuilt.nodes.sort((left, right) => String(left.id).localeCompare(String(right.id))),
		);
		expect(incremental.edges.sort((left, right) => left.id.localeCompare(right.id))).toEqual(
			rebuilt.edges.sort((left, right) => left.id.localeCompare(right.id)),
		);
		expect(incremental.diagnostics.sort((left, right) => left.id.localeCompare(right.id))).toEqual(
			rebuilt.diagnostics.sort((left, right) => left.id.localeCompare(right.id)),
		);
	});

	it("matches filtered-contact counts and diagnostics for multiple contacts from one note", () => {
		const alice = person("alice", "People/Alice.md", ["Bob", "Carol"]);
		const allPeople = [alice, person("bob", "People/Bob.md"), person("carol", "People/Carol.md")];
		const visible: RawIndexSnapshot = { people: [alice], relationships: [], diagnostics: [] };
		const previous = buildAtlasSnapshot(visible, resolve, { resolutionPeople: allPeople });
		const delta: IndexDelta = {
			revision: 1,
			changedPaths: [alice.filePath],
			removedPaths: [],
			affectedPersonIds: [alice.id],
			affectedRelationshipIds: [],
			addedPeople: [],
			updatedPeople: [alice],
			removedPeople: [],
			addedRelationships: [],
			updatedRelationships: [],
			removedRelationships: [],
			affectedPeople: [alice],
			affectedRelationships: [],
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
		};

		const incremental = applyGraphDelta(previous, delta, resolve, {
			resolutionPeople: allPeople,
			visiblePaths: new Set([alice.filePath]),
		});
		const rebuilt = buildAtlasSnapshot(visible, resolve, { resolutionPeople: allPeople });

		expect(rebuilt.hiddenEdgeCount).toBe(2);
		expect(comparable(incremental)).toEqual(comparable(rebuilt));
	});

	it("matches full rebuilds when a duplicate person ID appears and disappears", () => {
		const alice = person("alice", "People/Alice.md", ["Bob"]);
		const bob = person("bob", "People/Bob.md");
		const before = buildAtlasSnapshot({ people: [alice, bob], relationships: [], diagnostics: [] }, resolve);
		const duplicate = person("alice", "People/Alicia.md");
		const duplicateDiagnostic = {
			id: "duplicate-person-id:alice",
			severity: "error" as const,
			code: "duplicate-person-id" as const,
			message: "Multiple person notes use the ID “alice”.",
			filePaths: [alice.filePath, duplicate.filePath],
		};
		const addedDelta: IndexDelta = {
			revision: 1,
			changedPaths: [duplicate.filePath],
			removedPaths: [],
			affectedPersonIds: ["alice"],
			affectedRelationshipIds: [],
			addedPeople: [duplicate],
			updatedPeople: [],
			removedPeople: [],
			addedRelationships: [],
			updatedRelationships: [],
			removedRelationships: [],
			affectedPeople: [duplicate],
			affectedRelationships: [],
			diagnostics: [duplicateDiagnostic],
			duplicatePersonIds: ["alice"],
			duplicateRelationshipIds: [],
		};
		const peopleWithDuplicate = [alice, duplicate, bob];
		const incrementalDuplicate = applyGraphDelta(before, addedDelta, resolve, {
			resolutionPeople: peopleWithDuplicate,
		});
		const rebuiltDuplicate = buildAtlasSnapshot(
			{ people: peopleWithDuplicate, relationships: [], diagnostics: [] },
			resolve,
		);

		expect(comparable(incrementalDuplicate)).toEqual(comparable(rebuiltDuplicate));

		const removedDelta: IndexDelta = {
			revision: 2,
			changedPaths: [duplicate.filePath],
			removedPaths: [duplicate.filePath],
			affectedPersonIds: ["alice"],
			affectedRelationshipIds: [],
			addedPeople: [],
			updatedPeople: [],
			removedPeople: [duplicate],
			addedRelationships: [],
			updatedRelationships: [],
			removedRelationships: [],
			affectedPeople: [],
			affectedRelationships: [],
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
		};
		const incrementalRestored = applyGraphDelta(incrementalDuplicate, removedDelta, resolve, {
			resolutionPeople: [alice, bob],
		});
		const rebuiltRestored = buildAtlasSnapshot({ people: [alice, bob], relationships: [], diagnostics: [] }, resolve);

		expect(comparable(incrementalRestored)).toEqual(comparable(rebuiltRestored));
	});

	it("matches a full rebuild when resolving a ghost and adding rich relationship metadata", () => {
		const alice = person("alice", "People/Alice.md", ["missing"]);
		const bob = person("bob", "People/Bob.md");
		const previous = buildAtlasSnapshot({ people: [alice, bob], relationships: [], diagnostics: [] }, resolve);
		const changedAlice = person("alice", "People/Alice.md", ["bob"]);
		const relationship: RelationshipRecord = {
			id: "relationship-alice-bob",
			filePath: "Relationships/alice-bob.md",
			from: { raw: "alice", target: "alice" },
			to: { raw: "bob", target: "bob" },
			presetId: "friend-mentor",
			fromRole: "Friend",
			toRole: "Friend",
			direction: "source-to-target",
			types: ["friend", "mentor"],
			closeness: 5,
			since: "2020-01-02",
			lastContact: "2026-07-26",
			status: "active",
		};
		const after: RawIndexSnapshot = {
			people: [changedAlice, bob],
			relationships: [relationship],
			diagnostics: [],
		};
		const delta: IndexDelta = {
			revision: 1,
			changedPaths: [changedAlice.filePath, relationship.filePath],
			removedPaths: [],
			affectedPersonIds: [changedAlice.id, bob.id],
			affectedRelationshipIds: [relationship.id],
			addedPeople: [],
			updatedPeople: [changedAlice],
			removedPeople: [],
			addedRelationships: [relationship],
			updatedRelationships: [],
			removedRelationships: [],
			affectedPeople: [changedAlice],
			affectedRelationships: [relationship],
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
		};

		const incremental = applyGraphDelta(previous, delta, resolve, { resolutionPeople: after.people });
		const rebuilt = buildAtlasSnapshot(after, resolve);

		expect(comparable(incremental)).toEqual(comparable(rebuilt));
		expect(incremental.nodes.some((node) => node.kind === "ghost")).toBe(false);
		expect(incremental.diagnostics.some((diagnostic) => diagnostic.code === "unresolved-contact")).toBe(false);
		expect(incremental.edges.find((edge) => edge.id === relationship.id)).toMatchObject({
			presetId: relationship.presetId,
			types: relationship.types,
			fromRole: relationship.fromRole,
			toRole: relationship.toRole,
			closeness: relationship.closeness,
			direction: relationship.direction,
			since: relationship.since,
			lastContact: relationship.lastContact,
			status: relationship.status,
		});
	});
});
