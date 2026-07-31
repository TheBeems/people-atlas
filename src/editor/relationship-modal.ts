import { Modal, Notice, type App, type TFile } from "obsidian";
import type { SimpleRelationshipChoice } from "../domain/simple-relationships";
import type { PersonRecord, RelationshipRecord } from "../domain/types";
import type { AtlasMutationService } from "../mutations/atlas-mutation-service";
import { RelationshipPresetModal } from "../settings/relationship-preset-modal";
import type { RelationshipPreset } from "../settings/relationship-presets";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	RelationshipFormSession,
	applyRelationshipPreset,
	applySimpleRelationshipChoice,
	createRelationshipFormValues,
	detachRelationshipPreset,
	editRelationshipFormValues,
	getRelationshipFormPresentation,
	getRelationshipPresetState,
	getSimpleRelationshipChoice,
	proposeRelationshipPath,
	type RelationshipFormValues,
} from "./relationship-form";

export type RelationshipModalMode =
	| {
			kind: "create";
			fromPersonPath?: string;
			toPersonPath?: string;
			myPersonPath?: string;
	  }
	| {
			kind: "edit";
			file: TFile;
			relationship: RelationshipRecord;
			myPersonPath?: string;
	  };

export interface RelationshipTemplateCreation {
	enabled(): boolean;
	save(preset: RelationshipPreset): Promise<boolean>;
}

interface InputOptions {
	label: string;
	description: string;
	value: string;
	type?: string;
	list?: string;
	readOnly?: boolean;
	min?: string;
	max?: string;
	dataRelationshipPath?: boolean;
	onInput(value: string): void;
}

interface SelectOptions {
	label: string;
	description: string;
	value: string;
	options: Array<[string, string]>;
	onChange(value: string): void;
}

interface FieldControl<T extends HTMLInputElement | HTMLSelectElement> {
	control: T;
	label: HTMLLabelElement;
}

let modalSequence = 0;

export class RelationshipModal extends Modal {
	private readonly values: RelationshipFormValues;
	private readonly session: RelationshipFormSession;
	private pathManuallyEdited = false;
	private formEl: HTMLFormElement | undefined;
	private fromInput: HTMLInputElement | undefined;
	private fromPersonLabel: HTMLLabelElement | undefined;
	private toPersonLabel: HTMLLabelElement | undefined;
	private pathInput: HTMLInputElement | undefined;
	private relationshipIdInput: HTMLInputElement | undefined;
	private simpleRelationshipSelect: HTMLSelectElement | undefined;
	private presetSelect: HTMLSelectElement | undefined;
	private presetStatusEl: HTMLElement | undefined;
	private applyPresetButton: HTMLButtonElement | undefined;
	private templateEmptyStateEl: HTMLElement | undefined;
	private createTemplateButton: HTMLButtonElement | undefined;
	private templateCreationExplanationEl: HTMLElement | undefined;
	private typesInput: HTMLInputElement | undefined;
	private fromRoleInput: HTMLInputElement | undefined;
	private toRoleInput: HTMLInputElement | undefined;
	private fromRoleLabel: HTMLLabelElement | undefined;
	private toRoleLabel: HTMLLabelElement | undefined;
	private rolePreviewEl: HTMLElement | undefined;
	private advancedDetails: HTMLDetailsElement | undefined;
	private advancedSummary: HTMLElement | undefined;
	private errorEl: HTMLElement | undefined;
	private saveButton: HTMLButtonElement | undefined;

	constructor(
		app: App,
		private readonly mode: RelationshipModalMode,
		private readonly people: PersonRecord[],
		mutations: AtlasMutationService,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly afterClose?: () => void,
		private readonly templateCreation?: RelationshipTemplateCreation,
		getCurrentPeople: () => PersonRecord[] = () => people,
	) {
		super(app);
		if (mode.kind === "create") {
			this.values = createRelationshipFormValues(people, mode.fromPersonPath, mode.toPersonPath);
			this.session = new RelationshipFormSession({ kind: "create" }, people, mutations, getCurrentPeople);
		} else {
			this.values = editRelationshipFormValues(
				mode.relationship,
				people,
				(target, sourcePath) => app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
			);
			this.session = new RelationshipFormSession(
				{ kind: "edit", file: mode.file, original: structuredClone(this.values) },
				people,
				mutations,
				getCurrentPeople,
			);
		}
	}

