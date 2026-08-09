import type {
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	ContactMomentFollowUpStatus,
	ContactMomentSummary,
	NodeId,
} from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { createTranslator, type Translator } from "../i18n";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	buildSelectedPersonContactMomentPresentation,
	groupContactMomentFollowUps,
} from "./contact-moment-presentation";
import { createDeterministicLayout, type LayoutPoint } from "./layout";
import type { LayoutSnapshot } from "./layout-state";
import { GraphCanvasSurface, type AtlasRendererPhotoCacheStats } from "./graph-canvas-surface";
import { renderPersonProfile, type PersonPhotoResourceResolver } from "./person-profile";
import { buildIncidentRelationshipRows, type IncidentRelationshipRow } from "./relationship-rows";
import { GraphInteractionController } from "./graph-interaction-controller";
import { FollowUpPanel } from "./follow-up-panel";
import { PersonDetailsPanel } from "./person-details-panel";
import { RelationshipDetailsPanel } from "./relationship-details-panel";
import { SemanticPeopleList } from "./semantic-people-list";

export type { AtlasRendererPhotoCacheStats } from "./graph-canvas-surface";

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

export class AtlasRenderer {
	private readonly win: Window & typeof globalThis;
	private readonly doc: Document;
	private readonly root: HTMLDivElement;
	private readonly modeControls: HTMLFieldSetElement;
	private readonly graphModeButton: HTMLButtonElement;
	private readonly listModeButton: HTMLButtonElement;
	private readonly followUpsModeButton: HTMLButtonElement;
	private readonly graphCanvas: GraphCanvasSurface;
	private readonly semanticPeopleList: SemanticPeopleList;
	private readonly personDetailsPanel: PersonDetailsPanel;
	private readonly relationshipDetailsPanel: RelationshipDetailsPanel;
	private readonly relationshipSheetPanel: RelationshipDetailsPanel;
	private readonly followUpPanel: FollowUpPanel;
	private readonly semanticPanel: HTMLElement;
	private readonly details: HTMLElement;
	private readonly followUpsPanel: HTMLElement;
	private readonly followUpsHeading: HTMLHeadingElement;
	private readonly sheet: HTMLDialogElement;
	private readonly sheetContent: HTMLDivElement;
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
	private readonly graphInteraction: GraphInteractionController;
	private followUpDayTimer: number | undefined;
	private sheetNodeId: NodeId | undefined;
	private sheetInvoker: SheetInvoker | undefined;
	private sheetReturnFocusElement: HTMLElement | undefined;
	private destroyed = false;
	private expandedContactHistoryPersonId: string | undefined;
	private readonly pendingFollowUpMomentIdentities = new Set<string>();

