import { describe, expect, it } from "vitest";
import type { App, CachedMetadata } from "obsidian";
import { PersonIndex } from "../src/index/person-index";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { TFile } from "obsidian";

class EventBus {
	private readonly handlers = new Map<string, Array<(...args: any[]) => void>>();

	on(name: string, callback: (...args: any[]) => void): { unload: () => void } {
		const callbacks = this.handlers.get(name) ?? [];
		callbacks.push(callback);
		this.handlers.set(name, callbacks);
		return { unload: () => this.handlers.set(name, callbacks.filter((item) => item !== callback)) };
	}

	emit(name: string, ...args: any[]): void {
	for (const callback of this.handlers.get(name) ?? []) callback(...args);
	}
}

function markdown(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.basename = path.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
	return file;
}

function personCache(id: string, name: string): CachedMetadata {
	return { frontmatter: { type: "person", person_id: id, name } } as CachedMetadata;
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
				getMarkdownFiles: () => { scanCount += 1; return [...files.values()]; },
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
});
