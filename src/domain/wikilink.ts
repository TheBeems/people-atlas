import type { PersonReference, ReferenceKind } from "./types";

export function parsePersonReference(rawValue: string): PersonReference | undefined {
	const raw = rawValue.trim();
	if (!raw) return undefined;

	if (raw.startsWith("[[") && raw.endsWith("]]")) {
		const inner = raw.slice(2, -2).trim();
		if (!inner) return undefined;
		const pipe = inner.indexOf("|");
		if (pipe < 0) return { raw, target: inner, kind: "wikilink" };
		const target = inner.slice(0, pipe).trim();
		const label = inner.slice(pipe + 1).trim();
		if (!target) return undefined;
		return label ? { raw, target, label, kind: "wikilink" } : { raw, target, kind: "wikilink" };
	}

	const kind: ReferenceKind = raw.includes("/") || /\.md$/i.test(raw) ? "path" : "id";
	return { raw, target: raw, kind };
}

export function referenceKey(reference: { target: string }): string {
	return reference.target.trim().replace(/\\/g, "/").toLowerCase();
}
