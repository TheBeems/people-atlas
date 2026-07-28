import { Component, TFile, type App } from "obsidian";
import type { AtlasDiagnostic, IndexDelta, RawIndexSnapshot } from "../domain/types";
import type { PeopleAtlasSettings } from "../settings/types";
import { parseAtlasFile } from "./frontmatter";
import { IndexState, type IndexStateChange } from "./index-state";

export type IndexListener = (snapshot: RawIndexSnapshot, delta?: IndexDelta) => void;
export type IndexDeltaListener = (delta: IndexDelta) => void;

function emptyDelta(revision: number): IndexDelta {
	return {
		revision,
		changedPaths: [],
		removedPaths: [],
		affectedPersonIds: [],
		affectedRelationshipIds: [],
		addedPeople: [],
		updatedPeople: [],
		removedPeople: [],
		addedRelationships: [],
		updatedRelationships: [],
		removedRelationships: [],
		affectedPeople: [],
		affectedRelationships: [],
		diagnostics: [],
		duplicatePersonIds: [],
		duplicateRelationshipIds: [],
	};
}

function duplicateDiagnostic(
	id: string,
	code: "duplicate-person-id" | "duplicate-relationship-id",
	filePaths: string[],
): AtlasDiagnostic {
	return {
		id: `${code}:${id}`,
		severity: "error",
		code,
		message: `Multiple ${code === "duplicate-person-id" ? "person" : "relationship"} notes use the ID “${id}”.`,
		filePaths,
	};
}

export class PersonIndex extends Component {
	private readonly state = new IndexState();
	private readonly listeners = new Set<IndexListener>();
	private readonly deltaListeners = new Set<IndexDeltaListener>();
	private started = false;
	private snapshot: RawIndexSnapshot = { people: [], relationships: [], diagnostics: [] };

	constructor(
		private readonly app: App,
		private readonly getSettings: () => PeopleAtlasSettings,
	) {
		super();
	}

