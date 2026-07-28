import { Modal, Notice, type App, type TFile } from "obsidian";
import type { PersonRecord, RelationshipRecord } from "../domain/types";
import type { AtlasMutationService } from "../mutations/atlas-mutation-service";
import {
	RelationshipFormSession,
	createRelationshipFormValues,
	editRelationshipFormValues,
	proposeRelationshipPath,
	type RelationshipFormValues,
} from "./relationship-form";

export type RelationshipModalMode =
	| { kind: "create"; prefillPersonPath?: string }
	| {
			kind: "edit";
			file: TFile;
			relationship: RelationshipRecord;
			explicitRelationshipId?: string;
	  };

let modalSequence = 0;

export class RelationshipModal extends Modal {
	private readonly values: RelationshipFormValues;
	private readonly session: RelationshipFormSession;
	private pathManuallyEdited = false;
	private errorEl: HTMLElement | undefined;
	private saveButton: HTMLButtonElement | undefined;

	constructor(
		app: App,
		private readonly mode: RelationshipModalMode,
		private readonly people: PersonRecord[],
		mutations: AtlasMutationService,
	) {
		super(app);
		if (mode.kind === "create") {
			this.values = createRelationshipFormValues(people, mode.prefillPersonPath);
			this.session = new RelationshipFormSession({ kind: "create" }, people, mutations);
		} else {
			this.values = editRelationshipFormValues(
				mode.relationship,
				mode.explicitRelationshipId,
				people,
				(target, sourcePath) => app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
			);
			this.session = new RelationshipFormSession(
				{ kind: "edit", file: mode.file, original: structuredClone(this.values) },
				people,
				mutations,
			);
		}
	}

	override onOpen(): void {
		this.titleEl.textContent = this.mode.kind === "create" ? "Create relationship" : "Edit relationship";
		this.contentEl.replaceChildren();
		this.contentEl.classList.add("people-atlas-relationship-modal");

		const document = this.contentEl.ownerDocument;
		const form = document.createElement("form");
		form.className = "people-atlas-relationship-form";
		const datalistId = `people-atlas-people-${++modalSequence}`;
		const datalist = document.createElement("datalist");
		datalist.id = datalistId;
		for (const person of [...this.people].sort(comparePeople)) {
			const option = document.createElement("option");
			option.value = person.filePath;
			option.label = `${person.name} — ${person.filePath}`;
			datalist.append(option);
		}

		const fromInput = this.addInput(form, {
			label: "Person A",
			description: "Choose an indexed person. This is the source for a directed relationship.",
			value: this.values.fromPath,
			type: "search",
			list: datalistId,
			onInput: (value) => {
				this.values.fromPath = value;
				this.refreshProposedPath();
			},
		});
		this.addInput(form, {
			label: "Person B",
			description: "Choose an indexed person.",
			value: this.values.toPath,
			type: "search",
			list: datalistId,
			onInput: (value) => {
				this.values.toPath = value;
				this.refreshProposedPath();
			},
		});
		form.append(datalist);

		const pathInput = this.addInput(form, {
			label: this.mode.kind === "create" ? "Relationship note path" : "Source note path",
			description:
				this.mode.kind === "create"
					? "Review or edit the proposed Markdown path. Existing notes are never overwritten."
					: "Moving or renaming an existing relationship is outside this editor.",
			value: this.values.path,
			readOnly: this.mode.kind === "edit",
			onInput: (value) => {
				this.values.path = value;
				this.pathManuallyEdited = true;
			},
		});
		this.addInput(form, {
			label: "Relationship ID",
			description: "Optional explicit stable identity. Leave blank to use the note path fallback.",
			value: this.values.relationshipId,
			onInput: (value) => {
				this.values.relationshipId = value;
			},
		});
		this.addInput(form, {
			label: "Relationship types",
			description: "Optional comma-separated labels.",
			value: this.values.types,
			onInput: (value) => {
				this.values.types = value;
			},
		});
		this.addSelect(form, {
			label: "Direction",
			value: this.values.direction,
			options: [
				["undirected", "Undirected"],
				["source-to-target", "Person A to Person B"],
			],
			onChange: (value) => {
				this.values.direction = value === "source-to-target" ? "source-to-target" : "undirected";
			},
		});
		this.addInput(form, {
			label: "Closeness",
			description: "Optional value from 1 to 5.",
			value: this.values.closeness,
			type: "number",
			min: "1",
			max: "5",
			onInput: (value) => {
				this.values.closeness = value;
			},
		});
		this.addInput(form, {
			label: "Since",
			description: "Optional relationship start date.",
			value: this.values.since,
			type: "date",
			onInput: (value) => {
				this.values.since = value;
			},
		});
		this.addInput(form, {
			label: "Last contact",
			description: "Optional observation date; it never changes status automatically.",
			value: this.values.lastContact,
			type: "date",
			onInput: (value) => {
				this.values.lastContact = value;
			},
		});
		this.addSelect(form, {
			label: "Status",
			value: this.values.status,
			options: [
				["", "Not set"],
				["active", "Active"],
				["dormant", "Dormant"],
				["ended", "Ended"],
			],
			onChange: (value) => {
				this.values.status = value === "active" || value === "dormant" || value === "ended" ? value : "";
			},
		});

		this.errorEl = document.createElement("div");
		this.errorEl.className = "people-atlas-form-error";
		this.errorEl.setAttribute("role", "alert");
		this.errorEl.setAttribute("aria-live", "polite");

		const actions = document.createElement("div");
		actions.className = "people-atlas-form-actions";
		const cancelButton = document.createElement("button");
		cancelButton.type = "button";
		cancelButton.textContent = "Cancel";
		cancelButton.addEventListener("click", () => this.close());
		this.saveButton = document.createElement("button");
		this.saveButton.type = "submit";
		this.saveButton.className = "mod-cta";
		this.saveButton.textContent = "Save";
		actions.append(cancelButton, this.saveButton);

		form.addEventListener("submit", (event) => {
			event.preventDefault();
			void this.submit();
		});
		form.append(this.errorEl, actions);
		this.contentEl.append(form);

		if (this.mode.kind === "create") this.refreshProposedPath(pathInput);
		fromInput.focus();
	}

