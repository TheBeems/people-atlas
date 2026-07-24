import { describe, expect, it } from "vitest";
import { parsePersonReference } from "../src/domain/wikilink";

describe("parsePersonReference", () => {
	it("parses a wikilink", () => {
		expect(parsePersonReference("[[People/Alice]]")).toEqual({
			raw: "[[People/Alice]]",
			target: "People/Alice",
		});
	});

	it("parses a wikilink alias", () => {
		expect(parsePersonReference("[[People/Alice|Alice]]")).toEqual({
			raw: "[[People/Alice|Alice]]",
			target: "People/Alice",
			label: "Alice",
		});
	});

	it("accepts an explicit person ID", () => {
		expect(parsePersonReference("alice-1")?.target).toBe("alice-1");
	});
});
