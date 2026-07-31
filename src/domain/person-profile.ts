export interface PersonBirthDateParts {
	year?: number | undefined;
	month: number;
	day: number;
}

export type PersonBirthDateParseResult =
	| {
			valid: true;
			raw: unknown;
			value: string;
			parts: PersonBirthDateParts;
	  }
	| {
			valid: false;
			raw: unknown;
			error: string;
	  };

export interface PersonProfileListIssue {
	index: number;
	message: string;
}

export interface PersonProfileListValidation {
	values: string[];
	issues: PersonProfileListIssue[];
}

const BIRTH_DATE_ERROR = "Birth date must be a calendar-valid YYYY-MM-DD or --MM-DD value.";
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function parsePersonBirthDate(raw: unknown): PersonBirthDateParseResult {
	if (typeof raw !== "string") return { valid: false, raw, error: BIRTH_DATE_ERROR };
	const value = raw;
	const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	const yearless = /^--(\d{2})-(\d{2})$/.exec(value);
	if (!full && !yearless) return { valid: false, raw, error: BIRTH_DATE_ERROR };

	const year = full ? Number(full[1]) : undefined;
	const month = Number(full?.[2] ?? yearless?.[1] ?? Number.NaN);
	const day = Number(full?.[3] ?? yearless?.[2] ?? Number.NaN);
	if (
		(year !== undefined && (year < 1 || year > 9999)) ||
		!Number.isInteger(month) ||
		month < 1 ||
		month > 12 ||
		!Number.isInteger(day) ||
		day < 1 ||
		day > daysInMonth(month, year)
	) {
		return { valid: false, raw, error: BIRTH_DATE_ERROR };
	}

	return {
		valid: true,
		raw,
		value,
		parts: {
			year,
			month,
			day,
		},
	};
}

export function formatPersonBirthDate(parts: PersonBirthDateParts): string | undefined {
	if (
		!Number.isInteger(parts.month) ||
		!Number.isInteger(parts.day) ||
		(parts.year !== undefined && !Number.isInteger(parts.year))
	) {
		return undefined;
	}
	const month = String(parts.month).padStart(2, "0");
	const day = String(parts.day).padStart(2, "0");
	const value =
		parts.year === undefined ? `--${month}-${day}` : `${String(parts.year).padStart(4, "0")}-${month}-${day}`;
	const parsed = parsePersonBirthDate(value);
	return parsed.valid ? parsed.value : undefined;
}

export function formatPersonBirthDateForDisplay(value: string): string {
	const parsed = parsePersonBirthDate(value);
	if (!parsed.valid) return value;
	return parsed.parts.year === undefined
		? `${String(parsed.parts.month).padStart(2, "0")}-${String(parsed.parts.day).padStart(2, "0")} (year unknown)`
		: parsed.value;
}

export function validatePersonEmail(value: string): string | undefined {
	const trimmed = value.trim();
	if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
		return "Enter an email address with one @ and non-whitespace text on both sides.";
	}
	return undefined;
}

export function validatePersonEmails(values: readonly string[]): PersonProfileListValidation {
	const result: PersonProfileListValidation = { values: [], issues: [] };
	const seen = new Set<string>();
	for (const [index, raw] of values.entries()) {
		const value = raw.trim();
		const error = validatePersonEmail(value);
		if (error) {
			result.issues.push({ index, message: error });
			continue;
		}
		const key = value.toLowerCase();
		if (seen.has(key)) {
			result.issues.push({ index, message: "Duplicate email addresses are not allowed." });
			continue;
		}
		seen.add(key);
		result.values.push(value);
	}
	return result;
}

export function validatePersonPhones(values: readonly string[]): PersonProfileListValidation {
	const result: PersonProfileListValidation = { values: [], issues: [] };
	const seen = new Set<string>();
	for (const [index, raw] of values.entries()) {
		const value = raw.trim();
		if (!value) {
			result.issues.push({ index, message: "Enter a phone number or remove this entry." });
			continue;
		}
		if (seen.has(value)) {
			result.issues.push({ index, message: "Duplicate phone numbers are not allowed." });
			continue;
		}
		seen.add(value);
		result.values.push(value);
	}
	return result;
}

function daysInMonth(month: number, year: number | undefined): number {
	if (month === 2) return year === undefined || isLeapYear(year) ? 29 : 28;
	return MONTH_LENGTHS[month - 1] ?? 0;
}

function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
