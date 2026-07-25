import { TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord, RelationshipRecord, RawIndexSnapshot } from "../src/domain/types";
import { RelationshipModal } from "../src/editor/relationship-modal";
import PeopleAtlasPlugin from "../src/main";
import { notices } from "./obsidian-stub";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: [],
	organisations: [],
	contacts: [],
};

const relationship: RelationshipRecord = {
	id: "relationship-1",
	filePath: "People/Relationships/Alice - Bob.md",
	from: { raw: "[[People/Alice]]", target: "People/Alice" },
	to: { raw: "[[People/Bob]]", target: "People/Bob" },
	direction: "undirected",
	types: [],
};

function createPlugin(snapshot: RawIndexSnapshot, activeFile?: TFile): PeopleAtlasPlugin {
	const plugin = new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
	Object.defineProperty(plugin, "app", {
		value: {
			workspace: {
				getActiveFile: () => activeFile ?? null,
				getLeaf: () => ({ openFile: vi.fn(async () => undefined) }),
			},
			metadataCache: {
				getFileCache: () => ({ frontmatter: { relationship_id: "explicit-1" } }),
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

describe("relationship editor entrypoints", () => {
	it("opens global create without a prefilled endpoint", () => {
		const plugin = createPlugin({ people: [alice], relationships: [] });
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openCreateRelationship();

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			values: { fromPath: string };
		};
		expect(modal.values.fromPath).toBe("");
	});

	it("prefills a canonical selected person and rejects a stale path", () => {
		const plugin = createPlugin({ people: [alice], relationships: [] });
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openCreateRelationship(alice.filePath);
		const modal = open.mock.instances[0] as unknown as {
			values: { fromPath: string };
		};
		expect(modal.values.fromPath).toBe(alice.filePath);

		plugin.openCreateRelationship("People/Missing.md");
		expect(open).toHaveBeenCalledTimes(1);
		expect(notices.at(-1)).toContain("no longer available");
	});

	it("refuses edit when no canonical relationship note is active", () => {
		const plugin = createPlugin({ people: [alice], relationships: [] });
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openEditCurrentRelationship();

		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toBe("No editable relationship note is active.");
	});

	it("opens edit for the active canonical relationship with its explicit ID", () => {
		const file = new TFile();
		file.path = relationship.filePath;
		const plugin = createPlugin({ people: [alice], relationships: [relationship] }, file);
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openEditCurrentRelationship();

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			values: { path: string; relationshipId: string };
		};
		expect(modal.values).toMatchObject({
			path: relationship.filePath,
			relationshipId: "explicit-1",
		});
	});
});
