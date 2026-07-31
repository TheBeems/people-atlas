import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import {
	capturePersonEditSourceBaseline,
	findPersonTagSources,
	frontmatterHasPersonTag,
	verifyPersonEditSourceBaseline,
} from "../src/mutations/person-source-guard";

describe("person source guard", () => {
	it("recognizes explicit body and parsed frontmatter tags", () => {
		expect(findPersonTagSources("#person\n", "person")).toEqual(["body"]);
		expect(findPersonTagSources("---\ntags:\n  - person\n  - private\n---\n\nBody.\n", "#person")).toEqual([
			"frontmatter",
		]);
		expect(findPersonTagSources("---\ntags: [person, private]\n---\n\n#person\n", "person")).toEqual([
			"frontmatter",
			"body",
		]);
		expect(frontmatterHasPersonTag({ tags: ["private", "person"] }, "#person")).toBe(true);
	});

	it.each([
		["fenced backtick code", "```\n#person\n```\n"],
		["fenced tilde code", "~~~text\n#person\n~~~\n"],
		["inline code", "Stored as `#person` only.\n"],
		["escaped text", String.raw`Escaped \#person only.`],
		["HTML comment", "<!-- #person -->\n"],
		["multiline HTML comment", "<!--\n#person\n-->\n"],
		["indented code", "    #person\n"],
		["URL fragment", "https://example.test/#person\n"],
		["larger tag", "#person/private\n"],
		["wikilink heading", "[[#person]]\n"],
		["inline math", "Formula $x = #person$ only.\n"],
		["math block", "$$\n#person\n$$\n"],
	])("does not accept a tag that appears only in %s", (_case, source) => {
		expect(findPersonTagSources(source, "person")).toEqual([]);
	});

	it("captures and verifies exact source and stat state", async () => {
		const state = { source: "#person\n", mtime: 1 };
		const file = {
			path: "People/Tagged.md",
			stat: { ctime: 1, mtime: state.mtime, size: state.source.length },
		} as TFile;
		const app = {
			vault: {
				read: async () => state.source,
			},
		} as unknown as App;
		const baseline = await capturePersonEditSourceBaseline(app, file, "person");
		expect(baseline).toMatchObject({
			mtime: 1,
			size: state.source.length,
			source: "#person\n",
			tagSources: ["body"],
		});
		if (!baseline) throw new Error("Expected a source baseline.");
		await expect(verifyPersonEditSourceBaseline(app, file, "person", baseline)).resolves.toEqual(["body"]);

		state.source = "#people\n";
		file.stat.size = state.source.length;
		await expect(verifyPersonEditSourceBaseline(app, file, "person", baseline)).resolves.toBeUndefined();
	});

	it("fails closed when the file changes while it is being read", async () => {
		const file = {
			path: "People/Tagged.md",
			stat: { ctime: 1, mtime: 1, size: 8 },
		} as TFile;
		const app = {
			vault: {
				read: async () => {
					file.stat.mtime = 2;
					return "#person\n";
				},
			},
		} as unknown as App;

		await expect(capturePersonEditSourceBaseline(app, file, "person")).resolves.toBeUndefined();
	});
});
