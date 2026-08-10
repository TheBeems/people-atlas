import { normalizePathIdentity } from "./identity";
import type { PersonReference, RelationshipReference } from "./types";

export type LinkResolver = (referenceTarget: string, sourcePath: string) => string | undefined;

export interface ReferenceRecord {
	id: string;
	filePath: string;
}

export interface ReferenceIndex<T extends ReferenceRecord> {
	readonly byId: ReadonlyMap<string, readonly T[]>;
	readonly byPath: ReadonlyMap<string, readonly T[]>;
}

export interface ReferenceResolution<T extends ReferenceRecord> {
	readonly status: "resolved" | "unresolved" | "ambiguous";
	readonly resolved: T | undefined;
	readonly candidates: T[];
	readonly candidatePaths: string[];
}

type PersistedReference = PersonReference | RelationshipReference;

function pathIdentities(path: string): string[] {
	const normalized = normalizePathIdentity(path);
	if (!normalized) return [];
	const identities = new Set([normalized]);
	if (normalized.endsWith(".md")) {
		const extensionless = normalized.slice(0, -3);
		if (extensionless) identities.add(extensionless);
	} else {
		identities.add(`${normalized}.md`);
	}
	return [...identities];
}

function addById<T extends ReferenceRecord>(index: Map<string, T[]>, record: T): void {
	const records = index.get(record.id) ?? [];
	if (!records.some((candidate) => candidate.filePath === record.filePath)) records.push(record);
	index.set(record.id, records);
}

function addByPath<T extends ReferenceRecord>(index: Map<string, T[]>, record: T): void {
	for (const identity of pathIdentities(record.filePath)) {
		const records = index.get(identity) ?? [];
		if (!records.some((candidate) => candidate.filePath === record.filePath)) records.push(record);
		index.set(identity, records);
	}
}

export function createReferenceIndex<T extends ReferenceRecord>(records: readonly T[]): ReferenceIndex<T> {
	const byId = new Map<string, T[]>();
	const byPath = new Map<string, T[]>();
	for (const record of records) {
		addById(byId, record);
		addByPath(byPath, record);
	}
	return { byId, byPath };
}

function pathEvidence(
	reference: PersistedReference,
	sourcePath: string,
	resolveLink: LinkResolver | undefined,
): string[] {
	if (reference.kind === "id") return [];
	if (reference.kind === "path") {
		const identities = new Set(pathIdentities(reference.target));
		if (reference.resolvedPath) {
			for (const identity of pathIdentities(reference.resolvedPath)) identities.add(identity);
		}
		return [...identities];
	}
	const identities = new Set<string>();
	const resolvedPath = reference.resolvedPath ?? resolveLink?.(reference.target, sourcePath);
	if (resolvedPath) {
		for (const identity of pathIdentities(resolvedPath)) identities.add(identity);
	}
	if (reference.target.includes("/") || reference.target.toLowerCase().endsWith(".md")) {
		for (const identity of pathIdentities(reference.target)) identities.add(identity);
	}
	return [...identities];
}

function addRecords<T extends ReferenceRecord>(target: Map<string, T>, records: readonly T[]): void {
	for (const record of records) target.set(record.filePath, record);
}

function ambiguousOrResolved<T extends ReferenceRecord>(candidates: T[]): ReferenceResolution<T> {
	const sorted = [...candidates].sort((left, right) => left.filePath.localeCompare(right.filePath));
	if (sorted.length === 0) return unresolved();
	if (sorted.length === 1) {
		return {
			status: "resolved",
			resolved: sorted[0],
			candidates: sorted,
			candidatePaths: sorted.map((record) => record.filePath),
		};
	}
	return {
		status: "ambiguous",
		resolved: undefined,
		candidates: sorted,
		candidatePaths: sorted.map((record) => record.filePath),
	};
}

function unresolved<T extends ReferenceRecord>(): ReferenceResolution<T> {
	return { status: "unresolved", resolved: undefined, candidates: [], candidatePaths: [] };
}

export function resolveReference<T extends ReferenceRecord>(
	reference: PersistedReference,
	sourcePath: string,
	index: ReferenceIndex<T>,
	resolveLink?: LinkResolver,
): ReferenceResolution<T> {
	if (reference.kind === "id") {
		return ambiguousOrResolved([...(index.byId.get(reference.target) ?? [])]);
	}

	const pathCandidates = new Map<string, T>();
	for (const identity of pathEvidence(reference, sourcePath, resolveLink)) {
		addRecords(pathCandidates, index.byPath.get(identity) ?? []);
	}
	if (pathCandidates.size === 0) return unresolved();

	const candidates = new Map<string, T>(pathCandidates);
	for (const record of pathCandidates.values()) {
		addRecords(candidates, index.byId.get(record.id) ?? []);
	}
	if (reference.kind === "wikilink") {
		addRecords(candidates, index.byId.get(reference.target) ?? []);
	}
	return ambiguousOrResolved([...candidates.values()]);
}
