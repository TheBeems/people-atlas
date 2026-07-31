import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import {
	sanitizeNoteName,
	validateNotePath,
	validatePersonInput,
	validatePersonUpdates,
	validateRelationshipInput,
} from "../src/mutations/validation";

describe("mutation validation", () => {
	it("accepts a valid person and sanitizes only the filename", () => {
		expect(validatePersonInput({ name: "Jan Jansen" }, DEFAULT_SETTINGS)).toEqual([]);
		expect(sanitizeNoteName("Jan: Jansen? ")).toBe("Jan- Jansen");
	});

	it("validates only provided person profile values", () => {
		expect(
			validatePersonInput(
				{
					name: "Jan Jansen",
					birthDate: "--02-29",
					emails: ["Jan@example.com"],
					phones: ["+31 (0)20 123"],
				},
				DEFAULT_SETTINGS,
			),
		).toEqual([]);
		expect(
			validatePersonInput(
				{
					name: "Jan Jansen",
					birthDate: "2023-02-29",
					emails: ["missing-at", "ALICE@example.com", "alice@example.com"],
					phones: ["+31 20", "+31 20"],
				},
				DEFAULT_SETTINGS,
			),
		).toEqual(
			expect.arrayContaining([
				"Birth date must be a calendar-valid YYYY-MM-DD or --MM-DD value.",
				expect.stringContaining("Email address 1"),
				expect.stringContaining("Email address 3"),
				expect.stringContaining("Phone number 2"),
			]),
		);
		expect(validatePersonUpdates({ aliases: ["Unrelated"] })).toEqual([]);
		expect(validatePersonUpdates({ emails: ["invalid"] })).toEqual([expect.stringContaining("Email address 1")]);
	});

	it("rejects collisions across every configured person property", () => {
		expect(
			validatePersonInput(
				{ name: "Jan" },
				{
					...DEFAULT_SETTINGS,
					emailsProperty: DEFAULT_SETTINGS.nameProperty,
				},
			),
		).toContain("Person type, identity, name and profile properties must be distinct.");
	});

	it("rejects invalid relationship values before a write", () => {
		const errors = validateRelationshipInput(
			{
				path: "Relationships/Jan.md",
				from: "[[Jan]]",
				to: "[[Sam]]",
				since: "2024-02-30",
				closeness: 6,
			},
			DEFAULT_SETTINGS,
		);

		expect(errors).toEqual(
			expect.arrayContaining([
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
