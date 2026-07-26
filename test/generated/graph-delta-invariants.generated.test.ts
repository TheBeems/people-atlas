import { describe, expect, it } from "vitest";
import type {
	AtlasDiagnostic,
	AtlasSnapshot,
	IndexDelta,
	RawIndexSnapshot,
} from "../../src/domain/types";
import { buildAtlasSnapshot } from "../../src/graph/build-snapshot";
import { applyGraphDelta } from "../../src/graph/graph-delta";
import { buildGraphSnapshot } from "../../src/graph/graph-source";
import { IndexState, type IndexStateChange } from "../../src/index/index-state";
import type { ParsedAtlasFile } from "../../src/index/frontmatter";
import {
	generatedSnapshotCase,
	GENERATED_SEEDS,
	person,
	reference,
	relationship,
	SeededGenerator,
	withGeneratedContext,
} from "./generated-cases";

function comparable(snapshot: AtlasSnapshot) {
	return {
		nodes: [...snapshot.nodes].sort((left, right) => String(left.id).localeCompare(String(right.id))),
		edges: [...snapshot.edges].sort((left, right) => left.id.localeCompare(right.id)),
		diagnostics: snapshot.diagnostics
			.map((item) => ({ ...item, filePaths: [...item.filePaths].sort() }))
			.sort((left, right) => left.id.localeCompare(right.id)),
		hiddenNodeCount: snapshot.hiddenNodeCount,
		hiddenEdgeCount: snapshot.hiddenEdgeCount,
	};
}

function changedRecords<T extends { filePath: string }>(
	before: T[],
	after: T[],
): { added: T[]; updated: T[]; removed: T[] } {
	const beforeByPath = new Map(before.map((item) => [item.filePath, item]));
	const afterByPath = new Map(after.map((item) => [item.filePath, item]));
	return {
		added: after.filter((item) => !beforeByPath.has(item.filePath)),
		updated: after.filter((item) => {
			const previous = beforeByPath.get(item.filePath);
			return previous !== undefined && JSON.stringify(previous) !== JSON.stringify(item);
		}),
		removed: before.filter((item) => !afterByPath.has(item.filePath)),
	};
}

function duplicateIds<T extends { id: string }>(records: T[]): string[] {
	const counts = new Map<string, number>();
	for (const record of records) counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
	return [...counts].filter(([, count]) => count > 1).map(([id]) => id).sort();
}

function deltaForChange(
	before: RawIndexSnapshot,
	after: RawIndexSnapshot,
	state: IndexState,
	change: IndexStateChange,
	resolveLink: (target: string) => string | undefined,
): IndexDelta {
	const people = changedRecords(before.people, after.people);
	const relationships = changedRecords(before.relationships, after.relationships);
	const rebuilt = buildAtlasSnapshot(after, resolveLink);
	const changedRelationshipIds = new Set([
		change.previous?.relationship?.id,
		change.next?.relationship?.id,
	].filter((id): id is string => id !== undefined));
	const contractCompletePaths = new Set(change.affectedPaths);
	for (const record of [...before.relationships, ...after.relationships]) {
		if (changedRelationshipIds.has(record.id)) contractCompletePaths.add(record.filePath);
	}
	const diagnosticsById = new Map<string, AtlasDiagnostic>();
	for (const diagnostic of state.getDiagnosticsForPaths(contractCompletePaths)) {
		diagnosticsById.set(diagnostic.id, diagnostic);
	}
	for (const diagnostic of rebuilt.diagnostics.filter((item) => item.code.startsWith("duplicate-"))) {
		diagnosticsById.set(diagnostic.id, diagnostic);
	}
	return {
		revision: change.revision,
		changedPaths: [...contractCompletePaths].sort(),
		removedPaths: change.removed ? [change.path] : [],
		affectedPersonIds: [...new Set([
			change.previous?.person?.id,
			change.next?.person?.id,
		].filter((id): id is string => id !== undefined))],
		affectedRelationshipIds: [...new Set([
			change.previous?.relationship?.id,
			change.next?.relationship?.id,
		].filter((id): id is string => id !== undefined))],
		addedPeople: people.added,
		updatedPeople: people.updated,
		removedPeople: people.removed,
		addedRelationships: relationships.added,
		updatedRelationships: relationships.updated,
		removedRelationships: relationships.removed,
		affectedPeople: state.getPeopleForPaths(contractCompletePaths),
		affectedRelationships: state.getRelationshipsForPaths(contractCompletePaths),
		diagnostics: [...diagnosticsById.values()],
		duplicatePersonIds: duplicateIds(after.people),
		duplicateRelationshipIds: duplicateIds(after.relationships),
	};
}

