import type { App, BasesEntry, BasesPropertyId } from "obsidian";
import { describe, expect, it } from "vitest";
import { adaptBasesEntries, type BasesFieldMapping } from "../src/bases/entry-adapter";
import { BASES_OPTION_KEYS, buildBasesOptions } from "../src/bases/options";
import { ControlledBasesEntry, DateValue, ListValue, NumberValue, TFile } from "./obsidian-stub";

const mapping: BasesFieldMapping = {
	name: "note.display_name" as BasesPropertyId,
	id: "note.stable_id" as BasesPropertyId,
	photo: "note.avatar" as BasesPropertyId,
	organisations: "note.orgs" as BasesPropertyId,
	contacts: "note.linked_people" as BasesPropertyId,
	birthDate: "note.birthday" as BasesPropertyId,
	pronouns: "note.preferred_pronouns" as BasesPropertyId,
	gender: "note.self_gender" as BasesPropertyId,
	emails: "note.mailboxes" as BasesPropertyId,
	phones: "note.telephones" as BasesPropertyId,
	jobTitle: "note.position" as BasesPropertyId,
};

function entry(path: string, values: Record<string, string | string[]>): BasesEntry {
	const file = new TFile(path);
	return new ControlledBasesEntry(file, values) as unknown as BasesEntry;
}

function app(): App {
	return {
		metadataCache: {
			getFirstLinkpathDest: () => null,
		},
	} as unknown as App;
}

