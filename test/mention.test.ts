import { describe, expect, it } from "vitest";
import { findMentionTrigger, formatMentionLink } from "../src/editor/mention";

describe("person mention parsing", () => {
	it("finds an @ trigger in ordinary prose", () => {
		const result = findMentionTrigger(["Discussed this with @Jan Jansen"], { line: 0, ch: 31 });

		expect(result).toEqual({
			start: { line: 0, ch: 20 },
			end: { line: 0, ch: 31 },
			query: "Jan Jansen",
		});
	});

	it("ignores email addresses, frontmatter, fenced code and open wikilinks", () => {
		expect(findMentionTrigger(["mail jan@example.com"], { line: 0, ch: 19 })).toBeNull();
		expect(findMentionTrigger(["---", "note: @Jan", "---"], { line: 1, ch: 10 })).toBeNull();
		expect(findMentionTrigger(["```", "@Jan", "```"], { line: 1, ch: 4 })).toBeNull();
		expect(findMentionTrigger(["See [[@Jan"], { line: 0, ch: 10 })).toBeNull();
	});

	it("formats a normal Markdown wikilink with an @ display alias", () => {
		expect(formatMentionLink("People/Jan Jansen.md", "Jan Jansen")).toBe("[[People/Jan Jansen|@Jan Jansen]]");
	});
});