	override onOpen(): void {
		this.titleEl.textContent = this.mode.kind === "create" ? "Create relationship" : "Edit relationship";
		this.contentEl.classList.add("people-atlas-relationship-modal");
		this.buildForm();
	}

	private buildForm(): void {
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const form = document.createElement("form");
		form.className = "people-atlas-relationship-form";
		this.formEl = form;

		const datalistId = `people-atlas-people-${++modalSequence}`;
		const datalist = document.createElement("datalist");
		datalist.id = datalistId;
		for (const person of [...this.people].sort(comparePeople)) {
			const option = document.createElement("option");
			option.value = person.filePath;
			option.label = `${person.name} — ${person.filePath}`;
			datalist.append(option);
		}

		const peopleGroup = this.addGroup(form, "People");
		const fromField = this.addInput(peopleGroup, {
			label: "First person",
			description: "Choose one canonical indexed person as the first selected person.",
			value: this.values.fromPath,
			type: "search",
			list: datalistId,
			onInput: (value) => {
				this.values.fromPath = value;
				this.refreshProposedPath();
				this.refreshPresentation();
			},
		});
		this.fromInput = fromField.control;
		this.fromPersonLabel = fromField.label;
		const toField = this.addInput(peopleGroup, {
			label: "Second person",
			description: "Choose one canonical indexed person as the second selected person.",
			value: this.values.toPath,
			type: "search",
			list: datalistId,
			onInput: (value) => {
				this.values.toPath = value;
				this.refreshProposedPath();
				this.refreshPresentation();
			},
		});
		this.toPersonLabel = toField.label;
		peopleGroup.append(datalist);

		const relationshipGroup = this.addGroup(form, "Relationship");
		const simpleRelationshipField = this.addSelect(relationshipGroup, {
			label: "Simple relationship",
			description:
				"Optional shortcut from the first person to the second person. It fills only both unsaved roles; Custom keeps the roles below unchanged.",
			value: getSimpleRelationshipChoice(this.values),
			options: [
				["custom", "Custom — use template or roles below"],
				["parent", "Parent of the second person"],
				["child", "Child of the second person"],
				["sibling", "Sibling of the second person"],
			],
			onChange: (value) => this.selectSimpleRelationship(value),
		});
		this.simpleRelationshipSelect = simpleRelationshipField.control;
		const presetField = this.addSelect(relationshipGroup, {
			label: "Relationship template",
			description:
				"Templates copy repeatable relationship types and roles for both selected people into this form; they are not live links.",
			value: this.values.presetId,
			options: [],
			onChange: (value) => this.selectTemplate(value),
		});
		this.presetSelect = presetField.control;

		this.templateEmptyStateEl = document.createElement("section");
		this.templateEmptyStateEl.className = "people-atlas-template-empty-state";
		const emptyHeading = document.createElement("h3");
		emptyHeading.textContent = "No relationship templates yet";
		const emptyExplanation = document.createElement("p");
		emptyExplanation.textContent =
			"Manual relationship values remain available. Templates copy repeatable types and both roles into the form; saved relationship notes keep those copied values.";
		this.templateEmptyStateEl.append(emptyHeading, emptyExplanation);

		const templateCreation = document.createElement("div");
		templateCreation.className = "people-atlas-template-creation";
		this.createTemplateButton = document.createElement("button");
		this.createTemplateButton.type = "button";
		this.createTemplateButton.textContent = "Create template";
		this.createTemplateButton.addEventListener("click", () => this.openTemplateCreator());
		this.templateCreationExplanationEl = document.createElement("small");
		this.templateCreationExplanationEl.id = `people-atlas-description-${++modalSequence}`;
		this.createTemplateButton.setAttribute("aria-describedby", this.templateCreationExplanationEl.id);
		templateCreation.append(this.createTemplateButton, this.templateCreationExplanationEl);

		this.presetStatusEl = document.createElement("p");
		this.presetStatusEl.className = "people-atlas-preset-status";
		this.presetStatusEl.setAttribute("aria-live", "polite");
		this.applyPresetButton = document.createElement("button");
		this.applyPresetButton.type = "button";
		this.applyPresetButton.textContent = "Apply latest template values";
		this.applyPresetButton.addEventListener("click", () => this.reapplyTemplate());
		const presetState = document.createElement("div");
		presetState.className = "people-atlas-preset-state";
		presetState.append(this.presetStatusEl, this.applyPresetButton);
		relationshipGroup.append(this.templateEmptyStateEl, templateCreation, presetState);

		const typesField = this.addInput(relationshipGroup, {
			label: "Relationship types",
			description: "Optional comma-separated labels. A template may copy these values into the unsaved form.",
			value: this.values.types,
			onInput: (value) => {
				this.values.types = value;
				this.refreshPresetState();
			},
		});
		this.typesInput = typesField.control;
		const fromRoleField = this.addInput(relationshipGroup, {
			label: "First person's role",
			description: "Role held by the first selected person. Define roles for both selected people or leave both empty.",
			value: this.values.fromRole,
			onInput: (value) => {
				this.values.fromRole = value;
				this.refreshSimpleRelationshipChoice();
				this.refreshPresetState();
				this.refreshPresentation();
			},
		});
		this.fromRoleInput = fromRoleField.control;
		this.fromRoleLabel = fromRoleField.label;
		const toRoleField = this.addInput(relationshipGroup, {
			label: "Second person's role",
			description: "Role held by the second selected person. It stays with that person when you save.",
			value: this.values.toRole,
			onInput: (value) => {
				this.values.toRole = value;
				this.refreshSimpleRelationshipChoice();
				this.refreshPresetState();
				this.refreshPresentation();
			},
		});
		this.toRoleInput = toRoleField.control;
		this.toRoleLabel = toRoleField.label;
		this.rolePreviewEl = document.createElement("p");
		this.rolePreviewEl.className = "people-atlas-role-preview";
		this.rolePreviewEl.setAttribute("aria-live", "polite");
		relationshipGroup.append(this.rolePreviewEl);

		const contextGroup = this.addGroup(form, "Context");
		this.addInput(contextGroup, {
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
		this.addInput(contextGroup, {
			label: "Since",
			description: "Optional relationship start date.",
			value: this.values.since,
			type: "date",
			onInput: (value) => {
				this.values.since = value;
			},
		});
		this.addInput(contextGroup, {
			label: "Last contact",
			description: "Optional observation date; it never changes status automatically.",
			value: this.values.lastContact,
			type: "date",
			onInput: (value) => {
				this.values.lastContact = value;
			},
		});
		this.addSelect(contextGroup, {
			label: "Status",
			description: "Optional user-authored relationship status. Last contact never changes it automatically.",
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

		this.advancedDetails = document.createElement("details");
		this.advancedDetails.className = "people-atlas-relationship-advanced";
		this.advancedSummary = document.createElement("summary");
		const advancedBody = document.createElement("div");
		advancedBody.className = "people-atlas-relationship-advanced-body";
		const pathField = this.addInput(advancedBody, {
			label: this.mode.kind === "create" ? "Relationship note path" : "Source note path",
			description:
				this.mode.kind === "create"
					? "Review or edit the proposed Markdown path. Existing notes are never overwritten."
					: "The current source path is read-only. Moving or renaming this relationship is outside the editor.",
			value: this.values.path,
			readOnly: this.mode.kind === "edit",
			dataRelationshipPath: true,
			onInput: (value) => {
				this.values.path = value;
				this.pathManuallyEdited = true;
				this.refreshAdvancedSummary();
			},
		});
		this.pathInput = pathField.control;
		const relationshipIdField = this.addInput(advancedBody, {
			label: "Relationship ID",
			description: "A stable relationship_id is generated when a new relationship is saved.",
			value: this.values.relationshipId,
			onInput: (value) => {
				this.values.relationshipId = value;
			},
		});
		this.relationshipIdInput = relationshipIdField.control;
		this.advancedDetails.append(this.advancedSummary, advancedBody);
		form.append(this.advancedDetails);

		this.errorEl = document.createElement("div");
		this.errorEl.id = `people-atlas-form-error-${++modalSequence}`;
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

		if (this.mode.kind === "create") this.refreshProposedPath();
		this.refreshTemplateOptions();
		this.refreshTemplateCreationAvailability();
		this.refreshSimpleRelationshipChoice();
		this.refreshPresetState();
		this.refreshPresentation();
		this.refreshAdvancedSummary();
		this.fromInput.focus();
	}

	override onClose(): void {
		this.session.cancel();
		this.contentEl.replaceChildren();
		this.formEl = undefined;
		this.fromInput = undefined;
		this.fromPersonLabel = undefined;
		this.toPersonLabel = undefined;
		this.pathInput = undefined;
		this.relationshipIdInput = undefined;
		this.simpleRelationshipSelect = undefined;
		this.presetSelect = undefined;
		this.presetStatusEl = undefined;
		this.applyPresetButton = undefined;
		this.templateEmptyStateEl = undefined;
		this.createTemplateButton = undefined;
		this.templateCreationExplanationEl = undefined;
		this.typesInput = undefined;
		this.fromRoleInput = undefined;
		this.toRoleInput = undefined;
		this.fromRoleLabel = undefined;
		this.toRoleLabel = undefined;
		this.rolePreviewEl = undefined;
		this.advancedDetails = undefined;
		this.advancedSummary = undefined;
		this.errorEl = undefined;
		this.saveButton = undefined;
		this.afterClose?.();
	}

	private async submit(): Promise<void> {
		if (!this.saveButton) return;
		this.clearAdvancedErrorAssociation();
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
		if (result.status === "error" && this.errorEl) {
			this.errorEl.textContent = result.message;
			this.associateAdvancedError(result.message);
		}
		this.saveButton.disabled = false;
		this.saveButton.removeAttribute("aria-busy");
	}

	private selectTemplate(presetId: string): void {
		if (!presetId) {
			Object.assign(this.values, detachRelationshipPreset(this.values));
		} else {
			const preset = this.getSettings().relationshipPresets.find((candidate) => candidate.id === presetId);
			if (preset) {
				Object.assign(this.values, applyRelationshipPreset(this.values, preset));
				this.refreshTemplateOwnedInputs();
			}
		}
		this.refreshTemplateOptions();
		this.refreshSimpleRelationshipChoice();
		this.refreshPresetState();
		this.refreshPresentation();
	}

	private reapplyTemplate(): void {
		const preset = this.getSettings().relationshipPresets.find((candidate) => candidate.id === this.values.presetId);
		if (preset) {
			Object.assign(this.values, applyRelationshipPreset(this.values, preset));
			this.refreshTemplateOwnedInputs();
		}
		this.refreshTemplateOptions();
		this.refreshSimpleRelationshipChoice();
		this.refreshPresetState();
		this.refreshPresentation();
	}

	private openTemplateCreator(): void {
		if (!this.templateCreation?.enabled() || !this.createTemplateButton || !this.formEl) {
			this.refreshTemplateCreationAvailability();
			return;
		}
		const document = this.contentEl.ownerDocument;
		const owningWindow = document.defaultView;
		const activeElement = document.activeElement;
		const invoker =
			owningWindow && activeElement instanceof owningWindow.HTMLElement && this.contentEl.contains(activeElement)
				? activeElement
				: this.createTemplateButton;
		const contentScrollTop = this.contentEl.scrollTop;
		const formScrollTop = this.formEl.scrollTop;
		const advancedOpen = this.advancedDetails?.open ?? false;
		const presetModal = new RelationshipPresetModal(
			this.app,
			{ kind: "create" },
			this.getSettings().relationshipPresets.map((preset) => preset.id),
			async (preset) => {
				if (!this.templateCreation?.enabled()) {
					this.refreshTemplateCreationAvailability();
					return false;
				}
				const saved = await this.templateCreation.save(preset);
				if (saved) {
					this.refreshTemplateOptions();
					this.refreshTemplateCreationAvailability();
					this.refreshPresetState();
				}
				return saved;
			},
		);
		const originalOnClose = presetModal.onClose.bind(presetModal);
		presetModal.onClose = () => {
			originalOnClose();
			document.defaultView?.setTimeout(() => {
				if (!invoker.isConnected || !this.formEl) return;
				if (this.advancedDetails) this.advancedDetails.open = advancedOpen;
				invoker.focus({ preventScroll: true });
				this.contentEl.scrollTop = contentScrollTop;
				this.formEl.scrollTop = formScrollTop;
			}, 0);
		};
		presetModal.open();
	}

	private refreshTemplateOptions(): void {
		if (!this.presetSelect || !this.templateEmptyStateEl) return;
		const document = this.presetSelect.ownerDocument;
		const presets = this.getSettings().relationshipPresets;
		const options: Array<[string, string]> = [["", "No template — enter values manually"]];
		if (this.values.presetId && !presets.some((preset) => preset.id === this.values.presetId)) {
			options.push([this.values.presetId, `Missing template — ${this.values.presetId}`]);
		}
		for (const preset of presets) options.push([preset.id, preset.name]);
		const optionElements = options.map(([value, text]) => {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = text;
			return option;
		});
		this.presetSelect.replaceChildren(...optionElements);
		this.presetSelect.value = this.values.presetId;
		this.templateEmptyStateEl.hidden = presets.length > 0;
	}

	private refreshTemplateCreationAvailability(): void {
		if (!this.createTemplateButton || !this.templateCreationExplanationEl) return;
		const enabled = this.templateCreation?.enabled() ?? false;
		this.createTemplateButton.disabled = !enabled;
		this.templateCreationExplanationEl.textContent = enabled
			? "Create a reusable template without losing this unsaved relationship. It will not be selected automatically."
			: "Template creation is unavailable because People Atlas settings are read-only or invalid. Manual relationship values remain available.";
	}

	private refreshTemplateOwnedInputs(): void {
		if (this.typesInput) this.typesInput.value = this.values.types;
		if (this.fromRoleInput) this.fromRoleInput.value = this.values.fromRole;
		if (this.toRoleInput) this.toRoleInput.value = this.values.toRole;
	}

	private selectSimpleRelationship(value: string): void {
		const choice = isSimpleRelationshipChoice(value) ? value : "custom";
		Object.assign(this.values, applySimpleRelationshipChoice(this.values, choice));
		if (this.fromRoleInput) this.fromRoleInput.value = this.values.fromRole;
		if (this.toRoleInput) this.toRoleInput.value = this.values.toRole;
		this.refreshSimpleRelationshipChoice();
		this.refreshPresetState();
		this.refreshPresentation();
	}

	private refreshSimpleRelationshipChoice(): void {
		if (this.simpleRelationshipSelect) {
			this.simpleRelationshipSelect.value = getSimpleRelationshipChoice(this.values);
		}
	}

	private refreshProposedPath(): void {
		if (this.mode.kind !== "create" || this.pathManuallyEdited) return;
		const proposed = proposeRelationshipPath(this.values, this.people);
		this.values.path = proposed;
		if (this.pathInput) this.pathInput.value = proposed;
		this.refreshAdvancedSummary();
	}

	private refreshPresetState(): void {
		if (!this.presetStatusEl || !this.applyPresetButton) return;
		const state = getRelationshipPresetState(this.values, this.getSettings().relationshipPresets);
		const messages: Record<typeof state, string> = {
			unlinked: "No template is selected. Types and roles are stored directly on this relationship note when you save.",
			"up-to-date": "The unsaved types and roles match the values copied from the selected template.",
			modified:
				"The unsaved types or roles differ from the selected template. Apply its latest values only if you want to replace them.",
			missing: `Template “${this.values.presetId}” is unavailable. Its copied types and roles remain editable.`,
		};
		this.presetStatusEl.textContent = messages[state];
		this.applyPresetButton.hidden = state === "unlinked" || state === "missing";
	}

	private refreshPresentation(): void {
		const presentation = getRelationshipFormPresentation(this.values, this.people, this.mode.myPersonPath);
		if (this.fromPersonLabel) this.fromPersonLabel.textContent = presentation.fromPersonLabel;
		if (this.toPersonLabel) this.toPersonLabel.textContent = presentation.toPersonLabel;
		if (this.fromRoleLabel) this.fromRoleLabel.textContent = presentation.fromRoleLabel;
		if (this.toRoleLabel) this.toRoleLabel.textContent = presentation.toRoleLabel;
		if (this.rolePreviewEl) {
			this.rolePreviewEl.textContent =
				presentation.rolePreview ??
				"Choose both people and define both roles to review how each selected person maps to a role.";
			this.rolePreviewEl.classList.toggle("is-placeholder", !presentation.rolePreview);
		}
	}

	private refreshAdvancedSummary(): void {
		if (!this.advancedSummary) return;
		const path = this.values.path.trim() || "not set";
		const pathKind = this.mode.kind === "create" ? "Destination" : "Source";
		this.advancedSummary.textContent = `Advanced — ${pathKind}: ${path}`;
	}

	private associateAdvancedError(message: string): void {
		if (!this.errorEl || !this.advancedDetails) return;
		const hasIdentityError = /relationship(?:_| )?id|relationship identity/i.test(message);
		const hasPathError = /path|destination|note already exists|already exists at|safe markdown relationship/i.test(
			message,
		);
		if (!hasIdentityError && !hasPathError) return;
		this.advancedDetails.open = true;
		if (hasIdentityError && this.relationshipIdInput) {
			appendDescribedBy(this.relationshipIdInput, this.errorEl.id);
			this.relationshipIdInput.setAttribute("aria-invalid", "true");
		}
		if (hasPathError && this.pathInput) {
			appendDescribedBy(this.pathInput, this.errorEl.id);
			this.pathInput.setAttribute("aria-invalid", "true");
		}
		(hasIdentityError ? this.relationshipIdInput : this.pathInput)?.focus();
	}

	private clearAdvancedErrorAssociation(): void {
		if (!this.errorEl) return;
		for (const input of [this.pathInput, this.relationshipIdInput]) {
			if (!input) continue;
			removeDescribedBy(input, this.errorEl.id);
			input.removeAttribute("aria-invalid");
		}
	}

	private addGroup(form: HTMLFormElement, title: string): HTMLFieldSetElement {
		const fieldset = form.ownerDocument.createElement("fieldset");
		fieldset.className = "people-atlas-relationship-section";
		const legend = form.ownerDocument.createElement("legend");
		legend.textContent = title;
		fieldset.append(legend);
		form.append(fieldset);
		return fieldset;
	}

	private addInput(container: HTMLElement, options: InputOptions): FieldControl<HTMLInputElement> {
		const document = container.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-field-${++modalSequence}`;
		const descriptionId = `people-atlas-description-${++modalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = document.createElement("small");
		description.id = descriptionId;
		description.textContent = options.description;
		const input = document.createElement("input");
		input.id = id;
		input.type = options.type ?? "text";
		input.value = options.value;
		input.readOnly = options.readOnly ?? false;
		input.autocomplete = "off";
		input.setAttribute("aria-describedby", descriptionId);
		if (options.list) input.setAttribute("list", options.list);
		if (options.min) input.min = options.min;
		if (options.max) input.max = options.max;
		if (options.dataRelationshipPath) input.dataset.relationshipPath = "true";
		input.addEventListener("input", () => options.onInput(input.value));
		row.append(label, description, input);
		container.append(row);
		return { control: input, label };
	}

	private addSelect(container: HTMLElement, options: SelectOptions): FieldControl<HTMLSelectElement> {
		const document = container.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-field-${++modalSequence}`;
		const descriptionId = `people-atlas-description-${++modalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = document.createElement("small");
		description.id = descriptionId;
		description.textContent = options.description;
		const select = document.createElement("select");
		select.id = id;
		select.setAttribute("aria-describedby", descriptionId);
		for (const [value, text] of options.options) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = text;
			option.selected = value === options.value;
			select.append(option);
		}
		select.addEventListener("change", () => options.onChange(select.value));
		row.append(label, description, select);
		container.append(row);
		return { control: select, label };
	}
}

function comparePeople(left: PersonRecord, right: PersonRecord): number {
	return left.name.localeCompare(right.name) || left.filePath.localeCompare(right.filePath);
}

function isSimpleRelationshipChoice(value: string): value is SimpleRelationshipChoice {
	return value === "custom" || value === "parent" || value === "child" || value === "sibling";
}

function appendDescribedBy(control: HTMLElement, id: string): void {
	const ids = new Set((control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
	ids.add(id);
	control.setAttribute("aria-describedby", [...ids].join(" "));
}

function removeDescribedBy(control: HTMLElement, id: string): void {
	const ids = (control.getAttribute("aria-describedby") ?? "")
		.split(/\s+/)
		.filter((candidate) => candidate && candidate !== id);
	if (ids.length > 0) control.setAttribute("aria-describedby", ids.join(" "));
	else control.removeAttribute("aria-describedby");
}
