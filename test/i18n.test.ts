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
	});
});
