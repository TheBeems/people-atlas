import { parseYaml, TFile, type App } from "obsidian";
import { describe, expect, it } from "vitest";
import type { PersonRecord } from "../src/domain/types";
import { personProfilePath } from "../src/domain/people-paths";
import {
	AtlasMutationService,
	MutationError,
	PartialPersonMutationError,
	STALE_PERSON_EDIT_MESSAGE,
	STALE_RELATIONSHIP_PRESET_PREVIEW_MESSAGE,
} from "../src/mutations/atlas-mutation-service";
import { capturePersonEditSourceBaseline } from "../src/mutations/person-source-guard";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import type { PeopleAtlasSettings } from "../src/settings/types";
import { UNSAFE_PEOPLE_ROOT_CASES } from "./people-root-fixtures";
import { serializedPropertyOccurrences, unicodePropertySettings } from "./yaml-property-roundtrip-fixtures";

function createHarness(
	options: {
		people?: PersonRecord[];
		peoplePathsById?: Map<string, string[]>;
		settings?: PeopleAtlasSettings;
		currentPeople?: () => PersonRecord[];
		currentVaultFiles?: () => Array<{ path: string }>;
		withoutCurrentSnapshot?: boolean;
	} = {},
) {
	const files = new Map<
		string,
		{ path: string; children?: unknown[]; content?: string; frontmatter?: Record<string, unknown> }
	>();
	const cachedFrontmatter = new Map<string, Record<string, unknown>>();
	const cachedTags = new Map<string, Array<{ tag: string }>>();
	const hostCommitCount = { current: 0 };
	const processFrontMatterCallCount = { current: 0 };
	const renameCalls: string[] = [];
	const folderCreateCalls: string[] = [];
	const noteCreateCalls: string[] = [];
	const renameFailure: { current?: Error | undefined } = {};
	const createFailure: { current?: Error | undefined } = {};
	const beforeCreateFailure: { current?: ((path: string) => void) | undefined } = {};
	const beforeCreateFolderResolve: { current?: ((path: string) => void | Promise<void>) | undefined } = {};
	const beforeProcessFrontMatterCallback: { current?: ((file: { path: string }) => void) | undefined } = {};
	const trashFailure: { current?: Error | undefined } = {};
	const trashedPaths: string[] = [];
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path),
			getAllLoadedFiles: () => options.currentVaultFiles?.() ?? [...files.values()],
			read: async (file: { path: string }) => {
				const entry = files.get(file.path);
				if (!entry) throw new Error(`The source note “${file.path}” is missing.`);
				return entry.content ?? "";
			},
			createFolder: async (path: string) => {
				folderCreateCalls.push(path);
				files.set(path, { path, children: [] });
				await beforeCreateFolderResolve.current?.(path);
				return files.get(path);
			},
			create: async (path: string, content: string) => {
				noteCreateCalls.push(path);
				if (createFailure.current) {
					beforeCreateFailure.current?.(path);
					throw createFailure.current;
				}
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
			trashFile: async (entry: { path: string; children?: unknown[] }) => {
				if (trashFailure.current) throw trashFailure.current;
				if (entry.children && entry.children.length > 0) throw new Error(`Folder “${entry.path}” is not empty.`);
				files.delete(entry.path);
				trashedPaths.push(entry.path);
			},
			processFrontMatter: async (file: { path: string }, callback: (frontmatter: Record<string, unknown>) => void) => {
				processFrontMatterCallCount.current += 1;
				const entry = files.get(file.path) ?? { path: file.path };
				const draft = structuredClone(entry.frontmatter ?? {});
				beforeProcessFrontMatterCallback.current?.(file);
				callback(draft);
				hostCommitCount.current += 1;
				entry.frontmatter = draft;
				files.set(file.path, entry);
			},
			renameFile: async (file: { path: string }, targetPath: string) => {
				renameCalls.push(targetPath);
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
	const baseIndex = {
		getPeoplePathsById: (id: string) => options.peoplePathsById?.get(id) ?? [],
		getRelationshipPathsById: () => [] as string[],
		getContactMomentPathsById: () => [] as string[],
	};
	const index = options.withoutCurrentSnapshot
		? baseIndex
		: {
				...baseIndex,
				getSnapshot: () => ({
					people: options.currentPeople?.() ?? options.people ?? [],
					relationships: [],
					contactMoments: [],
					diagnostics: [],
				}),
			};
	const service = new AtlasMutationService(
		app,
		() => options.settings ?? DEFAULT_SETTINGS,
		() => true,
		index as ConstructorParameters<typeof AtlasMutationService>[3],
		() => "person-fixed",
	);
	return {
		app,
		beforeCreateFailure,
		beforeCreateFolderResolve,
		beforeProcessFrontMatterCallback,
		cachedFrontmatter,
		cachedTags,
		createFailure,
		trashFailure,
		trashedPaths,
		files,
		folderCreateCalls,
		hostCommitCount,
		noteCreateCalls,
		processFrontMatterCallCount,
		renameCalls,
		renameFailure,
		service,
	};
}

function vaultFile(path: string): TFile {
	const file = new TFile();
	const filename = path.split("/").at(-1) ?? "";
	const dot = filename.lastIndexOf(".");
	file.path = path;
	file.basename = dot < 0 ? filename : filename.slice(0, dot);
	file.extension = dot < 0 ? "" : filename.slice(dot + 1);
	return file;
}

function personRecord(id: string, filePath: string, name: string): PersonRecord {
	return {
		id,
		filePath,
		name,
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	};
}

describe("AtlasMutationService", () => {
	it("uses the shared presentation-first planner for plain, suffixed and extended person create paths", async () => {
		const unique = createHarness();
		const uniqueId = "person-12345678-90ab-4cde-8f01-23456789abcd";
		await expect(
			unique.service.createPerson({
				name: "Zoë Example",
				personId: uniqueId,
				reviewedPath: "People/Profiles/Zoë Example/Zoë Example.md",
			}),
		).resolves.toMatchObject({ path: "People/Profiles/Zoë Example/Zoë Example.md" });

		const existingId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const existingPath = "People/Profiles/Jan Jansen/Jan Jansen.md";
		const existing = personRecord(existingId, existingPath, "Jan Jansen");
		const collision = createHarness({
			people: [existing],
			peoplePathsById: new Map([[existingId, [existingPath]]]),
		});
		collision.files.set("People/Profiles/Jan Jansen", { path: "People/Profiles/Jan Jansen", children: [] });
		collision.files.set(existingPath, {
			path: existingPath,
			frontmatter: { type: "person", person_id: existingId, name: "Jan Jansen" },
		});
		await expect(
			collision.service.createPerson({
				name: "Jan Jansen",
				personId: "person-7d9f4a12-6b3c-4d5e-8f90-123456789abc",
				reviewedPath: "People/Profiles/Jan Jansen · FP/Jan Jansen.md",
			}),
		).resolves.toMatchObject({ path: "People/Profiles/Jan Jansen · FP/Jan Jansen.md" });

		const extended = createHarness({
			people: [existing],
			peoplePathsById: new Map([[existingId, [existingPath]]]),
		});
		extended.files.set("People/Profiles/Jan Jansen", { path: "People/Profiles/Jan Jansen", children: [] });
		extended.files.set(existingPath, {
			path: existingPath,
			frontmatter: { type: "person", person_id: existingId, name: "Jan Jansen" },
		});
		extended.files.set("People/Profiles/Jan Jansen · FP", {
			path: "People/Profiles/Jan Jansen · FP",
			children: [{ path: "People/Profiles/Jan Jansen · FP/Notes.md" }],
		});
		extended.files.set("People/Profiles/Jan Jansen · FP/Notes.md", {
			path: "People/Profiles/Jan Jansen · FP/Notes.md",
		});
		await expect(
			extended.service.createPerson({
				name: "Jan Jansen",
				personId: "person-7d9f4a12-6b3c-4d5e-8f90-123456789abc",
				reviewedPath: "People/Profiles/Jan Jansen · FPF/Jan Jansen.md",
			}),
		).resolves.toMatchObject({ path: "People/Profiles/Jan Jansen · FPF/Jan Jansen.md" });
	});

	it("blocks a user-owned ordinary dossier namespace before every create write", async () => {
		const { files, service } = createHarness();
		files.set("People/Profiles/Jan Jansen", {
			path: "People/Profiles/Jan Jansen",
			children: [{ path: "People/Profiles/Jan Jansen/Notes.md" }],
		});
		files.set("People/Profiles/Jan Jansen/Notes.md", { path: "People/Profiles/Jan Jansen/Notes.md" });
		const before = [...files.keys()];

		await expect(
			service.createPerson({
				name: "Jan Jansen",
				personId: "person-7d9f4a12-6b3c-4d5e-8f90-123456789abc",
				reviewedPath: "People/Profiles/Jan Jansen/Jan Jansen.md",
			}),
		).rejects.toThrow("without exactly one other canonical person owner");
		expect([...files.keys()]).toEqual(before);
	});

	it("rejects a current collision snapshot that drifts after preview before any folder or profile write", async () => {
		const ownerId = "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
		const ownerPath = "People/Profiles/Alice/Existing Alice.md";
		const owner = personRecord(ownerId, ownerPath, "Alice");
		let snapshotReads = 0;
		const externalProfile = { path: ownerPath };
		const { folderCreateCalls, noteCreateCalls, service } = createHarness({
			currentPeople: () => (snapshotReads++ === 0 ? [] : [owner]),
			currentVaultFiles: () => (snapshotReads < 2 ? [] : [externalProfile]),
		});

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Alice/Alice.md",
			}),
		).rejects.toThrow("reviewed person path changed");

		expect(folderCreateCalls).toEqual([]);
		expect(noteCreateCalls).toEqual([]);
	});

	it("fails closed when a safe test double omits the current People snapshot before any write", async () => {
		const { folderCreateCalls, noteCreateCalls, service } = createHarness({ withoutCurrentSnapshot: true });

		await expect(
			service.createPerson({
				name: "Carol",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Carol/Carol.md",
			}),
		).rejects.toThrow("current People index snapshot");

		expect(folderCreateCalls).toEqual([]);
		expect(noteCreateCalls).toEqual([]);
	});

	it("creates one dossier and canonical profile note from the explicit preplanned person ID", async () => {
		const { files, service } = createHarness();
		const file = await service.createPerson({
			name: "Jan Jansen",
			personId: "person-7D9F4A12-6B3C-4D5E-8F90-123456789ABC",
			reviewedPath: "People/Profiles/Jan Jansen/Jan Jansen.md",
			birthDate: "--07-30",
			pronouns: " they/them ",
			gender: " non-binary ",
			emails: [" Jan@Example.com "],
			phones: [" +31 (0)20 123-45-67 "],
			jobTitle: " Staff Engineer ",
		});

		expect(file.path).toBe("People/Profiles/Jan Jansen/Jan Jansen.md");
		expect(files.get("People/Profiles/Jan Jansen")?.children).toEqual([]);
		expect(files.get(file.path)?.content).toContain('person_id: "person-7D9F4A12-6B3C-4D5E-8F90-123456789ABC"');
		expect(files.get(file.path)?.content).toContain('birth_date: "--07-30"');
		expect(files.get(file.path)?.content).toContain('pronouns: "they/them"');
		expect(files.get(file.path)?.content).toContain('gender: "non-binary"');
		expect(files.get(file.path)?.content).toContain('emails: ["Jan@Example.com"]');
		expect(files.get(file.path)?.content).toContain('phones: ["+31 (0)20 123-45-67"]');
		expect(files.get(file.path)?.content).toContain('job_title: "Staff Engineer"');
	});

	it("roundtrips configured person property names through generated YAML", async () => {
		const settings = unicodePropertySettings();
		const { files, service } = createHarness({ settings });
		const personId = "person-12345678-90ab-4cde-8f01-23456789abcd";
		const file = await service.createPerson({
			name: "Jan Jansen",
			personId,
			reviewedPath: "People/Profiles/Jan Jansen/Jan Jansen.md",
			aliases: ["JJ"],
			organisations: ["Atlas"],
			contacts: ["Signal"],
			birthDate: "1990-07-30",
			pronouns: "they/them",
			gender: "non-binary",
			emails: ["jan@example.com"],
			phones: ["+31 20 123 45 67"],
			jobTitle: "Engineer",
		});
		const source = files.get(file.path)?.content ?? "";
		const parsed = parseYaml(source);
		const expected = {
			[settings.typeProperty]: settings.personTypeValue,
			[settings.personIdProperty]: personId,
			[settings.nameProperty]: "Jan Jansen",
			[settings.aliasesProperty]: ["JJ"],
			[settings.organisationsProperty]: ["Atlas"],
			[settings.contactsProperty]: ["Signal"],
			[settings.birthDateProperty]: "1990-07-30",
			[settings.pronounsProperty]: "they/them",
			[settings.genderProperty]: "non-binary",
			[settings.emailsProperty]: ["jan@example.com"],
			[settings.phonesProperty]: ["+31 20 123 45 67"],
			[settings.jobTitleProperty]: "Engineer",
		};

		expect(Object.keys(parsed).sort()).toEqual(Object.keys(expected).sort());
		expect(parsed).toEqual(expected);
		for (const key of Object.keys(expected)) expect(serializedPropertyOccurrences(source, key)).toBe(1);
		expect(parsed).not.toHaveProperty(settings.photoProperty);
		expect(serializedPropertyOccurrences(source, settings.photoProperty)).toBe(0);
	});

	it("roundtrips configured relationship property names through generated YAML", async () => {
		const settings = unicodePropertySettings();
		const { files, service } = createHarness({ settings });
		const file = await service.createRelationship({
			path: "People/Relationships/Alice - Bob.md",
			relationshipId: "relationship-12345678",
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
			types: ["friend", "colleague"],
			presetId: "friendship",
			fromRole: "Ouder",
			toRole: "Kind",
			closeness: 4,
			since: "2020-01-02",
			lastContact: "2026-08-01",
			status: "active",
		});
		const source = files.get(file.path)?.content ?? "";
		const parsed = parseYaml(source);
		const expected = {
			[settings.typeProperty]: settings.relationshipTypeValue,
			[settings.relationshipIdProperty]: "relationship-12345678",
			[settings.relationshipFromProperty]: "[[People/Alice]]",
			[settings.relationshipToProperty]: "[[People/Bob]]",
			[settings.relationshipTypesProperty]: ["friend", "colleague"],
			[settings.relationshipPresetProperty]: "friendship",
			[settings.relationshipFromRoleProperty]: "Ouder",
			[settings.relationshipToRoleProperty]: "Kind",
			[settings.closenessProperty]: 4,
			[settings.sinceProperty]: "2020-01-02",
			[settings.lastContactProperty]: "2026-08-01",
			[settings.statusProperty]: "active",
		};

		expect(Object.keys(parsed).sort()).toEqual(Object.keys(expected).sort());
		expect(parsed).toEqual(expected);
		for (const key of Object.keys(expected)) expect(serializedPropertyOccurrences(source, key)).toBe(1);
	});

	it("rejects unsafe programmatic property settings before relationship YAML or folder writes", async () => {
		const settings = { ...DEFAULT_SETTINGS, relationshipIdProperty: "relationship:id" };
		const { files, service } = createHarness({ settings });

		await expect(
			service.createRelationship({
				path: "People/Relationships/Alice - Bob.md",
				relationshipId: "relationship-unsafe-settings",
				from: "[[People/Alice]]",
				to: "[[People/Bob]]",
			}),
		).rejects.toThrow("relationshipIdProperty is invalid");
		expect(files.size).toBe(0);
	});

	it("rejects property settings that become unsafe while person folders are being created", async () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const { beforeCreateFolderResolve, files, noteCreateCalls, service } = createHarness({ settings });
		beforeCreateFolderResolve.current = (path) => {
			if (path === "People/Profiles/Alice") settings.nameProperty = "name:unsafe";
		};

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Alice/Alice.md",
			}),
		).rejects.toThrow("nameProperty is invalid");
		expect(noteCreateCalls).toEqual([]);
		expect(files.has("People/Profiles/Alice/Alice.md")).toBe(false);
	});

	it("keeps relationship serialization on the validated settings snapshot after folder creation", async () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const { beforeCreateFolderResolve, files, service } = createHarness({ settings });
		beforeCreateFolderResolve.current = (path) => {
			if (path === "People/Relationships") settings.relationshipIdProperty = "relationship:id";
		};

		await expect(
			service.createRelationship({
				path: "People/Relationships/Alice - Bob.md",
				relationshipId: "relationship-snapshot",
				from: "[[People/Alice]]",
				to: "[[People/Bob]]",
			}),
		).resolves.toBeDefined();

		expect(files.get("People/Relationships/Alice - Bob.md")?.content).toContain(
			'relationship_id: "relationship-snapshot"',
		);
		expect(files.get("People/Relationships/Alice - Bob.md")?.content).not.toContain("relationship:id");
	});

	it("keeps person edits on the validated settings snapshot inside the host callback", async () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const { beforeProcessFrontMatterCallback, files, service } = createHarness({ settings });
		const file = { path: "People/Jan.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: { type: "person", person_id: "person-jan", name: "Jan" },
		});
		beforeProcessFrontMatterCallback.current = () => {
			settings.nameProperty = "name:unsafe";
		};

		await expect(service.updatePerson(file, { name: "Jan Jansen" })).resolves.toMatchObject({ renamed: false });
		expect(files.get(file.path)?.frontmatter).toHaveProperty("name", "Jan Jansen");
		expect(files.get(file.path)?.frontmatter).not.toHaveProperty("name:unsafe");
	});

	it("keeps relationship edits on the validated settings snapshot inside the host callback", async () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const { beforeProcessFrontMatterCallback, files, service } = createHarness({ settings });
		const file = { path: "People/Relationships/Alice - Bob.md" } as TFile;
		files.set(file.path, {
			path: file.path,
			frontmatter: {
				type: "relationship",
				relationship_id: "relationship-existing",
				from: "[[People/Alice]]",
				to: "[[People/Bob]]",
				status: "active",
			},
		});
		beforeProcessFrontMatterCallback.current = () => {
			settings.statusProperty = "status:unsafe";
		};

		await expect(service.updateRelationship(file, { status: "dormant" })).resolves.toBeUndefined();
		expect(files.get(file.path)?.frontmatter).toHaveProperty("status", "dormant");
		expect(files.get(file.path)?.frontmatter).not.toHaveProperty("status:unsafe");
	});

	it("rejects person create without an explicit UUID-backed person ID before writing", async () => {
		const { files, service } = createHarness();
		const missingIdentity = { name: "No Identity" } as Parameters<typeof service.createPerson>[0];

		await expect(service.createPerson(missingIdentity)).rejects.toThrow("explicit UUID-backed person_id is required");
		expect(files.size).toBe(0);
	});

	it("rejects a non-empty create photo at the central boundary before any write", async () => {
		const { files, service } = createHarness();

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Alice/Alice.md",
				photo: "[[Portraits/Alice.jpg]]",
			}),
		).rejects.toThrow("Person create cannot include a photo");
		expect(files.size).toBe(0);
	});

	it.each(["", "   "])("never serializes an empty create photo %# into the first profile write", async (photo) => {
		const { files, service } = createHarness();

		const file = await service.createPerson({
			name: "Alice",
			personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
			reviewedPath: "People/Profiles/Alice/Alice.md",
			photo,
		});

		expect(files.get(file.path)?.content).not.toContain("\nphoto:");
	});

	it("rejects a stale reviewed create path after the People root changes before writing", async () => {
		const settings = { ...DEFAULT_SETTINGS, peopleRootFolder: "Changed Root" };
		const { files, service } = createHarness({ settings });

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "Reviewed Root/Profiles/Alice/Alice.md",
			}),
		).rejects.toThrow("reviewed person path changed");
		expect(files.size).toBe(0);
	});

	it.each([
		["a leading slash", "/People/Profiles/Alice/Alice.md", "Alice"],
		["backslashes", "People\\Profiles\\Alice\\Alice.md", "Alice"],
		["a duplicate separator", "People//Profiles/Alice/Alice.md", "Alice"],
		["a missing value", undefined, "Alice"],
		["a stale name", "People/Profiles/Alice/Alice.md", "Bob"],
	] as const)("rejects %s in the raw reviewed create path before writing", async (_label, reviewedPath, name) => {
		const { files, service } = createHarness();
		const input: Parameters<typeof service.createPerson>[0] = {
			name,
			personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
		};
		if (reviewedPath !== undefined) input.reviewedPath = reviewedPath;

		await expect(service.createPerson(input)).rejects.toThrow();
		expect(files.size).toBe(0);
	});

	it.each([
		["U+001F", "\u001f"],
		["U+007F", "\u007f"],
		["opening bracket", "["],
		["closing bracket", "]"],
		["hash", "#"],
		["caret", "^"],
	] as const)("rejects a raw %s profile endpath before every write", async (_label, character) => {
		const { files, service } = createHarness();
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const name = `Alice${character}Admin`;
		const profilePath = `People/Profiles/Alice-Admin/${name}.md`;
		const outcome = await service.createPerson({ name, personId, reviewedPath: profilePath }).then(
			(file) => ({ status: "fulfilled", path: file.path }),
			(error: unknown) => ({ status: "rejected", message: error instanceof Error ? error.message : String(error) }),
		);

		expect({ outcome, profileWritten: files.has(profilePath) }).toEqual({
			outcome: { status: "rejected", message: expect.any(String) },
			profileWritten: false,
		});
		expect(files.size).toBe(0);
	});

	it("writes a safely generated profile path while preserving the display name byte-exactly", async () => {
		const { files, service } = createHarness();
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const name = "Alice\u001fAdmin";
		const reviewedPath = personProfilePath("People", name, personId);
		expect(reviewedPath).toBe("People/Profiles/Alice-Admin/Alice-Admin.md");

		const file = await service.createPerson({ name, personId, reviewedPath });
		const serializedName = files.get(file.path)?.content?.match(/^name: (.+)$/m)?.[1];
		expect(file.path).toBe(reviewedPath);
		expect(JSON.parse(serializedName ?? "")).toBe(name);
	});

	it("rejects an existing dossier collision before creating any parent or profile note", async () => {
		const { files, service } = createHarness();
		const dossierPath = "People/Profiles/Alice";
		files.set(dossierPath, { path: dossierPath, children: [] });
		const before = structuredClone([...files.entries()]);

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Alice/Alice.md",
			}),
		).rejects.toThrow("without exactly one other canonical person owner");
		expect([...files.entries()]).toEqual(before);
	});

	it("rejects a foreign dossier created while an ancestor folder is being created", async () => {
		const { beforeCreateFolderResolve, files, service } = createHarness();
		const dossierPath = "People/Profiles/Alice";
		const profilePath = `${dossierPath}/Alice.md`;
		const freeNotePath = `${dossierPath}/Interview notes.md`;
		const freeNote = { path: freeNotePath, content: "Foreign user content" };
		const foreignDossier = { path: dossierPath, children: [freeNote] };
		beforeCreateFolderResolve.current = async (path) => {
			if (path !== "People") return;
			files.set(dossierPath, foreignDossier);
			files.set(freeNotePath, freeNote);
		};

		const outcome = await service
			.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: profilePath,
			})
			.then(
				(file) => ({ status: "fulfilled", path: file.path }),
				(error: unknown) => ({ status: "rejected", message: error instanceof Error ? error.message : String(error) }),
			);

		expect({ outcome, profileWritten: files.has(profilePath) }).toEqual({
			outcome: { status: "rejected", message: expect.stringContaining("not created by this transaction") },
			profileWritten: false,
		});
		expect(files.get(dossierPath)).toBe(foreignDossier);
		expect(files.get(freeNotePath)).toBe(freeNote);
	});

	it("rejects an externally indexed person ID that appears during ancestor folder creation", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const peoplePathsById = new Map<string, string[]>();
		const { beforeCreateFolderResolve, files, service, trashedPaths } = createHarness({ peoplePathsById });
		const dossierPath = "People/Profiles/Alice";
		const profilePath = `${dossierPath}/Alice.md`;
		const foreignPath = "Elsewhere/Foreign Alice.md";
		const foreignPerson = {
			path: foreignPath,
			content: "Foreign canonical person",
			frontmatter: { type: "person", person_id: personId, name: "Foreign Alice" },
		};
		beforeCreateFolderResolve.current = async (path) => {
			if (path !== "People") return;
			files.set(foreignPath, foreignPerson);
			peoplePathsById.set(personId, [foreignPath]);
		};

		const outcome = await service.createPerson({ name: "Alice", personId, reviewedPath: profilePath }).then(
			(file) => ({ status: "fulfilled", path: file.path }),
			(error: unknown) => ({ status: "rejected", message: error instanceof Error ? error.message : String(error) }),
		);

		expect({ outcome, profileWritten: files.has(profilePath) }).toEqual({
			outcome: { status: "rejected", message: expect.stringContaining(`person_id “${personId}” is already in use`) },
			profileWritten: false,
		});
		expect(files.get(foreignPath)).toBe(foreignPerson);
		expect(peoplePathsById.get(personId)).toEqual([foreignPath]);
		expect(trashedPaths).toEqual([dossierPath]);
		expect(files.has(dossierPath)).toBe(false);
		expect([...files.keys()].sort()).toEqual([foreignPath, "People", "People/Profiles"].sort());
	});

	it("rejects a canonical owner injected after its transaction-owned dossier folder is created without deleting external content", async () => {
		const dossierPath = "People/Profiles/Alice";
		const profilePath = `${dossierPath}/Alice.md`;
		const externalPath = `${dossierPath}/Existing.md`;
		const externalOwner = personRecord("person-c0ffee00-1111-4222-8333-444455556666", externalPath, "Alice");
		let currentPeople: PersonRecord[] = [];
		const { beforeCreateFolderResolve, files, noteCreateCalls, service, trashedPaths } = createHarness({
			currentPeople: () => currentPeople,
		});
		beforeCreateFolderResolve.current = (path) => {
			if (path !== dossierPath) return;
			const dossier = files.get(dossierPath);
			if (!dossier?.children) throw new Error("Expected the transaction-owned dossier folder.");
			const externalFile = { path: externalPath, frontmatter: { type: "person", person_id: externalOwner.id } };
			dossier.children.push(externalFile);
			files.set(externalPath, externalFile);
			currentPeople = [externalOwner];
		};

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: profilePath,
			}),
		).rejects.toThrow("reviewed person path changed");

		expect(noteCreateCalls).toEqual([]);
		expect(trashedPaths).toEqual([]);
		expect(files.get(dossierPath)?.children).toEqual([
			{ path: externalPath, frontmatter: { type: "person", person_id: externalOwner.id } },
		]);
		expect(files.get(externalPath)).toEqual({
			path: externalPath,
			frontmatter: { type: "person", person_id: externalOwner.id },
		});
	});

	it("rejects a malformed current peer injected after its transaction-owned dossier folder is created before profile write", async () => {
		const dossierPath = "People/Profiles/Alice";
		const profilePath = `${dossierPath}/Alice.md`;
		const malformedPeer = personRecord("person-c0ffee00-1111-4222-8333-444455556666", dossierPath, "Alice");
		let currentPeople: PersonRecord[] = [];
		let transactionDossier: { path: string; children?: unknown[] } | undefined;
		const { beforeCreateFolderResolve, files, noteCreateCalls, service, trashedPaths } = createHarness({
			currentPeople: () => currentPeople,
		});
		beforeCreateFolderResolve.current = (path) => {
			if (path !== dossierPath) return;
			transactionDossier = files.get(dossierPath);
			if (!transactionDossier || !Array.isArray(transactionDossier.children)) {
				throw new Error("Expected the empty transaction-owned dossier folder.");
			}
			currentPeople = [malformedPeer];
		};

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: profilePath,
			}),
		).rejects.toThrow("reviewed person path changed");

		expect(noteCreateCalls).toEqual([]);
		expect(transactionDossier?.children).toEqual([]);
		expect(trashedPaths).toEqual([dossierPath]);
		expect(files.has(dossierPath)).toBe(false);
		expect([...files.keys()].sort()).toEqual(["People", "People/Profiles"]);
	});

	it("rejects a raw exact suffixed candidate peer after its transaction-owned dossier folder is created without writing a profile", async () => {
		const ownerId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const ownerPath = "People/Profiles/Alice/Alice.md";
		const owner = personRecord(ownerId, ownerPath, "Alice");
		const dossierPath = "People/Profiles/Alice · FP";
		const profilePath = `${dossierPath}/Alice.md`;
		const rawPeer = personRecord(
			"person-c0ffee00-1111-4222-8333-444455556666",
			"People\\Profiles\\Alice · FP",
			"Alice",
		);
		let currentPeople = [owner];
		let transactionDossier: { path: string; children?: unknown[] } | undefined;
		const { beforeCreateFolderResolve, files, noteCreateCalls, service, trashedPaths } = createHarness({
			currentPeople: () => currentPeople,
		});
		files.set("People/Profiles/Alice", { path: "People/Profiles/Alice", children: [] });
		files.set(ownerPath, { path: ownerPath, frontmatter: { type: "person", person_id: ownerId, name: "Alice" } });
		beforeCreateFolderResolve.current = (path) => {
			if (path !== dossierPath) return;
			transactionDossier = files.get(dossierPath);
			if (!transactionDossier || !Array.isArray(transactionDossier.children)) {
				throw new Error("Expected the empty transaction-owned suffixed dossier folder.");
			}
			currentPeople = [owner, rawPeer];
		};

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-7d9f4a12-6b3c-4d5e-8f90-123456789abc",
				reviewedPath: profilePath,
			}),
		).rejects.toThrow("reviewed person path changed");

		expect(noteCreateCalls).toEqual([]);
		expect(transactionDossier?.children).toEqual([]);
		expect(trashedPaths).toEqual([dossierPath]);
		expect(files.has(dossierPath)).toBe(false);
	});

	it("removes only the transaction-created empty dossier when profile-note creation fails", async () => {
		const { createFailure, trashedPaths, files, service } = createHarness();
		const writeFailure = new Error("profile write failed");
		const dossierPath = "People/Profiles/Alice";
		createFailure.current = writeFailure;

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Alice/Alice.md",
			}),
		).rejects.toBe(writeFailure);

		expect(trashedPaths).toEqual([dossierPath]);
		expect(files.has(dossierPath)).toBe(false);
		expect([...files.keys()].sort()).toEqual(["People", "People/Profiles"]);
	});

	it("retains a transaction-created dossier that gained user content before profile-note failure", async () => {
		const { beforeCreateFailure, createFailure, trashedPaths, files, service } = createHarness();
		const writeFailure = new Error("profile write failed");
		const dossierPath = "People/Profiles/Alice";
		const freeNotePath = `${dossierPath}/Interview notes.md`;
		createFailure.current = writeFailure;
		beforeCreateFailure.current = () => {
			const dossier = files.get(dossierPath);
			const freeNote = { path: freeNotePath, content: "User content" };
			files.set(freeNotePath, freeNote);
			dossier?.children?.push(freeNote);
		};

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Alice/Alice.md",
			}),
		).rejects.toBe(writeFailure);

		expect(trashedPaths).toEqual([]);
		expect(files.get(dossierPath)?.children).toHaveLength(1);
		expect(files.get(freeNotePath)?.content).toBe("User content");
	});

	it("preserves the profile-write error when empty-dossier cleanup also fails", async () => {
		const { createFailure, trashFailure, trashedPaths, files, service } = createHarness();
		const writeFailure = new Error("profile write failed");
		const dossierPath = "People/Profiles/Alice";
		createFailure.current = writeFailure;
		trashFailure.current = new Error("cleanup failed");

		await expect(
			service.createPerson({
				name: "Alice",
				personId: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				reviewedPath: "People/Profiles/Alice/Alice.md",
			}),
		).rejects.toBe(writeFailure);

		expect(trashedPaths).toEqual([]);
		expect(files.get(dossierPath)?.children).toEqual([]);
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

	it.each([
		{
			label: "a canonical supported asset outside the dossier",
			photo: "[[Archive/Portrait.jpg]]",
			assetPath: "Archive/Portrait.jpg",
		},
		{
			label: "a canonical supported asset in a sibling dossier",
			photo: "[[People/Profiles/Bob/Portrait.jpg]]",
			assetPath: "People/Profiles/Bob/Portrait.jpg",
		},
		{
			label: "a canonical supported asset in a prefix-lookalike folder",
			photo: "[[People/Profiles/Alice-archive/Portrait.jpg]]",
			assetPath: "People/Profiles/Alice-archive/Portrait.jpg",
		},
		{
			label: "a missing local asset",
			photo: "[[People/Profiles/Alice/Missing.jpg]]",
		},
		{
			label: "an unsupported local file",
			photo: "[[People/Profiles/Alice/Portrait.svg]]",
			assetPath: "People/Profiles/Alice/Portrait.svg",
		},
		{
			label: "a raw noncanonical local path",
			photo: "People/Profiles/Alice/Portrait.jpg",
			assetPath: "People/Profiles/Alice/Portrait.jpg",
		},
		{
			label: "an aliased local embed",
			photo: "[[People/Profiles/Alice/Portrait.jpg|Portrait]]",
			assetPath: "People/Profiles/Alice/Portrait.jpg",
		},
		{
			label: "an embedded local wikilink",
			photo: "![[People/Profiles/Alice/Portrait.jpg]]",
			assetPath: "People/Profiles/Alice/Portrait.jpg",
		},
	] as const)("rejects $label before any write at the central photo boundary", async ({ photo, assetPath }) => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const personPath = "People/Profiles/Alice/Alice.md";
		const { files, hostCommitCount, processFrontMatterCallCount, renameCalls, service } = createHarness({
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const personFile = { path: personPath } as TFile;
		files.set(personPath, {
			path: personPath,
			frontmatter: {
				type: "person",
				person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				name: "Alice",
				custom: "keep",
			},
		});
		const asset = assetPath ? vaultFile(assetPath) : undefined;
		if (asset) files.set(asset.path, asset);
		const personBefore = structuredClone(files.get(personPath));
		const assetBefore = asset ? structuredClone(asset) : undefined;

		await expect(
			service.updatePerson(
				personFile,
				{ name: "Alice Admin", photo },
				{ targetPath: "People/Profiles/Alice/Alice Admin.md" },
			),
		).rejects.toThrow("photo");

		expect(processFrontMatterCallCount.current).toBe(0);
		expect(hostCommitCount.current).toBe(0);
		expect(renameCalls).toEqual([]);
		expect(personFile.path).toBe(personPath);
		expect(files.get(personPath)).toEqual(personBefore);
		if (asset && assetPath) {
			expect(files.get(assetPath)).toBe(asset);
			expect(asset).toEqual(assetBefore);
		}
	});

	it("rejects a local photo without one exact current canonical index owner before any host write", async () => {
		const { files, hostCommitCount, processFrontMatterCallCount, service } = createHarness();
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const personPath = "People/Profiles/Alice/Alice.md";
		const personFile = { path: personPath } as TFile;
		const asset = vaultFile("People/Profiles/Alice/Portrait.jpg");
		files.set(personPath, {
			path: personPath,
			frontmatter: { type: "person", person_id: personId, name: "Alice", custom: "keep" },
		});
		files.set(asset.path, asset);
		const before = structuredClone(files.get(personPath));

		await expect(service.updatePerson(personFile, { photo: `[[${asset.path}]]` })).rejects.toThrow(
			"current canonical dossier",
		);

		expect(processFrontMatterCallCount.current).toBe(0);
		expect(hostCommitCount.current).toBe(0);
		expect(files.get(personPath)).toEqual(before);
	});

	it("rejects a dossier-local photo when an unsafe second current PersonRecord shares the dossier before any host write", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const personPath = "People/Profiles/Alice/Alice.md";
		const person = personRecord(personId, personPath, "Alice");
		const unsafePeer = personRecord(
			"person-c0ffee00-1111-4222-8333-444455556666",
			"People/Profiles/Alice/Bob\u009f.md",
			"Bob",
		);
		const { files, hostCommitCount, processFrontMatterCallCount, renameCalls, service } = createHarness({
			people: [person, unsafePeer],
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const personFile = vaultFile(personPath);
		const asset = vaultFile("People/Profiles/Alice/Portrait.jpg");
		const originalFrontmatter = { type: "person", person_id: personId, name: "Alice", custom: "keep" };
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(asset.path, asset);

		await expect(service.updatePerson(personFile, { photo: `[[${asset.path}]]` })).rejects.toThrow(
			"current canonical dossier",
		);

		expect({
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personFrontmatter: files.get(personPath)?.frontmatter,
		}).toEqual({
			processFrontMatterCalls: 0,
			hostCommits: 0,
			renameCalls: [],
			personFrontmatter: originalFrontmatter,
		});
	});

	it("rejects a legacy dossier-local photo with zero frontmatter commits or mutation writes", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const dossierPath = "People/Profiles/alice--11112222";
		const personPath = `${dossierPath}/Alice.md`;
		const person = personRecord(personId, personPath, "Alice");
		const { files, hostCommitCount, processFrontMatterCallCount, renameCalls, service } = createHarness({
			people: [person],
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const personFile = vaultFile(personPath);
		const asset = vaultFile(`${dossierPath}/Portrait.jpg`);
		const originalFrontmatter = { type: "person", person_id: personId, name: "Alice", custom: "keep" };
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(asset.path, asset);

		await expect(service.updatePerson(personFile, { photo: `[[${asset.path}]]` })).rejects.toThrow(
			"current canonical dossier",
		);

		expect({
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personFrontmatter: files.get(personPath)?.frontmatter,
		}).toEqual({
			processFrontMatterCalls: 0,
			hostCommits: 0,
			renameCalls: [],
			personFrontmatter: originalFrontmatter,
		});
	});

	it("rejects a local photo when a second direct dossier owner appears inside the mutation callback", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const personPath = "People/Profiles/Alice/Alice.md";
		const otherOwner = personRecord(
			"person-c0ffee00-1111-4222-8333-444455556666",
			"People/Profiles/Alice/Bob.md",
			"Bob",
		);
		const person = personRecord(personId, personPath, "Alice");
		let currentPeople = [person];
		const {
			beforeProcessFrontMatterCallback,
			files,
			hostCommitCount,
			processFrontMatterCallCount,
			renameCalls,
			service,
		} = createHarness({
			currentPeople: () => currentPeople,
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const personFile = vaultFile(personPath);
		const asset = vaultFile("People/Profiles/Alice/Portrait.jpg");
		const originalFrontmatter = { type: "person", person_id: personId, name: "Alice", custom: "keep" };
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(otherOwner.filePath, {
			path: otherOwner.filePath,
			frontmatter: { type: "person", person_id: otherOwner.id },
		});
		files.set(asset.path, asset);
		let callbackEntries = 0;
		beforeProcessFrontMatterCallback.current = () => {
			callbackEntries += 1;
			currentPeople = [person, otherOwner];
		};

		await expect(service.updatePerson(personFile, { photo: `[[${asset.path}]]` })).rejects.toThrow(
			"current canonical dossier",
		);

		expect({
			callbackEntries,
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personFrontmatter: files.get(personPath)?.frontmatter,
		}).toEqual({
			callbackEntries: 1,
			processFrontMatterCalls: 1,
			hostCommits: 0,
			renameCalls: [],
			personFrontmatter: originalFrontmatter,
		});
	});

	it("rejects a local photo when a malformed current peer appears on the exact dossier path inside the mutation callback", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const dossierPath = "People/Profiles/Alice";
		const personPath = `${dossierPath}/Alice.md`;
		const person = personRecord(personId, personPath, "Alice");
		const malformedPeer = personRecord("person-c0ffee00-1111-4222-8333-444455556666", dossierPath, "Alice");
		let currentPeople = [person];
		const {
			beforeProcessFrontMatterCallback,
			files,
			hostCommitCount,
			processFrontMatterCallCount,
			renameCalls,
			service,
		} = createHarness({
			currentPeople: () => currentPeople,
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const personFile = vaultFile(personPath);
		const asset = vaultFile(`${dossierPath}/Portrait.jpg`);
		const originalFrontmatter = { type: "person", person_id: personId, name: "Alice", custom: "keep" };
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(asset.path, asset);
		let callbackEntries = 0;
		beforeProcessFrontMatterCallback.current = () => {
			callbackEntries += 1;
			currentPeople = [person, malformedPeer];
		};

		await expect(service.updatePerson(personFile, { photo: `[[${asset.path}]]` })).rejects.toThrow(
			"current canonical dossier",
		);

		expect({
			callbackEntries,
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personFrontmatter: files.get(personPath)?.frontmatter,
		}).toEqual({
			callbackEntries: 1,
			processFrontMatterCalls: 1,
			hostCommits: 0,
			renameCalls: [],
			personFrontmatter: originalFrontmatter,
		});
	});

	it("rejects a local photo when a trailing-dot Windows alias peer appears inside the mutation callback", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const dossierPath = "People/Profiles/Alice";
		const personPath = `${dossierPath}/Alice.md`;
		const person = personRecord(personId, personPath, "Alice");
		const trailingAliasPeer = personRecord(
			"person-c0ffee00-1111-4222-8333-444455556666",
			"People/Profiles/Alice./Peer.md",
			"Alice",
		);
		let currentPeople = [person];
		const {
			beforeProcessFrontMatterCallback,
			files,
			hostCommitCount,
			processFrontMatterCallCount,
			renameCalls,
			service,
		} = createHarness({
			currentPeople: () => currentPeople,
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const personFile = vaultFile(personPath);
		const asset = vaultFile(`${dossierPath}/Portrait.jpg`);
		const originalFrontmatter = { type: "person", person_id: personId, name: "Alice", custom: "keep" };
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(asset.path, asset);
		let callbackEntries = 0;
		beforeProcessFrontMatterCallback.current = () => {
			callbackEntries += 1;
			currentPeople = [person, trailingAliasPeer];
		};

		await expect(service.updatePerson(personFile, { photo: `[[${asset.path}]]` })).rejects.toThrow(
			"current canonical dossier",
		);

		expect({
			callbackEntries,
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personFrontmatter: files.get(personPath)?.frontmatter,
		}).toEqual({
			callbackEntries: 1,
			processFrontMatterCalls: 1,
			hostCommits: 0,
			renameCalls: [],
			personFrontmatter: originalFrontmatter,
		});
	});

	it("accepts one exact local descendant at the central photo boundary without mutating the asset", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const personPath = "People/Profiles/Alice/Alice.md";
		const { files, processFrontMatterCallCount, renameCalls, service } = createHarness({
			people: [personRecord(personId, personPath, "Alice")],
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const personFile = { path: personPath } as TFile;
		const asset = vaultFile("People/Profiles/Alice/Events/Portrait.jpg");
		files.set(personPath, {
			path: personPath,
			frontmatter: {
				type: "person",
				person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				name: "Alice",
				custom: "keep",
			},
		});
		files.set(asset.path, asset);
		const assetBefore = structuredClone(asset);

		await expect(service.updatePerson(personFile, { photo: `[[${asset.path}]]` })).resolves.toEqual({
			file: personFile,
			renamed: false,
		});

		expect(processFrontMatterCallCount.current).toBe(1);
		expect(renameCalls).toEqual([]);
		expect(files.get(personPath)?.frontmatter).toMatchObject({ photo: `[[${asset.path}]]`, custom: "keep" });
		expect(files.get(asset.path)).toBe(asset);
		expect(asset).toEqual(assetBefore);
	});

	it.each(
		UNSAFE_PEOPLE_ROOT_CASES,
	)("rejects the directly injected $label People root before any explicit photo write, host commit or rename", async ({
		root,
	}) => {
		const settings = { ...DEFAULT_SETTINGS, peopleRootFolder: root };
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const dossierPath = `${root}/Profiles/Alice`;
		const personPath = `${dossierPath}/Alice.md`;
		const { files, hostCommitCount, processFrontMatterCallCount, renameCalls, service } = createHarness({
			peoplePathsById: new Map([[personId, [personPath]]]),
			settings,
		});
		const personFile = vaultFile(personPath);
		const asset = vaultFile(`${dossierPath}/Portrait.jpg`);
		const originalFrontmatter = {
			type: "person",
			person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
			name: "Alice",
			photo: `[[${dossierPath}/Old.jpg]]`,
			custom: "keep",
		};
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(asset.path, asset);
		const personFileBefore = structuredClone(personFile);
		const assetBefore = structuredClone(asset);

		const outcome = await service.updatePerson(personFile, { photo: `[[${asset.path}]]` }).then(
			() => ({ status: "fulfilled" as const }),
			(error: unknown) => ({ status: "rejected" as const, error }),
		);

		expect({
			status: outcome.status,
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personFile,
			personFrontmatter: files.get(personPath)?.frontmatter,
			asset,
		}).toEqual({
			status: "rejected",
			processFrontMatterCalls: 0,
			hostCommits: 0,
			renameCalls: [],
			personFile: personFileBefore,
			personFrontmatter: originalFrontmatter,
			asset: assetBefore,
		});
		expect(outcome.status === "rejected" ? outcome.error : undefined).toBeInstanceOf(MutationError);
		expect(files.get(asset.path)).toBe(asset);
	});

	it("atomically rejects a local photo deleted inside processFrontMatter before apply, host commit or profile rename", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const personPath = "People/Profiles/Alice/Alice.md";
		const {
			beforeProcessFrontMatterCallback,
			files,
			hostCommitCount,
			processFrontMatterCallCount,
			renameCalls,
			service,
		} = createHarness({
			people: [personRecord(personId, personPath, "Alice")],
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const targetPath = "People/Profiles/Alice/Alice Admin.md";
		const personFile = { path: personPath } as TFile;
		const asset = vaultFile("People/Profiles/Alice/Events/Portrait.jpg");
		const originalPhoto = "  [[Archive/legacy.jpg|Portrait]]  ";
		const originalFrontmatter = {
			type: "person",
			person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
			name: "Alice",
			photo: originalPhoto,
			custom: "keep",
		};
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(asset.path, asset);
		let externalDeleteCalls = 0;
		beforeProcessFrontMatterCallback.current = () => {
			externalDeleteCalls += 1;
			files.delete(asset.path);
		};

		const outcome = await service
			.updatePerson(personFile, { name: "Alice Admin", photo: `[[${asset.path}]]` }, { targetPath })
			.then(
				() => ({ status: "fulfilled" as const }),
				(error: unknown) => ({ status: "rejected" as const, error }),
			);

		expect({
			status: outcome.status,
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personPath: personFile.path,
			personFrontmatter: files.get(personPath)?.frontmatter,
			renamedFrontmatter: files.get(targetPath)?.frontmatter,
		}).toEqual({
			status: "rejected",
			processFrontMatterCalls: 1,
			hostCommits: 0,
			renameCalls: [],
			personPath,
			personFrontmatter: originalFrontmatter,
			renamedFrontmatter: undefined,
		});
		expect(outcome.status === "rejected" ? outcome.error : undefined).toBeInstanceOf(MutationError);
		expect(outcome.status === "rejected" ? String(outcome.error) : "").toMatch(/photo.*(?:stale|missing|local)/i);
		expect(externalDeleteCalls).toBe(1);
		expect(files.has(asset.path)).toBe(false);
		expect(asset.path).toBe("People/Profiles/Alice/Events/Portrait.jpg");
	});

	it("atomically rejects a local photo whose live TFile path changes inside processFrontMatter before apply or rename", async () => {
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const personPath = "People/Profiles/Alice/Alice.md";
		const {
			beforeProcessFrontMatterCallback,
			files,
			hostCommitCount,
			processFrontMatterCallCount,
			renameCalls,
			service,
		} = createHarness({
			people: [personRecord(personId, personPath, "Alice")],
			peoplePathsById: new Map([[personId, [personPath]]]),
		});
		const targetPath = "People/Profiles/Alice/Alice Admin.md";
		const personFile = { path: personPath } as TFile;
		const photoPath = "People/Profiles/Alice/Events/Portrait.jpg";
		const renamedPhotoPath = "People/Profiles/Alice/Events/Renamed Portrait.jpg";
		const asset = vaultFile(photoPath);
		const originalPhoto = "  [[Archive/legacy.jpg|Portrait]]  ";
		const originalFrontmatter = {
			type: "person",
			person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
			name: "Alice",
			photo: originalPhoto,
			custom: "keep",
		};
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });
		files.set(photoPath, asset);
		let externalRenameCalls = 0;
		beforeProcessFrontMatterCallback.current = () => {
			externalRenameCalls += 1;
			files.delete(photoPath);
			asset.path = renamedPhotoPath;
			asset.name = "Renamed Portrait.jpg";
			asset.basename = "Renamed Portrait";
			files.set(renamedPhotoPath, asset);
		};

		const outcome = await service
			.updatePerson(personFile, { name: "Alice Admin", photo: `[[${photoPath}]]` }, { targetPath })
			.then(
				() => ({ status: "fulfilled" as const }),
				(error: unknown) => ({ status: "rejected" as const, error }),
			);

		expect({
			status: outcome.status,
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personPath: personFile.path,
			personFrontmatter: files.get(personPath)?.frontmatter,
			renamedFrontmatter: files.get(targetPath)?.frontmatter,
		}).toEqual({
			status: "rejected",
			processFrontMatterCalls: 1,
			hostCommits: 0,
			renameCalls: [],
			personPath,
			personFrontmatter: originalFrontmatter,
			renamedFrontmatter: undefined,
		});
		expect(outcome.status === "rejected" ? outcome.error : undefined).toBeInstanceOf(MutationError);
		expect(outcome.status === "rejected" ? String(outcome.error) : "").toMatch(/photo.*(?:stale|missing|local)/i);
		expect(externalRenameCalls).toBe(1);
		expect(files.has(photoPath)).toBe(false);
		expect(files.get(renamedPhotoPath)).toBe(asset);
		expect(asset.path).toBe(renamedPhotoPath);
	});

	it("allows explicit photo clear at the central boundary", async () => {
		const { files, processFrontMatterCallCount, service } = createHarness();
		const personPath = "People/Profiles/Alice/Alice.md";
		const personFile = { path: personPath } as TFile;
		files.set(personPath, {
			path: personPath,
			frontmatter: {
				type: "person",
				person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				name: "Alice",
				photo: "  [[Archive/legacy.jpg|Portrait]]  ",
				custom: "keep",
			},
		});

		await service.updatePerson(personFile, { photo: null });

		expect(processFrontMatterCallCount.current).toBe(1);
		expect(files.get(personPath)?.frontmatter).toEqual({
			type: "person",
			person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
			name: "Alice",
			custom: "keep",
		});
	});

	it("preserves an unrelated authored photo byte-exactly when photo is absent from the update", async () => {
		const { files, service } = createHarness();
		const personPath = "People/Profiles/Alice/Alice.md";
		const personFile = { path: personPath } as TFile;
		const authoredPhoto = "  [[Archive/legacy.jpg|Portrait]]  ";
		files.set(personPath, {
			path: personPath,
			frontmatter: {
				type: "person",
				person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				name: "Alice",
				photo: authoredPhoto,
				custom: "keep",
			},
		});

		await service.updatePerson(personFile, { pronouns: "she/they" });

		expect(files.get(personPath)?.frontmatter).toMatchObject({
			photo: authoredPhoto,
			pronouns: "she/they",
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

	it("renames only the profile note inside its dossier without moving identity, assets or free notes", async () => {
		const { files, service } = createHarness();
		const dossierPath = "People/Profiles/Alice";
		const file = { path: `${dossierPath}/Alice.md` } as TFile;
		const asset = { path: `${dossierPath}/portrait.jpg`, content: "binary fixture" };
		const freeNote = { path: `${dossierPath}/Interview notes.md`, content: "Keep this note" };
		const dossier = { path: dossierPath, children: [file, asset, freeNote] };
		files.set(dossierPath, dossier);
		files.set(file.path, {
			path: file.path,
			frontmatter: {
				type: "person",
				person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
				name: "Alice",
			},
		});
		files.set(asset.path, asset);
		files.set(freeNote.path, freeNote);

		const result = await service.updatePerson(
			file,
			{ name: "Alice Admin" },
			{ targetPath: `${dossierPath}/Alice Admin.md` },
		);

		expect(result).toEqual({ file, renamed: true });
		expect(files.get(dossierPath)).toBe(dossier);
		expect(dossier.children).toEqual([file, asset, freeNote]);
		expect(file.path).toBe(`${dossierPath}/Alice Admin.md`);
		expect(files.get(file.path)?.frontmatter).toMatchObject({
			person_id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
			name: "Alice Admin",
		});
		expect(files.get(asset.path)).toBe(asset);
		expect(files.get(freeNote.path)).toBe(freeNote);
		expect(files.has("People/Profiles/Alice-Admin")).toBe(false);
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

	it("rejects a portability-unsafe full profile filename before frontmatter or rename writes", async () => {
		const personPath = "People/Profiles/Alice/Alice.md";
		const targetPath = "People/Profiles/Alice/CON.md";
		const file = vaultFile(personPath);
		const originalFrontmatter = { type: "person", person_id: "person-alice", name: "Alice", custom: "keep" };
		const { files, hostCommitCount, processFrontMatterCallCount, renameCalls, service } = createHarness();
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });

		await expect(service.updatePerson(file, { name: "CON" }, { targetPath })).rejects.toThrow("portable");

		expect({
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personPath: file.path,
			personFrontmatter: files.get(personPath)?.frontmatter,
		}).toEqual({
			processFrontMatterCalls: 0,
			hostCommits: 0,
			renameCalls: [],
			personPath,
			personFrontmatter: originalFrontmatter,
		});
	});

	it("rejects a trailing-dot full profile filename before frontmatter or rename writes", async () => {
		const personPath = "People/Profiles/Alice/Alice.md";
		const targetPath = "People/Profiles/Alice/Alice..md";
		const file = vaultFile(personPath);
		const originalFrontmatter = { type: "person", person_id: "person-alice", name: "Alice", custom: "keep" };
		const { files, hostCommitCount, processFrontMatterCallCount, renameCalls, service } = createHarness();
		files.set(personPath, { path: personPath, frontmatter: structuredClone(originalFrontmatter) });

		await expect(service.updatePerson(file, { name: "Alice." }, { targetPath })).rejects.toThrow("portable");

		expect({
			processFrontMatterCalls: processFrontMatterCallCount.current,
			hostCommits: hostCommitCount.current,
			renameCalls,
			personPath: file.path,
			personFrontmatter: files.get(personPath)?.frontmatter,
		}).toEqual({
			processFrontMatterCalls: 0,
			hostCommits: 0,
			renameCalls: [],
			personPath,
			personFrontmatter: originalFrontmatter,
		});
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

	it("rejects relationship create outside the centrally derived collection before writing", async () => {
		const { files, service } = createHarness();
		const path = "Relationships/Alice - Bob.md";

		await expect(
			service.createRelationship({
				path,
				relationshipId: "relationship-central-boundary",
				from: "[[People/Alice]]",
				to: "[[People/Bob]]",
			}),
		).rejects.toThrow("configured central collection “People/Relationships”");

		expect(files.size).toBe(0);
	});

	it("rejects contact-moment create outside the centrally derived collection before writing", async () => {
		const personPath = "People/Profiles/Alice/Alice.md";
		const { files, service } = createHarness({
			peoplePathsById: new Map([["person-alice", [personPath]]]),
		});
		files.set(personPath, {
			path: personPath,
			frontmatter: { type: "person", person_id: "person-alice", name: "Alice" },
		});

		await expect(
			service.createContactMoment(
				{
					path: "Contact moments/2026-08-03 - Alice - 12345678.md",
					contactMomentId: "contact-12345678",
					people: [{ id: "person-alice", filePath: personPath }],
					occurredOn: "2026-08-03",
				},
				{ advanceRelationshipLastContact: false },
			),
		).rejects.toThrow("configured central collection “People/Contact moments”");

		expect([...files.keys()]).toEqual([personPath]);
	});

	it("writes relationships and contact moments only to collections derived from a custom People root", async () => {
		const settings = { ...DEFAULT_SETTINGS, peopleRootFolder: "Second Brain/People" };
		const personPath = "Second Brain/People/Profiles/Alice/Alice.md";
		const { files, service } = createHarness({
			peoplePathsById: new Map([["person-alice", [personPath]]]),
			settings,
		});
		files.set(personPath, {
			path: personPath,
			frontmatter: { type: "person", person_id: "person-alice", name: "Alice" },
		});

		const relationship = await service.createRelationship({
			path: "Second Brain/People/Relationships/Alice - Bob.md",
			relationshipId: "relationship-custom-root",
			from: `[[${personPath.replace(/\.md$/, "")}]]`,
			to: "[[Second Brain/People/Profiles/Bob/Bob]]",
		});
		const contactMoment = await service.createContactMoment(
			{
				path: "Second Brain/People/Contact moments/2026-08-03 - Alice - 12345678.md",
				contactMomentId: "contact-12345678",
				people: [{ id: "person-alice", filePath: personPath }],
				occurredOn: "2026-08-03",
			},
			{ advanceRelationshipLastContact: false },
		);

		expect(relationship.path).toBe("Second Brain/People/Relationships/Alice - Bob.md");
		expect(contactMoment.file.path).toBe("Second Brain/People/Contact moments/2026-08-03 - Alice - 12345678.md");
		if (contactMoment.status !== "success") throw new Error("Expected contact-moment create to fully succeed.");
		expect(contactMoment.relationship.status).toBe("not-requested");
		expect(files.has("People/Relationships")).toBe(false);
		expect(files.has("People/Contact moments")).toBe(false);
	});

	it("creates and updates copied preset metadata while preserving unrelated frontmatter", async () => {
		const { files, service } = createHarness();
		const created = await service.createRelationship({
			path: "People/Relationships/Mathijs-Cor.md",
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
		const sharedPersonId = "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
		const personResults = await Promise.allSettled([
			people.service.createPerson({
				name: "Alice",
				personId: sharedPersonId,
				reviewedPath: "People/Profiles/Alice/Alice.md",
			}),
			people.service.createPerson({
				name: "Bob",
				personId: sharedPersonId,
				reviewedPath: "People/Profiles/Bob/Bob.md",
			}),
		]);

		expect(personResults.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
		expect(
			[...people.files.values()].filter((entry) => entry.content?.includes(`person_id: "${sharedPersonId}"`)),
		).toHaveLength(1);

		const relationships = createHarness();
		const relationshipResults = await Promise.allSettled([
			relationships.service.createRelationship({
				path: "People/Relationships/Alice-Bob.md",
				relationshipId: "relationship-shared",
				from: "[[Alice]]",
				to: "[[Bob]]",
			}),
			relationships.service.createRelationship({
				path: "People/Relationships/Alice-Carol.md",
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
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const alice = await service.createPerson({
			name: "Alice",
			personId,
			reviewedPath: "People/Profiles/Alice/Alice.md",
		});
		const created = files.get(alice.path);
		if (!created) throw new Error("Created person fixture is missing.");
		created.frontmatter = {
			type: "person",
			person_id: personId,
			name: "Alice",
		};

		await service.updatePerson(alice, { name: "Alice Updated" });

		await expect(
			service.createPerson({
				name: "Bob",
				personId,
				reviewedPath: "People/Profiles/Bob/Bob.md",
			}),
		).rejects.toThrow(`person_id “${personId}” is already in use.`);
		expect([...files.values()].filter((entry) => entry.content?.includes(`person_id: "${personId}"`))).toHaveLength(1);
	});
});
