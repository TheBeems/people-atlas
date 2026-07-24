import { normalizePathIdentity } from "../domain/identity";
import { referenceKey } from "../domain/wikilink";
import type { AtlasDiagnostic, PersonRecord, RawIndexSnapshot, RelationshipRecord } from "../domain/types";
import type { ParsedAtlasFile } from "./frontmatter";

export interface StoredFile {
	person?: PersonRecord;
	relationship?: RelationshipRecord;
	diagnostics: AtlasDiagnostic[];
}

export interface IndexStateChange {
	revision: number;
	path: string;
	previous?: StoredFile;
	next?: StoredFile;
	affectedPaths: Set<string>;
	removed: boolean;
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
	const values = map.get(key) ?? new Set<string>();
	values.add(value);
	map.set(key, values);
}

function removeFromSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
	const values = map.get(key);
	if (!values) return;
	values.delete(value);
	if (values.size === 0) map.delete(key);
}

function referenceKeys(target: string): string[] {
	const normalized = target.trim().replace(/\\/g, "/").toLowerCase();
	return [`ref:${normalized}`, `path:${normalizePathIdentity(target)}`];
}

function recordReferenceKeys(reference: { target: string }): string[] {
	return [`ref:${referenceKey({ raw: reference.target, target: reference.target })}`, `path:${normalizePathIdentity(reference.target)}`];
}

export class IndexState {
	private readonly filesByPath = new Map<string, StoredFile>();
	private readonly peopleById = new Map<string, Set<string>>();
	private readonly relationshipsById = new Map<string, Set<string>>();
	private readonly dependentsByReference = new Map<string, Set<string>>();
	private readonly assetDependentsByPath = new Map<string, Set<string>>();
	private readonly adjacencyByReference = new Map<string, Set<string>>();
	private revision = 0;

	clear(): void {
		this.filesByPath.clear();
		this.peopleById.clear();
		this.relationshipsById.clear();
		this.dependentsByReference.clear();
		this.assetDependentsByPath.clear();
		this.adjacencyByReference.clear();
	}

	upsert(parsed: ParsedAtlasFile, additionalAffectedPaths: Iterable<string> = []): IndexStateChange {
		const path = parsed.filePath;
		const previous = this.filesByPath.get(path);
		const affectedPaths = new Set<string>([path, ...additionalAffectedPaths, ...this.getDependentsForTarget(path)]);
		if (previous) this.removeIndexes(path, previous);

		const next: StoredFile = { diagnostics: parsed.diagnostics };
		if (parsed.person) next.person = parsed.person;
		if (parsed.relationship) next.relationship = parsed.relationship;
		this.filesByPath.set(path, next);
		this.addIndexes(path, next);
		for (const target of this.getRecordTargets(next)) {
			for (const dependent of this.getDependentsForTarget(target)) affectedPaths.add(dependent);
		}
		for (const target of this.getRecordTargets(previous)) {
			for (const dependent of this.getDependentsForTarget(target)) affectedPaths.add(dependent);
		}
		this.revision += 1;
		const change: IndexStateChange = { revision: this.revision, path, next, affectedPaths, removed: false };
		if (previous) change.previous = previous;
		return change;
	}

	remove(path: string, additionalAffectedPaths: Iterable<string> = []): IndexStateChange {
		const previous = this.filesByPath.get(path);
		const affectedPaths = new Set<string>([path, ...additionalAffectedPaths, ...this.getDependentsForTarget(path)]);
		if (previous) {
			this.removeIndexes(path, previous);
			this.filesByPath.delete(path);
			for (const target of this.getRecordTargets(previous)) {
				for (const dependent of this.getDependentsForTarget(target)) affectedPaths.add(dependent);
			}
		}
		this.revision += 1;
		const change: IndexStateChange = { revision: this.revision, path, affectedPaths, removed: true };
		if (previous) change.previous = previous;
		return change;
	}

	getSnapshot(): RawIndexSnapshot {
		const people: PersonRecord[] = [];
		const relationships: RelationshipRecord[] = [];
		const diagnostics: AtlasDiagnostic[] = [];
		for (const file of this.filesByPath.values()) {
			if (file.person) people.push(file.person);
			if (file.relationship) relationships.push(file.relationship);
			diagnostics.push(...file.diagnostics);
		}
		return { people, relationships, diagnostics };
	}

	getPeoplePathsById(id: string): string[] {
		return [...(this.peopleById.get(id) ?? [])].sort();
	}

