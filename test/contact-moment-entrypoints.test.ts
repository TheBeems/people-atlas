import { TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContactMomentRecord, PersonRecord, RawIndexSnapshot, RelationshipRecord } from "../src/domain/types";
import { ContactMomentModal } from "../src/editor/contact-moment-modal";
import PeopleAtlasPlugin from "../src/main";
import { notices } from "./obsidian-stub";

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

const moment: ContactMomentRecord = {
	id: "contact-moment-12345678",
	filePath: "People/Contact moments/2026-07-30 - Alice - 12345678.md",
	people: [
		{
			raw: "[[People/Alice]]",
			target: "People/Alice",
			resolvedPath: alice.filePath,
		},
	],
	relationship: {
		raw: "[[People/Relationships/Alice - Bob]]",
		target: "People/Relationships/Alice - Bob",
		resolvedPath: relationship.filePath,
	},
	occurredOn: "2026-07-30",
	channel: "call",
	summary: "Caught up",
	personIds: [alice.id],
	relationshipId: relationship.id,
	actionable: true,
	followUpActionable: false,
};

function file(path: string): TFile {
	const result = new TFile();
	(result as TFile & { setPath(path: string): void }).setPath(path);
	return result;
}

function createPlugin(
	options: {
		snapshot?: RawIndexSnapshot;
		activePath?: string;
		frontmatterByPath?: Record<string, Record<string, unknown>>;
	} = {},
): PeopleAtlasPlugin {
	const snapshot: RawIndexSnapshot = options.snapshot ?? {
		people: [alice, bob],
		relationships: [relationship],
		contactMoments: [moment],
	};
	const files = new Map(
		[alice.filePath, bob.filePath, relationship.filePath, moment.filePath].map((path) => [path, file(path)]),
	);
	const activeFile = options.activePath ? files.get(options.activePath) : undefined;
	const frontmatterByPath: Record<string, Record<string, unknown>> = {
		[alice.filePath]: { type: "person", person_id: alice.id, name: alice.name },
		[bob.filePath]: { type: "person", person_id: bob.id, name: bob.name },
		[relationship.filePath]: {
			type: "relationship",
			relationship_id: relationship.id,
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
		},
		[moment.filePath]: {
			type: "contact_moment",
			contact_moment_id: moment.id,
			people: ["[[People/Alice]]"],
			relationship: "[[People/Relationships/Alice - Bob]]",
			occurred_on: moment.occurredOn,
			channel: moment.channel,
			summary: moment.summary,
		},
		...options.frontmatterByPath,
	};
	const plugin = new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
	Object.defineProperty(plugin, "app", {
		value: {
			workspace: {
				getActiveFile: () => activeFile ?? null,
				getLeaf: () => ({ openFile: vi.fn(async () => undefined) }),
			},
			vault: {
				getAbstractFileByPath: (path: string) => files.get(path) ?? null,
			},
			metadataCache: {
				getFileCache: (target: TFile) => ({ frontmatter: frontmatterByPath[target.path] ?? {} }),
				getFirstLinkpathDest: (target: string) => {
					const normalized = target.replace(/^\[\[|\]\]$/g, "").replace(/\.md$/i, "");
					return [...files.values()].find((candidate) => candidate.path.replace(/\.md$/i, "") === normalized) ?? null;
				},
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

describe("contact-moment entrypoints", () => {
	it("opens global Log contact blank and keeps relationship advancement unchecked", () => {
		const plugin = createPlugin();
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		expect(plugin.openLogContact()).toBe(true);

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			values: {
				peoplePaths: string[];
				occurredOn: string;
				advanceRelationshipLastContact: boolean;
			};
		};
		expect(modal.values.peoplePaths).toEqual([]);
		expect(modal.values.occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(modal.values.advanceRelationshipLastContact).toBe(false);
	});

	it("prefills exactly one active canonical person but not an active relationship", () => {
		const personPlugin = createPlugin({ activePath: alice.filePath });
		const relationshipPlugin = createPlugin({ activePath: relationship.filePath });
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		expect(personPlugin.openLogContact()).toBe(true);
		expect(relationshipPlugin.openLogContact()).toBe(true);

		const first = open.mock.instances[0] as unknown as { values: { peoplePaths: string[] } };
		const second = open.mock.instances[1] as unknown as { values: { peoplePaths: string[] } };
		expect(first.values.peoplePaths).toEqual([alice.filePath]);
		expect(second.values.peoplePaths).toEqual([]);
	});

	it("revalidates a selected person and rejects stale or ambiguous identity", () => {
		const stalePlugin = createPlugin();
		const ambiguousPlugin = createPlugin({
			snapshot: {
				people: [alice, { ...alice, filePath: "People/Alice duplicate.md" }],
				relationships: [],
				contactMoments: [],
			},
		});
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		expect(stalePlugin.openLogContact("People/Missing.md")).toBe(false);
		expect(ambiguousPlugin.openLogContact(alice.filePath)).toBe(false);

		expect(open).not.toHaveBeenCalled();
		expect(notices).toHaveLength(2);
		expect(notices.every((notice) => notice.includes("no longer available"))).toBe(true);
	});

	it("opens canonical current and path-based edit with stable identity and unchecked advancement", () => {
		const plugin = createPlugin({ activePath: moment.filePath });
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		plugin.openEditCurrentContactMoment();
		expect(plugin.openEditContactMoment(moment.filePath)).toBe(true);

		expect(open).toHaveBeenCalledTimes(2);
		for (const instance of open.mock.instances) {
			const modal = instance as unknown as {
				mode: { kind: string };
				values: { contactMomentId: string; advanceRelationshipLastContact: boolean };
			};
			expect(modal.mode).toMatchObject({ kind: "edit" });
			expect(modal.values).toMatchObject({
				contactMomentId: moment.id,
				advanceRelationshipLastContact: false,
			});
		}
	});

	it("loads live parsed moment values when metadata is newer than the index snapshot", () => {
		const plugin = createPlugin({
			frontmatterByPath: {
				[moment.filePath]: {
					type: "contact_moment",
					contact_moment_id: moment.id,
					people: ["[[People/Alice]]"],
					occurred_on: moment.occurredOn,
					channel: "message",
					summary: "Live metadata value",
				},
			},
		});
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		expect(plugin.openEditContactMoment(moment.filePath)).toBe(true);

		const modal = open.mock.instances[0] as unknown as {
			values: { channel: string; summary: string };
		};
		expect(modal.values).toMatchObject({
			channel: "message",
			summary: "Live metadata value",
		});
	});

	it("rejects duplicate/stale contact-moment identities and missing active files", () => {
		const duplicate = { ...moment, filePath: "People/Contact moments/Duplicate.md" };
		const plugin = createPlugin({
			snapshot: {
				people: [alice, bob],
				relationships: [relationship],
				contactMoments: [moment, duplicate],
			},
			activePath: moment.filePath,
		});
		const noActivePlugin = createPlugin();
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		expect(plugin.openEditContactMoment(moment.filePath)).toBe(false);
		noActivePlugin.openEditCurrentContactMoment();

		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toBe("No editable contact-moment note is active.");
	});

	it("fails visibly instead of throwing when an indexed invalid moment has non-canonical people", () => {
		const invalidMoment: ContactMomentRecord = {
			...moment,
			people: [{ raw: "[[People/Missing]]", target: "People/Missing" }],
			personIds: [],
			actionable: false,
		};
		const plugin = createPlugin({
			snapshot: {
				people: [alice, bob],
				relationships: [relationship],
				contactMoments: [invalidMoment],
			},
			frontmatterByPath: {
				[moment.filePath]: {
					type: "contact_moment",
					contact_moment_id: moment.id,
					people: ["[[People/Missing]]"],
					occurred_on: moment.occurredOn,
				},
			},
		});
		const open = vi.spyOn(ContactMomentModal.prototype, "open");
		let result: boolean | undefined;

		expect(() => {
			result = plugin.openEditContactMoment(moment.filePath);
		}).not.toThrow();
		expect(result).toBe(false);

		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toContain("person references are repaired");
	});

	it("blocks create and edit while plugin data is read-only", () => {
		const plugin = createPlugin({ activePath: moment.filePath });
		(plugin as unknown as { settingsWriteEnabled: boolean }).settingsWriteEnabled = false;
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		expect(plugin.openLogContact(alice.filePath)).toBe(false);
		expect(plugin.openEditContactMoment(moment.filePath)).toBe(false);

		expect(open).not.toHaveBeenCalled();
		expect(notices).toEqual([
			"Contact-moment creation and editing are read-only until the People Atlas plugin data is repaired.",
			"Contact-moment creation and editing are read-only until the People Atlas plugin data is repaired.",
		]);
	});
});
