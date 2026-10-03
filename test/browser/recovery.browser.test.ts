import { afterEach, describe, expect, it, vi } from "vitest";
import type { App, Modal } from "obsidian";
import { DiagnosticsModal } from "../../src/editor/diagnostics-modal";
import { PersonRecoveryModal } from "../../src/editor/person-recovery-modal";
import { SettingsRecoveryModal } from "../../src/settings/recovery-modal";
import type { SettingsRecoveryPreview } from "../../src/settings/recovery";
import type { AtlasDiagnostic } from "../../src/domain/types";
import type { AtlasMutationService } from "../../src/mutations/atlas-mutation-service";
import type { PersonRecoveryPreview } from "../../src/mutations/person-recovery";
import { createTranslator } from "../../src/i18n";
import { required } from "../recovery-test-helpers";
import "../../styles.css";

const mounts: Array<{ onClose: () => void; root: HTMLElement }> = [];
function mount<T extends Modal & { onOpen(): void; onClose(): void }>(modal: T) {
	const root = document.createElement("div");
	root.className = "modal";
	const title = document.createElement("h2");
	const content = document.createElement("div");
	root.append(title, content);
	document.body.append(root);
	modal.titleEl = title;
	modal.contentEl = content;
	const close = vi.fn(() => {
		modal.onClose();
		root.remove();
	});
	modal.close = close;
	modal.onOpen();
	mounts.push({ onClose: () => modal.onClose(), root });
	return { root, content, close, modal };
}
function byText(content: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(content.querySelectorAll<HTMLButtonElement>("button")).find(
		(element) => element.textContent === text,
	);
	if (!button) throw new Error(`Missing button ${text}`);
	return button;
}
const t = createTranslator("en");
afterEach(() => {
	for (const entry of mounts.splice(0)) {
		entry.onClose();
		entry.root.remove();
	}
});

