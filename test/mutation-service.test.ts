import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import {
	AtlasMutationService,
	MutationError,
	PartialPersonMutationError,
	STALE_PERSON_EDIT_MESSAGE,
	STALE_RELATIONSHIP_PRESET_PREVIEW_MESSAGE,
} from "../src/mutations/atlas-mutation-service";
import { capturePersonEditSourceBaseline } from "../src/mutations/person-source-guard";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

function createHarness() {
	const files = new Map<
		string,
		{ path: string; children?: unknown[]; content?: string; frontmatter?: Record<string, unknown> }
	>();
	const cachedFrontmatter = new Map<string, Record<string, unknown>>();
	const cachedTags = new Map<string, Array<{ tag: string }>>();
	const hostCommitCount = { current: 0 };
	const renameFailure: { current?: Error | undefined } = {};
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path),
			read: async (file: { path: string }) => {
				const entry = files.get(file.path);
				if (!entry) throw new Error(`The source note “${file.path}” is missing.`);
				return entry.content ?? "";
			},
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
			getFileCache: (file: { path: string }) => ({
				frontmatter: cachedFrontmatter.get(file.path) ?? files.get(file.path)?.frontmatter ?? {},
				tags: cachedTags.get(file.path),
			}),
		},
		fileManager: {
			processFrontMatter: async (file: { path: string }, callback: (frontmatter: Record<string, unknown>) => void) => {
				const entry = files.get(file.path) ?? { path: file.path };
				const draft = structuredClone(entry.frontmatter ?? {});
				callback(draft);
				hostCommitCount.current += 1;
				entry.frontmatter = draft;
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
	return { app, cachedFrontmatter, cachedTags, files, hostCommitCount, renameFailure, service };
}

describe("AtlasMutationService", () => {
	it("creates a person in People with a generated explicit ID", async () => {
		const { files, service } = createHarness();
		const file = await service.createPerson({
			name: "Jan Jansen",
			birthDate: "--07-30",
			pronouns: " they/them ",
			gender: " non-binary ",
			emails: [" Jan@Example.com "],
			phones: [" +31 (0)20 123-45-67 "],
			jobTitle: " Staff Engineer ",
		});

		expect(file.path).toBe("People/Jan Jansen.md");
		expect(files.get(file.path)?.content).toContain('person_id: "person-fixed"');
		expect(files.get(file.path)?.content).toContain('birth_date: "--07-30"');
		expect(files.get(file.path)?.content).toContain('pronouns: "they/them"');
		expect(files.get(file.path)?.content).toContain('gender: "non-binary"');
		expect(files.get(file.path)?.content).toContain('emails: ["Jan@Example.com"]');
		expect(files.get(file.path)?.content).toContain('phones: ["+31 (0)20 123-45-67"]');
		expect(files.get(file.path)?.content).toContain('job_title: "Staff Engineer"');
	});

	it("preserves unrelated frontmatter during a configured edit", async () => {
		const { files, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: { type: "person", person_id: "person-jan", name: "Jan", custom: "keep" },
		});

		await service.updatePerson(file, { name: "Jan Jansen" });

		expect(files.get(file.path)?.frontmatter).toEqual({
			type: "person",
			person_id: "person-jan",
			name: "Jan Jansen",
			custom: "keep",
		});
	});

	it("updates only requested profile fields while preserving unrelated malformed data and note content", async () => {
		const { files, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		const content = "---\ntype: person\n---\n\nKeep this body.\n";
		files.set(file.path, {
			path: file.path,
			content,
			frontmatter: {
				type: "person",
				person_id: "person-jan",
				name: "Jan",
				birth_date: "July 30",
				emails: ["not-an-email"],
				phones: ["+31 20", "+31 20"],
				pronouns: "he/him",
				custom: "keep",
			},
		});

		await service.updatePerson(file, { aliases: ["J"] });
		expect(files.get(file.path)?.frontmatter).toMatchObject({
			birth_date: "July 30",
			emails: ["not-an-email"],
			phones: ["+31 20", "+31 20"],
			aliases: ["J"],
			custom: "keep",
		});

		await service.updatePerson(file, {
			birthDate: "1990-07-30",
			emails: ["jan@example.com"],
			phones: null,
			pronouns: null,
		});
		expect(files.get(file.path)?.frontmatter).toEqual({
			type: "person",
			person_id: "person-jan",
			name: "Jan",
			birth_date: "1990-07-30",
			emails: ["jan@example.com"],
			aliases: ["J"],
			custom: "keep",
		});
		expect(files.get(file.path)?.content).toBe(content);
	});

	it("rejects invalid changed profile values before the host can write", async () => {
		const { files, hostCommitCount, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: { type: "person", name: "Jan", custom: "keep" },
		});
		const before = structuredClone(files.get(file.path)?.frontmatter);

		await expect(service.updatePerson(file, { birthDate: "2023-02-29" })).rejects.toThrow("Birth date");
		await expect(service.updatePerson(file, { emails: ["invalid"] })).rejects.toThrow("Email address 1");
		await expect(service.updatePerson(file, { phones: ["+31 20", "+31 20"] })).rejects.toThrow("Phone number 2");

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)?.frontmatter).toEqual(before);
	});

	it.each([
		{
			change: "type",
			liveFrontmatter: { type: "relationship", person_id: "person-jan", name: "Jan", custom: "keep" },
		},
		{
			change: "identity",
			liveFrontmatter: { type: "person", person_id: "person-other", name: "Jan", custom: "keep" },
		},
	])("rejects a live person $change change without committing stale edits", async ({ liveFrontmatter }) => {
		const { cachedFrontmatter, files, hostCommitCount, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		cachedFrontmatter.set(file.path, {
			type: "person",
			person_id: "person-jan",
			name: "Jan",
		});
		files.set(file.path, {
			path: file.path,
			content: "---\ntype: person\n---\n\nKeep this body.\n",
			frontmatter: liveFrontmatter,
		});
		const before = structuredClone(files.get(file.path));

		await expect(service.updatePerson(file, { jobTitle: "Engineer" })).rejects.toThrow(STALE_PERSON_EDIT_MESSAGE);

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)).toEqual(before);
	});

	it("updates and safely renames a tag-only person with an explicit ID", async () => {
		const { app, cachedTags, files, hostCommitCount, service } = createHarness();
		const source = "#person\n\nTag-only person.\n";
		const file = {
			path: "People/Tagged.md",
			stat: { ctime: 1, mtime: 1, size: source.length },
		} as TFile;
		files.set(file.path, {
			path: file.path,
			content: source,
			frontmatter: { person_id: "person-tagged", name: "Tagged", custom: "keep" },
		});
		cachedTags.set(file.path, [{ tag: "#person" }]);
		const sourceBaseline = await capturePersonEditSourceBaseline(app, file, DEFAULT_SETTINGS.personTag);
		expect(sourceBaseline).toBeDefined();

		await service.updatePerson(
			file,
			{ name: "Tagged Person", pronouns: "they/them" },
			{
				targetPath: "People/Tagged Person.md",
				expectedPersonId: "person-tagged",
				expectedClassification: "tag",
				sourceBaseline,
			},
		);

		expect(hostCommitCount.current).toBe(1);
		expect(file.path).toBe("People/Tagged Person.md");
		expect(files.get(file.path)?.frontmatter).toEqual({
			person_id: "person-tagged",
			name: "Tagged Person",
			pronouns: "they/them",
			custom: "keep",
		});
	});

	it.each([
		{
			change: "a removed tag with a newer stat",
			source: "Ordinary person body.\n",
			mtime: 2,
		},
		{
			change: "same-size source drift even when the stat is unchanged",
			source: "#people\n\nTag-only person.\n",
			mtime: 1,
		},
	])("rejects tag-only $change before processFrontMatter can commit", async ({ source: changedSource, mtime }) => {
		const { app, cachedTags, files, hostCommitCount, service } = createHarness();
		const source = "#person\n\nTag-only person.\n";
		const file = {
			path: "People/Tagged.md",
			stat: { ctime: 1, mtime: 1, size: source.length },
		} as TFile;
		files.set(file.path, {
			path: file.path,
			content: source,
			frontmatter: { person_id: "person-tagged", name: "Tagged", custom: "keep" },
		});
		cachedTags.set(file.path, [{ tag: "#person" }]);
		const sourceBaseline = await capturePersonEditSourceBaseline(app, file, DEFAULT_SETTINGS.personTag);
		if (!sourceBaseline) throw new Error("Expected a tag-only source baseline.");
		const entry = files.get(file.path);
		if (!entry) throw new Error("Expected the tag-only person fixture.");
		entry.content = changedSource;
		file.stat.mtime = mtime;
		file.stat.size = changedSource.length;
		const before = structuredClone(entry);

		await expect(
			service.updatePerson(
				file,
				{ jobTitle: "Engineer" },
				{
					expectedPersonId: "person-tagged",
					expectedClassification: "tag",
					sourceBaseline,
				},
			),
		).rejects.toThrow(STALE_PERSON_EDIT_MESSAGE);

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)).toEqual(before);
	});

	it("atomically rejects a removed frontmatter tag after source verification", async () => {
		const { app, cachedFrontmatter, files, hostCommitCount, service } = createHarness();
		const source = "---\ntags:\n  - person\nname: Tagged\n---\n\nTag-only person.\n";
		const file = {
			path: "People/Tagged.md",
			stat: { ctime: 1, mtime: 1, size: source.length },
		} as TFile;
		cachedFrontmatter.set(file.path, { tags: ["person"], person_id: "person-tagged", name: "Tagged" });
		files.set(file.path, {
			path: file.path,
			content: source,
			frontmatter: { person_id: "person-tagged", name: "Tagged", custom: "keep" },
		});
		const sourceBaseline = await capturePersonEditSourceBaseline(app, file, DEFAULT_SETTINGS.personTag);
		if (!sourceBaseline) throw new Error("Expected a frontmatter-tag source baseline.");
		const before = structuredClone(files.get(file.path));

		await expect(
			service.updatePerson(
				file,
				{ jobTitle: "Engineer" },
				{
					expectedPersonId: "person-tagged",
					expectedClassification: "tag",
					sourceBaseline,
				},
			),
		).rejects.toThrow(STALE_PERSON_EDIT_MESSAGE);

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)).toEqual(before);
	});

	it("rejects type and identity drift already visible before the service call", async () => {
		const { cachedFrontmatter, files, hostCommitCount, service } = createHarness();
		const file = { path: "People/Jan.md" } as TFile;
		const changed = {
			type: "relationship",
			person_id: "person-other",
			name: "Jan",
			custom: "keep",
		};
		cachedFrontmatter.set(file.path, changed);
		files.set(file.path, { path: file.path, frontmatter: structuredClone(changed) });
		const before = structuredClone(files.get(file.path)?.frontmatter);

		await expect(
			service.updatePerson(
				file,
				{ jobTitle: "Engineer" },
				{
					expectedPersonId: "person-jan",
					expectedClassification: "type",
				},
			),
		).rejects.toThrow(STALE_PERSON_EDIT_MESSAGE);

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)?.frontmatter).toEqual(before);
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

	it("rejects renaming a person note without an explicit ID", async () => {
		const { files, service } = createHarness();
		const file = { path: "People/Legacy.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: { type: "person", name: "Legacy", custom: "keep" },
		});

		await expect(
			service.updatePerson(file, { name: "Legacy Person" }, { targetPath: "People/Legacy Person.md" }),
		).rejects.toThrow("must define a non-empty person_id");
		expect(file.path).toBe("People/Legacy.md");
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
		});
		expect(files.get(created.path)?.content).toContain('relationship_preset: "parent-child"');
		expect(files.get(created.path)?.content).toContain('from_role: "Kind"');
		expect(files.get(created.path)?.content).toContain('to_role: "Vader"');
		expect(files.get(created.path)?.content).not.toContain("direction:");

		const file = { path: "Relationships/Existing.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			content: "---\ntype: relationship\n---\n\nRelationship narrative stays intact.\n",
			frontmatter: {
				type: "relationship",
				from: "[[Alice]]",
				to: "[[Bob]]",
				direction: "source-to-target",
				connection_direction: "legacy-custom-value",
				custom: "keep",
			},
		});
		await service.updateRelationship(file, {
			presetId: "sibling",
			types: ["sibling"],
			fromRole: "Brother",
			toRole: "Sister",
			status: "active",
		});

		expect(files.get(file.path)?.frontmatter).toMatchObject({
			custom: "keep",
			relationship_preset: "sibling",
			relationship_types: ["sibling"],
			from_role: "Brother",
			to_role: "Sister",
			direction: "source-to-target",
			connection_direction: "legacy-custom-value",
			status: "active",
		});
		expect(files.get(file.path)?.content).toBe(
			"---\ntype: relationship\n---\n\nRelationship narrative stays intact.\n",
		);
	});

	it("guardedly synchronizes only template-owned values against live frontmatter", async () => {
		const { cachedFrontmatter, files, hostCommitCount, service } = createHarness();
		const file = { path: "Relationships/Alice-Bob.md" } as TFile;
		const content = "---\ntype: relationship\n---\n\nRelationship narrative stays intact.\n";
		files.set(file.path, {
			path: file.path,
			content,
			frontmatter: {
				type: "relationship",
				relationship_id: "relationship-alice-bob",
				from: "[[Alice]]",
				to: "[[Bob]]",
				relationship_preset: " colleague ",
				relationship_types: [" colleague ", " friend "],
				from_role: " Peer ",
				to_role: " Manager ",
				closeness: 4,
				since: "2024-01-02",
				last_contact: "2026-07-30",
				status: "active",
				direction: "source-to-target",
				custom: "keep",
			},
		});
		cachedFrontmatter.set(file.path, {
			relationship_preset: "colleague",
			relationship_types: ["stale-cache"],
			from_role: "Stale",
			to_role: "Cache",
		});

		const result = await service.syncRelationshipPreset(
			file,
			{
				presetId: "colleague",
				types: ["colleague", "friend"],
				fromRole: "Peer",
				toRole: "Manager",
			},
			{
				types: ["coworker"],
				fromRole: "Colleague",
				toRole: "Lead",
			},
		);

		expect(result).toEqual({ status: "updated" });
		expect(hostCommitCount.current).toBe(1);
		expect(files.get(file.path)?.frontmatter).toEqual({
			type: "relationship",
			relationship_id: "relationship-alice-bob",
			from: "[[Alice]]",
			to: "[[Bob]]",
			relationship_preset: " colleague ",
			relationship_types: ["coworker"],
			from_role: "Colleague",
			to_role: "Lead",
			closeness: 4,
			since: "2024-01-02",
			last_contact: "2026-07-30",
			status: "active",
			direction: "source-to-target",
			custom: "keep",
		});
		expect(files.get(file.path)?.content).toBe(content);
	});

	it("returns already-current without mutating live frontmatter across retries", async () => {
		const { cachedFrontmatter, files, hostCommitCount, service } = createHarness();
		const file = { path: "Relationships/Alice-Bob.md" } as TFile;
		const liveFrontmatter = {
			type: "relationship",
			from: "[[Alice]]",
			to: "[[Bob]]",
			relationship_preset: "colleague",
			relationship_types: ["coworker"],
			from_role: "Colleague",
			to_role: "Lead",
			custom: "keep",
		};
		files.set(file.path, { path: file.path, frontmatter: liveFrontmatter });
		cachedFrontmatter.set(file.path, {
			relationship_preset: "colleague",
			relationship_types: ["colleague"],
			from_role: "Peer",
			to_role: "Manager",
		});
		const approvedBefore = {
			presetId: "colleague",
			types: ["colleague"],
			fromRole: "Peer",
			toRole: "Manager",
		};
		const updates = {
			types: ["coworker"],
			fromRole: "Colleague",
			toRole: "Lead",
		};
		const before = structuredClone(liveFrontmatter);

		await expect(service.syncRelationshipPreset(file, approvedBefore, updates)).resolves.toEqual({
			status: "already-current",
		});
		await expect(service.syncRelationshipPreset(file, approvedBefore, updates)).resolves.toEqual({
			status: "already-current",
		});

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)?.frontmatter).toEqual(before);
	});

	it("rejects a live non-relationship note before treating owned values as already current", async () => {
		const { files, hostCommitCount, service } = createHarness();
		const file = { path: "Relationships/Alice-Bob.md" } as TFile;
		const liveFrontmatter = {
			type: "person",
			from: "[[Alice]]",
			to: "[[Bob]]",
			relationship_preset: "colleague",
			relationship_types: ["coworker"],
			from_role: "Colleague",
			to_role: "Lead",
			custom: "keep",
		};
		files.set(file.path, { path: file.path, frontmatter: liveFrontmatter });
		const before = structuredClone(liveFrontmatter);

		await expect(
			service.syncRelationshipPreset(
				file,
				{
					presetId: "colleague",
					types: ["colleague"],
					fromRole: "Peer",
					toRole: "Manager",
				},
				{
					types: ["coworker"],
					fromRole: "Colleague",
					toRole: "Lead",
				},
			),
		).rejects.toThrow(STALE_RELATIONSHIP_PRESET_PREVIEW_MESSAGE);

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)?.frontmatter).toEqual(before);
	});

	it.each([
		["template provenance", { relationship_preset: "new-template" }],
		["ordered relationship types", { relationship_types: ["friend", "colleague"] }],
		["first role", { from_role: "Cousin" }],
		["second role", { to_role: "Director" }],
	])("rejects stale %s from live frontmatter without mutating any property", async (_name, liveChange) => {
		const { cachedFrontmatter, files, hostCommitCount, service } = createHarness();
		const file = { path: "Relationships/Alice-Bob.md" } as TFile;
		const approvedFrontmatter = {
			type: "relationship",
			from: "[[Alice]]",
			to: "[[Bob]]",
			relationship_preset: "colleague",
			relationship_types: ["colleague", "friend"],
			from_role: "Peer",
			to_role: "Manager",
			custom: "keep",
		};
		const liveFrontmatter = { ...structuredClone(approvedFrontmatter), ...liveChange };
		const content = "---\ntype: relationship\n---\n\nKeep this body.\n";
		files.set(file.path, { path: file.path, content, frontmatter: liveFrontmatter });
		cachedFrontmatter.set(file.path, structuredClone(approvedFrontmatter));
		const before = structuredClone(liveFrontmatter);

		await expect(
			service.syncRelationshipPreset(
				file,
				{
					presetId: "colleague",
					types: ["colleague", "friend"],
					fromRole: "Peer",
					toRole: "Manager",
				},
				{
					types: ["coworker"],
					fromRole: "Colleague",
					toRole: "Lead",
				},
			),
		).rejects.toThrow(STALE_RELATIONSHIP_PRESET_PREVIEW_MESSAGE);

		expect(hostCommitCount.current).toBe(0);
		expect(files.get(file.path)?.frontmatter).toEqual(before);
		expect(files.get(file.path)?.content).toBe(content);
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
		people.files.set(alice.path, {
			path: alice.path,
			frontmatter: { type: "person", person_id: "person-alice", name: "Alice", custom: "alice" },
		});
		people.files.set(bob.path, {
			path: bob.path,
			frontmatter: { type: "person", person_id: "person-bob", name: "Bob", custom: "bob" },
		});

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
				frontmatter: {
					type: "relationship",
					relationship_id: `relationship-${file.path}`,
					from: "[[Alice]]",
					to: "[[Bob]]",
					custom: file.path,
				},
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
		const created = files.get(alice.path);
		if (!created) throw new Error("Created person fixture is missing.");
		created.frontmatter = {
			type: "person",
			person_id: "person-fixed",
			name: "Alice",
		};

		await service.updatePerson(alice, { name: "Alice Updated" });

		await expect(service.createPerson({ name: "Bob" })).rejects.toThrow("person_id “person-fixed” is already in use.");
		expect([...files.values()].filter((entry) => entry.content?.includes('person_id: "person-fixed"'))).toHaveLength(1);
	});
});
