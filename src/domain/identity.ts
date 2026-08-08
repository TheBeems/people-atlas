export function normalizePathIdentity(path: string): string {
	return path.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

export interface CanonicalPersonIdentity {
	id: string;
	filePath: string;
}

export function resolveCanonicalPersonByPath<T extends CanonicalPersonIdentity>(
	people: T[],
	personPath: string,
): T | undefined {
	const pathMatches = people.filter((person) => person.filePath === personPath);
	if (pathMatches.length !== 1) return undefined;
	const person = pathMatches[0];
	if (!person || people.filter((candidate) => candidate.id === person.id).length !== 1) return undefined;
	return person;
}
