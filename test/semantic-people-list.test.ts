import { describe, expect, it } from "vitest";
import type { AtlasNode } from "../src/domain/types";
import { matchesPersonSearch, normalizeSearchText } from "../src/render/semantic-people-list";

const person: AtlasNode = {
	id: "person-alice",
	personId: "person-alice",
	kind: "person",
	label: "Élodie van Dijk",
	aliases: ["Lodie", "Research alias"],
	filePath: "People/Elodie van Dijk.md",
	jobTitle: "Hoofd Onderzoek",
	organisations: ["Université de Lyon"],
	emails: ["elodie@example.com"],
	phones: ["+31 (6) 12-34 56 78"],
	isCenter: false,
};

describe("semantic people search", () => {
	it("normalizes case, accents and surrounding whitespace", () => {
		expect(normalizeSearchText("  ÉLODIE  ")).toBe("elodie");
		expect(matchesPersonSearch(person, "  lyon ")).toBe(true);
		expect(matchesPersonSearch(person, "onderzoek")).toBe(true);
	});

	it("searches names, canonical aliases, email and phone independently of identity", () => {
		expect(matchesPersonSearch(person, "elodie")).toBe(true);
		expect(matchesPersonSearch(person, "example.com")).toBe(true);
		expect(matchesPersonSearch(person, "alias")).toBe(true);
		expect(matchesPersonSearch(person, "31612345678")).toBe(true);
		expect(matchesPersonSearch(person, "+31 6 1234 5678")).toBe(true);
		expect(matchesPersonSearch(person, "wrong12345678")).toBe(false);
		expect(matchesPersonSearch(person, person.id)).toBe(false);
		expect(matchesPersonSearch(person, "   ")).toBe(true);
	});
});