	getRelationshipPathsById(id: string): string[] {
		return [...(this.relationshipsById.get(id) ?? [])].sort();
	}

	getAdjacency(target: string): string[] {
		const values = new Set<string>();
		for (const key of referenceKeys(target)) {
			for (const path of this.adjacencyByReference.get(key) ?? []) values.add(path);
		}
		return [...values].sort();
	}

	getFile(path: string): StoredFile | undefined {
		return this.filesByPath.get(path);
	}

	getRevision(): number {
		return this.revision;
	}

	getPeopleForPaths(paths: Iterable<string>): PersonRecord[] {
		return this.getFiles(paths).flatMap((file) => file.person ? [file.person] : []);
	}

	getRelationshipsForPaths(paths: Iterable<string>): RelationshipRecord[] {
		return this.getFiles(paths).flatMap((file) => file.relationship ? [file.relationship] : []);
	}

	getFiles(paths: Iterable<string>): StoredFile[] {
		return [...new Set(paths)].map((path) => this.filesByPath.get(path)).filter((file): file is StoredFile => file !== undefined);
	}

	getDuplicatePersonIds(): string[] {
		return [...this.peopleById.entries()].filter(([, paths]) => paths.size > 1).map(([id]) => id).sort();
	}

	getPersonPathsForId(id: string): string[] {
		return [...(this.peopleById.get(id) ?? [])].sort();
	}

	getDuplicateRelationshipIds(): string[] {
		return [...this.relationshipsById.entries()].filter(([, paths]) => paths.size > 1).map(([id]) => id).sort();
	}

	getRelationshipPathsForId(id: string): string[] {
		return [...(this.relationshipsById.get(id) ?? [])].sort();
	}

	getDependentsForTarget(target: string): string[] {
		const dependents = new Set<string>();
		for (const key of referenceKeys(target)) {
			for (const path of this.dependentsByReference.get(key) ?? []) dependents.add(path);
		}
		for (const path of this.assetDependentsByPath.get(normalizePathIdentity(target)) ?? []) dependents.add(path);
		return [...dependents];
	}

	getDiagnosticsForPaths(paths: Iterable<string>): AtlasDiagnostic[] {
		const selected = new Set(paths);
		return [...this.filesByPath.entries()].flatMap(([path, file]) => selected.has(path) ? file.diagnostics : []);
	}

	private addIndexes(path: string, file: StoredFile): void {
		if (file.person) {
			addToSetMap(this.peopleById, file.person.id, path);
			for (const contact of file.person.contacts) {
				for (const key of recordReferenceKeys(contact)) addToSetMap(this.dependentsByReference, key, path);
			}
			if (file.person.photoPath) addToSetMap(this.assetDependentsByPath, normalizePathIdentity(file.person.photoPath), path);
		}
		if (file.relationship) {
			addToSetMap(this.relationshipsById, file.relationship.id, path);
			for (const endpoint of [file.relationship.from, file.relationship.to]) {
				for (const key of recordReferenceKeys(endpoint)) {
					addToSetMap(this.dependentsByReference, key, path);
					addToSetMap(this.adjacencyByReference, key, path);
				}
			}
		}
	}

	private removeIndexes(path: string, file: StoredFile): void {
		if (file.person) {
			removeFromSetMap(this.peopleById, file.person.id, path);
			for (const contact of file.person.contacts) {
				for (const key of recordReferenceKeys(contact)) removeFromSetMap(this.dependentsByReference, key, path);
			}
			if (file.person.photoPath) removeFromSetMap(this.assetDependentsByPath, normalizePathIdentity(file.person.photoPath), path);
		}
		if (file.relationship) {
			removeFromSetMap(this.relationshipsById, file.relationship.id, path);
			for (const endpoint of [file.relationship.from, file.relationship.to]) {
				for (const key of recordReferenceKeys(endpoint)) {
					removeFromSetMap(this.dependentsByReference, key, path);
					removeFromSetMap(this.adjacencyByReference, key, path);
				}
			}
		}
	}

	private getRecordTargets(file: StoredFile | undefined): string[] {
		if (!file) return [];
		const targets: string[] = [];
		if (file.person) {
			targets.push(file.person.id, file.person.filePath);
			if (file.person.photoPath) targets.push(file.person.photoPath);
		}
		if (file.relationship) {
			targets.push(file.relationship.id, file.relationship.filePath, file.relationship.from.target, file.relationship.to.target);
		}
		return targets;
	}
}

export type StoredIndexFile = StoredFile;