function rawFromState(state: IndexState): RawIndexSnapshot {
	return state.getSnapshot();
}

type DeltaOperation =
	| { kind: "upsert"; label: string; parsed: ParsedAtlasFile }
	| { kind: "remove"; label: string; path: string };

describe("generated graph delta invariants", () => {
	for (let seed = 0; seed < GENERATED_SEEDS; seed += 1) {
		it(`family=graph-delta seed=${seed}`, () => {
			const random = new SeededGenerator(seed);
			const suffix = random.token("delta");
			const alphaPath = `People/${suffix}/Alpha.md`;
			const betaPath = `People/${suffix}/Beta.md`;
			const duplicatePath = `People/${suffix}/Duplicate.md`;
			const relationshipPath = `Relationships/${suffix}/Alpha-Beta.md`;
			const parallelRelationshipPath = `Relationships/${suffix}/Alpha-Beta-parallel.md`;
			const duplicateRelationshipPath = `Relationships/${suffix}/Alpha-Beta-duplicate.md`;
			const alphaId = `alpha-${suffix}`;
			const betaId = `beta-${suffix}`;
			const relationshipId = `rel-${suffix}`;
			const parallelRelationshipId = `parallel-${suffix}`;
			const state = new IndexState();
			const initialPeople = [
				person(alphaId, alphaPath, `Alpha ${suffix}`, [reference(`missing-${suffix}`)]),
				person(betaId, betaPath, `Beta ${suffix}`),
			];
			for (const [initialIndex, entry] of initialPeople.entries()) {
				withGeneratedContext(`family=graph-delta seed=${seed} operation=initial-person-${initialIndex}`, () =>
					state.upsert({ filePath: entry.filePath, person: entry, diagnostics: [] })
				);
			}
			let raw = withGeneratedContext(
				`family=graph-delta seed=${seed} operation=initial-snapshot`,
				() => rawFromState(state),
			);
			let incremental = withGeneratedContext(
				`family=graph-delta seed=${seed} operation=initial-build`,
				() => buildAtlasSnapshot(raw, () => undefined),
			);
			const operations: DeltaOperation[] = [
				{
					kind: "upsert",
					label: "ghost-resolution",
					parsed: {
						filePath: alphaPath,
						person: person(alphaId, alphaPath, `Alpha ${suffix}`, [reference(betaId)]),
						diagnostics: [],
					},
				},
				{
					kind: "upsert",
					label: "primary-relationship-add",
					parsed: {
						filePath: relationshipPath,
						relationship: relationship(relationshipId, relationshipPath, alphaId, betaId, {
							direction: "source-to-target",
							types: ["friend", `seed-${seed}`],
							closeness: 1 + random.int(5),
							since: "2021-02-03",
							lastContact: "2026-07-26",
							status: "active",
						}),
						diagnostics: [],
					},
				},
				{
					kind: "upsert",
					label: "parallel-relationship-add",
					parsed: {
						filePath: parallelRelationshipPath,
						relationship: relationship(
							parallelRelationshipId,
							parallelRelationshipPath,
							betaId,
							alphaId,
							{ types: ["colleague"] },
						),
						diagnostics: [],
					},
				},
				{
					kind: "upsert",
					label: "duplicate-relationship-appearance",
					parsed: {
						filePath: duplicateRelationshipPath,
						relationship: relationship(
							relationshipId,
							duplicateRelationshipPath,
							alphaId,
							betaId,
							{ types: ["duplicate"] },
						),
						diagnostics: [],
					},
				},
				{
					kind: "upsert",
					label: "parallel-relationship-update",
					parsed: {
						filePath: parallelRelationshipPath,
						relationship: relationship(
							parallelRelationshipId,
							parallelRelationshipPath,
							alphaId,
							betaId,
							{
								direction: "source-to-target",
								types: ["peer"],
								closeness: 4,
								status: "dormant",
							},
						),
						diagnostics: [],
					},
				},
				{ kind: "remove", label: "duplicate-relationship-disappearance", path: duplicateRelationshipPath },
				{
					kind: "upsert",
					label: "duplicate-person-appearance",
					parsed: {
						filePath: duplicatePath,
						person: person(alphaId, duplicatePath, `Duplicate ${suffix}`),
						diagnostics: [],
					},
				},
				{ kind: "remove", label: "duplicate-person-disappearance", path: duplicatePath },
				{
					kind: "upsert",
					label: "primary-relationship-update",
					parsed: {
						filePath: relationshipPath,
						relationship: relationship(relationshipId, relationshipPath, betaId, alphaId, {
							direction: "undirected",
							types: ["colleague"],
							closeness: 2,
							status: "dormant",
						}),
						diagnostics: [],
					},
				},
				{ kind: "remove", label: "primary-relationship-remove", path: relationshipPath },
				{
					kind: "upsert",
					label: "person-identity-update",
					parsed: {
						filePath: betaPath,
						person: person(`beta-new-${suffix}`, betaPath, `Beta ${suffix}`),
						diagnostics: [],
					},
				},
				{ kind: "remove", label: "parallel-relationship-remove", path: parallelRelationshipPath },
				{ kind: "remove", label: "person-remove", path: betaPath },
				{
					kind: "upsert",
					label: "ghost-regression",
					parsed: {
						filePath: alphaPath,
						person: person(alphaId, alphaPath, `Alpha ${suffix}`, [reference(`missing-again-${suffix}`)]),
						diagnostics: [],
					},
				},
			];

			for (const [operationIndex, operation] of operations.entries()) {
				const context = `family=graph-delta seed=${seed} operation=${operationIndex} transition=${operation.label}`;
				withGeneratedContext(context, () => {
					const before = raw;
					const change = operation.kind === "upsert"
						? state.upsert(operation.parsed)
						: state.remove(operation.path);
					raw = rawFromState(state);
					const delta = deltaForChange(before, raw, state, change, () => undefined);
					incremental = applyGraphDelta(incremental, delta, () => undefined, {
						resolutionPeople: raw.people,
					});
					const rebuilt = buildAtlasSnapshot(raw, () => undefined);
					expect(comparable(incremental), `${context} full rebuild equivalence`).toEqual(comparable(rebuilt));

					if (operation.label === "duplicate-relationship-appearance") {
						const duplicateEdges = incremental.edges.filter((edge) =>
							edge.filePath === relationshipPath || edge.filePath === duplicateRelationshipPath
						);
						expect(duplicateEdges, `${context} duplicate relationship edges`).toHaveLength(2);
						expect(new Set(duplicateEdges.map((edge) => edge.id)).size, `${context} unique remapped IDs`).toBe(2);
						expect(incremental.diagnostics.some((item) =>
							item.code === "duplicate-relationship-id"
						), `${context} duplicate diagnostic`).toBe(true);
					}
					if (operation.label === "parallel-relationship-update") {
						expect(
							incremental.edges.find((edge) => edge.filePath === parallelRelationshipPath),
							`${context} parallel metadata`,
						).toMatchObject({
							id: parallelRelationshipId,
							sourceId: alphaId,
							targetId: betaId,
							direction: "source-to-target",
							types: ["peer"],
							closeness: 4,
							status: "dormant",
						});
					}
					if (operation.label === "duplicate-relationship-disappearance") {
						expect(
							incremental.edges.find((edge) => edge.filePath === relationshipPath),
							`${context} surviving primary identity`,
						).toMatchObject({ id: relationshipId, filePath: relationshipPath });
						expect(
							incremental.edges.find((edge) => edge.filePath === parallelRelationshipPath),
							`${context} surviving parallel identity`,
						).toMatchObject({ id: parallelRelationshipId, filePath: parallelRelationshipPath });
						expect(incremental.diagnostics.some((item) =>
							item.code === "duplicate-relationship-id"
						), `${context} duplicate diagnostic cleared`).toBe(false);
					}
					if (operation.label === "primary-relationship-remove") {
						expect(
							incremental.edges.some((edge) => edge.filePath === relationshipPath),
							`${context} primary removed`,
						).toBe(false);
						expect(
							incremental.edges.find((edge) => edge.filePath === parallelRelationshipPath),
							`${context} parallel survives primary removal`,
						).toMatchObject({
							id: parallelRelationshipId,
							filePath: parallelRelationshipPath,
							types: ["peer"],
						});
					}
				});
			}

			const filteredContext = `family=graph-delta seed=${seed} operation=filtered-contact`;
			withGeneratedContext(filteredContext, () => {
				const filtered = generatedSnapshotCase(seed);
				const visibleAlpha = filtered.visible.people.find((entry) => entry.filePath === filtered.paths.alpha);
				if (!visibleAlpha) throw new Error("missing visible alpha");
				const filteredBefore = {
					...filtered.canonical,
					people: filtered.canonical.people.map((entry) =>
						entry.filePath === visibleAlpha.filePath
							? { ...entry, contacts: [reference(filtered.ids.beta)] }
							: entry
					),
				};
				const filteredAfter = {
					...filteredBefore,
					people: filteredBefore.people.map((entry) =>
						entry.filePath === visibleAlpha.filePath
							? { ...entry, contacts: [reference(filtered.ids.hidden)] }
							: entry
					),
				};
				const previousFiltered = buildGraphSnapshot({
					canonical: filteredBefore,
					visible: {
						people: filteredBefore.people.filter((entry) => filtered.visiblePaths.has(entry.filePath)),
						relationships: [],
						diagnostics: [],
					},
				}, filtered.resolveLink);
				const changedAlpha = filteredAfter.people.find((entry) => entry.filePath === visibleAlpha.filePath);
				if (!changedAlpha) throw new Error("missing changed alpha");
				const rebuiltFiltered = buildGraphSnapshot({
					canonical: filteredAfter,
					visible: {
						people: filteredAfter.people.filter((entry) => filtered.visiblePaths.has(entry.filePath)),
						relationships: [],
						diagnostics: [],
					},
				}, filtered.resolveLink);
				const filteredDelta: IndexDelta = {
					revision: 1,
					changedPaths: [changedAlpha.filePath],
					removedPaths: [],
					affectedPersonIds: [changedAlpha.id],
					affectedRelationshipIds: [],
					addedPeople: [],
					updatedPeople: [changedAlpha],
					removedPeople: [],
					addedRelationships: [],
					updatedRelationships: [],
					removedRelationships: [],
					affectedPeople: [changedAlpha],
					affectedRelationships: filteredAfter.relationships,
					diagnostics: rebuiltFiltered.diagnostics.filter((item) => item.code.startsWith("duplicate-")),
					duplicatePersonIds: duplicateIds(filteredAfter.people),
					duplicateRelationshipIds: duplicateIds(filteredAfter.relationships),
				};
				const incrementalFiltered = applyGraphDelta(
					previousFiltered,
					filteredDelta,
					filtered.resolveLink,
					{ resolutionPeople: filteredAfter.people, visiblePaths: filtered.visiblePaths },
				);
				expect(comparable(incrementalFiltered), `${filteredContext} full rebuild equivalence`).toEqual(
					comparable(rebuiltFiltered),
				);
			});
		});
	}
});
