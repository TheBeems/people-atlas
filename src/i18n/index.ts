import { englishCatalog, type Translator } from "./en";
import { dutchCatalog } from "./nl";

export type SupportedLocale = "en" | "nl";
export type { Translator } from "./en";

export const messageCatalogs: Record<SupportedLocale, Translator> = {
	en: englishCatalog,
	nl: dutchCatalog,
};

export function resolveLocale(language: string | undefined): SupportedLocale {
	const languageCode = language?.trim().toLowerCase().split(/[-_]/)[0];
	return languageCode === "nl" ? "nl" : "en";
}

export function createTranslator(language: string | undefined): Translator {
	return messageCatalogs[resolveLocale(language)];
}
