import { describe, expect, it } from "vitest";
import { parsePersonReference } from "../src/domain/wikilink";

describe("parsePersonReference", () => {
	it("parses a wikilink", () => {
		expect(parsePersonReference("[[People/Alice]]")).toEqual({
			raw: "[[People/Alice]]",
			target: "People/Alice",
			kind: "wikilink",
		});
	});

	it("parses a wikilink alias", () => {
		expect(parsePersonReference("[[People/Alice|Alice]]")).toEqual({
			raw: "[[People/Alice|Alice]]",
			target: "People/Alice",
			label: "Alice",
			kind: "wikilink",
		});
	});

	it.each([
		["alice-1", "id"],
		["People/Alice", "path"],
		["People/Alice.md", "path"],
	] as const)("classifies an unwrapped reference %j as %s", (raw, kind) => {
		expect(parsePersonReference(raw)).toMatchObject({ raw, target: raw, kind });
	});
});
