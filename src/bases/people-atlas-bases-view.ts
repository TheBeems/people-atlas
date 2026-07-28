import { BasesView, type BasesPropertyId, type QueryController } from "obsidian";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS } from "../constants";
import type {
	AtlasNode,
	AtlasSnapshot,
	IndexDelta,
	ProjectionCenterMode,
	ProjectionMode,
	RawIndexSnapshot,
} from "../domain/types";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { buildGraphSnapshot } from "../graph/graph-source";
import { applyGraphDelta } from "../graph/graph-delta";
import { projectGraph } from "../graph/project-graph";
import type PeopleAtlasPlugin from "../main";
import { AtlasRenderer, type AtlasSelectionSource } from "../render/atlas-renderer";
import { adaptBasesEntries, type BasesFieldMapping } from "./entry-adapter";
import { BASES_OPTION_KEYS } from "./options";
import { buildLayoutKey, rememberCenter, type AtlasViewState } from "../settings/view-state";
import type { LayoutSnapshot } from "../render/layout-state";

export class PeopleAtlasBasesView extends BasesView {
	override readonly type = BASES_VIEW_TYPE_PEOPLE_ATLAS;
	private readonly root: HTMLElement;
	private renderer: AtlasRenderer | undefined;
	private unsubscribeIndex: (() => void) | undefined;
	private canonicalSnapshot: RawIndexSnapshot = { people: [], relationships: [], diagnostics: [] };
	private fullSnapshot: AtlasSnapshot | undefined;
	private visiblePaths = new Set<string>();
	private selectedPath: string | undefined;
	private selectedCenterPath: string | undefined;
	private activePath: string | undefined;
	private selectionActionsEl: HTMLElement | undefined;

	constructor(
		controller: QueryController,
		parent: HTMLElement,
		private readonly plugin: PeopleAtlasPlugin,
	) {
		super(controller);
		this.root = parent.ownerDocument.createElement("div");
		this.root.className = "people-atlas-graph people-atlas-bases-view";
		parent.append(this.root);
	}

