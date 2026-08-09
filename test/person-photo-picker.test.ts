import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import type { PersonRecord } from "../src/domain/types";
import { PersonPhotoPicker } from "../src/editor/person-photo-picker";
import { createTranslator } from "../src/i18n";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

const alice: PersonRecord = {
	id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
	filePath: "People/Profiles/Alice/Alice.md",
	name: "Alice",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

function createPicker(options: {
	assets: () => string[];
	loadedPaths?: () => string[];
	people?: () => PersonRecord[];
	filePath?: string;
}): PersonPhotoPicker {
	const filePath = options.filePath ?? alice.filePath;
	const app = {
		vault: {
			getAllLoadedFiles: () => (options.loadedPaths?.() ?? [filePath]).map((path) => ({ path }) as TFile),
			getFiles: () => options.assets().map((path) => ({ path }) as TFile),
		},
	} as unknown as App;
	return new PersonPhotoPicker({
		app,
		mode: { kind: "edit", file: { path: filePath } as TFile, personId: alice.id },
		values: { name: alice.name, photo: "" },
		getSettings: () => ({ ...DEFAULT_SETTINGS, peopleRootFolder: "People" }),
		getCurrentPeople: options.people ?? (() => [alice]),
		translator: createTranslator("en"),
	});
}

describe("PersonPhotoPicker ownership", () => {
	it("admits only exact current dossier assets and revalidates disappearance at Save", () => {
		const selectedPath = "People/Profiles/Alice/Photos/Portrait.jpg";
		let assets = [selectedPath, "People/Profiles/Alice/Notes.txt", "Archive/Portrait.jpg"];
		const picker = createPicker({
			assets: () => assets,
			loadedPaths: () => [alice.filePath],
		});

		expect(picker.getCurrentPhotoAssets().map((asset) => asset.path)).toEqual([selectedPath]);
		expect(() =>
			picker.validateSelection({
				photo: `[[${selectedPath}]]`,
				photoSelectionPath: selectedPath,
			}),
		).not.toThrow();

		assets = [];
		expect(() =>
			picker.validateSelection({
				photo: `[[${selectedPath}]]`,
				photoSelectionPath: selectedPath,
			}),
		).toThrow("no longer uniquely available");
	});

	it("rejects a supported asset outside the current person's dossier", () => {
		const selectedPath = "People/Profiles/Bob/Portrait.jpg";
		const picker = createPicker({
			assets: () => [selectedPath],
			loadedPaths: () => [alice.filePath],
		});

		expect(() =>
			picker.validateSelection({
				photo: `[[${selectedPath}]]`,
				photoSelectionPath: selectedPath,
			}),
		).toThrow("own dossier");
	});

	it("fails closed when the current profile has no canonical dossier boundary", () => {
		const selectedPath = "People/Profiles/Portrait.jpg";
		const picker = createPicker({
			assets: () => [selectedPath],
			filePath: "People/Profiles/Alice.md",
			loadedPaths: () => ["People/Profiles/Alice.md"],
		});

		expect(() =>
			picker.validateSelection({
				photo: `[[${selectedPath}]]`,
				photoSelectionPath: selectedPath,
			}),
		).toThrow("canonical dossier");
	});
});
