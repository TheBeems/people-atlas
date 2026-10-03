import type { AtlasEdge, AtlasNode, AtlasSnapshot } from "../domain/types";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { birthdayAttention } from "../graph/birthday-attention";
import { relationshipContactCadence } from "../graph/relationship-periods";
import type { Translator } from "../i18n";

interface AttentionAction {
	personId: string;
	filePath: string;
	key: string;
	relationship?: AtlasEdge;
}

export interface AttentionPanelOptions {
	translator: Translator;
	getSnapshot(): AtlasSnapshot;
	getLocalCalendarDay(): string;
	canLogContact(node: AtlasNode): boolean;
	onLogContact(node: AtlasNode, relationship?: AtlasEdge): void;
}

/** Read-only local attention uses only the already permitted snapshot. */
export class AttentionPanel {
	readonly element: HTMLElement;
	private readonly options: AttentionPanelOptions;
	private readonly actions = new WeakMap<HTMLButtonElement, AttentionAction>();
	private readonly win: Window & typeof globalThis;
	private destroyed = false;

	constructor(document: Document, options: AttentionPanelOptions) {
		this.options = options;
		const win = document.defaultView as (Window & typeof globalThis) | null;
		if (!win) throw new Error("AttentionPanel requires an owning window.");
		this.win = win;
		this.element = document.createElement("section");
		this.element.className = "people-atlas-local-attention";
		this.element.addEventListener("click", this.onClick);
	}

	render(): void {
		if (this.destroyed) return;
		const focused = this.element.ownerDocument.activeElement;
		const heldFocus = focused instanceof this.win.HTMLButtonElement && this.element.contains(focused);
		const focusKey = heldFocus ? focused.dataset.attentionAction : undefined;
		this.element.replaceChildren();
		const snapshot = this.options.getSnapshot();
		const today = this.options.getLocalCalendarDay();
		const t = this.options.translator;
		const birthdays = birthdayAttention(snapshot, today);
		const birthdaySection = this.section(t.followUpAttention.birthdays, "birthdays");
		if (!birthdays.length) this.empty(birthdaySection, t.followUpAttention.noBirthdays);
		for (const isToday of [true, false]) {
			const rows = birthdays.filter((row) => row.isToday === isToday);
			if (!rows.length) continue;
			const heading = this.element.ownerDocument.createElement("h4");
			heading.textContent = isToday ? t.followUpAttention.birthdaysToday : t.followUpAttention.birthdaysSoon;
			const list = this.list(heading.textContent);
			for (const row of rows) {
				const item = this.item(
					`${row.person.label} · ${t.formatDateOnly(row.birthdayOn)}${row.age !== undefined ? ` · ${t.followUpAttention.age({ age: row.age })}` : ""}`,
				);
				item.dataset.birthdayPersonId = row.person.id;
				this.logButton(item, row.person, `birthday:${row.person.id}:${row.birthdayOn}`);
				list.append(item);
			}
			birthdaySection.append(heading, list);
		}
		const cadenceSection = this.section(t.followUpAttention.cadence, "cadence");
		const cadence = relationshipContactCadence(snapshot, today);
		if (!cadence.length) this.empty(cadenceSection, t.followUpAttention.noCadence);
		const cadenceList = this.list(t.followUpAttention.cadence);
		for (const row of cadence) {
			const source = snapshot.nodes.find((node) => node.id === row.relationship.sourceId);
			const target = snapshot.nodes.find((node) => node.id === row.relationship.targetId);
			if (!source || !target) continue;
			const state =
				row.state === "overdue"
					? t.atlasRenderer.overdue
					: row.state === "due"
						? t.atlasRenderer.dueToday
						: t.atlasRenderer.upcoming;
			const item = this.item(`${source.label} · ${target.label} · ${state}: ${t.formatDateOnly(row.dueOn)}`);
			item.dataset.cadenceRelationshipId = row.relationship.id;
			const observed = this.element.ownerDocument.createElement("p");
			observed.textContent = t.followUpAttention.observed({ date: t.formatDateOnly(row.lastObservedOn) });
			item.append(observed);
			this.logButton(
				item,
				source,
				`cadence:${row.relationship.id}:${source.id}:${row.lastObservedOn}:${row.dueOn}`,
				row.relationship,
			);
			cadenceList.append(item);
		}
		if (cadenceList.children.length) cadenceSection.append(cadenceList);
		if (heldFocus) {
			const replacement = Array.from(this.element.querySelectorAll<HTMLButtonElement>("[data-attention-action]")).find(
				(candidate) => candidate.dataset.attentionAction === focusKey,
			);
			(replacement ?? this.element.querySelector<HTMLElement>("h3"))?.focus();
		}
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.element.removeEventListener("click", this.onClick);
		this.element.replaceChildren();
		this.element.remove();
	}

