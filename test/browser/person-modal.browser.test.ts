import type { App, TFile } from "obsidian";
import { TFile as StubTFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord } from "../../src/domain/types";
import { PersonModal } from "../../src/editor/person-modal";
import type { AtlasMutationService } from "../../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: ["Al"],
	organisations: ["Example Org"],
	contacts: [{ raw: "[[Missing|Unknown]]", target: "Missing", label: "Unknown" }],
};

const bob: PersonRecord = {
	id: "person-bob",
	filePath: "People/Bob.md",
	name: "Bob",
	aliases: [],
	organisations: [],
	contacts: [],
};

function mountModal(
	mode:
		| { kind: "create" }
		| {
				kind: "edit";
				file: TFile;
				person: PersonRecord;
				explicitPersonId?: string | undefined;
				rawPhoto?: string | undefined;
		  },
	mutations: Pick<AtlasMutationService, "createPerson" | "updatePerson">,
): { modal: PersonModal; content: HTMLElement; title: HTMLElement } {
	const app = {
		metadataCache: {
			getFirstLinkpathDest: (target: string) => (target === "People/Bob" ? ({ path: bob.filePath } as TFile) : null),
		},
		workspace: {
			getLeaf: () => ({ openFile: vi.fn(async () => undefined) }),
		},
	} as unknown as App;
	const modal = new PersonModal(app, mode, [alice, bob], mutations as AtlasMutationService, () => DEFAULT_SETTINGS);
	const title = document.createElement("h2");
	const content = document.createElement("div");
	document.body.append(title, content);
	modal.titleEl = title;
	modal.contentEl = content;
	modal.onOpen();
	return { modal, content, title };
}

function inputForLabel(content: HTMLElement, labelText: string): HTMLInputElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === labelText);
	const input = label?.htmlFor ? content.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
	if (!input) throw new Error(`No input found for ${labelText}.`);
	return input;
}

function buttonWithText(content: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(content.querySelectorAll("button")).find((candidate) => candidate.textContent === text);
	if (!button) throw new Error(`No button found with text ${text}.`);
	return button;
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("person modal", () => {
	it("renders only the curated person fields and preserves unresolved contacts visibly", () => {
		const file = new StubTFile();
		file.path = alice.filePath;
		const { content, title } = mountModal(
			{ kind: "edit", file, person: alice, explicitPersonId: alice.id, rawPhoto: "[[Assets/alice.png]]" },
			{
				createPerson: vi.fn(),
				updatePerson: vi.fn(),
			},
		);

		expect(title.textContent).toBe("Edit person");
		expect(Array.from(content.querySelectorAll("label")).map((label) => label.textContent)).toEqual([
			"Name",
			"Current person note path",
			"Person ID",
			"Aliases",
			"Organisations",
			"Photo",
		]);
		expect(inputForLabel(content, "Person ID").readOnly).toBe(true);
		expect(content.textContent).toContain("Unresolved or ambiguous — [[Missing|Unknown]]");
		expect(content.textContent).not.toContain("Relationship ID");
	});

	it("requires a second confirmation before renaming and saving", async () => {
		const file = new StubTFile();
		file.path = alice.filePath;
		const updatePerson = vi.fn(async (updatedFile: TFile) => ({ file: updatedFile, renamed: true }));
		const { content, title } = mountModal(
			{ kind: "edit", file, person: alice, explicitPersonId: alice.id },
			{ createPerson: vi.fn(), updatePerson },
		);
		const name = inputForLabel(content, "Name");
		name.value = "Alice Example";
		name.dispatchEvent(new Event("input", { bubbles: true }));

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(title.textContent).toBe("Confirm person rename"));
		expect(content.textContent).toContain("People/Alice.md");
		expect(content.textContent).toContain("People/Alice Example.md");
		expect(updatePerson).not.toHaveBeenCalled();

		buttonWithText(content, "Rename and save").click();
		await vi.waitFor(() => expect(updatePerson).toHaveBeenCalledOnce());
		expect(updatePerson).toHaveBeenCalledWith(
			file,
			{ name: "Alice Example" },
			{ targetPath: "People/Alice Example.md" },
		);
	});
});
