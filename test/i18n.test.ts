import { createTranslator, messageCatalogs, resolveLocale } from "../src/i18n";
import { describe, expect, it } from "vitest";

describe("People Atlas i18n foundation", () => {
	it("normalizes supported locales, falls back to English and preserves catalog contracts", () => {
		expect(resolveLocale("nl")).toBe("nl");
		expect(resolveLocale("NL-be")).toBe("nl");
		expect(resolveLocale("en_US")).toBe("en");
		expect(resolveLocale("fr")).toBe("en");
		expect(resolveLocale(undefined)).toBe("en");

		expect(Object.keys(messageCatalogs.nl).sort()).toEqual(Object.keys(messageCatalogs.en).sort());

		const english = createTranslator("en");
		const dutch = createTranslator("nl-NL");
		expect(english.commandOpenAtlas).toBe("Open atlas");
		expect(dutch.commandOpenAtlas).toBe("Atlas openen");
		expect(dutch.personModal.save).toBe("Opslaan");
		expect(english.relationshipModal.titleCreate).toBe("Create relationship");
		expect(
			dutch.atlasRenderer.semanticListSummary({
				people: dutch.formatInteger(2),
				peopleCount: 2,
				connections: dutch.formatInteger(1),
				connectionsCount: 1,
				hiddenContactMoments: dutch.formatInteger(0),
				hiddenContactMomentCount: 0,
			}),
		).toBe("2 personen · 1 verbinding");
		expect(
			english.atlasRenderer.semanticListSummary({
				people: english.formatInteger(1),
				peopleCount: 1,
				connections: english.formatInteger(1),
				connectionsCount: 1,
				hiddenContactMoments: english.formatInteger(0),
				hiddenContactMomentCount: 0,
			}),
		).toBe("1 person · 1 connection");
		expect(
			english.atlasRenderer.followUpsSummary({
				openCount: english.formatInteger(1234),
				openCountValue: 1234,
				hiddenCount: english.formatInteger(1),
				hiddenCountValue: 1,
			}),
		).toBe("1,234 open follow-ups · 1 contact moment hidden");
		expect(
			dutch.atlasRenderer.followUpsSummary({
				openCount: dutch.formatInteger(1),
				openCountValue: 1,
				hiddenCount: dutch.formatInteger(1234),
				hiddenCountValue: 1234,
			}),
		).toBe("1 openstaande opvolging · 1.234 contactmomenten verborgen");
		expect(english.formatInteger(1234)).toBe("1,234");
		expect(dutch.formatInteger(1234)).toBe("1.234");
		expect(english.formatDateOnly("2026-07-30")).toBe("July 30, 2026");
		expect(dutch.formatDateOnly("2026-07-30")).toBe("30 juli 2026");
		expect(english.formatMonthDay(2, 29)).toBe("February 29");
		expect(dutch.formatMonthDay(2, 29)).toBe("29 februari");
		expect(english.settingsMyPersonSelectedDescription({ name: "Alice", filePath: "People/Alice.md" })).toBe(
			"Perspective anchor: Alice — People/Alice.md. It stays independent from graph navigation.",
		);
		expect(dutch.settingsMyPersonSelectedDescription({ name: "Alice", filePath: "People/Alice.md" })).toBe(
			"Perspectiefanker: Alice — People/Alice.md. Dit staat los van grafieknavigatie.",
		);
		expect(english.noticeSettingsSaveFailed({ error: "disk full" })).toBe(
			"People Atlas settings could not be saved: disk full",
		);
		expect(dutch.noticeSettingsSaveFailed({ error: "disk full" })).toBe(
			"People Atlas-instellingen konden niet worden opgeslagen: disk full",
		);

		const englishNotices = english as unknown as {
			noticeNoEditablePersonActive: string;
			noticeOpenNoteFailed(input: { kind: "person" | "relationship" | "contact-moment"; error: string }): string;
		};
		const dutchNotices = dutch as unknown as typeof englishNotices;
		expect(englishNotices.noticeNoEditablePersonActive).toBe("No editable person note is active.");
		expect(dutchNotices.noticeNoEditablePersonActive).toBe("Er is geen bewerkbare persoonsnotitie actief.");
		expect(englishNotices.noticeOpenNoteFailed({ kind: "relationship", error: "disk full" })).toBe(
			"The relationship note could not be opened: disk full",
		);
		expect(dutchNotices.noticeOpenNoteFailed({ kind: "relationship", error: "disk full" })).toBe(
			"De relatienotitie kon niet worden geopend: disk full",
		);
	});
});
