import type { AtlasNode } from "../domain/types";
import type { Translator } from "../i18n";
import { relationshipActionAccessibleName, type IncidentRelationshipRow } from "./relationship-rows";

type RelationshipAction = "open" | "edit";

export interface RelationshipDetailsPanelOptions {
	translator: Translator;
	onOpenRelationship?: unknown;
	canOpenRelationship?: (edge: IncidentRelationshipRow["edge"]) => boolean;
	onEditRelationship?: unknown;
	canEditRelationship?: (edge: IncidentRelationshipRow["edge"]) => boolean;
}

/** Owns relationship-group/row rendering and the action identity registry for one details surface. */
export class RelationshipDetailsPanel {
	readonly element: HTMLDivElement;
	private readonly options: RelationshipDetailsPanelOptions;
	private readonly edgesByButton = new WeakMap<HTMLButtonElement, IncidentRelationshipRow["edge"]>();
	private destroyed = false;

	constructor(document: Document, options: RelationshipDetailsPanelOptions) {
		this.options = options;
		this.element = document.createElement("div");
		this.element.className = "people-atlas-connection-groups";
	}

	render(rows: IncidentRelationshipRow[], selected: AtlasNode, headingLevel: 3 | 4): HTMLDivElement {
		if (this.destroyed) return this.element;
		this.element.replaceChildren();
		const relationshipRows = rows.filter((row) => !row.edge.inferred);
		const linkedPeopleRows = rows.filter((row) => row.edge.inferred);
		if (relationshipRows.length > 0) {
			this.element.append(this.renderGroup("relationships", relationshipRows, selected, headingLevel));
		}
		if (linkedPeopleRows.length > 0) {
			this.element.append(this.renderGroup("linked-people", linkedPeopleRows, selected, headingLevel));
		}
		return this.element;
	}

	registerAction(button: HTMLButtonElement, edge: IncidentRelationshipRow["edge"]): void {
		this.edgesByButton.set(button, edge);
	}

	getEdge(button: HTMLButtonElement): IncidentRelationshipRow["edge"] | undefined {
		return this.edgesByButton.get(button);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.element.replaceChildren();
		this.element.remove();
	}

	private renderGroup(
		label: "relationships" | "linked-people",
		rows: IncidentRelationshipRow[],
		selected: AtlasNode,
		headingLevel: 3 | 4,
	): HTMLElement {
		const document = this.element.ownerDocument;
		const group = document.createElement("section");
		group.className = "people-atlas-connection-group";
		group.dataset.connectionGroup = label;
		const heading = document.createElement(`h${headingLevel}`);
		const translatedLabel =
			label === "relationships"
				? this.options.translator.atlasRenderer.relationships
				: this.options.translator.atlasRenderer.linkedPeople;
		heading.textContent = translatedLabel;
		group.append(heading, this.renderRows(rows, selected, translatedLabel));
		return group;
	}

	private renderRows(rows: IncidentRelationshipRow[], selected: AtlasNode, groupLabel: string): HTMLUListElement {
		const document = this.element.ownerDocument;
		const relationships = document.createElement("ul");
		relationships.className = "people-atlas-relationship-list";
		relationships.setAttribute(
			"aria-label",
			this.options.translator.atlasRenderer.relationshipListFor({ group: groupLabel, name: selected.label }),
		);
		for (const row of rows) {
			const item = document.createElement("li");
			item.dataset.edgeId = row.edge.id;
			if (row.edge.filePath) item.dataset.relationshipPath = row.edge.filePath;
			const description = document.createElement("span");
			description.textContent = row.description;
			item.append(description);

			if (row.noteBacked) {
				const actions = document.createElement("div");
				actions.className = "people-atlas-semantic-actions";
				if (this.options.onOpenRelationship && this.options.canOpenRelationship?.(row.edge) === true) {
					actions.append(this.createRelationshipActionButton("open", row));
				}
				if (this.options.onEditRelationship && this.options.canEditRelationship?.(row.edge) === true) {
					actions.append(this.createRelationshipActionButton("edit", row));
				}
				if (actions.childElementCount > 0) item.append(actions);
			}
			relationships.append(item);
		}
		return relationships;
	}

	private createRelationshipActionButton(action: RelationshipAction, row: IncidentRelationshipRow): HTMLButtonElement {
		const document = this.element.ownerDocument;
		const label =
			action === "open"
				? this.options.translator.atlasRenderer.openRelationshipNote
				: this.options.translator.atlasRenderer.editRelationship;
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = label;
		button.setAttribute("aria-label", relationshipActionAccessibleName(action, row, this.options.translator));
		button.dataset.relationshipAction = action;
		button.dataset.edgeId = row.edge.id;
		if (row.edge.filePath) button.dataset.relationshipPath = row.edge.filePath;
		this.registerAction(button, row.edge);
		return button;
	}
}
