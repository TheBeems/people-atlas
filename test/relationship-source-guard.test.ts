import { describe, expect, it } from "vitest";
import {
	captureRelationshipEditSourceBaseline,
	relationshipEditSourceMatches,
} from "../src/mutations/relationship-source-guard";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

const path = "Relationships/Alice-Bob.md";
const source = {
	type: "relationship",
	relationship_id: "rel-original",
	from: "[[People/Alice]]",
	to: "[[People/Bob]]",
	relationship_types: ["friend"],
	closeness: 2,
	custom: "keep",
};

describe("relationship edit source guard", () => {
	it.each([
		["type", "person"],
		["relationship_id", "rel-replacement"],
		["from", "[[People/Charlie]]"],
		["to", "[[People/Charlie]]"],
		["relationship_types", ["colleague"]],
		["relationship_preset", "new-preset"],
		["from_role", "manager"],
		["to_role", "colleague"],
		["closeness", 5],
		["since", "2026-10-01"],
		["until", "2026-10-03"],
		["contact_interval_days", 30],
		["last_contact", "2026-10-02"],
		["status", "ended"],
	])("detects a changed owned property %s", (property, value) => {
		const baseline = captureRelationshipEditSourceBaseline(path, source, DEFAULT_SETTINGS);
		expect(relationshipEditSourceMatches(path, { ...source, [property]: value }, DEFAULT_SETTINGS, baseline)).toBe(
			false,
		);
	});

	it("preserves unrelated changes and ignores property enumeration order", () => {
		const baseline = captureRelationshipEditSourceBaseline(path, source, DEFAULT_SETTINGS);
		const reordered = Object.fromEntries(Object.entries({ ...source, custom: "updated", extra: true }).reverse());
		expect(relationshipEditSourceMatches(path, reordered, DEFAULT_SETTINGS, baseline)).toBe(true);
		expect(relationshipEditSourceMatches("Relationships/Renamed.md", source, DEFAULT_SETTINGS, baseline)).toBe(false);
	});

	it("captures detached values and detects null versus absent fields", () => {
		const current = structuredClone(source);
		const baseline = captureRelationshipEditSourceBaseline(path, current, DEFAULT_SETTINGS);
		current.relationship_types.push("changed");
		expect(relationshipEditSourceMatches(path, current, DEFAULT_SETTINGS, baseline)).toBe(false);
		expect(relationshipEditSourceMatches(path, { ...source, status: null }, DEFAULT_SETTINGS, baseline)).toBe(false);
	});

	it("uses custom property mappings and rejects a changed mapping", () => {
		const settings = { ...DEFAULT_SETTINGS, typeProperty: "soort", relationshipIdProperty: "relatie_id" };
		const current = { ...source, soort: "relationship", relatie_id: "rel-original" };
		const baseline = captureRelationshipEditSourceBaseline(path, current, settings);
		expect(relationshipEditSourceMatches(path, { ...current, type: "unrelated" }, settings, baseline)).toBe(true);
		expect(relationshipEditSourceMatches(path, { ...current, relatie_id: "changed" }, settings, baseline)).toBe(false);
		expect(relationshipEditSourceMatches(path, current, DEFAULT_SETTINGS, baseline)).toBe(false);
	});

	it("rejects changed period/cadence mappings between opening and save", () => {
		const baseline = captureRelationshipEditSourceBaseline(path, source, DEFAULT_SETTINGS);
		expect(
			relationshipEditSourceMatches(path, source, { ...DEFAULT_SETTINGS, untilProperty: "end_date" }, baseline),
		).toBe(false);
		expect(
			relationshipEditSourceMatches(
				path,
				source,
				{ ...DEFAULT_SETTINGS, contactIntervalDaysProperty: "cadence" },
				baseline,
			),
		).toBe(false);
	});
});
