import { TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord, RawIndexSnapshot, RelationshipRecord } from "../../src/domain/types";
import { PartnerParentConfirmationModal } from "../../src/editor/partner-parent-confirmation-modal";
import { RelationshipModal } from "../../src/editor/relationship-modal";
import PeopleAtlasPlugin from "../../src/main";

const alex: PersonRecord = {
	id: "person-alex",
	filePath: "People/Alex.md",
	name: "Alex",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const robin: PersonRecord = {
	id: "person-robin",
	filePath: "People/Robin.md",
	name: "Robin",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const sam: PersonRecord = {
	id: "person-sam",
	filePath: "People/Sam.md",
	name: "Sam",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const partnerRelationship: RelationshipRecord = {
	id: "relationship-alex-robin",
	filePath: "People/Relationships/Alex - Robin.md",
	from: { raw: "[[People/Alex]]", target: "People/Alex", resolvedPath: alex.filePath },
	to: { raw: "[[People/Robin]]", target: "People/Robin", resolvedPath: robin.filePath },
	types: [],
	fromRole: "partner",
	toRole: "partner",
};

function buttonWithText(content: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(content.querySelectorAll("button")).find((candidate) => candidate.textContent === text);
	if (!button) throw new Error(`No button found for ${text}.`);
	return button;
}

function inputForLabel(content: HTMLElement, text: string): HTMLInputElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === text);
	const input = label?.htmlFor ? content.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
	if (!input) throw new Error(`No input found for ${text}.`);
	return input;
}

function selectForLabel(content: HTMLElement, text: string): HTMLSelectElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === text);
	const select = label?.htmlFor ? content.querySelector<HTMLSelectElement>(`#${label.htmlFor}`) : null;
	if (!select) throw new Error(`No select found for ${text}.`);
	return select;
}

function setInput(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

function choose(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event("change", { bubbles: true }));
}

function createdFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	return file;
}

interface Harness {
	plugin: PeopleAtlasPlugin;
	snapshot: { current: RawIndexSnapshot };
	createRelationship: ReturnType<typeof vi.fn>;
	successfulRelationshipPaths: string[];
	relationshipModals: RelationshipModal[];
	confirmation(): { modal: PartnerParentConfirmationModal; content: HTMLElement } | undefined;
	confirmationCount(): number;
}

function createHarness(): Harness {
	const plugin = new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
	const snapshot = { current: { people: [alex, robin, sam], relationships: [partnerRelationship] } };
	const openFile = vi.fn(async () => undefined);
	Object.defineProperty(plugin, "app", {
		value: {
			workspace: {
				getLeaf: () => ({ openFile }),
				getActiveFile: () => null,
			},
			metadataCache: { getFirstLinkpathDest: () => null },
		},
	});
	plugin.index.getSnapshot = vi.fn(() => snapshot.current);
	const successfulRelationshipPaths: string[] = [];
	const createRelationship = vi.spyOn(plugin.mutations, "createRelationship").mockImplementation(async () => {
		const file = createdFile(`People/Relationships/Created-${createRelationship.mock.calls.length}.md`);
		successfulRelationshipPaths.push(file.path);
		return file;
	});
	const relationshipModals: RelationshipModal[] = [];
	vi.spyOn(RelationshipModal.prototype, "open").mockImplementation(function (this: RelationshipModal) {
		const title = document.createElement("h2");
		const content = document.createElement("div");
		document.body.append(title, content);
		this.titleEl = title;
		this.contentEl = content;
		this.close = vi.fn(() => this.onClose());
		this.onOpen();
		relationshipModals.push(this);
	});
	let confirmation: { modal: PartnerParentConfirmationModal; content: HTMLElement } | undefined;
	let confirmationCount = 0;
	vi.spyOn(PartnerParentConfirmationModal.prototype, "open").mockImplementation(function (
		this: PartnerParentConfirmationModal,
	) {
		confirmationCount += 1;
		const title = document.createElement("h2");
		const content = document.createElement("div");
		document.body.append(title, content);
		this.titleEl = title;
		this.contentEl = content;
		this.close = vi.fn(() => this.onClose());
		this.onOpen();
		confirmation = { modal: this, content };
	});
	return {
		plugin,
		snapshot,
		createRelationship,
		successfulRelationshipPaths,
		relationshipModals,
		confirmation: () => confirmation,
		confirmationCount: () => confirmationCount,
	};
}

