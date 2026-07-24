import type { PersonReference } from "./types";

export function parsePersonReference(rawValue: string): PersonReference | undefined {
	const raw = rawValue.trim();
	if (!raw) return undefined;

	if (raw.startsWith("[[") && raw.endsWith("]]")) {
		const inner = raw.slice(2, -2).trim();
		if (!inner) return undefined;
		const pipe = inner.indexOf("|");
		if (pipe < 0) return { raw, target: inner };
		const target = inner.slice(0, pipe).trim();
		const label = inner.slice(pipe + 1).trim();
		if (!target) return undefined;
		return label ? { raw, target, label } : { raw, target };
	}

	return { raw, target: raw };
}

export function referenceKey(reference: PersonReference): string {
	return reference.target.trim().replace(/\\/g, "/").toLowerCase();
}