	constructor(
		private readonly container: HTMLElement,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly callbacks: AtlasRendererCallbacks,
		private readonly t: Translator = createTranslator("en"),
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
		legend.textContent = this.t.atlasRenderer.view;
		this.graphModeButton = this.createModeButton(this.t.atlasRenderer.graph, "people-atlas-graph-mode", true);
		this.listModeButton = this.createModeButton(this.t.atlasRenderer.list, "people-atlas-list-mode", false);
		this.followUpsModeButton = this.createModeButton(
			this.t.atlasRenderer.followUps,
			"people-atlas-follow-ups-mode",
			false,
		);
		this.modeControls.append(legend, this.graphModeButton, this.listModeButton, this.followUpsModeButton);

		this.graphCanvas = new GraphCanvasSurface({
			container: this.container,
			getSettings: this.getSettings,
			getSnapshot: () => this.snapshot,
			getPositions: () => this.positions,
			setPositions: (positions) => {
				this.positions = positions;
			},
			getSelectedId: () => this.selectedId,
			...(this.callbacks.onLayoutChanged ? { onLayoutChanged: this.callbacks.onLayoutChanged } : {}),
			...(this.callbacks.resolvePersonPhoto ? { resolvePersonPhoto: this.callbacks.resolvePersonPhoto } : {}),
			translator: this.t,
		});

		this.graphInteraction = new GraphInteractionController({
			surface: this.graphCanvas,
			getSnapshot: () => this.snapshot,
			getSelectedId: () => this.selectedId,
			getMode: () => this.mode,
			selectNode: (node) => this.selectNode(node, "canvas"),
			onOpenNode: this.callbacks.onOpenNode,
			onCenterNode: this.callbacks.onCenterNode,
			...(this.callbacks.onLayoutChanged ? { onLayoutChanged: this.callbacks.onLayoutChanged } : {}),
			fitToContent: () => this.fitToContent(),
			openDetailsSheet: () => this.openSheet("canvas"),
		});

		this.semanticPeopleList = new SemanticPeopleList(this.doc, {
			panelLabel: this.t.atlasRenderer.listView,
			peopleLabel: this.t.atlasRenderer.peopleInAtlas,
			noPeopleLabel: this.t.atlasRenderer.noPeople,
			translator: this.t,
			getSnapshot: () => this.snapshot,
			getSelectedId: () => this.selectedId,
			getFocusedId: () => this.focusedId,
			setFocusedId: (id) => {
				this.focusedId = id;
			},
			getSummary: (snapshot) =>
				this.t.atlasRenderer.semanticListSummary({
					people: this.t.formatInteger(snapshot.nodes.length),
					peopleCount: snapshot.nodes.length,
					connections: this.t.formatInteger(snapshot.edges.length),
					connectionsCount: snapshot.edges.length,
					hiddenContactMoments: this.t.formatInteger(Math.max(0, snapshot.hiddenContactMomentCount)),
					hiddenContactMomentCount: Math.max(0, snapshot.hiddenContactMomentCount),
				}),
			onSelectNode: (node) => this.selectNode(node, "list"),
			onOpenNode: this.callbacks.onOpenNode,
			onRenderDetails: () => this.renderSelectedDetails(),
		});
		this.semanticPanel = this.semanticPeopleList.element;
		this.personDetailsPanel = new PersonDetailsPanel(this.doc, {
			label: this.t.atlasRenderer.selectedPersonDetails,
			translator: this.t,
			getSnapshot: () => this.snapshot,
			getSelectedId: () => this.selectedId,
			getSettings: this.getSettings,
			...(this.callbacks.resolvePersonPhoto ? { resolvePersonPhoto: this.callbacks.resolvePersonPhoto } : {}),
			renderContactMoments: (selected, headingLevel, surface) =>
				this.renderSelectedContactMoments(selected, headingLevel, surface),
			getRelationshipRows: (selected) =>
				buildIncidentRelationshipRows(this.snapshot, selected, this.getSettings().relationshipRoleFormat, this.t),
			renderRelationshipGroups: (rows, selected, headingLevel) =>
				this.renderRelationshipGroups(rows, selected, headingLevel),
			canLogContact: (selected) =>
				Boolean(this.callbacks.onLogContact && this.callbacks.canLogContact?.(selected) === true),
		});
		this.details = this.personDetailsPanel.element;
		this.relationshipDetailsPanel = new RelationshipDetailsPanel(this.doc, {
			translator: this.t,
			...(this.callbacks.onOpenRelationship ? { onOpenRelationship: this.callbacks.onOpenRelationship } : {}),
			...(this.callbacks.canOpenRelationship ? { canOpenRelationship: this.callbacks.canOpenRelationship } : {}),
			...(this.callbacks.onEditRelationship ? { onEditRelationship: this.callbacks.onEditRelationship } : {}),
			...(this.callbacks.canEditRelationship ? { canEditRelationship: this.callbacks.canEditRelationship } : {}),
		});
		this.relationshipSheetPanel = new RelationshipDetailsPanel(this.doc, {
			translator: this.t,
			...(this.callbacks.onOpenRelationship ? { onOpenRelationship: this.callbacks.onOpenRelationship } : {}),
			...(this.callbacks.canOpenRelationship ? { canOpenRelationship: this.callbacks.canOpenRelationship } : {}),
			...(this.callbacks.onEditRelationship ? { onEditRelationship: this.callbacks.onEditRelationship } : {}),
			...(this.callbacks.canEditRelationship ? { canEditRelationship: this.callbacks.canEditRelationship } : {}),
		});
		this.semanticPanel.append(this.details);

		this.followUpPanel = new FollowUpPanel(this.doc, {
			panelLabel: this.t.atlasRenderer.contactFollowUps,
			heading: this.t.atlasRenderer.contactFollowUps,
			translator: this.t,
			getContactMoments: () => this.contactMoments(),
			getLocalCalendarDay: () => this.localCalendarDay(),
			getHiddenCount: () => this.hiddenContactMomentCount(),
			renderRow: (row, peers) =>
				this.renderContactMomentRow(row.moment, "follow-ups", {
					followUpOn: row.followUpOn,
					accessiblePeers: peers,
				}),
		});
		this.followUpsPanel = this.followUpPanel.element;
		this.followUpsHeading = this.followUpPanel.heading;

		this.sheet = this.doc.createElement("dialog");
		this.sheet.className = "people-atlas-details-sheet";
		this.sheet.setAttribute("aria-label", this.t.atlasRenderer.selectedPersonDetails);
		this.sheetContent = this.doc.createElement("div");
		this.sheetContent.className = "people-atlas-details-sheet-content";
		this.sheet.append(this.sheetContent);

		this.root.append(this.modeControls, this.graphCanvas.element, this.semanticPanel, this.followUpsPanel, this.sheet);
		this.container.append(this.root);
		this.graphCanvas.resize();
		this.graphInteraction.attach();
		this.semanticPeopleList.attach();

		this.graphModeButton.addEventListener("click", this.onGraphMode);
		this.listModeButton.addEventListener("click", this.onListMode);
		this.followUpsModeButton.addEventListener("click", this.onFollowUpsMode);
		this.details.addEventListener("click", this.onDetailsClick);
		this.followUpsPanel.addEventListener("click", this.onFollowUpsClick);
		this.graphCanvas.zoomOutButton.addEventListener("click", this.onZoomOut);
		this.graphCanvas.zoomInButton.addEventListener("click", this.onZoomIn);
		this.graphCanvas.fitButton.addEventListener("click", this.onFit);
		this.graphCanvas.detailsButton.addEventListener("click", this.onShowDetails);
		this.sheet.addEventListener("click", this.onSheetClick);
		this.sheet.addEventListener("cancel", this.onSheetCancel);
		this.sheet.addEventListener("keydown", this.onSheetKeyDown);

		this.updateSemanticPanel();
	}

