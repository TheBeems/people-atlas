export function stableHash(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

export function hashFraction(value: string): number {
	return Number.parseInt(stableHash(value), 36) / 0xffffffff;
}
