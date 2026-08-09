import type { AtlasNode, AtlasSnapshot } from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { Translator } from "../i18n";
import type { PeopleAtlasSettings } from "../settings/types";
import { renderPersonProfile, type PersonPhotoResourceResolver } from "./person-profile";
import type { IncidentRelationshipRow } from "./relationship-rows";

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
		surface: "details" | "sheet",
	) => HTMLElement | undefined;
	getRelationshipRows: (selected: AtlasNode) => IncidentRelationshipRow[];
	renderRelationshipGroups: (rows: IncidentRelationshipRow[], selected: AtlasNode, headingLevel: 3 | 4) => HTMLElement;
	canLogContact?: (node: AtlasNode) => boolean;
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

	render(): void {
		if (this.destroyed) return;
		const { translator } = this.options;
		this.element.replaceChildren();
		const selectedId = this.options.getSelectedId();
		const selected = selectedId ? this.options.getSnapshot().nodes.find((node) => node.id === selectedId) : undefined;
		const heading = this.element.ownerDocument.createElement("h3");
		heading.textContent = selected?.label ?? translator.atlasRenderer.selection;
		if (selected) {
			heading.tabIndex = -1;
			heading.dataset.selectedPersonHeading = selected.id;
		}
		this.element.append(heading);
		if (!selected) {
			const hint = this.element.ownerDocument.createElement("p");
			hint.textContent = translator.atlasRenderer.selectPersonHint;
			this.element.append(hint);
			return;
		}

		if (isResolvedAtlasPersonNode(selected)) {
			const profile = renderPersonProfile(this.element.ownerDocument, selected, {
				contactHeadingLevel: 4,
				resolvePhotoResource: this.options.resolvePersonPhoto,
				translator,
			});
			if (profile) this.element.append(profile);
			const contactMoments = this.options.renderContactMoments(selected, 4, "details");
			if (contactMoments) this.element.append(contactMoments);
		}

		if (isAmbiguousAtlasNode(selected)) {
			this.appendMessage(translator.atlasRenderer.ambiguousNoOpenCenter);
		} else if (selected.kind === "ghost") {
			this.appendMessage(translator.atlasRenderer.unresolvedNoNote);
		} else if (!selected.filePath) {
			this.appendMessage(translator.atlasRenderer.noNote);
		}

		const relationshipRows = this.options.getRelationshipRows(selected);
		if (relationshipRows.length === 0) this.appendMessage(translator.atlasRenderer.noVisibleConnections);
		else this.element.append(this.options.renderRelationshipGroups(relationshipRows, selected, 4));

		if (!isResolvedAtlasPersonNode(selected)) return;
		const actions = this.element.ownerDocument.createElement("div");
		actions.className = "people-atlas-semantic-actions";
		actions.append(
			this.actionButton("open", translator.atlasRenderer.openNote),
			this.actionButton("center", translator.atlasRenderer.useAsCenter),
			...(this.options.canLogContact?.(selected) === true
				? [this.actionButton("log-contact", translator.atlasRenderer.logContact)]
				: []),
		);
		this.element.append(actions);
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

	private actionButton(action: string, label: string): HTMLButtonElement {
		const button = this.element.ownerDocument.createElement("button");
		button.type = "button";
		button.dataset.action = action;
		button.setAttribute("aria-label", label);
		button.textContent = label;
		return button;
	}
}
