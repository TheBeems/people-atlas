import { TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord, RelationshipRecord, RawIndexSnapshot } from "../src/domain/types";
import { RelationshipModal } from "../src/editor/relationship-modal";
import PeopleAtlasPlugin from "../src/main";
import type { RelationshipPreset } from "../src/settings/relationship-presets";
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

const mathijs: PersonRecord = {
	id: "person-mathijs",
	filePath: "People/Mathijs.md",
	name: "Mathijs",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const relationship: RelationshipRecord = {
	id: "explicit-1",
	filePath: "People/Relationships/Alice - Bob.md",
	from: { raw: "[[People/Alice]]", target: "People/Alice", kind: "wikilink" },
	to: { raw: "[[People/Bob]]", target: "People/Bob", kind: "wikilink" },
	types: [],
};

interface PluginHarness {
	plugin: PeopleAtlasPlugin;
	files: Map<string, TFile>;
	frontmatterByPath: Map<string, Record<string, unknown>>;
	openFile: ReturnType<typeof vi.fn>;
}

function relationshipFrontmatter(
	record: RelationshipRecord,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		type: "relationship",
		relationship_id: record.id,
		from: record.from.raw,
		to: record.to.raw,
		relationship_types: record.types,
		...overrides,
	};
}

function markdownFile(path: string): TFile {
	const file = new TFile();
	Object.assign(file, {
		path,
		extension: "md",
		basename: path.split("/").at(-1)?.replace(/\.md$/i, "") ?? "",
	});
	return file;
}

function createPlugin(snapshot: RawIndexSnapshot, activeFile?: TFile): PluginHarness {
	const plugin = new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
	const files = new Map<string, TFile>();
	const frontmatterByPath = new Map<string, Record<string, unknown>>();
	for (const candidate of snapshot.relationships) {
		files.set(candidate.filePath, markdownFile(candidate.filePath));
		frontmatterByPath.set(candidate.filePath, relationshipFrontmatter(candidate));
	}
	if (activeFile) files.set(activeFile.path, activeFile);
	const openFile = vi.fn(async () => undefined);
	Object.defineProperty(plugin, "app", {
		value: {
			workspace: {
				getActiveFile: () => activeFile ?? null,
				getLeaf: () => ({ openFile }),
			},
			vault: {
				getAbstractFileByPath: (path: string) => files.get(path) ?? null,
			},
			metadataCache: {
				getFileCache: (file: TFile) => ({ frontmatter: frontmatterByPath.get(file.path) ?? {} }),
				getFirstLinkpathDest: () => undefined,
			},
		},
	});
	plugin.index.getSnapshot = vi.fn(() => snapshot);
	return { plugin, files, frontmatterByPath, openFile };
}

afterEach(() => {
	notices.length = 0;
	vi.restoreAllMocks();
});

