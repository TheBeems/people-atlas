import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import {
	AtlasMutationService,
	MutationError,
	PartialPersonMutationError,
} from "../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

function createHarness() {
	const files = new Map<
		string,
		{ path: string; children?: unknown[]; content?: string; frontmatter?: Record<string, unknown> }
	>();
	const renameFailure: { current?: Error | undefined } = {};
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path),
			createFolder: async (path: string) => {
				files.set(path, { path, children: [] });
				return files.get(path);
			},
			create: async (path: string, content: string) => {
				const file = { path, content };
				files.set(path, file);
				return file;
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => ({ frontmatter: files.get(file.path)?.frontmatter ?? {} }),
		},
		fileManager: {
			processFrontMatter: async (file: { path: string }, callback: (frontmatter: Record<string, unknown>) => void) => {
				const entry = files.get(file.path) ?? { path: file.path };
				entry.frontmatter ??= {};
				callback(entry.frontmatter);
				files.set(file.path, entry);
			},
			renameFile: async (file: { path: string }, targetPath: string) => {
				if (renameFailure.current) throw renameFailure.current;
				if (files.has(targetPath)) throw new Error(`A note already exists at “${targetPath}”.`);
				const entry = files.get(file.path);
				if (!entry) throw new Error(`The source note “${file.path}” is missing.`);
				files.delete(file.path);
				entry.path = targetPath;
				file.path = targetPath;
				files.set(targetPath, entry);
			},
		},
	} as unknown as App;
	const index = {
		getPeoplePathsById: () => [] as string[],
		getRelationshipPathsById: () => [] as string[],
	};
	const service = new AtlasMutationService(
		app,
		() => DEFAULT_SETTINGS,
		() => true,
		index,
		() => "person-fixed",
	);
	return { app, files, renameFailure, service };
}