async function saveFirstParentChild(harness: Harness): Promise<void> {
	harness.plugin.openCreateRelationship(alex.filePath);
	const modal = harness.relationshipModals[0];
	if (!modal) throw new Error("Expected the first relationship editor.");
	const content = modal.contentEl;
	setInput(inputForLabel(content, "Second person"), sam.filePath);
	choose(selectForLabel(content, "Simple relationship"), "parent");
	buttonWithText(content, "Save").click();
	await vi.waitFor(() => expect(harness.createRelationship).toHaveBeenCalledOnce());
	await vi.waitFor(() => expect(harness.confirmation()).toBeDefined());
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("PPA2 create-success entrypoint", () => {
	it("houdt de eerste create op de bestaande mutation boundary, opent pas daarna de vraag en laat tweede editor-close write-free", async () => {
		const harness = createHarness();
		await saveFirstParentChild(harness);
		const confirmation = harness.confirmation();
		if (!confirmation) throw new Error("Expected partner-ouderbevestiging.");
		expect(harness.createRelationship).toHaveBeenCalledWith(
			expect.objectContaining({ fromRole: "parent", toRole: "child" }),
		);

		buttonWithText(confirmation.content, "Review relationship").click();
		await vi.waitFor(() => expect(harness.relationshipModals).toHaveLength(2));
		const secondEditor = harness.relationshipModals[1];
		if (!secondEditor) throw new Error("Expected the second relationship editor.");
		expect(inputForLabel(secondEditor.contentEl, "First person — Robin").value).toBe(robin.filePath);
		expect(inputForLabel(secondEditor.contentEl, "Second person — Sam").value).toBe(sam.filePath);
		expect(inputForLabel(secondEditor.contentEl, "Robin's role").value).toBe("parent");
		expect(inputForLabel(secondEditor.contentEl, "Sam's role").value).toBe("child");
		expect(harness.createRelationship).toHaveBeenCalledOnce();

		secondEditor.close();
		expect(harness.createRelationship).toHaveBeenCalledOnce();
	});

	it("blijft bij één bestaande create wanneer de kandidaat vóór Review relationship stale wordt", async () => {
		const harness = createHarness();
		await saveFirstParentChild(harness);
		const confirmation = harness.confirmation();
		if (!confirmation) throw new Error("Expected partner-ouderbevestiging.");
		harness.snapshot.current = { people: [alex, sam], relationships: [] };

		buttonWithText(confirmation.content, "Review relationship").click();
		expect(harness.relationshipModals).toHaveLength(1);
		expect(harness.createRelationship).toHaveBeenCalledOnce();
	});

	it("laat uitsluitend een tweede expliciete Save de tweede bestaande mutation uitlokken", async () => {
		const harness = createHarness();
		await saveFirstParentChild(harness);
		const confirmation = harness.confirmation();
		if (!confirmation) throw new Error("Expected partner-ouderbevestiging.");
		buttonWithText(confirmation.content, "Review relationship").click();
		await vi.waitFor(() => expect(harness.relationshipModals).toHaveLength(2));
		const secondEditor = harness.relationshipModals[1];
		if (!secondEditor) throw new Error("Expected the second relationship editor.");

		buttonWithText(secondEditor.contentEl, "Save").click();
		await vi.waitFor(() => expect(harness.createRelationship).toHaveBeenCalledTimes(2));
		expect(harness.createRelationship.mock.calls[1]?.[0]).toMatchObject({
			from: "[[People/Robin]]",
			to: "[[People/Sam]]",
			fromRole: "parent",
			toRole: "child",
		});
	});

	it("houdt de eerste parent-child-create als enige geslaagd wanneer de tweede expliciete Save regulier faalt", async () => {
		const harness = createHarness();
		await saveFirstParentChild(harness);
		const confirmation = harness.confirmation();
		if (!confirmation) throw new Error("Expected partner-ouderbevestiging.");
		buttonWithText(confirmation.content, "Review relationship").click();
		await vi.waitFor(() => expect(harness.relationshipModals).toHaveLength(2));
		const secondEditor = harness.relationshipModals[1];
		if (!secondEditor) throw new Error("Expected the second relationship editor.");
		harness.createRelationship.mockRejectedValueOnce(new Error("The second relationship save failed."));

		buttonWithText(secondEditor.contentEl, "Save").click();
		await vi.waitFor(() => expect(harness.createRelationship).toHaveBeenCalledTimes(2));
		await vi.waitFor(() =>
			expect(secondEditor.contentEl.querySelector("[role=alert]")?.textContent).toBe(
				"The second relationship save failed.",
			),
		);
		expect(harness.createRelationship.mock.calls[0]?.[0]).toMatchObject({ fromRole: "parent", toRole: "child" });
		expect(harness.successfulRelationshipPaths).toEqual(["People/Relationships/Created-1.md"]);
		expect(harness.relationshipModals).toHaveLength(2);
		expect(harness.confirmationCount()).toBe(1);
		expect(harness.createRelationship).toHaveBeenCalledTimes(2);
	});
});
