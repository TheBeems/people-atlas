import type { AtlasNode, AtlasSnapshot } from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { Translator } from "../i18n";
import type { PeopleAtlasSettings } from "../settings/types";
import { getLatestSelectedPersonContactMoment } from "./contact-moment-presentation";
import { renderPersonProfile, type PersonPhotoResourceResolver } from "./person-profile";
import type { IncidentRelationshipRow } from "./relationship-rows";

export type PersonDetailsSurface = "details" | "sheet";
type PersonDetailsAction = "open" | "center" | "edit" | "create" | "log-contact";

export interface PersonDetailsPanelOptions {
	label: string;
	translator: Translator;
	getSnapshot: () => AtlasSnapshot;
	getSelectedId: () => string | undefined;
	getSettings: () => PeopleAtlasSettings;
	resolvePersonPhoto?: PersonPhotoResourceResolver | undefined;
	renderContactMoments: (
		selected: AtlasNode,
		headingLevel: 3 | 4,
		surface: PersonDetailsSurface,
	) => HTMLElement | undefined;
	getRelationshipRows: (selected: AtlasNode) => IncidentRelationshipRow[];
	renderRelationshipGroups: (rows: IncidentRelationshipRow[], selected: AtlasNode, headingLevel: 3 | 4) => HTMLElement;
	getUnavailableMessage?: (node: AtlasNode) => string | undefined;
	canEditPerson?: (node: AtlasNode) => boolean;
	canCreateRelationship?: (node: AtlasNode) => boolean;
	canLogContact?: (node: AtlasNode) => boolean;
	headingLevel?: 3 | 4;
	sectionHeadingLevel?: 3 | 4;
	includeHeading?: boolean;
	surface?: PersonDetailsSurface;
	actionDataAttribute?: "action" | "sheet-action";
}

/** Owns selected-person semantic details rendering and its action affordances. */
export class PersonDetailsPanel {
	readonly element: HTMLElement;
	private readonly options: PersonDetailsPanelOptions;
	private destroyed = false;

	constructor(document: Document, options: PersonDetailsPanelOptions) {
		this.options = options;
		this.element = document.createElement("section");
		this.element.className = "people-atlas-semantic-details";
		this.element.setAttribute("aria-label", options.label);
	}

	render(selectedOverride?: AtlasNode): void {
		if (this.destroyed) return;
		const { translator } = this.options;
		this.element.replaceChildren();
		const snapshot = this.options.getSnapshot();
		const selectedId = this.options.getSelectedId();
		const selected =
			selectedOverride ?? (selectedId ? snapshot.nodes.find((node) => node.id === selectedId) : undefined);
		const headingLevel = this.options.headingLevel ?? 3;
		const sectionHeadingLevel = this.options.sectionHeadingLevel ?? 4;
		const surface = this.options.surface ?? "details";
		if (this.options.includeHeading !== false) {
			const heading = this.element.ownerDocument.createElement(`h${headingLevel}`);
			heading.textContent = selected?.label ?? translator.atlasRenderer.selection;
			if (selected) {
				heading.tabIndex = -1;
				heading.dataset.selectedPersonHeading = selected.id;
			}
			this.element.append(heading);
		}
		if (!selected) {
			const hint = this.element.ownerDocument.createElement("p");
			hint.textContent = translator.atlasRenderer.selectPersonHint;
			this.element.append(hint);
			return;
		}

		if (isResolvedAtlasPersonNode(selected)) {
			const profile = renderPersonProfile(this.element.ownerDocument, selected, {
				contactHeadingLevel: sectionHeadingLevel,
				resolvePhotoResource: this.options.resolvePersonPhoto,
				translator,
			});
			if (profile) this.element.append(profile);
		}

		const unavailableMessage = this.options.getUnavailableMessage?.(selected);
		if (unavailableMessage) {
			this.appendMessage(unavailableMessage);
		} else if (isAmbiguousAtlasNode(selected)) {
			this.appendMessage(translator.atlasRenderer.ambiguousNoOpenCenter);
		} else if (selected.kind === "ghost") {
			this.appendMessage(translator.atlasRenderer.unresolvedNoNote);
		} else if (!selected.filePath) {
			this.appendMessage(translator.atlasRenderer.noNote);
		}

		const relationshipRows = this.options.getRelationshipRows(selected);
		if (relationshipRows.length === 0) this.appendMessage(translator.atlasRenderer.noVisibleConnections);
		else this.element.append(this.options.renderRelationshipGroups(relationshipRows, selected, sectionHeadingLevel));

		if (isResolvedAtlasPersonNode(selected) && selected.personId) {
			const latestContact = getLatestSelectedPersonContactMoment(snapshot.contactMoments, selected.personId);
			if (latestContact) this.element.append(this.renderLatestContact(latestContact, sectionHeadingLevel));
			const contactMoments = this.options.renderContactMoments(selected, sectionHeadingLevel, surface);
			if (contactMoments) this.element.append(contactMoments);
		}

		if (!isResolvedAtlasPersonNode(selected)) return;
		this.element.append(this.renderActions(selected));
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.element.replaceChildren();
		this.element.remove();
	}

	private appendMessage(message: string): void {
		const paragraph = this.element.ownerDocument.createElement("p");
		paragraph.textContent = message;
		this.element.append(paragraph);
	}

	private renderLatestContact(moment: { occurredOn: string }, headingLevel: 3 | 4): HTMLElement {
		const section = this.element.ownerDocument.createElement("section");
		section.className = "people-atlas-last-contact";
		const heading = this.element.ownerDocument.createElement(`h${headingLevel}`);
		heading.textContent = this.options.translator.atlasRenderer.lastContact;
		const date = this.element.ownerDocument.createElement("time");
		date.dateTime = moment.occurredOn;
		date.textContent = this.options.translator.formatDateOnly(moment.occurredOn);
		section.append(heading, date);
		return section;
	}

	private renderActions(selected: AtlasNode): HTMLDivElement {
		const { translator } = this.options;
		const actions = this.element.ownerDocument.createElement("div");
		actions.className = "people-atlas-semantic-actions";
		if (this.options.canLogContact?.(selected) === true) {
			actions.append(this.actionButton("log-contact", translator.atlasRenderer.logContact, true));
		}
		actions.append(
			this.actionButton("open", translator.atlasRenderer.openNote),
			this.actionButton("center", translator.atlasRenderer.useAsCenter),
		);
		if (this.options.canEditPerson?.(selected) === true) {
			actions.append(this.actionButton("edit", translator.atlasRenderer.editPerson));
		}
		if (this.options.canCreateRelationship?.(selected) === true) {
			actions.append(this.actionButton("create", translator.atlasRenderer.createRelationship));
		}
		return actions;
	}

	private actionButton(action: PersonDetailsAction, label: string, primary = false): HTMLButtonElement {
		const button = this.element.ownerDocument.createElement("button");
		button.type = "button";
		button.setAttribute(`data-${this.options.actionDataAttribute ?? "action"}`, action);
		button.setAttribute("aria-label", label);
		button.textContent = label;
		if (primary) {
			button.classList.add("mod-cta", "people-atlas-primary-action");
		}
		return button;
	}
}
