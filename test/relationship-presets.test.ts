import { describe, expect, it } from "vitest";
import type { RelationshipRecord } from "../src/domain/types";
import {
	formatRelationshipRole,
	relationshipPresetMatches,
	relationshipPresetSlug,
	validateRelationshipPreset,
	validateRelationshipRoleFormat,
	validateStoredRelationshipPresets,
	type RelationshipPreset,
} from "../src/settings/relationship-presets";
import {
	buildRelationshipPresetSyncChanges,
	relationshipPresetUpdates,
} from "../src/settings/relationship-preset-sync";

const preset: RelationshipPreset = {
	id: "parent-child",
	name: "Parent and child",
	types: ["parent-child"],
	fromRole: "Child",
	toRole: "Father",
};

function relationship(overrides: Partial<RelationshipRecord> = {}): RelationshipRecord {
	return {
		id: "relationship-1",
		filePath: "Relationships/Mathijs-Cor.md",
		from: { raw: "[[Mathijs]]", target: "Mathijs", kind: "wikilink" },
		to: { raw: "[[Cor]]", target: "Cor", kind: "wikilink" },
		presetId: preset.id,
		types: ["parent-child"],
		fromRole: "Child",
		toRole: "Father",
		...overrides,
	};
}

describe("relationship presets", () => {
	it("creates readable stable slugs and validates role formats", () => {
		expect(relationshipPresetSlug("  Broer / Zus  ")).toBe("broer-zus");
		expect(validateRelationshipRoleFormat("{role} van {person}")).toBeUndefined();
		expect(validateRelationshipRoleFormat("{role}")).toContain("{role} and {person}");
		expect(formatRelationshipRole("{role} van {person}", "Kind", "Cor")).toBe("Kind van Cor");
	});

	it("requires unique IDs, types and explicit endpoint roles", () => {
		expect(validateRelationshipPreset(preset)).toEqual([]);
		expect(validateRelationshipPreset({ ...preset, id: "Bad ID", toRole: "" }, [preset.id])).toEqual(
			expect.arrayContaining([
				"The template ID must be a lowercase slug containing only letters, numbers and hyphens.",
				"Both endpoint roles are required.",
			]),
		);
		expect(validateRelationshipPreset({ ...preset, types: ["family", "Family"] })).toContain(
			"Relationship types in a template must be unique.",
		);
		expect(validateStoredRelationshipPresets([{ ...preset, direction: "undirected" }])).toContain(
			"Template direction is not supported.",
		);
	});

	it("matches copied semantics and previews only linked differences", () => {
		expect(relationshipPresetMatches(relationship(), preset)).toBe(true);
		const changed = relationship({ fromRole: "Son" });
		const unrelated = relationship({ id: "relationship-2", filePath: "Relationships/Other.md", presetId: "other" });

		expect(buildRelationshipPresetSyncChanges([relationship(), changed, unrelated], preset)).toEqual([
			{
				filePath: changed.filePath,
				before: expect.objectContaining({ fromRole: "Son", toRole: "Father" }),
				after: expect.objectContaining({ fromRole: "Child", toRole: "Father" }),
			},
		]);
		expect(relationshipPresetUpdates(preset)).toEqual({
			types: ["parent-child"],
			fromRole: "Child",
			toRole: "Father",
		});
	});
});
