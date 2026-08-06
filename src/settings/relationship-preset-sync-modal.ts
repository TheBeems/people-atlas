import { Modal, type App } from "obsidian";
import { createTranslator, type Translator } from "../i18n";
import type { RelationshipPreset } from "./relationship-presets";
import type { RelationshipPresetSyncChange, RelationshipPresetSyncResult } from "./relationship-preset-sync";

export class RelationshipPresetSyncModal extends Modal {
	private confirmButton: HTMLButtonElement | undefined;
	private statusEl: HTMLElement | undefined;

	constructor(
		app: App,
		private readonly preset: RelationshipPreset,
		private readonly changes: RelationshipPresetSyncChange[],
		private readonly onConfirm: (changes: RelationshipPresetSyncChange[]) => Promise<RelationshipPresetSyncResult>,
		private readonly t: Translator = createTranslator("en"),
	) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.textContent = this.t.relationshipPresetSyncModal.title;
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const intro = document.createElement("p");
		intro.textContent = this.t.relationshipPresetSyncModal.intro({
			count: this.changes.length,
			presetName: this.preset.name,
		});
		const list = document.createElement("ul");
		list.className = "people-atlas-preset-sync-list";
		for (const change of this.changes) {
			const item = document.createElement("li");
			const path = document.createElement("strong");
			path.textContent = change.filePath;
			const details = document.createElement("span");
			details.textContent = `${describe(change.before, this.t)} → ${describe(change.after, this.t)}`;
			item.append(path, details);
			list.append(item);
		}
		this.statusEl = document.createElement("p");
		this.statusEl.className = "people-atlas-preset-sync-status";
		this.statusEl.setAttribute("role", "status");
		this.statusEl.setAttribute("aria-live", "polite");
		const actions = document.createElement("div");
		actions.className = "people-atlas-form-actions";
		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.textContent = this.t.relationshipPresetSyncModal.cancel;
		cancel.addEventListener("click", () => this.close());
		this.confirmButton = document.createElement("button");
		this.confirmButton.type = "button";
		this.confirmButton.className = "mod-cta";
		this.confirmButton.textContent = this.t.relationshipPresetSyncModal.confirm;
		this.confirmButton.addEventListener("click", () => void this.confirm());
		actions.append(cancel, this.confirmButton);
		this.contentEl.append(intro, list, this.statusEl, actions);
	}

	override onClose(): void {
		this.contentEl.replaceChildren();
		this.confirmButton = undefined;
		this.statusEl = undefined;
	}

	private async confirm(): Promise<void> {
		if (!this.confirmButton || !this.statusEl) return;
		this.confirmButton.disabled = true;
		this.confirmButton.setAttribute("aria-busy", "true");
		let result: RelationshipPresetSyncResult;
		try {
			result = await this.onConfirm(this.changes.map((change) => structuredClone(change)));
		} catch (error) {
			this.statusEl.textContent = this.t.relationshipPresetSyncModal.updateFailed({
				error: error instanceof Error ? error.message : String(error),
			});
			this.confirmButton.disabled = false;
			this.confirmButton.removeAttribute("aria-busy");
			return;
		}
		if (result.failure) {
			const location = result.failure.filePath ? ` at “${result.failure.filePath}”` : "";
			this.statusEl.textContent = `Stopped${location}. Completed ${result.completed}; skipped ${result.skipped}; remaining ${result.remaining}. ${result.failure.message}`;
		} else {
			this.statusEl.textContent = this.t.relationshipPresetSyncModal.success({
				completed: result.completed,
				skipped: result.skipped,
			});
		}
		const closeButton = this.confirmButton.cloneNode(true) as HTMLButtonElement;
		closeButton.removeAttribute("aria-busy");
		closeButton.textContent = this.t.relationshipPresetSyncModal.close;
		closeButton.disabled = false;
		closeButton.addEventListener("click", () => this.close());
		this.confirmButton.replaceWith(closeButton);
		this.confirmButton = closeButton;
	}
}

function describe(values: RelationshipPresetSyncChange["before"], translator: Translator): string {
	return translator.relationshipPresetSyncModal.preview({
		types: values.types.join(", ") || translator.relationshipPresetSyncModal.none,
		fromRole: values.fromRole ?? translator.relationshipPresetSyncModal.none,
		toRole: values.toRole ?? translator.relationshipPresetSyncModal.none,
	});
}
