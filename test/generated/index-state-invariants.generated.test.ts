import { describe, expect, it } from "vitest";
import type { AtlasDiagnostic, PersonRecord, RawIndexSnapshot, RelationshipRecord } from "../../src/domain/types";
import { IndexState, type StoredIndexFile } from "../../src/index/index-state";
import type { ParsedAtlasFile } from "../../src/index/frontmatter";
import {
	generatedIndexOperations,
	GENERATED_SEEDS,
	type GeneratedIndexOperation,
	withGeneratedContext,
} from "./generated-cases";

function normalized(value: string): string {
	return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function referenceKeys(target: string): string[] {
	const normalizedTarget = target.trim().replace(/\\/g, "/").toLowerCase();
	return [`ref:${normalizedTarget}`, `path:${normalized(target)}`];
}

function recordReferenceKeys(target: string): string[] {
	return [`ref:${target.trim().replace(/\\/g, "/").toLowerCase()}`, `path:${normalized(target)}`];
}

function sorted(values: Iterable<string>): string[] {
	return [...new Set(values)].sort();
}

function comparableSnapshot(snapshot: RawIndexSnapshot) {
	return {
		people: [...snapshot.people].sort((left, right) => left.filePath.localeCompare(right.filePath)),
		relationships: [...snapshot.relationships].sort((left, right) => left.filePath.localeCompare(right.filePath)),
		diagnostics: [...(snapshot.diagnostics ?? [])]
			.map((item) => ({ ...item, filePaths: [...item.filePaths].sort() }))
			.sort((left, right) => left.id.localeCompare(right.id)),
	};
}

class ReferenceIndexModel {
	readonly files = new Map<string, StoredIndexFile>();
	revision = 0;

	clear(): void {
		this.files.clear();
	}

	upsert(parsed: ParsedAtlasFile, additionalAffectedPaths: Iterable<string> = []): Set<string> {
		const previous = this.files.get(parsed.filePath);
		const affected = new Set<string>([
			parsed.filePath,
			...additionalAffectedPaths,
			...this.dependentsFor(parsed.filePath),
		]);
		const next: StoredIndexFile = { diagnostics: parsed.diagnostics };
		if (parsed.person) next.person = parsed.person;
		if (parsed.relationship) next.relationship = parsed.relationship;
		this.files.set(parsed.filePath, next);
		for (const target of this.recordTargets(next)) {
			for (const dependent of this.dependentsFor(target)) affected.add(dependent);
		}
		for (const target of this.recordTargets(previous)) {
			for (const dependent of this.dependentsFor(target)) affected.add(dependent);
		}
		this.revision += 1;
		return affected;
	}

	remove(path: string, additionalAffectedPaths: Iterable<string> = []): Set<string> {
		const previous = this.files.get(path);
		const affected = new Set<string>([path, ...additionalAffectedPaths, ...this.dependentsFor(path)]);
		this.files.delete(path);
		for (const target of this.recordTargets(previous)) {
			for (const dependent of this.dependentsFor(target)) affected.add(dependent);
		}
		this.revision += 1;
		return affected;
	}

	snapshot(): RawIndexSnapshot {
		const people: PersonRecord[] = [];
		const relationships: RelationshipRecord[] = [];
		const diagnostics: AtlasDiagnostic[] = [];
		for (const file of this.files.values()) {
			if (file.person) people.push(file.person);
			if (file.relationship) relationships.push(file.relationship);
			diagnostics.push(...file.diagnostics);
		}
		return { people, relationships, diagnostics };
	}

	peoplePathsById(id: string): string[] {
		return sorted([...this.files].flatMap(([path, file]) => (file.person?.id === id ? [path] : [])));
	}

	relationshipPathsById(id: string): string[] {
		return sorted([...this.files].flatMap(([path, file]) => (file.relationship?.id === id ? [path] : [])));
	}

	duplicatePersonIds(): string[] {
		return sorted(
			[...this.files.values()]
				.flatMap((file) => (file.person ? [file.person.id] : []))
				.filter((id, index, values) => values.indexOf(id) !== index),
		);
	}

	duplicateRelationshipIds(): string[] {
		return sorted(
			[...this.files.values()]
				.flatMap((file) => (file.relationship ? [file.relationship.id] : []))
				.filter((id, index, values) => values.indexOf(id) !== index),
		);
	}

	adjacency(target: string): string[] {
		const keys = new Set(referenceKeys(target));
		return sorted(
			[...this.files].flatMap(([path, file]) => {
				const relationship = file.relationship;
				if (!relationship) return [];
				return [relationship.from, relationship.to].some((endpoint) =>
					recordReferenceKeys(endpoint.target).some((key) => keys.has(key)),
				)
					? [path]
					: [];
			}),
		);
	}

	dependentsFor(target: string): string[] {
		const keys = new Set(referenceKeys(target));
		const normalizedTarget = normalized(target);
		return sorted(
			[...this.files].flatMap(([path, file]) => {
				const references = [
					...(file.person?.contacts ?? []),
					...(file.relationship ? [file.relationship.from, file.relationship.to] : []),
				];
				const referenceMatch = references.some((entry) =>
					recordReferenceKeys(entry.target).some((key) => keys.has(key)),
				);
				const assetMatch = file.person?.photoPath ? normalized(file.person.photoPath) === normalizedTarget : false;
				return referenceMatch || assetMatch ? [path] : [];
			}),
		);
	}

	diagnosticsFor(paths: Iterable<string>): AtlasDiagnostic[] {
		const selected = new Set(paths);
		return [...this.files].flatMap(([path, file]) => (selected.has(path) ? file.diagnostics : []));
	}

	private recordTargets(file: StoredIndexFile | undefined): string[] {
		if (!file) return [];
		const targets: string[] = [];
		if (file.person) {
			targets.push(file.person.id, file.person.filePath);
			if (file.person.photoPath) targets.push(file.person.photoPath);
		}
		if (file.relationship) {
			targets.push(
				file.relationship.id,
				file.relationship.filePath,
				file.relationship.from.target,
				file.relationship.to.target,
			);
		}
		return targets;
	}
}

function collectHistoricalKeys(
	operation: GeneratedIndexOperation,
	paths: Set<string>,
	personIds: Set<string>,
	relationshipIds: Set<string>,
	targets: Set<string>,
): void {
	if (operation.kind === "remove") {
		paths.add(operation.path);
		return;
	}
	if (operation.kind === "clear") return;
	paths.add(operation.parsed.filePath);
	const { person, relationship } = operation.parsed;
	if (person) {
		personIds.add(person.id);
		targets.add(person.filePath);
		targets.add(person.id);
		if (person.photoPath) targets.add(person.photoPath);
		for (const contact of person.contacts) targets.add(contact.target);
	}
	if (relationship) {
		relationshipIds.add(relationship.id);
		targets.add(relationship.filePath);
		targets.add(relationship.id);
		targets.add(relationship.from.target);
		targets.add(relationship.to.target);
	}
}

function verifyIndexOperation(
	context: string,
	operation: GeneratedIndexOperation,
	state: IndexState,
	model: ReferenceIndexModel,
	historicalPaths: Set<string>,
	historicalPersonIds: Set<string>,
	historicalRelationshipIds: Set<string>,
	historicalTargets: Set<string>,
): void {
	collectHistoricalKeys(operation, historicalPaths, historicalPersonIds, historicalRelationshipIds, historicalTargets);
	const revisionBefore = state.getRevision();
	let actualAffected = new Set<string>();
	let expectedAffected = new Set<string>();
	if (operation.kind === "clear") {
		state.clear();
		model.clear();
		expect(state.getRevision(), `${context} clear revision`).toBe(revisionBefore);
	} else if (operation.kind === "upsert") {
		actualAffected = state.upsert(operation.parsed, operation.additionalAffectedPaths).affectedPaths;
		expectedAffected = model.upsert(operation.parsed, operation.additionalAffectedPaths);
		expect(state.getRevision(), `${context} upsert revision`).toBe(revisionBefore + 1);
	} else {
		actualAffected = state.remove(operation.path, operation.additionalAffectedPaths).affectedPaths;
		expectedAffected = model.remove(operation.path, operation.additionalAffectedPaths);
		expect(state.getRevision(), `${context} remove revision`).toBe(revisionBefore + 1);
	}

	expect(state.getRevision(), `${context} model revision`).toBe(model.revision);
	expect(comparableSnapshot(state.getSnapshot()), `${context} raw snapshot`).toEqual(
		comparableSnapshot(model.snapshot()),
	);
	if (operation.kind !== "clear") {
		expect(sorted(actualAffected), `${context} affected paths`).toEqual(sorted(expectedAffected));
	}
	for (const path of historicalPaths) {
		expect(state.getFile(path), `${context} stored file path=${path}`).toEqual(model.files.get(path));
	}
	for (const id of historicalPersonIds) {
		expect(state.getPeoplePathsById(id), `${context} person id=${id}`).toEqual(model.peoplePathsById(id));
	}
	for (const id of historicalRelationshipIds) {
		expect(state.getRelationshipPathsById(id), `${context} relationship id=${id}`).toEqual(
			model.relationshipPathsById(id),
		);
	}
	expect(state.getDuplicatePersonIds(), `${context} duplicate people`).toEqual(model.duplicatePersonIds());
	expect(state.getDuplicateRelationshipIds(), `${context} duplicate relationships`).toEqual(
		model.duplicateRelationshipIds(),
	);
	for (const target of historicalTargets) {
		expect(state.getAdjacency(target), `${context} adjacency target=${target}`).toEqual(model.adjacency(target));
		expect(sorted(state.getDependentsForTarget(target)), `${context} dependents target=${target}`).toEqual(
			model.dependentsFor(target),
		);
	}
	expect(state.getDiagnosticsForPaths(historicalPaths), `${context} diagnostics`).toEqual(
		model.diagnosticsFor(historicalPaths),
	);
}

describe("generated index state invariants", () => {
	for (let seed = 0; seed < GENERATED_SEEDS; seed += 1) {
		it(`family=index-state seed=${seed}`, () => {
			const state = new IndexState();
			const model = new ReferenceIndexModel();
			const historicalPaths = new Set<string>();
			const historicalPersonIds = new Set<string>();
			const historicalRelationshipIds = new Set<string>();
			const historicalTargets = new Set<string>();
			const operations = withGeneratedContext(`family=index-state seed=${seed} operation=case-generation`, () =>
				generatedIndexOperations(seed),
			);

			for (const [operationIndex, operation] of operations.entries()) {
				const context = `family=index-state seed=${seed} operation=${operationIndex}`;
				withGeneratedContext(context, () =>
					verifyIndexOperation(
						context,
						operation,
						state,
						model,
						historicalPaths,
						historicalPersonIds,
						historicalRelationshipIds,
						historicalTargets,
					),
				);
			}
		});
	}
});