describe("Bases person profile mapping", () => {
	it("maps configured profile properties and excludes invalid structured values without dropping the person", () => {
		const result = adaptBasesEntries(
			app(),
			[
				entry("People/Alice.md", {
					"note.display_name": "Alice",
					"note.stable_id": "alice-id",
					"note.orgs": ["Example Org"],
					"note.linked_people": ["[[People/Bob]]"],
					"note.birthday": "--02-29 ",
					"note.preferred_pronouns": "she/her",
					"note.self_gender": "woman",
					"note.mailboxes": [" Alice@Example.test ", "invalid", "alice@example.test"],
					"note.telephones": [" +31 (0)6 1234 ", "+31 (0)6 1234", "+1-555-0100"],
					"note.position": "Engineering lead",
				}),
			],
			mapping,
		);

		expect(result.people).toHaveLength(1);
		expect(result.people[0]).toMatchObject({
			id: "alice-id",
			name: "Alice",
			birthDate: undefined,
			pronouns: "she/her",
			gender: "woman",
			emails: ["Alice@Example.test"],
			phones: ["+31 (0)6 1234", "+1-555-0100"],
			jobTitle: "Engineering lead",
			organisations: ["Example Org"],
			contacts: [{ target: "People/Bob" }],
		});
		expect(result.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual([
			"invalid-person-birth-date",
			"invalid-person-email",
			"invalid-person-email",
			"invalid-person-phone",
		]);
		expect(result.diagnostics?.every((diagnostic) => diagnostic.filePaths[0] === "People/Alice.md")).toBe(true);
	});

	it("exposes all profile selectors and Linked people language in Bases options", () => {
		const options = buildBasesOptions();
		const keys = options.map((option) => option.key);

		expect(keys).toEqual(
			expect.arrayContaining([
				BASES_OPTION_KEYS.birthDateProperty,
				BASES_OPTION_KEYS.pronounsProperty,
				BASES_OPTION_KEYS.genderProperty,
				BASES_OPTION_KEYS.emailsProperty,
				BASES_OPTION_KEYS.phonesProperty,
				BASES_OPTION_KEYS.jobTitleProperty,
				BASES_OPTION_KEYS.contactsProperty,
			]),
		);
		expect(options.find((option) => option.key === BASES_OPTION_KEYS.contactsProperty)).toMatchObject({
			displayName: "Linked people property",
		});
	});

	it("does not coerce scalar Bases contact-detail values into profile lists", () => {
		const result = adaptBasesEntries(
			app(),
			[
				entry("People/Scalar.md", {
					"note.display_name": "Scalar",
					"note.stable_id": "person-scalar",
					"note.mailboxes": "scalar@example.test",
					"note.telephones": "+31 6 1234",
				}),
			],
			mapping,
		);

		expect(result.people[0]).toMatchObject({ emails: [], phones: [] });
		expect(result.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual([
			"invalid-person-email",
			"invalid-person-phone",
		]);
	});

	it("accepts only quoted text birth dates and rejects native date or numeric Values", () => {
		const quoted = new ControlledBasesEntry(new TFile("People/Quoted.md"), {
			"note.display_name": "Quoted",
			"note.stable_id": "person-quoted",
			"note.birthday": "--02-29",
		});
		const whitespace = new ControlledBasesEntry(new TFile("People/Whitespace.md"), {
			"note.display_name": "Whitespace",
			"note.stable_id": "person-whitespace",
			"note.birthday": "   ",
		});
		const nativeDate = new ControlledBasesEntry(new TFile("People/Native.md"), {
			"note.display_name": "Native date",
			"note.stable_id": "person-native",
		});
		const dateValue = DateValue.parseFromString("1990-07-30");
		if (!dateValue) throw new Error("The controlled DateValue fixture could not parse its date.");
		nativeDate.values.set("note.birthday", dateValue);
		const numeric = new ControlledBasesEntry(new TFile("People/Numeric.md"), {
			"note.display_name": "Numeric",
			"note.stable_id": "person-numeric",
		});
		numeric.values.set("note.birthday", new NumberValue(19900730));

		const result = adaptBasesEntries(
			app(),
			[
				quoted as unknown as BasesEntry,
				whitespace as unknown as BasesEntry,
				nativeDate as unknown as BasesEntry,
				numeric as unknown as BasesEntry,
			],
			mapping,
		);

		expect(result.people.map((person) => person.birthDate)).toEqual(["--02-29", undefined, undefined, undefined]);
		expect(
			result.diagnostics?.map((diagnostic) => ({
				code: diagnostic.code,
				filePaths: diagnostic.filePaths,
				message: diagnostic.message,
			})),
		).toEqual([
			expect.objectContaining({
				code: "invalid-person-birth-date",
				filePaths: ["People/Whitespace.md"],
				message: expect.stringContaining("calendar-valid"),
			}),
			expect.objectContaining({
				code: "invalid-person-birth-date",
				filePaths: ["People/Native.md"],
				message: expect.stringContaining("expected text"),
			}),
			expect.objectContaining({
				code: "invalid-person-birth-date",
				filePaths: ["People/Numeric.md"],
				message: expect.stringContaining("expected text"),
			}),
		]);
	});

	it("excludes non-text items from heterogeneous Bases lists without shifting diagnostic indexes", () => {
		const mixed = new ControlledBasesEntry(new TFile("People/Mixed.md"), {
			"note.display_name": "Mixed",
			"note.stable_id": "person-mixed",
		});
		mixed.values.set(
			"note.mailboxes",
			new ListValue(["valid@example.test", new NumberValue(42), "space local@example.test"]),
		);
		mixed.values.set("note.telephones", new ListValue(["+31 6 1234", new NumberValue(123), ""]));

		const result = adaptBasesEntries(app(), [mixed as unknown as BasesEntry], mapping);

		expect(result.people[0]).toMatchObject({
			emails: ["valid@example.test"],
			phones: ["+31 6 1234"],
		});
		expect(
			result.diagnostics?.map((diagnostic) => ({
				code: diagnostic.code,
				id: diagnostic.id,
			})),
		).toEqual([
			{
				code: "invalid-person-email",
				id: "invalid-person-email:People/Mixed.md:note.mailboxes:1",
			},
			{
				code: "invalid-person-email",
				id: "invalid-person-email:People/Mixed.md:note.mailboxes:2",
			},
			{
				code: "invalid-person-phone",
				id: "invalid-person-phone:People/Mixed.md:note.telephones:1",
			},
			{
				code: "invalid-person-phone",
				id: "invalid-person-phone:People/Mixed.md:note.telephones:2",
			},
		]);
	});
});
