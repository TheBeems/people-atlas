/** Calendar-only dates are compared without a local timezone or a clock. */
export function isCalendarDate(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match || Number(match[1]) < 1) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return (
		date.getUTCFullYear() === Number(match[1]) &&
		date.getUTCMonth() + 1 === Number(match[2]) &&
		date.getUTCDate() === Number(match[3])
	);
}

export function isContactIntervalDays(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function addCalendarDays(date: string, days: number): string | undefined {
	if (!isCalendarDate(date) || !Number.isSafeInteger(days)) return undefined;
	const result = new Date(`${date}T00:00:00Z`);
	result.setUTCDate(result.getUTCDate() + days);
	if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() < 1 || result.getUTCFullYear() > 9999) {
		return undefined;
	}
	return result.toISOString().slice(0, 10);
}
