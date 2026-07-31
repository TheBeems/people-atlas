export function normalizePathIdentity(path: string): string {
	return path.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}
