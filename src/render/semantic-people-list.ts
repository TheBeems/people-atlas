import type { AtlasNode, AtlasSnapshot, NodeId } from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { Translator } from "../i18n";

export interface SemanticPeopleListOptions {
	panelLabel: string;
	peopleLabel: string;
	noPeopleLabel: string;
	translator: Translator;
	getSnapshot: () => AtlasSnapshot;
	getSelectedId: () => NodeId | undefined;
	getFocusedId: () => NodeId | undefined;
	setFocusedId: (id: NodeId | undefined) => void;
	getSummary: (snapshot: AtlasSnapshot) => string;
	onSelectNode: (node: AtlasNode | undefined) => void;
	onOpenNode: (node: AtlasNode) => void;
	onRenderDetails: () => void;
}

/** Owns semantic people-list rendering, selection provenance, roving focus and keyboard lifecycle. */
export class SemanticPeopleList {
	readonly element: HTMLElement;
	readonly summary: HTMLParagraphElement;
	readonly emptyMessage: HTMLParagraphElement;
	readonly peopleList: HTMLUListElement;
	private readonly options: SemanticPeopleListOptions;
	private readonly win: Window & typeof globalThis;
	private attached = false;
	private destroyed = false;

	constructor(document: Document, options: SemanticPeopleListOptions) {
		this.options = options;
		const owningWindow = document.defaultView as (Window & typeof globalThis) | null;
		if (!owningWindow) throw new Error("SemanticPeopleList requires a document with an owning window.");
		this.win = owningWindow;
		this.element = document.createElement("section");
		this.element.className = "people-atlas-semantic-panel";
		this.element.setAttribute("aria-label", options.panelLabel);
		this.element.hidden = true;

		this.summary = document.createElement("p");
		this.summary.className = "people-atlas-semantic-summary";
		this.summary.setAttribute("role", "status");
		this.summary.setAttribute("aria-live", "polite");

		this.emptyMessage = document.createElement("p");
		this.emptyMessage.className = "people-atlas-empty-message";
		this.emptyMessage.textContent = options.noPeopleLabel;
		this.emptyMessage.hidden = true;

		this.peopleList = document.createElement("ul");
		this.peopleList.className = "people-atlas-people-list";
		this.peopleList.setAttribute("aria-label", options.peopleLabel);
		this.element.append(this.summary, this.emptyMessage, this.peopleList);
	}

	attach(): void {
		if (this.attached || this.destroyed) return;
		this.attached = true;
		this.peopleList.addEventListener("click", this.onPeopleListClick);
		this.peopleList.addEventListener("keydown", this.onPeopleListKeyDown);
		this.peopleList.addEventListener("focusin", this.onPeopleListFocusIn);
	}

	update(): void {
		if (this.destroyed) return;
		const snapshot = this.options.getSnapshot();
		this.summary.textContent = this.options.getSummary(snapshot);
		this.emptyMessage.hidden = snapshot.nodes.length > 0;
		this.peopleList.hidden = snapshot.nodes.length === 0;
		this.peopleList.replaceChildren();

		const selectedId = this.options.getSelectedId();
		const focusedId = this.options.getFocusedId();
		const rovingId =
			selectedId && this.nodeById(selectedId)
				? selectedId
				: focusedId && this.nodeById(focusedId)
					? focusedId
					: snapshot.nodes[0]?.id;
		this.options.setFocusedId(rovingId);

		for (const node of snapshot.nodes) {
			const item = this.peopleList.ownerDocument.createElement("li");
			const button = this.peopleList.ownerDocument.createElement("button");
			button.type = "button";
			button.className = "people-atlas-person-button";
			button.dataset.nodeId = node.id;
			button.tabIndex = node.id === rovingId ? 0 : -1;
			button.setAttribute("aria-pressed", String(node.id === selectedId));
			button.setAttribute("aria-label", personAccessibleName(node, this.options.translator));
			const label = this.peopleList.ownerDocument.createElement("span");
			label.textContent = node.label;
			button.append(label);
			const metadata = personMetadata(node, this.options.translator);
			if (metadata) {
				const meta = this.peopleList.ownerDocument.createElement("small");
				meta.textContent = metadata;
				button.append(meta);
			}
			item.append(button);
			this.peopleList.append(item);
		}
		this.options.onRenderDetails();
	}

