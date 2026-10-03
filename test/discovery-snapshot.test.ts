import { describe, expect, it } from "vitest";
import type {
	ContactMomentRecord,
	IndexDelta,
	PersonRecord,
	RawIndexSnapshot,
	RelationshipRecord,
} from "../src/domain/types";
import { isAmbiguousAtlasNode } from "../src/domain/node-capabilities";
import { buildGraphSnapshot, filterPermittedSnapshotDiagnostics } from "../src/graph/graph-source";
import { applyGraphDelta } from "../src/graph/graph-delta";
import { projectGraph } from "../src/graph/project-graph";

function person(id: string, path = `People/${id}.md`): PersonRecord {
	return {
		id,
		filePath: path,
		name: "Same name",
		aliases: ["Élodie"],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	};
}

function moment(personIds: string[]): ContactMomentRecord {
	return {
		id: "shared",
		filePath: "Moments/Shared.md",
		people: personIds.map((id) => ({ raw: id, target: id, kind: "id" })),
		personIds,
		occurredOn: "2026-10-01",
		followUpOn: "2026-10-10",
		followUpStatus: "open",
		actionable: true,
		followUpActionable: true,
	};
}

function delta(person: PersonRecord): IndexDelta {
	return {
		revision: 1,
		changedPaths: [person.filePath],
		removedPaths: [],
		affectedPersonIds: [person.id],
		affectedRelationshipIds: [],
		addedPeople: [],
		updatedPeople: [person],
		removedPeople: [],
		addedRelationships: [],
		updatedRelationships: [],
		removedRelationships: [],
		affectedPeople: [person],
		affectedRelationships: [],
		diagnostics: [],
		duplicatePersonIds: [],
		duplicateRelationshipIds: [],
	};
}

