import type { App, EditorSuggestContext, TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findMentionTrigger, formatMentionLink } from "../src/editor/mention";
import { PersonMentionSuggest } from "../src/editor/person-mention-suggest";
import type { AtlasMutationService } from "../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

afterEach(() => {
	vi.restoreAllMocks();
});

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

	it("plans one explicit UUID-backed person ID before an @ create action writes", async () => {
		vi.spyOn(crypto, "randomUUID").mockReturnValue("12345678-90ab-4cde-8f01-23456789abcd");
		const createdFile = { path: "People/Profiles/zoe-example--12345678/Zoë Example.md" } as TFile;
		const createPerson = vi.fn(async () => createdFile);
		const replaceRange = vi.fn();
		const suggest = new PersonMentionSuggest(
			{} as App,
			{ getSnapshot: () => ({ people: [], relationships: [], contactMoments: [], diagnostics: [] }) },
			{ createPerson } as unknown as AtlasMutationService,
			() => DEFAULT_SETTINGS,
		);
		const context = {
			editor: { replaceRange },
			start: { line: 0, ch: 0 },
			end: { line: 0, ch: 12 },
			query: "Zoë Example",
		} as unknown as EditorSuggestContext;
		(suggest as unknown as { context: EditorSuggestContext }).context = context;

		suggest.selectSuggestion({ kind: "create", name: "Zoë Example" }, {} as KeyboardEvent);

		await vi.waitFor(() =>
			expect(createPerson).toHaveBeenCalledExactlyOnceWith({
				name: "Zoë Example",
				personId: "person-12345678-90ab-4cde-8f01-23456789abcd",
				reviewedPath: "People/Profiles/zoe-example--12345678/Zoë Example.md",
			}),
		);
		expect(replaceRange).toHaveBeenCalledExactlyOnceWith(
			"[[People/Profiles/zoe-example--12345678/Zoë Example|@Zoë Example]]",
			context.start,
			context.end,
			"people-atlas-mention",
		);
	});
});
