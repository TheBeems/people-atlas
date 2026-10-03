import { Modal, type App } from "obsidian";
import type { AtlasMutationService } from "../mutations/atlas-mutation-service";
import type { PersonRecoveryKind, PersonRecoveryPreview, PersonRecoveryResult } from "../mutations/person-recovery";
import type { Translator } from "../i18n";

export class PersonRecoveryModal extends Modal {
	private readonly cleanup: Array<() => void> = [];
	private readonly previews = new Map<string, PersonRecoveryPreview>();
	private readonly results = new Map<string, PersonRecoveryResult>();
	private readonly allowedSourcePaths: ReadonlySet<string> | undefined;
	private generation = 0;
	private busy = false;
	constructor(
		app: App,
		private readonly mutations: AtlasMutationService,
		private readonly t: Translator,
		private readonly kind: PersonRecoveryKind = "adopt",
		private readonly paths?: readonly string[],
		allowedSourcePaths?: ReadonlySet<string>,
	) {
		super(app);
		this.allowedSourcePaths = allowedSourcePaths ? new Set(allowedSourcePaths) : undefined;
	}

	override onOpen(): void {
		const generation = ++this.generation;
		this.titleEl.textContent = this.kind === "adopt" ? this.t.recovery.adoptionTitle : this.t.recovery.repairTitle;
		this.contentEl.classList.add("people-atlas-recovery");
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const explanation = document.createElement("p");
		explanation.textContent = this.t.recovery.adoptionExplanation;
		const warning = document.createElement("p");
		warning.textContent =
			this.kind === "duplicate-id" ? this.t.recovery.duplicateWarning : this.t.recovery.sequentialWarning;
		const search = document.createElement("input");
		search.type = "search";
		search.placeholder = this.t.recovery.searchNotes;
		search.setAttribute("aria-label", this.t.recovery.searchNotes);
		const choices = document.createElement("div");
		choices.className = "people-atlas-recovery-choices";
		const review = document.createElement("div");
		review.setAttribute("aria-live", "polite");
		const actions = document.createElement("div");
		actions.className = "people-atlas-recovery-actions";
		const confirm = document.createElement("button");
		confirm.type = "button";
		confirm.textContent = this.t.recovery.applyReviewed;
		confirm.className = "mod-cta";
		confirm.disabled = true;
		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.textContent = this.t.recovery.cancel;
		const selected = new Set<string>();
		const paths = [...new Set(this.paths ?? this.app.vault.getMarkdownFiles().map((file) => file.path))]
			.filter((path) => !this.allowedSourcePaths || this.allowedSourcePaths.has(path))
			.sort();
		const inputs = new Map<string, HTMLInputElement>();
		const valueText = (value: unknown): string =>
			value === undefined ? this.t.recovery.missingValue : JSON.stringify(value);
		const renderPreview = (): void => {
			review.replaceChildren();
			for (const path of selected) {
				const preview = this.previews.get(path);
				if (!preview) continue;
				const row = document.createElement("section");
				const heading = document.createElement("h3");
				heading.textContent = path;
				row.append(heading);
				const classification = document.createElement("p");
				classification.textContent = `${this.t.recovery.classification}: ${preview.classification} · ${this.t.recovery.personId}: ${preview.personId || this.t.recovery.missingValue}`;
				row.append(classification);
				const mappings = document.createElement("details");
				const summary = document.createElement("summary");
				summary.textContent = this.t.recovery.configuredMappings;
				const mappingList = document.createElement("ul");
				for (const mapping of preview.mappings) {
					const item = document.createElement("li");
					item.textContent = `${mapping.setting} → ${mapping.property}`;
					mappingList.append(item);
				}
				mappings.append(summary, mappingList);
				row.append(mappings);
				for (const change of preview.changes) {
					const item = document.createElement("p");
					item.textContent = `${change.property}: ${valueText(change.before)} → ${valueText(change.after)}`;
					row.append(item);
				}
				if (preview.changes.length === 0 && preview.eligible) {
					const item = document.createElement("p");
					item.textContent = this.t.recovery.alreadyCurrent;
					row.append(item);
				}
				if (preview.error) {
					const error = document.createElement("p");
					error.className = "people-atlas-recovery-error";
					error.textContent = preview.error;
					row.append(error);
				}
				const result = this.results.get(path);
				if (result) {
					const status = document.createElement("p");
					status.setAttribute("role", "status");
					const message =
						result.blockedSourcePath &&
						this.allowedSourcePaths &&
						!this.allowedSourcePaths.has(result.blockedSourcePath)
							? this.t.recovery.outsideContextError
							: (result.message ?? path);
					status.textContent = `${this.t.recovery.resultStatus[result.status]}: ${message}`;
					row.append(status);
				}
				review.append(row);
			}
			confirm.disabled =
				this.busy ||
				selected.size === 0 ||
				[...selected].some((path) => !this.previews.get(path)?.eligible) ||
				[...selected].every((path) => this.results.get(path)?.status === "saved");
		};
		for (const path of paths) {
			const label = document.createElement("label");
			label.dataset.path = path;
			const input = document.createElement("input");
			input.type = this.kind === "duplicate-id" ? "radio" : "checkbox";
			input.name = "person-recovery-note";
			input.setAttribute("aria-label", path);
			inputs.set(path, input);
			this.listen(input, "change", async () => {
				if (this.busy) return;
				if (this.kind === "duplicate-id") selected.clear();
				if (input.checked) {
					selected.add(path);
					confirm.disabled = true;
					if (!this.previews.has(path))
						this.previews.set(path, await this.mutations.previewPersonRecovery(path, this.kind));
				} else selected.delete(path);
				if (this.generation === generation) renderPreview();
			});
			label.append(input, document.createTextNode(path));
			choices.append(label);
		}
		this.listen(search, "input", () => {
			for (const label of Array.from(choices.querySelectorAll<HTMLElement>("label")))
				label.hidden = !label.dataset.path?.toLocaleLowerCase().includes(search.value.toLocaleLowerCase());
		});
		this.listen(cancel, "click", () => {
			if (!this.busy) this.close();
		});
		this.listen(this.contentEl, "keydown", (event) => {
			if ((event as KeyboardEvent).key === "Escape" && !this.busy) this.close();
		});
		this.listen(confirm, "click", async () => {
			if (confirm.disabled || this.busy) return;
			this.busy = true;
			confirm.disabled = true;
			cancel.disabled = true;
			search.disabled = true;
			for (const input of inputs.values()) input.disabled = true;
			for (const path of selected) {
				if (this.generation !== generation) break;
				const preview = this.previews.get(path);
				if (!preview) continue;
				if (this.results.get(path)?.status === "saved") continue;
				this.results.set(path, await this.mutations.applyPersonRecovery(preview));
			}
			this.busy = false;
			if (this.generation !== generation) return;
			cancel.disabled = false;
			search.disabled = false;
			for (const input of inputs.values()) input.disabled = false;
			renderPreview();
		});
		actions.append(cancel, confirm);
		this.contentEl.append(explanation, warning, search, choices, review, actions);
		search.focus();
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
