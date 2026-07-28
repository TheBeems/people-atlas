import {
	EditorSuggest,
	Notice,
	type App,
	type Editor,
	type EditorPosition,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
	type TFile,
} from "obsidian";
import type { PersonIndex } from "../index/person-index";
import { type AtlasMutationService, MutationError } from "../mutations/atlas-mutation-service";
import type { PeopleAtlasSettings } from "../settings/types";
import { findMentionTrigger, formatMentionLink } from "./mention";

export type PersonMentionSuggestion =
	| { kind: "person"; name: string; filePath: string; personId: string }
	| { kind: "create"; name: string };

export class PersonMentionSuggest extends EditorSuggest<PersonMentionSuggestion> {
	override limit = 20;

	constructor(
		app: App,
		private readonly index: Pick<PersonIndex, "getSnapshot">,
		private readonly mutations: AtlasMutationService,
		private readonly getSettings: () => PeopleAtlasSettings,
	) {
		super(app);
		this.setInstructions([
			{ command: "↑↓", purpose: "navigate" },
			{ command: "↵", purpose: "select" },
			{ command: "esc", purpose: "dismiss" },
		]);
	}

	override onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const lines = Array.from({ length: cursor.line + 1 }, (_, line) => editor.getLine(line));
		return findMentionTrigger(lines, cursor);
	}

	override getSuggestions(context: EditorSuggestContext): PersonMentionSuggestion[] {
		const query = context.query.trim().toLowerCase();
		const people: PersonMentionSuggestion[] = this.index
			.getSnapshot()
			.people.filter(
				(person) => !query || [person.name, ...person.aliases].some((value) => value.toLowerCase().includes(query)),
			)
			.sort((left, right) => left.name.localeCompare(right.name))
			.slice(0, this.limit - 1)
			.map((person) => ({
				kind: "person" as const,
				name: person.name,
				filePath: person.filePath,
				personId: person.id,
			}));
		const exact = people.some((person) => person.name.toLowerCase() === query);
		if (query && !exact) people.push({ kind: "create", name: context.query.trim() });
		return people;
	}

	override renderSuggestion(item: PersonMentionSuggestion, el: HTMLElement): void {
		el.createDiv({
			text: item.kind === "create" ? `Create person “${item.name}” in ${this.getSettings().peopleFolder}/` : item.name,
		});
		if (item.kind === "person") el.createDiv({ text: item.filePath, cls: "suggestion-note" });
	}

	override selectSuggestion(item: PersonMentionSuggestion, _evt: MouseEvent | KeyboardEvent): void {
		const context = this.context;
		if (!context) return;
		void this.choose(item, context);
	}

	private async choose(item: PersonMentionSuggestion, context: EditorSuggestContext): Promise<void> {
		try {
			const targetPath =
				item.kind === "person" ? item.filePath : (await this.mutations.createPerson({ name: item.name })).path;
			context.editor.replaceRange(
				formatMentionLink(targetPath, item.kind === "person" ? item.name : item.name),
				context.start,
				context.end,
				"people-atlas-mention",
			);
		} catch (error) {
			new Notice(error instanceof MutationError || error instanceof Error ? error.message : String(error));
		}
	}
}
