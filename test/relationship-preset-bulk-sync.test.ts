import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { RelationshipRecord } from "../src/domain/types";
import PeopleAtlasPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import type { RelationshipPreset } from "../src/settings/relationship-presets";

const preset: RelationshipPreset = {
	id: "sibling",
	name: "Sibling",
	types: ["sibling"],
	direction: "undirected",
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
		direction: "source-to-target",
		fromRole: "Sibling",
		toRole: "Sibling",
	};
}

function createPlugin(relationships: RelationshipRecord[]): {
	plugin: PeopleAtlasPlugin;
	updateRelationship: ReturnType<typeof vi.fn>;
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
	let failPath: string | undefined = "Relationships/B.md";
	const updateRelationship = vi.fn(async (file: TFile) => {
		if (file.path === failPath) {
			failPath = undefined;
			throw new Error("simulated write failure");
		}
		const record = relationships.find((candidate) => candidate.filePath === file.path);
		if (record) {
			record.types = [...preset.types];
			record.direction = preset.direction;
			record.fromRole = preset.fromRole;
			record.toRole = preset.toRole;
		}
	});
	Object.defineProperty(plugin, "index", {
		value: { getSnapshot: () => ({ people: [], relationships, diagnostics: [] }) },
	});
	Object.defineProperty(plugin, "mutations", { value: { updateRelationship } });
	Object.defineProperty(plugin, "app", {
		value: { vault: { getAbstractFileByPath: (path: string) => files.get(path) } },
	});
	return { plugin, updateRelationship };
}

describe("relationship preset bulk synchronization", () => {
	it("stops at the first failure and resumes idempotently from a fresh preview", async () => {
		const relationships = [
			relationship("Relationships/A.md"),
			relationship("Relationships/B.md"),
			relationship("Relationships/C.md"),
		];
		const { plugin, updateRelationship } = createPlugin(relationships);
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
		expect(updateRelationship.mock.calls.map(([file]) => (file as TFile).path)).toEqual([
			"Relationships/A.md",
			"Relationships/B.md",
		]);

		const secondPreview = plugin.getRelationshipPresetSyncChanges(preset.id);
		expect(secondPreview.map((change) => change.filePath)).toEqual(["Relationships/B.md", "Relationships/C.md"]);
		const second = await plugin.syncRelationshipPreset(preset.id, secondPreview);

		expect(second).toEqual({ completed: 2, skipped: 0, remaining: 0 });
		expect(plugin.getRelationshipPresetSyncChanges(preset.id)).toEqual([]);
	});

	it("refuses to overwrite a relationship that changed after the approved preview", async () => {
		const relationships = [relationship("Relationships/A.md")];
		const { plugin, updateRelationship } = createPlugin(relationships);
		const preview = plugin.getRelationshipPresetSyncChanges(preset.id);
		if (!relationships[0]) throw new Error("Test relationship is missing.");
		relationships[0].fromRole = "Cousin";

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
		expect(updateRelationship).not.toHaveBeenCalled();
	});
});
