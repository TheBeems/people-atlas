export function required<T>(value: T | null | undefined): T {
	if (value === null || value === undefined) throw new Error("Required synthetic recovery fixture is missing.");
	return value;
}
