import { TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord, RawIndexSnapshot } from "../src/domain/types";
import { PersonModal } from "../src/editor/person-modal";
import PeopleAtlasPlugin from "../src/main";
import { notices } from "./obsidian-stub";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: ["Al"],
	organisations: [],
	contacts: [],
};

function createPlugin(snapshot: RawIndexSnapshot, activeFile?: TFile): PeopleAtlasPlugin {
	const plugin = new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
	Object.defineProperty(plugin, "app", {
		value: {
			workspace: {
				getActiveFile: () => activeFile ?? null,
				getLeaf: () => ({ openFile: vi.fn(async () => undefined) }),
			},
			vault: {
				getAbstractFileByPath: (path: string) => (activeFile?.path === path ? activeFile : null),
			},
			metadataCache: {
				getFileCache: () => ({
					frontmatter: {
						person_id: "person-alice",
						photo: "[[Assets/alice.png]]",
					},
				}),
				getFirstLinkpathDest: () => undefined,
			},
		},
	});
	plugin.index.getSnapshot = vi.fn(() => snapshot);
	return plugin;
}

afterEach(() => {
	notices.length = 0;
	vi.restoreAllMocks();
});

describe("person editor entrypoints", () => {
	it("opens global create with an empty curated form", () => {
		const plugin = createPlugin({ people: [alice], relationships: [] });
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openCreatePerson();

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			values: { name: string; personIdSource: string };
		};
		expect(modal.values).toMatchObject({ name: "", personIdSource: "automatic" });
	});

	it("opens edit for an active canonical person with its explicit identity and raw photo", () => {
		const file = new TFile();
		file.path = alice.filePath;
		const plugin = createPlugin({ people: [alice], relationships: [] }, file);
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openEditCurrentPerson();

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			values: { name: string; personId: string; photo: string };
		};
		expect(modal.values).toMatchObject({
			name: "Alice",
			personId: "person-alice",
			photo: "[[Assets/alice.png]]",
		});
	});

	it("opens a selected canonical person and rejects stale or non-person paths", () => {
		const file = new TFile();
		file.path = alice.filePath;
		const plugin = createPlugin({ people: [alice], relationships: [] }, file);
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openEditPerson(alice.filePath);
		plugin.openEditPerson("People/Missing.md");

		expect(open).toHaveBeenCalledOnce();
		expect(notices.at(-1)).toContain("no longer available");
	});

	it("refuses Edit current person when no canonical person note is active", () => {
		const plugin = createPlugin({ people: [alice], relationships: [] });
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openEditCurrentPerson();

		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toBe("No editable person note is active.");
	});
});
