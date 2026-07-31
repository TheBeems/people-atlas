import { describe, expect, it } from "vitest";
import { applyGraphDelta } from "../src/graph/graph-delta";
import { buildAtlasSnapshot } from "../src/graph/build-snapshot";
import { buildGraphSnapshot } from "../src/graph/graph-source";
import type {
	AtlasSnapshot,
	ContactMomentRecord,
	IndexDelta,
	PersonRecord,
	RawIndexSnapshot,
	RelationshipRecord,
} from "../src/domain/types";

function person(
	id: string,
	filePath: string,
	contacts: string[] = [],
	overrides: Partial<PersonRecord> = {},
): PersonRecord {
	return {
		id,
		filePath,
		name: id,
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: contacts.map((target) => ({ raw: `[[${target}]]`, target })),
		...overrides,
	};
}

function contactMoment(id: string, filePath: string, personIds: string[]): ContactMomentRecord {
	return {
		id,
		filePath,
		people: personIds.map((personId) => ({ raw: personId, target: personId })),
		occurredOn: "2026-07-30",
		personIds,
		actionable: true,
		followUpActionable: false,
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
		contactMoments: [...snapshot.contactMoments].sort(
			(left, right) => left.id.localeCompare(right.id) || left.filePath.localeCompare(right.filePath),
		),
		hiddenContactMomentCount: snapshot.hiddenContactMomentCount,
	};
}