	override onClose(): void {
		this.session.cancel();
		this.contentEl.replaceChildren();
		this.errorEl = undefined;
		this.saveButton = undefined;
	}

	private async submit(): Promise<void> {
		if (!this.saveButton) return;
		this.errorEl?.replaceChildren();
		this.saveButton.disabled = true;
		this.saveButton.setAttribute("aria-busy", "true");
		const result = await this.session.submit(structuredClone(this.values));
		if (result.status === "success") {
			this.close();
			if (result.createdFile) {
				try {
					await this.app.workspace.getLeaf("tab").openFile(result.createdFile);
				} catch (error) {
					new Notice(
						`The relationship was created but could not be opened: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
			return;
		}
		if (result.status === "busy" || result.status === "cancelled") return;
		if (result.status === "error" && this.errorEl) this.errorEl.textContent = result.message;
		this.saveButton.disabled = false;
		this.saveButton.removeAttribute("aria-busy");
	}

	private refreshProposedPath(pathInput?: HTMLInputElement): void {
		if (this.mode.kind !== "create" || this.pathManuallyEdited) return;
		const proposed = proposeRelationshipPath(this.values, this.people);
		this.values.path = proposed;
		const input = pathInput ?? this.contentEl.querySelector<HTMLInputElement>("[data-relationship-path]");
		if (input) input.value = proposed;
	}

	private addInput(
		form: HTMLFormElement,
		options: {
			label: string;
			description?: string;
			value: string;
			type?: string;
			list?: string;
			readOnly?: boolean;
			min?: string;
			max?: string;
			onInput(value: string): void;
		},
	): HTMLInputElement {
		const document = form.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-field-${++modalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const input = document.createElement("input");
		input.id = id;
		input.type = options.type ?? "text";
		input.value = options.value;
		input.readOnly = options.readOnly ?? false;
		input.autocomplete = "off";
		if (options.list) input.setAttribute("list", options.list);
		if (options.min) input.min = options.min;
		if (options.max) input.max = options.max;
		if (options.label.includes("path")) input.dataset.relationshipPath = "true";
		input.addEventListener("input", () => options.onInput(input.value));
		row.append(label);
		if (options.description) {
			const description = document.createElement("small");
			description.textContent = options.description;
			row.append(description);
		}
		row.append(input);
		form.append(row);
		return input;
	}

	private addSelect(
		form: HTMLFormElement,
		options: {
			label: string;
			value: string;
			options: Array<[string, string]>;
			onChange(value: string): void;
		},
	): HTMLSelectElement {
		const document = form.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-field-${++modalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const select = document.createElement("select");
		select.id = id;
		for (const [value, text] of options.options) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = text;
			option.selected = value === options.value;
			select.append(option);
		}
		select.addEventListener("change", () => options.onChange(select.value));
		row.append(label, select);
		form.append(row);
		return select;
	}
}

function comparePeople(left: PersonRecord, right: PersonRecord): number {
	return left.name.localeCompare(right.name) || left.filePath.localeCompare(right.filePath);
}
