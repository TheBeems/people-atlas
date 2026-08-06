import { englishCatalog, type Translator as Catalog } from "./en";
import { dutchCatalog } from "./nl";

export type SupportedLocale = "en" | "nl";

export interface LocalePresentation {
	locale: SupportedLocale;
	formatInteger(value: number): string;
	formatDateOnly(value: string): string;
	formatMonthDay(month: number, day: number): string;
}

export type Translator = Catalog & LocalePresentation;

export const messageCatalogs: Record<SupportedLocale, Catalog> = {
	en: englishCatalog,
	nl: dutchCatalog,
};

export function resolveLocale(language: string | undefined): SupportedLocale {
	const languageCode = language?.trim().toLowerCase().split(/[-_]/)[0];
	return languageCode === "nl" ? "nl" : "en";
}

export function createTranslator(language: string | undefined): Translator {
	const locale = resolveLocale(language);
	const intlLocale = locale === "nl" ? "nl-NL" : "en-US";
	return {
		...messageCatalogs[locale],
		locale,
		formatInteger: (value) => new Intl.NumberFormat(intlLocale).format(value),
		formatDateOnly: (value) => formatDateOnly(value, intlLocale),
		formatMonthDay: (month, day) => formatMonthDay(month, day, intlLocale),
	};
}

function formatDateOnly(value: string, locale: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return value;
	const [, rawYear, rawMonth, rawDay] = match;
	const year = Number(rawYear);
	const month = Number(rawMonth);
	const day = Number(rawDay);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return value;
	return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
		date,
	);
}

function formatMonthDay(month: number, day: number, locale: string): string {
	const date = new Date(Date.UTC(2000, month - 1, day));
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return `${month}-${day}`;
	return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
}
