import { describe, expect, it } from "vitest";
import type { PersonRecord, RelationshipRecord } from "../src/domain/types";
import { IndexState } from "../src/index/index-state";

function person(id: string, filePath: string, contacts: PersonRecord["contacts"] = []): PersonRecord {
	return { id, filePath, name: id, aliases: [], organisations: [], contacts };
}

function relationship(id: string, filePath: string, from: string, to: string): RelationshipRecord {
	return {
		id,
		filePath,
		from: { raw: `[[${from}]]`, target: from },
		to: { raw: `[[${to}]]`, target: to },
		direction: "undirected",
		types: [],
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
		state.upsert({ filePath: "Relationships/A-B.md", relationship: relationship("rel-1", "Relationships/A-B.md", "alice", "bob"), diagnostics: [] });
		state.upsert({ filePath: "Relationships/A-B-2.md", relationship: relationship("rel-1", "Relationships/A-B-2.md", "alice", "bob"), diagnostics: [] });

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
			person: person("carol", "People/Carol.md", [{ raw: "alice", target: "alice" }]),
			diagnostics: [],
		});

		const change = state.upsert({ filePath: "People/Alice.md", person: person("alice-new", "People/Alice.md"), diagnostics: [] });
		expect(change.affectedPaths).toContain("People/Carol.md");
	});

	it("keeps delta revisions monotonic across rebuilds", () => {
		const state = new IndexState();
		const first = state.upsert({ filePath: "People/Alice.md", person: person("alice", "People/Alice.md"), diagnostics: [] });
		state.clear();
		const second = state.upsert({ filePath: "People/Bob.md", person: person("bob", "People/Bob.md"), diagnostics: [] });
		expect(second.revision).toBeGreaterThan(first.revision);
	});
});
