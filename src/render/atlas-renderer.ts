import type { AtlasEdge, AtlasNode, AtlasSnapshot, NodeId } from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { PeopleAtlasSettings } from "../settings/types";
import { Camera } from "./camera";
import { createDeterministicLayout, type LayoutPoint } from "./layout";
import { captureLayoutSnapshot, restoreLayoutSnapshot, type LayoutSnapshot } from "./layout-state";
import { TouchGestureController, type TouchGestureUpdate } from "./touch-gesture";

export interface AtlasRendererCallbacks {
	onOpenNode(node: AtlasNode): void;
	onCenterNode(node: AtlasNode): void;
	onSelectNode(node: AtlasNode | undefined, source: AtlasSelectionSource): void;
	canCreateRelationship?(node: AtlasNode): boolean;
	onCreateRelationship?(node: AtlasNode): void;
	onLayoutChanged?(layout: LayoutSnapshot): void;
}

export type AtlasSelectionSource = "canvas" | "list" | "graph-update";

interface DragState {
	pointerId: number;
	mode: "pan" | "node";
	nodeId?: NodeId | undefined;
	lastX: number;
	lastY: number;
}

type RendererMode = "graph" | "list";
type SelectedAction = "open" | "center";
type SheetAction = "close" | "open" | "center" | "create";
type SheetInvoker = "details" | "canvas";

const PERSON_RADIUS = 24;
const GHOST_RADIUS = 17;
const LONG_PRESS_DELAY = 500;

export class AtlasRenderer {
	private readonly win: Window & typeof globalThis;
	private readonly doc: Document;
	private readonly root: HTMLDivElement;
	private readonly modeControls: HTMLFieldSetElement;
	private readonly graphModeButton: HTMLButtonElement;
	private readonly listModeButton: HTMLButtonElement;
	private readonly graphSurface: HTMLDivElement;
	private readonly graphActions: HTMLDivElement;
	private readonly zoomOutButton: HTMLButtonElement;
	private readonly zoomInButton: HTMLButtonElement;
	private readonly fitButton: HTMLButtonElement;
	private readonly detailsButton: HTMLButtonElement;
	private readonly canvas: HTMLCanvasElement;
	private readonly context: CanvasRenderingContext2D;
	private readonly semanticPanel: HTMLElement;
	private readonly summary: HTMLParagraphElement;
	private readonly emptyMessage: HTMLParagraphElement;
	private readonly peopleList: HTMLUListElement;
	private readonly details: HTMLElement;
	private readonly sheet: HTMLDialogElement;
	private readonly sheetContent: HTMLDivElement;
	private readonly resizeObserver: ResizeObserver;
	private readonly camera = new Camera();
	private readonly touchGesture = new TouchGestureController(this.camera.minScale, this.camera.maxScale);
	private snapshot: AtlasSnapshot = {
		nodes: [],
		edges: [],
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		generatedAt: 0,
	};
	private positions = new Map<NodeId, LayoutPoint>();
	private selectedId: NodeId | undefined;
	private focusedId: NodeId | undefined;
	private mode: RendererMode = "graph";
	private drag: DragState | undefined;
	private width = 1;
	private height = 1;
	private ratio = 1;
	private frame: number | undefined;
	private cameraInitialized = false;
	private longPressTimer: number | undefined;
	private sheetNodeId: NodeId | undefined;
	private sheetInvoker: SheetInvoker | undefined;
	private suppressMouseUntil = 0;
	private destroyed = false;

