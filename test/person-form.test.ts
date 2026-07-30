import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { PersonRecord } from "../src/domain/types";
import {
	PersonFormSession,
	addPersonContact,
	buildPersonCreateInput,
	buildPersonUpdates,
	createPersonFormValues,
	editPersonFormValues,
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
			contacts: [{ raw: "[[People/Bob]]", resolvedPath: bob.filePath }],
		};

		expect(proposeCreatePersonPath(values.name, "People")).toBe("People/Carol.md");
		expect(buildPersonCreateInput(values)).toEqual({
			name: "Carol",
			aliases: ["Caz", "C"],
			organisations: ["Example Org", "Other Org"],
			photo: "[[Assets/carol.png]]",
			contacts: ["[[People/Bob]]"],
		});
	});

	it("loads resolved and unresolved contacts without rewriting their raw values", () => {
		const values = editPersonFormValues(alice, "person-alice", "[[Assets/alice.png]]", [alice, bob], (target) =>
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
			"own contact",
		);
		expect(addPersonContact(first.contacts, "People/Missing.md", [alice, bob], alice.filePath).error).toContain(
			"indexed person",
		);
	});

	it("builds minimal updates and preserves unresolved contacts until explicitly removed", () => {
		const original = editPersonFormValues(alice, undefined, undefined, [alice, bob], () => undefined);
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

	it("requires a separate rename confirmation before invoking the mutation", async () => {
		const file = { path: alice.filePath } as TFile;
		const original = editPersonFormValues(alice, "person-alice", undefined, [alice, bob], () => undefined);
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
			{ targetPath: "People/Alice Example.md" },
		);
	});

	it("returns explicit partial state when properties saved before a failed rename", async () => {
		const file = { path: alice.filePath } as TFile;
		const original = editPersonFormValues(alice, undefined, undefined, [alice, bob], () => undefined);
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
