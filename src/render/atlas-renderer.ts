import type {
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	ContactMomentFollowUpStatus,
	ContactMomentSummary,
	NodeId,
} from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { personPhotoInitials } from "../domain/person-photo";
import type { PeopleAtlasSettings } from "../settings/types";
import { Camera } from "./camera";
import {
	buildSelectedPersonContactMomentPresentation,
	type ContactMomentFollowUpRow,
	groupContactMomentFollowUps,
} from "./contact-moment-presentation";
import { createDeterministicLayout, type LayoutPoint } from "./layout";
import { captureLayoutSnapshot, restoreLayoutSnapshot, type LayoutSnapshot } from "./layout-state";
import { PERSON_PHOTO_THUMBNAIL_MAX_READY, PersonPhotoThumbnailCache } from "./person-photo-thumbnail-cache";
import { renderPersonProfile, safeLocalPhotoResourceUrl, type PersonPhotoResourceResolver } from "./person-profile";
import {
	buildIncidentRelationshipRows,
	type IncidentRelationshipRow,
	relationshipActionAccessibleName,
} from "./relationship-rows";
import { TouchGestureController, type TouchGestureUpdate } from "./touch-gesture";

export type ContactMomentAction = "open" | "edit" | "done" | "dismiss";

export interface AtlasRendererCallbacks {
	onOpenNode(node: AtlasNode): void;
	onCenterNode(node: AtlasNode): void;
	onSelectNode(node: AtlasNode | undefined, source: AtlasSelectionSource): void;
	canEditPerson?(node: AtlasNode): boolean;
	onEditPerson?(node: AtlasNode): void;
	canCreateRelationship?(node: AtlasNode): boolean;
	onCreateRelationship?(node: AtlasNode): void;
	canLogContact?(node: AtlasNode): boolean;
	onLogContact?(node: AtlasNode): void;
	canOpenContactMoment?(moment: ContactMomentSummary): boolean;
	onOpenContactMoment?(moment: ContactMomentSummary, invoker: HTMLButtonElement): unknown;
	canEditContactMoment?(moment: ContactMomentSummary): boolean;
	onEditContactMoment?(moment: ContactMomentSummary, invoker: HTMLButtonElement): unknown;
	canUpdateFollowUp?(
		moment: ContactMomentSummary,
		status: Extract<ContactMomentFollowUpStatus, "done" | "dismissed">,
	): boolean;
	onUpdateFollowUp?(
		moment: ContactMomentSummary,
		status: Extract<ContactMomentFollowUpStatus, "done" | "dismissed">,
		invoker: HTMLButtonElement,
	): boolean | Promise<boolean>;
	onContactMomentActionUnavailable?(
		moment: ContactMomentSummary,
		action: ContactMomentAction,
		invoker: HTMLButtonElement,
	): void;
	canOpenRelationship?(edge: AtlasEdge): boolean;
	onOpenRelationship?(edge: AtlasEdge, invoker: HTMLButtonElement): void | Promise<void>;
	canEditRelationship?(edge: AtlasEdge): boolean;
	onEditRelationship?(edge: AtlasEdge, invoker: HTMLButtonElement): void | Promise<void>;
	onLayoutChanged?(layout: LayoutSnapshot): void;
	resolvePersonPhoto?: PersonPhotoResourceResolver | undefined;
}

export type AtlasSelectionSource = "canvas" | "list" | "graph-update";

interface DragState {
	pointerId: number;
	mode: "pan" | "node";
	nodeId?: NodeId | undefined;
	lastX: number;
	lastY: number;
}

export type RendererMode = "graph" | "list" | "follow-ups";
type SelectedAction = "open" | "center" | "log-contact";
type SheetAction = "close" | "open" | "center" | "edit" | "create" | "log-contact";
type SheetInvoker = "details" | "canvas";
type RelationshipAction = "open" | "edit";
type ContactMomentSurface = "details" | "sheet" | "follow-ups";
type TerminalFollowUpStatus = Extract<ContactMomentFollowUpStatus, "done" | "dismissed">;

interface RelationshipActionFocus {
	action: RelationshipAction;
	edgeId: string;
	filePath?: string | undefined;
}

interface ContactMomentActionFocus {
	action: ContactMomentAction;
	momentId: string;
	filePath: string;
	surface: ContactMomentSurface;
}

interface CanvasPhotoRequest {
	cacheKey: string;
	resourceUrl: string;
}

