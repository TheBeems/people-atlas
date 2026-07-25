export interface EditorPositionLike {
	line: number;
	ch: number;
}

export interface MentionTrigger {
	start: EditorPositionLike;
	end: EditorPositionLike;
	query: string;
}

function isNonProse(lines: string[], cursorLine: number): boolean {
	let inFrontmatter = lines[0]?.trim() === "---";
	let inFence = false;
	for (let lineNumber = 0; lineNumber <= cursorLine; lineNumber += 1) {
		const line = lines[lineNumber] ?? "";
		const trimmed = line.trim();
		if (inFrontmatter) {
			if (lineNumber > 0 && trimmed === "---") inFrontmatter = false;
			continue;
		}
		if (/^(```|~~~)/.test(trimmed)) inFence = !inFence;
	}
	return inFrontmatter || inFence;
}

export function findMentionTrigger(lines: string[], cursor: EditorPositionLike): MentionTrigger | null {
	if (cursor.line < 0 || cursor.line >= lines.length || isNonProse(lines, cursor.line)) return null;
	const beforeCursor = (lines[cursor.line] ?? "").slice(0, cursor.ch);
	if (beforeCursor.lastIndexOf("[[") > beforeCursor.lastIndexOf("]]")) return null;
	const match = /(^|[\s([{])@([^\n]*)$/.exec(beforeCursor);
	if (!match) return null;
	const boundary = match[1] ?? "";
	const query = match[2] ?? "";
	const atOffset = match.index + boundary.length;
	return {
		start: { line: cursor.line, ch: atOffset },
		end: { line: cursor.line, ch: cursor.ch },
		query,
	};
}

export function formatMentionLink(targetPath: string, displayName: string): string {
	const alias = `@${displayName.replace(/[\[\]]/g, "")}`;
	const linkPath = targetPath.replace(/\.md$/i, "");
	return `[[${linkPath}|${alias}]]`;
}