describe("permitted discovery snapshots", () => {
	it("carries aliases through full snapshots and incremental updates without name identity", () => {
		const alice = person("alice");
		const bob = person("bob");
		const canonical: RawIndexSnapshot = { people: [alice, bob], relationships: [] };
		const full = buildGraphSnapshot({ visible: canonical, canonical }, () => undefined);
		expect(full.nodes.map((node) => node.id)).toEqual(["alice", "bob"]);
		expect(full.nodes[0]?.aliases).toEqual(["Élodie"]);
		const updated = { ...alice, aliases: ["New alias"] };
		const incremental = applyGraphDelta(full, delta(updated), () => undefined, {
			resolutionPeople: [updated, bob],
			relationships: [],
		});
		expect(incremental.nodes.find((node) => node.id === "alice")?.aliases).toEqual(["New alias"]);
	});

	it("retains shared follow-ups outside an ego projection and excludes them when any Base person is excluded", () => {
		const alice = person("alice");
		const bob = person("bob");
		const canonical: RawIndexSnapshot = {
			people: [alice, bob],
			relationships: [],
			contactMoments: [moment([alice.id, bob.id])],
		};
		const full = buildGraphSnapshot({ visible: canonical, canonical }, () => undefined);
		const graph = projectGraph(full, { centerMode: "configured", centerId: alice.id, hops: 1 });
		expect(graph.contactMoments).toEqual([]);
		expect(graph.hiddenContactMomentCount).toBe(1);
		expect(full.contactMoments.map((item) => item.id)).toEqual(["shared"]);
		const base = buildGraphSnapshot({ visible: { people: [alice], relationships: [] }, canonical }, () => undefined);
		expect(base.contactMoments).toEqual([]);
		expect(base.hiddenContactMomentCount).toBe(1);
	});

	it("keeps the browsing population above the graph cap", () => {
		const canonical: RawIndexSnapshot = {
			people: Array.from({ length: 503 }, (_, index) => person(`person-${String(index).padStart(3, "0")}`)),
			relationships: [],
		};
		const full = buildGraphSnapshot({ visible: canonical, canonical }, () => undefined);
		const graph = projectGraph(full, { projectionMode: "free-network", maxNodes: 500 });
		expect(graph.nodes).toHaveLength(500);
		expect(full.nodes).toHaveLength(503);
		expect(full.nodes.some((node) => node.id === "person-502")).toBe(true);
	});

	it("never restores an admitted duplicate ID or exposes excluded diagnostic context", () => {
		const alice = person("duplicate", "People/Admitted.md");
		const excluded = person("duplicate", "People/Secret.md");
		const canonical: RawIndexSnapshot = {
			people: [alice, excluded],
			relationships: [],
			diagnostics: [
				{
					id: "private",
					severity: "error",
					code: "unresolved-contact",
					message: "Secret's private reference",
					filePaths: [excluded.filePath],
				},
				{
					id: "visible",
					severity: "error",
					code: "invalid-person-email",
					message: "Admitted email needs repair",
					filePaths: [alice.filePath],
				},
				{
					id: "target",
					severity: "error",
					code: "ambiguous-person-reference",
					message: "Secret is excluded",
					filePaths: [alice.filePath],
					targetPath: excluded.filePath,
				},
			],
		};
		const built = buildGraphSnapshot({ visible: { people: [alice], relationships: [] }, canonical }, () => undefined);
		expect(built.nodes).toHaveLength(1);
		const admittedNode = built.nodes[0];
		if (!admittedNode) throw new Error("The admitted duplicate person is missing.");
		expect(isAmbiguousAtlasNode(admittedNode)).toBe(true);
		const permitted = filterPermittedSnapshotDiagnostics(built, new Set([alice.filePath]));
		expect(permitted.diagnostics.filter((item) => item.code !== "duplicate-person-id").map((item) => item.id)).toEqual([
			"visible",
		]);
		expect(permitted.diagnostics.find((item) => item.code === "duplicate-person-id")).toEqual({
			id: `permitted-duplicate-person-id:${alice.filePath}`,
			code: "duplicate-person-id",
			severity: "error",
			message: "The admitted person has a duplicate stable ID and is not actionable.",
			filePaths: [alice.filePath],
		});
		expect(JSON.stringify(permitted)).not.toContain("Secret");
		const projected = projectGraph(permitted, { centerMode: "selected-node", centerId: "duplicate" });
		expect(projected.nodes.some((node) => node.isCenter)).toBe(false);
		expect(projected.diagnostics.some((item) => item.code === "projection-center-ambiguous")).toBe(true);
	});

	it("preserves only admitted structural ambiguity when a duplicate relationship is excluded", () => {
		const canonical: RawIndexSnapshot = { people: [person("alice"), person("bob")], relationships: [] };
		const snapshot = buildGraphSnapshot({ visible: canonical, canonical }, () => undefined);
		snapshot.edges.push({
			id: "stable:hash",
			sourceId: "alice",
			targetId: "bob",
			filePath: "Relationships/Admitted.md",
			types: [],
			inferred: false,
		});
		snapshot.diagnostics.push({
			id: "duplicate-relationship-id:Private label",
			code: "duplicate-relationship-id",
			severity: "error",
			message: "Private label duplicates Secret's relationship",
			filePaths: ["Relationships/Admitted.md", "Relationships/Secret.md"],
			targetPath: "Private label",
		});
		const permitted = filterPermittedSnapshotDiagnostics(
			snapshot,
			new Set(canonical.people.map((item) => item.filePath)),
		);
		expect(permitted.diagnostics).toEqual([
			{
				id: "permitted-duplicate-relationship-id:Relationships/Admitted.md",
				code: "duplicate-relationship-id",
				severity: "error",
				message: "The admitted relationship has a duplicate stable ID and is not actionable.",
				filePaths: ["Relationships/Admitted.md"],
			},
		]);
		expect(JSON.stringify(permitted)).not.toContain("Private label");
		expect(JSON.stringify(permitted)).not.toContain("Secret");
	});

	it("admits missing-ID diagnostics for invalid Base rows without adding them to the people graph", () => {
		const admitted = person("alice");
		const missing = "People/Missing ID.md";
		const canonical: RawIndexSnapshot = {
			people: [admitted],
			relationships: [],
			diagnostics: [
				{
					id: "missing",
					code: "missing-person-id",
					severity: "error",
					message: "The admitted note needs a stable ID",
					filePaths: [missing],
				},
				{
					id: "excluded",
					code: "missing-person-id",
					severity: "error",
					message: "Private note needs an ID",
					filePaths: ["Private/Secret.md"],
				},
			],
		};
		const snapshot = buildGraphSnapshot(
			{ visible: { people: [admitted], relationships: [] }, canonical },
			() => undefined,
		);
		const permitted = filterPermittedSnapshotDiagnostics(snapshot, new Set([admitted.filePath, missing]));
		expect(permitted.diagnostics.map((item) => item.id)).toEqual(["missing"]);
		expect(permitted.nodes.map((item) => item.id)).toEqual(["alice"]);
		expect(filterPermittedSnapshotDiagnostics(snapshot, new Set([admitted.filePath])).diagnostics).toEqual([]);
		expect(JSON.stringify(permitted)).not.toContain("Private");
	});

	it("retains broken relationship diagnostics only for an admitted person and their actual authored ghost", () => {
		const alice = person("alice");
		const missing = {
			raw: "[[Missing|Known ghost]]",
			target: "Missing",
			label: "Known ghost",
			kind: "wikilink" as const,
		};
		alice.contacts = [missing];
		const hidden = person("hidden", "Private/Hidden.md");
		const duplicateA = person("duplicate", "Private/Duplicate A.md");
		const duplicateB = person("duplicate", "Private/Duplicate B.md");
		const relationship: RelationshipRecord = {
			id: "broken",
			filePath: "Relationships/Admitted broken.md",
			from: { raw: "alice", target: "alice", kind: "id" },
			to: missing,
			types: [],
		};
		const relationships: RelationshipRecord[] = [
			relationship,
			{
				...relationship,
				id: "hidden",
				filePath: "Private/Hidden relationship.md",
				to: { raw: "hidden", target: "hidden", kind: "id" },
			},
			{
				...relationship,
				id: "unknown",
				filePath: "Private/Unrepresented relationship.md",
				to: { raw: "[[Other]]", target: "Other", kind: "wikilink" },
			},
			{
				...relationship,
				id: "ambiguous",
				filePath: "Private/Ambiguous relationship.md",
				to: { raw: "duplicate", target: "duplicate", kind: "id" },
			},
			{ ...relationship, id: "both-missing", filePath: "Private/Unanchored relationship.md", from: missing },
		];
		const canonical: RawIndexSnapshot = { people: [alice, hidden, duplicateA, duplicateB], relationships };
		const snapshot = buildGraphSnapshot(
			{ visible: { people: [alice], relationships: [] }, canonical },
			() => undefined,
		);
		const context = { people: canonical.people, relationships, resolveLink: () => undefined };
		const permitted = filterPermittedSnapshotDiagnostics(snapshot, new Set([alice.filePath]), context);
		expect(permitted.nodes.filter((node) => node.kind === "ghost")).toHaveLength(1);
		expect(permitted.diagnostics.filter((item) => item.code === "unresolved-relationship-endpoint")).toEqual([
			expect.objectContaining({ filePaths: [relationship.filePath] }),
		]);
		expect(JSON.stringify(permitted)).not.toContain("Private/");
		const staleGhost = filterPermittedSnapshotDiagnostics(snapshot, new Set([alice.filePath]), {
			...context,
			resolveLink: (target) => (target === missing.target ? hidden.filePath : undefined),
		});
		expect(staleGhost.nodes.filter((node) => node.kind === "ghost")).toHaveLength(1);
		expect(staleGhost.diagnostics.some((item) => item.filePaths.includes(relationship.filePath))).toBe(false);
		expect(JSON.stringify(staleGhost)).not.toContain("Private/");
		const added: IndexDelta = {
			...delta(alice),
			changedPaths: [relationship.filePath],
			updatedPeople: [],
			affectedPeople: [],
			addedRelationships: [relationship],
			affectedRelationships: [relationship],
			affectedRelationshipIds: [relationship.id],
		};
		const initial = buildGraphSnapshot(
			{ visible: { people: [alice], relationships: [] }, canonical: { ...canonical, relationships: [] } },
			() => undefined,
		);
		const incremental = applyGraphDelta(initial, added, () => undefined, {
			resolutionPeople: canonical.people,
			visiblePaths: new Set([alice.filePath]),
			relationships,
		});
		expect(
			filterPermittedSnapshotDiagnostics(incremental, new Set([alice.filePath]), context).diagnostics.some(
				(item) => item.code === "unresolved-relationship-endpoint" && item.filePaths[0] === relationship.filePath,
			),
		).toBe(true);
	});

	it("uses canonical plus mapped Base people for ghost diagnostics without hiding canonical ambiguity", () => {
		const canonicalAlice = person("canonical-alice", "People/Alice.md");
		const mappedAlice = { ...canonicalAlice, id: "mapped-alice" };
		const missing = { raw: "[[Missing]]", target: "Missing", kind: "wikilink" as const };
		mappedAlice.contacts = [missing];
		const relationship: RelationshipRecord = {
			id: "broken-mapped",
			filePath: "Relationships/Mapped broken.md",
			from: { raw: mappedAlice.id, target: mappedAlice.id, kind: "id" },
			to: missing,
			types: [],
		};
		const mappedObservation = { ...moment([mappedAlice.id]), id: "mapped-observation" };
		const canonicalObservation = { ...moment([canonicalAlice.id]), id: "canonical-observation" };
		const canonical: RawIndexSnapshot = {
			people: [canonicalAlice],
			relationships: [relationship],
			contactMoments: [mappedObservation, canonicalObservation],
		};
		const visible = { people: [mappedAlice], relationships: [] };
		const built = buildGraphSnapshot({ visible, canonical }, () => undefined);
		expect(built.contactMoments.map((item) => item.id)).toEqual([canonicalObservation.id]);
		expect(built.hiddenContactMomentCount).toBe(0);
		const admitted = new Set([mappedAlice.filePath]);
		const context = {
			people: [...canonical.people, ...visible.people],
			relationships: canonical.relationships,
			resolveLink: () => undefined,
		};
		expect(
			filterPermittedSnapshotDiagnostics(built, admitted, context).diagnostics.some(
				(item) => item.code === "unresolved-relationship-endpoint",
			),
		).toBe(true);
		const initial = buildGraphSnapshot({ visible, canonical: { ...canonical, relationships: [] } }, () => undefined);
		const added: IndexDelta = {
			...delta(mappedAlice),
			changedPaths: [relationship.filePath],
			updatedPeople: [],
			affectedPeople: [],
			addedRelationships: [relationship],
			affectedRelationships: [relationship],
			affectedRelationshipIds: [relationship.id],
		};
		const incremental = applyGraphDelta(initial, added, () => undefined, {
			resolutionPeople: canonical.people,
			graphResolutionPeople: context.people,
			visiblePaths: admitted,
			relationships: canonical.relationships,
			contactMoments: [mappedObservation, canonicalObservation],
		});
		expect(incremental.contactMoments).toEqual(built.contactMoments);
		expect(incremental.hiddenContactMomentCount).toBe(built.hiddenContactMomentCount);
		expect(
			filterPermittedSnapshotDiagnostics(incremental, admitted, context).diagnostics.some(
				(item) => item.code === "unresolved-relationship-endpoint",
			),
		).toBe(true);
		const hiddenCollision = person(mappedAlice.id, "Private/Collision.md");
		const ambiguousCanonical = { ...canonical, people: [...canonical.people, hiddenCollision] };
		const ambiguous = buildGraphSnapshot({ visible, canonical: ambiguousCanonical }, () => undefined);
		const filtered = filterPermittedSnapshotDiagnostics(ambiguous, admitted, {
			...context,
			people: [...ambiguousCanonical.people, ...visible.people],
		});
		expect(filtered.diagnostics.some((item) => item.code === "unresolved-relationship-endpoint")).toBe(false);
		expect(JSON.stringify(filtered)).not.toContain("Private/");
	});
});
