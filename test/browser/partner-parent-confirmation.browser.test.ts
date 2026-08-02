import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PartnerParentCandidate } from "../../src/domain/partner-parent-confirmation";
import { PartnerParentConfirmationModal } from "../../src/editor/partner-parent-confirmation-modal";
import "../../styles.css";

const candidate: PartnerParentCandidate = {
	parent: {
		id: "person-alex",
		filePath: "People/Alex.md",
		name: "Alex",
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	},
	partner: {
		id: "person-robin",
		filePath: "People/Robin.md",
		name: "Robin",
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	},
	child: {
		id: "person-sam",
		filePath: "People/Sam.md",
		name: "Sam",
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	},
};

function buttonWithText(content: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(content.querySelectorAll("button")).find((candidate) => candidate.textContent === text);
	if (!button) throw new Error(`No button found for ${text}.`);
	return button;
}

function mount(ownerDocument: Document = document) {
	const onReview = vi.fn();
	const modal = new PartnerParentConfirmationModal({} as App, candidate, onReview);
	const title = ownerDocument.createElement("h2");
	const content = ownerDocument.createElement("div");
	content.style.boxSizing = "border-box";
	content.style.width = "280px";
	ownerDocument.body.append(title, content);
	modal.titleEl = title;
	modal.contentEl = content;
	const close = vi.fn(() => modal.onClose());
	modal.close = close;
	modal.onOpen();
	return { modal, content, close, onReview };
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("partner-ouderbevestiging", () => {
	it("toont hypothese-copy en twee toegankelijke native acties in het owning document zonder horizontale overflow", () => {
		const { content } = mount();
		const review = buttonWithText(content, "Review relationship");
		const notNow = buttonWithText(content, "Not now");

		expect(content.textContent).toContain("Alex heeft partner Robin");
		expect(content.textContent).toContain("Is Robin ook ouder van Sam?");
		expect(review.tagName).toBe("BUTTON");
		expect(review.type).toBe("button");
		expect(notNow.tagName).toBe("BUTTON");
		expect(notNow.type).toBe("button");
		expect(review.getAttribute("aria-label")).toBe("Review relationship");
		expect(notNow.getAttribute("aria-label")).toBe("Not now");
		expect(document.activeElement).toBe(review);
		expect(Array.from(content.querySelectorAll("*")).every((element) => element.ownerDocument === document)).toBe(true);
		expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
	});

	it("roept alleen Review relationship eenmaal aan; Not now, direct close en Escape openen niets", () => {
		let mounted = mount();
		buttonWithText(mounted.content, "Not now").click();
		expect(mounted.close).toHaveBeenCalledOnce();
		expect(mounted.onReview).not.toHaveBeenCalled();

		mounted = mount();
		mounted.modal.close();
		expect(mounted.close).toHaveBeenCalledOnce();
		expect(mounted.onReview).not.toHaveBeenCalled();

		mounted = mount();
		mounted.content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(mounted.close).toHaveBeenCalledOnce();
		expect(mounted.onReview).not.toHaveBeenCalled();

		mounted = mount();
		buttonWithText(mounted.content, "Review relationship").click();
		expect(mounted.close).toHaveBeenCalledOnce();
		expect(mounted.onReview).toHaveBeenCalledOnce();
	});

	it("houdt controls en focus in een pop-out owning document", () => {
		const frame = document.createElement("iframe");
		document.body.append(frame);
		const frameDocument = frame.contentDocument;
		if (!frameDocument) throw new Error("Expected an iframe document.");
		const { content } = mount(frameDocument);
		const review = buttonWithText(content, "Review relationship");
		const notNow = buttonWithText(content, "Not now");

		expect(content.ownerDocument).toBe(frameDocument);
		expect(frameDocument.activeElement).toBe(review);
		notNow.focus();
		expect(frameDocument.activeElement).toBe(notNow);
	});
});
