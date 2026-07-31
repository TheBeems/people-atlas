import { type App, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { RelationshipRecord } from "../src/domain/types";
import PeopleAtlasPlugin from "../src/main";
import { AtlasMutationService } from "../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import type { RelationshipPreset } from "../src/settings/relationship-presets";

const preset: RelationshipPreset = {
	id: "sibling",
	name: "Sibling",
	types: ["sibling"],
	fromRole: "Brother",
	toRole: "Sister",
};

function relationship(filePath: string): RelationshipRecord {
	return {
		id: filePath,
		filePath,
		from: { raw: "[[A]]", target: "A" },
		to: { raw: "[[B]]", target: "B" },
		presetId: preset.id,
		types: ["family"],
		fromRole: "Sibling",
		toRole: "Sibling",
	};
}

function createPlugin(relationships: RelationshipRecord[]): {
	plugin: PeopleAtlasPlugin;
	content: Map<string, string>;
	frontmatter: Map<string, Record<string, unknown>>;
	hostCommitCount: { current: number };
	processFrontMatter: ReturnType<typeof vi.fn>;
} {
	const plugin = new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
	plugin.settings = { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [preset] };
	const files = new Map(
		relationships.map((record) => {
			const file = new TFile();
			file.path = record.filePath;
			return [record.filePath, file] as const;
		}),
	);
	const content = new Map(
		relationships.map((record) => [
			record.filePath,
			`---\ntype: relationship\n---\n\nBody for ${record.filePath} stays intact.\n`,
		]),
	);
	const frontmatter = new Map(
		relationships.map((record) => [
			record.filePath,
			{
				type: "relationship",
				relationship_id: record.id,
				from: record.from.raw,
				to: record.to.raw,
				relationship_preset: record.presetId,
				relationship_types: [...record.types],
				from_role: record.fromRole,
				to_role: record.toRole,
				custom: `keep:${record.filePath}`,
			},
		]),
	);
	let failPath: string | undefined = "Relationships/B.md";
	const hostCommitCount = { current: 0 };
	const processFrontMatter = vi.fn(
		async (file: TFile, callback: (liveFrontmatter: Record<string, unknown>) => void) => {
			if (file.path === failPath) {
				failPath = undefined;
				throw new Error("simulated write failure");
			}
			const liveFrontmatter = frontmatter.get(file.path);
			if (!liveFrontmatter) throw new Error("missing live frontmatter");
			const draft = structuredClone(liveFrontmatter);
			callback(draft);
			hostCommitCount.current += 1;
			frontmatter.set(file.path, draft);
			content.set(
				file.path,
				`${content.get(file.path) ?? ""}<!-- simulated host commit ${hostCommitCount.current} -->\n`,
			);
			const record = relationships.find((candidate) => candidate.filePath === file.path);
			if (record) {
				record.types = [...((draft.relationship_types as string[] | undefined) ?? [])];
				record.fromRole = typeof draft.from_role === "string" ? draft.from_role : undefined;
				record.toRole = typeof draft.to_role === "string" ? draft.to_role : undefined;
			}
		},
	);
	const app = {
		vault: { getAbstractFileByPath: (path: string) => files.get(path) },
		metadataCache: { getFileCache: () => undefined },
		fileManager: { processFrontMatter },
	} as unknown as App;
	const mutations = new AtlasMutationService(
		app,
		() => plugin.settings,
		() => true,
		{
			getPeoplePathsById: () => [],
			getRelationshipPathsById: () => [],
		},
	);
	Object.defineProperty(plugin, "index", {
		value: { getSnapshot: () => ({ people: [], relationships, diagnostics: [] }) },
	});
	Object.defineProperty(plugin, "mutations", { value: mutations });
	Object.defineProperty(plugin, "app", { value: app });
	return { plugin, content, frontmatter, hostCommitCount, processFrontMatter };
}

function updatedPaths(processFrontMatter: ReturnType<typeof vi.fn>): string[] {
	return processFrontMatter.mock.calls.map(([file]) => (file as TFile).path);
}

describe("relationship preset bulk synchronization", () => {
	it("stops at the first failure and resumes idempotently from a fresh preview", async () => {
		const relationships = [
			relationship("Relationships/A.md"),
			relationship("Relationships/B.md"),
			relationship("Relationships/C.md"),
		];
		const { hostCommitCount, plugin, processFrontMatter } = createPlugin(relationships);
		const firstPreview = plugin.getRelationshipPresetSyncChanges(preset.id);

		const first = await plugin.syncRelationshipPreset(preset.id, firstPreview);
		expect(first).toEqual({
			completed: 1,
			skipped: 0,
			remaining: 2,
			failure: {
				filePath: "Relationships/B.md",
				message: "simulated write failure",
			},
		});
		expect(updatedPaths(processFrontMatter)).toEqual(["Relationships/A.md", "Relationships/B.md"]);

		const secondPreview = plugin.getRelationshipPresetSyncChanges(preset.id);
		expect(secondPreview.map((change) => change.filePath)).toEqual(["Relationships/B.md", "Relationships/C.md"]);
		const second = await plugin.syncRelationshipPreset(preset.id, secondPreview);

		expect(second).toEqual({ completed: 2, skipped: 0, remaining: 0 });
		expect(processFrontMatter).toHaveBeenCalledTimes(4);
		expect(hostCommitCount.current).toBe(3);
		expect(plugin.getRelationshipPresetSyncChanges(preset.id)).toEqual([]);
	});

	it("refuses a newer live-frontmatter value even while the index remains at the approved preview", async () => {
		const relationships = [relationship("Relationships/A.md")];
		const { content, frontmatter, hostCommitCount, plugin, processFrontMatter } = createPlugin(relationships);
		const preview = plugin.getRelationshipPresetSyncChanges(preset.id);
		const liveFrontmatter = frontmatter.get("Relationships/A.md");
		if (!liveFrontmatter) throw new Error("Test frontmatter is missing.");
		liveFrontmatter.from_role = "Cousin";
		const before = structuredClone(liveFrontmatter);
		const contentBefore = content.get("Relationships/A.md");

		const result = await plugin.syncRelationshipPreset(preset.id, preview);

		expect(result).toEqual({
			completed: 0,
			skipped: 0,
			remaining: 1,
			failure: {
				filePath: "Relationships/A.md",
				message: "The relationship changed after this preview was opened. Review a new preview.",
			},
		});
		expect(processFrontMatter).toHaveBeenCalledOnce();
		expect(hostCommitCount.current).toBe(0);
		expect(frontmatter.get("Relationships/A.md")).toEqual(before);
		expect(content.get("Relationships/A.md")).toBe(contentBefore);
		expect(relationships[0]?.fromRole).toBe("Sibling");
	});

	it("treats a live after-state as already current across retries while the index still shows before", async () => {
		const relationships = [relationship("Relationships/A.md")];
		const { content, frontmatter, hostCommitCount, plugin, processFrontMatter } = createPlugin(relationships);
		const preview = plugin.getRelationshipPresetSyncChanges(preset.id);
		const liveFrontmatter = frontmatter.get("Relationships/A.md");
		if (!liveFrontmatter) throw new Error("Test frontmatter is missing.");
		liveFrontmatter.relationship_types = [...preset.types];
		liveFrontmatter.from_role = preset.fromRole;
		liveFrontmatter.to_role = preset.toRole;
		const before = structuredClone(liveFrontmatter);
		const contentBefore = content.get("Relationships/A.md");

		const first = await plugin.syncRelationshipPreset(preset.id, preview);
		const retry = await plugin.syncRelationshipPreset(preset.id, preview);

		expect(first).toEqual({ completed: 0, skipped: 1, remaining: 0 });
		expect(retry).toEqual({ completed: 0, skipped: 1, remaining: 0 });
		expect(processFrontMatter).toHaveBeenCalledTimes(2);
		expect(hostCommitCount.current).toBe(0);
		expect(frontmatter.get("Relationships/A.md")).toEqual(before);
		expect(content.get("Relationships/A.md")).toBe(contentBefore);
		expect(relationships[0]).toMatchObject({
			types: ["family"],
			fromRole: "Sibling",
			toRole: "Sibling",
		});
	});

	it("rejects a live note that changed type even when its owned values already equal after", async () => {
		const relationships = [relationship("Relationships/A.md")];
		const { content, frontmatter, hostCommitCount, plugin, processFrontMatter } = createPlugin(relationships);
		const preview = plugin.getRelationshipPresetSyncChanges(preset.id);
		const liveFrontmatter = frontmatter.get("Relationships/A.md");
		if (!liveFrontmatter) throw new Error("Test frontmatter is missing.");
		liveFrontmatter.type = "person";
		liveFrontmatter.relationship_types = [...preset.types];
		liveFrontmatter.from_role = preset.fromRole;
		liveFrontmatter.to_role = preset.toRole;
		const before = structuredClone(liveFrontmatter);
		const contentBefore = content.get("Relationships/A.md");

		const result = await plugin.syncRelationshipPreset(preset.id, preview);

		expect(result).toEqual({
			completed: 0,
			skipped: 0,
			remaining: 1,
			failure: {
				filePath: "Relationships/A.md",
				message: "The relationship changed after this preview was opened. Review a new preview.",
			},
		});
		expect(processFrontMatter).toHaveBeenCalledOnce();
		expect(hostCommitCount.current).toBe(0);
		expect(frontmatter.get("Relationships/A.md")).toEqual(before);
		expect(content.get("Relationships/A.md")).toBe(contentBefore);
	});
});
