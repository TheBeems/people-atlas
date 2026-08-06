import { TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord, RawIndexSnapshot } from "../src/domain/types";
import { PersonModal } from "../src/editor/person-modal";
import { createTranslator } from "../src/i18n";
import PeopleAtlasPlugin from "../src/main";
import { notices } from "./obsidian-stub";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: ["Al"],
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

function personFile(path: string): TFile {
	const file = new TFile();
	(file as TFile & { setPath(path: string): void }).setPath(path);
	return file;
}

function createPlugin(
	snapshot: RawIndexSnapshot,
	activeFile?: TFile,
	frontmatter: Record<string, unknown> = {
		type: "person",
		person_id: "person-alice",
		photo: "[[Assets/alice.png]]",
	},
	sourceState?: { source: string; cachedTags?: Array<{ tag: string }> },
): PeopleAtlasPlugin {
	const plugin = new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
	Object.defineProperty(plugin, "app", {
		value: {
			workspace: {
				getActiveFile: () => activeFile ?? null,
				getLeaf: () => ({ openFile: vi.fn(async () => undefined) }),
			},
			vault: {
				getAbstractFileByPath: (path: string) => (activeFile?.path === path ? activeFile : null),
				read: async () => sourceState?.source ?? "",
			},
			metadataCache: {
				getFileCache: () => ({
					frontmatter,
					tags: sourceState?.cachedTags,
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

	it("opens edit for an active canonical person with its ID and raw photo", () => {
		const file = personFile(alice.filePath);
		const plugin = createPlugin({ people: [alice], relationships: [] }, file, {
			type: "person",
			person_id: "person-alice",
			photo: "[[Assets/alice.png]]",
			birth_date: "July 30",
			emails: [],
			phones: ["+31 20"],
		});
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openEditCurrentPerson();

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			values: {
				name: string;
				personId: string;
				photo: string;
				birthDate: { year: string; month: string; day: string };
				emails: string[];
				phones: string[];
			};
		};
		expect(modal.values).toMatchObject({
			name: "Alice",
			personId: "person-alice",
			photo: "[[Assets/alice.png]]",
			birthDate: { year: "", month: "", day: "" },
			emails: [],
			phones: ["+31 20"],
		});
	});

	it("opens a selected canonical person and rejects stale or non-person paths", () => {
		const file = personFile(alice.filePath);
		const plugin = createPlugin({ people: [alice], relationships: [] }, file);
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openEditPerson(alice.filePath);
		plugin.openEditPerson("People/Missing.md");

		expect(open).toHaveBeenCalledOnce();
		expect(notices.at(-1)).toContain("no longer available");
	});

	it("localizes the unavailable-person entrypoint notice", () => {
		const file = personFile(alice.filePath);
		const plugin = createPlugin({ people: [alice], relationships: [] }, file);
		Object.assign(plugin, { t: createTranslator("nl") });

		plugin.openEditPerson("People/Missing.md");

		expect(notices.at(-1)).toBe("De geselecteerde persoon is niet meer beschikbaar in de People Atlas-index.");
	});

	it("fails closed when a tag-only cache entry no longer has live source proof", async () => {
		const file = personFile(alice.filePath);
		const source = "This note no longer has the configured person tag.\n";
		file.stat.mtime = 1;
		file.stat.size = source.length;
		const plugin = createPlugin(
			{ people: [alice], relationships: [] },
			file,
			{ person_id: alice.id, name: alice.name },
			{ source, cachedTags: [{ tag: "#person" }] },
		);
		const open = vi.spyOn(PersonModal.prototype, "open");

		await plugin.openEditPerson(alice.filePath);

		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toContain("source was being verified");
	});

	it("opens a live tag-only person with an exact source and stat baseline", async () => {
		const file = personFile(alice.filePath);
		const source = "#person\n\nTag-only person.\n";
		file.stat.mtime = 7;
		file.stat.size = source.length;
		const plugin = createPlugin(
			{ people: [alice], relationships: [] },
			file,
			{ person_id: alice.id, name: alice.name },
			{ source, cachedTags: [{ tag: "#person" }] },
		);
		const open = vi.spyOn(PersonModal.prototype, "open");

		await plugin.openEditPerson(alice.filePath);

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			mode: {
				personClassification: string;
				sourceBaseline: { mtime: number; size: number; source: string; tagSources: string[] };
			};
		};
		expect(modal.mode).toMatchObject({
			personClassification: "tag",
			sourceBaseline: {
				mtime: 7,
				size: source.length,
				source,
				tagSources: ["body"],
			},
		});
	});

	it("refuses person entrypoints while writes are disabled", () => {
		const file = personFile(alice.filePath);
		const plugin = createPlugin({ people: [alice], relationships: [] }, file);
		(plugin as unknown as { settingsWriteEnabled: boolean }).settingsWriteEnabled = false;
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openCreatePerson();
		plugin.openEditPerson(alice.filePath);

		expect(open).not.toHaveBeenCalled();
		expect(notices).toEqual([
			"Person creation and editing are read-only until the People Atlas plugin data is repaired.",
			"Person creation and editing are read-only until the People Atlas plugin data is repaired.",
		]);
	});

	it("uses the post-open snapshot to reject a newly linked person that becomes stale", async () => {
		const snapshot: RawIndexSnapshot = { people: [alice, bob], relationships: [] };
		const plugin = createPlugin(snapshot);
		const createPerson = vi.fn();
		plugin.mutations.createPerson = createPerson;
		const open = vi.spyOn(PersonModal.prototype, "open");
		plugin.openCreatePerson();
		const modal = open.mock.instances[0] as unknown as {
			values: {
				name: string;
				contacts: Array<{ raw: string; resolvedPath?: string }>;
			};
			session: {
				submit(values: unknown): Promise<{ status: string; message?: string }>;
			};
		};
		modal.values.name = "Carol";
		modal.values.contacts = [{ raw: "[[People/Bob]]", resolvedPath: bob.filePath }];
		snapshot.people = [alice];

		const result = await modal.session.submit(structuredClone(modal.values));

		expect(result).toMatchObject({
			status: "error",
			message: expect.stringContaining("no longer uniquely available"),
		});
		expect(createPerson).not.toHaveBeenCalled();
	});

	it.each([
		{
			name: "type drift",
			people: [alice],
			frontmatter: {
				type: "relationship",
				person_id: "person-alice",
				from: "[[People/Alice]]",
				to: "[[People/Bob]]",
			},
		},
		{
			name: "identity drift",
			people: [alice],
			frontmatter: { type: "person", person_id: "person-other", name: "Alice" },
		},
		{
			name: "canonical identity ambiguity",
			people: [alice, { ...alice, filePath: "People/Alice duplicate.md" }],
			frontmatter: { type: "person", person_id: "person-alice", name: "Alice" },
		},
	])("rejects edit after $name", ({ people, frontmatter }) => {
		const file = personFile(alice.filePath);
		const plugin = createPlugin({ people, relationships: [] }, file, frontmatter);
		const open = vi.spyOn(PersonModal.prototype, "open");

		plugin.openEditPerson(alice.filePath);

		expect(open).not.toHaveBeenCalled();
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