	override onload(): void {
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
						this.persistViewState(node.personId);
						this.onDataUpdated();
					}
				},
				onSelectNode: (node, source) => this.handleNodeSelection(node, source),
				canCreateRelationship: (node) => this.canCreateRelationship(node),
				onCreateRelationship: (node) => {
					if (this.canCreateRelationship(node)) this.plugin.openCreateRelationship(node.filePath);
				},
				onLayoutChanged: (layout) => this.persistLayout(layout),
			},
		);
		this.selectionActionsEl = this.root.ownerDocument.createElement("div");
		this.selectionActionsEl.className = "people-atlas-selection-actions";
		this.selectionActionsEl.hidden = true;
		this.root.append(this.selectionActionsEl);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.activePath = this.app.workspace.getActiveFile()?.path;
				if (this.readCenterMode() === "active-note") this.updateData();
			}),
		);
		this.unsubscribeIndex = this.plugin.index.subscribe((snapshot, delta) => {
			this.canonicalSnapshot = snapshot;
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
		this.renderSelectionActions(node);
		if (source === "canvas") this.selectedCenterPath = isResolvedAtlasPersonNode(node) ? node.filePath : undefined;
		else if (source === "graph-update" && previousSelectedPath === this.selectedCenterPath)
			this.selectedCenterPath = undefined;
		if (this.readCenterMode() === "selected-node" && source !== "list") this.onDataUpdated();
	}

	private updateData(delta?: IndexDelta): void {
		if (!this.renderer) return;
		const visible = adaptBasesEntries(this.app, this.data.data, this.readMapping());
		const nextVisiblePaths = new Set(visible.people.map((person) => person.filePath));
		const canApplyDelta = Boolean(delta && this.fullSnapshot && setsEqual(this.visiblePaths, nextVisiblePaths));
		const full = canApplyDelta
			? applyGraphDelta(
					this.fullSnapshot as AtlasSnapshot,
					delta as IndexDelta,
					(target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
					{
						resolutionPeople: this.canonicalSnapshot.people,
						visiblePaths: nextVisiblePaths,
					},
				)
			: buildGraphSnapshot(
					{ visible, canonical: this.canonicalSnapshot },
					(target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
				);
		this.fullSnapshot = full;
		this.visiblePaths = nextVisiblePaths;
		this.activePath = this.app.workspace.getActiveFile()?.path;
		const state = this.getViewState();
		const centerMode = this.readCenterMode(state.centerMode);
		const projectionMode = this.readProjectionMode(state.projectionMode);
		const hops = this.readInteger(BASES_OPTION_KEYS.hops, state.hops, 0);
		const maxNodes = this.readInteger(BASES_OPTION_KEYS.maxNodes, state.maxNodes, 1);
		if (
			state.centerMode !== centerMode ||
			state.projectionMode !== projectionMode ||
			state.hops !== hops ||
			state.maxNodes !== maxNodes
		) {
			void this.plugin.saveViewState(this.viewConfigurationKey(), {
				...state,
				centerMode,
				projectionMode,
				hops,
				maxNodes,
			});
		}
		const center = this.config.get(BASES_OPTION_KEYS.centerPersonId);
		const centerId = typeof center === "string" && center ? center : state.centerHistory[0];
		const centerPath =
			centerMode === "active-note"
				? this.activePath
				: centerMode === "selected-node"
					? this.selectedCenterPath
					: undefined;
		const projected = projectGraph(full, {
			centerMode,
			projectionMode,
			centerId: centerMode === "configured" ? centerId : undefined,
			centerPath,
			hops,
			maxNodes,
		});
		const layoutKey = buildLayoutKey(
			this.viewConfigurationKey(),
			{
				...state,
				centerMode,
				projectionMode,
				hops,
				maxNodes,
			},
			centerId,
			centerPath,
		);
		this.renderer.setGraph(projected, state.layouts[layoutKey]);
	}

	private readMapping(): BasesFieldMapping {
		const settings = this.plugin.settings;
		return {
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
		const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
		return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
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

	private persistViewState(centerPersonId?: string): void {
		const key = this.viewConfigurationKey();
		const state = this.getViewState();
		const next = {
			...state,
			centerMode: this.readCenterMode(state.centerMode),
			projectionMode: this.readProjectionMode(state.projectionMode),
			centerHistory: centerPersonId ? rememberCenter(state, centerPersonId).centerHistory : state.centerHistory,
		};
		void this.plugin.saveViewState(key, next);
	}

	private async persistLayout(layout?: LayoutSnapshot, flush = false): Promise<void> {
		if (!this.renderer) return;
		const viewConfigurationKey = this.viewConfigurationKey();
		const state = this.getViewState();
		const center = this.config.get(BASES_OPTION_KEYS.centerPersonId);
		const centerId = typeof center === "string" && center ? center : state.centerHistory[0];
		const centerMode = this.readCenterMode(state.centerMode);
		const projectionMode = this.readProjectionMode(state.projectionMode);
		const hops = this.readInteger(BASES_OPTION_KEYS.hops, state.hops, 0);
		const maxNodes = this.readInteger(BASES_OPTION_KEYS.maxNodes, state.maxNodes, 1);
		const centerPath =
			centerMode === "active-note"
				? this.activePath
				: centerMode === "selected-node"
					? this.selectedCenterPath
					: undefined;
		const key = buildLayoutKey(
			viewConfigurationKey,
			{ ...state, centerMode, projectionMode, hops, maxNodes },
			centerId,
			centerPath,
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

	private renderSelectionActions(node: AtlasNode | undefined): void {
		if (!this.selectionActionsEl) return;
		this.selectionActionsEl.replaceChildren();
		if (!this.canCreateRelationship(node)) {
			this.selectionActionsEl.hidden = true;
			return;
		}
		const button = this.selectionActionsEl.ownerDocument.createElement("button");
		button.type = "button";
		button.textContent = `Create relationship with ${node.label}`;
		button.addEventListener("click", () => this.plugin.openCreateRelationship(node.filePath));
		this.selectionActionsEl.append(button);
		this.selectionActionsEl.hidden = false;
	}
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
	if (left.size !== right.size) return false;
	for (const value of left) if (!right.has(value)) return false;
	return true;
}
