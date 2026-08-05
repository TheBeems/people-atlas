import type { App, TFile } from "obsidian";
import { TFile as StubTFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTranslator, type Translator } from "../../src/i18n";
import type { PersonRecord, RelationshipRecord } from "../../src/domain/types";
import { ContactMomentModal, type ContactMomentModalMode } from "../../src/editor/contact-moment-modal";
import type { ContactMomentFormContext } from "../../src/editor/contact-moment-form";
import type { AtlasMutationService } from "../../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const bob: PersonRecord = {
	id: "person-bob",
	filePath: "People/Bob.md",
	name: "Bob",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const relationship: RelationshipRecord = {
	id: "relationship-alice-bob",
	filePath: "People/Relationships/Alice - Bob.md",
	from: {
		raw: "[[People/Alice]]",
		target: "People/Alice",
		resolvedPath: alice.filePath,
	},
	to: {
		raw: "[[People/Bob]]",
		target: "People/Bob",
		resolvedPath: bob.filePath,
	},
	types: ["friend"],
};

const context: ContactMomentFormContext = {
	people: [alice, bob],
	relationships: [relationship],
	resolveLink: (target) => {
		if (target === "People/Alice") return alice.filePath;
		if (target === "People/Bob") return bob.filePath;
		return undefined;
	},
};

interface MountedContactMomentModal {
	modal: ContactMomentModal;
	content: HTMLElement;
	form: HTMLFormElement;
	createContactMoment: ReturnType<typeof vi.fn>;
	updateContactMoment: ReturnType<typeof vi.fn>;
	retryContactMomentRelationship: ReturnType<typeof vi.fn>;
	openFile: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
}

function mountedFile(path: string): TFile {
	const file = new StubTFile();
	file.path = path;
	return file;
}

function mountModal(
	options: {
		mode?: ContactMomentModalMode;
		context?: ContactMomentFormContext;
		createContactMoment?: ReturnType<typeof vi.fn>;
		updateContactMoment?: ReturnType<typeof vi.fn>;
		retryContactMomentRelationship?: ReturnType<typeof vi.fn>;
		translator?: Translator;
	} = {},
): MountedContactMomentModal {
	const createdFile = mountedFile("People/Contact moments/2026-07-30 - Alice - 12345678.md");
	const createContactMoment =
		options.createContactMoment ??
		vi.fn(async () => ({
			status: "success" as const,
			file: createdFile,
			created: true,
			relationship: {
				status: "not-requested" as const,
				message: "Linked relationship last-contact advancement was not requested.",
			},
		}));
	const updateContactMoment = options.updateContactMoment ?? vi.fn();
	const retryContactMomentRelationship =
		options.retryContactMomentRelationship ??
		vi.fn(async () => ({
			status: "success" as const,
			relationship: {
				status: "advanced" as const,
				relationshipPath: relationship.filePath,
				lastContact: "2026-07-30",
				message: "The linked relationship last contact was set to 2026-07-30.",
			},
		}));
	const openFile = vi.fn(async () => undefined);
	const app = {
		workspace: {
			getLeaf: () => ({ openFile }),
		},
	} as unknown as App;
	const ContactMomentModalWithTranslator = ContactMomentModal as unknown as new (
		app: App,
		mode: ContactMomentModalMode,
		context: ContactMomentFormContext,
		mutations: AtlasMutationService,
		getSettings: () => typeof DEFAULT_SETTINGS,
		afterClose?: () => void,
		getCurrentContext?: () => ContactMomentFormContext,
		translator?: Translator,
	) => ContactMomentModal;
	const modal = new ContactMomentModalWithTranslator(
		app,
		options.mode ?? {
			kind: "create",
			prefilledPersonPath: alice.filePath,
			occurredOn: "2026-07-30",
			contactMomentId: "contact-moment-12345678",
		},
		options.context ?? context,
		{
			createContactMoment,
			updateContactMoment,
			retryContactMomentRelationship,
		} as unknown as AtlasMutationService,
		() => structuredClone(DEFAULT_SETTINGS),
		undefined,
		undefined,
		options.translator,
	);
	const title = document.createElement("h2");
	const content = document.createElement("div");
	document.body.append(title, content);
	modal.titleEl = title;
	modal.contentEl = content;
	const close = vi.fn(() => modal.onClose());
	modal.close = close;
	modal.onOpen();
	const form = content.querySelector<HTMLFormElement>("form");
	if (!form) throw new Error("Contact-moment form was not mounted.");
	return {
		modal,
		content,
		form,
		createContactMoment,
		updateContactMoment,
		retryContactMomentRelationship,
		openFile,
		close,
	};
}

function selectForLabel(content: HTMLElement, text: string): HTMLSelectElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === text);
	const select = label?.htmlFor ? content.querySelector<HTMLSelectElement>(`#${label.htmlFor}`) : null;
	if (!select) throw new Error(`No select found for ${text}.`);
	return select;
}