	personButtonFrom(target: EventTarget | Element | null): HTMLButtonElement | undefined {
		if (!(target instanceof this.win.Element)) return undefined;
		return target.closest<HTMLButtonElement>(".people-atlas-person-button") ?? undefined;
	}

	focusPersonButton(nodeId: NodeId): void {
		const button = Array.from(this.peopleList.querySelectorAll<HTMLButtonElement>(".people-atlas-person-button")).find(
			(candidate) => candidate.dataset.nodeId === nodeId,
		);
		button?.focus();
	}

	contains(target: Node): boolean {
		return this.element.contains(target);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.peopleList.removeEventListener("click", this.onPeopleListClick);
		this.peopleList.removeEventListener("keydown", this.onPeopleListKeyDown);
		this.peopleList.removeEventListener("focusin", this.onPeopleListFocusIn);
		this.element.replaceChildren();
		this.element.remove();
	}

	private nodeById(nodeId: NodeId | string): AtlasNode | undefined {
		return this.options.getSnapshot().nodes.find((node) => node.id === nodeId);
	}

	private readonly onPeopleListClick = (event: MouseEvent): void => {
		const button = this.personButtonFrom(event.target);
		const node = button?.dataset.nodeId ? this.nodeById(button.dataset.nodeId) : undefined;
		if (!node) return;
		this.options.onSelectNode(node);
		this.focusPersonButton(node.id);
	};

	private readonly onPeopleListFocusIn = (event: FocusEvent): void => {
		const button = this.personButtonFrom(event.target);
		if (button?.dataset.nodeId && this.nodeById(button.dataset.nodeId)) {
			this.options.setFocusedId(button.dataset.nodeId);
		}
	};

	private readonly onPeopleListKeyDown = (event: KeyboardEvent): void => {
		const button = this.personButtonFrom(event.target);
		if (!button?.dataset.nodeId) return;
		const snapshot = this.options.getSnapshot();
		const currentIndex = snapshot.nodes.findIndex((node) => node.id === button.dataset.nodeId);
		if (currentIndex < 0) return;

		let nextIndex: number | undefined;
		if (event.key === "ArrowDown" && currentIndex < snapshot.nodes.length - 1) nextIndex = currentIndex + 1;
		else if (event.key === "ArrowUp" && currentIndex > 0) nextIndex = currentIndex - 1;
		else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = snapshot.nodes.length - 1;

		if (nextIndex !== undefined) {
			event.preventDefault();
			const node = snapshot.nodes[nextIndex];
			if (!node) return;
			this.options.onSelectNode(node);
			this.focusPersonButton(node.id);
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const node = snapshot.nodes[currentIndex];
			if (isResolvedAtlasPersonNode(node)) this.options.onOpenNode(node);
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			const focusedId = snapshot.nodes[currentIndex]?.id;
			this.options.onSelectNode(undefined);
			if (focusedId) this.focusPersonButton(focusedId);
		}
	};
}

function personMetadata(node: AtlasNode, translator: Translator): string {
	if (isAmbiguousAtlasNode(node)) return translator.atlasRenderer.ambiguousPerson;
	if (node.kind === "ghost") return translator.atlasRenderer.unresolvedPerson;
	return node.organisations.join(", ");
}

function personAccessibleName(node: AtlasNode, translator: Translator): string {
	if (isAmbiguousAtlasNode(node)) return `${node.label}, ${translator.atlasRenderer.ambiguousPersonListLabel}`;
	if (node.kind === "ghost") return `${node.label}, ${translator.atlasRenderer.unresolvedPersonListLabel}`;
	return node.organisations.length > 0 ? `${node.label}, ${node.organisations.join(", ")}` : node.label;
}