	override onload(): void {
		this.started = true;
		this.rebuildAll();

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) this.updateFile(file);
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				this.updateFile(file);
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("resolve", (file) => {
				this.reindexPaths([...this.state.getDependentsForTarget(file.path), ...this.getMetadataDependents(file.path)]);
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				const dependents = [...this.state.getDependentsForTarget(file.path), ...this.getMetadataDependents(file.path)];
				this.removePath(file.path);
				this.reindexPaths(dependents);
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				const dependents = [...this.state.getDependentsForTarget(oldPath), ...this.getMetadataDependents(oldPath)];
				const removed = this.removePath(oldPath, false);
				const added = file instanceof TFile ? this.updateFile(file, false) : undefined;
				const renameDelta = this.mergeDeltas(removed, added, [oldPath]);
				if (renameDelta) this.publish(renameDelta);
				this.reindexPaths(dependents);
			}),
		);
	}

	override onunload(): void {
		this.started = false;
		this.state.clear();
		this.snapshot = { people: [], relationships: [], diagnostics: [] };
		this.listeners.clear();
		this.deltaListeners.clear();
	}

	subscribe(listener: IndexListener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot);
		return () => this.listeners.delete(listener);
	}

	subscribeDelta(listener: IndexDeltaListener): () => void {
		this.deltaListeners.add(listener);
		return () => this.deltaListeners.delete(listener);
	}

	getSnapshot(): RawIndexSnapshot {
		return this.snapshot;
	}

	getPeoplePathsById(id: string): string[] {
		return this.state.getPeoplePathsById(id);
	}

	getRelationshipPathsById(id: string): string[] {
		return this.state.getRelationshipPathsById(id);
	}

	getAdjacency(target: string): string[] {
		return this.state.getAdjacency(target);
	}

	rebuildAll(): void {
		if (!this.started) return;
		this.state.clear();
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) this.indexFile(file);
		const snapshot = this.state.getSnapshot();
		const delta = emptyDelta(this.getRevision());
		delta.changedPaths = files.map((file) => file.path);
		delta.addedPeople = snapshot.people;
		delta.addedRelationships = snapshot.relationships;
		delta.affectedPeople = snapshot.people;
		delta.affectedRelationships = snapshot.relationships;
		delta.affectedPersonIds = snapshot.people.map((person) => person.id);
		delta.affectedRelationshipIds = snapshot.relationships.map((relationship) => relationship.id);
		delta.duplicatePersonIds = this.getDuplicatePersonIds();
		delta.duplicateRelationshipIds = this.getDuplicateRelationshipIds();
		delta.diagnostics = [
			...(snapshot.diagnostics ?? []),
			...delta.duplicatePersonIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-person-id", this.state.getPersonPathsForId(id)),
			),
			...delta.duplicateRelationshipIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-relationship-id", this.state.getRelationshipPathsForId(id)),
			),
		];
		this.publish(delta);
	}

	private updateFile(file: TFile, publish = true): IndexDelta | undefined {
		if (!this.started || file.extension !== "md") return undefined;
		const change = this.state.upsert(
			parseAtlasFile(this.app, file, this.app.metadataCache.getFileCache(file), this.getSettings()),
		);
		const delta = this.createDelta(change);
		if (publish) this.publish(delta);
		return delta;
	}

	private indexFile(file: TFile): void {
		if (file.extension !== "md") return;
		this.state.upsert(parseAtlasFile(this.app, file, this.app.metadataCache.getFileCache(file), this.getSettings()));
	}

	private removePath(path: string, publish = true): IndexDelta | undefined {
		const change = this.state.remove(path);
		if (!change.previous && change.affectedPaths.size <= 1) return undefined;
		const delta = this.createDelta(change);
		if (publish) this.publish(delta);
		return delta;
	}

	private reindexPaths(paths: Iterable<string>): void {
		for (const path of new Set(paths)) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) this.updateFile(file);
		}
	}

	private getMetadataDependents(targetPath: string): string[] {
		const resolvedLinks = this.app.metadataCache.resolvedLinks ?? {};
		return Object.entries(resolvedLinks)
			.filter(([, targets]) => Object.prototype.hasOwnProperty.call(targets, targetPath))
			.map(([sourcePath]) => sourcePath);
	}

	private createDelta(change: IndexStateChange): IndexDelta {
		const previousPerson = change.previous?.person;
		const nextPerson = change.next?.person;
		const previousRelationship = change.previous?.relationship;
		const nextRelationship = change.next?.relationship;
		const affectedPeople = this.state.getPeopleForPaths(change.affectedPaths);
		const affectedRelationships = this.state.getRelationshipsForPaths(change.affectedPaths);
		return {
			revision: change.revision,
			changedPaths: [...change.affectedPaths].sort(),
			removedPaths: change.removed ? [change.path] : [],
			affectedPersonIds: [...new Set([previousPerson?.id, nextPerson?.id].filter((id): id is string => Boolean(id)))],
			affectedRelationshipIds: [
				...new Set([previousRelationship?.id, nextRelationship?.id].filter((id): id is string => Boolean(id))),
			],
			addedPeople: !previousPerson && nextPerson ? [nextPerson] : [],
			updatedPeople: previousPerson && nextPerson ? [nextPerson] : [],
			removedPeople: previousPerson && !nextPerson ? [previousPerson] : [],
			addedRelationships: !previousRelationship && nextRelationship ? [nextRelationship] : [],
			updatedRelationships: previousRelationship && nextRelationship ? [nextRelationship] : [],
			removedRelationships: previousRelationship && !nextRelationship ? [previousRelationship] : [],
			affectedPeople,
			affectedRelationships,
			diagnostics: [
				...this.state.getDiagnosticsForPaths(change.affectedPaths),
				...this.getDuplicatePersonIds().map((id) =>
					duplicateDiagnostic(id, "duplicate-person-id", this.state.getPersonPathsForId(id)),
				),
				...this.getDuplicateRelationshipIds().map((id) =>
					duplicateDiagnostic(id, "duplicate-relationship-id", this.state.getRelationshipPathsForId(id)),
				),
			],
			duplicatePersonIds: this.getDuplicatePersonIds(),
			duplicateRelationshipIds: this.getDuplicateRelationshipIds(),
		};
	}

	private publish(delta: IndexDelta): void {
		this.snapshot = this.state.getSnapshot();
		for (const listener of this.listeners) listener(this.snapshot, delta);
		for (const listener of this.deltaListeners) listener(delta);
	}

	private mergeDeltas(
		first: IndexDelta | undefined,
		second: IndexDelta | undefined,
		extraChangedPaths: string[] = [],
	): IndexDelta | undefined {
		if (!first && !second) return undefined;
		const latest = second ?? (first as IndexDelta);
		const diagnostics = new Map<string, AtlasDiagnostic>();
		for (const diagnostic of [...(first?.diagnostics ?? []), ...(second?.diagnostics ?? [])])
			diagnostics.set(diagnostic.id, diagnostic);
		return {
			...latest,
			revision: latest.revision,
			changedPaths: [
				...new Set([...(first?.changedPaths ?? []), ...(second?.changedPaths ?? []), ...extraChangedPaths]),
			].sort(),
			removedPaths: [...new Set([...(first?.removedPaths ?? []), ...(second?.removedPaths ?? [])])].sort(),
			affectedPersonIds: [...new Set([...(first?.affectedPersonIds ?? []), ...(second?.affectedPersonIds ?? [])])],
			affectedRelationshipIds: [
				...new Set([...(first?.affectedRelationshipIds ?? []), ...(second?.affectedRelationshipIds ?? [])]),
			],
			addedPeople: [...(first?.addedPeople ?? []), ...(second?.addedPeople ?? [])],
			updatedPeople: [...(first?.updatedPeople ?? []), ...(second?.updatedPeople ?? [])],
			removedPeople: [...(first?.removedPeople ?? []), ...(second?.removedPeople ?? [])],
			addedRelationships: [...(first?.addedRelationships ?? []), ...(second?.addedRelationships ?? [])],
			updatedRelationships: [...(first?.updatedRelationships ?? []), ...(second?.updatedRelationships ?? [])],
			removedRelationships: [...(first?.removedRelationships ?? []), ...(second?.removedRelationships ?? [])],
			affectedPeople: [
				...new Map(
					[...(first?.affectedPeople ?? []), ...(second?.affectedPeople ?? [])].map((person) => [
						person.filePath,
						person,
					]),
				).values(),
			],
			affectedRelationships: [
				...new Map(
					[...(first?.affectedRelationships ?? []), ...(second?.affectedRelationships ?? [])].map((relationship) => [
						relationship.filePath,
						relationship,
					]),
				).values(),
			],
			diagnostics: [...diagnostics.values()],
			duplicatePersonIds: latest.duplicatePersonIds,
			duplicateRelationshipIds: latest.duplicateRelationshipIds,
		};
	}

	private getRevision(): number {
		return this.state.getRevision();
	}

	private getDuplicatePersonIds(): string[] {
		return this.state.getDuplicatePersonIds();
	}

	private getDuplicateRelationshipIds(): string[] {
		return this.state.getDuplicateRelationshipIds();
	}
}