export interface AtlasRendererPhotoCacheStats {
	ready: number;
	pending: number;
	failed: number;
	total: number;
	maxReady: number;
	maxPending: number;
	maxFailed: number;
	maxDimension: number;
	retainedPixels: number;
	destroyed: boolean;
	requests: number;
	loadsStarted: number;
	loadsSucceeded: number;
	loadsFailed: number;
	capacityRejections: number;
	readyEvictions: number;
}

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
	private readonly followUpsModeButton: HTMLButtonElement;
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
	private readonly followUpsPanel: HTMLElement;
	private readonly followUpsHeading: HTMLHeadingElement;
	private readonly followUpsSummary: HTMLParagraphElement;
	private readonly followUpsContent: HTMLDivElement;
	private readonly sheet: HTMLDialogElement;
	private readonly sheetContent: HTMLDivElement;
	private readonly resizeObserver: ResizeObserver;
	private readonly photoThumbnailCache: PersonPhotoThumbnailCache;
	private readonly camera = new Camera();
	private readonly touchGesture = new TouchGestureController(this.camera.minScale, this.camera.maxScale);
	private readonly relationshipEdgesByButton = new WeakMap<HTMLButtonElement, AtlasEdge>();
	private readonly contactMomentsByButton = new WeakMap<HTMLButtonElement, ContactMomentSummary>();
	private snapshot: AtlasSnapshot = {
		nodes: [],
		edges: [],
		contactMoments: [],
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount: 0,
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
	private followUpDayTimer: number | undefined;
	private sheetNodeId: NodeId | undefined;
	private sheetInvoker: SheetInvoker | undefined;
	private sheetReturnFocusElement: HTMLElement | undefined;
	private suppressMouseUntil = 0;
	private destroyed = false;
	private expandedContactHistoryPersonId: string | undefined;
	private readonly pendingFollowUpMomentIdentities = new Set<string>();
	private canvasPhotoRequests = new Map<NodeId, CanvasPhotoRequest>();
	private admittedCanvasPhotoKeys = new Set<string>();

	constructor(
		private readonly container: HTMLElement,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly callbacks: AtlasRendererCallbacks,
	) {
		this.doc = container.ownerDocument;
		const owningWindow = this.doc.defaultView as (Window & typeof globalThis) | null;
		if (!owningWindow) throw new Error("AtlasRenderer requires a container with an owning window.");
		this.win = owningWindow;
		this.photoThumbnailCache = new PersonPhotoThumbnailCache({
			window: this.win,
			document: this.doc,
			onStateChange: ({ cacheKey }) => {
				if (
					this.destroyed ||
					!this.admittedCanvasPhotoKeys.has(cacheKey) ||
					![...this.canvasPhotoRequests.values()].some((request) => request.cacheKey === cacheKey)
				) {
					return;
				}
				this.requestDraw();
			},
		});

		this.root = this.doc.createElement("div");
		this.root.className = "people-atlas-renderer";

		this.modeControls = this.doc.createElement("fieldset");
		this.modeControls.className = "people-atlas-view-modes";
		const legend = this.doc.createElement("legend");
		legend.textContent = "View";
		this.graphModeButton = this.createModeButton("Graph", "people-atlas-graph-mode", true);
		this.listModeButton = this.createModeButton("List", "people-atlas-list-mode", false);
		this.followUpsModeButton = this.createModeButton("Follow-ups", "people-atlas-follow-ups-mode", false);
		this.modeControls.append(legend, this.graphModeButton, this.listModeButton, this.followUpsModeButton);

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

		this.followUpsPanel = this.doc.createElement("section");
		this.followUpsPanel.className = "people-atlas-follow-ups-panel";
		this.followUpsPanel.setAttribute("aria-label", "Contact follow-ups");
		this.followUpsPanel.hidden = true;
		this.followUpsHeading = this.doc.createElement("h2");
		this.followUpsHeading.textContent = "Contact follow-ups";
		this.followUpsHeading.tabIndex = -1;
		this.followUpsHeading.dataset.followUpsHeading = "true";
		this.followUpsSummary = this.doc.createElement("p");
		this.followUpsSummary.className = "people-atlas-follow-ups-summary";
		this.followUpsSummary.setAttribute("role", "status");
		this.followUpsSummary.setAttribute("aria-live", "polite");
		this.followUpsContent = this.doc.createElement("div");
		this.followUpsContent.className = "people-atlas-follow-ups-content";
		this.followUpsPanel.append(this.followUpsHeading, this.followUpsSummary, this.followUpsContent);

		this.sheet = this.doc.createElement("dialog");
		this.sheet.className = "people-atlas-details-sheet";
		this.sheet.setAttribute("aria-label", "Selected person details");
		this.sheetContent = this.doc.createElement("div");
		this.sheetContent.className = "people-atlas-details-sheet-content";
		this.sheet.append(this.sheetContent);

		this.root.append(this.modeControls, this.graphSurface, this.semanticPanel, this.followUpsPanel, this.sheet);
		this.container.append(this.root);

		this.graphModeButton.addEventListener("click", this.onGraphMode);
		this.listModeButton.addEventListener("click", this.onListMode);
		this.followUpsModeButton.addEventListener("click", this.onFollowUpsMode);
		this.peopleList.addEventListener("click", this.onPeopleListClick);
		this.peopleList.addEventListener("keydown", this.onPeopleListKeyDown);
		this.peopleList.addEventListener("focusin", this.onPeopleListFocusIn);
		this.details.addEventListener("click", this.onDetailsClick);
		this.followUpsPanel.addEventListener("click", this.onFollowUpsClick);
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
		const focusedRelationshipAction = this.relationshipActionFocusFrom(activeElement);
		const relationshipActionHeldFocus = Boolean(focusedRelationshipAction && this.details.contains(activeElement));
		const focusedSheetAction = this.sheetActionButtonFrom(activeElement)?.dataset.sheetAction as
			| SheetAction
			| undefined;
		const sheetHeldFocus = Boolean(focusedSheetAction && this.sheet.contains(activeElement));
		const focusedSheetRelationshipAction = this.relationshipActionFocusFrom(activeElement);
		const sheetRelationshipActionHeldFocus = Boolean(
			focusedSheetRelationshipAction && this.sheet.contains(activeElement),
		);
		const focusedContactMomentAction = this.contactMomentActionFocusFrom(activeElement);
		const contactMomentActionHeldFocus = Boolean(focusedContactMomentAction);
		const previousFollowUpOrder =
			focusedContactMomentAction?.surface === "follow-ups" ? this.followUpMomentOrder() : [];

		this.snapshot = snapshot;
		this.positions = createDeterministicLayout(snapshot);
		if (savedLayout) this.restoreLayoutSnapshot(savedLayout);

		if (this.selectedId && !this.nodeById(this.selectedId)) {
			this.selectedId = undefined;
			this.expandedContactHistoryPersonId = undefined;
			this.callbacks.onSelectNode(undefined, "graph-update");
		}

		const focusedStillExists = this.focusedId ? Boolean(this.nodeById(this.focusedId)) : false;
		if (this.selectedId) this.focusedId = this.selectedId;
		else if (!focusedStillExists) this.focusedId = snapshot.nodes[0]?.id;
		this.reconcileCanvasPhotoRequests();
		this.updateSemanticPanel();
		if (this.mode === "follow-ups") this.renderFollowUps();
		if (this.sheet.open) {
			if (!this.sheetNodeId || this.sheetNodeId !== this.selectedId || !this.nodeById(this.sheetNodeId)) {
				this.closeSheet(false);
			} else {
				this.renderSheet();
				if (
					sheetRelationshipActionHeldFocus &&
					focusedSheetRelationshipAction &&
					!this.focusRelationshipAction(this.sheet, focusedSheetRelationshipAction)
				) {
					this.focusSelectedDetailsHeading(this.sheet);
				} else if (sheetHeldFocus && focusedSheetAction && !this.focusSheetAction(focusedSheetAction)) {
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
		} else if (relationshipActionHeldFocus && focusedRelationshipAction) {
			if (!this.focusRelationshipAction(this.details, focusedRelationshipAction)) {
				this.focusSelectedDetailsHeading(this.details);
			}
		}
		if (contactMomentActionHeldFocus && focusedContactMomentAction) {
			if (!this.focusContactMomentAction(focusedContactMomentAction)) {
				if (focusedContactMomentAction.surface === "follow-ups") {
					this.focusFollowUpAfterRemoval(previousFollowUpOrder, focusedContactMomentAction.momentId);
				} else if (focusedContactMomentAction.surface === "sheet" && this.sheet.open) {
					this.focusSelectedDetailsHeading(this.sheet);
				} else {
					this.focusSelectedDetailsHeading(this.details);
				}
			}
		}
		this.requestDraw();
	}

	showFollowUps(): void {
		this.setMode("follow-ups");
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

	getPhotoCacheStats(): Readonly<AtlasRendererPhotoCacheStats> {
		const stats = this.photoThumbnailCache.stats();
		return Object.freeze({
			ready: stats.ready,
			pending: stats.pending,
			failed: stats.failures,
			total: stats.ready + stats.pending + stats.failures,
			maxReady: stats.maxReady,
			maxPending: stats.maxPending,
			maxFailed: stats.maxFailures,
			maxDimension: stats.maxDimension,
			retainedPixels: stats.retainedPixels,
			destroyed: stats.destroyed,
			requests: stats.requests,
			loadsStarted: stats.loadsStarted,
			loadsSucceeded: stats.loadsSucceeded,
			loadsFailed: stats.loadsFailed,
			capacityRejections: stats.capacityRejections,
			readyEvictions: stats.readyEvictions,
		});
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

	restoreRelationshipActionFocus(invoker: HTMLButtonElement): void {
		if (this.destroyed) return;
		if (invoker.ownerDocument === this.doc && invoker.isConnected && this.root.contains(invoker)) {
			invoker.focus();
			if (this.doc.activeElement === invoker) return;
		}
		if (this.sheet.open && this.focusSelectedDetailsHeading(this.sheet)) return;
		if (this.focusSelectedDetailsHeading(this.details)) return;
		if (!this.detailsButton.disabled && this.detailsButton.isConnected) this.detailsButton.focus();
	}

	restoreContactMomentActionFocus(invoker: HTMLButtonElement): void {
		if (this.destroyed || invoker.ownerDocument !== this.doc) return;
		if (invoker.isConnected && this.root.contains(invoker)) {
			invoker.focus();
			if (this.doc.activeElement === invoker) return;
		}
		const focus = this.contactMomentActionFocusFrom(invoker);
		if (focus && this.focusContactMomentAction(focus)) return;
		if (focus?.surface === "follow-ups") {
			const row = this.contactMomentRow(focus.momentId, focus.filePath);
			if (row) {
				row.focus();
				if (this.doc.activeElement === row) return;
			}
			this.followUpsHeading.focus();
			return;
		}
		if (focus?.surface === "sheet" && this.sheet.open && this.focusSelectedDetailsHeading(this.sheet)) return;
		if (this.focusSelectedDetailsHeading(this.details)) return;
		if (!this.detailsButton.disabled && this.detailsButton.isConnected) this.detailsButton.focus();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.cancelTouchInteraction();
		this.cancelFollowUpDayRefresh();
		this.closeSheet(false);
		this.resizeObserver.disconnect();
		if (this.frame !== undefined) this.win.cancelAnimationFrame(this.frame);
		this.photoThumbnailCache.destroy();
		this.canvasPhotoRequests.clear();
		this.admittedCanvasPhotoKeys.clear();
		this.graphModeButton.removeEventListener("click", this.onGraphMode);
		this.listModeButton.removeEventListener("click", this.onListMode);
		this.followUpsModeButton.removeEventListener("click", this.onFollowUpsMode);
		this.peopleList.removeEventListener("click", this.onPeopleListClick);
		this.peopleList.removeEventListener("keydown", this.onPeopleListKeyDown);
		this.peopleList.removeEventListener("focusin", this.onPeopleListFocusIn);
		this.details.removeEventListener("click", this.onDetailsClick);
		this.followUpsPanel.removeEventListener("click", this.onFollowUpsClick);
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
		if (this.destroyed) return;
		if (this.mode === mode) {
			if (mode === "follow-ups") {
				this.renderFollowUps();
				this.scheduleFollowUpDayRefresh();
			}
			return;
		}
		this.cancelTouchInteraction();
		if (mode !== "graph") this.closeSheet(false);
		this.cancelFollowUpDayRefresh();
		this.mode = mode;
		const graphActive = mode === "graph";
		const listActive = mode === "list";
		const followUpsActive = mode === "follow-ups";
		this.graphModeButton.setAttribute("aria-pressed", String(graphActive));
		this.listModeButton.setAttribute("aria-pressed", String(listActive));
		this.followUpsModeButton.setAttribute("aria-pressed", String(followUpsActive));
		this.graphSurface.hidden = !graphActive;
		this.semanticPanel.hidden = !listActive;
		this.followUpsPanel.hidden = !followUpsActive;
		this.canvas.hidden = !graphActive;
		this.canvas.tabIndex = graphActive ? 0 : -1;
		if (graphActive) this.resize();
		if (followUpsActive) {
			this.renderFollowUps();
			this.scheduleFollowUpDayRefresh();
		}
	}

	private resize(): void {
		const rect = this.graphSurface.getBoundingClientRect();
		this.width = Math.max(1, rect.width);
		this.height = Math.max(1, rect.height);
		this.ratio = this.win.devicePixelRatio || 1;
		this.canvas.width = Math.round(this.width * this.ratio);
		this.canvas.height = Math.round(this.height * this.ratio);
		// Keep the CSS-pixel surface and high-DPI backing store synchronized, including at fractional DPR.
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
		const background = style.getPropertyValue("--background-primary").trim() || "Canvas";
		const foreground = style.getPropertyValue("--text-normal").trim() || "CanvasText";
		const muted = style.getPropertyValue("--text-muted").trim() || "GrayText";
		const border = style.getPropertyValue("--background-modifier-border").trim() || "GrayText";
		const accent = style.getPropertyValue("--interactive-accent").trim() || "Highlight";
		const secondary = style.getPropertyValue("--background-secondary").trim() || "Canvas";

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

			let photoDrawn = false;
			const photoRequest = this.canvasPhotoRequests.get(node.id);
			if (photoRequest && this.admittedCanvasPhotoKeys.has(photoRequest.cacheKey)) {
				const state = this.photoThumbnailCache.get(photoRequest);
				if (state.status === "ready") {
					ctx.save();
					try {
						ctx.beginPath();
						ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
						ctx.clip();
						ctx.drawImage(state.thumbnail.source, point.x - radius, point.y - radius, radius * 2, radius * 2);
						photoDrawn = true;
					} catch {
						// A released or browser-rejected source remains a deterministic initials fallback.
					} finally {
						ctx.restore();
					}
				}
			}

			ctx.strokeStyle = selected || node.isCenter ? accent : node.kind === "ghost" ? muted : border;
			ctx.lineWidth = (selected || node.isCenter ? 3 : 2) / this.camera.scale;
			ctx.setLineDash(node.kind === "ghost" ? [4, 4] : []);
			ctx.stroke();
			ctx.setLineDash([]);

			if (!photoDrawn) {
				ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
				ctx.font = `${Math.max(10, 13 / this.camera.scale)}px sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(personPhotoInitials(node.label), point.x, point.y);
			}

			if (this.getSettings().showLabels) {
				ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
				ctx.font = `${Math.max(9, 11 / this.camera.scale)}px sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				ctx.fillText(node.label, point.x, point.y + radius + 8 / this.camera.scale);
			}
		}

		ctx.restore();
	}

	private reconcileCanvasPhotoRequests(): void {
		const previousKeys = new Set([...this.canvasPhotoRequests.values()].map((request) => request.cacheKey));
		const nextRequests = new Map<NodeId, CanvasPhotoRequest>();
		for (const node of this.snapshot.nodes) {
			if (!isResolvedAtlasPersonNode(node) || !node.photoPath || !this.callbacks.resolvePersonPhoto) continue;
			try {
				const resolution = this.callbacks.resolvePersonPhoto(node.photoPath);
				if (resolution.status !== "ready") continue;
				const resourceUrl = safeLocalPhotoResourceUrl(resolution.resourceUrl, node.photoPath);
				if (!resourceUrl || !resolution.cacheKey.trim()) continue;
				nextRequests.set(node.id, {
					cacheKey: resolution.cacheKey,
					resourceUrl,
				});
			} catch {
				// Resolver failures are contained as initials fallback.
			}
		}
		const nextKeys = new Set([...nextRequests.values()].map((request) => request.cacheKey));
		this.photoThumbnailCache.invalidate([...previousKeys].filter((cacheKey) => !nextKeys.has(cacheKey)));
		this.canvasPhotoRequests = nextRequests;
		this.reconcileCanvasPhotoAdmission();
	}

	private reconcileCanvasPhotoAdmission(): void {
		const orderedNodes = [...this.snapshot.nodes].sort((left, right) => {
			const leftSelected = left.id === this.selectedId ? 1 : 0;
			const rightSelected = right.id === this.selectedId ? 1 : 0;
			if (leftSelected !== rightSelected) return rightSelected - leftSelected;
			const leftCenter = left.isCenter ? 1 : 0;
			const rightCenter = right.isCenter ? 1 : 0;
			return rightCenter - leftCenter;
		});
		const nextKeys = new Set<string>();
		for (const node of orderedNodes) {
			const request = this.canvasPhotoRequests.get(node.id);
			if (!request || nextKeys.has(request.cacheKey)) continue;
			nextKeys.add(request.cacheKey);
			if (nextKeys.size >= PERSON_PHOTO_THUMBNAIL_MAX_READY) break;
		}
		this.photoThumbnailCache.invalidate(
			[...this.admittedCanvasPhotoKeys].filter((cacheKey) => !nextKeys.has(cacheKey)),
		);
		this.admittedCanvasPhotoKeys = nextKeys;
	}

	private updateSemanticPanel(): void {
		this.detailsButton.disabled = !this.selectedId || !this.nodeById(this.selectedId);
		const hiddenMomentCount = this.hiddenContactMomentCount();
		const summaryText = `${this.snapshot.nodes.length} people · ${this.snapshot.edges.length} connections${
			hiddenMomentCount > 0
				? ` · ${hiddenMomentCount} contact ${hiddenMomentCount === 1 ? "moment" : "moments"} hidden`
				: ""
		}`;
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
		if (selected) {
			heading.tabIndex = -1;
			heading.dataset.selectedPersonHeading = selected.id;
		}
		this.details.append(heading);
		if (!selected) {
			const hint = this.doc.createElement("p");
			hint.textContent = "Select a person to review their visible relationships and actions.";
			this.details.append(hint);
			return;
		}

		if (isResolvedAtlasPersonNode(selected)) {
			const profile = renderPersonProfile(this.doc, selected, {
				contactHeadingLevel: 4,
				resolvePhotoResource: this.callbacks.resolvePersonPhoto,
			});
			if (profile) this.details.append(profile);
			const contactMoments = this.renderSelectedContactMoments(selected, 4, "details");
			if (contactMoments) this.details.append(contactMoments);
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

		const relationshipRows = buildIncidentRelationshipRows(
			this.snapshot,
			selected,
			this.getSettings().relationshipRoleFormat,
		);
		if (relationshipRows.length === 0) {
			const empty = this.doc.createElement("p");
			empty.textContent = "No visible relationships or linked people";
			this.details.append(empty);
		} else {
			this.details.append(this.renderRelationshipGroups(relationshipRows, selected, 4));
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
			if (this.callbacks.onLogContact && this.callbacks.canLogContact?.(selected) === true) {
				const logContact = this.doc.createElement("button");
				logContact.type = "button";
				logContact.dataset.action = "log-contact";
				logContact.setAttribute("aria-label", "Log contact");
				logContact.textContent = "Log contact";
				actions.append(logContact);
			}
			this.details.append(actions);
		}
	}

	private renderRelationshipGroups(
		rows: IncidentRelationshipRow[],
		selected: AtlasNode,
		headingLevel: 3 | 4,
	): HTMLDivElement {
		const groups = this.doc.createElement("div");
		groups.className = "people-atlas-connection-groups";
		const relationshipRows = rows.filter((row) => !row.edge.inferred);
		const linkedPeopleRows = rows.filter((row) => row.edge.inferred);
		if (relationshipRows.length > 0) {
			groups.append(this.renderRelationshipGroup("Relationships", relationshipRows, selected, headingLevel));
		}
		if (linkedPeopleRows.length > 0) {
			groups.append(this.renderRelationshipGroup("Linked people", linkedPeopleRows, selected, headingLevel));
		}
		return groups;
	}

	private renderRelationshipGroup(
		label: "Relationships" | "Linked people",
		rows: IncidentRelationshipRow[],
		selected: AtlasNode,
		headingLevel: 3 | 4,
	): HTMLElement {
		const group = this.doc.createElement("section");
		group.className = "people-atlas-connection-group";
		group.dataset.connectionGroup = label === "Relationships" ? "relationships" : "linked-people";
		const heading = this.doc.createElement(`h${headingLevel}`);
		heading.textContent = label;
		group.append(heading, this.renderRelationshipRows(rows, selected, label));
		return group;
	}

	private renderRelationshipRows(
		rows: IncidentRelationshipRow[],
		selected: AtlasNode,
		groupLabel: "Relationships" | "Linked people",
	): HTMLUListElement {
		const relationships = this.doc.createElement("ul");
		relationships.className = "people-atlas-relationship-list";
		relationships.setAttribute("aria-label", `${groupLabel} for ${selected.label}`);
		for (const row of rows) {
			const item = this.doc.createElement("li");
			item.dataset.edgeId = row.edge.id;
			if (row.edge.filePath) item.dataset.relationshipPath = row.edge.filePath;
			const description = this.doc.createElement("span");
			description.textContent = row.description;
			item.append(description);

			if (row.noteBacked) {
				const actions = this.doc.createElement("div");
				actions.className = "people-atlas-semantic-actions";
				if (this.callbacks.onOpenRelationship && this.callbacks.canOpenRelationship?.(row.edge) === true) {
					actions.append(this.createRelationshipActionButton("open", row));
				}
				if (this.callbacks.onEditRelationship && this.callbacks.canEditRelationship?.(row.edge) === true) {
					actions.append(this.createRelationshipActionButton("edit", row));
				}
				if (actions.childElementCount > 0) item.append(actions);
			}
			relationships.append(item);
		}
		return relationships;
	}

	private createRelationshipActionButton(action: RelationshipAction, row: IncidentRelationshipRow): HTMLButtonElement {
		const label = action === "open" ? "Open relationship note" : "Edit relationship";
		const button = this.createActionButton(label);
		button.dataset.relationshipAction = action;
		button.dataset.edgeId = row.edge.id;
		if (row.edge.filePath) button.dataset.relationshipPath = row.edge.filePath;
		button.setAttribute("aria-label", relationshipActionAccessibleName(action, row));
		this.relationshipEdgesByButton.set(button, row.edge);
		return button;
	}

	private selectNode(node: AtlasNode | undefined, source: AtlasSelectionSource): void {
		if (this.sheet.open && node?.id !== this.sheetNodeId) this.closeSheet(false);
		const previous = this.selectedId ? this.nodeById(this.selectedId) : undefined;
		if (previous?.personId !== node?.personId) this.expandedContactHistoryPersonId = undefined;
		this.selectedId = node?.id;
		if (node) this.focusedId = node.id;
		this.reconcileCanvasPhotoAdmission();
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
		heading.tabIndex = -1;
		heading.dataset.selectedPersonHeading = selected.id;
		const close = this.createSheetActionButton("Close", "close");
		header.append(heading, close);
		this.sheetContent.append(header);

		if (isResolvedAtlasPersonNode(selected)) {
			const profile = renderPersonProfile(this.doc, selected, {
				contactHeadingLevel: 3,
				resolvePhotoResource: this.callbacks.resolvePersonPhoto,
			});
			if (profile) this.sheetContent.append(profile);
			const contactMoments = this.renderSelectedContactMoments(selected, 3, "sheet");
			if (contactMoments) this.sheetContent.append(contactMoments);
		}

		const unavailable = this.capabilityExplanation(selected);
		if (unavailable) {
			const explanation = this.doc.createElement("p");
			explanation.textContent = unavailable;
			this.sheetContent.append(explanation);
		}

		const relationshipRows = buildIncidentRelationshipRows(
			this.snapshot,
			selected,
			this.getSettings().relationshipRoleFormat,
		);
		if (relationshipRows.length === 0) {
			const empty = this.doc.createElement("p");
			empty.textContent = "No visible relationships or linked people";
			this.sheetContent.append(empty);
		} else {
			this.sheetContent.append(this.renderRelationshipGroups(relationshipRows, selected, 3));
		}

		if (isResolvedAtlasPersonNode(selected)) {
			const actions = this.doc.createElement("div");
			actions.className = "people-atlas-details-sheet-actions";
			actions.append(
				this.createSheetActionButton("Open note", "open"),
				this.createSheetActionButton("Use as center", "center"),
			);
			if (this.callbacks.onEditPerson && this.callbacks.canEditPerson?.(selected) === true) {
				actions.append(this.createSheetActionButton("Edit person", "edit"));
			}
			if (this.callbacks.onCreateRelationship && this.callbacks.canCreateRelationship?.(selected) === true) {
				actions.append(this.createSheetActionButton("Create relationship", "create"));
			}
			if (this.callbacks.onLogContact && this.callbacks.canLogContact?.(selected) === true) {
				actions.append(this.createSheetActionButton("Log contact", "log-contact"));
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

	private renderSelectedContactMoments(
		selected: AtlasNode,
		headingLevel: 3 | 4,
		surface: Extract<ContactMomentSurface, "details" | "sheet">,
	): HTMLElement | undefined {
		if (!selected.personId) return undefined;
		const moments = this.contactMoments();
		const bounded = buildSelectedPersonContactMomentPresentation(moments, selected.personId);
		const all = buildSelectedPersonContactMomentPresentation(moments, selected.personId, moments.length).recentMoments;
		const expanded = this.expandedContactHistoryPersonId === selected.personId;
		const visibleMoments = expanded ? all : bounded.recentMoments;

		const section = this.doc.createElement("section");
		section.className = "people-atlas-contact-moment-history";
		section.dataset.contactMomentPersonId = selected.personId;
		const heading = this.doc.createElement(`h${headingLevel}`);
		heading.textContent = "Contact moments";
		section.append(heading);

		if (bounded.earliestOpenFollowUp) {
			const nextFollowUp = this.doc.createElement("div");
			nextFollowUp.className = "people-atlas-next-follow-up";
			const label = this.doc.createElement("p");
			label.className = "people-atlas-contact-moment-label";
			label.textContent = "Next follow-up";
			nextFollowUp.append(
				label,
				this.renderContactMomentRow(bounded.earliestOpenFollowUp.moment, surface, {
					followUpOn: bounded.earliestOpenFollowUp.followUpOn,
					accessibleContext: "next follow-up",
					accessiblePeers: [bounded.earliestOpenFollowUp.moment],
				}),
			);
			section.append(nextFollowUp);
		}

		const history = this.doc.createElement("div");
		history.className = "people-atlas-contact-moment-recent";
		const label = this.doc.createElement("p");
		label.className = "people-atlas-contact-moment-label";
		label.textContent = expanded ? "All contact moments" : "Recent contact moments";
		history.append(label);
		if (visibleMoments.length === 0) {
			const empty = this.doc.createElement("p");
			empty.textContent = "No contact moments";
			history.append(empty);
		} else {
			const list = this.doc.createElement("ul");
			list.className = "people-atlas-contact-moment-list";
			list.setAttribute("aria-label", `${expanded ? "All" : "Recent"} contact moments for ${selected.label}`);
			for (const moment of visibleMoments) {
				list.append(this.renderContactMomentRow(moment, surface, { accessiblePeers: visibleMoments }));
			}
			history.append(list);
		}
		section.append(history);

		if (all.length > bounded.recentMoments.length) {
			const toggle = this.createActionButton(expanded ? "Show recent contact moments" : "View all contact moments");
			toggle.dataset.contactMomentToggle = selected.personId;
			toggle.setAttribute("aria-expanded", String(expanded));
			const actions = this.doc.createElement("div");
			actions.className = "people-atlas-semantic-actions";
			actions.append(toggle);
			section.append(actions);
		}
		return section;
	}

	private renderFollowUps(): void {
		const groups = groupContactMomentFollowUps(this.contactMoments(), this.localCalendarDay());
		const rows = [...groups.overdue, ...groups.dueToday, ...groups.upcoming];
		const accessiblePeers = rows.map((row) => row.moment);
		const hiddenMomentCount = this.hiddenContactMomentCount();
		this.followUpsSummary.textContent = `${rows.length} open ${rows.length === 1 ? "follow-up" : "follow-ups"}${
			hiddenMomentCount > 0
				? ` · ${hiddenMomentCount} contact ${hiddenMomentCount === 1 ? "moment" : "moments"} hidden`
				: ""
		}`;
		this.followUpsContent.replaceChildren();
		if (rows.length === 0) {
			const empty = this.doc.createElement("p");
			empty.className = "people-atlas-empty-message";
			empty.textContent = "No open follow-ups";
			this.followUpsContent.append(empty);
			return;
		}
		const definitions: ReadonlyArray<{
			label: "Overdue" | "Due today" | "Upcoming";
			key: string;
			rows: ContactMomentFollowUpRow[];
		}> = [
			{ label: "Overdue", key: "overdue", rows: groups.overdue },
			{ label: "Due today", key: "due-today", rows: groups.dueToday },
			{ label: "Upcoming", key: "upcoming", rows: groups.upcoming },
		];
		for (const definition of definitions) {
			if (definition.rows.length === 0) continue;
			const section = this.doc.createElement("section");
			section.className = "people-atlas-follow-up-group";
			section.dataset.followUpGroup = definition.key;
			const heading = this.doc.createElement("h3");
			heading.textContent = definition.label;
			const list = this.doc.createElement("ul");
			list.className = "people-atlas-follow-up-list";
			list.setAttribute("aria-label", definition.label);
			for (const row of definition.rows) {
				list.append(
					this.renderContactMomentRow(row.moment, "follow-ups", {
						followUpOn: row.followUpOn,
						accessiblePeers,
					}),
				);
			}
			section.append(heading, list);
			this.followUpsContent.append(section);
		}
	}

	private renderContactMomentRow(
		moment: ContactMomentSummary,
		surface: ContactMomentSurface,
		options: {
			followUpOn?: string;
			accessibleContext?: string;
			accessiblePeers?: readonly ContactMomentSummary[];
		} = {},
	): HTMLLIElement {
		const item = this.doc.createElement("li");
		item.className = surface === "follow-ups" ? "people-atlas-follow-up-row" : "people-atlas-contact-moment-row";
		item.dataset.contactMomentRow = moment.id;
		item.dataset.contactMomentId = moment.id;
		item.dataset.contactMomentPath = moment.filePath;
		item.tabIndex = -1;
		if (this.pendingFollowUpMomentIdentities.has(this.contactMomentIdentity(moment))) {
			item.setAttribute("aria-busy", "true");
		}

		const content = this.doc.createElement("div");
		content.className = "people-atlas-contact-moment-content";
		if (options.followUpOn) {
			const followUp = this.doc.createElement("p");
			const prefix = this.doc.createElement("span");
			prefix.textContent = "Follow up ";
			const date = this.doc.createElement("time");
			date.dateTime = options.followUpOn;
			date.textContent = options.followUpOn;
			followUp.append(prefix, date);
			content.append(followUp);
		}
		if (surface === "follow-ups") {
			const people = this.doc.createElement("p");
			people.textContent = this.contactMomentPeopleLabel(moment);
			content.append(people);
		}
		const occurred = this.doc.createElement("p");
		const occurredPrefix = this.doc.createElement("span");
		occurredPrefix.textContent = "Contact ";
		const occurredDate = this.doc.createElement("time");
		occurredDate.dateTime = moment.occurredOn;
		occurredDate.textContent = moment.occurredOn;
		occurred.append(occurredPrefix, occurredDate);
		content.append(occurred);
		if (moment.channel) {
			const channel = this.doc.createElement("p");
			channel.textContent = `Channel: ${moment.channel}`;
			content.append(channel);
		}
		if (moment.summary) {
			const summary = this.doc.createElement("p");
			summary.textContent = moment.summary;
			content.append(summary);
		}
		const relationship = this.contactMomentRelationshipLabel(moment);
		if (relationship) {
			const relationshipText = this.doc.createElement("p");
			relationshipText.textContent = relationship;
			content.append(relationshipText);
		}
		item.append(content);

		const actions = this.doc.createElement("div");
		actions.className = "people-atlas-semantic-actions people-atlas-contact-moment-actions";
		const accessiblePeers = options.accessiblePeers ?? [moment];
		const open = this.createContactMomentActionButton(
			"open",
			moment,
			surface,
			options.followUpOn,
			accessiblePeers,
			options.accessibleContext,
		);
		if (open) actions.append(open);
		const edit = this.createContactMomentActionButton(
			"edit",
			moment,
			surface,
			options.followUpOn,
			accessiblePeers,
			options.accessibleContext,
		);
		if (edit) actions.append(edit);
		if (surface === "follow-ups" && options.followUpOn) {
			const done = this.createContactMomentActionButton(
				"done",
				moment,
				surface,
				options.followUpOn,
				accessiblePeers,
				options.accessibleContext,
			);
			if (done) actions.append(done);
			const dismiss = this.createContactMomentActionButton(
				"dismiss",
				moment,
				surface,
				options.followUpOn,
				accessiblePeers,
				options.accessibleContext,
			);
			if (dismiss) actions.append(dismiss);
		}
		if (actions.childElementCount > 0) item.append(actions);
		return item;
	}

	private createContactMomentActionButton(
		action: ContactMomentAction,
		moment: ContactMomentSummary,
		surface: ContactMomentSurface,
		followUpOn?: string,
		accessiblePeers: readonly ContactMomentSummary[] = [moment],
		accessibleContext?: string,
	): HTMLButtonElement | undefined {
		if (!this.canUseContactMomentAction(action, moment)) return undefined;
		const people = this.contactMomentPeopleLabel(moment);
		const actionLabels: Record<ContactMomentAction, string> = {
			open: "Open contact moment",
			edit: "Edit contact moment",
			done: "Mark follow-up done",
			dismiss: "Dismiss follow-up",
		};
		const button = this.createActionButton(actionLabels[action]);
		button.dataset.contactMomentAction = action;
		button.dataset.contactMomentId = moment.id;
		button.dataset.contactMomentPath = moment.filePath;
		button.dataset.contactMomentSurface = surface;
		const dateContext =
			action === "done" || action === "dismiss"
				? `due ${followUpOn ?? moment.followUpOn ?? "unknown date"}`
				: moment.occurredOn;
		const discriminator = this.contactMomentActionDiscriminator(moment, action, accessiblePeers);
		const accessibleName = [
			`${actionLabels[action]} for ${people}, ${dateContext}`,
			discriminator.visible,
			discriminator.ordinal,
			accessibleContext,
		]
			.filter((part): part is string => Boolean(part))
			.join(", ");
		button.setAttribute("aria-label", accessibleName);
		if (
			(action === "done" || action === "dismiss") &&
			this.pendingFollowUpMomentIdentities.has(this.contactMomentIdentity(moment))
		) {
			button.setAttribute("aria-disabled", "true");
		}
		this.contactMomentsByButton.set(button, moment);
		return button;
	}

	private contactMomentActionDiscriminator(
		moment: ContactMomentSummary,
		action: ContactMomentAction,
		peers: readonly ContactMomentSummary[],
	): { visible: string | undefined; ordinal: string | undefined } {
		const visible = this.contactMomentVisibleDiscriminator(moment);
		const collisionKey = this.contactMomentActionCollisionKey(moment, action, visible);
		const collisions = [
			...peers.filter(
				(candidate) =>
					this.contactMomentActionCollisionKey(candidate, action, this.contactMomentVisibleDiscriminator(candidate)) ===
					collisionKey,
			),
		].sort((left, right) => {
			if (left.id !== right.id) return left.id < right.id ? -1 : 1;
			if (left.filePath === right.filePath) return 0;
			return left.filePath < right.filePath ? -1 : 1;
		});
		if (collisions.length < 2) return { visible, ordinal: undefined };
		const index = collisions.findIndex(
			(candidate) => candidate.id === moment.id && candidate.filePath === moment.filePath,
		);
		return {
			visible,
			ordinal: `contact ${Math.max(0, index) + 1} of ${collisions.length}`,
		};
	}

	private contactMomentActionCollisionKey(
		moment: ContactMomentSummary,
		action: ContactMomentAction,
		visible: string | undefined,
	): string {
		const date = action === "done" || action === "dismiss" ? (moment.followUpOn ?? "unknown date") : moment.occurredOn;
		return [this.contactMomentPeopleLabel(moment), date, visible ?? ""].join("\u0000");
	}

	private contactMomentVisibleDiscriminator(moment: ContactMomentSummary): string | undefined {
		for (const candidate of [moment.summary, moment.channel]) {
			const normalized = candidate?.replace(/\s+/g, " ").trim();
			if (normalized) return normalized.length > 80 ? `${normalized.slice(0, 79)}…` : normalized;
		}
		return undefined;
	}

	private contactMomentIdentity(moment: Pick<ContactMomentSummary, "id" | "filePath">): string {
		return `${moment.id}\u0000${moment.filePath}`;
	}

	private canUseContactMomentAction(action: ContactMomentAction, moment: ContactMomentSummary): boolean {
		try {
			if (action === "open")
				return Boolean(this.callbacks.onOpenContactMoment && this.callbacks.canOpenContactMoment?.(moment) === true);
			if (action === "edit")
				return Boolean(this.callbacks.onEditContactMoment && this.callbacks.canEditContactMoment?.(moment) === true);
			const status = this.followUpStatusForAction(action);
			return Boolean(
				status && this.callbacks.onUpdateFollowUp && this.callbacks.canUpdateFollowUp?.(moment, status) === true,
			);
		} catch {
			return false;
		}
	}

	private followUpStatusForAction(action: ContactMomentAction): TerminalFollowUpStatus | undefined {
		if (action === "done") return "done";
		if (action === "dismiss") return "dismissed";
		return undefined;
	}

	private contactMomentPeopleLabel(moment: ContactMomentSummary): string {
		const labels = moment.personIds.map((personId) => {
			const person = this.snapshot.nodes.find(
				(node) =>
					!isAmbiguousAtlasNode(node) &&
					node.kind === "person" &&
					(node.personId === personId || (!node.personId && node.id === personId)),
			);
			return person?.label ?? "Unavailable person";
		});
		return labels.join(", ");
	}

	private contactMomentRelationshipLabel(moment: ContactMomentSummary): string | undefined {
		if (!moment.relationshipId) return undefined;
		const edge = this.snapshot.edges.find((candidate) => candidate.id === moment.relationshipId && !candidate.inferred);
		if (!edge) return undefined;
		const source = this.nodeById(edge.sourceId);
		const target = this.nodeById(edge.targetId);
		if (!source || !target) return undefined;
		const kind = edge.types.length > 0 ? edge.types.join(", ") : "relationship";
		return `Relationship: ${source.label} and ${target.label} · ${kind}`;
	}

	private contactMoments(): readonly ContactMomentSummary[] {
		return this.snapshot.contactMoments;
	}

	private hiddenContactMomentCount(): number {
		return Math.max(0, this.snapshot.hiddenContactMomentCount);
	}

	private openSheet(invoker: SheetInvoker): void {
		const selected = this.selectedId ? this.nodeById(this.selectedId) : undefined;
		if (!selected || this.mode !== "graph" || !this.sheet.isConnected) return;
		this.sheetNodeId = selected.id;
		this.sheetInvoker = invoker;
		this.renderSheet();
		if (!this.sheet.open) {
			const activeElement = this.doc.activeElement;
			this.sheetReturnFocusElement = activeElement instanceof this.win.HTMLElement ? activeElement : undefined;
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
				this.sheetReturnFocusElement = undefined;
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
			this.sheetReturnFocusElement = undefined;
			return;
		}
		const invoker = this.sheetInvoker;
		this.sheet.close();
		this.sheetNodeId = undefined;
		this.sheetInvoker = undefined;
		this.sheetReturnFocusElement = undefined;
		if (!restoreFocus || this.destroyed) return;
		if (invoker === "details" && !this.detailsButton.disabled && this.detailsButton.isConnected)
			this.detailsButton.focus();
		else if (invoker === "canvas" && this.canvas.isConnected && this.mode === "graph") this.canvas.focus();
	}

	private closeSheetForExternalAction(): void {
		const returnFocusElement = this.sheetReturnFocusElement;
		if (!returnFocusElement) {
			this.closeSheet(false);
			return;
		}
		const wasInert = returnFocusElement.inert;
		returnFocusElement.inert = true;
		try {
			this.closeSheet(false);
		} finally {
			returnFocusElement.inert = wasInert;
		}
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

	private relationshipActionButtonFrom(target: EventTarget | Element | null): HTMLButtonElement | undefined {
		if (!(target instanceof this.win.Element)) return undefined;
		return target.closest<HTMLButtonElement>("button[data-relationship-action]") ?? undefined;
	}

	private contactMomentActionButtonFrom(target: EventTarget | Element | null): HTMLButtonElement | undefined {
		if (!(target instanceof this.win.Element)) return undefined;
		return target.closest<HTMLButtonElement>("button[data-contact-moment-action]") ?? undefined;
	}

	private relationshipActionFocusFrom(target: EventTarget | Element | null): RelationshipActionFocus | undefined {
		const button = this.relationshipActionButtonFrom(target);
		const action = button?.dataset.relationshipAction;
		const edgeId = button?.dataset.edgeId;
		if ((action !== "open" && action !== "edit") || !edgeId) return undefined;
		return {
			action,
			edgeId,
			filePath: button.dataset.relationshipPath,
		};
	}

	private contactMomentActionFocusFrom(target: EventTarget | Element | null): ContactMomentActionFocus | undefined {
		const button = this.contactMomentActionButtonFrom(target);
		const action = button?.dataset.contactMomentAction;
		const momentId = button?.dataset.contactMomentId;
		const filePath = button?.dataset.contactMomentPath;
		const surface = button?.dataset.contactMomentSurface;
		if (
			(action !== "open" && action !== "edit" && action !== "done" && action !== "dismiss") ||
			!momentId ||
			!filePath ||
			(surface !== "details" && surface !== "sheet" && surface !== "follow-ups")
		) {
			return undefined;
		}
		return { action, momentId, filePath, surface };
	}

	private focusSelectedAction(action: SelectedAction): void {
		this.details.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)?.focus();
	}

	private focusRelationshipAction(container: ParentNode, focus: RelationshipActionFocus): boolean {
		const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button[data-relationship-action]")).find(
			(candidate) =>
				candidate.dataset.relationshipAction === focus.action &&
				candidate.dataset.edgeId === focus.edgeId &&
				candidate.dataset.relationshipPath === focus.filePath,
		);
		button?.focus();
		return Boolean(button && this.doc.activeElement === button);
	}

	private focusContactMomentAction(focus: ContactMomentActionFocus): boolean {
		const container =
			focus.surface === "follow-ups" ? this.followUpsPanel : focus.surface === "sheet" ? this.sheet : this.details;
		const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button[data-contact-moment-action]")).find(
			(candidate) =>
				candidate.dataset.contactMomentAction === focus.action &&
				candidate.dataset.contactMomentId === focus.momentId &&
				candidate.dataset.contactMomentPath === focus.filePath &&
				candidate.dataset.contactMomentSurface === focus.surface,
		);
		button?.focus();
		return Boolean(button && this.doc.activeElement === button);
	}

	private contactMomentRow(momentId: string, filePath?: string): HTMLLIElement | undefined {
		return Array.from(this.followUpsPanel.querySelectorAll<HTMLLIElement>("[data-contact-moment-row]")).find(
			(candidate) =>
				candidate.dataset.contactMomentId === momentId &&
				(filePath === undefined || candidate.dataset.contactMomentPath === filePath),
		);
	}

	private focusFollowUpAfterRemoval(previousOrder: readonly string[], removedMomentId: string): void {
		const removedIndex = previousOrder.indexOf(removedMomentId);
		const later = removedIndex >= 0 ? previousOrder.slice(removedIndex + 1) : [];
		const earlier = removedIndex > 0 ? previousOrder.slice(0, removedIndex).reverse() : [];
		for (const momentId of [...later, ...earlier]) {
			const row = this.contactMomentRow(momentId);
			if (!row) continue;
			const action = row.querySelector<HTMLButtonElement>("button:not(:disabled)");
			(action ?? row).focus();
			if (this.doc.activeElement === (action ?? row)) return;
		}
		this.followUpsHeading.focus();
	}

	private focusSelectedDetailsHeading(container: ParentNode): boolean {
		const heading = Array.from(container.querySelectorAll<HTMLElement>("[data-selected-person-heading]")).find(
			(candidate) => candidate.dataset.selectedPersonHeading === this.selectedId,
		);
		heading?.focus();
		return Boolean(heading && this.doc.activeElement === heading);
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

	private localCalendarDay(): string {
		const now = new this.win.Date();
		const year = String(now.getFullYear()).padStart(4, "0");
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private followUpMomentOrder(): string[] {
		const groups = groupContactMomentFollowUps(this.contactMoments(), this.localCalendarDay());
		return [...groups.overdue, ...groups.dueToday, ...groups.upcoming].map((row) => row.moment.id);
	}

	private scheduleFollowUpDayRefresh(): void {
		if (this.destroyed || this.mode !== "follow-ups" || this.followUpDayTimer !== undefined) return;
		const now = new this.win.Date();
		const nextDay = new this.win.Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
		const delay = Math.max(1, nextDay.getTime() - now.getTime() + 25);
		this.followUpDayTimer = this.win.setTimeout(() => {
			this.followUpDayTimer = undefined;
			if (this.destroyed || this.mode !== "follow-ups") return;
			this.renderFollowUps();
			this.scheduleFollowUpDayRefresh();
		}, delay);
	}

	private cancelFollowUpDayRefresh(): void {
		if (this.followUpDayTimer === undefined) return;
		this.win.clearTimeout(this.followUpDayTimer);
		this.followUpDayTimer = undefined;
	}

	private readonly onGraphMode = (): void => {
		this.setMode("graph");
	};

	private readonly onListMode = (): void => {
		this.setMode("list");
	};

	private readonly onFollowUpsMode = (): void => {
		this.setMode("follow-ups");
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
		const contactMomentAction = this.contactMomentActionButtonFrom(event.target);
		if (contactMomentAction) {
			void this.invokeContactMomentAction(contactMomentAction);
			return;
		}
		const contactMomentToggle = event.target.closest<HTMLButtonElement>("button[data-contact-moment-toggle]");
		if (contactMomentToggle) {
			this.toggleSelectedContactMomentHistory(contactMomentToggle, "details");
			return;
		}
		const relationshipAction = this.relationshipActionButtonFrom(event.target);
		if (relationshipAction) {
			void this.invokeRelationshipAction(relationshipAction, false);
			return;
		}
		const action = this.actionButtonFrom(event.target)?.dataset.action;
		const selected = this.selectedId ? this.nodeById(this.selectedId) : undefined;
		if (!isResolvedAtlasPersonNode(selected)) return;
		if (action === "open") this.callbacks.onOpenNode(selected);
		if (action === "center") this.callbacks.onCenterNode(selected);
		if (action === "log-contact" && this.callbacks.onLogContact && this.callbacks.canLogContact?.(selected) === true) {
			this.callbacks.onLogContact(selected);
		}
	};

	private readonly onSheetClick = (event: MouseEvent): void => {
		if (!(event.target instanceof this.win.Element)) return;
		const contactMomentAction = this.contactMomentActionButtonFrom(event.target);
		if (contactMomentAction) {
			void this.invokeContactMomentAction(contactMomentAction);
			return;
		}
		const contactMomentToggle = event.target.closest<HTMLButtonElement>("button[data-contact-moment-toggle]");
		if (contactMomentToggle) {
			this.toggleSelectedContactMomentHistory(contactMomentToggle, "sheet");
			return;
		}
		const relationshipAction = this.relationshipActionButtonFrom(event.target);
		if (relationshipAction) {
			void this.invokeRelationshipAction(relationshipAction, true);
			return;
		}
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
		const canEdit =
			action === "edit" && this.callbacks.onEditPerson && this.callbacks.canEditPerson?.(selected) === true;
		const canLogContact =
			action === "log-contact" && this.callbacks.onLogContact && this.callbacks.canLogContact?.(selected) === true;
		if (action === "edit" && !canEdit) {
			this.renderSheet();
			this.focusSheetAction("close");
			return;
		}
		if (action === "create" && !canCreate) {
			this.renderSheet();
			this.focusSheetAction("close");
			return;
		}
		if (action === "log-contact" && !canLogContact) {
			this.renderSheet();
			this.focusSheetAction("close");
			return;
		}
		this.closeSheet(false);
		if (action === "open") this.callbacks.onOpenNode(selected);
		else if (action === "center") this.callbacks.onCenterNode(selected);
		else if (canEdit) this.callbacks.onEditPerson?.(selected);
		else if (canCreate) this.callbacks.onCreateRelationship?.(selected);
		else if (canLogContact) this.callbacks.onLogContact?.(selected);
	};

	private readonly onFollowUpsClick = (event: MouseEvent): void => {
		const button = this.contactMomentActionButtonFrom(event.target);
		if (button) void this.invokeContactMomentAction(button);
	};

	private toggleSelectedContactMomentHistory(
		button: HTMLButtonElement,
		surface: Extract<ContactMomentSurface, "details" | "sheet">,
	): void {
		const personId = button.dataset.contactMomentToggle;
		const selected = this.selectedId ? this.nodeById(this.selectedId) : undefined;
		if (!personId || selected?.personId !== personId) return;
		this.expandedContactHistoryPersonId = this.expandedContactHistoryPersonId === personId ? undefined : personId;
		this.renderSelectedDetails();
		if (this.sheet.open) this.renderSheet();
		const container = surface === "sheet" ? this.sheet : this.details;
		container
			.querySelector<HTMLButtonElement>(`button[data-contact-moment-toggle="${this.win.CSS.escape(personId)}"]`)
			?.focus();
	}

	private async invokeRelationshipAction(button: HTMLButtonElement, closeSheet: boolean): Promise<void> {
		const edge = this.relationshipEdgesByButton.get(button);
		const action = button.dataset.relationshipAction;
		if (!edge || (action !== "open" && action !== "edit")) return;
		if (closeSheet) this.closeSheetForExternalAction();
		if (action === "open") await this.callbacks.onOpenRelationship?.(edge, button);
		else await this.callbacks.onEditRelationship?.(edge, button);
	}

	private async invokeContactMomentAction(button: HTMLButtonElement): Promise<void> {
		const renderedMoment = this.contactMomentsByButton.get(button);
		const focus = this.contactMomentActionFocusFrom(button);
		if (!renderedMoment || !focus) return;
		const moment = this.contactMoments().find(
			(candidate) => candidate.id === renderedMoment.id && candidate.filePath === renderedMoment.filePath,
		);
		if (!moment || !this.canUseContactMomentAction(focus.action, moment)) {
			try {
				this.callbacks.onContactMomentActionUnavailable?.(moment ?? renderedMoment, focus.action, button);
			} catch {
				// The stale action still fails closed and refreshes even if user feedback cannot be shown.
			}
			this.refreshContactMomentSurface(focus.surface);
			this.restoreContactMomentActionFocus(button);
			return;
		}
		if (focus.surface === "sheet") this.closeSheetForExternalAction();
		if (focus.action === "open") {
			await this.callbacks.onOpenContactMoment?.(moment, button);
			return;
		}
		if (focus.action === "edit") {
			await this.callbacks.onEditContactMoment?.(moment, button);
			return;
		}
		const status = this.followUpStatusForAction(focus.action);
		const identity = this.contactMomentIdentity(moment);
		if (!status || this.pendingFollowUpMomentIdentities.has(identity)) return;
		this.pendingFollowUpMomentIdentities.add(identity);
		this.setFollowUpMomentBusy(focus.momentId, focus.filePath, true);
		let accepted = false;
		try {
			accepted = (await this.callbacks.onUpdateFollowUp?.(moment, status, button)) === true;
		} catch {
			accepted = false;
		} finally {
			this.pendingFollowUpMomentIdentities.delete(identity);
			if (!this.destroyed) {
				this.setFollowUpMomentBusy(focus.momentId, focus.filePath, false);
				const activeElement = this.doc.activeElement;
				if (!activeElement || !this.root.contains(activeElement) || activeElement === this.doc.body) {
					this.restoreContactMomentActionFocus(button);
				} else if (!accepted && this.focusContactMomentAction(focus)) {
					// A rejected stale/no-write result keeps focus on its still-current action when available.
				}
			}
		}
	}

	private setFollowUpMomentBusy(momentId: string, filePath: string, busy: boolean): void {
		const row = this.contactMomentRow(momentId, filePath);
		if (!row) return;
		if (busy) row.setAttribute("aria-busy", "true");
		else row.removeAttribute("aria-busy");
		for (const button of Array.from(
			row.querySelectorAll<HTMLButtonElement>(
				'button[data-contact-moment-action="done"], button[data-contact-moment-action="dismiss"]',
			),
		)) {
			if (busy) button.setAttribute("aria-disabled", "true");
			else button.removeAttribute("aria-disabled");
		}
	}

	private refreshContactMomentSurface(surface: ContactMomentSurface): void {
		if (surface === "follow-ups") {
			if (this.mode === "follow-ups") this.renderFollowUps();
			return;
		}
		this.renderSelectedDetails();
		if (surface === "sheet" && this.sheet.open) this.renderSheet();
	}

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
