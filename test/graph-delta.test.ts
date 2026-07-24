import { describe, expect, it } from "vitest";
import { applyGraphDelta } from "../src/graph/graph-delta";
import { buildAtlasSnapshot } from "../src/graph/build-snapshot";
import type { IndexDelta, PersonRecord, RawIndexSnapshot } from "../src/domain/types";

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
		expect(incremental.nodes.sort((left, right) => String(left.id).localeCompare(String(right.id)))).toEqual(rebuilt.nodes.sort((left, right) => String(left.id).localeCompare(String(right.id))));
		expect(incremental.edges.sort((left, right) => left.id.localeCompare(right.id))).toEqual(rebuilt.edges.sort((left, right) => left.id.localeCompare(right.id)));
		expect(incremental.diagnostics.sort((left, right) => left.id.localeCompare(right.id))).toEqual(rebuilt.diagnostics.sort((left, right) => left.id.localeCompare(right.id)));
	});
});
