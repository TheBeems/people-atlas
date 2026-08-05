import { Modal, type App } from "obsidian";
import type { PartnerParentCandidate } from "../domain/partner-parent-confirmation";
import { createTranslator, type Translator } from "../i18n";

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
		private readonly t: Translator = createTranslator("en"),
	) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.textContent = this.t.partnerParentConfirmation.title;
		this.contentEl.classList.add("people-atlas-partner-parent-confirmation");
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const explanation = document.createElement("p");
		explanation.textContent = this.t.partnerParentConfirmation.question({
			parent: this.candidate.parent.name,
			partner: this.candidate.partner.name,
			child: this.candidate.child.name,
		});
		const actions = document.createElement("div");
		actions.className = "people-atlas-partner-parent-confirmation-actions";
		const notNow = document.createElement("button");
		notNow.type = "button";
		notNow.textContent = this.t.partnerParentConfirmation.notNow;
		notNow.setAttribute("aria-label", this.t.partnerParentConfirmation.notNow);
		notNow.addEventListener("click", () => this.close());
		const review = document.createElement("button");
		review.type = "button";
		review.textContent = this.t.partnerParentConfirmation.reviewRelationship;
		review.setAttribute("aria-label", this.t.partnerParentConfirmation.reviewRelationship);
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