function inputForLabel(content: HTMLElement, text: string): HTMLInputElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === text);
	const input = label?.htmlFor ? content.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
	if (!input) throw new Error(`No input found for ${text}.`);
	return input;
}

function buttonWithText(content: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(content.querySelectorAll("button")).find((candidate) => candidate.textContent === text);
	if (!button) throw new Error(`No button found for ${text}.`);
	return button;
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("contact-moment modal", () => {
	it("localizes fixed contact-moment-modal and accessible form text without changing stored values", () => {
		const mounted = mountModal({ translator: createTranslator("nl-NL") });

		expect(mounted.modal.titleEl.textContent).toBe("Contactmoment vastleggen");
		expect(Array.from(mounted.content.querySelectorAll("legend"), (item) => item.textContent)).toEqual([
			"Personen",
			"Contactmoment",
			"Opvolging",
		]);
		expect(selectForLabel(mounted.content, "Relatie").value).toBe("");
		expect(inputForLabel(mounted.content, "Datum contactmoment").value).toBe("2026-07-30");
		expect(selectForLabel(mounted.content, "Personen").selectedOptions[0]?.value).toBe(alice.filePath);
		expect(
			Array.from(selectForLabel(mounted.content, "Status opvolging").options, ({ value, textContent }) => ({
				value,
				textContent,
			})),
		).toEqual([
			{ value: "", textContent: "Niet ingesteld" },
			{ value: "open", textContent: "Open" },
			{ value: "done", textContent: "Afgerond" },
			{ value: "dismissed", textContent: "Afgewezen" },
		]);
		expect(buttonWithText(mounted.content, "Annuleren")).toBeInstanceOf(HTMLButtonElement);
		expect(buttonWithText(mounted.content, "Opslaan")).toBeInstanceOf(HTMLButtonElement);
	});

	it("uses explicit accessible labels, focuses people and keeps advancement unchecked on every open", () => {
		const first = mountModal();
		const firstPeople = selectForLabel(first.content, "People");
		const firstRelationship = selectForLabel(first.content, "Relationship");
		const firstAdvance = inputForLabel(first.content, "Advance linked relationship's last contact to this date");

		expect(document.activeElement).toBe(firstPeople);
		expect(Array.from(firstPeople.selectedOptions, (option) => option.value)).toEqual([alice.filePath]);
		expect(firstAdvance.checked).toBe(false);
		expect(firstAdvance.parentElement?.hidden).toBe(true);

		firstRelationship.value = relationship.filePath;
		firstRelationship.dispatchEvent(new Event("change", { bubbles: true }));
		expect(firstAdvance.parentElement?.hidden).toBe(false);
		expect(firstAdvance.checked).toBe(false);

		first.modal.onClose();
		const second = mountModal();
		const secondRelationship = selectForLabel(second.content, "Relationship");
		const secondAdvance = inputForLabel(second.content, "Advance linked relationship's last contact to this date");
		secondRelationship.value = relationship.filePath;
		secondRelationship.dispatchEvent(new Event("change", { bubbles: true }));
		expect(secondAdvance.checked).toBe(false);
	});

	it("cancels without invoking either note mutation", () => {
		const mounted = mountModal();

		buttonWithText(mounted.content, "Cancel").click();

		expect(mounted.close).toHaveBeenCalledOnce();
		expect(mounted.createContactMoment).not.toHaveBeenCalled();
		expect(mounted.updateContactMoment).not.toHaveBeenCalled();
		expect(mounted.retryContactMomentRelationship).not.toHaveBeenCalled();
	});

	it("saves once, maps the canonical relationship and opens the created Markdown note", async () => {
		const mounted = mountModal();
		const relationshipSelect = selectForLabel(mounted.content, "Relationship");
		relationshipSelect.value = relationship.filePath;
		relationshipSelect.dispatchEvent(new Event("change", { bubbles: true }));

		mounted.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(mounted.createContactMoment).toHaveBeenCalledOnce());

		expect(mounted.createContactMoment).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "People/Contact moments/2026-07-30 - Alice - 12345678.md",
				contactMomentId: "contact-moment-12345678",
				people: [{ id: alice.id, filePath: alice.filePath }],
				relationship: expect.objectContaining({
					kind: "canonical",
					id: relationship.id,
					filePath: relationship.filePath,
					personIds: [alice.id, bob.id],
				}),
				occurredOn: "2026-07-30",
			}),
			{ advanceRelationshipLastContact: false },
		);
		await vi.waitFor(() => expect(mounted.openFile).toHaveBeenCalledOnce());
		expect(mounted.close).toHaveBeenCalledOnce();
	});

	it("renders declared partial success, locks resubmission and retries only the relationship", async () => {
		const retry = Object.freeze({
			attemptId: "retry-1",
			momentPath: "People/Contact moments/2026-07-30 - Alice - 12345678.md",
			relationshipPath: relationship.filePath,
			occurredOn: "2026-07-30",
		});
		const createdFile = mountedFile(retry.momentPath);
		const createContactMoment = vi.fn(async () => ({
			status: "partial-success" as const,
			file: createdFile,
			created: true,
			momentPath: retry.momentPath,
			relationshipPath: retry.relationshipPath,
			reason: "simulated relationship write failure",
			retry,
		}));
		const retryContactMomentRelationship = vi.fn(async () => ({
			status: "success" as const,
			relationship: {
				status: "advanced" as const,
				relationshipPath: relationship.filePath,
				lastContact: retry.occurredOn,
				message: "Relationship updated.",
			},
		}));
		const mounted = mountModal({ createContactMoment, retryContactMomentRelationship });
		const relationshipSelect = selectForLabel(mounted.content, "Relationship");
		relationshipSelect.value = relationship.filePath;
		relationshipSelect.dispatchEvent(new Event("change", { bubbles: true }));
		const advance = inputForLabel(mounted.content, "Advance linked relationship's last contact to this date");
		advance.click();

		mounted.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		const retryButton = buttonWithText(mounted.content, "Retry relationship update");
		await vi.waitFor(() => expect(retryButton.hidden).toBe(false));

		expect(mounted.content.getAttribute("aria-busy")).not.toBe("true");
		expect(mounted.content.textContent).toContain(retry.momentPath);
		expect(mounted.content.textContent).toContain(relationship.filePath);
		expect(mounted.content.textContent).toContain("simulated relationship write failure");
		expect(buttonWithText(mounted.content, "Save").disabled).toBe(true);
		expect(
			Array.from(
				mounted.content.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
					"input, select, textarea",
				),
			).every((item) => item.disabled),
		).toBe(true);
		expect(createContactMoment).toHaveBeenCalledOnce();
		expect(mounted.openFile).not.toHaveBeenCalled();

		retryButton.click();
		await vi.waitFor(() => expect(retryContactMomentRelationship).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(mounted.close).toHaveBeenCalledOnce());

		expect(retryContactMomentRelationship).toHaveBeenCalledWith(retry);
		expect(createContactMoment).toHaveBeenCalledOnce();
		expect(mounted.openFile).toHaveBeenCalledOnce();
		expect(mounted.openFile).toHaveBeenCalledWith(createdFile);
	});

	it("labels canonical relationship endpoints referenced by stable person IDs", () => {
		const idRelationship: RelationshipRecord = {
			...relationship,
			from: { raw: alice.id, target: alice.id },
			to: { raw: bob.id, target: bob.id },
		};
		const mounted = mountModal({
			context: {
				people: [alice, bob],
				relationships: [idRelationship],
				resolveLink: () => undefined,
			},
		});

		expect(
			Array.from(selectForLabel(mounted.content, "Relationship").options, (option) => option.textContent),
		).toContain(`Alice ↔ Bob — ${idRelationship.filePath}`);
	});

	it("keeps stale retry errors visible without creating another moment", async () => {
		const retry = Object.freeze({
			attemptId: "retry-stale",
			momentPath: "People/Contact moments/2026-07-30 - Alice - 12345678.md",
			relationshipPath: relationship.filePath,
			occurredOn: "2026-07-30",
		});
		const createContactMoment = vi.fn(async () => ({
			status: "partial-success" as const,
			file: mountedFile(retry.momentPath),
			created: true,
			momentPath: retry.momentPath,
			relationshipPath: retry.relationshipPath,
			reason: "initial failure",
			retry,
		}));
		const retryContactMomentRelationship = vi.fn(async () => ({
			status: "error" as const,
			message: "The relationship note changed after the partial save.",
		}));
		const mounted = mountModal({ createContactMoment, retryContactMomentRelationship });
		const relationshipSelect = selectForLabel(mounted.content, "Relationship");
		relationshipSelect.value = relationship.filePath;
		relationshipSelect.dispatchEvent(new Event("change", { bubbles: true }));
		inputForLabel(mounted.content, "Advance linked relationship's last contact to this date").click();

		mounted.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		const retryButton = buttonWithText(mounted.content, "Retry relationship update");
		await vi.waitFor(() => expect(retryButton.hidden).toBe(false));
		retryButton.click();
		await vi.waitFor(() => expect(retryContactMomentRelationship).toHaveBeenCalledOnce());
		await vi.waitFor(() =>
			expect(mounted.content.querySelector("[role='alert']")?.textContent).toContain("changed after the partial save"),
		);

		expect(mounted.content.querySelector("[role='alert']")?.textContent).toContain("changed after the partial save");
		expect(retryButton.disabled).toBe(false);
		expect(mounted.close).not.toHaveBeenCalled();
		expect(createContactMoment).toHaveBeenCalledOnce();
	});
});
