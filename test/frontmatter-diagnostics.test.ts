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

function appWithLinks(paths: Record<string, string>): App {
	return {
		metadataCache: {
			getFirstLinkpathDest: (target: string) => {
				const path = paths[target];
				return path ? file(path) : null;
			},
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
					relationship_id: "relationship-alice-bob",
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
			{
				frontmatter: {
					type: "person",
					person_id: "person-alice",
					name: "Alice",
					photo: "[[Assets/alice.png]]",
				},
			} as CachedMetadata,
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
					relationship_id: "relationship-mathijs-cor",
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
					relationship_id: "relationship-alice-bob",
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

	it("ignores unowned relationship frontmatter without a diagnostic or domain field", () => {
		const parsed = parseAtlasFile(
			appWithNoLinks(),
			file("Relationships/Alice-Bob.md"),
			{
				frontmatter: {
					type: "relationship",
					relationship_id: "relationship-alice-bob",
					from: "[[Alice]]",
					to: "[[Bob]]",
					direction: "not-a-current-value",
				},
			} as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(parsed.relationship).toBeDefined();
		expect(parsed.relationship).not.toHaveProperty("direction");
		expect(parsed.diagnostics.some((diagnostic) => diagnostic.code.includes("direction"))).toBe(false);
	});

	it("requires a non-empty person ID instead of deriving one from the path", () => {
		const explicit = parseAtlasFile(
			appWithNoLinks(),
			file("People/Alice.md"),
			{ frontmatter: { type: "person", person_id: "alice-id", name: "Alice" } } as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		const fallback = parseAtlasFile(
			appWithNoLinks(),
			file("People/Bob.md"),
			{ frontmatter: { type: "person", name: "Bob" } } as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(explicit.person).toMatchObject({ id: "alice-id" });
		expect(fallback.person).toBeUndefined();
		expect(fallback.diagnostics).toContainEqual(
			expect.objectContaining({ code: "missing-person-id", filePaths: ["People/Bob.md"] }),
		);
	});

	it("parses configured profile fields while excluding invalid birth dates and emails with source diagnostics", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			birthDateProperty: "birthday",
			pronounsProperty: "preferred_pronouns",
			genderProperty: "self_gender",
			emailsProperty: "mailboxes",
			phonesProperty: "telephone_numbers",
			jobTitleProperty: "position",
		};
		const validFrontmatter = {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
			birthday: "--02-29",
			preferred_pronouns: "she/her",
			self_gender: "woman",
			mailboxes: [
				" Alice@Example.test ",
				"invalid",
				"alice@example.test",
				"work@example.test",
				"space local@example.test",
				"tab\tlocal@example.test",
				"line\r\nbreak@example.test",
				"extra@@example.test",
			],
			telephone_numbers: [" +31 (0)6 1234 ", "+31 (0)6 1234", "+1-555-0100"],
			position: "Engineering lead",
		};
		const invalidBirthFrontmatter = {
			type: "person",
			person_id: "person-bob",
			name: "Bob",
			birthday: "2025-02-29",
			mailboxes: ["bob@example.test"],
		};
		const validOriginal = structuredClone(validFrontmatter);
		const invalidOriginal = structuredClone(invalidBirthFrontmatter);

		const valid = parseAtlasFile(
			appWithNoLinks(),
			file("People/Alice.md"),
			{ frontmatter: validFrontmatter } as CachedMetadata,
			settings,
		);
		const invalidBirth = parseAtlasFile(
			appWithNoLinks(),
			file("People/Bob.md"),
			{ frontmatter: invalidBirthFrontmatter } as CachedMetadata,
			settings,
		);

		expect(valid.person).toMatchObject({
			birthDate: "--02-29",
			pronouns: "she/her",
			gender: "woman",
			emails: ["Alice@Example.test", "work@example.test"],
			phones: ["+31 (0)6 1234", "+1-555-0100"],
			jobTitle: "Engineering lead",
		});
		expect(valid.diagnostics.filter((diagnostic) => diagnostic.code === "invalid-person-email")).toHaveLength(6);
		expect(valid.diagnostics.filter((diagnostic) => diagnostic.code === "invalid-person-phone")).toHaveLength(1);
		expect(valid.diagnostics.every((diagnostic) => diagnostic.filePaths.includes("People/Alice.md"))).toBe(true);
		expect(invalidBirth.person).toMatchObject({ name: "Bob", birthDate: undefined });
		expect(invalidBirth.diagnostics).toEqual([
			expect.objectContaining({
				code: "invalid-person-birth-date",
				filePaths: ["People/Bob.md"],
			}),
		]);
		expect(validFrontmatter).toEqual(validOriginal);
		expect(invalidBirthFrontmatter).toEqual(invalidOriginal);
	});

	it("requires typed email and phone lists without coercing scalar or non-text legacy values", () => {
		const scalarFrontmatter = {
			type: "person",
			person_id: "person-scalar",
			name: "Scalar",
			emails: "scalar@example.test",
			phones: "+31 6 1234",
		};
		const mixedFrontmatter = {
			type: "person",
			person_id: "person-mixed",
			name: "Mixed",
			emails: ["valid@example.test", 42],
			phones: ["+31 6 1234", 123],
		};
		const scalarOriginal = structuredClone(scalarFrontmatter);
		const mixedOriginal = structuredClone(mixedFrontmatter);

		const scalar = parseAtlasFile(
			appWithNoLinks(),
			file("People/Scalar.md"),
			{ frontmatter: scalarFrontmatter } as unknown as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		const mixed = parseAtlasFile(
			appWithNoLinks(),
			file("People/Mixed.md"),
			{ frontmatter: mixedFrontmatter } as unknown as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(scalar.person).toMatchObject({ emails: [], phones: [] });
		expect(scalar.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
			"invalid-person-email",
			"invalid-person-phone",
		]);
		expect(mixed.person).toMatchObject({
			emails: ["valid@example.test"],
			phones: ["+31 6 1234"],
		});
		expect(mixed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
			"invalid-person-email",
			"invalid-person-phone",
		]);
		expect(scalarFrontmatter).toEqual(scalarOriginal);
		expect(mixedFrontmatter).toEqual(mixedOriginal);
	});

	it.each([
		" --02-29",
		"   ",
	])("rejects present whitespace birth date %j without trimming or dropping the person", (birthDate) => {
		const frontmatter = {
			type: "person",
			person_id: "person-whitespace",
			name: "Whitespace",
			birth_date: birthDate,
		};
		const original = structuredClone(frontmatter);

		const parsed = parseAtlasFile(
			appWithNoLinks(),
			file("People/Whitespace.md"),
			{ frontmatter } as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(parsed.person).toMatchObject({
			name: "Whitespace",
			birthDate: undefined,
			emails: [],
			phones: [],
		});
		expect(parsed.diagnostics).toEqual([
			expect.objectContaining({
				code: "invalid-person-birth-date",
				filePaths: ["People/Whitespace.md"],
			}),
		]);
		expect(frontmatter).toEqual(original);
	});

	it("uses the person tag only when the configured type property is absent", () => {
		const tagOnly = parseAtlasFile(
			appWithNoLinks(),
			file("People/Tag-only.md"),
			{
				frontmatter: { person_id: "person-tag-only", name: "Tag only" },
				tags: [{ tag: "#person", position: {} }],
			} as unknown as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		const relationship = parseAtlasFile(
			appWithNoLinks(),
			file("Relationships/Tagged.md"),
			{
				frontmatter: {
					type: "relationship",
					relationship_id: "relationship-tagged",
					from: "[[People/Alice]]",
					to: "[[People/Bob]]",
				},
				tags: [{ tag: "#person", position: {} }],
			} as unknown as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		const other = parseAtlasFile(
			appWithNoLinks(),
			file("Notes/Tagged.md"),
			{
				frontmatter: { type: "project", name: "Not a person" },
				tags: [{ tag: "#person", position: {} }],
			} as unknown as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(tagOnly.person).toMatchObject({ name: "Tag only" });
		expect(tagOnly.relationship).toBeUndefined();
		expect(relationship.person).toBeUndefined();
		expect(relationship.relationship).toBeDefined();
		expect(other.person).toBeUndefined();
		expect(other.relationship).toBeUndefined();
	});

	it("parses a first-class contact moment with explicit identity and configured references", () => {
		const parsed = parseAtlasFile(
			appWithLinks({
				"People/Alice": "People/Alice.md",
				"Relationships/Alice-Bob": "Relationships/Alice-Bob.md",
			}),
			file("People/Contact moments/Alice call.md"),
			{
				frontmatter: {
					type: "contact_moment",
					contact_moment_id: "moment-1",
					people: ["[[People/Alice|Alice]]", "bob-id"],
					relationship: "[[Relationships/Alice-Bob]]",
					occurred_on: "2024-02-29",
					channel: " call ",
					summary: " Caught up ",
					follow_up_on: "2024-03-15",
				},
			} as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(parsed.person).toBeUndefined();
		expect(parsed.relationship).toBeUndefined();
		expect(parsed.contactMoment).toMatchObject({
			id: "moment-1",
			filePath: "People/Contact moments/Alice call.md",
			people: [
				{
					target: "People/Alice",
					label: "Alice",
					resolvedPath: "People/Alice.md",
				},
				{ target: "bob-id" },
			],
			relationship: {
				target: "Relationships/Alice-Bob",
				resolvedPath: "Relationships/Alice-Bob.md",
			},
			occurredOn: "2024-02-29",
			channel: "call",
			summary: "Caught up",
			followUpOn: "2024-03-15",
			personIds: [],
			actionable: true,
			followUpActionable: true,
		});
		expect(parsed.diagnostics).toEqual([]);
	});

	it("keeps malformed contact moments indexed and separates history from follow-up actionability", () => {
		const invalid = parseAtlasFile(
			appWithNoLinks(),
			file("People/Contact moments/Invalid.md"),
			{
				frontmatter: {
					type: "contact_moment",
					contact_moment_id: "moment-invalid",
					people: ["[[People/Alice]]", "[[People/Alice]]", 42],
					occurred_on: "2025-02-29",
					follow_up_on: "2026-02-30",
					follow_up_status: "waiting",
				},
			} as unknown as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		const statusWithoutDate = parseAtlasFile(
			appWithNoLinks(),
			file("People/Contact moments/Status only.md"),
			{
				frontmatter: {
					type: "contact_moment",
					contact_moment_id: "moment-status-only",
					people: ["alice-id"],
					occurred_on: "2026-07-30",
					follow_up_status: "done",
				},
			} as CachedMetadata,
			DEFAULT_SETTINGS,
		);

		expect(invalid.contactMoment).toMatchObject({
			id: "moment-invalid",
			occurredOn: "2025-02-29",
			followUpOn: "2026-02-30",
			actionable: false,
			followUpActionable: false,
		});
		expect(invalid.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
			"duplicate-contact-moment-person",
			"invalid-contact-moment-people",
			"invalid-contact-moment-occurred-on",
			"invalid-contact-moment-follow-up-date",
			"invalid-contact-moment-follow-up-status",
		]);
		expect(statusWithoutDate.contactMoment).toMatchObject({
			actionable: true,
			followUpStatus: "done",
			followUpActionable: false,
		});
		expect(statusWithoutDate.diagnostics).toEqual([
			expect.objectContaining({
				code: "invalid-contact-moment-follow-up-status",
				filePaths: ["People/Contact moments/Status only.md"],
			}),
		]);
	});
});
