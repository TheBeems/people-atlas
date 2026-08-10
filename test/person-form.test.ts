import type { App, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { canonicalPersonPhotoWikilink } from "../src/domain/person-photo";
import { personDossierPathFromProfile, personProfilePath } from "../src/domain/people-paths";
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
	type PersonPhotoSelectionValidator,
} from "../src/editor/person-form";
import { PersonPhotoPicker } from "../src/editor/person-photo-picker";
import { createTranslator } from "../src/i18n";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { UNSAFE_PEOPLE_ROOT_CASES } from "./people-root-fixtures";

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
		{ raw: "[[People/Bob]]", target: "People/Bob", kind: "wikilink" },
		{ raw: "[[Missing|Unknown]]", target: "Missing", kind: "wikilink", label: "Unknown" },
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

function photoPickerFor(options: {
	person: PersonRecord;
	people: () => PersonRecord[];
	assetPaths: () => string[];
	loadedPaths?: () => string[];
	peopleRootFolder?: string;
}): PersonPhotoPicker {
	const app = {
		vault: {
			getAllLoadedFiles: () =>
				(options.loadedPaths?.() ?? [options.person.filePath, ...options.assetPaths()]).map(
					(path) => ({ path }) as TFile,
				),
			getFiles: () => options.assetPaths().map((path) => ({ path }) as TFile),
			on: vi.fn(),
			offref: vi.fn(),
		},
		metadataCache: { getFirstLinkpathDest: () => undefined },
	} as unknown as App;
	return new PersonPhotoPicker({
		app,
		mode: { kind: "edit", file: { path: options.person.filePath } as TFile, personId: options.person.id },
		values: { name: options.person.name, photo: "" },
		getSettings: () => ({ ...DEFAULT_SETTINGS, peopleRootFolder: options.peopleRootFolder ?? "People" }),
		getCurrentPeople: options.people,
		translator: createTranslator("en"),
	});
}

function photoValidatorFor(options: Parameters<typeof photoPickerFor>[0]): PersonPhotoSelectionValidator {
	const picker = photoPickerFor(options);
	return (values) => picker.validateSelection(values);
}

