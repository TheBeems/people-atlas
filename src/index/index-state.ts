import { normalizePathIdentity } from "../domain/identity";
import { createReferenceIndex, resolveReference, type ReferenceResolution } from "../domain/person-reference-resolver";
import { referenceKey } from "../domain/wikilink";
import type {
	AtlasDiagnostic,
	ContactMomentRecord,
	PersonRecord,
	PersonReference,
	RawIndexSnapshot,
	RelationshipRecord,
	RelationshipReference,
} from "../domain/types";
import type { ParsedAtlasFile } from "./frontmatter";

export interface StoredFile {
	person?: PersonRecord;
	relationship?: RelationshipRecord;
	contactMoment?: ContactMomentRecord;
	diagnostics: AtlasDiagnostic[];
}

export interface IndexStateChange {
	revision: number;
	path: string;
	previous?: StoredFile;
	next?: StoredFile;
	previousContactMoment?: ContactMomentRecord;
	nextContactMoment?: ContactMomentRecord;
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

function normalizedPathIdentities(target: string): string[] {
	const normalized = normalizePathIdentity(target);
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

function pathReferenceKeys(target: string): string[] {
	return normalizedPathIdentities(target).map((identity) => `path:${identity}`);
}

function referenceKeys(target: string): string[] {
	const normalized = target.trim().replace(/\\/g, "/").toLowerCase();
	return [`ref:${normalized}`, ...pathReferenceKeys(target)];
}

function recordReferenceKeys(reference: { target: string; resolvedPath?: string | undefined }): string[] {
	const keys = new Set([`ref:${referenceKey({ target: reference.target })}`, ...pathReferenceKeys(reference.target)]);
	if (reference.resolvedPath) {
		for (const key of pathReferenceKeys(reference.resolvedPath)) keys.add(key);
	}
	return [...keys];
}

function sortedUnique(values: Iterable<string>): string[] {
	return [...new Set(values)].sort();
}

function dedupeDiagnostics(diagnostics: Iterable<AtlasDiagnostic>): AtlasDiagnostic[] {
	return [...new Map([...diagnostics].map((diagnostic) => [diagnostic.id, diagnostic])).values()];
}

function duplicateContactMomentDiagnostic(id: string, filePaths: string[]): AtlasDiagnostic {
	return {
		id: `duplicate-contact-moment-id:${id}`,
		severity: "error",
		code: "duplicate-contact-moment-id",
		message: `Multiple contact-moment notes use the ID “${id}”.`,
		filePaths: sortedUnique(filePaths),
	};
}

interface ResolvedContactMoment {
	record: ContactMomentRecord;
	diagnostics: AtlasDiagnostic[];
}

export class IndexState {
	private readonly filesByPath = new Map<string, StoredFile>();
	private readonly peopleById = new Map<string, Set<string>>();
	private readonly peopleByPath = new Map<string, Set<string>>();
	private readonly relationshipsById = new Map<string, Set<string>>();
	private readonly relationshipsByPath = new Map<string, Set<string>>();
	private readonly contactMomentsById = new Map<string, Set<string>>();
	private readonly dependentsByReference = new Map<string, Set<string>>();
	private readonly assetDependentsByPath = new Map<string, Set<string>>();
	private readonly adjacencyByReference = new Map<string, Set<string>>();
	private revision = 0;

	clear(): void {
		this.filesByPath.clear();
		this.peopleById.clear();
		this.peopleByPath.clear();
		this.relationshipsById.clear();
		this.relationshipsByPath.clear();
		this.contactMomentsById.clear();
		this.dependentsByReference.clear();
		this.assetDependentsByPath.clear();
		this.adjacencyByReference.clear();
	}

	upsert(parsed: ParsedAtlasFile, additionalAffectedPaths: Iterable<string> = []): IndexStateChange {
		const path = parsed.filePath;
		const previous = this.filesByPath.get(path);
		const previousContactMoment = previous?.contactMoment
			? this.resolveContactMoment(previous.contactMoment).record
			: undefined;
		const affectedPaths = new Set<string>([path, ...additionalAffectedPaths, ...this.getDependentsForTarget(path)]);
		if (previous?.contactMoment) {
			for (const duplicatePath of this.getContactMomentPathsForId(previous.contactMoment.id)) {
				affectedPaths.add(duplicatePath);
			}
		}
		if (previous) this.removeIndexes(path, previous);

		const next: StoredFile = { diagnostics: parsed.diagnostics };
		if (parsed.person) next.person = parsed.person;
		if (parsed.relationship) next.relationship = parsed.relationship;
		if (parsed.contactMoment) next.contactMoment = parsed.contactMoment;
		this.filesByPath.set(path, next);
		this.addIndexes(path, next);
		if (next.contactMoment) {
			for (const duplicatePath of this.getContactMomentPathsForId(next.contactMoment.id)) {
				affectedPaths.add(duplicatePath);
			}
		}
		const nextContactMoment = next.contactMoment ? this.resolveContactMoment(next.contactMoment).record : undefined;
		for (const target of this.getRecordTargets(next)) {
			for (const dependent of this.getDependentsForTarget(target)) affectedPaths.add(dependent);
		}
		for (const target of this.getRecordTargets(previous)) {
			for (const dependent of this.getDependentsForTarget(target)) affectedPaths.add(dependent);
		}
		this.revision += 1;
		const change: IndexStateChange = { revision: this.revision, path, next, affectedPaths, removed: false };
		if (previous) change.previous = previous;
		if (previousContactMoment) change.previousContactMoment = previousContactMoment;
		if (nextContactMoment) change.nextContactMoment = nextContactMoment;
		return change;
	}

	remove(path: string, additionalAffectedPaths: Iterable<string> = []): IndexStateChange {
		const previous = this.filesByPath.get(path);
		const previousContactMoment = previous?.contactMoment
			? this.resolveContactMoment(previous.contactMoment).record
			: undefined;
		const affectedPaths = new Set<string>([path, ...additionalAffectedPaths, ...this.getDependentsForTarget(path)]);
		if (previous?.contactMoment) {
			for (const duplicatePath of this.getContactMomentPathsForId(previous.contactMoment.id)) {
				affectedPaths.add(duplicatePath);
			}
		}
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
		if (previousContactMoment) change.previousContactMoment = previousContactMoment;
		return change;
	}

	getSnapshot(): RawIndexSnapshot {
		const people: PersonRecord[] = [];
		const relationships: RelationshipRecord[] = [];
		const contactMoments: ContactMomentRecord[] = [];
		const diagnostics: AtlasDiagnostic[] = [];
		for (const file of this.filesByPath.values()) {
			if (file.person) people.push(file.person);
			if (file.relationship) relationships.push(file.relationship);
			diagnostics.push(...file.diagnostics);
			if (file.contactMoment) {
				const resolved = this.resolveContactMoment(file.contactMoment);
				contactMoments.push(resolved.record);
				diagnostics.push(...resolved.diagnostics);
			}
		}
		for (const id of this.getDuplicateContactMomentIds()) {
			diagnostics.push(duplicateContactMomentDiagnostic(id, this.getContactMomentPathsForId(id)));
		}
		return { people, relationships, contactMoments, diagnostics: dedupeDiagnostics(diagnostics) };
	}

	getPeoplePathsById(id: string): string[] {
		return [...(this.peopleById.get(id) ?? [])].sort();
	}

	getRelationshipPathsById(id: string): string[] {
		return [...(this.relationshipsById.get(id) ?? [])].sort();
	}

	getContactMomentPathsById(id: string): string[] {
		return [...(this.contactMomentsById.get(id) ?? [])].sort();
	}

	getContactMomentPathsForId(id: string): string[] {
		return this.getContactMomentPathsById(id);
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

	advanceRevision(): number {
		this.revision += 1;
		return this.revision;
	}

	getPeopleForPaths(paths: Iterable<string>): PersonRecord[] {
		return this.getFiles(paths).flatMap((file) => (file.person ? [file.person] : []));
	}

	getRelationshipsForPaths(paths: Iterable<string>): RelationshipRecord[] {
		return this.getFiles(paths).flatMap((file) => (file.relationship ? [file.relationship] : []));
	}

	getContactMomentsForPaths(paths: Iterable<string>): ContactMomentRecord[] {
		return this.getFiles(paths).flatMap((file) =>
			file.contactMoment ? [this.resolveContactMoment(file.contactMoment).record] : [],
		);
	}

	getFiles(paths: Iterable<string>): StoredFile[] {
		return [...new Set(paths)]
			.map((path) => this.filesByPath.get(path))
			.filter((file): file is StoredFile => file !== undefined);
	}

	getDuplicatePersonIds(): string[] {
		return [...this.peopleById.entries()]
			.filter(([, paths]) => paths.size > 1)
			.map(([id]) => id)
			.sort();
	}

	getPersonPathsForId(id: string): string[] {
		return [...(this.peopleById.get(id) ?? [])].sort();
	}

	getDuplicateRelationshipIds(): string[] {
		return [...this.relationshipsById.entries()]
			.filter(([, paths]) => paths.size > 1)
			.map(([id]) => id)
			.sort();
	}

	getDuplicateContactMomentIds(): string[] {
		return [...this.contactMomentsById.entries()]
			.filter(([, paths]) => paths.size > 1)
			.map(([id]) => id)
			.sort();
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
		const diagnostics = [...this.filesByPath.entries()].flatMap(([path, file]) => {
			if (!selected.has(path)) return [];
			return [
				...file.diagnostics,
				...(file.contactMoment ? this.resolveContactMoment(file.contactMoment).diagnostics : []),
			];
		});
		for (const id of this.getDuplicateContactMomentIds()) {
			const filePaths = this.getContactMomentPathsForId(id);
			if (filePaths.some((path) => selected.has(path))) {
				diagnostics.push(duplicateContactMomentDiagnostic(id, filePaths));
			}
		}
		return dedupeDiagnostics(diagnostics);
	}

	private addIndexes(path: string, file: StoredFile): void {
		if (file.person) {
			addToSetMap(this.peopleById, file.person.id, path);
			addToSetMap(this.peopleByPath, normalizePathIdentity(file.person.filePath), path);
			for (const contact of file.person.contacts) {
				for (const key of recordReferenceKeys(contact)) addToSetMap(this.dependentsByReference, key, path);
			}
			if (file.person.photoPath)
				addToSetMap(this.assetDependentsByPath, normalizePathIdentity(file.person.photoPath), path);
		}
		if (file.relationship) {
			addToSetMap(this.relationshipsById, file.relationship.id, path);
			addToSetMap(this.relationshipsByPath, normalizePathIdentity(file.relationship.filePath), path);
			for (const endpoint of [file.relationship.from, file.relationship.to]) {
				for (const key of recordReferenceKeys(endpoint)) {
					addToSetMap(this.dependentsByReference, key, path);
					addToSetMap(this.adjacencyByReference, key, path);
				}
			}
		}
		if (file.contactMoment) {
			addToSetMap(this.contactMomentsById, file.contactMoment.id, path);
			for (const person of file.contactMoment.people) {
				for (const key of recordReferenceKeys(person)) addToSetMap(this.dependentsByReference, key, path);
			}
			if (file.contactMoment.relationship) {
				for (const key of recordReferenceKeys(file.contactMoment.relationship)) {
					addToSetMap(this.dependentsByReference, key, path);
				}
			}
		}
	}

	private removeIndexes(path: string, file: StoredFile): void {
		if (file.person) {
			removeFromSetMap(this.peopleById, file.person.id, path);
			removeFromSetMap(this.peopleByPath, normalizePathIdentity(file.person.filePath), path);
			for (const contact of file.person.contacts) {
				for (const key of recordReferenceKeys(contact)) removeFromSetMap(this.dependentsByReference, key, path);
			}
			if (file.person.photoPath)
				removeFromSetMap(this.assetDependentsByPath, normalizePathIdentity(file.person.photoPath), path);
		}
		if (file.relationship) {
			removeFromSetMap(this.relationshipsById, file.relationship.id, path);
			removeFromSetMap(this.relationshipsByPath, normalizePathIdentity(file.relationship.filePath), path);
			for (const endpoint of [file.relationship.from, file.relationship.to]) {
				for (const key of recordReferenceKeys(endpoint)) {
					removeFromSetMap(this.dependentsByReference, key, path);
					removeFromSetMap(this.adjacencyByReference, key, path);
				}
			}
		}
		if (file.contactMoment) {
			removeFromSetMap(this.contactMomentsById, file.contactMoment.id, path);
			for (const person of file.contactMoment.people) {
				for (const key of recordReferenceKeys(person)) removeFromSetMap(this.dependentsByReference, key, path);
			}
			if (file.contactMoment.relationship) {
				for (const key of recordReferenceKeys(file.contactMoment.relationship)) {
					removeFromSetMap(this.dependentsByReference, key, path);
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
			targets.push(
				file.relationship.id,
				file.relationship.filePath,
				file.relationship.from.target,
				file.relationship.to.target,
			);
		}
		if (file.contactMoment) targets.push(file.contactMoment.id, file.contactMoment.filePath);
		return targets;
	}

	private resolveContactMoment(source: ContactMomentRecord): ResolvedContactMoment {
		const diagnostics: AtlasDiagnostic[] = [];
		const personIds: string[] = [];
		const personPaths = new Set<string>();
		const seenReferenceKeys = new Set<string>();
		let actionable = source.actionable;

		if ((this.contactMomentsById.get(source.id)?.size ?? 0) > 1) actionable = false;

		for (const reference of source.people) {
			const sourceReferenceKey = referenceKey(reference);
			const repeatedSourceReference = seenReferenceKeys.has(sourceReferenceKey);
			seenReferenceKeys.add(sourceReferenceKey);
			const resolution = this.resolvePersonReference(reference);
			if (resolution.status === "unresolved") {
				diagnostics.push({
					id: `unresolved-contact-moment-person:${source.filePath}:${sourceReferenceKey}`,
					severity: "error",
					code: "unresolved-contact-moment-person",
					message: `Contact moment “${source.filePath}” references an unresolved person identity “${reference.target}”.`,
					filePaths: [source.filePath],
					targetPath: reference.resolvedPath ?? reference.target,
				});
				actionable = false;
				continue;
			}
			if (resolution.status === "ambiguous") {
				const filePaths = sortedUnique([source.filePath, ...resolution.candidatePaths]);
				diagnostics.push({
					id: `ambiguous-contact-moment-person:${source.filePath}:${sourceReferenceKey}`,
					severity: "error",
					code: "ambiguous-contact-moment-person",
					message: `Contact moment “${source.filePath}” references ambiguous person identity “${reference.target}”.`,
					filePaths,
					targetPath: reference.resolvedPath ?? reference.target,
				});
				actionable = false;
				continue;
			}

			const resolved = resolution.resolved;
			if (!resolved) continue;
			if (personIds.includes(resolved.id)) {
				const duplicateKey = repeatedSourceReference ? sourceReferenceKey : resolved.id;
				diagnostics.push({
					id: `duplicate-contact-moment-person:${source.filePath}:${duplicateKey}`,
					severity: "error",
					code: "duplicate-contact-moment-person",
					message: `Contact moment “${source.filePath}” resolves more than one reference to person “${resolved.id}”.`,
					filePaths: sortedUnique([source.filePath, resolved.filePath]),
					targetPath: resolved.filePath,
				});
				actionable = false;
				continue;
			}
			personIds.push(resolved.id);
			personPaths.add(resolved.filePath);
		}

		let relationshipId: string | undefined;
		if (source.relationship) {
			const resolution = this.resolveRelationshipReference(source.relationship);
			if (resolution.status === "unresolved") {
				diagnostics.push({
					id: `unresolved-contact-moment-relationship:${source.filePath}:${referenceKey(source.relationship)}`,
					severity: "error",
					code: "unresolved-contact-moment-relationship",
					message: `Contact moment “${source.filePath}” references an unresolved relationship identity “${source.relationship.target}”.`,
					filePaths: [source.filePath],
					targetPath: source.relationship.resolvedPath ?? source.relationship.target,
				});
				actionable = false;
			} else if (resolution.status === "ambiguous") {
				diagnostics.push({
					id: `ambiguous-contact-moment-relationship:${source.filePath}:${referenceKey(source.relationship)}`,
					severity: "error",
					code: "ambiguous-contact-moment-relationship",
					message: `Contact moment “${source.filePath}” references ambiguous relationship identity “${source.relationship.target}”.`,
					filePaths: sortedUnique([source.filePath, ...resolution.candidatePaths]),
					targetPath: source.relationship.resolvedPath ?? source.relationship.target,
				});
				actionable = false;
			} else {
				const resolved = resolution.resolved;
				if (resolved) {
					relationshipId = resolved.id;
					const endpointPaths = [resolved.from, resolved.to].map((endpoint) =>
						this.resolveCanonicalPersonPath(endpoint),
					);
					if (endpointPaths.some((path) => path === undefined)) {
						diagnostics.push({
							id: `unresolved-contact-moment-relationship:${source.filePath}:${resolved.id}:endpoints`,
							severity: "error",
							code: "unresolved-contact-moment-relationship",
							message: `Contact moment “${source.filePath}” references relationship “${resolved.id}”, whose endpoints are not canonical.`,
							filePaths: sortedUnique([source.filePath, resolved.filePath]),
							targetPath: resolved.filePath,
						});
						actionable = false;
					} else if (!endpointPaths.some((path) => path !== undefined && personPaths.has(path))) {
						diagnostics.push({
							id: `contact-moment-relationship-person-mismatch:${source.filePath}:${resolved.id}`,
							severity: "error",
							code: "contact-moment-relationship-person-mismatch",
							message: `Contact moment “${source.filePath}” does not share a canonical person with relationship “${resolved.id}”.`,
							filePaths: sortedUnique([source.filePath, resolved.filePath]),
							targetPath: resolved.filePath,
						});
						actionable = false;
					}
				}
			}
		}

		return {
			record: {
				...source,
				personIds,
				relationshipId,
				actionable,
				followUpActionable: source.followUpActionable && actionable,
			},
			diagnostics,
		};
	}

	private resolvePersonReference(reference: PersonReference): ReferenceResolution<PersonRecord> {
		return resolveReference(reference, "", createReferenceIndex(this.getPeopleRecords()));
	}

	private resolveRelationshipReference(reference: RelationshipReference): ReferenceResolution<RelationshipRecord> {
		return resolveReference(reference, "", createReferenceIndex(this.getRelationshipRecords()));
	}

	private getPeopleRecords(): PersonRecord[] {
		return [...this.filesByPath.values()].flatMap((file) => (file.person ? [file.person] : []));
	}

	private getRelationshipRecords(): RelationshipRecord[] {
		return [...this.filesByPath.values()].flatMap((file) => (file.relationship ? [file.relationship] : []));
	}

	private resolveCanonicalPersonPath(reference: PersonReference): string | undefined {
		const resolution = this.resolvePersonReference(reference);
		if (resolution.status !== "resolved" || !resolution.resolved) return undefined;
		if (this.getPersonPathsForId(resolution.resolved.id).length !== 1) return undefined;
		return resolution.resolved.filePath;
	}
}

export type StoredIndexFile = StoredFile;
