import { Modal, Notice, type App, type TFile } from "obsidian";
import type { PersonRecord } from "../domain/types";
import type { AtlasMutationService } from "../mutations/atlas-mutation-service";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	PersonFormSession,
	addPersonContact,
	createPersonFormValues,
	editPersonFormValues,
	proposeCreatePersonPath,
	proposePersonRenamePath,
	type PersonFormValues,
} from "./person-form";

export type PersonModalMode =
	| { kind: "create" }
	| {
			kind: "edit";
			file: TFile;
			person: PersonRecord;
			explicitPersonId?: string | undefined;
			rawPhoto?: string | undefined;
	  };

let personModalSequence = 0;

export class PersonModal extends Modal {
	private readonly values: PersonFormValues;
	private readonly session: PersonFormSession;
	private errorEl: HTMLElement | undefined;
	private saveButton: HTMLButtonElement | undefined;

	constructor(
		app: App,
		private readonly mode: PersonModalMode,
		private readonly people: PersonRecord[],
		mutations: AtlasMutationService,
		private readonly getSettings: () => PeopleAtlasSettings,
	) {
		super(app);
		if (mode.kind === "create") {
			this.values = createPersonFormValues(getSettings().peopleFolder);
			this.session = new PersonFormSession({ kind: "create" }, mutations);
		} else {
			this.values = editPersonFormValues(
				mode.person,
				mode.explicitPersonId,
				mode.rawPhoto,
				people,
				(target, sourcePath) => app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
			);
			this.session = new PersonFormSession(
				{ kind: "edit", file: mode.file, original: structuredClone(this.values) },
				mutations,
			);
		}
	}

	override onOpen(): void {
		this.contentEl.classList.add("people-atlas-person-modal");
		this.renderForm();
	}

	override onClose(): void {
		this.session.cancel();
		this.contentEl.replaceChildren();
		this.errorEl = undefined;
		this.saveButton = undefined;
	}