	setGraph(snapshot: AtlasSnapshot, savedLayout?: LayoutSnapshot): void {
		this.graphInteraction.cancel();
		const activeElement = this.doc.activeElement;
		const focusedButton = this.semanticPeopleList.personButtonFrom(activeElement);
		const focusedNodeId = focusedButton?.dataset.nodeId;
		const listHeldFocus = Boolean(focusedButton && this.semanticPeopleList.contains(focusedButton));
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
		if (savedLayout) this.graphCanvas.restoreLayoutSnapshot(savedLayout);

		if (this.selectedId && !this.nodeById(this.selectedId)) {
			this.selectedId = undefined;
			this.expandedContactHistoryPersonId = undefined;
			this.callbacks.onSelectNode(undefined, "graph-update");
		}

		const focusedStillExists = this.focusedId ? Boolean(this.nodeById(this.focusedId)) : false;
		if (this.selectedId) this.focusedId = this.selectedId;
		else if (!focusedStillExists) this.focusedId = snapshot.nodes[0]?.id;
		this.graphCanvas.refresh();
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
			if (targetId) this.semanticPeopleList.focusPersonButton(targetId);
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
		this.graphCanvas.fitToContent();
	}

	getLayoutSnapshot(): LayoutSnapshot {
		return this.graphCanvas.getLayoutSnapshot();
	}

	getPhotoCacheStats(): Readonly<AtlasRendererPhotoCacheStats> {
		return this.graphCanvas.getPhotoCacheStats();
	}

	restoreLayoutSnapshot(layout: LayoutSnapshot): void {
		this.graphCanvas.restoreLayoutSnapshot(layout);
	}

