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
		affectedContactMomentIds: [],
		addedPeople: [],
		updatedPeople: [],
		removedPeople: [],
		addedRelationships: [],
		updatedRelationships: [],
		removedRelationships: [],
		addedContactMoments: [],
		updatedContactMoments: [],
		removedContactMoments: [],
		affectedPeople: [],
		affectedRelationships: [],
		affectedContactMoments: [],
		diagnostics: [],
		duplicatePersonIds: [],
		duplicateRelationshipIds: [],
		duplicateContactMomentIds: [],
	};
}

function isMarkdownPath(path: string): boolean {
	return path.split("/").at(-1)?.toLowerCase().endsWith(".md") ?? false;
}

function duplicateDiagnostic(
	id: string,
	code: "duplicate-person-id" | "duplicate-relationship-id" | "duplicate-contact-moment-id",
	filePaths: string[],
): AtlasDiagnostic {
	const recordType =
		code === "duplicate-person-id"
			? "person"
			: code === "duplicate-relationship-id"
				? "relationship"
				: "contact-moment";
	return {
		id: `${code}:${id}`,
		severity: "error",
		code,
		message: `Multiple ${recordType} notes use the ID “${id}”.`,
		filePaths,
	};
}

function dedupeDiagnostics(diagnostics: Iterable<AtlasDiagnostic>): AtlasDiagnostic[] {
	return [...new Map([...diagnostics].map((diagnostic) => [diagnostic.id, diagnostic])).values()];
}

export class PersonIndex extends Component {
	private readonly state = new IndexState();
	private readonly listeners = new Set<IndexListener>();
	private readonly deltaListeners = new Set<IndexDeltaListener>();
	private started = false;
	private initialResolutionPending = false;
	private initialResolutionObserved = false;
	private snapshot: RawIndexSnapshot = { people: [], relationships: [], contactMoments: [], diagnostics: [] };

	constructor(
		private readonly app: App,
		private readonly getSettings: () => PeopleAtlasSettings,
	) {
		super();
	}

