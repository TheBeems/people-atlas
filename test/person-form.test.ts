import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { canonicalPersonPhotoWikilink, supportedPersonPhotoAssets } from "../src/domain/person-photo";
import type { PersonRecord } from "../src/domain/types";
import {
	PersonFormSession,
	addPersonContact,
	buildPersonCreateInput,
	buildPersonUpdates,
	createPersonFormValues,
	editPersonFormValues,
	getPersonBirthDateError,
	getPersonEmailIssues,
	getPersonPhoneIssues,
	proposeCreatePersonPath,
	proposePersonRenamePath,
	type PersonMutationPort,
} from "../src/editor/person-form";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: ["Al"],
	organisations: ["Example Org"],
	photoPath: "Assets/alice.png",
	birthDate: "--07-30",
	pronouns: "she/her",
	gender: "woman",
	emails: ["alice@example.com"],
	phones: ["+31 (0)20 123 45 67"],
	jobTitle: "Engineer",
	contacts: [
		{ raw: "[[People/Bob]]", target: "People/Bob" },
		{ raw: "[[Missing|Unknown]]", target: "Missing", label: "Unknown" },
	],
};

const bob: PersonRecord = {
	id: "person-bob",
	filePath: "People/Bob.md",
	name: "Bob",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

function mutationPort(): PersonMutationPort {
	return {
		createPerson: vi.fn(async () => ({ path: "People/Created.md" }) as TFile),
		updatePerson: vi.fn(async (file) => ({ file, renamed: true })),
	};
}

describe("person form contract", () => {
	it("builds a configured create payload from reviewable fields", () => {
		const values = {
			...createPersonFormValues("People"),
			name: "  Carol  ",
			aliases: "Caz\nC",
			organisations: "Example Org\nOther Org",
			photo: " [[Assets/carol.png]] ",
			birthDate: { year: "1990", month: "7", day: "30" },
			pronouns: " they/them ",
			gender: " non-binary ",
			emails: [" Carol@Example.com "],
			phones: [" +31 6 12-34-56-78 "],
			jobTitle: " Staff Engineer ",
			contacts: [{ raw: "[[People/Bob]]", resolvedPath: bob.filePath }],
		};

		expect(proposeCreatePersonPath(values.name, "People")).toBe("People/Carol.md");
		expect(buildPersonCreateInput(values)).toEqual({
			name: "Carol",
			aliases: ["Caz", "C"],
			organisations: ["Example Org", "Other Org"],
			photo: "[[Assets/carol.png]]",
			birthDate: "1990-07-30",
			pronouns: "they/them",
			gender: "non-binary",
			emails: ["Carol@Example.com"],
			phones: ["+31 6 12-34-56-78"],
			jobTitle: "Staff Engineer",
			contacts: ["[[People/Bob]]"],
		});
	});

	it("loads resolved and unresolved contacts without rewriting their raw values", () => {
		const values = editPersonFormValues(alice, "[[Assets/alice.png]]", [alice, bob], (target) =>
			target === "People/Bob" ? bob.filePath : undefined,
		);

		expect(values).toMatchObject({
			path: alice.filePath,
			name: "Alice",
			personId: "person-alice",
			personIdSource: "explicit",
			aliases: "Al",
			organisations: "Example Org",
			photo: "[[Assets/alice.png]]",
			birthDate: { year: "", month: "07", day: "30" },
			pronouns: "she/her",
			gender: "woman",
			emails: ["alice@example.com"],
			phones: ["+31 (0)20 123 45 67"],
			jobTitle: "Engineer",
			contacts: [
				{ raw: "[[People/Bob]]", resolvedPath: bob.filePath },
				{ raw: "[[Missing|Unknown]]", resolvedPath: undefined },
			],
		});
		expect(buildPersonUpdates(values, structuredClone(values))).toEqual({});
	});

	it("adds only canonical non-self contacts and rejects duplicates", () => {
		const first = addPersonContact([], bob.filePath, [alice, bob], alice.filePath);
		expect(first).toEqual({
			contacts: [{ raw: "[[People/Bob]]", resolvedPath: bob.filePath }],
		});
		expect(addPersonContact(first.contacts, bob.filePath, [alice, bob], alice.filePath).error).toContain(
			"already listed",
		);
		expect(addPersonContact(first.contacts, alice.filePath, [alice, bob], alice.filePath).error).toContain(
			"linked to themselves",
		);
		expect(addPersonContact(first.contacts, "People/Missing.md", [alice, bob], alice.filePath).error).toContain(
			"indexed person",
		);
	});

	it("round-trips full and yearless birthdays and distinguishes clearing only the year", () => {
		const full = {
			...createPersonFormValues("People"),
			name: "Carol",
			birthDate: { year: "2000", month: "02", day: "29" },
		};
		expect(buildPersonCreateInput(full).birthDate).toBe("2000-02-29");

		const yearless = structuredClone(full);
		yearless.birthDate.year = "";
		expect(buildPersonCreateInput(yearless).birthDate).toBe("--02-29");

		const cleared = structuredClone(yearless);
		cleared.birthDate.month = "";
		cleared.birthDate.day = "";
		expect(buildPersonCreateInput(cleared)).not.toHaveProperty("birthDate");

		const invalid = structuredClone(full);
		invalid.birthDate.year = "2023";
		expect(getPersonBirthDateError(invalid.birthDate)).toContain("calendar-valid");
		expect(() => buildPersonCreateInput(invalid)).toThrow("calendar-valid");
	});

	it("validates ordered email and phone entries without reformatting phones", () => {
		expect(getPersonEmailIssues(["Alice@example.com", "alice@example.com"])).toEqual([
			{ index: 1, message: "Duplicate email addresses are not allowed." },
		]);
		expect(getPersonEmailIssues(["missing-at"])[0]?.message).toContain("one @");
		expect(getPersonPhoneIssues(["+31 (0)20 123", "+31 (0)20 123"])).toEqual([
			{ index: 1, message: "Duplicate phone numbers are not allowed." },
		]);
		expect(getPersonPhoneIssues([""])[0]?.message).toContain("remove this entry");

		const values = {
			...createPersonFormValues("People"),
			name: "Carol",
			emails: [" first@example.com ", "SECOND@example.com"],
			phones: [" +31 (0)20 123-45-67 ", "(020) 765 43 21"],
		};
		expect(buildPersonCreateInput(values)).toMatchObject({
			emails: ["first@example.com", "SECOND@example.com"],
			phones: ["+31 (0)20 123-45-67", "(020) 765 43 21"],
		});
	});

	it("recomputes duplicate validity after removing the first email or phone entry", () => {
		const original = editPersonFormValues(
			{
				...alice,
				emails: ["Alice@example.com", "alice@example.com"],
				phones: ["+31 20 123", "+31 20 123"],
			},
			undefined,
			[alice, bob],
			() => undefined,
		);

		const removedFirst = structuredClone(original);
		removedFirst.emails.splice(0, 1);
		removedFirst.phones.splice(0, 1);
		expect(buildPersonUpdates(removedFirst, original)).toEqual({
			emails: ["alice@example.com"],
			phones: ["+31 20 123"],
		});
	});

	it.each([
		"person @example.com",
		"person\t@example.com",
		"person\r\n@example.com",
		"person@@example.com",
	])("rejects embedded whitespace or extra-at email %j in the form mapping", (email) => {
		const values = {
			...createPersonFormValues("People"),
			name: "Carol",
			emails: [email],
		};

		expect(getPersonEmailIssues([email])).toEqual([
			{
				index: 0,
				message: "Enter an email address with one @ and non-whitespace text on both sides.",
			},
		]);
		expect(() => buildPersonCreateInput(values)).toThrow("Email address 1");
	});

	it.each([
		{
			change: "deleted",
			currentPeople: [alice],
		},
		{
			change: "renamed",
			currentPeople: [alice, { ...bob, filePath: "People/Robert.md" }],
		},
		{
			change: "made identity-ambiguous",
			currentPeople: [alice, bob, { ...bob, filePath: "People/Bob duplicate.md" }],
		},
	])("rejects a newly linked person that is $change after the form opens", async ({ currentPeople }) => {
		const port = mutationPort();
		const session = new PersonFormSession({ kind: "create" }, port, [alice, bob], () => currentPeople);
		const values = {
			...createPersonFormValues("People"),
			name: "Carol",
			contacts: [{ raw: "[[People/Bob]]", resolvedPath: bob.filePath }],
		};

		await expect(session.submit(values)).resolves.toMatchObject({
			status: "error",
			message: expect.stringContaining("no longer uniquely available"),
		});
		expect(port.createPerson).not.toHaveBeenCalled();
		expect(port.updatePerson).not.toHaveBeenCalled();
	});

	it("allows an unchanged unresolved linked person during an unrelated edit", async () => {
		const file = { path: alice.filePath } as TFile;
		const original = editPersonFormValues(alice, undefined, [alice, bob], () => undefined);
		const port = mutationPort();
		const session = new PersonFormSession({ kind: "edit", file, original }, port, [alice, bob], () => []);

		const result = await session.submit({ ...structuredClone(original), pronouns: "she/they" });

		expect(result.status).toBe("success");
		expect(port.updatePerson).toHaveBeenCalledWith(
			file,
			{ pronouns: "she/they" },
			{
				expectedPersonId: "person-alice",
				expectedClassification: "type",
			},
		);
	});

	it("passes the verified tag-only source baseline through the form session", async () => {
		const file = { path: alice.filePath } as TFile;
		const original = editPersonFormValues(alice, undefined, [alice, bob], () => undefined);
		const port = mutationPort();
		const sourceBaseline = {
			mtime: 1,
			size: 8,
			source: "#person\n",
			tagSources: ["body" as const],
		};
		const session = new PersonFormSession(
			{
				kind: "edit",
				file,
				original,
				expectedClassification: "tag",
				sourceBaseline,
			},
			port,
		);

		await expect(session.submit({ ...structuredClone(original), pronouns: "she/they" })).resolves.toMatchObject({
			status: "success",
		});
		expect(port.updatePerson).toHaveBeenCalledWith(
			file,
			{ pronouns: "she/they" },
			{
				expectedPersonId: "person-alice",
				expectedClassification: "tag",
				sourceBaseline,
			},
		);
	});

	it("builds minimal updates and preserves unresolved contacts until explicitly removed", () => {
		const original = editPersonFormValues(alice, undefined, [alice, bob], () => undefined);
		const changed = {
			...structuredClone(original),
			name: "Alice Example",
			aliases: "",
			contacts: original.contacts.slice(0, 1),
		};

		expect(proposePersonRenamePath(original.path, changed.name)).toBe("People/Alice Example.md");
		expect(buildPersonUpdates(changed, original)).toEqual({
			name: "Alice Example",
			aliases: null,
			contacts: ["[[People/Bob]]"],
		});
	});

	it("preserves an unchanged raw photo exactly and maps only explicit selection or clearing", () => {
		const rawPhoto = "  [[Assets/alice.png|Portrait]]  ";
		const original = editPersonFormValues(alice, rawPhoto, [alice, bob], () => undefined);
		const unrelated = { ...structuredClone(original), pronouns: "she/they" };
		expect(buildPersonUpdates(unrelated, original)).toEqual({ pronouns: "she/they" });
		expect(original.photo).toBe(rawPhoto);

		const selected = structuredClone(original);
		selected.photoSelectionPath = "Portraits/Alice.jpg";
		selected.photo = canonicalPersonPhotoWikilink(selected.photoSelectionPath);
		expect(buildPersonUpdates(selected, original)).toEqual({
			photo: "[[Portraits/Alice.jpg]]",
		});

		const cleared = structuredClone(original);
		cleared.photo = "";
		expect(buildPersonUpdates(cleared, original)).toEqual({ photo: null });
	});

	it("rejects a newly selected photo that disappears before Save without writing", async () => {
		const port = mutationPort();
		let currentAssets = supportedPersonPhotoAssets(["Portraits/Carol.jpg"]);
		const session = new PersonFormSession(
			{ kind: "create" },
			port,
			[alice, bob],
			() => [alice, bob],
			() => currentAssets,
		);
		const values = {
			...createPersonFormValues("People"),
			name: "Carol",
			photo: canonicalPersonPhotoWikilink("Portraits/Carol.jpg"),
			photoSelectionPath: "Portraits/Carol.jpg",
		};
		currentAssets = [];

		await expect(session.submit(values)).resolves.toMatchObject({
			status: "error",
			message: expect.stringContaining("no longer uniquely available"),
		});
		expect(port.createPerson).not.toHaveBeenCalled();
		expect(port.updatePerson).not.toHaveBeenCalled();
	});

	it.each([
		"https://example.test/carol.jpg",
		"[[Assets/carol.svg]]",
	])("rejects a manually injected create photo %s without writing", async (photo) => {
		const port = mutationPort();
		const session = new PersonFormSession({ kind: "create" }, port);
		const values = { ...createPersonFormValues("People"), name: "Carol", photo };

		await expect(session.submit(values)).resolves.toMatchObject({
			status: "error",
			message: expect.stringContaining("photo picker"),
		});
		expect(port.createPerson).not.toHaveBeenCalled();
		expect(port.updatePerson).not.toHaveBeenCalled();
	});

	it.each([
		"https://example.test/alice.jpg",
		"[[Assets/alice.svg]]",
	])("rejects a manually injected edit photo %s without writing", async (photo) => {
		const file = { path: alice.filePath } as TFile;
		const original = editPersonFormValues(alice, "  [[Assets/alice.png|Portrait]]  ", [alice, bob], () => undefined);
		const port = mutationPort();
		const session = new PersonFormSession({ kind: "edit", file, original }, port);

		await expect(session.submit({ ...structuredClone(original), photo })).resolves.toMatchObject({
			status: "error",
			message: expect.stringContaining("photo picker"),
		});
		expect(port.createPerson).not.toHaveBeenCalled();
		expect(port.updatePerson).not.toHaveBeenCalled();
	});

	it("requires a separate rename confirmation before invoking the mutation", async () => {
		const file = { path: alice.filePath } as TFile;
		const original = editPersonFormValues(alice, undefined, [alice, bob], () => undefined);
		const port = mutationPort();
		const session = new PersonFormSession({ kind: "edit", file, original }, port);
		const changed = { ...structuredClone(original), name: "Alice Example" };

		await expect(session.submit(changed)).resolves.toEqual({
			status: "confirmation-required",
			currentPath: "People/Alice.md",
			targetPath: "People/Alice Example.md",
		});
		expect(port.updatePerson).not.toHaveBeenCalled();

		await expect(session.submit(changed, true)).resolves.toMatchObject({
			status: "success",
			created: false,
			renamed: true,
		});
		expect(port.updatePerson).toHaveBeenCalledWith(
			file,
			{ name: "Alice Example" },
			{
				targetPath: "People/Alice Example.md",
				expectedPersonId: "person-alice",
				expectedClassification: "type",
			},
		);
	});

	it("returns explicit partial state when properties saved before a failed rename", async () => {
		const file = { path: alice.filePath } as TFile;
		const original = editPersonFormValues(alice, undefined, [alice, bob], () => undefined);
		const error = Object.assign(new Error("Properties saved; rename failed."), {
			propertiesSaved: true as const,
			currentPath: alice.filePath,
			targetPath: "People/Alice Example.md",
		});
		const port: PersonMutationPort = {
			createPerson: vi.fn(),
			updatePerson: vi.fn(async () => {
				throw error;
			}),
		};
		const session = new PersonFormSession({ kind: "edit", file, original }, port);

		await expect(session.submit({ ...structuredClone(original), name: "Alice Example" }, true)).resolves.toEqual({
			status: "error",
			message: "Properties saved; rename failed.",
			partial: true,
			currentPath: alice.filePath,
			targetPath: "People/Alice Example.md",
		});
	});
});
