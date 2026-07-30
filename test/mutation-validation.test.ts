import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import {
	sanitizeNoteName,
	validateNotePath,
	validatePersonInput,
	validateRelationshipInput,
} from "../src/mutations/validation";

describe("mutation validation", () => {
	it("accepts a valid person and sanitizes only the filename", () => {
		expect(validatePersonInput({ name: "Jan Jansen" }, DEFAULT_SETTINGS)).toEqual([]);
		expect(sanitizeNoteName("Jan: Jansen? ")).toBe("Jan- Jansen");
	});

	it("rejects invalid relationship values before a write", () => {
		const errors = validateRelationshipInput(
			{
				path: "Relationships/Jan.md",
				from: "[[Jan]]",
				to: "[[Sam]]",
				direction: "invalid" as never,
				since: "2024-02-30",
				closeness: 6,
			},
			DEFAULT_SETTINGS,
		);

		expect(errors).toEqual(
			expect.arrayContaining([
				"Relationship direction is invalid.",
				"Relationship dates must use valid YYYY-MM-DD values.",
				"Closeness must be between 1 and 5.",
			]),
		);
	});

	it("rejects unsafe relationship paths", () => {
		expect(validateNotePath("../Relationships/Jan.md")).toBeTruthy();
		expect(validateNotePath("Relationships/Jan.txt")).toBeTruthy();
		expect(validateNotePath("Relationships/Jan.md")).toBeUndefined();
	});

	it("requires endpoint roles as an explicit pair", () => {
		expect(
			validateRelationshipInput(
				{
					path: "Relationships/Jan.md",
					from: "[[Jan]]",
					to: "[[Sam]]",
					fromRole: "Brother",
				},
				DEFAULT_SETTINGS,
			),
		).toContain("Both endpoint roles must be provided or both omitted.");
		expect(
			validateRelationshipInput(
				{
					path: "Relationships/Jan.md",
					from: "[[Jan]]",
					to: "[[Sam]]",
					fromRole: "Brother",
					toRole: "Sister",
				},
				DEFAULT_SETTINGS,
			),
		).toEqual([]);
	});
});
