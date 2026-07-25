import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { AtlasMutationService, MutationError } from "../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

function createHarness() {
	const files = new Map<string, { path: string; content?: string; frontmatter?: Record<string, unknown> }>();
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path),
			createFolder: async (path: string) => { files.set(path, { path }); return files.get(path); },
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
		},
	} as unknown as App;
	const index = {
		getPeoplePathsById: () => [] as string[],
		getRelationshipPathsById: () => [] as string[],
	};
	const service = new AtlasMutationService(app, () => DEFAULT_SETTINGS, () => true, index, () => "person-fixed");
	return { app, files, service };
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

	it("does not create an invalid relationship", async () => {
		const { files, service } = createHarness();

		await expect(service.createRelationship({ path: "Relationships/Jan.md", from: "", to: "[[Sam]]" })).rejects.toBeInstanceOf(MutationError);
		expect(files.has("Relationships/Jan.md")).toBe(false);
	});
});
