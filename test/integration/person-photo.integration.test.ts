import type { App, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASES_OPTION_KEYS } from "../../src/bases/options";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import PeopleAtlasPlugin from "../../src/main";
import type { AtlasRenderer } from "../../src/render/atlas-renderer";
import { type Component, ControlledObsidianRuntime } from "../obsidian-stub";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Controlled person-photo integration manifest",
	author: "People Atlas",
} as PluginManifest;

function fullSnapshot(view: unknown): AtlasSnapshot {
	const snapshot = (view as { fullSnapshot?: AtlasSnapshot }).fullSnapshot;
	if (!snapshot) throw new Error("The production view has not published a full snapshot.");
	return snapshot;
}

function viewRenderer(view: unknown): AtlasRenderer {
	const renderer = (view as { renderer?: AtlasRenderer }).renderer;
	if (!renderer) throw new Error("The production view has not created its AtlasRenderer.");
	return renderer;
}

function selectSemanticPerson(container: ParentNode, personId: string): void {
	const listMode = container.querySelector<HTMLButtonElement>(".people-atlas-list-mode");
	const person = container.querySelector<HTMLButtonElement>(`.people-atlas-person-button[data-node-id="${personId}"]`);
	if (!listMode || !person) throw new Error(`Unable to select ${personId} in the production semantic view.`);
	listMode.click();
	person.click();
}

