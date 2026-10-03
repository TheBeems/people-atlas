import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { AtlasEdge, AtlasSnapshot, NodeId } from "../domain/types";
import { commonContacts, shortestPath } from "../graph/network-insight";
import type { Translator } from "../i18n";

/** Accessible read-only network results for exactly the population supplied by the view. */
export class NetworkInsightPanel {
	readonly element: HTMLDetailsElement;
	private readonly counterpart: HTMLSelectElement;
	private readonly results: HTMLDivElement;
	private snapshot: AtlasSnapshot | undefined;
	private selectedId: NodeId | undefined;
	private destroyed = false;

	constructor(
		document: Document,
		private readonly t: Translator,
	) {
		this.element = document.createElement("details");
		this.element.className = "people-atlas-network-insight";
		const summary = document.createElement("summary");
		summary.textContent = t.networkInsight.heading;
		const label = document.createElement("label");
		label.textContent = t.networkInsight.counterpart;
		this.counterpart = document.createElement("select");
		this.counterpart.setAttribute("aria-label", t.networkInsight.counterpart);
		this.counterpart.dataset.networkCounterpart = "true";
		label.append(this.counterpart);
		const explanation = document.createElement("p");
		explanation.textContent = t.networkInsight.populationDescription;
		this.results = document.createElement("div");
		this.results.setAttribute("aria-live", "polite");
		this.results.dataset.networkResults = "true";
		this.element.append(summary, explanation, label, this.results);
		this.counterpart.addEventListener("change", this.onCounterpartChanged);
	}

	update(snapshot: AtlasSnapshot, selectedId: NodeId | undefined): void {
		if (this.destroyed) return;
		this.snapshot = snapshot;
		this.selectedId = selectedId;
		const previous = this.counterpart.value;
		this.counterpart.replaceChildren();
		const placeholder = this.element.ownerDocument.createElement("option");
		placeholder.value = "";
		placeholder.textContent = this.t.networkInsight.chooseCounterpart;
		this.counterpart.append(placeholder);
		const counts = new Map<NodeId, number>();
		for (const node of snapshot.nodes) counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
		for (const node of [...snapshot.nodes]
			.filter((candidate) => isResolvedAtlasPersonNode(candidate) && counts.get(candidate.id) === 1)
			.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))) {
			const option = this.element.ownerDocument.createElement("option");
			option.value = node.id;
			option.textContent = `${node.label} — ${node.filePath}`;
			this.counterpart.append(option);
		}
		if (Array.from(this.counterpart.options).some((option) => option.value === previous))
			this.counterpart.value = previous;
		this.counterpart.disabled =
			!selectedId ||
			!snapshot.nodes.some(
				(node) => node.id === selectedId && isResolvedAtlasPersonNode(node) && counts.get(node.id) === 1,
			);
		this.renderResults();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.counterpart.removeEventListener("change", this.onCounterpartChanged);
		this.element.remove();
	}

	private readonly onCounterpartChanged = (): void => this.renderResults();

	private renderResults(): void {
		this.results.replaceChildren();
		const snapshot = this.snapshot;
		const counterpartId = this.counterpart.value;
		if (!snapshot || this.counterpart.disabled || !this.selectedId || !counterpartId) {
			this.results.textContent = this.t.networkInsight.choosePeople;
			return;
		}
		const path = shortestPath(snapshot, this.selectedId, counterpartId);
		const pathHeading = this.element.ownerDocument.createElement("h3");
		pathHeading.textContent = this.t.networkInsight.shortestPath;
		this.results.append(pathHeading);
		if (path.status !== "found") {
			const message = this.element.ownerDocument.createElement("p");
			message.textContent =
				path.status === "same-person"
					? this.t.networkInsight.samePerson
					: path.status === "disconnected"
						? this.t.networkInsight.disconnected
						: this.t.networkInsight.unavailable;
			this.results.append(message);
		} else {
			const list = this.element.ownerDocument.createElement("ol");
			for (const step of path.steps) {
				const item = this.element.ownerDocument.createElement("li");
				item.textContent = this.t.networkInsight.pathStep({
					first: step.from.label,
					second: step.to.label,
					sources: this.sources(step.edges),
				});
				list.append(item);
			}
			this.results.append(list);
		}
		const common = commonContacts(snapshot, this.selectedId, counterpartId);
		const commonHeading = this.element.ownerDocument.createElement("h3");
		commonHeading.textContent = this.t.networkInsight.commonContacts;
		this.results.append(commonHeading);
		if (common.contacts.length === 0) {
			const message = this.element.ownerDocument.createElement("p");
			message.textContent =
				common.status === "invalid-person" ? this.t.networkInsight.unavailable : this.t.networkInsight.noCommonContacts;
			this.results.append(message);
		} else {
			const list = this.element.ownerDocument.createElement("ul");
			for (const contact of common.contacts) {
				const item = this.element.ownerDocument.createElement("li");
				item.dataset.networkCommonPersonId = contact.person.id;
				item.textContent = this.t.networkInsight.commonContact({
					person: contact.person.label,
					firstSources: this.sources(contact.firstEdges),
					secondSources: this.sources(contact.secondEdges),
				});
				list.append(item);
			}
			this.results.append(list);
		}
	}

	private sources(edges: AtlasEdge[]): string {
		return edges
			.map((edge) =>
				edge.inferred
					? this.t.atlasRenderer.linkedPeople
					: `${this.t.atlasRenderer.relationships}${edge.types.length ? ` (${edge.types.join(", ")})` : ""}`,
			)
			.join("; ");
	}
}