	restoreRelationshipActionFocus(invoker: HTMLButtonElement): void {
		if (this.destroyed) return;
		if (invoker.ownerDocument === this.doc && invoker.isConnected && this.root.contains(invoker)) {
			invoker.focus();
			if (this.doc.activeElement === invoker) return;
		}
		if (this.sheet.open && this.focusSelectedDetailsHeading(this.sheet)) return;
		if (this.focusSelectedDetailsHeading(this.details)) return;
		if (!this.graphCanvas.detailsButton.disabled && this.graphCanvas.detailsButton.isConnected)
			this.graphCanvas.detailsButton.focus();
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
		if (!this.graphCanvas.detailsButton.disabled && this.graphCanvas.detailsButton.isConnected)
			this.graphCanvas.detailsButton.focus();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.graphInteraction.cancel();
		this.cancelFollowUpDayRefresh();
		this.closeSheet(false);
		this.graphInteraction.destroy();
		this.graphCanvas.destroy();
		this.graphModeButton.removeEventListener("click", this.onGraphMode);
		this.listModeButton.removeEventListener("click", this.onListMode);
		this.followUpsModeButton.removeEventListener("click", this.onFollowUpsMode);
		this.details.removeEventListener("click", this.onDetailsClick);
		this.followUpsPanel.removeEventListener("click", this.onFollowUpsClick);
		this.graphCanvas.zoomOutButton.removeEventListener("click", this.onZoomOut);
		this.graphCanvas.zoomInButton.removeEventListener("click", this.onZoomIn);
		this.graphCanvas.fitButton.removeEventListener("click", this.onFit);
		this.graphCanvas.detailsButton.removeEventListener("click", this.onShowDetails);
		this.sheet.removeEventListener("click", this.onSheetClick);
		this.sheet.removeEventListener("cancel", this.onSheetCancel);
		this.sheet.removeEventListener("keydown", this.onSheetKeyDown);
		this.personDetailsPanel.destroy();
		this.semanticPeopleList.destroy();
		this.followUpPanel.destroy();
		this.relationshipDetailsPanel.destroy();
		this.relationshipSheetPanel.destroy();
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
		this.graphInteraction.cancel();
		if (mode !== "graph") this.closeSheet(false);
		this.cancelFollowUpDayRefresh();
		this.mode = mode;
		const graphActive = mode === "graph";
		const listActive = mode === "list";
		const followUpsActive = mode === "follow-ups";
		this.graphModeButton.setAttribute("aria-pressed", String(graphActive));
		this.listModeButton.setAttribute("aria-pressed", String(listActive));
		this.followUpsModeButton.setAttribute("aria-pressed", String(followUpsActive));
		this.graphCanvas.graphSurface.hidden = !graphActive;
		this.semanticPanel.hidden = !listActive;
		this.followUpsPanel.hidden = !followUpsActive;
		this.graphCanvas.canvas.hidden = !graphActive;
		this.graphCanvas.canvas.tabIndex = graphActive ? 0 : -1;
		if (graphActive) this.resize();
		if (followUpsActive) {
			this.renderFollowUps();
			this.scheduleFollowUpDayRefresh();
		}
	}

	private resize(): void {
		this.graphCanvas.resize();
	}

	private requestDraw(): void {
		this.graphCanvas.requestDraw();
	}

	private reconcileCanvasPhotoAdmission(): void {
		this.graphCanvas.refreshPhotoAdmission();
	}

	private updateSemanticPanel(): void {
		this.graphCanvas.detailsButton.disabled = !this.selectedId || !this.nodeById(this.selectedId);
		this.semanticPeopleList.update();
	}

	private renderSelectedDetails(): void {
		this.personDetailsPanel.render();
	}

