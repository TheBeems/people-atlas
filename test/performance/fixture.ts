import type {
	AtlasDiagnostic,
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	IndexDelta,
	PersonRecord,
	RawIndexSnapshot,
	RelationshipRecord,
} from "../../src/domain/types";
import { buildAtlasSnapshot } from "../../src/graph/build-snapshot";
import { applyGraphDelta } from "../../src/graph/graph-delta";
import type { ParsedAtlasFile } from "../../src/index/frontmatter";
import {
	FIXTURE_CONTRACT_VERSION,
	type FixtureCounts,
	type PerformanceProfile,
	type PerformanceSize,
} from "./performance-model";

const FIXED_GENERATED_AT = 0;

export interface PerformanceFixture {
	contractVersion: typeof FIXTURE_CONTRACT_VERSION;
	size: PerformanceSize;
	profile: PerformanceProfile;
	offsets: number;
	people: PersonRecord[];
	relationships: RelationshipRecord[];
	files: ParsedAtlasFile[];
	raw: RawIndexSnapshot;
}

export interface IncrementalFixtureScenario {
	person: PersonRecord;
	relationship: RelationshipRecord;
	raw: RawIndexSnapshot;
	delta: IndexDelta;
}

function ordinal(value: number): string {
	return value.toString().padStart(6, "0");
}

