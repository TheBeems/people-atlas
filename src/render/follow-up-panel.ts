import type { ContactMomentSummary } from "../domain/types";
import type { Translator } from "../i18n";
import {
	filterContactMomentFollowUps,
	groupContactMomentFollowUps,
	type ContactMomentFollowUpFilter,
	type ContactMomentFollowUpRow,
} from "./contact-moment-presentation";

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
	readonly filterSelect: HTMLSelectElement;
	private readonly options: FollowUpPanelOptions;
	private destroyed = false;
	private filter: ContactMomentFollowUpFilter = "open";

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
		const filterLabel = document.createElement("label");
		filterLabel.className = "people-atlas-population-control";
		filterLabel.textContent = options.translator.followUpAttention.filter;
		this.filterSelect = document.createElement("select");
		this.filterSelect.setAttribute("aria-label", options.translator.followUpAttention.filter);
		const filters: Array<[ContactMomentFollowUpFilter, string]> = [
			["open", options.translator.followUpAttention.open],
			["done", options.translator.followUpAttention.completed],
			["dismissed", options.translator.followUpAttention.dismissed],
			["all", options.translator.followUpAttention.all],
		];
		for (const [value, text] of filters) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = text;
			this.filterSelect.append(option);
		}
		filterLabel.append(this.filterSelect);
		this.filterSelect.addEventListener("change", this.onFilterChange);

		this.summary = document.createElement("p");
		this.summary.className = "people-atlas-follow-ups-summary";
		this.summary.setAttribute("role", "status");
		this.summary.setAttribute("aria-live", "polite");

		this.content = document.createElement("div");
		this.content.className = "people-atlas-follow-ups-content";
		this.element.append(this.heading, filterLabel, this.summary, this.content);
	}

	getMomentOrder(): string[] {
		return Array.from(this.content.querySelectorAll<HTMLElement>("[data-contact-moment-row]")).map(
			(row) => row.dataset.contactMomentRow ?? "",
		);
	}

	private visibleRows(): ContactMomentFollowUpRow[] {
		if (this.filter !== "open") return filterContactMomentFollowUps(this.options.getContactMoments(), this.filter);
		const groups = groupContactMomentFollowUps(this.options.getContactMoments(), this.options.getLocalCalendarDay());
		return [...groups.overdue, ...groups.dueToday, ...groups.upcoming];
	}

	render(): void {
		if (this.destroyed) return;
		const groups = groupContactMomentFollowUps(this.options.getContactMoments(), this.options.getLocalCalendarDay());
		const rows = this.visibleRows();
		const accessiblePeers = rows.map((row) => row.moment);
		const hiddenMomentCount = this.options.getHiddenCount();
		const translator = this.options.translator;
		const statusLabels = {
			open: translator.followUpAttention.open,
			done: translator.followUpAttention.completed,
			dismissed: translator.followUpAttention.dismissed,
			all: translator.followUpAttention.all,
		};
		this.summary.textContent =
			this.filter === "open"
				? translator.atlasRenderer.followUpsSummary({
						openCount: translator.formatInteger(rows.length),
						openCountValue: rows.length,
						hiddenCount: translator.formatInteger(hiddenMomentCount),
						hiddenCountValue: hiddenMomentCount,
					})
				: translator.followUpAttention.filteredSummary({
						count: translator.formatInteger(rows.length),
						status: statusLabels[this.filter],
						hidden: hiddenMomentCount > 0 ? translator.formatInteger(hiddenMomentCount) : "",
					});
		this.content.replaceChildren();
		if (rows.length === 0) {
			const empty = this.content.ownerDocument.createElement("p");
			empty.className = "people-atlas-empty-message";
			empty.textContent =
				this.filter === "open" ? translator.atlasRenderer.noOpenFollowUps : translator.followUpAttention.noMatches;
			this.content.append(empty);
			return;
		}

		const definitions: Array<{
			label: string;
			key: string;
			rows: ContactMomentFollowUpRow[];
		}> = [
			{
				label: translator.atlasRenderer.overdue,
				key: "overdue",
				rows: this.filter === "open" || this.filter === "all" ? groups.overdue : [],
			},
			{
				label: translator.atlasRenderer.dueToday,
				key: "due-today",
				rows: this.filter === "open" || this.filter === "all" ? groups.dueToday : [],
			},
			{
				label: translator.atlasRenderer.upcoming,
				key: "upcoming",
				rows: this.filter === "open" || this.filter === "all" ? groups.upcoming : [],
			},
			{
				label: translator.followUpAttention.completed,
				key: "done",
				rows: rows.filter((row) => row.reviewedFollowUpStatus === "done"),
			},
			{
				label: translator.followUpAttention.dismissed,
				key: "dismissed",
				rows: rows.filter((row) => row.reviewedFollowUpStatus === "dismissed"),
			},
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
		this.filterSelect.removeEventListener("change", this.onFilterChange);
		this.element.replaceChildren();
		this.element.remove();
	}

	private readonly onFilterChange = (): void => {
		const value = this.filterSelect.value;
		this.filter = value === "done" || value === "dismissed" || value === "all" ? value : "open";
		this.render();
	};
}
