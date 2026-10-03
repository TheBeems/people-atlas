import { BasesView, type BasesPropertyId, type QueryController } from "obsidian";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS } from "../constants";
import type {
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	IndexDelta,
	ProjectionCenterMode,
	ProjectionMode,
	RawIndexSnapshot,
} from "../domain/types";
import { normalizePathIdentity } from "../domain/identity";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { buildGraphSnapshot, filterPermittedSnapshotDiagnostics } from "../graph/graph-source";
import { applyGraphDelta } from "../graph/graph-delta";
import { projectGraph } from "../graph/project-graph";
import { filterRelationshipsAtDate } from "../graph/relationship-periods";
import { isCalendarDate } from "../domain/calendar-date";
import type PeopleAtlasPlugin from "../main";
import { resolvePersonPhotoResource } from "../person-photo-resource";
import { AtlasRenderer, type AtlasSelectionSource } from "../render/atlas-renderer";
import { adaptBasesEntries, type BasesFieldMapping } from "./entry-adapter";
import { BASES_OPTION_KEYS } from "./options";
import {
	buildLayoutKey,
	rememberCenter,
	type AtlasBrowseState,
	type AtlasLayoutMode,
	type AtlasViewState,
} from "../settings/view-state";
import type { LayoutSnapshot } from "../render/layout-state";

export class PeopleAtlasBasesView extends BasesView {
	override readonly type = BASES_VIEW_TYPE_PEOPLE_ATLAS;
	private readonly root: HTMLElement;
	private readonly diagnosticsButton: HTMLButtonElement;
	private renderer: AtlasRenderer | undefined;
	private unsubscribeIndex: (() => void) | undefined;
	private canonicalSnapshot: RawIndexSnapshot = { people: [], relationships: [], diagnostics: [] };
	private fullSnapshot: AtlasSnapshot | undefined;
	private visiblePaths = new Set<string>();
	private diagnosticEntryPaths = new Set<string>();
	private selectedPath: string | undefined;
	private selectedCenterPath: string | undefined;
	private selectedCenterId: string | undefined;
	private activePath: string | undefined;
	private readonly initialMyPersonSettingId: string;
	private initialMyPersonFilePath: string | undefined;
	private initialMyPersonCenterId: string | undefined;
	private awaitingInitialMyPersonCenter: boolean;

	constructor(
		controller: QueryController,
		parent: HTMLElement,
		private readonly plugin: PeopleAtlasPlugin,
	) {
		super(controller);
		this.root = parent.ownerDocument.createElement("div");
		this.root.className = "people-atlas-graph people-atlas-bases-view";
		this.diagnosticsButton = parent.ownerDocument.createElement("button");
		this.diagnosticsButton.type = "button";
		this.diagnosticsButton.className = "people-atlas-base-diagnostics";
		this.diagnosticsButton.textContent = plugin.t.recovery.diagnosticsTitle;
		this.diagnosticsButton.hidden = true;
		this.root.append(this.diagnosticsButton);
		parent.append(this.root);
		this.initialMyPersonSettingId = plugin.settings.myPersonId.trim();
		const state = plugin.getViewState(this.viewConfigurationKey());
		this.selectedCenterId =
			state.selectedCenterId === undefined && this.readCenterMode(state.centerMode) === "selected-node"
				? state.centerHistory[0]
				: (state.selectedCenterId ?? undefined);
		const navigationCenter = this.readExplicitNavigationCenterId(state);
		const initialMyPerson = navigationCenter ? undefined : plugin.resolveMyPerson();
		this.initialMyPersonFilePath = initialMyPerson?.filePath;
		this.initialMyPersonCenterId = initialMyPerson?.id;
		this.awaitingInitialMyPersonCenter = Boolean(
			!navigationCenter && !this.initialMyPersonCenterId && this.initialMyPersonSettingId,
		);
	}

