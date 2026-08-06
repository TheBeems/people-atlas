import { describe, expect, it } from "vitest";
import type { AtlasNode } from "../src/domain/types";
import { createTranslator } from "../src/i18n";
import { buildPersonProfilePresentation } from "../src/render/person-profile";

function node(overrides: Partial<AtlasNode> = {}): AtlasNode {
	return {
		id: "person-alice",
		personId: "person-alice",
		kind: "person",
		label: "Alice",
		filePath: "People/Alice.md",
		organisations: [],
		emails: [],
		phones: [],
		isCenter: false,
		...overrides,
	};
}

describe("person profile presentation", () => {
	it("keeps only present fields in the ratified order and marks a missing birth year explicitly", () => {
		const presentation = buildPersonProfilePresentation(
			node({
				pronouns: " she/her ",
				jobTitle: " Principal engineer ",
				organisations: [" Example Org ", "Community Lab"],
				birthDate: "--02-29",
				gender: " Woman ",
				emails: [" alice@example.com ", "alice@work.example"],
				phones: [" +31 6 12 34 56 78 "],
			}),
		);

		expect(presentation.profileFields).toEqual([
			{ key: "pronouns", label: "Pronouns", values: ["she/her"], linkScheme: undefined },
			{ key: "job-title", label: "Job title", values: ["Principal engineer"], linkScheme: undefined },
			{
				key: "organisations",
				label: "Organisations",
				values: ["Example Org", "Community Lab"],
				linkScheme: undefined,
			},
			{ key: "birth-date", label: "Birth date", values: ["February 29 (year unknown)"], linkScheme: undefined },
			{ key: "gender", label: "Gender", values: ["Woman"], linkScheme: undefined },
		]);
		expect(presentation.contactFields).toEqual([
			{
				key: "emails",
				label: "Email",
				values: ["alice@example.com", "alice@work.example"],
				linkScheme: "mailto",
			},
			{ key: "phones", label: "Phone", values: ["+31 6 12 34 56 78"], linkScheme: "tel" },
		]);
	});

	it("omits absent values and accepts calendar-valid full and yearless leap days only", () => {
		expect(buildPersonProfilePresentation(node())).toEqual({ profileFields: [], contactFields: [] });
		expect(buildPersonProfilePresentation(node({ birthDate: "2000-02-29" })).profileFields).toEqual([
			{ key: "birth-date", label: "Birth date", values: ["February 29, 2000"], linkScheme: undefined },
		]);
		expect(buildPersonProfilePresentation(node({ birthDate: "--02-29" })).profileFields).toEqual([
			{ key: "birth-date", label: "Birth date", values: ["February 29 (year unknown)"], linkScheme: undefined },
		]);
		expect(
			buildPersonProfilePresentation(node({ birthDate: "--02-29" }), createTranslator("nl")).profileFields,
		).toEqual([
			{ key: "birth-date", label: "Geboortedatum", values: ["29 februari (jaar onbekend)"], linkScheme: undefined },
		]);
		for (const birthDate of ["1900-02-29", "--02-30", "0000-01-01", "July 30"]) {
			expect(buildPersonProfilePresentation(node({ birthDate })).profileFields).toEqual([]);
		}
	});

	it("does not create placeholder rows for whitespace-only text or contact entries", () => {
		expect(
			buildPersonProfilePresentation(
				node({
					pronouns: " ",
					jobTitle: "\t",
					gender: "\n",
					organisations: ["", "  "],
					emails: [" "],
					phones: ["\t"],
				}),
			),
		).toEqual({ profileFields: [], contactFields: [] });
	});
});