function useStaticIntegrationResizeObserver(): void {
	class StaticResizeObserver {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
	vi.stubGlobal("ResizeObserver", StaticResizeObserver);
}

afterEach(() => {
	document.body.replaceChildren();
	vi.unstubAllGlobals();
});

describe("person photo view integration", () => {
	it("rejects an outside photo before frontmatter write and changes only photo for a local Edit-Save", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const personId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
		const profilePath = "People/Profiles/Alex Example/Alex Example.md";
		const profile = runtime.seedFile(profilePath, {
			type: "person",
			person_id: personId,
			name: "Alex Example",
			aliases: ["Alex"],
		});
		const localPhoto = runtime.seedFile("People/Profiles/Alex Example/Photos/Alex.jpg");
		const outsidePhoto = runtime.seedFile("Assets/Alex.jpg");
		const siblingPhoto = runtime.seedFile("People/Profiles/Alex Other/Photos/Alex.jpg");
		profile.stat.mtime = 11;
		profile.stat.size = 101;
		localPhoto.stat.mtime = 17;
		localPhoto.stat.size = 107;
		outsidePhoto.stat.mtime = 19;
		outsidePhoto.stat.size = 109;
		siblingPhoto.stat.mtime = 23;
		siblingPhoto.stat.size = 113;
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await vi.waitFor(() => expect(plugin.index.getPeoplePathsById(personId)).toEqual([profilePath]));
		const processFrontMatter = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
		const frontmatterBefore = structuredClone(runtime.metadataCache.getFileCache(profile)?.frontmatter ?? {});
		const assetFrontmatterBefore = [localPhoto, outsidePhoto, siblingPhoto].map((file) =>
			structuredClone(runtime.metadataCache.getFileCache(file)?.frontmatter ?? {}),
		);
		const filesBefore = runtime.vault.getFiles();
		const fileSnapshots = filesBefore.map((file) => ({
			file,
			path: file.path,
			mtime: file.stat.mtime,
			size: file.stat.size,
		}));

		try {
			await expect(
				plugin.mutations.updatePerson(
					profile as unknown as import("obsidian").TFile,
					{ photo: `[[${outsidePhoto.path}]]` },
					{ expectedPersonId: personId, expectedClassification: "type" },
				),
			).rejects.toThrow("A changed photo must be inside the person's current canonical dossier.");
			expect(processFrontMatter).not.toHaveBeenCalled();
			expect(runtime.metadataCache.getFileCache(profile)?.frontmatter).toEqual(frontmatterBefore);

			await expect(
				plugin.mutations.updatePerson(
					profile as unknown as import("obsidian").TFile,
					{ photo: `[[${localPhoto.path}]]` },
					{ expectedPersonId: personId, expectedClassification: "type" },
				),
			).resolves.toEqual({ file: profile, renamed: false });

			expect(processFrontMatter).toHaveBeenCalledOnce();
			expect(processFrontMatter).toHaveBeenCalledWith(profile, expect.any(Function));
			expect(runtime.metadataCache.getFileCache(profile)?.frontmatter).toEqual({
				...frontmatterBefore,
				photo: `[[${localPhoto.path}]]`,
			});
			for (const [index, file] of [localPhoto, outsidePhoto, siblingPhoto].entries()) {
				expect(runtime.metadataCache.getFileCache(file)?.frontmatter).toEqual(assetFrontmatterBefore[index]);
			}
			const filesAfter = runtime.vault.getFiles();
			expect(filesAfter).toHaveLength(filesBefore.length);
			for (const [index, snapshot] of fileSnapshots.entries()) {
				expect(filesAfter[index]).toBe(snapshot.file);
				expect(runtime.vault.getAbstractFileByPath(snapshot.path)).toBe(snapshot.file);
				expect(snapshot.file.path).toBe(snapshot.path);
				expect(snapshot.file.stat.mtime).toBe(snapshot.mtime);
				expect(snapshot.file.stat.size).toBe(snapshot.size);
			}
		} finally {
			processFrontMatter.mockRestore();
			await component.unload();
		}
	});

	it("refreshes the standalone selected sidebar through the real vault resource seam", async () => {
		useStaticIntegrationResizeObserver();
		const runtime = new ControlledObsidianRuntime(document);
		const photo = runtime.seedFile("Assets/alice.png");
		const originalPhotoPath = photo.path;
		runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "alice",
			name: "Alice Example",
			photo: "[[Assets/alice.png]]",
		});
		runtime.resolveLink("People/Alice.md", "Assets/alice.png", photo.path);
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		await (plugin as unknown as Component).load();
		runtime.triggerLayoutReady();

		try {
			const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
			const renderer = viewRenderer(standalone.view);
			await vi.waitFor(() => expect(renderer.getPhotoCacheStats().ready).toBe(1));
			selectSemanticPerson(standalone.leaf.contentEl, "alice");
			const sidebar = standalone.leaf.contentEl.querySelector<HTMLElement>(".people-atlas-selected-details");
			const firstPhoto = sidebar?.querySelector<HTMLElement>(".people-atlas-profile-photo");
			const firstImage = firstPhoto?.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
			if (!sidebar || !firstPhoto || !firstImage) throw new Error("Expected a selected standalone profile photo.");
			expect(firstImage.alt).toBe("");
			expect(firstImage.src).toMatch(/^data:image\/gif/);
			expect(firstImage.ownerDocument).toBe(document);
			expect(sidebar.textContent).not.toContain(photo.path);
			const firstResource = firstImage.getAttribute("src");

			runtime.modifyFile(originalPhotoPath);
			await vi.waitFor(() => {
				expect(sidebar.querySelector(".people-atlas-profile-photo")).not.toBe(firstPhoto);
			});
			await vi.waitFor(() => {
				expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 1, pending: 0, loadsSucceeded: 2 });
			});
			expect(
				sidebar.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image")?.getAttribute("src"),
			).not.toBe(firstResource);

			const renamedPhoto = runtime.renameFile(originalPhotoPath, "Assets/alice-renamed.png");
			await vi.waitFor(() => {
				expect(sidebar.querySelector<HTMLElement>(".people-atlas-profile-photo")?.dataset.photoStatus).toBe("missing");
				expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 0, pending: 0, total: 0 });
			});
			runtime.resolveLink("People/Alice.md", originalPhotoPath, renamedPhoto.path);
			await vi.waitFor(() => {
				expect(renderer.getPhotoCacheStats().ready).toBe(1);
				expect(sidebar.querySelector<HTMLElement>(".people-atlas-profile-photo")?.dataset.photoStatus).not.toBe(
					"missing",
				);
			});

			runtime.deleteFile(renamedPhoto.path);
			await vi.waitFor(() => {
				expect(sidebar.querySelector<HTMLElement>(".people-atlas-profile-photo")?.dataset.photoStatus).toBe("missing");
				expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 0, pending: 0, total: 0 });
			});
			expect(sidebar.querySelector(".people-atlas-profile-photo-image")).toBeNull();
			expect(sidebar.querySelector(".people-atlas-profile-photo-fallback")?.textContent).toBe("AE");
			expect(sidebar.querySelector(".people-atlas-profile-photo-explanation")?.textContent).toContain(
				"could not be found",
			);
		} finally {
			await (plugin as unknown as Component).unload();
		}
	});

	it("refreshes a custom Bases photo mapping without a canonical photo dependent", async () => {
		useStaticIntegrationResizeObserver();
		const runtime = new ControlledObsidianRuntime(document);
		const photo = runtime.seedFile("Assets/custom-avatar.webp");
		const person = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "alice",
			name: "Canonical Alice",
		});
		runtime.resolveLink("People/Alice.md", "Assets/custom-avatar.webp", photo.path);
		const entry = runtime.createBasesEntry(person, {
			"note.person_id": "alice",
			"note.name": "Mapped Alice",
			"note.organisations": [],
			"note.contacts": [],
			"note.avatar": "[[Assets/custom-avatar.webp]]",
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		await (plugin as unknown as Component).load();
		runtime.triggerLayoutReady();

		try {
			const bases = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [entry], "Custom photo");
			const renderer = viewRenderer(bases.view);
			bases.controller.config.set(BASES_OPTION_KEYS.photoProperty, "note.avatar");
			bases.view.onDataUpdated();
			await vi.waitFor(() => expect(renderer.getPhotoCacheStats().ready).toBe(1));
			selectSemanticPerson(bases.parent, "alice");
			const details = bases.parent.querySelector<HTMLElement>(".people-atlas-semantic-details");
			const firstPhoto = details?.querySelector<HTMLElement>(".people-atlas-profile-photo");
			if (!details || !firstPhoto) throw new Error("Expected a selected Bases profile photo.");
			expect(fullSnapshot(bases.view).nodes.find((node) => node.id === "alice")?.photoPath).toBe(photo.path);
			expect(firstPhoto.querySelector("img")?.alt).toBe("");
			expect(firstPhoto.querySelector("img")?.ownerDocument).toBe(document);
			const firstResource = firstPhoto.querySelector("img")?.getAttribute("src");

			runtime.modifyFile(photo.path);
			await vi.waitFor(() => {
				expect(details.querySelector(".people-atlas-profile-photo")).not.toBe(firstPhoto);
			});
			expect(details.querySelector(".people-atlas-profile-photo-image")?.getAttribute("src")).not.toBe(firstResource);
			await vi.waitFor(() => {
				expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 1, pending: 0, loadsSucceeded: 2 });
			});

			runtime.deleteFile(photo.path);
			await vi.waitFor(() => {
				expect(details.querySelector<HTMLElement>(".people-atlas-profile-photo")?.dataset.photoStatus).toBe("missing");
			});
			expect(fullSnapshot(bases.view).diagnostics.some((diagnostic) => diagnostic.code === "missing-asset")).toBe(true);
			expect(details.textContent).not.toContain(photo.path);
			expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 0, pending: 0, total: 0 });
		} finally {
			await (plugin as unknown as Component).unload();
		}
	});
});
