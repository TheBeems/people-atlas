import type { App, TFile } from "obsidian";
import { TFile as StubTFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord } from "../../src/domain/types";
import { RelationshipModal } from "../../src/editor/relationship-modal";
import type { AtlasMutationService } from "../../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";

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

function relationshipFile(path: string): TFile {
	const file = new StubTFile();
	file.path = path;
	return file;
}

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

function mount(options?: { getCurrentPeople?: () => PersonRecord[] }) {
	const createRelationship = vi.fn(async () => relationshipFile("People/Relationships/Robin - Sam.md"));
	const createSucceeded = vi.fn();
	const app = {
		metadataCache: { getFirstLinkpathDest: () => null },
		workspace: { getLeaf: () => ({ openFile: vi.fn(async () => undefined) }) },
	} as unknown as App;
	const modal = new RelationshipModal(
		app,
		{
			kind: "create",
			fromPersonPath: robin.filePath,
			toPersonPath: sam.filePath,
			fromRole: "parent",
			toRole: "child",
		},
		[robin, sam],
		{ createRelationship, updateRelationship: vi.fn() } as unknown as AtlasMutationService,
		() => DEFAULT_SETTINGS,
		undefined,
		undefined,
		options?.getCurrentPeople,
		createSucceeded,
	);
	const title = document.createElement("h2");
	const content = document.createElement("div");
	document.body.append(title, content);
	modal.titleEl = title;
	modal.contentEl = content;
	modal.close = vi.fn(() => modal.onClose());
	modal.onOpen();
	return { content, createRelationship, createSucceeded, modal };
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("create-success seam voor partner-ouderreview", () => {
	it("prefillt de gewone tweede editor met partner eerst en exact parent-child, maar schrijft alleen na Save", async () => {
		const { content, createRelationship, createSucceeded } = mount();
		expect(inputForLabel(content, "First person — Robin").value).toBe(robin.filePath);
		expect(inputForLabel(content, "Second person — Sam").value).toBe(sam.filePath);
		expect(inputForLabel(content, "Robin's role").value).toBe("parent");
		expect(inputForLabel(content, "Sam's role").value).toBe("child");
		expect(createRelationship).not.toHaveBeenCalled();

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(createRelationship).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(createSucceeded).toHaveBeenCalledOnce());
		expect(createSucceeded).toHaveBeenCalledWith(
			expect.objectContaining({
				values: expect.objectContaining({
					fromPath: robin.filePath,
					toPath: sam.filePath,
					fromRole: "parent",
					toRole: "child",
				}),
			}),
		);
	});

	it("hercontroleert vóór de tweede Save actuele endpoints en schrijft niet wanneer de kandidaat stale werd", async () => {
		let currentPeople = [robin, sam];
		const { content, createRelationship, createSucceeded, modal } = mount({ getCurrentPeople: () => currentPeople });
		currentPeople = [robin];

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(content.textContent).toContain("Second person must be selected"));
		expect(createRelationship).not.toHaveBeenCalled();
		expect(createSucceeded).not.toHaveBeenCalled();
		modal.close();
		expect(createRelationship).not.toHaveBeenCalled();
	});
});