describe("applyGraphDelta", () => {
	it("matches a full rebuild when a single contact file changes", () => {
		const alice = person("alice", "People/Alice.md", ["bob"]);
		const bob = person("bob", "People/Bob.md");
		const carol = person("carol", "People/Carol.md");
		const before: RawIndexSnapshot = { people: [alice, bob, carol], relationships: [], diagnostics: [] };
		const previous = buildAtlasSnapshot(before, resolve);
		const changedAlice = person("alice", "People/Alice.md", ["carol"], {
			birthDate: "1990-07-30",
			pronouns: "she/her",
			gender: "woman",
			emails: ["alice@example.test"],
			phones: ["+31 6 1234"],
			jobTitle: "Engineer",
		});
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
		expect(incremental.nodes.find((node) => node.id === "alice")).toMatchObject({
			birthDate: "1990-07-30",
			pronouns: "she/her",
			gender: "woman",
			emails: ["alice@example.test"],
			phones: ["+31 6 1234"],
			jobTitle: "Engineer",
		});
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
			since: relationship.since,
			lastContact: relationship.lastContact,
			status: relationship.status,
		});
		expect(incremental.edges.every((edge) => !("direction" in edge))).toBe(true);
	});

	it("refreshes Bases contact summaries and hidden counts without changing graph structure", () => {
		const alice = person("alice", "People/Alice.md");
		const bob = person("bob", "People/Bob.md");
		const relationship: RelationshipRecord = {
			id: "rel-alice-bob",
			filePath: "Relationships/Alice-Bob.md",
			from: { raw: "alice", target: "alice" },
			to: { raw: "bob", target: "bob" },
			types: ["friend"],
		};
		const beforeMoment: ContactMomentRecord = {
			id: "moment-1",
			filePath: "Moments/One.md",
			people: [{ raw: "alice", target: "alice" }],
			occurredOn: "2026-07-30",
			personIds: ["alice"],
			actionable: true,
			followUpActionable: false,
		};
		const afterMoment: ContactMomentRecord = {
			...beforeMoment,
			people: [
				{ raw: "alice", target: "alice" },
				{ raw: "bob", target: "bob" },
			],
			personIds: ["alice", "bob"],
			relationship: { raw: "rel-alice-bob", target: "rel-alice-bob" },
			relationshipId: "rel-alice-bob",
			followUpOn: "2026-02-30",
			followUpActionable: false,
		};
		const visible: RawIndexSnapshot = { people: [alice], relationships: [], diagnostics: [] };
		const beforeCanonical: RawIndexSnapshot = {
			people: [alice, bob],
			relationships: [relationship],
			contactMoments: [beforeMoment],
			diagnostics: [],
		};
		const afterCanonical: RawIndexSnapshot = {
			...beforeCanonical,
			contactMoments: [afterMoment],
			diagnostics: [
				{
					id: `invalid-contact-moment-follow-up-date:${afterMoment.filePath}`,
					severity: "error",
					code: "invalid-contact-moment-follow-up-date",
					message: "Hidden co-participant must not leak through a delta.",
					filePaths: [afterMoment.filePath],
				},
			],
		};
		const previous = buildGraphSnapshot({ visible, canonical: beforeCanonical }, resolve);
		const delta: IndexDelta = {
			revision: 1,
			changedPaths: [afterMoment.filePath],
			removedPaths: [],
			affectedPersonIds: [],
			affectedRelationshipIds: [],
			affectedContactMomentIds: [afterMoment.id],
			addedPeople: [],
			updatedPeople: [],
			removedPeople: [],
			addedRelationships: [],
			updatedRelationships: [],
			removedRelationships: [],
			addedContactMoments: [],
			updatedContactMoments: [afterMoment],
			removedContactMoments: [],
			affectedPeople: [],
			affectedRelationships: [],
			affectedContactMoments: [afterMoment],
			diagnostics: afterCanonical.diagnostics ?? [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
			duplicateContactMomentIds: [],
		};

		const incremental = applyGraphDelta(previous, delta, resolve, {
			resolutionPeople: afterCanonical.people,
			visiblePaths: new Set([alice.filePath]),
			contactMoments: afterCanonical.contactMoments ?? [],
			relationships: afterCanonical.relationships,
		});
		const rebuilt = buildGraphSnapshot({ visible, canonical: afterCanonical }, resolve);

		expect(comparable(incremental)).toEqual(comparable(rebuilt));
		expect(incremental.contactMoments).toEqual([]);
		expect(incremental.hiddenContactMomentCount).toBe(1);
		expect(
			incremental.diagnostics.some((diagnostic) => diagnostic.code === "invalid-contact-moment-follow-up-date"),
		).toBe(false);
		expect(incremental.nodes).toEqual(previous.nodes);
		expect(incremental.edges).toEqual(previous.edges);
	});

	it("rejects a meaningful contact-moment delta without complete current projection sources", () => {
		const alice = person("alice", "People/Alice.md");
		const addedMoment = contactMoment("moment-added", "Moments/Added.md", ["alice"]);
		const previous = buildAtlasSnapshot({ people: [alice], relationships: [] }, resolve);
		const delta: IndexDelta = {
			revision: 1,
			changedPaths: [addedMoment.filePath],
			removedPaths: [],
			affectedPersonIds: [],
			affectedRelationshipIds: [],
			affectedContactMomentIds: [addedMoment.id],
			addedPeople: [],
			updatedPeople: [],
			removedPeople: [],
			addedRelationships: [],
			updatedRelationships: [],
			removedRelationships: [],
			addedContactMoments: [addedMoment],
			updatedContactMoments: [],
			removedContactMoments: [],
			affectedPeople: [],
			affectedRelationships: [],
			affectedContactMoments: [addedMoment],
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
			duplicateContactMomentIds: [],
		};

		expect(() =>
			applyGraphDelta(previous, delta, resolve, {
				resolutionPeople: [alice],
			}),
		).toThrow("Contact-moment deltas require complete current contactMoments and relationships projection sources.");
	});

	it("preserves a safe visible contact-moment diagnostic for a filtered legacy no-op delta", () => {
		const alice = person("alice", "People/Alice.md");
		const bob = person("bob", "People/Bob.md");
		const people = [alice, bob];
		const visible: RawIndexSnapshot = { people: [alice], relationships: [], diagnostics: [] };
		const moment = contactMoment("moment-visible", "Moments/Visible.md", ["alice"]);
		const diagnostic = {
			id: `invalid-contact-moment-follow-up-date:${moment.filePath}`,
			severity: "error" as const,
			code: "invalid-contact-moment-follow-up-date" as const,
			message: "Visible contact moment has an invalid follow-up date.",
			filePaths: [moment.filePath],
		};
		const canonical: RawIndexSnapshot = {
			people,
			relationships: [],
			contactMoments: [moment],
			diagnostics: [diagnostic],
		};
		const previous = buildGraphSnapshot({ visible, canonical }, resolve);
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
			resolutionPeople: people,
			visiblePaths: new Set([alice.filePath]),
		});
		const rebuilt = buildGraphSnapshot({ visible, canonical }, resolve);

		expect(comparable(incremental)).toEqual(comparable(rebuilt));
		expect(incremental.diagnostics).toContainEqual(diagnostic);
		expect(incremental.contactMoments).toEqual(previous.contactMoments);
		expect(incremental.hiddenContactMomentCount).toBe(previous.hiddenContactMomentCount);
	});

	it.each([
		{
			label: "hidden to visible",
			beforePersonIds: ["alice", "bob"],
			afterPersonIds: ["alice"],
			removed: false,
			expectedHiddenCount: 0,
		},
		{
			label: "visible to hidden",
			beforePersonIds: ["alice"],
			afterPersonIds: ["alice", "bob"],
			removed: false,
			expectedHiddenCount: 1,
		},
		{
			label: "hidden removal",
			beforePersonIds: ["alice", "bob"],
			afterPersonIds: [],
			removed: true,
			expectedHiddenCount: 0,
		},
	])("matches a full Bases rebuild for contact-moment $label", ({
		beforePersonIds,
		afterPersonIds,
		removed,
		expectedHiddenCount,
	}) => {
		const alice = person("alice", "People/Alice.md");
		const bob = person("bob", "People/Bob.md");
		const people = [alice, bob];
		const visible: RawIndexSnapshot = { people: [alice], relationships: [], diagnostics: [] };
		const beforeMoment = contactMoment("moment-transition", "Moments/Transition.md", beforePersonIds);
		const afterMoment = removed
			? undefined
			: contactMoment("moment-transition", "Moments/Transition.md", afterPersonIds);
		const beforeCanonical: RawIndexSnapshot = {
			people,
			relationships: [],
			contactMoments: [beforeMoment],
			diagnostics: [],
		};
		const afterContactMoments = afterMoment ? [afterMoment] : [];
		const afterCanonical: RawIndexSnapshot = {
			people,
			relationships: [],
			contactMoments: afterContactMoments,
			diagnostics: [],
		};
		const previous = buildGraphSnapshot({ visible, canonical: beforeCanonical }, resolve);
		const delta: IndexDelta = {
			revision: 1,
			changedPaths: [beforeMoment.filePath],
			removedPaths: removed ? [beforeMoment.filePath] : [],
			affectedPersonIds: [],
			affectedRelationshipIds: [],
			affectedContactMomentIds: [beforeMoment.id],
			addedPeople: [],
			updatedPeople: [],
			removedPeople: [],
			addedRelationships: [],
			updatedRelationships: [],
			removedRelationships: [],
			addedContactMoments: [],
			updatedContactMoments: afterMoment ? [afterMoment] : [],
			removedContactMoments: removed ? [beforeMoment] : [],
			affectedPeople: [],
			affectedRelationships: [],
			affectedContactMoments: afterContactMoments,
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
			duplicateContactMomentIds: [],
		};

		const incremental = applyGraphDelta(previous, delta, resolve, {
			resolutionPeople: people,
			visiblePaths: new Set([alice.filePath]),
			contactMoments: afterContactMoments,
			relationships: [],
		});
		const rebuilt = buildGraphSnapshot({ visible, canonical: afterCanonical }, resolve);

		expect(comparable(incremental)).toEqual(comparable(rebuilt));
		expect(incremental.hiddenContactMomentCount).toBe(expectedHiddenCount);
	});
});