	constructor(
		private readonly container: HTMLElement,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly callbacks: AtlasRendererCallbacks,
	) {
		this.doc = container.ownerDocument;
		const owningWindow = this.doc.defaultView as (Window & typeof globalThis) | null;
		if (!owningWindow) throw new Error("AtlasRenderer requires a container with an owning window.");
		this.win = owningWindow;

		this.root = this.doc.createElement("div");
		this.root.className = "people-atlas-renderer";

		this.modeControls = this.doc.createElement("fieldset");
		this.modeControls.className = "people-atlas-view-modes";
		const legend = this.doc.createElement("legend");
		legend.textContent = "View";
		this.graphModeButton = this.createModeButton("Graph", "people-atlas-graph-mode", true);
		this.listModeButton = this.createModeButton("List", "people-atlas-list-mode", false);
		this.modeControls.append(legend, this.graphModeButton, this.listModeButton);

		this.graphSurface = this.doc.createElement("div");
		this.graphSurface.className = "people-atlas-graph-surface";
		this.canvas = this.doc.createElement("canvas");
		this.canvas.className = "people-atlas-canvas";
		this.canvas.tabIndex = 0;
		this.canvas.setAttribute("role", "application");
		this.canvas.setAttribute("aria-label", "Interactive people and relationship atlas");
		this.graphActions = this.doc.createElement("div");
		this.graphActions.className = "people-atlas-graph-actions";
		this.graphActions.setAttribute("aria-label", "Graph controls");
		this.zoomOutButton = this.createActionButton("Zoom out");
		this.zoomInButton = this.createActionButton("Zoom in");
		this.fitButton = this.createActionButton("Fit");
		this.detailsButton = this.createActionButton("Details");
		this.detailsButton.disabled = true;
		this.graphActions.append(this.zoomOutButton, this.zoomInButton, this.fitButton, this.detailsButton);
		this.graphSurface.append(this.canvas, this.graphActions);

		const context = this.canvas.getContext("2d");
		if (!context) throw new Error("Canvas 2D is unavailable.");
		this.context = context;

		this.semanticPanel = this.doc.createElement("section");
		this.semanticPanel.className = "people-atlas-semantic-panel";
		this.semanticPanel.setAttribute("aria-label", "People atlas list view");
		this.semanticPanel.hidden = true;
		this.summary = this.doc.createElement("p");
		this.summary.className = "people-atlas-semantic-summary";
		this.summary.setAttribute("role", "status");
		this.summary.setAttribute("aria-live", "polite");
		this.emptyMessage = this.doc.createElement("p");
		this.emptyMessage.className = "people-atlas-empty-message";
		this.emptyMessage.textContent = "No people in the current atlas";
		this.emptyMessage.hidden = true;
		this.peopleList = this.doc.createElement("ul");
		this.peopleList.className = "people-atlas-people-list";
		this.peopleList.setAttribute("aria-label", "People in the current atlas");
		this.details = this.doc.createElement("section");
		this.details.className = "people-atlas-semantic-details";
		this.details.setAttribute("aria-label", "Selected person details");
		this.semanticPanel.append(this.summary, this.emptyMessage, this.peopleList, this.details);

		this.sheet = this.doc.createElement("dialog");
		this.sheet.className = "people-atlas-details-sheet";
		this.sheet.setAttribute("aria-label", "Selected person details");
		this.sheetContent = this.doc.createElement("div");
		this.sheetContent.className = "people-atlas-details-sheet-content";
		this.sheet.append(this.sheetContent);

		this.root.append(this.modeControls, this.graphSurface, this.semanticPanel, this.sheet);
		this.container.append(this.root);

		this.graphModeButton.addEventListener("click", this.onGraphMode);
		this.listModeButton.addEventListener("click", this.onListMode);
		this.peopleList.addEventListener("click", this.onPeopleListClick);
		this.peopleList.addEventListener("keydown", this.onPeopleListKeyDown);
		this.peopleList.addEventListener("focusin", this.onPeopleListFocusIn);
		this.details.addEventListener("click", this.onDetailsClick);
		this.zoomOutButton.addEventListener("click", this.onZoomOut);
		this.zoomInButton.addEventListener("click", this.onZoomIn);
		this.fitButton.addEventListener("click", this.onFit);
		this.detailsButton.addEventListener("click", this.onShowDetails);
		this.sheet.addEventListener("click", this.onSheetClick);
		this.sheet.addEventListener("cancel", this.onSheetCancel);
		this.sheet.addEventListener("keydown", this.onSheetKeyDown);
		this.canvas.addEventListener("pointerdown", this.onPointerDown);
		this.canvas.addEventListener("pointermove", this.onPointerMove);
		this.canvas.addEventListener("pointerup", this.onPointerUp);
		this.canvas.addEventListener("pointercancel", this.onPointerCancel);
		this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
		this.canvas.addEventListener("dblclick", this.onDoubleClick);
		this.canvas.addEventListener("keydown", this.onCanvasKeyDown);

		this.resizeObserver = new this.win.ResizeObserver(() => this.resize());
		this.resizeObserver.observe(this.graphSurface);
		this.resize();
		this.updateSemanticPanel();
	}

	setGraph(snapshot: AtlasSnapshot, savedLayout?: LayoutSnapshot): void {
		this.cancelTouchInteraction();
		const activeElement = this.doc.activeElement;
		const focusedButton = this.personButtonFrom(activeElement);
		const focusedNodeId = focusedButton?.dataset.nodeId;
		const listHeldFocus = Boolean(focusedButton && this.semanticPanel.contains(focusedButton));
		const focusedAction = this.actionButtonFrom(activeElement)?.dataset.action as SelectedAction | undefined;
		const actionHeldFocus = Boolean(focusedAction && this.details.contains(activeElement));
		const focusedSheetAction = this.sheetActionButtonFrom(activeElement)?.dataset.sheetAction as
			| SheetAction
			| undefined;
		const sheetHeldFocus = Boolean(focusedSheetAction && this.sheet.contains(activeElement));

		this.snapshot = snapshot;
		this.positions = createDeterministicLayout(snapshot);
		if (savedLayout) this.restoreLayoutSnapshot(savedLayout);

		if (this.selectedId && !this.nodeById(this.selectedId)) {
			this.selectedId = undefined;
			this.callbacks.onSelectNode(undefined, "graph-update");
		}

		const focusedStillExists = this.focusedId ? Boolean(this.nodeById(this.focusedId)) : false;
		if (this.selectedId) this.focusedId = this.selectedId;
		else if (!focusedStillExists) this.focusedId = snapshot.nodes[0]?.id;
		this.updateSemanticPanel();
		if (this.sheet.open) {
			if (!this.sheetNodeId || this.sheetNodeId !== this.selectedId || !this.nodeById(this.sheetNodeId)) {
				this.closeSheet(false);
			} else {
				this.renderSheet();
				if (sheetHeldFocus && focusedSheetAction && !this.focusSheetAction(focusedSheetAction)) {
					this.focusSheetAction("close");
				}
			}
		}

		if (listHeldFocus) {
			const targetId = focusedNodeId && this.nodeById(focusedNodeId) ? focusedNodeId : snapshot.nodes[0]?.id;
			if (targetId) this.focusPersonButton(targetId);
			else this.listModeButton.focus();
		} else if (actionHeldFocus && focusedAction) {
			this.focusSelectedAction(focusedAction);
		}
		this.requestDraw();
	}

