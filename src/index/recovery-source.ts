import { parseYaml } from "obsidian";
import type { PeopleAtlasSettings } from "../settings/types";
import { findPersonTagSources } from "../mutations/person-source-guard";

export interface RecoverySource {
	frontmatter: Record<string, unknown>;
	classification: "type" | "tag" | "unclassified";
}

/** Read the actual Markdown source; stale metadata is not a recovery baseline. */
export function parseRecoverySource(source: string, settings: PeopleAtlasSettings): RecoverySource {
	const lines = source.split(/\r?\n/);
	let frontmatter: Record<string, unknown> = {};
	if (lines[0]?.replace(/^\uFEFF/, "").trim() === "---") {
		const closing = lines.findIndex((line, index) => index > 0 && (line.trim() === "---" || line.trim() === "..."));
		if (closing < 0) throw new Error("The note has an unclosed frontmatter block.");
		const parsed: unknown = parseYaml(lines.slice(1, closing).join("\n"));
		if (parsed !== null && parsed !== undefined) {
			if (typeof parsed !== "object" || Array.isArray(parsed))
				throw new Error("The note frontmatter is not an object.");
			frontmatter = parsed as Record<string, unknown>;
		}
	}
	const rawType = frontmatter[settings.typeProperty];
	const type = rawType === null || rawType === undefined ? "" : String(rawType).trim().toLowerCase();
	const classification =
		type === settings.personTypeValue.trim().toLowerCase()
			? "type"
			: !type && findPersonTagSources(source, settings.personTag).length > 0
				? "tag"
				: "unclassified";
	return { frontmatter, classification };
}