	override onload(): void {
		this.registerDomEvent(this.diagnosticsButton, "click", () => {
			const diagnostics = this.fullSnapshot?.diagnostics ?? [];
			const sources = new Set([
				...this.diagnosticEntryPaths,
				...diagnostics.flatMap((diagnostic) => diagnostic.filePaths),
			]);
			this.plugin.openDiagnostics(diagnostics, sources);
		});
		this.activePath = this.app.workspace.getActiveFile()?.path;
		this.renderer = new AtlasRenderer(
			this.root,
			() => ({
				...this.plugin.settings,
				showLabels: this.readBoolean(BASES_OPTION_KEYS.showLabels, this.plugin.settings.showLabels),
			}),
			{
				onOpenNode: (node) => this.openNode(node),
				onCenterNode: (node) => {
					if (isResolvedAtlasPersonNode(node)) {
						this.config.set(BASES_OPTION_KEYS.centerPersonId, node.id);
						this.config.set(BASES_OPTION_KEYS.centerMode, "configured");
						this.selectedPath = node.filePath;
						this.selectedCenterPath = node.filePath;
						this.selectedCenterId = node.personId ?? node.id;
						this.persistViewState(node.personId);
						this.onDataUpdated();
					}
				},
				onSelectNode: (node, source) => this.handleNodeSelection(node, source),
				canEditPerson: (node) => this.canEditPerson(node),
				onEditPerson: (node) => {
					if (this.canEditPerson(node)) this.plugin.openEditPerson(node.filePath);
				},
				canCreateRelationship: (node) => this.canCreateRelationship(node),
				onCreateRelationship: (node) => {
					if (this.canCreateRelationship(node)) this.plugin.openCreateRelationship(node.filePath);
				},
				canLogContact: (node) => this.canLogContact(node),
				onLogContact: (node, relationship) => {
					if (this.canLogContact(node)) this.plugin.openLogContact(node.filePath, relationship?.filePath);
				},
				canOpenContactMoment: (moment) => this.plugin.canOpenContactMomentSummary(moment),
				onOpenContactMoment: async (moment) => {
					await this.plugin.openContactMomentSummary(moment);
				},
				canEditContactMoment: (moment) => this.plugin.canEditContactMomentSummary(moment),
				onEditContactMoment: (moment, invoker) => {
					this.plugin.openEditContactMomentSummary(moment, () =>
						this.renderer?.restoreContactMomentActionFocus(invoker),
					);
				},
				canUpdateFollowUp: (moment) => this.plugin.canUpdateContactMomentFollowUp(moment),
				onUpdateFollowUp: (moment, status) => this.plugin.updateContactMomentFollowUp(moment, status),
				canChangeFollowUp: (moment, action) => this.plugin.canChangeContactMomentFollowUp(moment, action),
				onChangeFollowUp: (moment, action, reviewedDate) =>
					this.plugin.changeContactMomentFollowUp(moment, action, reviewedDate),
				onContactMomentActionUnavailable: () => this.plugin.noticeContactMomentActionUnavailable(),
				canOpenRelationship: (edge) => this.canOpenRelationship(edge),
				onOpenRelationship: (edge) => this.openRelationship(edge),
				canEditRelationship: (edge) => this.canEditRelationship(edge),
				onEditRelationship: (edge, invoker) => this.editRelationship(edge, invoker),
				onLayoutChanged: (layout) => this.persistLayout(layout),
				onBrowseStateChanged: (state) => this.persistBrowseState(state),
				onGraphStateChanged: (state) => {
					this.config.set(BASES_OPTION_KEYS.layoutMode, state.layoutMode);
					this.config.set(BASES_OPTION_KEYS.relationshipDate, state.relationshipDate ?? "");
					void this.plugin.saveViewState(this.viewConfigurationKey(), { ...this.getViewState(), ...state });
					this.onDataUpdated();
				},
				resolvePersonPhoto: (photoPath) => resolvePersonPhotoResource(this.app, photoPath),
			},
			this.plugin.t,
			{ initialState: this.getViewState(), allPeopleLabel: this.plugin.t.discovery.allPeopleInBase },
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.activePath = this.app.workspace.getActiveFile()?.path;
				if (this.readCenterMode() === "active-note") this.updateData();
			}),
		);
		this.unsubscribeIndex = this.plugin.index.subscribe((snapshot, delta) => {
			this.canonicalSnapshot = snapshot;
			this.refreshInitialMyPersonPath(snapshot);
			this.initializeDeferredMyPersonCenter(delta !== undefined);
			this.updateData(delta);
		});
	}

	override onunload(): void {
		void this.persistLayout(undefined, true);
		this.unsubscribeIndex?.();
		this.renderer?.destroy();
		this.root.remove();
	}

	override onDataUpdated(): void {
		this.updateData();
	}

	private handleNodeSelection(node: AtlasNode | undefined, source: AtlasSelectionSource): void {
		const previousSelectedPath = this.selectedPath;
		this.selectedPath = node?.filePath;
		if (source === "canvas") {
			this.selectedCenterPath = isResolvedAtlasPersonNode(node) ? node.filePath : undefined;
			this.selectedCenterId = isResolvedAtlasPersonNode(node) ? (node.personId ?? node.id) : undefined;
			if (this.readCenterMode() === "selected-node") this.persistViewState(this.selectedCenterId);
		} else if (source === "graph-update" && previousSelectedPath === this.selectedCenterPath)
			this.selectedCenterPath = undefined;
		if (this.readCenterMode() === "selected-node" && source !== "list") this.onDataUpdated();
	}

	private updateData(delta?: IndexDelta): void {
		if (!this.renderer) return;
		const visible = adaptBasesEntries(this.app, this.data.data, this.readMapping());
		this.mapInitialMyPersonToVisibleCenter(visible);
		const resolutionPeople = [...this.canonicalSnapshot.people, ...visible.people];
		const resolveLink = (target: string, sourcePath: string) =>
			this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path;
		const nextVisiblePaths = new Set(visible.people.map((person) => person.filePath));
		const nextDiagnosticEntryPaths = new Set(
			this.data.data.filter((entry) => entry.file.extension === "md").map((entry) => entry.file.path),
		);
		const visiblePhotoPaths = new Set(
			[
				...visible.people.map((person) => person.photoPath),
				...(this.fullSnapshot?.nodes.map((node) => node.photoPath) ?? []),
			]
				.filter((path): path is string => Boolean(path))
				.map(normalizePathIdentity),
		);
		const mappedPhotoAssetMayHaveChanged = Boolean(
			delta?.changedPaths.some((path) => visiblePhotoPaths.has(normalizePathIdentity(path))),
		);
		const visiblePersonDataMayHaveChanged = Boolean(
			delta &&
				(mappedPhotoAssetMayHaveChanged ||
					delta.changedPaths.some(
						(path) => nextDiagnosticEntryPaths.has(path) || this.diagnosticEntryPaths.has(path),
					) ||
					delta.removedPaths.some((path) => this.diagnosticEntryPaths.has(path)) ||
					delta.affectedPeople.some((person) => nextDiagnosticEntryPaths.has(person.filePath))),
		);
		const canApplyDelta = Boolean(
			delta &&
				this.fullSnapshot &&
				setsEqual(this.visiblePaths, nextVisiblePaths) &&
				setsEqual(this.diagnosticEntryPaths, nextDiagnosticEntryPaths) &&
				!visiblePersonDataMayHaveChanged,
		);
		const built = canApplyDelta
			? applyGraphDelta(this.fullSnapshot as AtlasSnapshot, delta as IndexDelta, resolveLink, {
					resolutionPeople: this.canonicalSnapshot.people,
					graphResolutionPeople: resolutionPeople,
					visiblePaths: nextVisiblePaths,
					relationships: this.canonicalSnapshot.relationships,
					contactMoments: this.canonicalSnapshot.contactMoments ?? [],
				})
			: buildGraphSnapshot({ visible, canonical: this.canonicalSnapshot }, resolveLink);
		const full = filterPermittedSnapshotDiagnostics(built, nextDiagnosticEntryPaths, {
			people: resolutionPeople,
			relationships: this.canonicalSnapshot.relationships,
			resolveLink,
		});
		this.fullSnapshot = full;
		this.diagnosticsButton.hidden = !this.plugin.settings.showDiagnostics || full.diagnostics.length === 0;
		this.diagnosticsButton.textContent = `${this.plugin.t.recovery.diagnosticsTitle} (${this.plugin.t.formatInteger(full.diagnostics.length)})`;
		this.visiblePaths = nextVisiblePaths;
		this.diagnosticEntryPaths = nextDiagnosticEntryPaths;
		this.activePath = this.app.workspace.getActiveFile()?.path;
		const state = this.getViewState();
		const centerMode = this.readCenterMode(state.centerMode);
		const projectionMode = this.readProjectionMode(state.projectionMode);
		const hops = this.readInteger(BASES_OPTION_KEYS.hops, state.hops, 0);
		const maxNodes = this.readInteger(BASES_OPTION_KEYS.maxNodes, state.maxNodes, 1);
		const layoutMode = this.readLayoutMode(state.layoutMode);
		const relationshipDate = this.readRelationshipDate(state.relationshipDate);
		if (
			state.centerMode !== centerMode ||
			state.projectionMode !== projectionMode ||
			state.hops !== hops ||
			state.maxNodes !== maxNodes ||
			state.layoutMode !== layoutMode ||
			state.relationshipDate !== relationshipDate
		) {
			void this.plugin.saveViewState(this.viewConfigurationKey(), {
				...state,
				centerMode,
				projectionMode,
				hops,
				maxNodes,
				layoutMode,
				relationshipDate,
			});
		}
		const centerId = this.readConfiguredCenterId(state);
		if (this.selectedCenterId) {
			const matches = full.nodes.filter((node) => (node.personId ?? node.id) === this.selectedCenterId);
			this.selectedCenterPath =
				matches.length === 1 && isResolvedAtlasPersonNode(matches[0]) ? matches[0].filePath : undefined;
		}
		const centerPath =
			centerMode === "active-note"
				? this.activePath
				: centerMode === "selected-node"
					? this.selectedCenterPath
					: undefined;
		const permitted = relationshipDate ? filterRelationshipsAtDate(full, relationshipDate) : full;
		const projected = projectGraph(
			permitted,
			{
				centerMode,
				projectionMode,
				centerId:
					centerMode === "configured" ? centerId : centerMode === "selected-node" ? this.selectedCenterId : undefined,
				centerPath: centerMode === "selected-node" ? undefined : centerPath,
				hops,
				maxNodes,
			},
			full.edges,
		);
		const layoutKey = buildLayoutKey(
			this.viewConfigurationKey(),
			{
				...state,
				centerMode,
				projectionMode,
				hops,
				maxNodes,
				layoutMode,
				relationshipDate,
			},
			centerMode === "selected-node" ? this.selectedCenterId : centerId,
			centerMode === "selected-node" ? undefined : centerPath,
		);
		const legacyLayoutKey = buildLayoutKey(
			this.viewConfigurationKey(),
			{ ...state, centerMode, projectionMode, hops, maxNodes, layoutMode, relationshipDate },
			centerId,
			centerPath,
		);
		this.renderer.setGraph(projected, state.layouts[layoutKey] ?? state.layouts[legacyLayoutKey], full, {
			layoutMode,
			relationshipDate,
		});
	}

	private readMapping(): BasesFieldMapping {
		const settings = this.plugin.settings;
		return {
			aliases: `note.${settings.aliasesProperty}` as BasesPropertyId,
			name:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.nameProperty) ??
				(`note.${settings.nameProperty}` as BasesPropertyId),
			id:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.idProperty) ??
				(`note.${settings.personIdProperty}` as BasesPropertyId),
			photo:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.photoProperty) ??
				(`note.${settings.photoProperty}` as BasesPropertyId),
			organisations:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.organisationsProperty) ??
				(`note.${settings.organisationsProperty}` as BasesPropertyId),
			contacts:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.contactsProperty) ??
				(`note.${settings.contactsProperty}` as BasesPropertyId),
			birthDate:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.birthDateProperty) ??
				(`note.${settings.birthDateProperty}` as BasesPropertyId),
			pronouns:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.pronounsProperty) ??
				(`note.${settings.pronounsProperty}` as BasesPropertyId),
			gender:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.genderProperty) ??
				(`note.${settings.genderProperty}` as BasesPropertyId),
			emails:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.emailsProperty) ??
				(`note.${settings.emailsProperty}` as BasesPropertyId),
			phones:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.phonesProperty) ??
				(`note.${settings.phonesProperty}` as BasesPropertyId),
			jobTitle:
				this.config.getAsPropertyId(BASES_OPTION_KEYS.jobTitleProperty) ??
				(`note.${settings.jobTitleProperty}` as BasesPropertyId),
		};
	}

	private readBoolean(key: string, fallback: boolean): boolean {
		const value = this.config.get(key);
		return typeof value === "boolean" ? value : fallback;
	}

	private readCenterMode(fallback: ProjectionCenterMode = "configured"): ProjectionCenterMode {
		const value = this.config.get(BASES_OPTION_KEYS.centerMode);
		return value === "configured" || value === "active-note" || value === "selected-node" || value === "none"
			? value
			: fallback;
	}

	private readProjectionMode(fallback: ProjectionMode = "ego"): ProjectionMode {
		const value = this.config.get(BASES_OPTION_KEYS.projectionMode);
		return value === "ego" || value === "free-network" || value === "contact-health" ? value : fallback;
	}

	private readInteger(key: string, fallback: number, minimum: number): number {
		const value = this.config.get(key);
		const parsed =
			typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
		return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
	}

	private readLayoutMode(fallback: AtlasLayoutMode = "radial"): AtlasLayoutMode {
		const value = this.config.get(BASES_OPTION_KEYS.layoutMode);
		return value === "radial" || value === "family" ? value : fallback;
	}

	private readRelationshipDate(fallback: string | null = null): string | null {
		const value = this.config.get(BASES_OPTION_KEYS.relationshipDate);
		return value === "" ? null : isCalendarDate(value) ? value : fallback;
	}

	private viewConfigurationKey(): string {
		const configured = this.config.get(BASES_OPTION_KEYS.stateKey);
		const name = this.config.name.trim();
		const key = typeof configured === "string" && configured.trim() ? configured.trim() : name;
		return `bases:${key || "default"}`;
	}

	private getViewState(): AtlasViewState {
		return this.plugin.getViewState(this.viewConfigurationKey());
	}

	private readConfiguredCenterId(state: AtlasViewState): string | undefined {
		return this.readExplicitNavigationCenterId(state) ?? this.initialMyPersonCenterId;
	}

	private readExplicitNavigationCenterId(state: AtlasViewState): string | undefined {
		const center = this.config.get(BASES_OPTION_KEYS.centerPersonId);
		return (
			(typeof center === "string" && center.trim() ? center.trim() : undefined) ??
			state.centerHistory[0] ??
			(this.plugin.settings.defaultCenterPersonId || undefined)
		);
	}

	private initializeDeferredMyPersonCenter(indexPublished: boolean): void {
		if (!this.awaitingInitialMyPersonCenter) return;
		const state = this.getViewState();
		const myPerson = this.plugin.resolveMyPerson();
		if (
			myPerson &&
			!this.readExplicitNavigationCenterId(state) &&
			this.plugin.settings.myPersonId.trim() === this.initialMyPersonSettingId
		) {
			this.initialMyPersonFilePath = myPerson.filePath;
			this.initialMyPersonCenterId = myPerson.id;
			this.awaitingInitialMyPersonCenter = false;
			return;
		}
		if (indexPublished) this.awaitingInitialMyPersonCenter = false;
	}

	private mapInitialMyPersonToVisibleCenter(visible: RawIndexSnapshot): void {
		if (!this.initialMyPersonFilePath || this.plugin.settings.myPersonId.trim() !== this.initialMyPersonSettingId) {
			return;
		}
		const myPerson = this.plugin.resolveMyPerson();
		if (!myPerson || myPerson.filePath !== this.initialMyPersonFilePath) return;
		const matches = visible.people.filter((person) => person.filePath === myPerson.filePath);
		if (matches.length === 1) this.initialMyPersonCenterId = matches[0]?.id;
	}

	private refreshInitialMyPersonPath(snapshot: RawIndexSnapshot): void {
		if (!this.initialMyPersonSettingId || this.plugin.settings.myPersonId.trim() !== this.initialMyPersonSettingId) {
			return;
		}
		const matches = snapshot.people.filter((person) => person.id === this.initialMyPersonSettingId);
		this.initialMyPersonFilePath = matches.length === 1 ? matches[0]?.filePath : undefined;
	}

	private persistViewState(centerPersonId?: string): void {
		const key = this.viewConfigurationKey();
		const state = this.getViewState();
		const next = {
			...state,
			centerMode: this.readCenterMode(state.centerMode),
			projectionMode: this.readProjectionMode(state.projectionMode),
			selectedCenterId: this.selectedCenterId ?? null,
			centerHistory: centerPersonId ? rememberCenter(state, centerPersonId).centerHistory : state.centerHistory,
		};
		void this.plugin.saveViewState(key, next);
	}

	private persistBrowseState(state: AtlasBrowseState): void {
		void this.plugin.saveViewState(this.viewConfigurationKey(), { ...this.getViewState(), ...state });
	}

	private async persistLayout(layout?: LayoutSnapshot, flush = false): Promise<void> {
		if (!this.renderer) return;
		const viewConfigurationKey = this.viewConfigurationKey();
		const state = this.getViewState();
		const centerId = this.readConfiguredCenterId(state);
		const centerMode = this.readCenterMode(state.centerMode);
		const projectionMode = this.readProjectionMode(state.projectionMode);
		const hops = this.readInteger(BASES_OPTION_KEYS.hops, state.hops, 0);
		const maxNodes = this.readInteger(BASES_OPTION_KEYS.maxNodes, state.maxNodes, 1);
		const layoutMode = this.readLayoutMode(state.layoutMode);
		const relationshipDate = this.readRelationshipDate(state.relationshipDate);
		const centerPath =
			centerMode === "active-note"
				? this.activePath
				: centerMode === "selected-node"
					? this.selectedCenterPath
					: undefined;
		const key = buildLayoutKey(
			viewConfigurationKey,
			{ ...state, centerMode, projectionMode, hops, maxNodes, layoutMode, relationshipDate },
			centerMode === "selected-node" ? this.selectedCenterId : centerId,
			centerMode === "selected-node" ? undefined : centerPath,
		);
		state.layouts[key] = layout ?? this.renderer.getLayoutSnapshot();
		const pending = this.plugin.saveViewState(viewConfigurationKey, state);
		if (flush) await this.plugin.flushViewState(viewConfigurationKey);
		await pending;
	}

	private openNode(node: AtlasNode): void {
		if (!isResolvedAtlasPersonNode(node)) return;
		const file = this.data.data.find((entry) => entry.file.path === node.filePath)?.file;
		if (file) void this.app.workspace.getLeaf("tab").openFile(file);
	}

	private canCreateRelationship(node: AtlasNode | undefined): node is AtlasNode & { kind: "person"; filePath: string } {
		return Boolean(
			isResolvedAtlasPersonNode(node) &&
				this.plugin.index
					.getSnapshot()
					.people.some((person) => person.id === node.id && person.filePath === node.filePath),
		);
	}

	private canEditPerson(node: AtlasNode | undefined): node is AtlasNode & { kind: "person"; filePath: string } {
		return this.canCreateRelationship(node);
	}

	private canLogContact(node: AtlasNode | undefined): node is AtlasNode & { kind: "person"; filePath: string } {
		return this.canCreateRelationship(node);
	}

	private canOpenRelationship(edge: AtlasEdge): boolean {
		return !edge.inferred && Boolean(edge.filePath && this.plugin.canOpenRelationship(edge.filePath));
	}

	private canEditRelationship(edge: AtlasEdge): boolean {
		return this.canOpenRelationship(edge);
	}

	private async openRelationship(edge: AtlasEdge): Promise<void> {
		if (edge.inferred || !edge.filePath) return;
		await this.plugin.openRelationship(edge.filePath);
	}

	private editRelationship(edge: AtlasEdge, invoker: HTMLButtonElement): void {
		if (edge.inferred || !edge.filePath) return;
		this.plugin.openEditRelationship(edge.filePath, () => this.renderer?.restoreRelationshipActionFocus(invoker));
	}
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
	if (left.size !== right.size) return false;
	for (const value of left) if (!right.has(value)) return false;
	return true;
}