describe("relationship editor entrypoints", () => {
	it("opens global create without a prefilled endpoint", () => {
		const { plugin } = createPlugin({ people: [alice], relationships: [] });
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openCreateRelationship();

		expect(open).toHaveBeenCalledOnce();
		const modal = open.mock.instances[0] as unknown as {
			values: { fromPath: string };
		};
		expect(modal.values.fromPath).toBe("");
	});

	it("wires current settings writability and explicit template persistence into create", async () => {
		const { plugin } = createPlugin({ people: [alice], relationships: [] });
		const updateSetting = vi.spyOn(plugin, "updateSetting").mockResolvedValue(true);
		const open = vi.spyOn(RelationshipModal.prototype, "open");
		const template: RelationshipPreset = {
			id: "friendship",
			name: "Friendship",
			types: ["friend"],
			fromRole: "friend",
			toRole: "friend",
		};

		plugin.openCreateRelationship();
		const modal = open.mock.instances[0] as unknown as {
			templateCreation: {
				enabled(): boolean;
				save(candidate: RelationshipPreset): Promise<boolean>;
			};
		};

		expect(modal.templateCreation.enabled()).toBe(true);
		await expect(modal.templateCreation.save(template)).resolves.toBe(true);
		expect(updateSetting).toHaveBeenCalledWith("relationshipPresets", [template]);

		(plugin as unknown as { settingsWriteEnabled: boolean }).settingsWriteEnabled = false;
		expect(modal.templateCreation.enabled()).toBe(false);
	});

	it("refuses every relationship mutation entrypoint before opening while plugin data is read-only", () => {
		const file = markdownFile(relationship.filePath);
		const { plugin } = createPlugin({ people: [alice], relationships: [relationship] }, file);
		const open = vi.spyOn(RelationshipModal.prototype, "open");
		const updateRelationship = vi.spyOn(plugin.mutations, "updateRelationship");
		(plugin as unknown as { settingsWriteEnabled: boolean }).settingsWriteEnabled = false;

		plugin.openCreateRelationship();
		plugin.openCreateRelationship(alice.filePath);
		expect(plugin.openEditRelationship(relationship.filePath)).toBe(false);
		plugin.openEditCurrentRelationship();

		expect(open).not.toHaveBeenCalled();
		expect(updateRelationship).not.toHaveBeenCalled();
		expect(notices).toHaveLength(4);
		expect(notices.every((notice) => notice.includes("read-only"))).toBe(true);
	});

	it("prefills a canonical selected person without My person and rejects a stale path", () => {
		const { plugin } = createPlugin({ people: [alice, mathijs], relationships: [] });
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openCreateRelationship(alice.filePath);
		const modal = open.mock.instances[0] as unknown as {
			values: { fromPath: string };
		};
		expect(modal.values.fromPath).toBe(alice.filePath);

		plugin.settings = { ...plugin.settings, myPersonId: mathijs.id };
		plugin.openCreateRelationship("People/Missing.md");
		expect(open).toHaveBeenCalledTimes(1);
		expect(notices.at(-1)).toContain("no longer available");
	});

	it("uses My person first for global and selected-person create without filling it twice", () => {
		const { plugin } = createPlugin({ people: [alice, mathijs], relationships: [] });
		plugin.settings = { ...plugin.settings, myPersonId: mathijs.id };
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openCreateRelationship();
		let modal = open.mock.instances[0] as unknown as {
			values: { fromPath: string; toPath: string };
		};
		expect(modal.values).toMatchObject({
			fromPath: mathijs.filePath,
			toPath: "",
		});

		plugin.openCreateRelationship(alice.filePath);
		modal = open.mock.instances[1] as unknown as {
			values: { fromPath: string; toPath: string };
		};
		expect(modal.values).toMatchObject({
			fromPath: mathijs.filePath,
			toPath: alice.filePath,
		});

		plugin.openCreateRelationship(mathijs.filePath);
		modal = open.mock.instances[2] as unknown as {
			values: { fromPath: string; toPath: string };
		};
		expect(modal.values).toMatchObject({
			fromPath: mathijs.filePath,
			toPath: "",
		});
	});

	it("falls back neutrally for missing or ambiguous My person without guessing", () => {
		const duplicateMyPerson: PersonRecord = {
			...mathijs,
			filePath: "People/Mathijs duplicate.md",
		};
		const missing = createPlugin({ people: [alice], relationships: [] });
		missing.plugin.settings = { ...missing.plugin.settings, myPersonId: "person-missing" };
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		missing.plugin.openCreateRelationship();
		let modal = open.mock.instances[0] as unknown as {
			values: { fromPath: string; toPath: string };
		};
		expect(modal.values).toMatchObject({ fromPath: "", toPath: "" });

		const ambiguous = createPlugin({
			people: [alice, mathijs, duplicateMyPerson],
			relationships: [],
		});
		ambiguous.plugin.settings = { ...ambiguous.plugin.settings, myPersonId: mathijs.id };
		ambiguous.plugin.openCreateRelationship(alice.filePath);
		modal = open.mock.instances[1] as unknown as {
			values: { fromPath: string; toPath: string };
		};
		expect(modal.values).toMatchObject({
			fromPath: alice.filePath,
			toPath: "",
		});
	});

	it("rejects a selected path whose canonical person ID is duplicated", () => {
		const duplicateAlice: PersonRecord = {
			...alice,
			filePath: "People/Alice duplicate.md",
		};
		const { plugin } = createPlugin({
			people: [alice, duplicateAlice, mathijs],
			relationships: [],
		});
		plugin.settings = { ...plugin.settings, myPersonId: mathijs.id };
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openCreateRelationship(alice.filePath);

		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toContain("no longer available");
	});

	it("refuses edit when no canonical relationship note is active", () => {
		const { plugin } = createPlugin({ people: [alice], relationships: [] });
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		plugin.openEditCurrentRelationship();

		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toBe("No editable relationship note is active.");
	});

	it("opens edit for the active canonical relationship with its explicit ID", () => {
		const file = markdownFile(relationship.filePath);
		const { plugin } = createPlugin({ people: [alice], relationships: [relationship] }, file);
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

	it("does not reorder stored edit endpoints when My person is second", () => {
		const selfSecond: RelationshipRecord = {
			...relationship,
			to: { raw: "person-mathijs", target: "person-mathijs", kind: "id" },
			fromRole: "manager",
			toRole: "colleague",
		};
		const { plugin, frontmatterByPath } = createPlugin({
			people: [alice, mathijs],
			relationships: [selfSecond],
		});
		plugin.settings = { ...plugin.settings, myPersonId: mathijs.id };
		frontmatterByPath.set(
			selfSecond.filePath,
			relationshipFrontmatter(selfSecond, {
				from_role: selfSecond.fromRole,
				to_role: selfSecond.toRole,
			}),
		);
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		expect(plugin.openEditRelationship(selfSecond.filePath)).toBe(true);

		const modal = open.mock.instances[0] as unknown as {
			values: { fromPath: string; toPath: string; fromRole: string; toRole: string };
		};
		expect(modal.values).toMatchObject({
			fromPath: alice.filePath,
			toPath: mathijs.filePath,
			fromRole: "manager",
			toRole: "colleague",
		});
	});

	it("delegates the active-note command to the shared path entrypoint", () => {
		const file = markdownFile(relationship.filePath);
		const { plugin } = createPlugin({ people: [alice], relationships: [relationship] }, file);
		const edit = vi.spyOn(plugin, "openEditRelationship").mockReturnValue(true);

		plugin.openEditCurrentRelationship();

		expect(edit).toHaveBeenCalledWith(relationship.filePath);
	});

	it("opens the exact selected note when parallel relationships share endpoints", async () => {
		const parallel: RelationshipRecord = {
			...relationship,
			id: "explicit-2",
			filePath: "People/Relationships/Alice - Bob (mentor).md",
			types: ["mentor"],
		};
		const { plugin, openFile } = createPlugin({
			people: [alice],
			relationships: [relationship, parallel],
		});

		await expect(plugin.openRelationship(parallel.filePath)).resolves.toBe(true);

		expect(openFile).toHaveBeenCalledOnce();
		expect(openFile.mock.calls[0]?.[0]).toMatchObject({ path: parallel.filePath });
	});

	it("reads current frontmatter for edit without mutating before Save", () => {
		const { plugin, frontmatterByPath } = createPlugin({
			people: [alice],
			relationships: [{ ...relationship, types: ["old"] }],
		});
		frontmatterByPath.set(
			relationship.filePath,
			relationshipFrontmatter(relationship, {
				relationship_types: ["friend", "mentor"],
				from_role: "mentor",
				to_role: "mentee",
				status: "active",
				since: "2024-01-02",
			}),
		);
		const updateRelationship = vi.spyOn(plugin.mutations, "updateRelationship");
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		expect(plugin.openEditRelationship(relationship.filePath)).toBe(true);

		expect(updateRelationship).not.toHaveBeenCalled();
		const modal = open.mock.instances[0] as unknown as {
			values: {
				types: string;
				fromRole: string;
				toRole: string;
				status: string;
				since: string;
			};
		};
		expect(modal.values).toMatchObject({
			types: "friend, mentor",
			fromRole: "mentor",
			toRole: "mentee",
			status: "active",
			since: "2024-01-02",
		});
	});

	it("returns focus through the supplied modal-close callback", () => {
		const { plugin } = createPlugin({ people: [alice], relationships: [relationship] });
		const afterClose = vi.fn();
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		expect(plugin.openEditRelationship(relationship.filePath, afterClose)).toBe(true);
		const modal = open.mock.instances[0] as RelationshipModal;
		Object.defineProperty(modal, "contentEl", { value: { replaceChildren: vi.fn() } });
		modal.onClose();

		expect(afterClose).toHaveBeenCalledOnce();
	});

	it("denies deleted, renamed, noncanonical and path-ambiguous targets without navigation", async () => {
		const harness = createPlugin({ people: [alice], relationships: [relationship] });
		const updateRelationship = vi.spyOn(harness.plugin.mutations, "updateRelationship");
		expect(harness.plugin.canOpenRelationship(relationship.filePath)).toBe(true);

		harness.files.delete(relationship.filePath);
		harness.files.set("People/Relationships/Renamed.md", markdownFile("People/Relationships/Renamed.md"));
		await expect(harness.plugin.openRelationship(relationship.filePath)).resolves.toBe(false);
		expect(harness.plugin.openEditRelationship(relationship.filePath)).toBe(false);
		expect(harness.openFile).not.toHaveBeenCalled();
		expect(updateRelationship).not.toHaveBeenCalled();
		expect(notices.at(-1)).toContain("no longer available");

		const noncanonical = createPlugin({ people: [alice], relationships: [relationship] });
		noncanonical.frontmatterByPath.set(relationship.filePath, {
			type: "person",
			person_id: "replacement",
		});
		expect(noncanonical.plugin.canOpenRelationship(relationship.filePath)).toBe(false);
		expect(noncanonical.plugin.openEditRelationship(relationship.filePath)).toBe(false);

		const ambiguous = createPlugin({
			people: [alice],
			relationships: [relationship, { ...relationship, types: ["duplicate-path"] }],
		});
		expect(ambiguous.plugin.canOpenRelationship(relationship.filePath)).toBe(false);
		expect(ambiguous.plugin.openEditRelationship(relationship.filePath)).toBe(false);

		const duplicateIdAcrossPaths = createPlugin({
			people: [alice],
			relationships: [
				relationship,
				{
					...relationship,
					filePath: "People/Relationships/Alice - Bob duplicate ID.md",
					types: ["duplicate-id"],
				},
			],
		});
		expect(duplicateIdAcrossPaths.plugin.canOpenRelationship(relationship.filePath)).toBe(false);
		expect(duplicateIdAcrossPaths.plugin.openEditRelationship(relationship.filePath)).toBe(false);
	});

	it("denies a stale row when relationship identity changed before the index caught up", () => {
		const { plugin, frontmatterByPath } = createPlugin({
			people: [alice],
			relationships: [relationship],
		});
		frontmatterByPath.set(
			relationship.filePath,
			relationshipFrontmatter(relationship, { relationship_id: "replacement-id" }),
		);
		const open = vi.spyOn(RelationshipModal.prototype, "open");

		expect(plugin.openEditRelationship(relationship.filePath)).toBe(false);
		expect(open).not.toHaveBeenCalled();
		expect(notices.at(-1)).toContain("no longer available");
	});
});