	override onload(): void {
		this.started = true;
		this.initialResolutionPending = true;
		this.initialResolutionObserved = false;

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (!(file instanceof TFile)) return;
				if (file.extension === "md") this.updateFile(file);
				else this.refreshAssetDependents([file.path], file.path);
			}),
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (!(file instanceof TFile) || file.extension === "md") return;
				this.refreshAssetDependents([file.path], file.path);
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				this.updateFile(file);
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("resolved", () => {
				if (!this.started) return;
				this.initialResolutionObserved = true;
				if (!this.initialResolutionPending) return;
				this.rebuildAll();
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("resolve", (file) => {
				if (this.shouldDeferIncrementalUpdates()) return;
				this.reindexPaths([...this.state.getDependentsForTarget(file.path), ...this.getMetadataDependents(file.path)]);
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				const dependents = [...this.state.getDependentsForTarget(file.path), ...this.getMetadataDependents(file.path)];
				if (this.shouldDeferIncrementalUpdates() && file instanceof TFile && file.extension === "md") return;
				if (file instanceof TFile && file.extension !== "md") {
					this.refreshAssetDependents([file.path], file.path, dependents);
					return;
				}
				this.removePath(file.path);
				this.reindexPaths(dependents);
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				const dependents = [...this.state.getDependentsForTarget(oldPath), ...this.getMetadataDependents(oldPath)];
				const oldWasMarkdown = isMarkdownPath(oldPath);
				const newIsMarkdown = file instanceof TFile && file.extension === "md";
				if (this.shouldDeferIncrementalUpdates() && (oldWasMarkdown || newIsMarkdown)) return;
				if (file instanceof TFile && !oldWasMarkdown && !newIsMarkdown) {
					this.refreshAssetDependents([oldPath, file.path], oldPath, dependents);
					return;
				}
				const removed = this.removePath(oldPath, false);
				const added = file instanceof TFile ? this.updateFile(file, false) : undefined;
				const renameDelta = this.mergeDeltas(removed, added, [oldPath, ...(file instanceof TFile ? [file.path] : [])]);
				if (renameDelta) this.publish(renameDelta);
				this.reindexPaths(dependents);
			}),
		);
		this.rebuildAll();
	}

	override onunload(): void {
		this.started = false;
		this.initialResolutionPending = false;
		this.initialResolutionObserved = false;
		this.state.clear();
		this.snapshot = { people: [], relationships: [], contactMoments: [], diagnostics: [] };
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

	getContactMomentPathsById(id: string): string[] {
		return this.state.getContactMomentPathsById(id);
	}

	getAdjacency(target: string): string[] {
		return this.state.getAdjacency(target);
	}

	rebuildAll(): void {
		if (!this.started) return;
		const files = this.app.vault.getMarkdownFiles();
		if (this.initialResolutionPending && files.length === 0) return;
		if (
			this.initialResolutionPending &&
			!this.initialResolutionObserved &&
			files.some((file) => this.app.metadataCache.getFileCache(file) === null)
		) {
			return;
		}
		if (this.initialResolutionPending && files.length > 0) this.initialResolutionPending = false;
		this.state.clear();
		for (const file of files) this.indexFile(file);
		const snapshot = this.state.getSnapshot();
		const delta = emptyDelta(this.getRevision());
		delta.changedPaths = files.map((file) => file.path);
		delta.addedPeople = snapshot.people;
		delta.addedRelationships = snapshot.relationships;
		delta.addedContactMoments = snapshot.contactMoments ?? [];
		delta.affectedPeople = snapshot.people;
		delta.affectedRelationships = snapshot.relationships;
		delta.affectedContactMoments = snapshot.contactMoments ?? [];
		delta.affectedPersonIds = snapshot.people.map((person) => person.id);
		delta.affectedRelationshipIds = snapshot.relationships.map((relationship) => relationship.id);
		delta.affectedContactMomentIds = (snapshot.contactMoments ?? []).map((contactMoment) => contactMoment.id);
		delta.duplicatePersonIds = this.getDuplicatePersonIds();
		delta.duplicateRelationshipIds = this.getDuplicateRelationshipIds();
		delta.duplicateContactMomentIds = this.getDuplicateContactMomentIds();
		delta.diagnostics = dedupeDiagnostics([
			...(snapshot.diagnostics ?? []),
			...delta.duplicatePersonIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-person-id", this.state.getPersonPathsForId(id)),
			),
			...delta.duplicateRelationshipIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-relationship-id", this.state.getRelationshipPathsForId(id)),
			),
			...delta.duplicateContactMomentIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-contact-moment-id", this.state.getContactMomentPathsForId(id)),
			),
		]);
		this.publish(delta);
	}

	private updateFile(file: TFile, publish = true): IndexDelta | undefined {
		if (!this.started || file.extension !== "md") return undefined;
		if (this.shouldDeferIncrementalUpdates()) return undefined;
		const change = this.state.upsert(
			parseAtlasFile(this.app, file, this.app.metadataCache.getFileCache(file), this.getSettings()),
		);
		if (this.initialResolutionPending) this.initialResolutionPending = false;
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

	private reindexPaths(paths: Iterable<string>): boolean {
		if (this.shouldDeferIncrementalUpdates()) return false;
		let published = false;
		for (const path of new Set(paths)) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile && this.updateFile(file)) published = true;
		}
		return published;
	}

	private refreshAssetDependents(changedPaths: string[], dependencyTarget: string, knownDependents?: string[]): void {
		const dependents = knownDependents ?? [
			...this.state.getDependentsForTarget(dependencyTarget),
			...this.getMetadataDependents(dependencyTarget),
		];
		if (this.reindexPaths(dependents)) return;
		const delta = emptyDelta(this.state.advanceRevision());
		delta.changedPaths = [...new Set(changedPaths)].sort();
		delta.duplicatePersonIds = this.getDuplicatePersonIds();
		delta.duplicateRelationshipIds = this.getDuplicateRelationshipIds();
		delta.duplicateContactMomentIds = this.getDuplicateContactMomentIds();
		delta.diagnostics = dedupeDiagnostics([
			...delta.duplicatePersonIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-person-id", this.state.getPersonPathsForId(id)),
			),
			...delta.duplicateRelationshipIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-relationship-id", this.state.getRelationshipPathsForId(id)),
			),
			...delta.duplicateContactMomentIds.map((id) =>
				duplicateDiagnostic(id, "duplicate-contact-moment-id", this.state.getContactMomentPathsForId(id)),
			),
		]);
		this.publish(delta);
	}

	private shouldDeferIncrementalUpdates(): boolean {
		return this.initialResolutionPending && !this.initialResolutionObserved;
	}

	private getMetadataDependents(targetPath: string): string[] {
		const resolvedLinks = this.app.metadataCache.resolvedLinks ?? {};
		return Object.entries(resolvedLinks)
			.filter(([, targets]) => Object.hasOwn(targets, targetPath))
			.map(([sourcePath]) => sourcePath);
	}

	private createDelta(change: IndexStateChange): IndexDelta {
		const previousPerson = change.previous?.person;
		const nextPerson = change.next?.person;
		const previousRelationship = change.previous?.relationship;
		const nextRelationship = change.next?.relationship;
		const previousContactMoment = change.previousContactMoment;
		const nextContactMoment = change.nextContactMoment;
		const affectedPeople = this.state.getPeopleForPaths(change.affectedPaths);
		const affectedRelationships = this.state.getRelationshipsForPaths(change.affectedPaths);
		const affectedContactMoments = this.state.getContactMomentsForPaths(change.affectedPaths);
		const duplicateContactMomentIds = this.getDuplicateContactMomentIds();
		return {
			revision: change.revision,
			changedPaths: [...change.affectedPaths].sort(),
			removedPaths: change.removed ? [change.path] : [],
			affectedPersonIds: [...new Set([previousPerson?.id, nextPerson?.id].filter((id): id is string => Boolean(id)))],
			affectedRelationshipIds: [
				...new Set([previousRelationship?.id, nextRelationship?.id].filter((id): id is string => Boolean(id))),
			],
			affectedContactMomentIds: [
				...new Set(
					[
						previousContactMoment?.id,
						nextContactMoment?.id,
						...affectedContactMoments.map((moment) => moment.id),
					].filter((id): id is string => Boolean(id)),
				),
			],
			addedPeople: !previousPerson && nextPerson ? [nextPerson] : [],
			updatedPeople: previousPerson && nextPerson ? [nextPerson] : [],
			removedPeople: previousPerson && !nextPerson ? [previousPerson] : [],
			addedRelationships: !previousRelationship && nextRelationship ? [nextRelationship] : [],
			updatedRelationships: previousRelationship && nextRelationship ? [nextRelationship] : [],
			removedRelationships: previousRelationship && !nextRelationship ? [previousRelationship] : [],
			addedContactMoments: !previousContactMoment && nextContactMoment ? [nextContactMoment] : [],
			updatedContactMoments: previousContactMoment && nextContactMoment ? [nextContactMoment] : [],
			removedContactMoments: previousContactMoment && !nextContactMoment ? [previousContactMoment] : [],
			affectedPeople,
			affectedRelationships,
			affectedContactMoments,
			diagnostics: dedupeDiagnostics([
				...this.state.getDiagnosticsForPaths(change.affectedPaths),
				...this.getDuplicatePersonIds().map((id) =>
					duplicateDiagnostic(id, "duplicate-person-id", this.state.getPersonPathsForId(id)),
				),
				...this.getDuplicateRelationshipIds().map((id) =>
					duplicateDiagnostic(id, "duplicate-relationship-id", this.state.getRelationshipPathsForId(id)),
				),
				...duplicateContactMomentIds.map((id) =>
					duplicateDiagnostic(id, "duplicate-contact-moment-id", this.state.getContactMomentPathsForId(id)),
				),
			]),
			duplicatePersonIds: this.getDuplicatePersonIds(),
			duplicateRelationshipIds: this.getDuplicateRelationshipIds(),
			duplicateContactMomentIds,
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
			affectedContactMomentIds: [
				...new Set([...(first?.affectedContactMomentIds ?? []), ...(second?.affectedContactMomentIds ?? [])]),
			],
			addedPeople: [...(first?.addedPeople ?? []), ...(second?.addedPeople ?? [])],
			updatedPeople: [...(first?.updatedPeople ?? []), ...(second?.updatedPeople ?? [])],
			removedPeople: [...(first?.removedPeople ?? []), ...(second?.removedPeople ?? [])],
			addedRelationships: [...(first?.addedRelationships ?? []), ...(second?.addedRelationships ?? [])],
			updatedRelationships: [...(first?.updatedRelationships ?? []), ...(second?.updatedRelationships ?? [])],
			removedRelationships: [...(first?.removedRelationships ?? []), ...(second?.removedRelationships ?? [])],
			addedContactMoments: [...(first?.addedContactMoments ?? []), ...(second?.addedContactMoments ?? [])],
			updatedContactMoments: [...(first?.updatedContactMoments ?? []), ...(second?.updatedContactMoments ?? [])],
			removedContactMoments: [...(first?.removedContactMoments ?? []), ...(second?.removedContactMoments ?? [])],
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
			affectedContactMoments: [
				...new Map(
					[...(first?.affectedContactMoments ?? []), ...(second?.affectedContactMoments ?? [])].map((moment) => [
						moment.filePath,
						moment,
					]),
				).values(),
			],
			diagnostics: [...diagnostics.values()],
			duplicatePersonIds: latest.duplicatePersonIds,
			duplicateRelationshipIds: latest.duplicateRelationshipIds,
			duplicateContactMomentIds: latest.duplicateContactMomentIds ?? [],
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

	private getDuplicateContactMomentIds(): string[] {
		return this.state.getDuplicateContactMomentIds();
	}
}