	private renderRelationshipGroups(
		rows: IncidentRelationshipRow[],
		selected: AtlasNode,
		headingLevel: 3 | 4,
	): HTMLDivElement {
		const panel = headingLevel === 4 ? this.relationshipDetailsPanel : this.relationshipSheetPanel;
		return panel.render(rows, selected, headingLevel);
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
		const close = this.createSheetActionButton(this.t.atlasRenderer.close, "close");
		header.append(heading, close);
		this.sheetContent.append(header);

		if (isResolvedAtlasPersonNode(selected)) {
			const profile = renderPersonProfile(this.doc, selected, {
				contactHeadingLevel: 3,
				resolvePhotoResource: this.callbacks.resolvePersonPhoto,
				translator: this.t,
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
			this.t,
		);
		if (relationshipRows.length === 0) {
			const empty = this.doc.createElement("p");
			empty.textContent = this.t.atlasRenderer.noVisibleConnections;
			this.sheetContent.append(empty);
		} else {
			this.sheetContent.append(this.renderRelationshipGroups(relationshipRows, selected, 3));
		}

		if (isResolvedAtlasPersonNode(selected)) {
			const actions = this.doc.createElement("div");
			actions.className = "people-atlas-details-sheet-actions";
			actions.append(
				this.createSheetActionButton(this.t.atlasRenderer.openNote, "open"),
				this.createSheetActionButton(this.t.atlasRenderer.useAsCenter, "center"),
			);
			if (this.callbacks.onEditPerson && this.callbacks.canEditPerson?.(selected) === true) {
				actions.append(this.createSheetActionButton(this.t.atlasRenderer.editPerson, "edit"));
			}
			if (this.callbacks.onCreateRelationship && this.callbacks.canCreateRelationship?.(selected) === true) {
				actions.append(this.createSheetActionButton(this.t.atlasRenderer.createRelationship, "create"));
			}
			if (this.callbacks.onLogContact && this.callbacks.canLogContact?.(selected) === true) {
				actions.append(this.createSheetActionButton(this.t.atlasRenderer.logContact, "log-contact"));
			}
			this.sheetContent.append(actions);
		}
	}

	private capabilityExplanation(node: AtlasNode): string | undefined {
		if (isAmbiguousAtlasNode(node)) return this.t.atlasRenderer.ambiguousNoActions;
		if (node.kind === "ghost") return this.t.atlasRenderer.unresolvedNoActions;
		if (!node.filePath) return this.t.atlasRenderer.noNoteNoActions;
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
		heading.textContent = this.t.atlasRenderer.contactMoments;
		section.append(heading);

		if (bounded.earliestOpenFollowUp) {
			const nextFollowUp = this.doc.createElement("div");
			nextFollowUp.className = "people-atlas-next-follow-up";
			const label = this.doc.createElement("p");
			label.className = "people-atlas-contact-moment-label";
			label.textContent = this.t.atlasRenderer.nextFollowUp;
			nextFollowUp.append(
				label,
				this.renderContactMomentRow(bounded.earliestOpenFollowUp.moment, surface, {
					followUpOn: bounded.earliestOpenFollowUp.followUpOn,
					accessibleContext: this.t.atlasRenderer.nextFollowUp,
					accessiblePeers: [bounded.earliestOpenFollowUp.moment],
				}),
			);
			section.append(nextFollowUp);
		}

		const history = this.doc.createElement("div");
		history.className = "people-atlas-contact-moment-recent";
		const label = this.doc.createElement("p");
		label.className = "people-atlas-contact-moment-label";
		label.textContent = expanded ? this.t.atlasRenderer.allContactMoments : this.t.atlasRenderer.recentContactMoments;
		history.append(label);
		if (visibleMoments.length === 0) {
			const empty = this.doc.createElement("p");
			empty.textContent = this.t.atlasRenderer.noContactMoments;
			history.append(empty);
		} else {
			const list = this.doc.createElement("ul");
			list.className = "people-atlas-contact-moment-list";
			list.setAttribute(
				"aria-label",
				this.t.atlasRenderer.contactMomentListFor({
					scope: expanded ? this.t.atlasRenderer.allContactMoments : this.t.atlasRenderer.recentContactMoments,
					name: selected.label,
				}),
			);
			for (const moment of visibleMoments) {
				list.append(this.renderContactMomentRow(moment, surface, { accessiblePeers: visibleMoments }));
			}
			history.append(list);
		}
		section.append(history);

		if (all.length > bounded.recentMoments.length) {
			const toggle = this.createActionButton(
				expanded ? this.t.atlasRenderer.showRecentContactMoments : this.t.atlasRenderer.viewAllContactMoments,
			);
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
		this.followUpPanel.render();
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
			prefix.textContent = this.t.atlasRenderer.followUpPrefix;
			const date = this.doc.createElement("time");
			date.dateTime = options.followUpOn;
			date.textContent = this.t.formatDateOnly(options.followUpOn);
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
		occurredPrefix.textContent = this.t.atlasRenderer.contactPrefix;
		const occurredDate = this.doc.createElement("time");
		occurredDate.dateTime = moment.occurredOn;
		occurredDate.textContent = this.t.formatDateOnly(moment.occurredOn);
		occurred.append(occurredPrefix, occurredDate);
		content.append(occurred);
		if (moment.channel) {
			const channel = this.doc.createElement("p");
			channel.textContent = this.t.atlasRenderer.channel({ channel: moment.channel });
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
			open: this.t.atlasRenderer.openContactMoment,
			edit: this.t.atlasRenderer.editContactMoment,
			done: this.t.atlasRenderer.markFollowUpDone,
			dismiss: this.t.atlasRenderer.dismissFollowUp,
		};
		const button = this.createActionButton(actionLabels[action]);
		button.dataset.contactMomentAction = action;
		button.dataset.contactMomentId = moment.id;
		button.dataset.contactMomentPath = moment.filePath;
		button.dataset.contactMomentSurface = surface;
		const dateContext =
			action === "done" || action === "dismiss"
				? this.t.atlasRenderer.due({
						date: this.formatFollowUpDate(followUpOn ?? moment.followUpOn),
					})
				: this.t.formatDateOnly(moment.occurredOn);
		const discriminator = this.contactMomentActionDiscriminator(moment, action, accessiblePeers);
		const accessibleName = [
			this.t.atlasRenderer.contactActionName({ action: actionLabels[action], people, date: dateContext }),
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
			ordinal: this.t.atlasRenderer.contactOrdinal({ index: Math.max(0, index) + 1, count: collisions.length }),
		};
	}

	private contactMomentActionCollisionKey(
		moment: ContactMomentSummary,
		action: ContactMomentAction,
		visible: string | undefined,
	): string {
		const date =
			action === "done" || action === "dismiss"
				? (moment.followUpOn ?? this.t.atlasRenderer.unknownDate)
				: moment.occurredOn;
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

	private formatFollowUpDate(value: string | undefined): string {
		return value ? this.t.formatDateOnly(value) : this.t.atlasRenderer.unknownDate;
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
			return person?.label ?? this.t.atlasRenderer.unavailablePerson;
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
		const kind = edge.types.length > 0 ? edge.types.join(", ") : this.t.atlasRenderer.relationship;
		return this.t.atlasRenderer.relationshipSummary({ source: source.label, target: target.label, kind });
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
		if (invoker === "details" && !this.graphCanvas.detailsButton.disabled && this.graphCanvas.detailsButton.isConnected)
			this.graphCanvas.detailsButton.focus();
		else if (invoker === "canvas" && this.graphCanvas.canvas.isConnected && this.mode === "graph")
			this.graphCanvas.canvas.focus();
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

	private zoomAtCanvasCenter(factor: number): void {
		this.graphCanvas.zoomAtCanvasCenter(factor);
	}

	onPointerDown(event: PointerEvent): void {
		this.graphInteraction.handlePointerDown(event);
	}

	onPointerMove(event: PointerEvent): void {
		this.graphInteraction.handlePointerMove(event);
	}

	onPointerUp(event: PointerEvent): void {
		this.graphInteraction.handlePointerUp(event);
	}

	onPointerCancel(event: PointerEvent): void {
		this.graphInteraction.handlePointerCancel(event);
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
		const edge = this.relationshipDetailsPanel.getEdge(button) ?? this.relationshipSheetPanel.getEdge(button);
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
}