	private section(label: string, key: string): HTMLElement {
		const section = this.element.ownerDocument.createElement("section");
		section.dataset.attentionSection = key;
		const heading = this.element.ownerDocument.createElement("h3");
		heading.textContent = label;
		heading.tabIndex = -1;
		section.append(heading);
		this.element.append(section);
		return section;
	}

	private empty(section: HTMLElement, text: string): void {
		const empty = this.element.ownerDocument.createElement("p");
		empty.textContent = text;
		section.append(empty);
	}

	private list(label: string): HTMLUListElement {
		const list = this.element.ownerDocument.createElement("ul");
		list.className = "people-atlas-contact-moment-list";
		list.setAttribute("aria-label", label);
		return list;
	}

	private item(text: string): HTMLLIElement {
		const item = this.element.ownerDocument.createElement("li");
		item.className = "people-atlas-contact-moment-row";
		const description = this.element.ownerDocument.createElement("p");
		description.textContent = text;
		item.append(description);
		return item;
	}

	private logButton(item: HTMLLIElement, person: AtlasNode, key: string, relationship?: AtlasEdge): void {
		if (!isResolvedAtlasPersonNode(person) || !this.options.canLogContact(person)) return;
		const button = this.element.ownerDocument.createElement("button");
		button.type = "button";
		button.textContent = this.options.translator.atlasRenderer.logContact;
		button.setAttribute("aria-label", this.options.translator.followUpAttention.logWith({ person: person.label }));
		button.dataset.attentionAction = key;
		this.actions.set(button, {
			personId: person.id,
			filePath: person.filePath,
			key,
			...(relationship ? { relationship: { ...relationship, types: [...relationship.types] } } : {}),
		});
		item.append(button);
	}

	private readonly onClick = (event: MouseEvent): void => {
		if (this.destroyed || !(event.target instanceof this.win.Element)) return;
		const button = event.target.closest<HTMLButtonElement>("[data-attention-action]");
		const action = button ? this.actions.get(button) : undefined;
		if (!action) return;
		const snapshot = this.options.getSnapshot();
		const person = snapshot.nodes.find((node) => node.id === action.personId && node.filePath === action.filePath);
		if (!isResolvedAtlasPersonNode(person) || !this.options.canLogContact(person)) {
			this.render();
			return;
		}
		const today = this.options.getLocalCalendarDay();
		if (action.relationship) {
			const reviewed = action.relationship;
			const current = relationshipContactCadence(snapshot, today).find(
				(row) =>
					row.relationship.id === reviewed.id &&
					row.relationship.filePath === reviewed.filePath &&
					row.relationship.sourceId === reviewed.sourceId &&
					row.relationship.targetId === reviewed.targetId &&
					`cadence:${row.relationship.id}:${person.id}:${row.lastObservedOn}:${row.dueOn}` === action.key,
			);
			if (current) this.options.onLogContact(person, current.relationship);
			else this.render();
		} else if (
			birthdayAttention(snapshot, today).some((row) => `birthday:${row.person.id}:${row.birthdayOn}` === action.key)
		) {
			this.options.onLogContact(person);
		} else this.render();
	};
}
