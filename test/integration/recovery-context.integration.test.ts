import type { App, Modal, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import PeopleAtlasPlugin from "../../src/main";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import { DiagnosticsModal } from "../../src/editor/diagnostics-modal";
import { PersonRecoveryModal } from "../../src/editor/person-recovery-modal";
import type { AtlasSnapshot } from "../../src/domain/types";
import { ControlledObsidianRuntime, type TFile } from "../obsidian-stub";
import { required } from "../recovery-test-helpers";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Synthetic recovery context",
	author: "People Atlas",
} as PluginManifest;
const cleanups: Array<() => void | Promise<void>> = [];
function mount<T extends Modal & { onOpen(): void; onClose(): void }>(modal: T): void {
	const root = document.createElement("div");
	modal.titleEl = document.createElement("h2");
	modal.contentEl = document.createElement("div");
	root.append(modal.titleEl, modal.contentEl);
	document.body.append(root);
	modal.close = () => {
		modal.onClose();
		root.remove();
	};
	modal.onOpen();
	cleanups.push(() => modal.close());
}
function button(content: HTMLElement, text: string): HTMLButtonElement {
	return required(
		Array.from(content.querySelectorAll<HTMLButtonElement>("button")).find(
			(candidate) => candidate.textContent === text,
		),
	);
}
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("bounded Base recovery diagnostics", () => {
	it("carries the Base scope into repair errors while global diagnostics retain the exact blocking source", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const visible = runtime.seedFile("Allowed/Person.md", { type: "person", name: "Visible person" });
		const stable = runtime.seedFile("Allowed/Stable.md", {
			type: "person",
			person_id: "stable",
			name: "Stable person",
		});
		runtime.seedFile("Private/Broken.md");
		const hiddenDetail = "Hidden read failure details";
		Object.assign(runtime.vault, {
			read: async (file: TFile) => {
				if (file.path === "Private/Broken.md") throw new Error(hiddenDetail);
				const frontmatter = runtime.metadataCache.getFileCache(file)?.frontmatter ?? {};
				return `---\n${Object.entries(frontmatter)
					.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
					.join("\n")}\n---\nPreserved body`;
			},
		});
		const write = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		await plugin.load();
		cleanups.push(() => plugin.unload());
		runtime.workspace.triggerLayoutReady();
		runtime.emitMetadata("resolved");
		const diagnostics: DiagnosticsModal[] = [];
		const repairs: PersonRecoveryModal[] = [];
		vi.spyOn(DiagnosticsModal.prototype, "open").mockImplementation(function (this: DiagnosticsModal) {
			mount(this);
			diagnostics.push(this);
		});
		vi.spyOn(PersonRecoveryModal.prototype, "open").mockImplementation(function (this: PersonRecoveryModal) {
			mount(this);
			repairs.push(this);
		});
		const stableEntry = runtime.createBasesEntry(stable, { "note.person_id": "stable", "note.name": "Stable person" });
		const missingEntry = runtime.createBasesEntry(visible, { "note.name": "Visible person" });
		const base = await runtime.openBasesView(
			BASES_VIEW_TYPE_PEOPLE_ATLAS,
			[stableEntry, missingEntry],
			"One permitted person",
		);
		cleanups.push(() => base.view.unload());
		required(base.parent.querySelector<HTMLButtonElement>(".people-atlas-base-diagnostics")).click();
		button(required(diagnostics[0]).contentEl, plugin.t.recovery.reviewRepair).click();
		const bounded = required(repairs[0]);
		required(bounded.contentEl.querySelector<HTMLInputElement>("input[type='checkbox']")).click();
		await vi.waitFor(() => expect(button(bounded.contentEl, plugin.t.recovery.applyReviewed).disabled).toBe(false));
		button(bounded.contentEl, plugin.t.recovery.applyReviewed).click();
		await vi.waitFor(() => expect(bounded.contentEl.textContent).toContain(plugin.t.recovery.outsideContextError));
		expect(bounded.contentEl.textContent).not.toContain("Private/Broken.md");
		expect(bounded.contentEl.textContent).not.toContain(hiddenDetail);
		expect(document.body.textContent).not.toContain("Private/");
		expect(write).not.toHaveBeenCalled();
		const full = () => required((base.view as unknown as { fullSnapshot?: AtlasSnapshot }).fullSnapshot);
		const missingPaths = () => [
			...new Set(
				full()
					.diagnostics.filter((diagnostic) => diagnostic.code === "missing-person-id")
					.flatMap((diagnostic) => diagnostic.filePaths),
			),
		];
		expect(full().nodes.map((node) => node.filePath)).toEqual([stable.path]);
		expect(missingPaths()).toEqual([visible.path]);
		const beforeDelta = full();
		runtime.changeMetadata(visible.path, { type: "person", name: "Refreshed permitted source" });
		await vi.waitFor(() => expect(full()).not.toBe(beforeDelta));
		expect(missingPaths()).toEqual([visible.path]);
		expect(full().nodes.map((node) => node.filePath)).toEqual([stable.path]);
		base.controller.setEntries([stableEntry]);
		base.view.onDataUpdated();
		expect(missingPaths()).toEqual([]);
		expect(full().nodes.map((node) => node.filePath)).toEqual([stable.path]);
		base.controller.setEntries([stableEntry, missingEntry]);
		base.view.onDataUpdated();
		expect(missingPaths()).toEqual([visible.path]);
		expect(full().nodes.map((node) => node.filePath)).toEqual([stable.path]);
		plugin.openDiagnostics();
		button(required(diagnostics[1]).contentEl, plugin.t.recovery.reviewRepair).click();
		const global = required(repairs[1]);
		required(global.contentEl.querySelector<HTMLInputElement>("input[type='checkbox']")).click();
		await vi.waitFor(() => expect(button(global.contentEl, plugin.t.recovery.applyReviewed).disabled).toBe(false));
		button(global.contentEl, plugin.t.recovery.applyReviewed).click();
		await vi.waitFor(() => expect(global.contentEl.textContent).toContain("Private/Broken.md"));
		expect(global.contentEl.textContent).toContain(hiddenDetail);
		expect(write).not.toHaveBeenCalled();
	});
	it("keeps an admitted duplicate person ambiguous but exposes its exact repair preview without excluded source details", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const admitted = runtime.seedFile("Allowed/Duplicate.md", {
			type: "person",
			person_id: "shared-id",
			name: "Admitted person",
		});
		runtime.seedFile("Private/Excluded duplicate.md", {
			type: "person",
			person_id: "shared-id",
			name: "Excluded secret person",
		});
		Object.assign(runtime.vault, {
			read: async (file: TFile) => {
				const frontmatter = runtime.metadataCache.getFileCache(file)?.frontmatter ?? {};
				return `---\n${Object.entries(frontmatter)
					.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
					.join("\n")}\n---\nPreserved body`;
			},
		});
		const write = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		await plugin.load();
		cleanups.push(() => plugin.unload());
		runtime.triggerLayoutReady();
		runtime.emitMetadata("resolved");
		const diagnostics: DiagnosticsModal[] = [];
		const repairs: PersonRecoveryModal[] = [];
		vi.spyOn(DiagnosticsModal.prototype, "open").mockImplementation(function (this: DiagnosticsModal) {
			mount(this);
			diagnostics.push(this);
		});
		vi.spyOn(PersonRecoveryModal.prototype, "open").mockImplementation(function (this: PersonRecoveryModal) {
			mount(this);
			repairs.push(this);
		});
		const base = await runtime.openBasesView(
			BASES_VIEW_TYPE_PEOPLE_ATLAS,
			[runtime.createBasesEntry(admitted, { "note.person_id": "shared-id", "note.name": "Admitted person" })],
			"Admitted duplicate",
		);
		cleanups.push(() => base.view.unload());
		const full = required((base.view as unknown as { fullSnapshot?: AtlasSnapshot }).fullSnapshot);
		expect(full.nodes).toHaveLength(1);
		expect(required(full.nodes[0]).id).toMatch(/^ambiguous:/);
		const duplicate = required(full.diagnostics.find((diagnostic) => diagnostic.code === "duplicate-person-id"));
		expect(duplicate.filePaths).toEqual([admitted.path]);
		expect(duplicate.targetPath).toBeUndefined();
		expect(JSON.stringify(full.diagnostics)).not.toContain("Private/");
		expect(JSON.stringify(full.diagnostics)).not.toContain("Excluded secret person");
		required(base.parent.querySelector<HTMLButtonElement>(".people-atlas-base-diagnostics")).click();
		button(required(diagnostics[0]).contentEl, plugin.t.recovery.reviewRepair).click();
		const repair = required(repairs[0]);
		const choices = repair.contentEl.querySelectorAll<HTMLInputElement>("input[type='radio']");
		expect(choices).toHaveLength(1);
		expect(required(choices[0]).getAttribute("aria-label")).toBe(admitted.path);
		required(choices[0]).click();
		await vi.waitFor(() => expect(button(repair.contentEl, plugin.t.recovery.applyReviewed).disabled).toBe(false));
		expect(repair.contentEl.textContent).toContain('person_id: "shared-id"');
		expect(document.body.textContent).not.toContain("Private/");
		expect(document.body.textContent).not.toContain("Excluded secret person");
		button(repair.contentEl, plugin.t.recovery.cancel).click();
		expect(write).not.toHaveBeenCalled();
	});
});
