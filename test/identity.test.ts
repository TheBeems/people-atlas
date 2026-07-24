import { describe, expect, it } from "vitest";
import { normalizePathIdentity, personIdFromPath, resolvePersonId, resolveRelationshipId } from "../src/domain/identity";

describe("identity", () => {
	it("normalizes file paths deterministically", () => {
		expect(normalizePathIdentity(" /People\\Alice.md ")).toBe("people/alice.md");
	});

	it("prefers explicit person IDs", () => {
		expect(resolvePersonId(" alice-1 ", "People/Alice.md")).toBe("alice-1");
	});

	it("falls back to a path identity", () => {
		expect(resolvePersonId(undefined, "People/Alice.md")).toBe(personIdFromPath("People/Alice.md"));
	});

	it("prefers an explicit relationship ID and falls back to its path", () => {
		expect(resolveRelationshipId(" relationship-1 ", "Relationships/Alice-Bob.md")).toBe("relationship-1");
		expect(resolveRelationshipId(undefined, "Relationships/Alice-Bob.md")).toBe("relationship:relationships/alice-bob.md");
	});
});
