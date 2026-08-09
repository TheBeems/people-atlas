import type { App, EditorSuggestContext, TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findMentionTrigger, formatMentionLink } from "../src/editor/mention";
import { PersonMentionSuggest } from "../src/editor/person-mention-suggest";
import { createTranslator } from "../src/i18n";
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

	it("localizes the @ create suggestion while preserving the requested name and computed dossier path", () => {
		const suggest = new PersonMentionSuggest(
			{ vault: { getAllLoadedFiles: () => [] } } as unknown as App,
			{ getSnapshot: () => ({ people: [], relationships: [], contactMoments: [], diagnostics: [] }) },
			{ createPerson: vi.fn() } as unknown as AtlasMutationService,
			() => DEFAULT_SETTINGS,
			createTranslator("nl"),
		);
		const element = { createDiv: vi.fn() } as unknown as HTMLElement & { createDiv: ReturnType<typeof vi.fn> };

		suggest.renderSuggestion({ kind: "create", name: "Zoë Example" }, element);

		expect(element.createDiv).toHaveBeenCalledExactlyOnceWith({
			text: "Persoon “Zoë Example” aanmaken in People/Profiles/",
		});
	});

	it("renders only the person name for an existing @ suggestion", () => {
		const suggest = new PersonMentionSuggest(
			{ vault: { getAllLoadedFiles: () => [] } } as unknown as App,
			{
				getSnapshot: () => ({
					people: [
						{
							id: "person-123",
							filePath: "People/Profiles/Jan Jansen/Jan Jansen.md",
							name: "Jan Jansen",
							aliases: [],
							organisations: [],
							emails: [],
							phones: [],
							contacts: [],
						},
					],
					relationships: [],
					contactMoments: [],
					diagnostics: [],
				}),
			},
			{ createPerson: vi.fn() } as unknown as AtlasMutationService,
			() => DEFAULT_SETTINGS,
		);
		const element = { createDiv: vi.fn() } as unknown as HTMLElement & { createDiv: ReturnType<typeof vi.fn> };

		suggest.renderSuggestion(
			{
				kind: "person",
				name: "Jan Jansen",
				filePath: "People/Profiles/Jan Jansen/Jan Jansen.md",
				personId: "person-123",
			},
			element,
		);

		expect(element.createDiv).toHaveBeenCalledExactlyOnceWith({ text: "Jan Jansen" });
	});

	it("plans one explicit UUID-backed person ID before an @ create action writes", async () => {
		vi.spyOn(crypto, "randomUUID").mockReturnValue("12345678-90ab-4cde-8f01-23456789abcd");
		const createdFile = { path: "People/Profiles/Zoë Example/Zoë Example.md" } as TFile;
		const createPerson = vi.fn(async () => createdFile);
		const replaceRange = vi.fn();
		const suggest = new PersonMentionSuggest(
			{ vault: { getAllLoadedFiles: () => [] } } as unknown as App,
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
				reviewedPath: "People/Profiles/Zoë Example/Zoë Example.md",
			}),
		);
		expect(replaceRange).toHaveBeenCalledExactlyOnceWith(
			"[[People/Profiles/Zoë Example/Zoë Example|@Zoë Example]]",
			context.start,
			context.end,
			"people-atlas-mention",
		);
	});

	it("uses current index ownership and vault occupancy for an @ create collision preview", async () => {
		vi.spyOn(crypto, "randomUUID").mockReturnValue("7d9f4a12-6b3c-4d5e-8f90-123456789abc");
		const existingPath = "People/Profiles/Jan Jansen/Jan Jansen.md";
		const occupiedSuffixPath = "People/Profiles/Jan Jansen · FP/Notes.md";
		const createdFile = { path: "People/Profiles/Jan Jansen · FPF/Jan Jansen.md" } as TFile;
		const createPerson = vi.fn(async () => createdFile);
		const replaceRange = vi.fn();
		const suggest = new PersonMentionSuggest(
			{
				vault: {
					getAllLoadedFiles: () => [{ path: existingPath }, { path: occupiedSuffixPath }],
				},
			} as unknown as App,
			{
				getSnapshot: () => ({
					people: [
						{
							id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
							filePath: existingPath,
							name: "Jan Jansen",
							aliases: [],
							organisations: [],
							emails: [],
							phones: [],
							contacts: [],
						},
					],
					relationships: [],
					contactMoments: [],
					diagnostics: [],
				}),
			},
			{ createPerson } as unknown as AtlasMutationService,
			() => DEFAULT_SETTINGS,
		);
		const context = {
			editor: { replaceRange },
			start: { line: 0, ch: 0 },
			end: { line: 0, ch: 11 },
			query: "Jan Jansen",
		} as unknown as EditorSuggestContext;
		(suggest as unknown as { context: EditorSuggestContext }).context = context;

		suggest.selectSuggestion({ kind: "create", name: "Jan Jansen" }, {} as KeyboardEvent);

		await vi.waitFor(() =>
			expect(createPerson).toHaveBeenCalledExactlyOnceWith({
				name: "Jan Jansen",
				personId: "person-7d9f4a12-6b3c-4d5e-8f90-123456789abc",
				reviewedPath: "People/Profiles/Jan Jansen · FPF/Jan Jansen.md",
			}),
		);
		expect(replaceRange).toHaveBeenCalledExactlyOnceWith(
			"[[People/Profiles/Jan Jansen · FPF/Jan Jansen|@Jan Jansen]]",
			context.start,
			context.end,
			"people-atlas-mention",
		);
	});
});
