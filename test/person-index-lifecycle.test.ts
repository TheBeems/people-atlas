import { describe, expect, it } from "vitest";
import type { App, CachedMetadata } from "obsidian";
import type { IndexDelta } from "../src/domain/types";
import { applyGraphDelta } from "../src/graph/graph-delta";
import { buildGraphSnapshot } from "../src/graph/graph-source";
import { PersonIndex } from "../src/index/person-index";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { TFile } from "obsidian";

class EventBus {
	private readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();

	on(name: string, callback: (...args: unknown[]) => void): { unload: () => void } {
		const callbacks = this.handlers.get(name) ?? [];
		callbacks.push(callback);
		this.handlers.set(name, callbacks);
		return {
			unload: () =>
				this.handlers.set(
					name,
					callbacks.filter((item) => item !== callback),
				),
		};
	}

	emit(name: string, ...args: unknown[]): void {
		for (const callback of this.handlers.get(name) ?? []) callback(...args);
	}
}

function markdown(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = path.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
	return file;
}

function asset(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.extension = path.split(".").at(-1) ?? "";
	file.basename =
		path
			.split("/")
			.at(-1)
			?.replace(/\.[^.]+$/, "") ?? "";
	return file;
}

function personCache(id: string, name: string): CachedMetadata {
	return { frontmatter: { type: "person", person_id: id, name } } as CachedMetadata;
}

function relationshipCache(id: string, from: string, to: string): CachedMetadata {
	return {
		frontmatter: {
			type: "relationship",
			relationship_id: id,
			from,
			to,
		},
	} as CachedMetadata;
}

function contactMomentCache(id: string, people: string[], relationship?: string): CachedMetadata {
	return {
		frontmatter: {
			type: "contact_moment",
			contact_moment_id: id,
			people,
			relationship,
			occurred_on: "2026-07-30",
			follow_up_on: "2026-08-01",
		},
	} as CachedMetadata;
}

