import { Modal, type App } from "obsidian";
import type { Translator } from "../i18n";
import { previewSettingsRecovery, type SettingsRecoveryPreview } from "./recovery";

export class SettingsRecoveryModal extends Modal {
	private readonly cleanup: Array<() => void> = [];
	private generation = 0;
	constructor(
		app: App,
		private readonly raw: unknown,
		private readonly originalText: string,
		private readonly save: (preview: SettingsRecoveryPreview) => Promise<void>,
		private readonly t: Translator,
	) {
		super(app);
	}
	override onOpen(): void {
		const generation = ++this.generation;
		this.titleEl.textContent = this.t.recovery.settingsTitle;
		this.contentEl.classList.add("people-atlas-recovery");
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const explanation = document.createElement("p");
		explanation.textContent = this.t.recovery.settingsExplanation;
		const label = document.createElement("label");
		label.textContent = this.t.recovery.chooseRoot;
		const root = document.createElement("input");
		root.type = "text";
		root.setAttribute("aria-label", this.t.recovery.chooseRoot);
		label.append(root);
		const review = document.createElement("button");
		review.type = "button";
		review.textContent = this.t.recovery.reviewSettings;
		const confirm = document.createElement("button");
		confirm.type = "button";
		confirm.textContent = this.t.recovery.confirmSettings;
		confirm.disabled = true;
		confirm.className = "mod-cta";
		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.textContent = this.t.recovery.cancel;
		const status = document.createElement("p");
		status.setAttribute("role", "status");
		const details = document.createElement("div");
		let preview: SettingsRecoveryPreview | undefined;
		this.listen(root, "input", () => {
			preview = undefined;
			confirm.disabled = true;
			details.replaceChildren();
		});
		this.listen(review, "click", () => {
			try {
				preview = previewSettingsRecovery(this.raw, this.originalText, root.value);
				status.textContent = "";
				details.replaceChildren();
				const target = document.createElement("p");
				target.textContent = `${this.t.recovery.chooseRoot}: ${preview.settings.peopleRootFolder}`;
				details.append(target);
				for (const group of ["retained", "changed", "reset", "unsupported"] as const) {
					const heading = document.createElement("h3");
					heading.textContent = this.t.recovery[group];
					const list = document.createElement("ul");
					for (const entry of preview.entries.filter((item) => item.status === group)) {
						const row = document.createElement("li");
						row.textContent = `${entry.key}: ${entry.before === undefined ? this.t.recovery.missingValue : JSON.stringify(entry.before)}${entry.after === undefined ? "" : ` → ${JSON.stringify(entry.after)}`}`;
						list.append(row);
					}
					details.append(heading, list);
				}
				confirm.disabled = false;
			} catch (error) {
				preview = undefined;
				confirm.disabled = true;
				status.textContent = error instanceof Error ? error.message : String(error);
			}
		});
		this.listen(confirm, "click", async () => {
			if (!preview || confirm.disabled) return;
			confirm.disabled = true;
			cancel.disabled = true;
			review.disabled = true;
			root.disabled = true;
			try {
				await this.save(preview);
				if (generation === this.generation) status.textContent = this.t.recovery.settingsSaved;
			} catch (error) {
				if (generation !== this.generation) return;
				status.textContent = error instanceof Error ? error.message : String(error);
				confirm.disabled = false;
				review.disabled = false;
				root.disabled = false;
			} finally {
				if (generation === this.generation) cancel.disabled = false;
			}
		});
		this.listen(cancel, "click", () => {
			if (!cancel.disabled) this.close();
		});
		this.listen(this.contentEl, "keydown", (event) => {
			if ((event as KeyboardEvent).key === "Escape" && !cancel.disabled) this.close();
		});
		this.contentEl.append(explanation, label, review, details, status, confirm, cancel);
		root.focus();
	}
	private listen(element: HTMLElement, type: string, handler: EventListener): void {
		element.addEventListener(type, handler);
		this.cleanup.push(() => element.removeEventListener(type, handler));
	}
	override onClose(): void {
		this.generation += 1;
		for (const clean of this.cleanup.splice(0)) clean();
		this.contentEl.replaceChildren();
		this.contentEl.classList.remove("people-atlas-recovery");
	}
}