function compareStableId(left: { id: string }, right: { id: string }): number {
	return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function compareDiagnostic(left: AtlasDiagnostic, right: AtlasDiagnostic): number {
	return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function generatePerformanceFixture(size: PerformanceSize, profile: PerformanceProfile): PerformanceFixture {
	const offsets = profile === "sparse" ? 2 : 8;
	const people = Array.from({ length: size }, (_, index): PersonRecord => {
		const suffix = ordinal(index);
		return {
			id: `person-${suffix}`,
			filePath: `People/person-${suffix}.md`,
			name: `Person ${suffix}`,
			aliases: [],
			organisations: [`Organisation ${index % 17}`],
			contacts: [],
		};
	});
	const relationships: RelationshipRecord[] = [];
	for (let sourceIndex = 0; sourceIndex < size; sourceIndex += 1) {
		for (let offset = 1; offset <= offsets; offset += 1) {
			const source = people[sourceIndex];
			const target = people[(sourceIndex + offset) % size];
			if (!source || !target) throw new Error("Fixture ordinal resolution failed.");
			const sourceSuffix = ordinal(sourceIndex);
			const relationshipId = `relationship-${sourceSuffix}-${offset.toString().padStart(2, "0")}`;
			relationships.push({
				id: relationshipId,
				filePath: `Relationships/${relationshipId}.md`,
				from: { raw: source.id, target: source.id },
				to: { raw: target.id, target: target.id },
				direction: "undirected",
				types: ["performance-fixture"],
				closeness: ((sourceIndex + offset) % 5) + 1,
				since: `20${(sourceIndex % 20).toString().padStart(2, "0")}-01-01`,
				lastContact: `2026-${(((sourceIndex + offset) % 12) + 1).toString().padStart(2, "0")}-01`,
				status: sourceIndex % 3 === 0 ? "active" : sourceIndex % 3 === 1 ? "dormant" : "ended",
			});
		}
	}
	const files: ParsedAtlasFile[] = [
		...people.map((person) => ({ filePath: person.filePath, person, diagnostics: [] })),
		...relationships.map((relationship) => ({
			filePath: relationship.filePath,
			relationship,
			diagnostics: [],
		})),
	];
	return {
		contractVersion: FIXTURE_CONTRACT_VERSION,
		size,
		profile,
		offsets,
		people,
		relationships,
		files,
		raw: { people, relationships, diagnostics: [] },
	};
}

export function normalizePerformanceSnapshot(snapshot: AtlasSnapshot): AtlasSnapshot {
	return {
		nodes: [...snapshot.nodes].map((node) => ({ ...node })).sort(compareStableId),
		edges: [...snapshot.edges].map((edge) => ({ ...edge })).sort(compareStableId),
		diagnostics: [...snapshot.diagnostics]
			.map((diagnostic) => ({
				...diagnostic,
				filePaths: [...diagnostic.filePaths].sort(),
			}))
			.sort(compareDiagnostic),
		hiddenNodeCount: snapshot.hiddenNodeCount,
		hiddenEdgeCount: snapshot.hiddenEdgeCount,
		generatedAt: FIXED_GENERATED_AT,
	};
}

export function buildPerformanceSnapshot(raw: RawIndexSnapshot): AtlasSnapshot {
	return normalizePerformanceSnapshot(buildAtlasSnapshot(raw, () => undefined));
}

export function validatePerformanceFixture(fixture: PerformanceFixture): void {
	const expectedRelationships = fixture.size * fixture.offsets;
	if (fixture.people.length !== fixture.size) {
		throw new Error(`Expected ${fixture.size} people, received ${fixture.people.length}.`);
	}
	if (fixture.relationships.length !== expectedRelationships) {
		throw new Error(`Expected ${expectedRelationships} relationships, received ${fixture.relationships.length}.`);
	}
	if (fixture.files.length !== fixture.people.length + fixture.relationships.length) {
		throw new Error("Fixture file count does not match its records.");
	}
	const personIds = new Set(fixture.people.map((person) => person.id));
	const personPaths = new Set(fixture.people.map((person) => person.filePath));
	const relationshipIds = new Set(fixture.relationships.map((relationship) => relationship.id));
	const relationshipPaths = new Set(fixture.relationships.map((relationship) => relationship.filePath));
	if (personIds.size !== fixture.people.length || personPaths.size !== fixture.people.length) {
		throw new Error("Fixture people do not have unique stable identities and paths.");
	}
	if (
		relationshipIds.size !== fixture.relationships.length ||
		relationshipPaths.size !== fixture.relationships.length
	) {
		throw new Error("Fixture relationships do not have unique stable identities and paths.");
	}
	for (const relationship of fixture.relationships) {
		if (!personIds.has(relationship.from.target) || !personIds.has(relationship.to.target)) {
			throw new Error(`Relationship ${relationship.id} has an unresolved endpoint.`);
		}
		if (relationship.from.target === relationship.to.target) {
			throw new Error(`Relationship ${relationship.id} is unexpectedly self-referential.`);
		}
	}
}

export function validateSnapshotCounts(fixture: PerformanceFixture, snapshot: AtlasSnapshot): FixtureCounts {
	const counts = {
		people: fixture.people.length,
		relationships: fixture.relationships.length,
		nodes: snapshot.nodes.length,
		edges: snapshot.edges.length,
	};
	if (
		counts.people !== fixture.size ||
		counts.relationships !== fixture.size * fixture.offsets ||
		counts.nodes !== fixture.size ||
		counts.edges !== fixture.size * fixture.offsets
	) {
		throw new Error(`Invalid fixture/snapshot counts: ${JSON.stringify(counts)}.`);
	}
	if (snapshot.diagnostics.length !== 0 || snapshot.hiddenNodeCount !== 0 || snapshot.hiddenEdgeCount !== 0) {
		throw new Error("Performance fixture unexpectedly produced diagnostics or hidden graph items.");
	}
	return counts;
}

export function createIncrementalFixtureScenario(fixture: PerformanceFixture): IncrementalFixtureScenario {
	const personIndex = Math.floor(fixture.size / 2);
	const existingPerson = fixture.people[personIndex];
	const existingRelationship = fixture.relationships[personIndex * fixture.offsets];
	if (!existingPerson || !existingRelationship) {
		throw new Error("Unable to resolve the deterministic incremental fixture records.");
	}
	const person: PersonRecord = {
		...existingPerson,
		name: `${existingPerson.name} updated`,
		organisations: [...existingPerson.organisations, "Updated organisation"],
	};
	const relationship: RelationshipRecord = {
		...existingRelationship,
		types: ["performance-fixture", "updated"],
		closeness: 5,
		lastContact: "2026-07-26",
		status: "active",
	};
	const people = fixture.people.map((candidate) => (candidate.id === person.id ? person : candidate));
	const relationships = fixture.relationships.map((candidate) =>
		candidate.id === relationship.id ? relationship : candidate,
	);
	const incidentRelationships = relationships.filter(
		(candidate) => candidate.from.target === person.id || candidate.to.target === person.id,
	);
	return {
		person,
		relationship,
		raw: { people, relationships, diagnostics: [] },
		delta: {
			revision: 1,
			changedPaths: [person.filePath, relationship.filePath],
			removedPaths: [],
			affectedPersonIds: [person.id],
			affectedRelationshipIds: incidentRelationships.map((candidate) => candidate.id),
			addedPeople: [],
			updatedPeople: [person],
			removedPeople: [],
			addedRelationships: [],
			updatedRelationships: [relationship],
			removedRelationships: [],
			affectedPeople: [person],
			affectedRelationships: incidentRelationships,
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
		},
	};
}

export function applyPerformanceIncrementalScenario(
	previous: AtlasSnapshot,
	scenario: IncrementalFixtureScenario,
): AtlasSnapshot {
	return normalizePerformanceSnapshot(
		applyGraphDelta(previous, scenario.delta, () => undefined, { resolutionPeople: scenario.raw.people }),
	);
}

export function assertEquivalentSnapshots(left: AtlasSnapshot, right: AtlasSnapshot): void {
	const normalizedLeft = normalizePerformanceSnapshot(left);
	const normalizedRight = normalizePerformanceSnapshot(right);
	if (stableJson(normalizedLeft) !== stableJson(normalizedRight)) {
		throw new Error("Incremental graph output does not match a full deterministic rebuild.");
	}
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		const entries = Object.entries(value).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
		return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "undefined";
}

export function assertStableIncrementalIdentities(
	before: AtlasSnapshot,
	after: AtlasSnapshot,
	scenario: IncrementalFixtureScenario,
): void {
	const beforeNodes = new Set(before.nodes.map((node) => node.id));
	const afterNodes = new Set(after.nodes.map((node) => node.id));
	const beforeEdges = new Set(before.edges.map((edge) => edge.id));
	const afterEdges = new Set(after.edges.map((edge) => edge.id));
	if (
		before.nodes.length !== after.nodes.length ||
		before.edges.length !== after.edges.length ||
		JSON.stringify([...beforeNodes].sort()) !== JSON.stringify([...afterNodes].sort()) ||
		JSON.stringify([...beforeEdges].sort()) !== JSON.stringify([...afterEdges].sort()) ||
		!afterNodes.has(scenario.person.id) ||
		!afterEdges.has(scenario.relationship.id)
	) {
		throw new Error("Incremental fixture changed stable graph identities or counts.");
	}
}

export function snapshotStructure(snapshot: AtlasSnapshot): {
	nodes: AtlasNode[];
	edges: AtlasEdge[];
} {
	const normalized = normalizePerformanceSnapshot(snapshot);
	return { nodes: normalized.nodes, edges: normalized.edges };
}
