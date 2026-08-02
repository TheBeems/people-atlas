import { Modal, type App } from "obsidian";
import type { PartnerParentCandidate } from "../domain/partner-parent-confirmation";

export class PartnerParentConfirmationModal extends Modal {
	private readonly onKeydown = (event: KeyboardEvent): void => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		this.close();
	};

	constructor(
		app: App,
		private readonly candidate: PartnerParentCandidate,
		private readonly onReview: () => void,
	) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.textContent = "Partner als ouder beoordelen";
		this.contentEl.classList.add("people-atlas-partner-parent-confirmation");
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const explanation = document.createElement("p");
		explanation.textContent = `${this.candidate.parent.name} heeft partner ${this.candidate.partner.name}. Is ${this.candidate.partner.name} ook ouder van ${this.candidate.child.name}?`;
		const actions = document.createElement("div");
		actions.className = "people-atlas-partner-parent-confirmation-actions";
		const notNow = document.createElement("button");
		notNow.type = "button";
		notNow.textContent = "Not now";
		notNow.setAttribute("aria-label", "Not now");
		notNow.addEventListener("click", () => this.close());
		const review = document.createElement("button");
		review.type = "button";
		review.textContent = "Review relationship";
		review.setAttribute("aria-label", "Review relationship");
		review.className = "mod-cta";
		review.addEventListener("click", () => {
			this.close();
			this.onReview();
		});
		actions.append(notNow, review);
		this.contentEl.append(explanation, actions);
		this.contentEl.addEventListener("keydown", this.onKeydown);
		review.focus({ preventScroll: true });
	}

	override onClose(): void {
		this.contentEl.removeEventListener("keydown", this.onKeydown);
		this.contentEl.replaceChildren();
		this.contentEl.classList.remove("people-atlas-partner-parent-confirmation");
	}
}