describe("PersonIndex lifecycle", () => {
	it("updates create, change, rename and delete without rescanning the vault", () => {
		const vault = new EventBus();
		const metadataCache = new EventBus();
		const alice = markdown("People/Alice.md");
		const bob = markdown("People/Bob.md");
		const files = new Map<string, TFile>([[alice.path, alice]]);
		const caches = new Map<string, CachedMetadata>([[alice.path, personCache("alice", "Alice")]]);
		let scanCount = 0;
		const app = {
			vault: {
				getMarkdownFiles: () => {
					scanCount += 1;
					return [...files.values()];
				},
				getAbstractFileByPath: (path: string) => files.get(path),
				on: vault.on.bind(vault),
			},
			metadataCache: {
				getFileCache: (file: TFile) => caches.get(file.path) ?? null,
				getFirstLinkpathDest: () => null,
				on: metadataCache.on.bind(metadataCache),
			},
		} as unknown as App;
		const index = new PersonIndex(app, () => DEFAULT_SETTINGS);
		const deltas: Array<{ revision: number; removedPaths: string[] }> = [];
		index.subscribeDelta((delta) => deltas.push({ revision: delta.revision, removedPaths: delta.removedPaths }));
		index.onload();

		caches.set(alice.path, personCache("alice-2", "Alice Updated"));
		metadataCache.emit("changed", alice, "", caches.get(alice.path));
		files.set(bob.path, bob);
		caches.set(bob.path, personCache("bob", "Bob"));
		vault.emit("create", bob);
		const renamedAlice = markdown("People/Alicia.md");
		files.delete(alice.path);
		files.set(renamedAlice.path, renamedAlice);
		caches.delete(alice.path);
		caches.set(renamedAlice.path, personCache("alice-2", "Alice Updated"));
		vault.emit("rename", renamedAlice, alice.path);
		files.delete(bob.path);
		vault.emit("delete", bob);

		expect(scanCount).toBe(1);
		expect(index.getPeoplePathsById("alice-2")).toEqual(["People/Alicia.md"]);
		expect(index.getPeoplePathsById("bob")).toEqual([]);
		expect(deltas.length).toBeGreaterThan(1);
		expect(deltas.some((delta) => delta.removedPaths.includes("People/Alice.md"))).toBe(true);
	});

	it("reindexes a person when its referenced photo asset is modified", () => {
		const vault = new EventBus();
		const metadataCache = new EventBus();
		const alice = markdown("People/Alice.md");
		const photo = asset("Assets/alice.png");
		const files = new Map<string, TFile>([
			[alice.path, alice],
			[photo.path, photo],
		]);
		const caches = new Map<string, CachedMetadata>([
			[
				alice.path,
				{
					frontmatter: {
						type: "person",
						person_id: "alice",
						name: "Alice",
						photo: "[[Assets/alice.png]]",
					},
				} as CachedMetadata,
			],
		]);
		const app = {
			vault: {
				getMarkdownFiles: () => [alice],
				getAbstractFileByPath: (path: string) => files.get(path),
				on: vault.on.bind(vault),
			},
			metadataCache: {
				getFileCache: (file: TFile) => caches.get(file.path) ?? null,
				getFirstLinkpathDest: (target: string) => (target === photo.path ? photo : null),
				resolvedLinks: {},
				on: metadataCache.on.bind(metadataCache),
			},
		} as unknown as App;
		const index = new PersonIndex(app, () => DEFAULT_SETTINGS);
		const deltas: Array<{ changedPaths: string[]; updatedPeople: string[] }> = [];
		index.subscribeDelta((delta) =>
			deltas.push({
				changedPaths: delta.changedPaths,
				updatedPeople: delta.updatedPeople.map((person) => person.filePath),
			}),
		);
		index.onload();
		deltas.length = 0;

		vault.emit("modify", photo);

		expect(deltas).toEqual([
			{
				changedPaths: ["People/Alice.md"],
				updatedPeople: ["People/Alice.md"],
			},
		]);
	});

	it("publishes image lifecycle paths even without a canonical dependent", () => {
		const vault = new EventBus();
		const metadataCache = new EventBus();
		const photo = asset("Assets/custom-avatar.png");
		const renamedPhoto = asset("Assets/renamed-avatar.png");
		const files = new Map<string, TFile>([[photo.path, photo]]);
		const app = {
			vault: {
				getMarkdownFiles: () => [],
				getAbstractFileByPath: (path: string) => files.get(path),
				on: vault.on.bind(vault),
			},
			metadataCache: {
				getFileCache: () => null,
				getFirstLinkpathDest: () => null,
				resolvedLinks: {},
				on: metadataCache.on.bind(metadataCache),
			},
		} as unknown as App;
		const index = new PersonIndex(app, () => DEFAULT_SETTINGS);
		const changedPaths: string[][] = [];
		index.subscribeDelta((delta) => changedPaths.push(delta.changedPaths));
		index.onload();
		changedPaths.length = 0;

		vault.emit("modify", photo);
		files.delete(photo.path);
		files.set(renamedPhoto.path, renamedPhoto);
		vault.emit("rename", renamedPhoto, photo.path);
		files.delete(renamedPhoto.path);
		vault.emit("delete", renamedPhoto);

		expect(changedPaths).toEqual([
			["Assets/custom-avatar.png"],
			["Assets/custom-avatar.png", "Assets/renamed-avatar.png"],
			["Assets/renamed-avatar.png"],
		]);
	});

	it("removes or adds canonical records when a rename crosses the Markdown boundary", () => {
		const vault = new EventBus();
		const metadataCache = new EventBus();
		const alice = markdown("People/Alice.md");
		const portrait = asset("Assets/Portrait.png");
		const files = new Map<string, TFile>([
			[alice.path, alice],
			[portrait.path, portrait],
		]);
		const caches = new Map<string, CachedMetadata>([[alice.path, personCache("alice", "Alice")]]);
		const app = {
			vault: {
				getMarkdownFiles: () => [alice],
				getAbstractFileByPath: (path: string) => files.get(path),
				on: vault.on.bind(vault),
			},
			metadataCache: {
				getFileCache: (file: TFile) => caches.get(file.path) ?? null,
				getFirstLinkpathDest: () => null,
				resolvedLinks: {},
				on: metadataCache.on.bind(metadataCache),
			},
		} as unknown as App;
		const index = new PersonIndex(app, () => DEFAULT_SETTINGS);
		index.onload();

		const formerPersonAsset = asset("People/Alice.png");
		files.delete(alice.path);
		caches.delete(alice.path);
		files.set(formerPersonAsset.path, formerPersonAsset);
		vault.emit("rename", formerPersonAsset, alice.path);
		expect(index.getPeoplePathsById("alice")).toEqual([]);

		const promotedPerson = markdown("People/Portrait.md");
		files.delete(portrait.path);
		files.set(promotedPerson.path, promotedPerson);
		caches.set(promotedPerson.path, personCache("portrait", "Portrait"));
		vault.emit("rename", promotedPerson, portrait.path);
		expect(index.getPeoplePathsById("portrait")).toEqual(["People/Portrait.md"]);
	});

	it("keeps duplicate identities ambiguous across an unrelated asset-only delta", () => {
		const vault = new EventBus();
		const metadataCache = new EventBus();
		const alice = markdown("People/Alice.md");
		const otherAlice = markdown("People/Other Alice.md");
		const photo = asset("Assets/custom.png");
		const files = new Map<string, TFile>([
			[alice.path, alice],
			[otherAlice.path, otherAlice],
			[photo.path, photo],
		]);
		const caches = new Map<string, CachedMetadata>([
			[alice.path, personCache("duplicate", "Alice")],
			[otherAlice.path, personCache("duplicate", "Other Alice")],
		]);
		const app = {
			vault: {
				getMarkdownFiles: () => [alice, otherAlice],
				getAbstractFileByPath: (path: string) => files.get(path),
				on: vault.on.bind(vault),
			},
			metadataCache: {
				getFileCache: (file: TFile) => caches.get(file.path) ?? null,
				getFirstLinkpathDest: () => null,
				resolvedLinks: {},
				on: metadataCache.on.bind(metadataCache),
			},
		} as unknown as App;
		const index = new PersonIndex(app, () => DEFAULT_SETTINGS);
		let assetDelta: IndexDelta | undefined;
		index.subscribeDelta((delta) => {
			if (delta.changedPaths.includes(photo.path)) assetDelta = delta;
		});
		index.onload();
		const raw = index.getSnapshot();
		const initial = buildGraphSnapshot({ visible: raw, canonical: raw }, () => undefined);

		vault.emit("modify", photo);

		if (!assetDelta) throw new Error("Expected an asset-only delta.");
		const updated = applyGraphDelta(initial, assetDelta, () => undefined, {
			resolutionPeople: index.getSnapshot().people,
		});
		expect(assetDelta.duplicatePersonIds).toEqual(["duplicate"]);
		expect(assetDelta.diagnostics.map((diagnostic) => diagnostic.code)).toContain("duplicate-person-id");
		expect(updated.nodes.map((node) => node.id).sort()).toEqual(initial.nodes.map((node) => node.id).sort());
		expect(updated.diagnostics.filter((diagnostic) => diagnostic.code === "duplicate-person-id")).toEqual(
			initial.diagnostics.filter((diagnostic) => diagnostic.code === "duplicate-person-id"),
		);
	});

	it("invalidates an extensionless contact-moment reference when its Markdown target appears", () => {
		const vault = new EventBus();
		const metadataCache = new EventBus();
		const moment = markdown("People/Contact moments/Missing Alice.md");
		const files = new Map<string, TFile>([[moment.path, moment]]);
		const caches = new Map<string, CachedMetadata>([
			[moment.path, contactMomentCache("moment-path", ["People/Alice"])],
		]);
		const app = {
			vault: {
				getMarkdownFiles: () => [...files.values()],
				getAbstractFileByPath: (path: string) => files.get(path),
				on: vault.on.bind(vault),
			},
			metadataCache: {
				getFileCache: (target: TFile) => caches.get(target.path) ?? null,
				getFirstLinkpathDest: () => null,
				resolvedLinks: {},
				on: metadataCache.on.bind(metadataCache),
			},
		} as unknown as App;
		const index = new PersonIndex(app, () => DEFAULT_SETTINGS);
		const deltas: IndexDelta[] = [];
		index.subscribeDelta((delta) => deltas.push(delta));
		index.onload();

		expect(index.getSnapshot().contactMoments).toEqual([
			expect.objectContaining({
				id: "moment-path",
				personIds: [],
				actionable: false,
			}),
		]);
		expect(deltas.at(-1)?.diagnostics).toEqual([
			expect.objectContaining({
				code: "unresolved-contact-moment-person",
				filePaths: [moment.path],
				targetPath: "People/Alice",
			}),
		]);

		deltas.length = 0;
		const alice = markdown("People/Alice.md");
		files.set(alice.path, alice);
		caches.set(alice.path, personCache("alice", "Alice"));
		vault.emit("create", alice);

		expect(deltas).toHaveLength(1);
		expect(deltas[0]?.changedPaths).toEqual(expect.arrayContaining([alice.path, moment.path]));
		expect(deltas[0]?.affectedContactMomentIds).toEqual(["moment-path"]);
		expect(deltas[0]?.affectedContactMoments).toEqual([
			expect.objectContaining({
				id: "moment-path",
				personIds: ["alice"],
				actionable: true,
			}),
		]);
		expect(deltas[0]?.diagnostics.some((diagnostic) => diagnostic.code === "unresolved-contact-moment-person")).toBe(
			false,
		);
	});

	it("publishes canonical contact-moment deltas across dependency changes, rename and delete", () => {
		const vault = new EventBus();
		const metadataCache = new EventBus();
		const alice = markdown("People/Alice.md");
		const bob = markdown("People/Bob.md");
		const relationship = markdown("Relationships/Alice-Bob.md");
		const moment = markdown("People/Contact moments/Alice-Bob.md");
		const files = new Map<string, TFile>([
			[alice.path, alice],
			[bob.path, bob],
			[relationship.path, relationship],
			[moment.path, moment],
		]);
		const caches = new Map<string, CachedMetadata>([
			[alice.path, personCache("alice", "Alice")],
			[bob.path, personCache("bob", "Bob")],
			[relationship.path, relationshipCache("rel-1", "alice", "bob")],
			[moment.path, contactMomentCache("moment-1", ["alice"], "rel-1")],
		]);
		const app = {
			vault: {
				getMarkdownFiles: () => [...files.values()],
				getAbstractFileByPath: (path: string) => files.get(path),
				on: vault.on.bind(vault),
			},
			metadataCache: {
				getFileCache: (target: TFile) => caches.get(target.path) ?? null,
				getFirstLinkpathDest: () => null,
				resolvedLinks: {},
				on: metadataCache.on.bind(metadataCache),
			},
		} as unknown as App;
		const index = new PersonIndex(app, () => DEFAULT_SETTINGS);
		const deltas: IndexDelta[] = [];
		index.subscribeDelta((delta) => deltas.push(delta));
		index.onload();

		expect(index.getSnapshot().contactMoments).toEqual([
			expect.objectContaining({
				id: "moment-1",
				personIds: ["alice"],
				relationshipId: "rel-1",
				actionable: true,
				followUpActionable: true,
			}),
		]);
		expect(deltas[0]).toMatchObject({
			addedContactMoments: [expect.objectContaining({ id: "moment-1" })],
			affectedContactMomentIds: ["moment-1"],
		});

		caches.set(alice.path, personCache("alice-new", "Alice"));
		metadataCache.emit("changed", alice);
		const personDelta = deltas.at(-1);
		expect(personDelta?.affectedContactMomentIds).toContain("moment-1");
		expect(personDelta?.affectedContactMoments).toEqual([
			expect.objectContaining({ id: "moment-1", actionable: false, followUpActionable: false }),
		]);
		expect(personDelta?.diagnostics.map((diagnostic) => diagnostic.code)).toContain("unresolved-contact-moment-person");

		const renamed = markdown("People/Contact moments/Renamed.md");
		files.delete(moment.path);
		caches.delete(moment.path);
		files.set(renamed.path, renamed);
		caches.set(renamed.path, contactMomentCache("moment-1", ["alice-new"], "rel-1"));
		vault.emit("rename", renamed, moment.path);
		expect(index.getContactMomentPathsById("moment-1")).toEqual([renamed.path]);
		expect(index.getSnapshot().contactMoments).toEqual([
			expect.objectContaining({ id: "moment-1", filePath: renamed.path }),
		]);
		expect(deltas.at(-1)?.removedContactMoments).toEqual([
			expect.objectContaining({ id: "moment-1", filePath: moment.path }),
		]);
		expect(deltas.at(-1)?.addedContactMoments).toEqual([
			expect.objectContaining({ id: "moment-1", filePath: renamed.path }),
		]);

		files.delete(renamed.path);
		vault.emit("delete", renamed);
		expect(index.getSnapshot().contactMoments).toEqual([]);
		expect(deltas.at(-1)?.removedContactMoments).toEqual([
			expect.objectContaining({ id: "moment-1", filePath: renamed.path }),
		]);
	});
});
