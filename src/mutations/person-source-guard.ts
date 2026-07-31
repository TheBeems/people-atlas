import { parseFrontMatterTags, parseYaml, type App, type TFile } from "obsidian";

export type PersonTagSource = "frontmatter" | "body";

export interface PersonEditSourceBaseline {
	mtime: number;
	size: number;
	source: string;
	tagSources: PersonTagSource[];
}

interface FileSourceStat {
	mtime: number;
	size: number;
}

export async function capturePersonEditSourceBaseline(
	app: App,
	file: TFile,
	personTag: string,
): Promise<PersonEditSourceBaseline | undefined> {
	const before = readSourceStat(file);
	if (!before) return undefined;
	try {
		const source = await app.vault.read(file);
		const after = readSourceStat(file);
		if (!after || !sameSourceStat(before, after)) return undefined;
		const tagSources = findPersonTagSources(source, personTag);
		if (tagSources.length === 0) return undefined;
		return { ...after, source, tagSources };
	} catch {
		return undefined;
	}
}

export async function verifyPersonEditSourceBaseline(
	app: App,
	file: TFile,
	personTag: string,
	baseline: PersonEditSourceBaseline,
): Promise<PersonTagSource[] | undefined> {
	const before = readSourceStat(file);
	if (!before || !sameSourceStat(before, baseline)) return undefined;
	try {
		const source = await app.vault.read(file);
		const after = readSourceStat(file);
		if (!after || !sameSourceStat(before, after) || !sameSourceStat(after, baseline) || source !== baseline.source) {
			return undefined;
		}
		const tagSources = findPersonTagSources(source, personTag);
		return tagSources.length > 0 ? tagSources : undefined;
	} catch {
		return undefined;
	}
}

export function personSourceStatMatches(file: TFile, baseline: PersonEditSourceBaseline): boolean {
	const current = readSourceStat(file);
	return current !== undefined && sameSourceStat(current, baseline);
}

export function findPersonTagSources(source: string, personTag: string): PersonTagSource[] {
	const expectedTag = normalizeTag(personTag);
	if (!expectedTag) return [];
	const { frontmatter, body } = splitFrontmatter(source);
	const sources: PersonTagSource[] = [];
	if (frontmatter !== undefined && parsedFrontmatterHasTag(frontmatter, expectedTag)) sources.push("frontmatter");
	if (markdownBodyHasTag(body, expectedTag)) sources.push("body");
	return sources;
}

export function frontmatterHasPersonTag(frontmatter: Record<string, unknown>, personTag: string): boolean {
	const expectedTag = normalizeTag(personTag);
	if (!expectedTag) return false;
	return (parseFrontMatterTags(frontmatter) ?? []).some((tag) => normalizeTag(tag) === expectedTag);
}

function readSourceStat(file: TFile): FileSourceStat | undefined {
	const stat = (file as TFile & { stat?: Partial<FileSourceStat> }).stat;
	return stat && Number.isFinite(stat.mtime) && Number.isFinite(stat.size)
		? { mtime: stat.mtime as number, size: stat.size as number }
		: undefined;
}

function sameSourceStat(left: FileSourceStat, right: FileSourceStat): boolean {
	return left.mtime === right.mtime && left.size === right.size;
}

function splitFrontmatter(source: string): { frontmatter?: string | undefined; body: string } {
	const lines = source.split(/\r?\n/);
	const firstLine = lines[0]?.replace(/^\uFEFF/, "");
	if (firstLine?.trim() !== "---") return { body: source };
	const closingIndex = lines.findIndex((line, index) => index > 0 && (line.trim() === "---" || line.trim() === "..."));
	if (closingIndex < 0) return { body: source };
	return {
		frontmatter: lines.slice(1, closingIndex).join("\n"),
		body: lines.slice(closingIndex + 1).join("\n"),
	};
}

function parsedFrontmatterHasTag(frontmatterSource: string, expectedTag: string): boolean {
	try {
		const frontmatter = parseYaml(frontmatterSource);
		return (parseFrontMatterTags(frontmatter) ?? []).some((tag) => normalizeTag(tag) === expectedTag);
	} catch {
		return false;
	}
}

function markdownBodyHasTag(body: string, expectedTag: string): boolean {
	let fence: { marker: "`" | "~"; length: number } | undefined;
	let inlineCodeLength = 0;
	let inlineMathLength = 0;
	let inMathBlock = false;
	let inHtmlComment = false;
	for (const line of body.split(/\r?\n/)) {
		const fenceRun = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
		if (fence) {
			if (
				fenceRun?.startsWith(fence.marker) &&
				fenceRun.length >= fence.length &&
				line.slice(line.indexOf(fenceRun) + fenceRun.length).trim() === ""
			) {
				fence = undefined;
			}
			continue;
		}
		if (fenceRun) {
			fence = { marker: fenceRun[0] as "`" | "~", length: fenceRun.length };
			continue;
		}
		if (/^(?: {4}|\t)/.test(line)) continue;
		if (inHtmlComment) {
			if (line.includes("-->")) inHtmlComment = false;
			continue;
		}
		if (line.includes("<!--")) {
			if (!line.includes("-->", line.indexOf("<!--") + 4)) inHtmlComment = true;
			continue;
		}
		if (line.includes("<") || line.includes(">")) continue;
		const mathFenceCount = [...line.matchAll(/\$\$/g)].length;
		if (inMathBlock) {
			if (mathFenceCount > 0) inMathBlock = false;
			continue;
		}
		if (line.trimStart().startsWith("$$")) {
			if (mathFenceCount < 2) inMathBlock = true;
			continue;
		}

		for (let index = 0; index < line.length; index += 1) {
			if (line.startsWith("[[", index)) {
				const closingIndex = line.indexOf("]]", index + 2);
				if (closingIndex < 0) break;
				index = closingIndex + 1;
				continue;
			}
			if (line[index] === "`") {
				const runLength = countRun(line, index, "`");
				if (inlineCodeLength === 0) inlineCodeLength = runLength;
				else if (runLength === inlineCodeLength) inlineCodeLength = 0;
				index += runLength - 1;
				continue;
			}
			if (inlineCodeLength > 0) continue;
			if (line[index] === "$" && !isEscaped(line, index)) {
				const runLength = countRun(line, index, "$");
				if (inlineMathLength === 0) inlineMathLength = runLength;
				else if (runLength === inlineMathLength) inlineMathLength = 0;
				index += runLength - 1;
				continue;
			}
			if (inlineMathLength > 0 || line[index] !== "#") continue;
			const match = /^#[\p{L}\p{N}_/-]+/u.exec(line.slice(index));
			if (!match || !hasSafeTagPrefix(line, index)) continue;
			if (normalizeTag(match[0]) === expectedTag) return true;
			index += match[0].length - 1;
		}
	}
	return false;
}

function countRun(value: string, start: number, marker: string): number {
	let end = start;
	while (value[end] === marker) end += 1;
	return end - start;
}

function hasSafeTagPrefix(line: string, tagStart: number): boolean {
	if (tagStart === 0) return true;
	if (isEscaped(line, tagStart)) return false;
	return /[\s([{"']/.test(line[tagStart - 1] ?? "");
}

function isEscaped(line: string, index: number): boolean {
	let slashCount = 0;
	for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashCount += 1;
	return slashCount % 2 === 1;
}

function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}
