import type { ContactMomentSummary } from "../domain/types";
import type { Translator } from "../i18n";
import { groupContactMomentFollowUps, type ContactMomentFollowUpRow } from "./contact-moment-presentation";

export interface FollowUpPanelOptions {
	panelLabel: string;
	heading: string;
	translator: Translator;
	getContactMoments: () => readonly ContactMomentSummary[];
	getLocalCalendarDay: () => string;
	getHiddenCount: () => number;
	renderRow: (row: ContactMomentFollowUpRow, peers: readonly ContactMomentSummary[]) => HTMLLIElement;
}

/** Owns Follow-ups mode grouping, summary, empty state and group/list DOM. */
export class FollowUpPanel {
	readonly element: HTMLElement;
	readonly heading: HTMLHeadingElement;
	readonly summary: HTMLParagraphElement;
	readonly content: HTMLDivElement;
	private readonly options: FollowUpPanelOptions;
	private destroyed = false;

	constructor(document: Document, options: FollowUpPanelOptions) {
		this.options = options;
		this.element = document.createElement("section");
		this.element.className = "people-atlas-follow-ups-panel";
		this.element.setAttribute("aria-label", options.panelLabel);
		this.element.hidden = true;

		this.heading = document.createElement("h2");
		this.heading.textContent = options.heading;
		this.heading.tabIndex = -1;
		this.heading.dataset.followUpsHeading = "true";

		this.summary = document.createElement("p");
		this.summary.className = "people-atlas-follow-ups-summary";
		this.summary.setAttribute("role", "status");
		this.summary.setAttribute("aria-live", "polite");

		this.content = document.createElement("div");
		this.content.className = "people-atlas-follow-ups-content";
		this.element.append(this.heading, this.summary, this.content);
	}

	render(): void {
		if (this.destroyed) return;
		const groups = groupContactMomentFollowUps(this.options.getContactMoments(), this.options.getLocalCalendarDay());
		const rows = [...groups.overdue, ...groups.dueToday, ...groups.upcoming];
		const accessiblePeers = rows.map((row) => row.moment);
		const hiddenMomentCount = this.options.getHiddenCount();
		const translator = this.options.translator;
		this.summary.textContent = translator.atlasRenderer.followUpsSummary({
			openCount: translator.formatInteger(rows.length),
			openCountValue: rows.length,
			hiddenCount: translator.formatInteger(hiddenMomentCount),
			hiddenCountValue: hiddenMomentCount,
		});
		this.content.replaceChildren();
		if (rows.length === 0) {
			const empty = this.content.ownerDocument.createElement("p");
			empty.className = "people-atlas-empty-message";
			empty.textContent = translator.atlasRenderer.noOpenFollowUps;
			this.content.append(empty);
			return;
		}

		const definitions: ReadonlyArray<{
			label: string;
			key: string;
			rows: ContactMomentFollowUpRow[];
		}> = [
			{ label: translator.atlasRenderer.overdue, key: "overdue", rows: groups.overdue },
			{ label: translator.atlasRenderer.dueToday, key: "due-today", rows: groups.dueToday },
			{ label: translator.atlasRenderer.upcoming, key: "upcoming", rows: groups.upcoming },
		];
		for (const definition of definitions) {
			if (definition.rows.length === 0) continue;
			const section = this.content.ownerDocument.createElement("section");
			section.className = "people-atlas-follow-up-group";
			section.dataset.followUpGroup = definition.key;
			const heading = this.content.ownerDocument.createElement("h3");
			heading.textContent = definition.label;
			const list = this.content.ownerDocument.createElement("ul");
			list.className = "people-atlas-follow-up-list";
			list.setAttribute("aria-label", definition.label);
			for (const row of definition.rows) list.append(this.options.renderRow(row, accessiblePeers));
			section.append(heading, list);
			this.content.append(section);
		}
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.element.replaceChildren();
		this.element.remove();
	}
}
