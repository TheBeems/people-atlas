import { ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_PEOPLE_ATLAS } from "../constants";
import type { AtlasNode, AtlasSnapshot, ProjectionCenterMode, ProjectionMode, RawIndexSnapshot } from "../domain/types";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { buildGraphSnapshot } from "../graph/graph-source";
import { applyGraphDelta } from "../graph/graph-delta";
import { projectGraph } from "../graph/project-graph";
import { buildLayoutKey, rememberCenter, type AtlasViewState } from "../settings/view-state";
import type { LayoutSnapshot } from "../render/layout-state";
import type PeopleAtlasPlugin from "../main";
import { AtlasRenderer, type AtlasSelectionSource } from "../render/atlas-renderer";

export class PeopleAtlasView extends ItemView {
	private renderer: AtlasRenderer | undefined;
	private unsubscribe: (() => void) | undefined;
	private statsEl: HTMLElement | undefined;
	private detailsEl: HTMLElement | undefined;
	private diagnosticsEl: HTMLElement | undefined;
	private rawSnapshot: RawIndexSnapshot = { people: [], relationships: [] };
	private fullSnapshot: AtlasSnapshot | undefined;
	private readonly viewConfigurationKey = "standalone";
	private viewState: AtlasViewState;
	private centerId: string | undefined;
	private centerMode: ProjectionCenterMode;
	private projectionMode: ProjectionMode;
	private selectedPath: string | undefined;
	private selectedCenterPath: string | undefined;
	private activePath: string | undefined;
	private centerModeSelect: HTMLSelectElement | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PeopleAtlasPlugin,
	) {
		super(leaf);
		this.viewState = plugin.getViewState(this.viewConfigurationKey);
		this.centerMode = this.viewState.centerMode;
		this.projectionMode = this.viewState.projectionMode;
		this.centerId = this.viewState.centerHistory[0] ?? (plugin.settings.defaultCenterPersonId || undefined);
	}

	override getViewType(): string {
		return VIEW_TYPE_PEOPLE_ATLAS;
	}

	override getDisplayText(): string {
		return "People Atlas";
	}

	override getIcon(): string {
		return "map";
	}

	override async onOpen(): Promise<void> {
		this.activePath = this.app.workspace.getActiveFile()?.path;
		this.contentEl.replaceChildren();
		this.contentEl.classList.add("people-atlas-view");

		const toolbar = this.contentEl.ownerDocument.createElement("div");
		toolbar.className = "people-atlas-toolbar";
		const title = this.contentEl.ownerDocument.createElement("strong");
		title.textContent = "People Atlas";
		this.statsEl = this.contentEl.ownerDocument.createElement("span");
		this.statsEl.className = "people-atlas-stats";
		const centerMode = this.createSelect(
			"Center",
			[
				["configured", "Configured center"],
				["active-note", "Active note"],
				["selected-node", "Selected node"],
				["none", "No center"],
			],
			this.centerMode,
			(value) => {
				this.centerMode = value as ProjectionCenterMode;
				this.persistViewState();
				this.renderSnapshot();
			},
		);
		this.centerModeSelect = centerMode;
		const projectionMode = this.createSelect(
			"Projection",
			[
				["ego", "Ego network"],
				["free-network", "Free network"],
				["contact-health", "Contact health"],
			],
			this.projectionMode,
			(value) => {
				this.projectionMode = value as ProjectionMode;
				this.persistViewState();
				this.renderSnapshot();
			},
		);
		const fitButton = this.contentEl.ownerDocument.createElement("button");
		fitButton.type = "button";
		fitButton.textContent = "Fit";
		fitButton.addEventListener("click", () => this.renderer?.fitToContent());
		const clearCenterButton = this.contentEl.ownerDocument.createElement("button");
		clearCenterButton.type = "button";
		clearCenterButton.textContent = "All people";
		clearCenterButton.addEventListener("click", () => {
			this.centerMode = "none";
			centerMode.value = "none";
			this.persistViewState();
			this.renderSnapshot();
		});
		toolbar.append(title, centerMode, projectionMode, this.statsEl, fitButton, clearCenterButton);

		const body = this.contentEl.ownerDocument.createElement("div");
		body.className = "people-atlas-body";
		const graph = this.contentEl.ownerDocument.createElement("div");
		graph.className = "people-atlas-graph";
		const sidebar = this.contentEl.ownerDocument.createElement("aside");
		sidebar.className = "people-atlas-sidebar";
		this.detailsEl = this.contentEl.ownerDocument.createElement("section");
		this.diagnosticsEl = this.contentEl.ownerDocument.createElement("section");
		this.diagnosticsEl.className = "people-atlas-diagnostics";
		sidebar.append(this.detailsEl, this.diagnosticsEl);
		body.append(graph, sidebar);
		this.contentEl.append(toolbar, body);

		this.renderer = new AtlasRenderer(graph, () => this.plugin.settings, {
			onOpenNode: (node) => this.openNode(node),
			onCenterNode: (node) => {
				if (!isResolvedAtlasPersonNode(node)) return;
				this.centerMode = "selected-node";
				if (this.centerModeSelect) this.centerModeSelect.value = "selected-node";
				this.selectedPath = node.filePath;
				this.selectedCenterPath = node.filePath;
				this.centerId = node.personId;
				this.persistViewState(node.personId);
				this.renderSnapshot();
			},
			onSelectNode: (node, source) => this.handleNodeSelection(node, source),
			canCreateRelationship: (node) => this.canCreateRelationship(node),
			onCreateRelationship: (node) => {
				if (this.canCreateRelationship(node)) this.plugin.openCreateRelationship(node.filePath);
			},
			onLayoutChanged: (layout) => this.persistLayout(layout),
		});
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.activePath = this.app.workspace.getActiveFile()?.path;
				if (this.centerMode === "active-note") this.renderSnapshot();
			}),
		);

		this.unsubscribe = this.plugin.index.subscribe((snapshot, delta) => {
			this.rawSnapshot = snapshot;
			this.fullSnapshot =
				delta && this.fullSnapshot
					? applyGraphDelta(
							this.fullSnapshot,
							delta,
							(target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
							{ resolutionPeople: snapshot.people },
						)
					: undefined;
			this.renderSnapshot();
		});
	}

	override async onClose(): Promise<void> {
		await this.persistLayout(undefined, true);
		this.unsubscribe?.();
		this.renderer?.destroy();
	}

	onSettingsChanged(): void {
		this.renderSnapshot();
	}

	private handleNodeSelection(node: AtlasNode | undefined, source: AtlasSelectionSource): void {
		const previousSelectedPath = this.selectedPath;
		this.selectedPath = node?.filePath;
		this.renderDetails(node);
		if (source === "canvas") this.selectedCenterPath = isResolvedAtlasPersonNode(node) ? node.filePath : undefined;
		else if (source === "graph-update" && previousSelectedPath === this.selectedCenterPath)
			this.selectedCenterPath = undefined;
		if (this.centerMode === "selected-node" && source !== "list") this.renderSnapshot();
	}

	private renderSnapshot(): void {
		const full =
			this.fullSnapshot ??
			buildGraphSnapshot(
				{ visible: this.rawSnapshot, canonical: this.rawSnapshot },
				(target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
			);
		this.fullSnapshot = full;
		const centerPath =
			this.centerMode === "active-note"
				? this.activePath
				: this.centerMode === "selected-node"
					? this.selectedCenterPath
					: undefined;
		const projected = projectGraph(full, {
			centerMode: this.centerMode,
			projectionMode: this.projectionMode,
			centerId: this.centerMode === "configured" ? this.centerId : undefined,
			centerPath,
			hops: this.viewState.hops,
			maxNodes: this.viewState.maxNodes,
		});
		const layoutKey = buildLayoutKey(this.viewConfigurationKey, this.viewState, this.centerId, centerPath);
		this.renderer?.setGraph(projected, this.viewState.layouts[layoutKey]);
		if (this.statsEl)
			this.statsEl.textContent = `${projected.nodes.length} people · ${projected.edges.length} relationships`;
		this.renderDiagnostics(projected);
	}

	private createSelect(
		label: string,
		options: Array<[string, string]>,
		value: string,
		onChange: (value: string) => void,
	): HTMLSelectElement {
		const select = this.contentEl.ownerDocument.createElement("select");
		select.setAttribute("aria-label", label);
		for (const [optionValue, optionLabel] of options) {
			const option = this.contentEl.ownerDocument.createElement("option");
			option.value = optionValue;
			option.textContent = optionLabel;
			option.selected = optionValue === value;
			select.append(option);
		}
		select.addEventListener("change", () => onChange(select.value));
		return select;
	}

	private persistViewState(centerPersonId?: string): void {
		this.viewState = {
			...this.viewState,
			centerMode: this.centerMode,
			projectionMode: this.projectionMode,
			centerHistory: centerPersonId
				? rememberCenter(this.viewState, centerPersonId).centerHistory
				: this.viewState.centerHistory,
		};
		void this.plugin.saveViewState(this.viewConfigurationKey, this.viewState);
	}

	private async persistLayout(layout?: LayoutSnapshot, flush = false): Promise<void> {
		if (!this.renderer) return;
		const centerPath =
			this.centerMode === "active-note"
				? this.activePath
				: this.centerMode === "selected-node"
					? this.selectedCenterPath
					: undefined;
		const key = buildLayoutKey(this.viewConfigurationKey, this.viewState, this.centerId, centerPath);
		this.viewState.layouts[key] = layout ?? this.renderer.getLayoutSnapshot();
		const pending = this.plugin.saveViewState(this.viewConfigurationKey, this.viewState);
		if (flush) await this.plugin.flushViewState(this.viewConfigurationKey);
		await pending;
	}

	private renderDetails(node: AtlasNode | undefined): void {
		if (!this.detailsEl) return;
		this.detailsEl.replaceChildren();
		const heading = this.detailsEl.ownerDocument.createElement("h3");
		heading.textContent = node?.label ?? "Selection";
		this.detailsEl.append(heading);
		if (!node) {
			const hint = this.detailsEl.ownerDocument.createElement("p");
			hint.textContent = "Select a node. Double-click to center it; Shift-double-click to open its note.";
			this.detailsEl.append(hint);
			return;
		}
		const kind = this.detailsEl.ownerDocument.createElement("p");
		kind.textContent = node.kind === "ghost" ? "Unresolved contact" : (node.filePath ?? "Person");
		this.detailsEl.append(kind);
		if (node.organisations.length > 0) {
			const organisations = this.detailsEl.ownerDocument.createElement("p");
			organisations.textContent = node.organisations.join(" · ");
			this.detailsEl.append(organisations);
		}
		if (this.canCreateRelationship(node)) {
			const createRelationshipButton = this.detailsEl.ownerDocument.createElement("button");
			createRelationshipButton.type = "button";
			createRelationshipButton.textContent = "Create relationship";
			createRelationshipButton.addEventListener("click", () => this.plugin.openCreateRelationship(node.filePath));
			this.detailsEl.append(createRelationshipButton);
		}
	}

	private renderDiagnostics(snapshot: AtlasSnapshot): void {
		if (!this.diagnosticsEl) return;
		this.diagnosticsEl.replaceChildren();
		if (!this.plugin.settings.showDiagnostics || snapshot.diagnostics.length === 0) return;
		const heading = this.diagnosticsEl.ownerDocument.createElement("h3");
		heading.textContent = `Diagnostics (${snapshot.diagnostics.length})`;
		const list = this.diagnosticsEl.ownerDocument.createElement("ul");
		for (const diagnostic of snapshot.diagnostics.slice(0, 20)) {
			const item = this.diagnosticsEl.ownerDocument.createElement("li");
			item.className = `is-${diagnostic.severity}`;
			const message = this.diagnosticsEl.ownerDocument.createElement("span");
			message.textContent = diagnostic.message;
			item.append(message);
			const sourcePath = diagnostic.filePaths.find(
				(path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
			);
			if (sourcePath) {
				const openButton = this.diagnosticsEl.ownerDocument.createElement("button");
				openButton.type = "button";
				openButton.textContent = "Open";
				openButton.addEventListener("click", () => this.openPath(sourcePath));
				item.append(openButton);
			}
			list.append(item);
		}
		this.diagnosticsEl.append(heading, list);
	}

	private openNode(node: AtlasNode): void {
		if (!isResolvedAtlasPersonNode(node)) return;
		this.openPath(node.filePath);
	}

	private canCreateRelationship(node: AtlasNode | undefined): node is AtlasNode & { kind: "person"; filePath: string } {
		return Boolean(
			isResolvedAtlasPersonNode(node) &&
				this.plugin.index
					.getSnapshot()
					.people.some((person) => person.id === node.id && person.filePath === node.filePath),
		);
	}

	private openPath(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(file);
	}
}