describe("AtlasMutationService", () => {
	it("creates a person in People with a generated explicit ID", async () => {
		const { files, service } = createHarness();
		const file = await service.createPerson({ name: "Jan Jansen" });

		expect(file.path).toBe("People/Jan Jansen.md");
		expect(files.get(file.path)?.content).toContain('person_id: "person-fixed"');
	});

	it("preserves unrelated frontmatter during a configured edit", async () => {
		const { files, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		files.set(file.path, { path: file.path, frontmatter: { type: "person", name: "Jan", custom: "keep" } });

		await service.updatePerson(file, { name: "Jan Jansen" });

		expect(files.get(file.path)?.frontmatter).toEqual({ type: "person", name: "Jan Jansen", custom: "keep" });
	});

	it("renames a person in place after saving configured properties", async () => {
		const { files, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: { type: "person", person_id: "person-jan", name: "Jan", custom: "keep" },
		});

		const result = await service.updatePerson(
			file,
			{ name: "Jan Jansen", aliases: ["JJ"] },
			{ targetPath: "People/Jan Jansen.md" },
		);

		expect(result).toEqual({ file, renamed: true });
		expect(file.path).toBe("People/Jan Jansen.md");
		expect(files.has("People/Jan.md")).toBe(false);
		expect(files.get(file.path)?.frontmatter).toEqual({
			type: "person",
			person_id: "person-jan",
			name: "Jan Jansen",
			aliases: ["JJ"],
			custom: "keep",
		});
	});

	it("materializes a legacy path fallback before renaming so identity remains stable", async () => {
		const { files, service } = createHarness();
		const file = { path: "People/Legacy.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: { type: "person", name: "Legacy", custom: "keep" },
		});

		await service.updatePerson(file, { name: "Legacy Person" }, { targetPath: "People/Legacy Person.md" });

		expect(files.get(file.path)?.frontmatter).toMatchObject({
			person_id: "path:people/legacy.md",
			name: "Legacy Person",
			custom: "keep",
		});
	});

	it("rejects a rename collision before changing frontmatter", async () => {
		const { files, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		files.set(file.path, { path: file.path, frontmatter: { type: "person", name: "Jan", custom: "keep" } });
		files.set("People/Sam.md", { path: "People/Sam.md", frontmatter: { type: "person", name: "Sam" } });

		await expect(service.updatePerson(file, { name: "Sam" }, { targetPath: "People/Sam.md" })).rejects.toThrow(
			"already exists",
		);
		expect(files.get(file.path)?.frontmatter).toEqual({ type: "person", name: "Jan", custom: "keep" });
	});

	it("reports saved properties after an unexpected rename failure and keeps the queue reusable", async () => {
		const { files, renameFailure, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: { type: "person", person_id: "person-jan", name: "Jan", custom: "keep" },
		});
		renameFailure.current = new Error("disk unavailable");

		const failed = service.updatePerson(file, { name: "Jan Jansen" }, { targetPath: "People/Jan Jansen.md" });
		await expect(failed).rejects.toBeInstanceOf(PartialPersonMutationError);
		await expect(failed).rejects.toMatchObject({
			propertiesSaved: true,
			currentPath: "People/Jan.md",
			targetPath: "People/Jan Jansen.md",
		});
		expect(files.get(file.path)?.frontmatter).toMatchObject({ name: "Jan Jansen", custom: "keep" });

		renameFailure.current = undefined;
		await expect(service.updatePerson(file, { organisations: ["Example Org"] })).resolves.toMatchObject({
			renamed: false,
		});
	});

	it("does not create an invalid relationship", async () => {
		const { files, service } = createHarness();

		await expect(
			service.createRelationship({ path: "Relationships/Jan.md", from: "", to: "[[Sam]]" }),
		).rejects.toBeInstanceOf(MutationError);
		expect(files.has("Relationships/Jan.md")).toBe(false);
	});

	it("creates and updates copied preset metadata while preserving unrelated frontmatter", async () => {
		const { files, service } = createHarness();
		const created = await service.createRelationship({
			path: "Relationships/Mathijs-Cor.md",
			from: "[[Mathijs]]",
			to: "[[Cor]]",
			presetId: "parent-child",
			types: ["parent-child"],
			fromRole: "Kind",
			toRole: "Vader",
			direction: "source-to-target",
		});
		expect(files.get(created.path)?.content).toContain('relationship_preset: "parent-child"');
		expect(files.get(created.path)?.content).toContain('from_role: "Kind"');
		expect(files.get(created.path)?.content).toContain('to_role: "Vader"');

		const file = { path: "Relationships/Existing.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: {
				type: "relationship",
				from: "[[Alice]]",
				to: "[[Bob]]",
				custom: "keep",
			},
		});
		await service.updateRelationship(file, {
			presetId: "sibling",
			types: ["sibling"],
			fromRole: "Brother",
			toRole: "Sister",
			direction: "undirected",
		});

		expect(files.get(file.path)?.frontmatter).toMatchObject({
			custom: "keep",
			relationship_preset: "sibling",
			relationship_types: ["sibling"],
			from_role: "Brother",
			to_role: "Sister",
			direction: "undirected",
		});
	});

	it("rejects overlapping person and relationship creates with one explicit identity", async () => {
		const people = createHarness();
		const personResults = await Promise.allSettled([
			people.service.createPerson({ name: "Alice" }),
			people.service.createPerson({ name: "Bob" }),
		]);

		expect(personResults.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
		expect(
			[...people.files.values()].filter((entry) => entry.content?.includes('person_id: "person-fixed"')),
		).toHaveLength(1);

		const relationships = createHarness();
		const relationshipResults = await Promise.allSettled([
			relationships.service.createRelationship({
				path: "Relationships/Alice-Bob.md",
				relationshipId: "relationship-shared",
				from: "[[Alice]]",
				to: "[[Bob]]",
			}),
			relationships.service.createRelationship({
				path: "Relationships/Alice-Carol.md",
				relationshipId: "relationship-shared",
				from: "[[Alice]]",
				to: "[[Carol]]",
			}),
		]);

		expect(relationshipResults.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
		expect(
			[...relationships.files.values()].filter((entry) =>
				entry.content?.includes('relationship_id: "relationship-shared"'),
			),
		).toHaveLength(1);
	});

	it("rejects overlapping identity updates and preserves the rejected notes", async () => {
		const people = createHarness();
		const alice = { path: "People/Alice.md" } as TFile;
		const bob = { path: "People/Bob.md" } as TFile;
		people.files.set(alice.path, { path: alice.path, frontmatter: { type: "person", name: "Alice", custom: "alice" } });
		people.files.set(bob.path, { path: bob.path, frontmatter: { type: "person", name: "Bob", custom: "bob" } });

		const personResults = await Promise.allSettled([
			people.service.updatePerson(alice, { personId: "person-shared" }),
			people.service.updatePerson(bob, { personId: " person-shared " }),
		]);

		expect(personResults.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
		expect(
			[alice, bob].filter((file) => people.files.get(file.path)?.frontmatter?.person_id === "person-shared"),
		).toHaveLength(1);
		expect(people.files.get(alice.path)?.frontmatter?.custom).toBe("alice");
		expect(people.files.get(bob.path)?.frontmatter?.custom).toBe("bob");

		const relationships = createHarness();
		const first = { path: "Relationships/First.md" } as TFile;
		const second = { path: "Relationships/Second.md" } as TFile;
		for (const file of [first, second]) {
			relationships.files.set(file.path, {
				path: file.path,
				frontmatter: { type: "relationship", from: "[[Alice]]", to: "[[Bob]]", custom: file.path },
			});
		}

		const relationshipResults = await Promise.allSettled([
			relationships.service.updateRelationship(first, { relationshipId: "relationship-shared" }),
			relationships.service.updateRelationship(second, { relationshipId: " relationship-shared " }),
		]);

		expect(relationshipResults.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
		expect(
			[first, second].filter(
				(file) => relationships.files.get(file.path)?.frontmatter?.relationship_id === "relationship-shared",
			),
		).toHaveLength(1);
		expect(relationships.files.get(first.path)?.frontmatter?.custom).toBe(first.path);
		expect(relationships.files.get(second.path)?.frontmatter?.custom).toBe(second.path);
	});

	it("keeps a created identity reserved while metadata is still stale", async () => {
		const { files, service } = createHarness();
		const alice = await service.createPerson({ name: "Alice" });

		await service.updatePerson(alice, { name: "Alice Updated" });

		await expect(service.createPerson({ name: "Bob" })).rejects.toThrow("person_id “person-fixed” is already in use.");
		expect([...files.values()].filter((entry) => entry.content?.includes('person_id: "person-fixed"'))).toHaveLength(1);
	});
});
