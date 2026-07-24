export function normalizePathIdentity(path: string): string {
	return path.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

export function normalizeExplicitId(value: string): string {
	return value.trim();
}

export function personIdFromPath(path: string): string {
	return `path:${normalizePathIdentity(path)}`;
}

export function resolvePersonId(explicitId: string | undefined, filePath: string): string {
	const normalized = explicitId ? normalizeExplicitId(explicitId) : "";
	return normalized.length > 0 ? normalized : personIdFromPath(filePath);
}

export function relationshipIdFromPath(path: string): string {
	return `relationship:${normalizePathIdentity(path)}`;
}

export function resolveRelationshipId(explicitId: string | undefined, filePath: string): string {
	const normalized = explicitId ? normalizeExplicitId(explicitId) : "";
	return normalized.length > 0 ? normalized : relationshipIdFromPath(filePath);
}
