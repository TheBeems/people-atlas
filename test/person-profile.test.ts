import { describe, expect, it } from "vitest";
import {
	formatPersonBirthDate,
	formatPersonBirthDateForDisplay,
	parsePersonBirthDate,
	validatePersonEmail,
	validatePersonEmails,
	validatePersonPhones,
} from "../src/domain/person-profile";

describe("person profile values", () => {
	it("accepts calendar-valid full and yearless birth dates", () => {
		expect(parsePersonBirthDate("0001-01-01")).toMatchObject({
			valid: true,
			value: "0001-01-01",
			parts: { year: 1, month: 1, day: 1 },
		});
		expect(parsePersonBirthDate("9999-12-31")).toMatchObject({ valid: true });
		expect(parsePersonBirthDate("2000-02-29")).toMatchObject({ valid: true });
		expect(parsePersonBirthDate("--02-29")).toMatchObject({
			valid: true,
			value: "--02-29",
			parts: { month: 2, day: 29 },
		});
		expect(formatPersonBirthDate({ year: 1990, month: 7, day: 30 })).toBe("1990-07-30");
		expect(formatPersonBirthDate({ month: 7, day: 30 })).toBe("--07-30");
		expect(formatPersonBirthDateForDisplay("--07-30")).toBe("07-30 (year unknown)");
	});

	it.each([
		"0000-01-01",
		"1900-02-29",
		"2025-02-29",
		"--02-30",
		"--04-31",
		"07-30",
		"2025",
		"2025-07-30T00:00:00Z",
		" 1990-07-30",
		"1990-07-30 ",
		" --02-29",
		"--02-29 ",
	])("rejects invalid birth date %s without guessing", (value) => {
		expect(parsePersonBirthDate(value)).toMatchObject({ valid: false, raw: value });
	});

	it("preserves non-text invalid raw birth data for explicit repair", () => {
		const raw = { year: 1990, month: 7, day: 30 };
		expect(parsePersonBirthDate(raw)).toEqual({
			valid: false,
			raw,
			error: "Birth date must be a calendar-valid YYYY-MM-DD or --MM-DD value.",
		});
		expect(formatPersonBirthDate({ year: 0, month: 7, day: 30 })).toBeUndefined();
	});

	it("validates emails minimally and removes invalid or case-insensitive duplicates from validated values", () => {
		expect(validatePersonEmail(" local@example.test ")).toBeUndefined();
		expect(validatePersonEmail("local@@example.test")).toContain("one @");
		expect(validatePersonEmail(" @example.test")).toContain("non-whitespace");
		expect(validatePersonEmail("local@ ")).toContain("non-whitespace");
		for (const value of [
			"local name@example.test",
			"local\tname@example.test",
			"local@\r\nexample.test",
			"local@@example.test",
		]) {
			expect(validatePersonEmail(value)).toMatch(/one @.*non-whitespace/);
		}

		expect(
			validatePersonEmails([" First@Example.test ", "second@example.test", "first@example.test", "missing-at"]),
		).toEqual({
			values: ["First@Example.test", "second@example.test"],
			issues: [
				{ index: 2, message: "Duplicate email addresses are not allowed." },
				{
					index: 3,
					message: expect.stringMatching(/one @.*non-whitespace/),
				},
			],
		});
	});

	it("preserves phone formatting and rejects only empty or exact trimmed duplicates", () => {
		expect(validatePersonPhones([" +31 (0)6 12 34 56 78 ", "+1-555-0100", "+31 (0)6 12 34 56 78", ""])).toEqual({
			values: ["+31 (0)6 12 34 56 78", "+1-555-0100"],
			issues: [
				{ index: 2, message: "Duplicate phone numbers are not allowed." },
				{ index: 3, message: "Enter a phone number or remove this entry." },
			],
		});
		expect(validatePersonPhones(["ABC", "abc"]).values).toEqual(["ABC", "abc"]);
	});
});
