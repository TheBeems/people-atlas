import { describe, expect, it } from "vitest";
import type { App, CachedMetadata, TFile } from "obsidian";
import { parseAtlasFile } from "../src/index/frontmatter";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

function file(path: string): TFile {
	const parts = path.split("/");
	return { path, extension: "md", basename: parts.at(-1)?.replace(/\.md$/, "") ?? "" } as TFile;
}

function appWithNoLinks(): App {
	return {
		metadataCache: {
			getFirstLinkpathDest: () => null,
		} as unknown as App["metadataCache"],
	} as App;
}

describe("frontmatter diagnostics", () => {
	it("reports strict relationship date and missing asset diagnostics", () => {
		const relationship = parseAtlasFile(
			appWithNoLinks(),
			file("Relationships/Alice-Bob.md"),
			{
				frontmatter: {
					type: "relationship",
					from: "[[Alice]]",
					to: "[[Bob]]",
					since: "2024-02-30",
					last_contact: "2024-02-29",
				},
			} as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		const person = parseAtlasFile(
			appWithNoLinks(),
			file("People/Alice.md"),
			{ frontmatter: { type: "person", name: "Alice", photo: "[[Assets/alice.png]]" } } as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(relationship.diagnostics.some((item) => item.code === "invalid-relationship-date")).toBe(true);
		expect(relationship.relationship?.lastContact).toBe("2024-02-29");
		expect(person.diagnostics).toEqual([
			expect.objectContaining({
				code: "missing-asset",
				severity: "warning",
				filePaths: ["People/Alice.md"],
				targetPath: "Assets/alice.png",
			}),
		]);
	});

	it("preserves endpoint roles and diagnoses an incomplete role pair without guessing", () => {
		const complete = parseAtlasFile(
			appWithNoLinks(),
			file("Relationships/Mathijs-Cor.md"),
			{
				frontmatter: {
					type: "relationship",
					from: "[[Mathijs]]",
					to: "[[Cor]]",
					relationship_preset: "parent-child",
					from_role: "Kind",
					to_role: "Vader",
				},
			} as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		const incomplete = parseAtlasFile(
			appWithNoLinks(),
			file("Relationships/Alice-Bob.md"),
			{
				frontmatter: {
					type: "relationship",
					from: "[[Alice]]",
					to: "[[Bob]]",
					from_role: "Colleague",
				},
			} as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(complete.relationship).toMatchObject({
			presetId: "parent-child",
			fromRole: "Kind",
			toRole: "Vader",
		});
		expect(complete.diagnostics).toEqual([]);
		expect(incomplete.relationship).toMatchObject({ fromRole: "Colleague", toRole: undefined });
		expect(incomplete.diagnostics).toEqual([
			expect.objectContaining({
				code: "incomplete-relationship-roles",
				severity: "warning",
			}),
		]);
	});
});