	private renderForm(focusContact = false): void {
		this.titleEl.textContent = this.mode.kind === "create" ? "Create person" : "Edit person";
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const form = document.createElement("form");
		form.className = "people-atlas-person-form";

		const nameInput = this.addInput(form, {
			label: "Name",
			description:
				this.mode.kind === "create"
					? "Required display name. The new note filename is derived from this value."
					: "Changing the display name also proposes a filename change in the current folder.",
			value: this.values.name,
			onInput: (value) => {
				this.values.name = value;
				this.refreshPathPreview();
			},
		});
		const pathInput = this.addInput(form, {
			label: this.mode.kind === "create" ? "Person note path" : "Current person note path",
			description:
				this.mode.kind === "create"
					? "The configured People folder and a safe filename determine this path."
					: "The note stays in this folder. A changed filename requires a separate confirmation.",
			value: this.values.path,
			readOnly: true,
		});
		pathInput.dataset.personPath = "true";
		this.addInput(form, {
			label: "Person ID",
			description:
				this.values.personIdSource === "automatic"
					? "A stable person_id is generated when the person is saved."
					: this.values.personIdSource === "path-fallback"
						? "This legacy person currently uses its note path as identity. A rename stores this value as a stable ID."
						: "Stable identity managed by People Atlas.",
			value: this.values.personIdSource === "automatic" ? "Assigned automatically on save" : this.values.personId,
			readOnly: true,
		});
		this.addTextarea(form, {
			label: "Aliases",
			description: "Optional alternative names, one per line.",
			value: this.values.aliases,
			onInput: (value) => {
				this.values.aliases = value;
			},
		});
		this.addTextarea(form, {
			label: "Organisations",
			description: "Optional organisations, one per line.",
			value: this.values.organisations,
			onInput: (value) => {
				this.values.organisations = value;
			},
		});
		this.addInput(form, {
			label: "Photo",
			description: "Optional image wikilink or vault path.",
			value: this.values.photo,
			onInput: (value) => {
				this.values.photo = value;
			},
		});

		const contacts = document.createElement("fieldset");
		contacts.className = "people-atlas-person-contacts";
		const legend = document.createElement("legend");
		legend.textContent = "Contacts";
		const description = document.createElement("small");
		description.textContent =
			"Add indexed people without guessing identity. Existing unresolved references remain until explicitly removed.";
		const contactList = document.createElement("ul");
		contactList.className = "people-atlas-person-contact-list";
		for (const [index, contact] of this.values.contacts.entries()) {
			const item = document.createElement("li");
			const resolved = contact.resolvedPath
				? this.people.find((person) => person.filePath === contact.resolvedPath)
				: undefined;
			const text = document.createElement("span");
			text.textContent = resolved
				? `${resolved.name} — ${resolved.filePath}`
				: `Unresolved or ambiguous — ${contact.raw}`;
			const remove = document.createElement("button");
			remove.type = "button";
			remove.textContent = "Remove";
			remove.setAttribute("aria-label", `Remove contact ${resolved?.name ?? contact.raw}`);
			remove.addEventListener("click", () => {
				this.values.contacts = this.values.contacts.filter((_, candidateIndex) => candidateIndex !== index);
				this.renderForm(true);
			});
			item.append(text, remove);
			contactList.append(item);
		}

		const contactControls = document.createElement("div");
		contactControls.className = "people-atlas-person-contact-controls";
		const contactInput = document.createElement("input");
		const contactInputId = `people-atlas-person-contact-${++personModalSequence}`;
		const contactDatalistId = `${contactInputId}-choices`;
		contactInput.id = contactInputId;
		contactInput.type = "search";
		contactInput.autocomplete = "off";
		contactInput.setAttribute("list", contactDatalistId);
		contactInput.placeholder = "Choose an indexed person";
		const datalist = document.createElement("datalist");
		datalist.id = contactDatalistId;
		for (const person of [...this.people].sort(comparePeople)) {
			if (this.mode.kind === "edit" && person.filePath === this.mode.file.path) continue;
			const option = document.createElement("option");
			option.value = person.filePath;
			option.label = `${person.name} — ${person.filePath}`;
			datalist.append(option);
		}
		const addContact = document.createElement("button");
		addContact.type = "button";
		addContact.textContent = "Add contact";
		addContact.addEventListener("click", () => {
			const result = addPersonContact(
				this.values.contacts,
				contactInput.value,
				this.people,
				this.mode.kind === "edit" ? this.mode.file.path : undefined,
			);
			if (result.error) {
				this.showError(result.error);
				contactInput.focus();
				return;
			}
			this.values.contacts = result.contacts;
			this.renderForm(true);
		});
		contactControls.append(contactInput, datalist, addContact);
		contacts.append(legend, description, contactList, contactControls);
		form.append(contacts);

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
			void this.submit(false);
		});
		form.append(this.errorEl, actions);
		this.contentEl.append(form);
		this.refreshPathPreview();
		if (focusContact) contactInput.focus();
		else nameInput.focus();
	}

	private renderRenameConfirmation(currentPath: string, targetPath: string, errorMessage?: string): void {
		this.titleEl.textContent = "Confirm person rename";
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const panel = document.createElement("div");
		panel.className = "people-atlas-person-rename-confirmation";
		const explanation = document.createElement("p");
		explanation.textContent =
			"Saving this name also renames the Markdown note. Obsidian updates links according to the vault setting for automatic link updates.";
		const paths = document.createElement("dl");
		const fromLabel = document.createElement("dt");
		fromLabel.textContent = "Current path";
		const fromValue = document.createElement("dd");
		fromValue.textContent = currentPath;
		const toLabel = document.createElement("dt");
		toLabel.textContent = "New path";
		const toValue = document.createElement("dd");
		toValue.textContent = targetPath;
		paths.append(fromLabel, fromValue, toLabel, toValue);
		this.errorEl = document.createElement("div");
		this.errorEl.className = "people-atlas-form-error";
		this.errorEl.setAttribute("role", "alert");
		this.errorEl.setAttribute("aria-live", "polite");
		if (errorMessage) this.errorEl.textContent = errorMessage;

		const actions = document.createElement("div");
		actions.className = "people-atlas-form-actions";
		const back = document.createElement("button");
		back.type = "button";
		back.textContent = "Back";
		back.addEventListener("click", () => this.renderForm());
		this.saveButton = document.createElement("button");
		this.saveButton.type = "button";
		this.saveButton.className = "mod-cta";
		this.saveButton.textContent = errorMessage ? "Retry rename and save" : "Rename and save";
		this.saveButton.addEventListener("click", () => void this.submit(true));
		actions.append(back, this.saveButton);
		panel.append(explanation, paths, this.errorEl, actions);
		this.contentEl.append(panel);
		this.saveButton.focus();
	}

	private async submit(renameConfirmed: boolean): Promise<void> {
		if (!this.saveButton) return;
		this.errorEl?.replaceChildren();
		this.saveButton.disabled = true;
		this.saveButton.setAttribute("aria-busy", "true");
		const result = await this.session.submit(structuredClone(this.values), renameConfirmed);
		if (result.status === "confirmation-required") {
			this.renderRenameConfirmation(result.currentPath, result.targetPath);
			return;
		}
		if (result.status === "success") {
			this.close();
			if (result.created) {
				try {
					await this.app.workspace.getLeaf("tab").openFile(result.file);
				} catch (error) {
					new Notice(
						`The person was created but could not be opened: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
			return;
		}
		if (result.status === "busy" || result.status === "cancelled") return;
		if (renameConfirmed) {
			this.renderRenameConfirmation(
				result.currentPath ?? (this.mode.kind === "edit" ? this.mode.file.path : this.values.path),
				result.targetPath ??
					(this.mode.kind === "edit"
						? proposePersonRenamePath(this.mode.file.path, this.values.name)
						: this.values.path),
				result.message,
			);
			return;
		}
		this.showError(result.message);
		this.saveButton.disabled = false;
		this.saveButton.removeAttribute("aria-busy");
	}

	private refreshPathPreview(): void {
		const input = this.contentEl.querySelector<HTMLInputElement>("[data-person-path]");
		if (!input) return;
		this.values.path =
			this.mode.kind === "create"
				? proposeCreatePersonPath(this.values.name, this.getSettings().peopleFolder)
				: this.mode.file.path;
		const proposedRename =
			this.mode.kind === "edit" ? proposePersonRenamePath(this.mode.file.path, this.values.name) : "";
		input.value =
			this.mode.kind === "edit" && proposedRename && proposedRename !== this.mode.file.path
				? `${this.mode.file.path} → ${proposedRename}`
				: this.values.path;
	}

	private showError(message: string): void {
		if (this.errorEl) this.errorEl.textContent = message;
	}

	private addInput(
		form: HTMLFormElement,
		options: {
			label: string;
			description?: string | undefined;
			value: string;
			readOnly?: boolean | undefined;
			onInput?(value: string): void;
		},
	): HTMLInputElement {
		const document = form.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-person-field-${++personModalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const input = document.createElement("input");
		input.id = id;
		input.type = "text";
		input.value = options.value;
		input.readOnly = options.readOnly ?? false;
		input.autocomplete = "off";
		if (options.onInput) input.addEventListener("input", () => options.onInput?.(input.value));
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

	private addTextarea(
		form: HTMLFormElement,
		options: {
			label: string;
			description: string;
			value: string;
			onInput(value: string): void;
		},
	): HTMLTextAreaElement {
		const document = form.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-person-field-${++personModalSequence}`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = document.createElement("small");
		description.textContent = options.description;
		const textarea = document.createElement("textarea");
		textarea.id = id;
		textarea.value = options.value;
		textarea.rows = 3;
		textarea.addEventListener("input", () => options.onInput(textarea.value));
		row.append(label, description, textarea);
		form.append(row);
		return textarea;
	}
}

function comparePeople(left: PersonRecord, right: PersonRecord): number {
	return left.name.localeCompare(right.name) || left.filePath.localeCompare(right.filePath);
}
