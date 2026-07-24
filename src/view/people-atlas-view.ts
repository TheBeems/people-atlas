import { ItemView, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_PEOPLE_ATLAS } from "../constants";
import type { AtlasNode, AtlasSnapshot, RawIndexSnapshot } from "../domain/types";
import { buildGraphSnapshot } from "../graph/graph-source";
import { applyGraphDelta } from "../graph/graph-delta";
import { projectGraph } from "../graph/project-graph";
import type PeopleAtlasPlugin from "../main";
import { AtlasRenderer } from "../render/atlas-renderer";

export class PeopleAtlasView extends ItemView {
	private renderer: AtlasRenderer | undefined;
	private unsubscribe: (() => void) | undefined;
	private statsEl: HTMLElement | undefined;
	private detailsEl: HTMLElement | undefined;
	private diagnosticsEl: HTMLElement | undefined;
	private rawSnapshot: RawIndexSnapshot = { people: [], relationships: [] };
	private fullSnapshot: AtlasSnapshot | undefined;
	private centerId: string | undefined;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: PeopleAtlasPlugin) {
		super(leaf);
		this.centerId = plugin.settings.defaultCenterPersonId || undefined;
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
		this.contentEl.replaceChildren();
		this.contentEl.classList.add("people-atlas-view");

		const toolbar = this.contentEl.ownerDocument.createElement("div");
		toolbar.className = "people-atlas-toolbar";
		const title = this.contentEl.ownerDocument.createElement("strong");
		title.textContent = "People Atlas";
		this.statsEl = this.contentEl.ownerDocument.createElement("span");
		this.statsEl.className = "people-atlas-stats";
		const fitButton = this.contentEl.ownerDocument.createElement("button");
		fitButton.type = "button";
		fitButton.textContent = "Fit";
		fitButton.addEventListener("click", () => this.renderer?.fitToContent());
		const clearCenterButton = this.contentEl.ownerDocument.createElement("button");
		clearCenterButton.type = "button";
		clearCenterButton.textContent = "All people";
		clearCenterButton.addEventListener("click", () => {
			this.centerId = undefined;
			this.renderSnapshot();
		});
		toolbar.append(title, this.statsEl, fitButton, clearCenterButton);

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
				if (node.kind !== "person") return;
				this.centerId = node.id;
				this.renderSnapshot();
			},
			onSelectNode: (node) => this.renderDetails(node),
		});

		this.unsubscribe = this.plugin.index.subscribe((snapshot, delta) => {
			this.rawSnapshot = snapshot;
			this.fullSnapshot = delta && this.fullSnapshot
				? applyGraphDelta(this.fullSnapshot, delta, (target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path, { resolutionPeople: snapshot.people })
				: undefined;
			this.renderSnapshot();
		});
	}

	override async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.renderer?.destroy();
	}

	onSettingsChanged(): void {
		this.renderSnapshot();
	}

	private renderSnapshot(): void {
		const full = this.fullSnapshot ?? buildGraphSnapshot(
			{ visible: this.rawSnapshot, canonical: this.rawSnapshot },
			(target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
		);
		this.fullSnapshot = full;
		const projected = projectGraph(full, {
			centerId: this.centerId,
			hops: 2,
			maxNodes: 500,
		});
		this.renderer?.setGraph(projected);
		if (this.statsEl) this.statsEl.textContent = `${projected.nodes.length} people · ${projected.edges.length} relationships`;
		this.renderDiagnostics(projected);
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
		kind.textContent = node.kind === "ghost" ? "Unresolved contact" : node.filePath ?? "Person";
		this.detailsEl.append(kind);
		if (node.organisations.length > 0) {
			const organisations = this.detailsEl.ownerDocument.createElement("p");
			organisations.textContent = node.organisations.join(" · ");
			this.detailsEl.append(organisations);
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
			const sourcePath = diagnostic.filePaths.find((path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile);
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
		if (!node.filePath) {
			new Notice("This unresolved contact does not have a note yet.");
			return;
		}
		this.openPath(node.filePath);
	}

	private openPath(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(file);
	}
}