describe("person form contract", () => {
	it("derives a configured dossier and profile path from a stable UUID-backed person ID", () => {
		const propose = proposeCreatePersonPath as unknown as (
			name: string,
			peopleRootFolder: string,
			personId: string,
		) => string;

		expect(propose(" Alice / Admin ", "Second Brain/People", "person-7D9F4A12-6B3C-4D5E-8F90-123456789ABC")).toBe(
			"Second Brain/People/Profiles/Alice - Admin/Alice - Admin.md",
		);
	});

	it("derives a plain or suffixed dossier only for the exact canonical indexed profile", () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const plainPath = "People/Profiles/Alice/Alice Admin.md";
		const suffixedPath = "People/Profiles/Alice · 24/Alice Admin.md";
		const personAt = (filePath: string) => ({ ...alice, id: personId, filePath });

		expect({
			plain: personDossierPathFromProfile("People", plainPath, personId, [plainPath], [personAt(plainPath)]),
			suffixed: personDossierPathFromProfile(
				"People",
				suffixedPath,
				personId,
				[suffixedPath],
				[personAt(suffixedPath)],
			),
			unindexed: personDossierPathFromProfile("People", plainPath, personId, [], [personAt(plainPath)]),
			duplicateIndex: personDossierPathFromProfile(
				"People",
				plainPath,
				personId,
				[plainPath],
				[personAt(plainPath), personAt(plainPath)],
			),
			wrongPrefix: personDossierPathFromProfile(
				"People",
				"People/Profiles/Alice · ZZ/Alice.md",
				personId,
				["People/Profiles/Alice · ZZ/Alice.md"],
				[personAt("People/Profiles/Alice · ZZ/Alice.md")],
			),
			legacy: personDossierPathFromProfile(
				"People",
				"People/Profiles/alice--11112222/Alice.md",
				personId,
				["People/Profiles/alice--11112222/Alice.md"],
				[personAt("People/Profiles/alice--11112222/Alice.md")],
			),
		}).toEqual({
			plain: "People/Profiles/Alice",
			suffixed: "People/Profiles/Alice · 24",
			unindexed: undefined,
			duplicateIndex: undefined,
			wrongPrefix: undefined,
			legacy: undefined,
		});
	});

	it.each(
		UNSAFE_PEOPLE_ROOT_CASES,
	)("rejects the directly injected $label People root through the canonical dossier authority", ({ root }) => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const profilePath = `${root}/Profiles/Alice/Alice.md`;

		expect(personDossierPathFromProfile(root, profilePath, personId, [profilePath], [])).toBeUndefined();
	});

	it.each([
		["U+001F", "\u001f"],
		["U+007F", "\u007f"],
		["opening bracket", "["],
		["closing bracket", "]"],
		["hash", "#"],
		["caret", "^"],
	] as const)("keeps %s out of the generated canonical profile filename", (_label, character) => {
		expect(personProfilePath("People", `Alice${character}Admin`, "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb")).toBe(
			"People/Profiles/Alice-Admin/Alice-Admin.md",
		);
	});

	it("plans one explicit UUID-backed person ID before mapping a create mutation", () => {
		const plannedPersonId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const createValues = createPersonFormValues as unknown as (
			peopleRootFolder: string,
			personId: string,
		) => ReturnType<typeof createPersonFormValues>;
		const values = { ...createValues("People", plannedPersonId), name: "Zoë Example" };

		expect(values).toMatchObject({
			personId: plannedPersonId,
			personIdSource: "automatic",
			path: "People/Profiles/<name>/<name>.md",
		});
		expect(buildPersonCreateInput(values)).toMatchObject({ name: "Zoë Example", personId: plannedPersonId });
	});

	it("builds a configured create payload from reviewable fields", () => {
		const plannedPersonId = "person-c0ffee00-1111-4222-8333-444455556666";
		const values = {
			...createPersonFormValues("People", plannedPersonId),
			path: "People/Profiles/Carol/Carol.md",
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

		expect(proposeCreatePersonPath(values.name, "People", values.personId)).toBe("People/Profiles/Carol/Carol.md");
		const input = buildPersonCreateInput(values);
		expect(input).toEqual({
			name: "Carol",
			personId: plannedPersonId,
			reviewedPath: "People/Profiles/Carol/Carol.md",
			aliases: ["Caz", "C"],
			organisations: ["Example Org", "Other Org"],
			birthDate: "1990-07-30",
			pronouns: "they/them",
			gender: "non-binary",
			emails: ["Carol@Example.com"],
			phones: ["+31 6 12-34-56-78"],
			jobTitle: "Staff Engineer",
			contacts: ["[[People/Bob]]"],
		});
		expect(input).not.toHaveProperty("photo");
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

	it.each([
		["outside the dossier", "Archive/Portrait.jpg"],
		["in a sibling dossier", "People/Profiles/Bob/Portrait.jpg"],
		["under a prefix-lookalike folder", "People/Profiles/Alice Archive/Portrait.jpg"],
	] as const)("rejects a selected photo %s at the form boundary without writing", async (_case, selectedPath) => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const person = {
			...alice,
			id: personId,
			filePath: "People/Profiles/Alice/Alice.md",
		};
		const file = { path: person.filePath } as TFile;
		const original = editPersonFormValues(person, "[[Archive/old.jpg]]", [person, bob], () => undefined);
		const port = mutationPort();
		const session = new PersonFormSession(
			{ kind: "edit", file, original },
			port,
			[person, bob],
			() => [person, bob],
			photoValidatorFor({
				person,
				people: () => [person, bob],
				assetPaths: () => [selectedPath],
				loadedPaths: () => [person.filePath, selectedPath],
			}),
		);
		const values = {
			...structuredClone(original),
			photo: canonicalPersonPhotoWikilink(selectedPath),
			photoSelectionPath: selectedPath,
		};

		const result = await session.submit(values);

		expect(result).toMatchObject({
			status: "error",
			message: expect.stringContaining("own dossier"),
		});
		expect(port.updatePerson).not.toHaveBeenCalled();
	});

	it("requires full identity and exact current index ownership before accepting a dossier-local photo", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const person = { ...alice, id: personId, filePath: "People/Profiles/Alice/Alice.md" };
		const selectedPath = "People/Profiles/Alice/Photos/Portrait.jpg";
		const file = { path: person.filePath } as TFile;
		const original = editPersonFormValues(person, undefined, [person, bob], () => undefined);
		const values = {
			...structuredClone(original),
			photo: canonicalPersonPhotoWikilink(selectedPath),
			photoSelectionPath: selectedPath,
		};
		const stalePort = mutationPort();
		const staleSession = new PersonFormSession(
			{ kind: "edit", file, original },
			stalePort,
			[person, bob],
			() => [],
			photoValidatorFor({
				person,
				people: () => [],
				assetPaths: () => [selectedPath],
				loadedPaths: () => [person.filePath, selectedPath],
			}),
		);

		await expect(staleSession.submit(values)).resolves.toMatchObject({
			status: "error",
			message: expect.stringContaining("canonical dossier"),
		});
		expect(stalePort.updatePerson).not.toHaveBeenCalled();

		const currentPort = mutationPort();
		const currentSession = new PersonFormSession(
			{ kind: "edit", file, original },
			currentPort,
			[person, bob],
			() => [person, bob],
			photoValidatorFor({
				person,
				people: () => [person, bob],
				assetPaths: () => [selectedPath],
				loadedPaths: () => [person.filePath, selectedPath],
			}),
		);
		await expect(currentSession.submit(values)).resolves.toMatchObject({ status: "success", created: false });
		expect(currentPort.updatePerson).toHaveBeenCalledOnce();
	});

	it("rejects a local photo when two current people own direct profiles in one dossier", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const person = { ...alice, id: personId, filePath: "People/Profiles/Alice/Alice.md" };
		const otherOwner = {
			...bob,
			id: "person-c0ffee00-1111-4222-8333-444455556666",
			filePath: "People/Profiles/Alice/Bob.md",
		};
		const selectedPath = "People/Profiles/Alice/Photos/Portrait.jpg";
		const file = { path: person.filePath } as TFile;
		const original = editPersonFormValues(person, undefined, [person, otherOwner], () => undefined);
		const port = mutationPort();
		const session = new PersonFormSession(
			{ kind: "edit", file, original },
			port,
			[person, otherOwner],
			() => [person, otherOwner],
			photoValidatorFor({
				person,
				people: () => [person, otherOwner],
				assetPaths: () => [selectedPath],
				loadedPaths: () => [person.filePath, otherOwner.filePath, selectedPath],
			}),
		);
		const values = {
			...structuredClone(original),
			photo: canonicalPersonPhotoWikilink(selectedPath),
			photoSelectionPath: selectedPath,
		};

		await expect(session.submit(values)).resolves.toMatchObject({
			status: "error",
			message: expect.stringContaining("canonical dossier"),
		});
		expect(port.createPerson).not.toHaveBeenCalled();
		expect(port.updatePerson).not.toHaveBeenCalled();
	});

	it("accepts one exact local descendant selection and keeps the dossier stable through a profile rename", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const person = {
			...alice,
			id: personId,
			filePath: "People/Profiles/Alice/Alice.md",
		};
		const selectedPath = "People/Profiles/Alice/Events/Portrait.jpg";
		const file = { path: person.filePath } as TFile;
		const original = editPersonFormValues(person, undefined, [person, bob], () => undefined);
		const port = mutationPort();
		const session = new PersonFormSession(
			{ kind: "edit", file, original },
			port,
			[person, bob],
			() => [person, bob],
			photoValidatorFor({
				person,
				people: () => [person, bob],
				assetPaths: () => [selectedPath],
				loadedPaths: () => [person.filePath, selectedPath],
			}),
		);
		const values = {
			...structuredClone(original),
			name: "Alice Admin",
			photo: canonicalPersonPhotoWikilink(selectedPath),
			photoSelectionPath: selectedPath,
		};

		await expect(session.submit(values)).resolves.toMatchObject({ status: "confirmation-required" });
		await expect(session.submit(values, true)).resolves.toMatchObject({ status: "success", renamed: true });
		expect(port.updatePerson).toHaveBeenCalledWith(
			file,
			{ name: "Alice Admin", photo: `[[${selectedPath}]]` },
			expect.objectContaining({ targetPath: "People/Profiles/Alice/Alice Admin.md" }),
		);
	});

	it("rejects a selected photo when the edit profile has no canonical dossier boundary", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const person = { ...alice, id: personId, filePath: "People/Profiles/Alice.md" };
		const selectedPath = "People/Profiles/Portrait.jpg";
		const file = { path: person.filePath } as TFile;
		const original = editPersonFormValues(person, undefined, [person, bob], () => undefined);
		const port = mutationPort();
		const session = new PersonFormSession(
			{ kind: "edit", file, original },
			port,
			[person, bob],
			() => [person, bob],
			photoValidatorFor({
				person,
				people: () => [person, bob],
				assetPaths: () => [selectedPath],
				loadedPaths: () => [person.filePath, selectedPath],
			}),
		);

		await expect(
			session.submit({
				...structuredClone(original),
				photo: canonicalPersonPhotoWikilink(selectedPath),
				photoSelectionPath: selectedPath,
			}),
		).resolves.toMatchObject({ status: "error", message: expect.stringContaining("canonical dossier") });
		expect(port.updatePerson).not.toHaveBeenCalled();
	});

	it("rejects a photo selection on create even when an injected asset exists", async () => {
		const selectedPath = "People/Profiles/Carol/Portrait.jpg";
		const port = mutationPort();
		const session = new PersonFormSession({ kind: "create" }, port, [alice, bob], () => [alice, bob]);
		const values = {
			...createPersonFormValues("People", "person-c0ffee00-1111-4222-8333-444455556666"),
			name: "Carol",
			photo: canonicalPersonPhotoWikilink(selectedPath),
			photoSelectionPath: selectedPath,
		};

		await expect(session.submit(values)).resolves.toMatchObject({
			status: "error",
			message: expect.stringContaining("after the dossier exists"),
		});
		expect(port.createPerson).not.toHaveBeenCalled();
	});

	it("rejects a newly selected photo that disappears before Save without writing", async () => {
		const person = {
			...alice,
			id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
			filePath: "People/Profiles/Alice/Alice.md",
		};
		const selectedPath = "People/Profiles/Alice/Portrait.jpg";
		const file = { path: person.filePath } as TFile;
		const original = editPersonFormValues(person, undefined, [person, bob], () => undefined);
		const port = mutationPort();
		let currentAssets = [selectedPath];
		const session = new PersonFormSession(
			{ kind: "edit", file, original },
			port,
			[person, bob],
			() => [person, bob],
			photoValidatorFor({
				person,
				people: () => [person, bob],
				assetPaths: () => currentAssets,
				loadedPaths: () => [person.filePath, ...currentAssets],
			}),
		);
		const values = {
			...structuredClone(original),
			photo: canonicalPersonPhotoWikilink(selectedPath),
			photoSelectionPath: selectedPath,
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
