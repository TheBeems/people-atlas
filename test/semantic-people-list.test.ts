import { describe, expect, it } from "vitest";
import type { AtlasNode } from "../src/domain/types";
import { matchesPersonSearch, normalizeSearchText } from "../src/render/semantic-people-list";

const person: AtlasNode = {
	id: "person-alice",
	personId: "person-alice",
	kind: "person",
	label: "Élodie van Dijk",
	filePath: "People/Elodie van Dijk.md",
	jobTitle: "Hoofd Onderzoek",
	organisations: ["Université de Lyon"],
	emails: ["elodie@example.com"],
	phones: [],
	isCenter: false,
};

describe("semantic people search", () => {
	it("normalizes case, accents and surrounding whitespace", () => {
		expect(normalizeSearchText("  ÉLODIE  ")).toBe("elodie");
		expect(matchesPersonSearch(person, "  lyon ")).toBe(true);
		expect(matchesPersonSearch(person, "onderzoek")).toBe(true);
	});

	it("searches only visible person fields", () => {
		expect(matchesPersonSearch(person, "elodie")).toBe(true);
		expect(matchesPersonSearch(person, "example.com")).toBe(false);
		expect(matchesPersonSearch(person, "alias")).toBe(false);
		expect(matchesPersonSearch(person, "   ")).toBe(true);
	});
});