describe("reviewable recovery surfaces", () => {
	it("reaches every diagnostic beyond 20, combines filters and opens only exact permitted paths", () => {
		const diagnostics: AtlasDiagnostic[] = Array.from({ length: 35 }, (_, index) => ({
			id: String(index),
			severity: index % 2 ? "error" : "warning",
			code: index % 2 ? "duplicate-person-id" : "missing-person-id",
			message: `Issue ${index}`,
			filePaths: [`Allowed/${index}.md`],
		}));
		diagnostics.push({
			id: "private",
			severity: "error",
			code: "duplicate-person-id",
			message: "Secret name",
			filePaths: ["Private/Person.md"],
		});
		const open = vi.fn();
		const repair = vi.fn();
		const allowed = new Set(diagnostics.slice(0, 35).flatMap((diagnostic) => diagnostic.filePaths));
		const m = mount(new DiagnosticsModal({} as App, diagnostics, open, repair, t, allowed));
		expect(m.content.querySelectorAll("li")).toHaveLength(35);
		expect(m.content.textContent).not.toContain("Secret name");
		expect(m.content.textContent).not.toContain("Private/Person.md");
		const search = required(m.content.querySelector<HTMLInputElement>("input[type='search']"));
		search.value = "Allowed/34.md";
		search.dispatchEvent(new Event("input", { bubbles: true }));
		expect(m.content.querySelectorAll("li")).toHaveLength(1);
		byText(m.content, "Allowed/34.md").click();
		expect(open).toHaveBeenCalledWith("Allowed/34.md");
		byText(m.content, t.recovery.reviewRepair).click();
		expect(repair.mock.calls[0]?.[1]).toBe("Allowed/34.md");
		const severity = required(m.content.querySelectorAll("select")[0]);
		severity.value = "error";
		severity.dispatchEvent(new Event("change"));
		expect(m.content.querySelectorAll("li")).toHaveLength(0);
		const formerSearch = search;
		m.modal.onClose();
		formerSearch.dispatchEvent(new Event("input"));
		expect(m.content.children).toHaveLength(0);
	});
	it("selection, preview, search and cancellation never apply a note mutation", async () => {
		const preview = vi.fn(
			async (path: string): Promise<PersonRecoveryPreview> => ({
				filePath: path,
				kind: "adopt",
				classification: "unclassified",
				personId: "new-id",
				eligible: true,
				mappings: [{ setting: "personIdProperty", property: "identity" }],
				changes: [
					{ property: "identity", before: undefined, after: "new-id" },
					{ property: "type", before: undefined, after: "person" },
				],
			}),
		);
		const apply = vi.fn();
		const app = {
			vault: { getMarkdownFiles: () => [{ path: "Loose/A.md" }, { path: "Loose/B.md" }] },
		} as unknown as App;
		const m = mount(
			new PersonRecoveryModal(
				app,
				{ previewPersonRecovery: preview, applyPersonRecovery: apply } as unknown as AtlasMutationService,
				t,
			),
		);
		required(m.content.querySelector<HTMLInputElement>("input[type='checkbox']")).click();
		await vi.waitFor(() => expect(m.content.textContent).toContain("identity: (missing)"));
		expect(m.content.textContent).toContain("personIdProperty → identity");
		expect(m.content.textContent).toContain("Loose/A.md");
		expect(apply).not.toHaveBeenCalled();
		byText(m.content, t.recovery.cancel).click();
		expect(m.close).toHaveBeenCalledOnce();
		expect(apply).not.toHaveBeenCalled();
	});
	it("shows sequential partial success and never reapplies completed rows on retry", async () => {
		const preview = vi.fn(
			async (path: string): Promise<PersonRecoveryPreview> => ({
				filePath: path,
				kind: "missing-id",
				classification: "type",
				personId: path,
				eligible: true,
				mappings: [],
				changes: [{ property: "person_id", before: undefined, after: path }],
			}),
		);
		const apply = vi.fn(async (row: PersonRecoveryPreview) => ({
			filePath: row.filePath,
			status: row.filePath === "A.md" ? ("saved" as const) : ("failed" as const),
			...(row.filePath === "B.md" ? { message: "Disk full" } : {}),
		}));
		const m = mount(
			new PersonRecoveryModal(
				{} as App,
				{ previewPersonRecovery: preview, applyPersonRecovery: apply } as unknown as AtlasMutationService,
				t,
				"missing-id",
				["A.md", "B.md"],
			),
		);
		for (const input of Array.from(m.content.querySelectorAll<HTMLInputElement>("input[type='checkbox']")))
			input.click();
		await vi.waitFor(() => expect(byText(m.content, t.recovery.applyReviewed).disabled).toBe(false));
		byText(m.content, t.recovery.applyReviewed).click();
		await vi.waitFor(() => expect(m.content.textContent).toContain("Failed: Disk full"));
		expect(m.content.textContent).toContain("Saved: A.md");
		expect(m.content.textContent).toContain("not atomic");
		byText(m.content, t.recovery.applyReviewed).click();
		await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(3));
		expect(apply.mock.calls.filter(([row]) => row.filePath === "A.md")).toHaveLength(1);
	});
	it("duplicate repair requires exactly one explicitly chosen note and discloses references", async () => {
		const preview = vi.fn(
			async (path: string): Promise<PersonRecoveryPreview> => ({
				filePath: path,
				kind: "duplicate-id",
				classification: "type",
				personId: "new-id",
				eligible: true,
				mappings: [],
				changes: [{ property: "person_id", before: "duplicate", after: "new-id" }],
			}),
		);
		const apply = vi.fn(async (row: PersonRecoveryPreview) => ({ filePath: row.filePath, status: "saved" as const }));
		const m = mount(
			new PersonRecoveryModal(
				{} as App,
				{ previewPersonRecovery: preview, applyPersonRecovery: apply } as unknown as AtlasMutationService,
				t,
				"duplicate-id",
				["A.md", "B.md"],
			),
		);
		expect(byText(m.content, t.recovery.applyReviewed).disabled).toBe(true);
		expect(m.content.textContent).toContain("references are not automatically retargeted");
		const radios = m.content.querySelectorAll<HTMLInputElement>("input[type='radio']");
		required(radios[0]).click();
		required(radios[1]).click();
		await vi.waitFor(() => expect(byText(m.content, t.recovery.applyReviewed).disabled).toBe(false));
		byText(m.content, t.recovery.applyReviewed).click();
		await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
		expect(required(apply.mock.calls[0])[0].filePath).toBe("B.md");
	});
	it("requires a root and explicit review before settings save; cancel writes nothing", () => {
		const raw = { schemaVersion: 7, peopleFolder: "Old/People", showLabels: false };
		const save = vi.fn();
		const m = mount(new SettingsRecoveryModal({} as App, raw, JSON.stringify(raw), save, t));
		expect(byText(m.content, t.recovery.confirmSettings).disabled).toBe(true);
		byText(m.content, t.recovery.reviewSettings).click();
		expect(m.content.textContent).toContain("explicitly");
		expect(save).not.toHaveBeenCalled();
		const root = required(m.content.querySelector<HTMLInputElement>("input"));
		root.value = "New People";
		root.dispatchEvent(new Event("input"));
		byText(m.content, t.recovery.reviewSettings).click();
		expect(m.content.textContent).toContain("showLabels: false → false");
		expect(m.content.textContent).toContain("peopleFolder");
		expect(m.content.textContent).toContain("New People");
		expect(byText(m.content, t.recovery.confirmSettings).disabled).toBe(false);
		byText(m.content, t.recovery.cancel).click();
		expect(save).not.toHaveBeenCalled();
	});
	it("reports settings save failure and keeps the original preview recoverable", async () => {
		const raw = { schemaVersion: 7, showLabels: false };
		const save = vi.fn(async () => {
			throw new Error("Disk full");
		});
		const m = mount(new SettingsRecoveryModal({} as App, raw, JSON.stringify(raw), save, t));
		const root = required(m.content.querySelector<HTMLInputElement>("input"));
		root.value = "Chosen";
		root.dispatchEvent(new Event("input"));
		byText(m.content, t.recovery.reviewSettings).click();
		byText(m.content, t.recovery.confirmSettings).click();
		await vi.waitFor(() => expect(m.content.textContent).toContain("Disk full"));
		expect(byText(m.content, t.recovery.confirmSettings).disabled).toBe(false);
		expect(raw).toEqual({ schemaVersion: 7, showLabels: false });
		expect(m.content.textContent).toContain("Chosen");
	});
	it("shows a successful explicit settings confirmation and owns listeners after close", async () => {
		const raw = { schemaVersion: 7, enableBases: false };
		const save = vi.fn(async (_preview: SettingsRecoveryPreview) => undefined);
		const m = mount(new SettingsRecoveryModal({} as App, raw, JSON.stringify(raw), save, createTranslator("nl")));
		const dutch = createTranslator("nl");
		const root = required(m.content.querySelector<HTMLInputElement>("input"));
		root.value = "Personen";
		root.dispatchEvent(new Event("input"));
		byText(m.content, dutch.recovery.reviewSettings).click();
		const confirm = byText(m.content, dutch.recovery.confirmSettings);
		confirm.click();
		await vi.waitFor(() => expect(m.content.textContent).toContain(dutch.recovery.settingsSaved));
		expect(save.mock.calls[0]?.[0]?.settings.peopleRootFolder).toBe("Personen");
		m.modal.onClose();
		confirm.click();
		expect(save).toHaveBeenCalledOnce();
	});
});
