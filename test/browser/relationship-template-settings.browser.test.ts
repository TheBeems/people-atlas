import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type PeopleAtlasPlugin from "../../src/main";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { RelationshipPresetModal } from "../../src/settings/relationship-preset-modal";
import { RelationshipPresetSyncModal } from "../../src/settings/relationship-preset-sync-modal";
import type { RelationshipPresetSyncChange } from "../../src/settings/relationship-preset-sync";
import type { RelationshipPreset } from "../../src/settings/relationship-presets";
import { PeopleAtlasSettingTab } from "../../src/settings/settings-tab";

const template: RelationshipPreset = {
	id: "friend-colleague",
	name: "Friend and colleague",
	types: ["friend", "colleague"],
	fromRole: "Friend",
	toRole: "Colleague",
};

function mountModal(modal: { titleEl: HTMLElement; contentEl: HTMLElement; onOpen(): void }): {
	content: HTMLElement;
	title: HTMLElement;
} {
	const title = document.createElement("h2");
	const content = document.createElement("div");
	document.body.append(title, content);
	modal.titleEl = title;
	modal.contentEl = content;
	modal.onOpen();
	return { content, title };
}

function inputForLabel(content: HTMLElement, labelText: string): HTMLInputElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === labelText);
	const input = label?.htmlFor ? content.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
	if (!input) throw new Error(`No input found for ${labelText}.`);
	return input;
}

function enter(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
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

describe("relationship template settings", () => {
	it("creates a template with copy-not-live and fixed endpoint-slot language", async () => {
		const onSave = vi.fn(async () => true);
		const modal = new RelationshipPresetModal({} as App, { kind: "create" }, [], onSave);
		const close = vi.spyOn(modal, "close");
		const { content, title } = mountModal(modal);

		expect(title.textContent).toBe("Create relationship template");
		expect(content.textContent).toContain("they are not live links");
		expect(content.textContent).toContain("New relationships normally place My person first when it resolves");
		expect(content.textContent).toContain("templates also work for relationships between any two people");
		expect(content.textContent).toContain("Roles always map to the first and second selected people");
		expect(Array.from(content.querySelectorAll("label")).map((label) => label.textContent)).toEqual([
			"Template ID",
			"Name",
			"Relationship types",
			"First-person role",
			"Second-person role",
		]);
		expect(content.textContent).not.toMatch(/Person A|Person B|Direction/);

		enter(inputForLabel(content, "Name"), "Friend and colleague");
		enter(inputForLabel(content, "Relationship types"), " friend, colleague ");
		enter(inputForLabel(content, "First-person role"), " Friend ");
		enter(inputForLabel(content, "Second-person role"), " Colleague ");
		buttonWithText(content, "Save").click();

		await vi.waitFor(() =>
			expect(onSave).toHaveBeenCalledWith({
				id: "friend-and-colleague",
				name: "Friend and colleague",
				types: ["friend", "colleague"],
				fromRole: "Friend",
				toRole: "Colleague",
			}),
		);
		expect(close).toHaveBeenCalledOnce();
	});

	it("previews exact paths and confirms only copied template-owned values", async () => {
		const changes: RelationshipPresetSyncChange[] = [
			{
				filePath: "People/Relationships/Alice - Bob.md",
				before: {
					presetId: template.id,
					types: ["friend"],
					fromRole: "Friend",
					toRole: "Manager",
				},
				after: {
					presetId: template.id,
					types: [...template.types],
					fromRole: template.fromRole,
					toRole: template.toRole,
				},
			},
		];
		const onConfirm = vi.fn(async (approved: RelationshipPresetSyncChange[]) => {
			approved[0]?.before.types.push("changed-only-in-callback");
			return {
				completed: 0,
				skipped: 2,
				remaining: 1,
				failure: {
					filePath: changes[0]?.filePath,
					message: "The relationship changed after this preview was opened. Review a new preview.",
				},
			};
		});
		const modal = new RelationshipPresetSyncModal({} as App, template, changes, onConfirm);
		const { content, title } = mountModal(modal);

		expect(title.textContent).toBe("Update linked relationships from template");
		expect(content.textContent).toContain("stored template provenance is “Friend and colleague”");
		expect(content.textContent).toContain("exact paths below");
		expect(content.textContent).toContain("Endpoints, paths, relationship IDs, closeness, dates, status");
		expect(content.querySelector("strong")?.textContent).toBe("People/Relationships/Alice - Bob.md");
		expect(content.textContent).toContain("types: friend; first-person role: Friend; second-person role: Manager");
		expect(content.textContent).toContain(
			"types: friend, colleague; first-person role: Friend; second-person role: Colleague",
		);
		expect(content.textContent).not.toContain("direction:");

		buttonWithText(content, "Update linked relationships from template").click();

		await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
		expect(changes[0]?.before.types).toEqual(["friend"]);
		await vi.waitFor(() =>
			expect(content.textContent).toContain(
				"Stopped at “People/Relationships/Alice - Bob.md”. Completed 0; skipped 2; remaining 1. The relationship changed after this preview was opened. Review a new preview.",
			),
		);
	});

	it("explains that deleting a template preserves copied values and removes only provenance", async () => {
		const updateSetting = vi.fn(async () => true);
		const plugin = {
			app: {},
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [template] },
			getMyPersonCandidates: vi.fn(() => []),
			getMyPersonWarning: vi.fn(() => undefined),
			canWritePeopleAtlasData: vi.fn(() => true),
			getRelationshipPresetSyncChanges: vi.fn(() => []),
			getRelationshipPresetLinkCount: vi.fn(() => 2),
			updateSetting,
		} as unknown as PeopleAtlasPlugin;
		const tab = new PeopleAtlasSettingTab(plugin);
		tab.containerEl = document.createElement("div");
		document.body.append(tab.containerEl);
		const update = vi.fn();
		(tab as unknown as { update: () => void }).update = update;
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
		const definitions = tab.getSettingDefinitions() as unknown as Array<{
			type?: string;
			onDelete?: (index: number) => void;
		}>;
		const templates = definitions.find((definition) => definition.type === "list");

		templates?.onDelete?.(0);

		expect(confirm).toHaveBeenCalledWith(
			"Delete “Friend and colleague” relationship template? 2 relationship notes will keep their copied types and roles. Only their template provenance becomes unavailable.",
		);
		await vi.waitFor(() => expect(updateSetting).toHaveBeenCalledWith("relationshipPresets", []));
		expect(update).toHaveBeenCalledOnce();
	});
});