	fitToContent(): void {
		if (this.positions.size === 0) return;
		const previous = { x: this.camera.x, y: this.camera.y, scale: this.camera.scale };
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const point of this.positions.values()) {
			minX = Math.min(minX, point.x - 50);
			minY = Math.min(minY, point.y - 50);
			maxX = Math.max(maxX, point.x + 50);
			maxY = Math.max(maxY, point.y + 50);
		}
		const graphWidth = Math.max(1, maxX - minX);
		const graphHeight = Math.max(1, maxY - minY);
		this.camera.scale = Math.min(
			2,
			Math.max(0.2, Math.min((this.width - 80) / graphWidth, (this.height - 80) / graphHeight)),
		);
		this.camera.x = this.width / 2 - ((minX + maxX) / 2) * this.camera.scale;
		this.camera.y = this.height / 2 - ((minY + maxY) / 2) * this.camera.scale;
		this.cameraInitialized = true;
		this.persistCameraChange(previous);
		this.requestDraw();
	}

	getLayoutSnapshot(): LayoutSnapshot {
		return captureLayoutSnapshot(this.positions, this.camera);
	}

	restoreLayoutSnapshot(layout: LayoutSnapshot): void {
		const restored = restoreLayoutSnapshot(
			layout,
			this.snapshot.nodes,
			this.positions,
			this.camera,
			this.camera.minScale,
			this.camera.maxScale,
		);
		this.positions = restored.positions;
		this.camera.x = restored.camera.x;
		this.camera.y = restored.camera.y;
		this.camera.scale = restored.camera.scale;
		this.cameraInitialized = true;
		this.requestDraw();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.cancelTouchInteraction();
		this.closeSheet(false);
		this.resizeObserver.disconnect();
		if (this.frame !== undefined) this.win.cancelAnimationFrame(this.frame);
		this.graphModeButton.removeEventListener("click", this.onGraphMode);
		this.listModeButton.removeEventListener("click", this.onListMode);
		this.peopleList.removeEventListener("click", this.onPeopleListClick);
		this.peopleList.removeEventListener("keydown", this.onPeopleListKeyDown);
		this.peopleList.removeEventListener("focusin", this.onPeopleListFocusIn);
		this.details.removeEventListener("click", this.onDetailsClick);
		this.zoomOutButton.removeEventListener("click", this.onZoomOut);
		this.zoomInButton.removeEventListener("click", this.onZoomIn);
		this.fitButton.removeEventListener("click", this.onFit);
		this.detailsButton.removeEventListener("click", this.onShowDetails);
		this.sheet.removeEventListener("click", this.onSheetClick);
		this.sheet.removeEventListener("cancel", this.onSheetCancel);
		this.sheet.removeEventListener("keydown", this.onSheetKeyDown);
		this.canvas.removeEventListener("pointerdown", this.onPointerDown);
		this.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.canvas.removeEventListener("pointerup", this.onPointerUp);
		this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
		this.canvas.removeEventListener("wheel", this.onWheel);
		this.canvas.removeEventListener("dblclick", this.onDoubleClick);
		this.canvas.removeEventListener("keydown", this.onCanvasKeyDown);
		this.root.remove();
	}

	private createModeButton(label: string, className: string, pressed: boolean): HTMLButtonElement {
		const button = this.doc.createElement("button");
		button.type = "button";
		button.className = className;
		button.textContent = label;
		button.setAttribute("aria-pressed", String(pressed));
		return button;
	}

	private createActionButton(label: string): HTMLButtonElement {
		const button = this.doc.createElement("button");
		button.type = "button";
		button.textContent = label;
		button.setAttribute("aria-label", label);
		return button;
	}

	private setMode(mode: RendererMode): void {
		if (this.mode === mode) return;
		this.cancelTouchInteraction();
		if (mode === "list") this.closeSheet(false);
		this.mode = mode;
		const graphActive = mode === "graph";
		this.graphModeButton.setAttribute("aria-pressed", String(graphActive));
		this.listModeButton.setAttribute("aria-pressed", String(!graphActive));
		this.graphSurface.hidden = !graphActive;
		this.semanticPanel.hidden = graphActive;
		this.canvas.hidden = !graphActive;
		this.canvas.tabIndex = graphActive ? 0 : -1;
		if (graphActive) this.resize();
	}

	private resize(): void {
		const rect = this.graphSurface.getBoundingClientRect();
		this.width = Math.max(1, rect.width);
		this.height = Math.max(1, rect.height);
		this.ratio = this.win.devicePixelRatio || 1;
		this.canvas.width = Math.round(this.width * this.ratio);
		this.canvas.height = Math.round(this.height * this.ratio);
		this.canvas.style.width = `${this.width}px`;
		this.canvas.style.height = `${this.height}px`;
		if (!this.cameraInitialized) {
			this.camera.reset(this.width, this.height);
			this.cameraInitialized = true;
		}
		this.requestDraw();
	}

	private requestDraw(): void {
		if (this.destroyed || this.frame !== undefined) return;
		this.frame = this.win.requestAnimationFrame(() => {
			this.frame = undefined;
			this.draw();
		});
	}

	private draw(): void {
		const style = this.win.getComputedStyle(this.container);
		const background = style.getPropertyValue("--background-primary").trim() || "#1e1e1e";
		const foreground = style.getPropertyValue("--text-normal").trim() || "#dddddd";
		const muted = style.getPropertyValue("--text-muted").trim() || "#999999";
		const border = style.getPropertyValue("--background-modifier-border").trim() || "#666666";
		const accent = style.getPropertyValue("--interactive-accent").trim() || "#7b6cd9";
		const secondary = style.getPropertyValue("--background-secondary").trim() || "#2a2a2a";

		const ctx = this.context;
		ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.save();
		ctx.translate(this.camera.x, this.camera.y);
		ctx.scale(this.camera.scale, this.camera.scale);

		ctx.strokeStyle = border;
		ctx.lineWidth = 1.25 / this.camera.scale;
		for (const edge of this.snapshot.edges) {
			const source = this.positions.get(edge.sourceId);
			const target = this.positions.get(edge.targetId);
			if (!source || !target) continue;
			ctx.setLineDash(edge.inferred ? [5, 5] : []);
			ctx.beginPath();
			ctx.moveTo(source.x, source.y);
			ctx.lineTo(target.x, target.y);
			ctx.stroke();
		}
		ctx.setLineDash([]);

		for (const node of this.snapshot.nodes) {
			const point = this.positions.get(node.id);
			if (!point) continue;
			const radius = node.kind === "ghost" ? GHOST_RADIUS : PERSON_RADIUS;
			const selected = node.id === this.selectedId;

			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
			ctx.fillStyle = node.kind === "ghost" ? background : secondary;
			ctx.fill();
			ctx.strokeStyle = selected || node.isCenter ? accent : node.kind === "ghost" ? muted : border;
			ctx.lineWidth = (selected || node.isCenter ? 3 : 2) / this.camera.scale;
			ctx.setLineDash(node.kind === "ghost" ? [4, 4] : []);
			ctx.stroke();
			ctx.setLineDash([]);

			ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
			ctx.font = `${Math.max(10, 13 / this.camera.scale)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(initials(node.label), point.x, point.y);

			if (this.getSettings().showLabels) {
				ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
				ctx.font = `${Math.max(9, 11 / this.camera.scale)}px sans-serif`;
				ctx.textBaseline = "top";
				ctx.fillText(node.label, point.x, point.y + radius + 8 / this.camera.scale);
			}
		}

		ctx.restore();
	}

	private updateSemanticPanel(): void {
		this.detailsButton.disabled = !this.selectedId || !this.nodeById(this.selectedId);
		const summaryText = `${this.snapshot.nodes.length} people · ${this.snapshot.edges.length} relationships`;
		if (this.summary.textContent !== summaryText) this.summary.textContent = summaryText;
		this.emptyMessage.hidden = this.snapshot.nodes.length > 0;
		this.peopleList.hidden = this.snapshot.nodes.length === 0;
		this.peopleList.replaceChildren();

		const rovingId =
			this.selectedId && this.nodeById(this.selectedId)
				? this.selectedId
				: this.focusedId && this.nodeById(this.focusedId)
					? this.focusedId
					: this.snapshot.nodes[0]?.id;
		this.focusedId = rovingId;

		for (const node of this.snapshot.nodes) {
			const item = this.doc.createElement("li");
			const button = this.doc.createElement("button");
			button.type = "button";
			button.className = "people-atlas-person-button";
			button.dataset.nodeId = node.id;
			button.tabIndex = node.id === rovingId ? 0 : -1;
			button.setAttribute("aria-pressed", String(node.id === this.selectedId));
			button.setAttribute("aria-label", personAccessibleName(node));
			const label = this.doc.createElement("span");
			label.textContent = node.label;
			button.append(label);
			const metadata = personMetadata(node);
			if (metadata) {
				const meta = this.doc.createElement("small");
				meta.textContent = metadata;
				button.append(meta);
			}
			item.append(button);
			this.peopleList.append(item);
		}

		this.renderSelectedDetails();
	}

	private renderSelectedDetails(): void {
		this.details.replaceChildren();
		const selected = this.selectedId ? this.nodeById(this.selectedId) : undefined;
		const heading = this.doc.createElement("h3");
		heading.textContent = selected?.label ?? "Selection";
		this.details.append(heading);
		if (!selected) {
			const hint = this.doc.createElement("p");
			hint.textContent = "Select a person to review their visible relationships and actions.";
			this.details.append(hint);
			return;
		}

		if (isAmbiguousAtlasNode(selected)) {
			const unavailable = this.doc.createElement("p");
			unavailable.textContent = "This person record is ambiguous and cannot be opened or centered.";
			this.details.append(unavailable);
		} else if (selected.kind === "ghost") {
			const unavailable = this.doc.createElement("p");
			unavailable.textContent = "No note is available for this unresolved person.";
			this.details.append(unavailable);
		} else if (!selected.filePath) {
			const unavailable = this.doc.createElement("p");
			unavailable.textContent = "No note is available for this person.";
			this.details.append(unavailable);
		}

		const incidentEdges = this.snapshot.edges
			.map((edge) => this.describeIncidentEdge(edge, selected))
			.filter((description): description is string => description !== undefined);
		if (incidentEdges.length === 0) {
			const empty = this.doc.createElement("p");
			empty.textContent = "No visible relationships";
			this.details.append(empty);
		} else {
			const relationships = this.doc.createElement("ul");
			relationships.className = "people-atlas-relationship-list";
			relationships.setAttribute("aria-label", `Visible relationships for ${selected.label}`);
			for (const description of incidentEdges) {
				const item = this.doc.createElement("li");
				item.textContent = description;
				relationships.append(item);
			}
			this.details.append(relationships);
		}

		if (isResolvedAtlasPersonNode(selected)) {
			const actions = this.doc.createElement("div");
			actions.className = "people-atlas-semantic-actions";
			const open = this.doc.createElement("button");
			open.type = "button";
			open.dataset.action = "open";
			open.setAttribute("aria-label", "Open note");
			open.textContent = "Open note";
			const center = this.doc.createElement("button");
			center.type = "button";
			center.dataset.action = "center";
			center.setAttribute("aria-label", "Use as center");
			center.textContent = "Use as center";
			actions.append(open, center);
			this.details.append(actions);
		}
	}

	private describeIncidentEdge(edge: AtlasEdge, selected: AtlasNode): string | undefined {
		const selectedIsSource = edge.sourceId === selected.id;
		const selectedIsTarget = edge.targetId === selected.id;
		if (!selectedIsSource && !selectedIsTarget) return undefined;
		const counterpartId = selectedIsSource ? edge.targetId : edge.sourceId;
		const counterpart = this.nodeById(counterpartId);
		if (!counterpart) return undefined;

		const counterpartLabel = `${counterpart.label}${counterpart.kind === "ghost" ? " (unresolved)" : ""}`;
		const direction =
			edge.direction === "undirected"
				? `Connected to ${counterpartLabel}`
				: selectedIsSource
					? `Outgoing to ${counterpartLabel}`
					: `Incoming from ${counterpartLabel}`;
		const parts = [direction];
		if (edge.types.length > 0) parts.push(`Types: ${edge.types.join(", ")}`);
		if (edge.inferred) parts.push("Contact-link connection");
		else {
			if (edge.status) parts.push(`Status: ${edge.status}`);
			if (edge.since) parts.push(`Since: ${edge.since}`);
			if (edge.lastContact) parts.push(`Last contact: ${edge.lastContact}`);
		}
		return `${parts.join(". ")}.`;
	}

	private selectNode(node: AtlasNode | undefined, source: AtlasSelectionSource): void {
		if (this.sheet.open && node?.id !== this.sheetNodeId) this.closeSheet(false);
		this.selectedId = node?.id;
		if (node) this.focusedId = node.id;
		this.updateSemanticPanel();
		this.callbacks.onSelectNode(node, source);
		this.requestDraw();
	}

	private renderSheet(): void {
		this.sheetContent.replaceChildren();
		const selected = this.sheetNodeId ? this.nodeById(this.sheetNodeId) : undefined;
		if (!selected || selected.id !== this.selectedId) return;

		const header = this.doc.createElement("div");
		header.className = "people-atlas-details-sheet-header";
		const heading = this.doc.createElement("h2");
		heading.textContent = selected.label;
		const close = this.createSheetActionButton("Close", "close");
		header.append(heading, close);
		this.sheetContent.append(header);

		const metadata = personMetadata(selected);
		if (metadata) {
			const description = this.doc.createElement("p");
			description.textContent = metadata;
			this.sheetContent.append(description);
		}

		const unavailable = this.capabilityExplanation(selected);
		if (unavailable) {
			const explanation = this.doc.createElement("p");
			explanation.textContent = unavailable;
			this.sheetContent.append(explanation);
		}

		const incidentEdges = this.snapshot.edges
			.map((edge) => this.describeIncidentEdge(edge, selected))
			.filter((description): description is string => description !== undefined);
		if (incidentEdges.length === 0) {
			const empty = this.doc.createElement("p");
			empty.textContent = "No visible relationships";
			this.sheetContent.append(empty);
		} else {
			const relationships = this.doc.createElement("ul");
			relationships.className = "people-atlas-relationship-list";
			relationships.setAttribute("aria-label", `Visible relationships for ${selected.label}`);
			for (const description of incidentEdges) {
				const item = this.doc.createElement("li");
				item.textContent = description;
				relationships.append(item);
			}
			this.sheetContent.append(relationships);
		}

		if (isResolvedAtlasPersonNode(selected)) {
			const actions = this.doc.createElement("div");
			actions.className = "people-atlas-details-sheet-actions";
			actions.append(
				this.createSheetActionButton("Open note", "open"),
				this.createSheetActionButton("Use as center", "center"),
			);
			if (this.callbacks.onCreateRelationship && this.callbacks.canCreateRelationship?.(selected) === true) {
				actions.append(this.createSheetActionButton("Create relationship", "create"));
			}
			this.sheetContent.append(actions);
		}
	}

	private capabilityExplanation(node: AtlasNode): string | undefined {
		if (isAmbiguousAtlasNode(node)) return "This person record is ambiguous. No actions are available.";
		if (node.kind === "ghost") return "This unresolved person has no available actions.";
		if (!node.filePath) return "This person has no note or available actions.";
		return undefined;
	}

	private createSheetActionButton(label: string, action: SheetAction): HTMLButtonElement {
		const button = this.createActionButton(label);
		button.dataset.sheetAction = action;
		return button;
	}

	private openSheet(invoker: SheetInvoker): void {
		const selected = this.selectedId ? this.nodeById(this.selectedId) : undefined;
		if (!selected || this.mode !== "graph" || !this.sheet.isConnected) return;
		this.sheetNodeId = selected.id;
		this.sheetInvoker = invoker;
		this.renderSheet();
		if (!this.sheet.open) {
			try {
				this.sheet.showModal();
			} catch {
				if (this.sheet.open) {
					try {
						this.sheet.close();
					} catch {
						// The dialog is already unusable; renderer state still rolls back below.
					}
				}
				this.sheetNodeId = undefined;
				this.sheetInvoker = undefined;
				this.sheetContent.replaceChildren();
				return;
			}
		}
		this.focusSheetAction("close");
	}

	private closeSheet(restoreFocus: boolean): void {
		if (!this.sheet.open) {
			this.sheetNodeId = undefined;
			this.sheetInvoker = undefined;
			return;
		}
		const invoker = this.sheetInvoker;
		this.sheet.close();
		this.sheetNodeId = undefined;
		this.sheetInvoker = undefined;
		if (!restoreFocus || this.destroyed) return;
		if (invoker === "details" && !this.detailsButton.disabled && this.detailsButton.isConnected)
			this.detailsButton.focus();
		else if (invoker === "canvas" && this.canvas.isConnected && this.mode === "graph") this.canvas.focus();
	}

	private nodeById(nodeId: NodeId | string): AtlasNode | undefined {
		return this.snapshot.nodes.find((node) => node.id === nodeId);
	}

	private personButtonFrom(target: EventTarget | Element | null): HTMLButtonElement | undefined {
		if (!(target instanceof this.win.Element)) return undefined;
		const button = target.closest<HTMLButtonElement>(".people-atlas-person-button");
		return button ?? undefined;
	}

	private focusPersonButton(nodeId: NodeId): void {
		const button = Array.from(this.peopleList.querySelectorAll<HTMLButtonElement>(".people-atlas-person-button")).find(
			(candidate) => candidate.dataset.nodeId === nodeId,
		);
		button?.focus();
	}

	private actionButtonFrom(target: EventTarget | Element | null): HTMLButtonElement | undefined {
		if (!(target instanceof this.win.Element)) return undefined;
		return target.closest<HTMLButtonElement>("button[data-action]") ?? undefined;
	}

	private sheetActionButtonFrom(target: EventTarget | Element | null): HTMLButtonElement | undefined {
		if (!(target instanceof this.win.Element)) return undefined;
		return target.closest<HTMLButtonElement>("button[data-sheet-action]") ?? undefined;
	}

	private focusSelectedAction(action: SelectedAction): void {
		this.details.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)?.focus();
	}

	private focusSheetAction(action: SheetAction): boolean {
		const button = this.sheet.querySelector<HTMLButtonElement>(`button[data-sheet-action="${action}"]`);
		button?.focus();
		return Boolean(button);
	}

	private nodeAt(screenX: number, screenY: number): AtlasNode | undefined {
		if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return undefined;
		const world = this.camera.toWorld(screenX, screenY);
		for (let index = this.snapshot.nodes.length - 1; index >= 0; index--) {
			const node = this.snapshot.nodes[index];
			if (!node) continue;
			const point = this.positions.get(node.id);
			if (!point) continue;
			const radius = node.kind === "ghost" ? GHOST_RADIUS : PERSON_RADIUS;
			if (Math.hypot(world.x - point.x, world.y - point.y) <= radius + 6) return node;
		}
		return undefined;
	}

	private pointerPosition(event: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } | undefined {
		if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return undefined;
		const rect = this.canvas.getBoundingClientRect();
		const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
		return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : undefined;
	}

	private capturePointer(pointerId: number): void {
		try {
			this.canvas.setPointerCapture(pointerId);
		} catch {
			// Stable pointer tracking does not depend on browser capture succeeding.
		}
	}

	private releasePointer(pointerId: number): void {
		let shouldRelease = true;
		try {
			shouldRelease = this.canvas.hasPointerCapture(pointerId);
		} catch {
			// Attempt release anyway; the browser may have lost only the query state.
		}
		if (!shouldRelease) return;
		try {
			this.canvas.releasePointerCapture(pointerId);
		} catch {
			// Capture can be lost implicitly before renderer cleanup.
		}
	}

	private persistCameraChange(previous: { x: number; y: number; scale: number }): void {
		if (previous.x === this.camera.x && previous.y === this.camera.y && previous.scale === this.camera.scale) return;
		this.callbacks.onLayoutChanged?.(this.getLayoutSnapshot());
	}

	private zoomAtCanvasCenter(factor: number): void {
		const previous = { x: this.camera.x, y: this.camera.y, scale: this.camera.scale };
		this.camera.zoomAt(this.width / 2, this.height / 2, factor);
		this.persistCameraChange(previous);
		this.requestDraw();
	}

	private applyTouchUpdate(update: TouchGestureUpdate): void {
		if (update.cancelLongPress) this.cancelLongPress();
		if (update.camera) {
			this.camera.x = update.camera.x;
			this.camera.y = update.camera.y;
			this.camera.scale = update.camera.scale;
			this.requestDraw();
		}
		if (update.tapTargetId !== undefined) {
			const node = update.tapTargetId === null ? undefined : this.nodeById(update.tapTargetId);
			this.selectNode(node, "canvas");
		}
		if (update.persistLayout) this.callbacks.onLayoutChanged?.(this.getLayoutSnapshot());
	}

	private scheduleLongPress(pointerId: number): void {
		this.cancelLongPress();
		this.longPressTimer = this.win.setTimeout(() => {
			this.longPressTimer = undefined;
			if (this.destroyed || this.mode !== "graph") return;
			const nodeId = this.touchGesture.consumeLongPress(pointerId);
			const node = nodeId ? this.nodeById(nodeId) : undefined;
			if (!node) return;
			this.selectNode(node, "canvas");
			if (!this.destroyed && this.selectedId === node.id && this.nodeById(node.id)) this.openSheet("canvas");
		}, LONG_PRESS_DELAY);
	}

	private cancelLongPress(): void {
		if (this.longPressTimer === undefined) return;
		this.win.clearTimeout(this.longPressTimer);
		this.longPressTimer = undefined;
	}

	private cancelTouchInteraction(): void {
		this.cancelLongPress();
		for (const pointerId of this.touchGesture.cancel()) this.releasePointer(pointerId);
	}

	private readonly onGraphMode = (): void => {
		this.setMode("graph");
	};

	private readonly onListMode = (): void => {
		this.setMode("list");
	};

	private readonly onZoomOut = (): void => {
		this.zoomAtCanvasCenter(0.8);
	};

	private readonly onZoomIn = (): void => {
		this.zoomAtCanvasCenter(1.25);
	};

	private readonly onFit = (): void => {
		this.fitToContent();
	};

	private readonly onShowDetails = (): void => {
		this.openSheet("details");
	};

	private readonly onPeopleListClick = (event: MouseEvent): void => {
		const button = this.personButtonFrom(event.target);
		const node = button?.dataset.nodeId ? this.nodeById(button.dataset.nodeId) : undefined;
		if (node) {
			this.selectNode(node, "list");
			this.focusPersonButton(node.id);
		}
	};

	private readonly onPeopleListFocusIn = (event: FocusEvent): void => {
		const button = this.personButtonFrom(event.target);
		if (button?.dataset.nodeId && this.nodeById(button.dataset.nodeId)) this.focusedId = button.dataset.nodeId;
	};

	private readonly onPeopleListKeyDown = (event: KeyboardEvent): void => {
		const button = this.personButtonFrom(event.target);
		if (!button?.dataset.nodeId) return;
		const currentIndex = this.snapshot.nodes.findIndex((node) => node.id === button.dataset.nodeId);
		if (currentIndex < 0) return;

		let nextIndex: number | undefined;
		if (event.key === "ArrowDown" && currentIndex < this.snapshot.nodes.length - 1) nextIndex = currentIndex + 1;
		else if (event.key === "ArrowUp" && currentIndex > 0) nextIndex = currentIndex - 1;
		else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = this.snapshot.nodes.length - 1;

		if (nextIndex !== undefined) {
			event.preventDefault();
			const node = this.snapshot.nodes[nextIndex];
			if (!node) return;
			this.selectNode(node, "list");
			this.focusPersonButton(node.id);
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const node = this.snapshot.nodes[currentIndex];
			if (isResolvedAtlasPersonNode(node)) this.callbacks.onOpenNode(node);
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			const focusedId = this.snapshot.nodes[currentIndex]?.id;
			this.selectNode(undefined, "list");
			if (focusedId) this.focusPersonButton(focusedId);
		}
	};

	private readonly onDetailsClick = (event: MouseEvent): void => {
		if (!(event.target instanceof this.win.Element)) return;
		const action = this.actionButtonFrom(event.target)?.dataset.action;
		const selected = this.selectedId ? this.nodeById(this.selectedId) : undefined;
		if (!isResolvedAtlasPersonNode(selected)) return;
		if (action === "open") this.callbacks.onOpenNode(selected);
		if (action === "center") this.callbacks.onCenterNode(selected);
	};

	private readonly onSheetClick = (event: MouseEvent): void => {
		const action = this.sheetActionButtonFrom(event.target)?.dataset.sheetAction as SheetAction | undefined;
		if (!action) return;
		if (action === "close") {
			this.closeSheet(true);
			return;
		}
		const selected = this.sheetNodeId ? this.nodeById(this.sheetNodeId) : undefined;
		if (!isResolvedAtlasPersonNode(selected) || selected.id !== this.selectedId) {
			this.closeSheet(true);
			return;
		}
		const canCreate =
			action === "create" &&
			this.callbacks.onCreateRelationship &&
			this.callbacks.canCreateRelationship?.(selected) === true;
		if (action === "create" && !canCreate) {
			this.renderSheet();
			this.focusSheetAction("close");
			return;
		}
		this.closeSheet(false);
		if (action === "open") this.callbacks.onOpenNode(selected);
		else if (action === "center") this.callbacks.onCenterNode(selected);
		else if (canCreate) this.callbacks.onCreateRelationship?.(selected);
	};

	private readonly onSheetCancel = (event: Event): void => {
		event.preventDefault();
		this.closeSheet(true);
	};

	private readonly onSheetKeyDown = (event: KeyboardEvent): void => {
		if (event.key !== "Tab") return;
		const buttons = Array.from(this.sheet.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
		if (buttons.length === 0) return;
		const first = buttons[0];
		const last = buttons.at(-1);
		if (!first || !last) return;
		if (event.shiftKey && this.doc.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && this.doc.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	private readonly onPointerDown = (event: PointerEvent): void => {
		const point = this.pointerPosition(event);
		if (!point) return;
		const node = this.nodeAt(point.x, point.y);
		this.capturePointer(event.pointerId);
		if (event.pointerType === "touch") {
			event.preventDefault();
			this.suppressMouseUntil = this.win.performance.now() + 1000;
			const update = this.touchGesture.begin(
				{
					pointerId: event.pointerId,
					x: point.x,
					y: point.y,
					time: event.timeStamp,
					targetId: node?.id,
				},
				{ x: this.camera.x, y: this.camera.y, scale: this.camera.scale },
			);
			this.applyTouchUpdate(update);
			if (!update.cancelLongPress && node) this.scheduleLongPress(event.pointerId);
			return;
		}
		this.drag = {
			pointerId: event.pointerId,
			mode: node ? "node" : "pan",
			nodeId: node?.id,
			lastX: point.x,
			lastY: point.y,
		};
		if (node) this.selectNode(node, "canvas");
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			event.preventDefault();
			const point = this.pointerPosition(event);
			if (!point) return;
			this.applyTouchUpdate(this.touchGesture.move(event.pointerId, point));
			return;
		}
		if (!this.drag || this.drag.pointerId !== event.pointerId) return;
		const point = this.pointerPosition(event);
		if (!point) return;
		const dx = point.x - this.drag.lastX;
		const dy = point.y - this.drag.lastY;
		if (this.drag.mode === "pan") {
			this.camera.pan(dx, dy);
		} else if (this.drag.nodeId) {
			const position = this.positions.get(this.drag.nodeId);
			if (position) {
				position.x += dx / this.camera.scale;
				position.y += dy / this.camera.scale;
			}
		}
		this.drag.lastX = point.x;
		this.drag.lastY = point.y;
		this.requestDraw();
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			event.preventDefault();
			const point = this.pointerPosition(event);
			if (!point) {
				this.cancelTouchInteraction();
				return;
			}
			const update = this.touchGesture.end(event.pointerId, point, event.timeStamp);
			this.releasePointer(event.pointerId);
			this.applyTouchUpdate(update);
			return;
		}
		if (!this.drag || this.drag.pointerId !== event.pointerId) return;
		this.releasePointer(event.pointerId);
		this.drag = undefined;
		this.callbacks.onLayoutChanged?.(this.getLayoutSnapshot());
	};

	private readonly onPointerCancel = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			this.cancelTouchInteraction();
			return;
		}
		this.onPointerUp(event);
	};

	private readonly onWheel = (event: WheelEvent): void => {
		event.preventDefault();
		const point = this.pointerPosition(event);
		if (!point) return;
		this.camera.zoomAt(point.x, point.y, event.deltaY < 0 ? 1.12 : 0.88);
		this.callbacks.onLayoutChanged?.(this.getLayoutSnapshot());
		this.requestDraw();
	};

	private readonly onDoubleClick = (event: MouseEvent): void => {
		if (this.win.performance.now() < this.suppressMouseUntil) return;
		const point = this.pointerPosition(event);
		if (!point) return;
		const node = this.nodeAt(point.x, point.y);
		if (!node) {
			this.fitToContent();
			return;
		}
		if (!isResolvedAtlasPersonNode(node)) return;
		if (event.shiftKey) this.callbacks.onOpenNode(node);
		else this.callbacks.onCenterNode(node);
	};

	private readonly onCanvasKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") this.selectNode(undefined, "canvas");
		if (event.key === "Enter" && this.selectedId) {
			const node = this.nodeById(this.selectedId);
			if (isResolvedAtlasPersonNode(node)) this.callbacks.onOpenNode(node);
		}
		if (event.key.toLowerCase() === "f") this.fitToContent();
	};
}

function personMetadata(node: AtlasNode): string {
	if (isAmbiguousAtlasNode(node)) return "Ambiguous person";
	if (node.kind === "ghost") return "Unresolved person";
	return node.organisations.join(", ");
}

function personAccessibleName(node: AtlasNode): string {
	if (isAmbiguousAtlasNode(node)) return `${node.label}, ambiguous person`;
	if (node.kind === "ghost") return `${node.label}, unresolved person`;
	return node.organisations.length > 0 ? `${node.label}, ${node.organisations.join(", ")}` : node.label;
}

function initials(label: string): string {
	const words = label.trim().split(/\s+/).filter(Boolean);
	return (
		words
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}
