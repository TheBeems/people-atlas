import { Modal, type App } from "obsidian";
import { relationshipPresetSlug, validateRelationshipPreset, type RelationshipPreset } from "./relationship-presets";

export type RelationshipPresetModalMode = { kind: "create" } | { kind: "edit"; preset: RelationshipPreset };

interface RelationshipPresetDraft {
	id: string;
	name: string;
	types: string;
	direction: RelationshipPreset["direction"];
	fromRole: string;
	toRole: string;
}

let presetModalSequence = 0;

export class RelationshipPresetModal extends Modal {
	private readonly draft: RelationshipPresetDraft;
	private idManuallyEdited = false;
	private errorEl: HTMLElement | undefined;
	private saveButton: HTMLButtonElement | undefined;

	constructor(
		app: App,
		private readonly mode: RelationshipPresetModalMode,
		private readonly existingIds: string[],
		private readonly onSave: (preset: RelationshipPreset) => Promise<boolean>,
	) {
		super(app);
		this.draft =
			mode.kind === "edit"
				? {
						id: mode.preset.id,
						name: mode.preset.name,
						types: mode.preset.types.join(", "),
						direction: mode.preset.direction,
						fromRole: mode.preset.fromRole,
						toRole: mode.preset.toRole,
					}
				: { id: "", name: "", types: "", direction: "undirected", fromRole: "", toRole: "" };
	}

	override onOpen(): void {
		this.titleEl.textContent = this.mode.kind === "create" ? "Add relationship preset" : "Edit relationship preset";
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const form = document.createElement("form");
		form.className = "people-atlas-relationship-form";
		const idInput = this.addInput(form, "Preset ID", this.draft.id, (value) => {
			this.draft.id = value;
			this.idManuallyEdited = true;
		});
		idInput.readOnly = this.mode.kind === "edit";
		const nameInput = this.addInput(form, "Name", this.draft.name, (value) => {
			this.draft.name = value;
			if (this.mode.kind === "create" && !this.idManuallyEdited) {
				this.draft.id = relationshipPresetSlug(value);
				idInput.value = this.draft.id;
			}
		});
		this.addInput(form, "Relationship types", this.draft.types, (value) => {
			this.draft.types = value;
		});
		this.addInput(form, "Person A role", this.draft.fromRole, (value) => {
			this.draft.fromRole = value;
		});
		this.addInput(form, "Person B role", this.draft.toRole, (value) => {
			this.draft.toRole = value;
		});
		this.addSelect(form);
		this.errorEl = document.createElement("div");
		this.errorEl.className = "people-atlas-form-error";
		this.errorEl.setAttribute("role", "alert");
		this.errorEl.setAttribute("aria-live", "polite");
		const actions = document.createElement("div");
		actions.className = "people-atlas-form-actions";
		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.textContent = "Cancel";
		cancel.addEventListener("click", () => this.close());
		this.saveButton = document.createElement("button");
		this.saveButton.type = "submit";
		this.saveButton.className = "mod-cta";
		this.saveButton.textContent = "Save";
		actions.append(cancel, this.saveButton);
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			void this.submit();
		});
		form.append(this.errorEl, actions);
		this.contentEl.append(form);
		nameInput.focus();
	}

	override onClose(): void {
		this.contentEl.replaceChildren();
		this.errorEl = undefined;
		this.saveButton = undefined;
	}

	private async submit(): Promise<void> {
		if (!this.saveButton || !this.errorEl) return;
		this.errorEl.replaceChildren();
		const preset = this.toPreset();
		const errors = validateRelationshipPreset(preset, this.existingIds);
		if (errors.length > 0) {
			this.errorEl.textContent = errors.join(" ");
			return;
		}
		this.saveButton.disabled = true;
		this.saveButton.setAttribute("aria-busy", "true");
		try {
			if (await this.onSave(preset)) this.close();
		} finally {
			if (this.saveButton) {
				this.saveButton.disabled = false;
				this.saveButton.removeAttribute("aria-busy");
			}
		}
	}

	private toPreset(): RelationshipPreset {
		return {
			id: this.draft.id.trim(),
			name: this.draft.name.trim(),
			types: this.draft.types
				.split(",")
				.map((type) => type.trim())
				.filter(Boolean),
			direction: this.draft.direction,
			fromRole: this.draft.fromRole.trim(),
			toRole: this.draft.toRole.trim(),
		};
	}

	private addInput(
		form: HTMLFormElement,
		labelText: string,
		value: string,
		onInput: (value: string) => void,
	): HTMLInputElement {
		const document = form.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-preset-${++presetModalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = labelText;
		const input = document.createElement("input");
		input.id = id;
		input.value = value;
		input.autocomplete = "off";
		input.addEventListener("input", () => onInput(input.value));
		row.append(label, input);
		form.append(row);
		return input;
	}

	private addSelect(form: HTMLFormElement): void {
		const document = form.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-preset-${++presetModalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = "Direction";
		const select = document.createElement("select");
		select.id = id;
		for (const [value, text] of [
			["undirected", "Undirected"],
			["source-to-target", "Person A to Person B"],
		] as const) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = text;
			option.selected = value === this.draft.direction;
			select.append(option);
		}
		select.addEventListener("change", () => {
			this.draft.direction = select.value === "source-to-target" ? "source-to-target" : "undirected";
		});
		row.append(label, select);
		form.append(row);
	}
}
