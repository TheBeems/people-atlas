import { ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_PEOPLE_ATLAS } from "../constants";
import type {
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	ContactMomentSummary,
	ProjectionCenterMode,
	ProjectionMode,
	RawIndexSnapshot,
} from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { buildGraphSnapshot } from "../graph/graph-source";
import { applyGraphDelta } from "../graph/graph-delta";
import { projectGraph } from "../graph/project-graph";
import { buildLayoutKey, rememberCenter, type AtlasViewState } from "../settings/view-state";
import type { LayoutSnapshot } from "../render/layout-state";
import { renderPersonProfile } from "../render/person-profile";
import type PeopleAtlasPlugin from "../main";
import { resolvePersonPhotoResource } from "../person-photo-resource";
import { AtlasRenderer, type AtlasSelectionSource } from "../render/atlas-renderer";
import { buildSelectedPersonContactMomentPresentation } from "../render/contact-moment-presentation";

export class PeopleAtlasView extends ItemView {
	private renderer: AtlasRenderer | undefined;
	private unsubscribe: (() => void) | undefined;
	private statsEl: HTMLElement | undefined;
	private detailsEl: HTMLElement | undefined;
	private diagnosticsEl: HTMLElement | undefined;
	private rawSnapshot: RawIndexSnapshot = { people: [], relationships: [] };
	private fullSnapshot: AtlasSnapshot | undefined;
	private projectedSnapshot: AtlasSnapshot | undefined;
	private readonly viewConfigurationKey = "standalone";
	private viewState: AtlasViewState;
	private centerId: string | undefined;
	private centerMode: ProjectionCenterMode;
	private projectionMode: ProjectionMode;
	private selectedPath: string | undefined;
	private selectedCenterPath: string | undefined;
	private activePath: string | undefined;
	private centerModeSelect: HTMLSelectElement | undefined;
	private readonly initialMyPersonSettingId: string;
	private awaitingInitialMyPersonCenter: boolean;
	private expandedContactHistoryPersonId: string | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PeopleAtlasPlugin,
	) {
		super(leaf);
		this.viewState = plugin.getViewState(this.viewConfigurationKey);
		this.centerMode = this.viewState.centerMode;
		this.projectionMode = this.viewState.projectionMode;
		this.initialMyPersonSettingId = plugin.settings.myPersonId.trim();
		const navigationCenter = this.viewState.centerHistory[0] ?? (plugin.settings.defaultCenterPersonId || undefined);
		const initialMyPersonCenter = navigationCenter ? undefined : plugin.resolveMyPerson()?.id;
		this.centerId = navigationCenter ?? initialMyPersonCenter;
		this.awaitingInitialMyPersonCenter = Boolean(
			!navigationCenter && !initialMyPersonCenter && this.initialMyPersonSettingId,
		);
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
			this.plugin.t.peopleAtlasView.center,
			[
				["configured", this.plugin.t.peopleAtlasView.configuredCenter],
				["active-note", this.plugin.t.peopleAtlasView.activeNote],
				["selected-node", this.plugin.t.peopleAtlasView.selectedNode],
				["none", this.plugin.t.peopleAtlasView.noCenter],
			],
			this.centerMode,
			(value) => {
				this.centerMode = value as ProjectionCenterMode;
				if (this.centerMode !== "configured") this.awaitingInitialMyPersonCenter = false;
				this.persistViewState();
				this.renderSnapshot();
			},
		);
		this.centerModeSelect = centerMode;
		const projectionMode = this.createSelect(
			this.plugin.t.peopleAtlasView.projection,
			[
				["ego", this.plugin.t.peopleAtlasView.egoNetwork],
				["free-network", this.plugin.t.peopleAtlasView.freeNetwork],
				["contact-health", this.plugin.t.peopleAtlasView.contactHealth],
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
		fitButton.textContent = this.plugin.t.atlasRenderer.fit;
		fitButton.addEventListener("click", () => this.renderer?.fitToContent());
		const clearCenterButton = this.contentEl.ownerDocument.createElement("button");
		clearCenterButton.type = "button";
		clearCenterButton.textContent = this.plugin.t.peopleAtlasView.allPeople;
		clearCenterButton.addEventListener("click", () => {
			this.centerMode = "none";
			this.awaitingInitialMyPersonCenter = false;
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
		this.detailsEl.className = "people-atlas-selected-details";
		this.detailsEl.setAttribute("aria-label", this.plugin.t.atlasRenderer.selectedPersonDetails);
		this.diagnosticsEl = this.contentEl.ownerDocument.createElement("section");
		this.diagnosticsEl.className = "people-atlas-diagnostics";
		sidebar.append(this.detailsEl, this.diagnosticsEl);
		body.append(graph, sidebar);
		this.contentEl.append(toolbar, body);

		this.renderer = new AtlasRenderer(
			graph,
			() => this.plugin.settings,
			{
				onOpenNode: (node) => this.openNode(node),
				onCenterNode: (node) => {
					if (!isResolvedAtlasPersonNode(node)) return;
					this.awaitingInitialMyPersonCenter = false;
					this.centerMode = "selected-node";
					if (this.centerModeSelect) this.centerModeSelect.value = "selected-node";
					this.selectedPath = node.filePath;
					this.selectedCenterPath = node.filePath;
					this.centerId = node.personId;
					this.persistViewState(node.personId);
					this.renderSnapshot();
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
				onLogContact: (node) => {
					if (this.canLogContact(node)) this.plugin.openLogContact(node.filePath);
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
				onContactMomentActionUnavailable: () => this.plugin.noticeContactMomentActionUnavailable(),
				canOpenRelationship: (edge) => this.canOpenRelationship(edge),
				onOpenRelationship: (edge) => this.openRelationship(edge),
				canEditRelationship: (edge) => this.canEditRelationship(edge),
				onEditRelationship: (edge, invoker) => this.editRelationship(edge, invoker),
				onLayoutChanged: (layout) => this.persistLayout(layout),
				resolvePersonPhoto: (photoPath) => resolvePersonPhotoResource(this.app, photoPath),
			},
			this.plugin.t,
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.activePath = this.app.workspace.getActiveFile()?.path;
				if (this.centerMode === "active-note") this.renderSnapshot();
			}),
		);

		this.unsubscribe = this.plugin.index.subscribe((snapshot, delta) => {
			this.rawSnapshot = snapshot;
			this.initializeDeferredMyPersonCenter(delta !== undefined);
			this.fullSnapshot =
				delta && this.fullSnapshot
					? applyGraphDelta(
							this.fullSnapshot,
							delta,
							(target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
							{
								resolutionPeople: snapshot.people,
								relationships: snapshot.relationships,
								contactMoments: snapshot.contactMoments ?? [],
							},
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
		if (this.plugin.settings.myPersonId.trim() !== this.initialMyPersonSettingId) {
			this.awaitingInitialMyPersonCenter = false;
		}
		this.renderSnapshot();
	}

	showFollowUps(): void {
		this.renderer?.showFollowUps();
	}

	private initializeDeferredMyPersonCenter(indexPublished: boolean): void {
		if (!this.awaitingInitialMyPersonCenter) return;
		const myPerson = this.plugin.resolveMyPerson();
		if (
			myPerson &&
			this.centerMode === "configured" &&
			!this.centerId &&
			!this.viewState.centerHistory[0] &&
			!this.plugin.settings.defaultCenterPersonId &&
			this.plugin.settings.myPersonId.trim() === this.initialMyPersonSettingId
		) {
			this.centerId = myPerson.id;
			this.awaitingInitialMyPersonCenter = false;
			return;
		}
		if (indexPublished) this.awaitingInitialMyPersonCenter = false;
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
		this.projectedSnapshot = projected;
		const layoutKey = buildLayoutKey(this.viewConfigurationKey, this.viewState, this.centerId, centerPath);
		this.renderer?.setGraph(projected, this.viewState.layouts[layoutKey]);
		if (this.selectedPath) {
			this.renderDetails(
				projected.nodes.find((node) => isResolvedAtlasPersonNode(node) && node.filePath === this.selectedPath),
			);
		}
		if (this.statsEl)
			this.statsEl.textContent = this.plugin.t.peopleAtlasView.stats({
				people: this.plugin.t.formatInteger(projected.nodes.length),
				peopleCount: projected.nodes.length,
				connections: this.plugin.t.formatInteger(projected.edges.length),
				connectionsCount: projected.edges.length,
			});
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
		const focusedContactMomentAction = this.captureFocusedContactMomentAction();
		this.detailsEl.replaceChildren();
		const heading = this.detailsEl.ownerDocument.createElement("h3");
		heading.textContent = node?.label ?? this.plugin.t.atlasRenderer.selection;
		this.detailsEl.append(heading);
		if (!node) {
			const hint = this.detailsEl.ownerDocument.createElement("p");
			hint.textContent = this.plugin.t.peopleAtlasView.selectNodeHint;
			this.detailsEl.append(hint);
			this.restoreContactMomentActionFocus(focusedContactMomentAction);
			return;
		}
		if (isResolvedAtlasPersonNode(node)) {
			const profile = renderPersonProfile(this.detailsEl.ownerDocument, node, {
				contactHeadingLevel: 4,
				resolvePhotoResource: (photoPath) => resolvePersonPhotoResource(this.app, photoPath),
				translator: this.plugin.t,
			});
			if (profile) this.detailsEl.append(profile);
			const contactMoments = this.renderContactMomentHistory(node);
			if (contactMoments) this.detailsEl.append(contactMoments);
		} else {
			const availability = this.detailsEl.ownerDocument.createElement("p");
			availability.textContent = isAmbiguousAtlasNode(node)
				? this.plugin.t.atlasRenderer.ambiguousPerson
				: node.kind === "ghost"
					? this.plugin.t.atlasRenderer.unresolvedPerson
					: this.plugin.t.peopleAtlasView.personNoteUnavailable;
			this.detailsEl.append(availability);
		}
		if (this.canEditPerson(node)) {
			const editPersonButton = this.detailsEl.ownerDocument.createElement("button");
			editPersonButton.type = "button";
			editPersonButton.textContent = this.plugin.t.atlasRenderer.editPerson;
			editPersonButton.addEventListener("click", () => this.plugin.openEditPerson(node.filePath));
			this.detailsEl.append(editPersonButton);
		}
		if (this.canCreateRelationship(node)) {
			const createRelationshipButton = this.detailsEl.ownerDocument.createElement("button");
			createRelationshipButton.type = "button";
			createRelationshipButton.textContent = this.plugin.t.atlasRenderer.createRelationship;
			createRelationshipButton.addEventListener("click", () => this.plugin.openCreateRelationship(node.filePath));
			this.detailsEl.append(createRelationshipButton);
		}
		if (this.canLogContact(node)) {
			const logContactButton = this.detailsEl.ownerDocument.createElement("button");
			logContactButton.type = "button";
			logContactButton.textContent = this.plugin.t.atlasRenderer.logContact;
			logContactButton.addEventListener("click", () => this.plugin.openLogContact(node.filePath));
			this.detailsEl.append(logContactButton);
		}
		this.restoreContactMomentActionFocus(focusedContactMomentAction);
	}

	private renderContactMomentHistory(node: AtlasNode & { personId?: string | undefined }): HTMLElement | undefined {
		const snapshot = this.projectedSnapshot;
		if (!snapshot || !node.personId) return undefined;
		const bounded = buildSelectedPersonContactMomentPresentation(snapshot.contactMoments, node.personId);
		const all = buildSelectedPersonContactMomentPresentation(
			snapshot.contactMoments,
			node.personId,
			Number.POSITIVE_INFINITY,
		).recentMoments;
		const expanded = this.expandedContactHistoryPersonId === node.personId;
		const visible = expanded ? all : bounded.recentMoments;
		const section = this.detailsEl?.ownerDocument.createElement("section");
		if (!section) return undefined;
		section.className = "people-atlas-contact-moment-history";
		section.dataset.contactMomentPersonId = node.personId;
		const heading = section.ownerDocument.createElement("h4");
		heading.textContent = this.plugin.t.atlasRenderer.contactMoments;
		section.append(heading);

		if (bounded.earliestOpenFollowUp) {
			const next = section.ownerDocument.createElement("div");
			next.className = "people-atlas-next-follow-up";
			const label = section.ownerDocument.createElement("p");
			label.className = "people-atlas-contact-moment-label";
			label.textContent = this.plugin.t.atlasRenderer.nextFollowUp;
			const list = section.ownerDocument.createElement("ul");
			list.className = "people-atlas-contact-moment-list";
			list.append(
				this.renderContactMomentRow(
					bounded.earliestOpenFollowUp.moment,
					node.personId,
					node.label,
					bounded.earliestOpenFollowUp.followUpOn,
				),
			);
			next.append(label, list);
			section.append(next);
		}

		const recent = section.ownerDocument.createElement("div");
		recent.className = "people-atlas-contact-moment-recent";
		const label = section.ownerDocument.createElement("p");
		label.className = "people-atlas-contact-moment-label";
		label.textContent = expanded
			? this.plugin.t.atlasRenderer.allContactMoments
			: this.plugin.t.atlasRenderer.recentContactMoments;
		recent.append(label);
		if (visible.length === 0) {
			const empty = section.ownerDocument.createElement("p");
			empty.textContent = this.plugin.t.atlasRenderer.noContactMoments;
			recent.append(empty);
		} else {
			const list = section.ownerDocument.createElement("ul");
			list.className = "people-atlas-contact-moment-list";
			list.setAttribute(
				"aria-label",
				this.plugin.t.atlasRenderer.contactMomentListFor({
					scope: expanded
						? this.plugin.t.atlasRenderer.allContactMoments
						: this.plugin.t.atlasRenderer.recentContactMoments,
					name: node.label,
				}),
			);
			for (const moment of visible) list.append(this.renderContactMomentRow(moment, node.personId, node.label));
			recent.append(list);
		}
		section.append(recent);

		if (all.length > bounded.recentMoments.length) {
			const toggle = section.ownerDocument.createElement("button");
			toggle.type = "button";
			toggle.textContent = expanded
				? this.plugin.t.atlasRenderer.showRecentContactMoments
				: this.plugin.t.atlasRenderer.viewAllContactMoments;
			toggle.dataset.contactMomentToggle = node.personId;
			toggle.setAttribute("aria-expanded", String(expanded));
			toggle.addEventListener("click", () => {
				this.expandedContactHistoryPersonId = expanded ? undefined : node.personId;
				this.renderDetails(node);
				const replacement = Array.from(
					this.detailsEl?.querySelectorAll<HTMLButtonElement>("button[data-contact-moment-toggle]") ?? [],
				).find((candidate) => candidate.dataset.contactMomentToggle === node.personId);
				replacement?.focus();
			});
			const actions = section.ownerDocument.createElement("div");
			actions.className = "people-atlas-semantic-actions";
			actions.append(toggle);
			section.append(actions);
		}
		return section;
	}

	private renderContactMomentRow(
		moment: ContactMomentSummary,
		personId: string,
		personLabel: string,
		followUpOn?: string,
	): HTMLLIElement {
		const item = this.contentEl.ownerDocument.createElement("li");
		item.className = "people-atlas-contact-moment-row";
		item.dataset.contactMomentId = moment.id;
		item.dataset.contactMomentPath = moment.filePath;
		const content = item.ownerDocument.createElement("div");
		content.className = "people-atlas-contact-moment-content";
		if (followUpOn) {
			const followUp = item.ownerDocument.createElement("p");
			const prefix = item.ownerDocument.createElement("span");
			prefix.textContent = this.plugin.t.atlasRenderer.followUpPrefix;
			const date = item.ownerDocument.createElement("time");
			date.dateTime = followUpOn;
			date.textContent = this.plugin.t.formatDateOnly(followUpOn);
			followUp.append(prefix, date);
			content.append(followUp);
		}
		const occurred = item.ownerDocument.createElement("p");
		const occurredPrefix = item.ownerDocument.createElement("span");
		occurredPrefix.textContent = this.plugin.t.atlasRenderer.contactPrefix;
		const occurredDate = item.ownerDocument.createElement("time");
		occurredDate.dateTime = moment.occurredOn;
		occurredDate.textContent = this.plugin.t.formatDateOnly(moment.occurredOn);
		occurred.append(occurredPrefix, occurredDate);
		content.append(occurred);
		if (moment.channel) {
			const channel = item.ownerDocument.createElement("p");
			channel.textContent = this.plugin.t.atlasRenderer.channel({ channel: moment.channel });
			content.append(channel);
		}
		if (moment.summary) {
			const summary = item.ownerDocument.createElement("p");
			summary.textContent = moment.summary;
			content.append(summary);
		}
		const relationship = this.contactMomentRelationshipLabel(moment);
		if (relationship) {
			const relationshipText = item.ownerDocument.createElement("p");
			relationshipText.textContent = relationship;
			content.append(relationshipText);
		}
		item.append(content);

		const actions = item.ownerDocument.createElement("div");
		actions.className = "people-atlas-semantic-actions people-atlas-contact-moment-actions";
		const actionContext = this.contactMomentActionContext(moment, personId, personLabel, followUpOn);
		const actionPlacement = followUpOn ? "next-follow-up" : "history";
		if (this.plugin.canOpenContactMomentSummary(moment)) {
			const open = item.ownerDocument.createElement("button");
			open.type = "button";
			open.textContent = this.plugin.t.atlasRenderer.openContactMoment;
			open.dataset.contactMomentAction = "open";
			open.dataset.contactMomentId = moment.id;
			open.dataset.contactMomentPath = moment.filePath;
			open.dataset.contactMomentPlacement = actionPlacement;
			open.setAttribute(
				"aria-label",
				this.plugin.t.atlasRenderer.actionWithContext({
					action: this.plugin.t.atlasRenderer.openContactMoment,
					context: actionContext,
				}),
			);
			open.addEventListener("click", () => void this.plugin.openContactMomentSummary(moment));
			actions.append(open);
		}
		if (this.plugin.canEditContactMomentSummary(moment)) {
			const edit = item.ownerDocument.createElement("button");
			edit.type = "button";
			edit.textContent = this.plugin.t.atlasRenderer.editContactMoment;
			edit.dataset.contactMomentAction = "edit";
			edit.dataset.contactMomentId = moment.id;
			edit.dataset.contactMomentPath = moment.filePath;
			edit.dataset.contactMomentPlacement = actionPlacement;
			edit.setAttribute(
				"aria-label",
				this.plugin.t.atlasRenderer.actionWithContext({
					action: this.plugin.t.atlasRenderer.editContactMoment,
					context: actionContext,
				}),
			);
			edit.addEventListener("click", () => {
				this.plugin.openEditContactMomentSummary(moment, () => {
					this.restoreContactMomentActionFocus({
						action: "edit",
						id: moment.id,
						path: moment.filePath,
						placement: actionPlacement,
					});
				});
			});
			actions.append(edit);
		}
		if (actions.childElementCount > 0) item.append(actions);
		return item;
	}

	private captureFocusedContactMomentAction():
		| { action: string; id: string; path: string; placement: string }
		| undefined {
		if (!this.detailsEl) return undefined;
		const active = this.detailsEl.ownerDocument.activeElement;
		if (!active || !this.detailsEl.contains(active)) return undefined;
		const button = active as HTMLButtonElement;
		const action = button.dataset.contactMomentAction;
		const id = button.dataset.contactMomentId;
		const path = button.dataset.contactMomentPath;
		const placement = button.dataset.contactMomentPlacement;
		return action && id && path && placement ? { action, id, path, placement } : undefined;
	}

	private restoreContactMomentActionFocus(
		identity: { action: string; id: string; path: string; placement: string } | undefined,
	): void {
		if (!identity || !this.detailsEl) return;
		const replacement = Array.from(
			this.detailsEl.querySelectorAll<HTMLButtonElement>("button[data-contact-moment-action]"),
		).find(
			(candidate) =>
				candidate.dataset.contactMomentAction === identity.action &&
				candidate.dataset.contactMomentId === identity.id &&
				candidate.dataset.contactMomentPath === identity.path &&
				candidate.dataset.contactMomentPlacement === identity.placement,
		);
		if (replacement) {
			replacement.focus();
			return;
		}
		const fallback =
			this.detailsEl.querySelector<HTMLElement>(".people-atlas-contact-moment-history h4") ??
			this.detailsEl.querySelector<HTMLElement>("h3");
		if (fallback) {
			fallback.tabIndex = -1;
			fallback.focus();
		}
	}

	private contactMomentActionContext(
		moment: ContactMomentSummary,
		personId: string,
		personLabel: string,
		followUpOn?: string,
	): string {
		const sameDay = (this.projectedSnapshot?.contactMoments ?? [])
			.filter((candidate) => candidate.occurredOn === moment.occurredOn && candidate.personIds.includes(personId))
			.sort((left, right) => left.id.localeCompare(right.id) || left.filePath.localeCompare(right.filePath));
		const ordinal = sameDay.findIndex(
			(candidate) => candidate.id === moment.id && candidate.filePath === moment.filePath,
		);
		const discriminator =
			sameDay.length > 1 && ordinal >= 0
				? this.plugin.t.atlasRenderer.contactEntry({ index: ordinal + 1, count: sameDay.length })
				: "";
		const placement = followUpOn
			? this.plugin.t.atlasRenderer.followUpDue({ date: this.plugin.t.formatDateOnly(followUpOn) })
			: "";
		return this.plugin.t.atlasRenderer.contactActionContext({
			person: personLabel,
			date: this.plugin.t.formatDateOnly(moment.occurredOn),
			discriminator,
			placement,
		});
	}

	private contactMomentRelationshipLabel(moment: ContactMomentSummary): string | undefined {
		if (!moment.relationshipId || !this.projectedSnapshot) return undefined;
		const edge = this.projectedSnapshot.edges.find(
			(candidate) => candidate.id === moment.relationshipId && !candidate.inferred,
		);
		if (!edge) return undefined;
		const source = this.projectedSnapshot.nodes.find((candidate) => candidate.id === edge.sourceId);
		const target = this.projectedSnapshot.nodes.find((candidate) => candidate.id === edge.targetId);
		if (!source || !target) return undefined;
		const kind = edge.types.length > 0 ? edge.types.join(", ") : this.plugin.t.atlasRenderer.relationship;
		return this.plugin.t.atlasRenderer.relationshipSummary({ source: source.label, target: target.label, kind });
	}

	private renderDiagnostics(snapshot: AtlasSnapshot): void {
		if (!this.diagnosticsEl) return;
		this.diagnosticsEl.replaceChildren();
		if (!this.plugin.settings.showDiagnostics || snapshot.diagnostics.length === 0) return;
		const heading = this.diagnosticsEl.ownerDocument.createElement("h3");
		heading.textContent = this.plugin.t.atlasRenderer.diagnosticsHeading({ count: snapshot.diagnostics.length });
		const list = this.diagnosticsEl.ownerDocument.createElement("ul");
		for (const diagnostic of snapshot.diagnostics.slice(0, 20)) {
			const item = this.diagnosticsEl.ownerDocument.createElement("li");
			item.className = `is-${diagnostic.severity}`;
			const message = this.diagnosticsEl.ownerDocument.createElement("span");
			message.textContent = this.plugin.t.atlasRenderer.diagnosticMessage({
				code: diagnostic.code,
				message: diagnostic.message,
			});
			item.append(message);
			const sourcePath = diagnostic.filePaths.find(
				(path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
			);
			if (sourcePath) {
				const openButton = this.diagnosticsEl.ownerDocument.createElement("button");
				openButton.type = "button";
				openButton.textContent = this.plugin.t.atlasRenderer.openDiagnosticSource;
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

	private openPath(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(file);
	}
}
