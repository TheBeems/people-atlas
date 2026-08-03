import { Modal, Notice, type App, type TFile } from "obsidian";
import type { ContactMomentRecord, PersonRecord, RelationshipRecord } from "../domain/types";
import type { AtlasMutationService } from "../mutations/atlas-mutation-service";
import type { ContactMomentEditSourceBaseline } from "../mutations/contact-moment";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	ContactMomentFormSession,
	createContactMomentFormValues,
	editContactMomentFormValues,
	matchingContactMomentRelationships,
	proposeContactMomentPath,
	type ContactMomentFormContext,
	type ContactMomentFormValues,
} from "./contact-moment-form";

export type ContactMomentModalMode =
	| {
			kind: "create";
			prefilledPersonPath?: string | undefined;
			prefilledRelationshipPath?: string | undefined;
			occurredOn?: string | undefined;
			contactMomentId?: string | undefined;
	  }
	| {
			kind: "edit";
			file: TFile;
			record: ContactMomentRecord;
			sourceBaseline: ContactMomentEditSourceBaseline;
	  };

interface InputOptions {
	label: string;
	description: string;
	value: string;
	type?: string;
	readOnly?: boolean;
	list?: string;
	onInput(value: string): void;
}

interface SelectOptions {
	label: string;
	description: string;
	value: string;
	options: Array<{ value: string; label: string; disabled?: boolean }>;
	onChange(value: string): void;
}

let contactMomentModalSequence = 0;

export class ContactMomentModal extends Modal {
	private readonly values: ContactMomentFormValues;
	private readonly session: ContactMomentFormSession;
	private pathManuallyEdited = false;
	private peopleSelect: HTMLSelectElement | undefined;
	private relationshipSelect: HTMLSelectElement | undefined;
	private pathInput: HTMLInputElement | undefined;
	private followUpStatusSelect: HTMLSelectElement | undefined;
	private advanceContainer: HTMLElement | undefined;
	private advanceCheckbox: HTMLInputElement | undefined;
	private errorEl: HTMLElement | undefined;
	private resultEl: HTMLElement | undefined;
	private saveButton: HTMLButtonElement | undefined;
	private retryButton: HTMLButtonElement | undefined;
	private partialCreatedFile: TFile | undefined;

	constructor(
		app: App,
		private readonly mode: ContactMomentModalMode,
		private readonly context: ContactMomentFormContext,
		mutations: AtlasMutationService,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly afterClose?: () => void,
		getCurrentContext: () => ContactMomentFormContext = () => context,
	) {
		super(app);
		if (mode.kind === "create") {
			const contactMomentId = mode.contactMomentId?.trim() || `contact-${crypto.randomUUID()}`;
			this.values = createContactMomentFormValues({
				peopleRootFolder: getSettings().peopleRootFolder,
				today: mode.occurredOn ?? localToday(),
				contactMomentId,
				people: context.people,
				...(mode.prefilledPersonPath ? { prefilledPersonPaths: [mode.prefilledPersonPath] } : {}),
			});
			if (
				mode.prefilledRelationshipPath &&
				matchingContactMomentRelationships(this.values.peoplePaths, context).some(
					(relationship) => relationship.filePath === mode.prefilledRelationshipPath,
				)
			) {
				this.values.relationshipPath = mode.prefilledRelationshipPath;
			}
			this.session = new ContactMomentFormSession({ kind: "create" }, context, mutations, getCurrentContext);
		} else {
			this.values = editContactMomentFormValues(mode.record, context);
			this.session = new ContactMomentFormSession(
				{
					kind: "edit",
					file: mode.file,
					original: structuredClone(this.values),
					expectedContactMomentId: mode.record.id,
					sourceBaseline: mode.sourceBaseline,
				},
				context,
				mutations,
				getCurrentContext,
			);
		}
	}

	override onOpen(): void {
		this.titleEl.textContent = this.mode.kind === "create" ? "Log contact" : "Edit contact moment";
		this.contentEl.classList.add("people-atlas-contact-moment-modal");
		this.buildForm();
	}

	override onClose(): void {
		this.session.cancel();
		this.contentEl.replaceChildren();
		this.peopleSelect = undefined;
		this.relationshipSelect = undefined;
		this.pathInput = undefined;
		this.followUpStatusSelect = undefined;
		this.advanceContainer = undefined;
		this.advanceCheckbox = undefined;
		this.errorEl = undefined;
		this.resultEl = undefined;
		this.saveButton = undefined;
		this.retryButton = undefined;
		this.partialCreatedFile = undefined;
		this.afterClose?.();
	}

	private buildForm(): void {
		this.contentEl.replaceChildren();
		const document = this.contentEl.ownerDocument;
		const form = document.createElement("form");
		form.className = "people-atlas-contact-moment-form";

		const peopleGroup = this.addGroup(form, "People");
		const peopleDescriptionId = `people-atlas-contact-moment-people-description-${++contactMomentModalSequence}`;
		const peopleLabel = document.createElement("label");
		const peopleId = `people-atlas-contact-moment-people-${++contactMomentModalSequence}`;
		peopleLabel.htmlFor = peopleId;
		peopleLabel.textContent = "People";
		const peopleDescription = document.createElement("small");
		peopleDescription.id = peopleDescriptionId;
		peopleDescription.textContent =
			"Choose one or more canonical people. Paths and stable IDs—not display names—are stored as identity.";
		this.peopleSelect = document.createElement("select");
		this.peopleSelect.id = peopleId;
		this.peopleSelect.multiple = true;
		this.peopleSelect.size = Math.min(8, Math.max(3, this.context.people.length));
		this.peopleSelect.required = true;
		this.peopleSelect.setAttribute("aria-describedby", peopleDescriptionId);
		for (const person of [...this.context.people].sort(comparePeople)) {
			const option = document.createElement("option");
			option.value = person.filePath;
			option.textContent = `${person.name} — ${person.filePath}`;
			option.selected = this.values.peoplePaths.includes(person.filePath);
			this.peopleSelect.append(option);
		}
		this.peopleSelect.addEventListener("change", () => {
			this.values.peoplePaths = Array.from(this.peopleSelect?.selectedOptions ?? [], (option) => option.value);
			this.refreshRelationshipOptions();
			this.refreshProposedPath();
		});
		const peopleField = document.createElement("div");
		peopleField.className = "people-atlas-form-field";
		peopleField.append(peopleLabel, peopleDescription, this.peopleSelect);
		peopleGroup.append(peopleField);

		this.relationshipSelect = this.addSelect(peopleGroup, {
			label: "Relationship",
			description:
				"Optional. Only canonical relationship notes sharing at least one selected person can advance last contact.",
			value: this.values.relationshipPath,
			options: [],
			onChange: (value) => {
				this.values.relationshipPath = value;
				this.values.advanceRelationshipLastContact = false;
				this.refreshRelationshipOptions();
			},
		});

		const momentGroup = this.addGroup(form, "Contact moment");
		this.addInput(momentGroup, {
			label: "Occurred on",
			description: "Required local calendar date in YYYY-MM-DD form.",
			value: this.values.occurredOn,
			type: "date",
			onInput: (value) => {
				this.values.occurredOn = value;
				this.refreshProposedPath();
			},
		});
		const channelListId = `people-atlas-contact-moment-channels-${++contactMomentModalSequence}`;
		const channelList = document.createElement("datalist");
		channelList.id = channelListId;
		for (const channel of ["call", "message", "email", "meeting"]) {
			const option = document.createElement("option");
			option.value = channel;
			channelList.append(option);
		}
		this.addInput(momentGroup, {
			label: "Channel",
			description: "Optional user-authored channel. Suggestions never infer a value.",
			value: this.values.channel,
			list: channelListId,
			onInput: (value) => {
				this.values.channel = value;
			},
		});
		momentGroup.append(channelList);
		this.addTextarea(momentGroup, {
			label: "Summary",
			description: "Optional short summary. The Markdown body remains free content.",
			value: this.values.summary,
			onInput: (value) => {
				this.values.summary = value;
			},
		});

		const followUpGroup = this.addGroup(form, "Follow-up");
		this.addInput(followUpGroup, {
			label: "Follow-up on",
			description: "Optional local calendar date.",
			value: this.values.followUpOn,
			type: "date",
			onInput: (value) => {
				this.values.followUpOn = value;
				if (value && !this.values.followUpStatus) {
					this.values.followUpStatus = "open";
					if (this.followUpStatusSelect) this.followUpStatusSelect.value = "open";
				}
				if (!value) {
					this.values.followUpStatus = "";
					if (this.followUpStatusSelect) this.followUpStatusSelect.value = "";
				}
			},
		});
		this.followUpStatusSelect = this.addSelect(followUpGroup, {
			label: "Follow-up status",
			description: "Open, done and dismissed apply only to this follow-up and never change relationship status.",
			value: this.values.followUpStatus,
			options: [
				{ value: "", label: "Not set" },
				{ value: "open", label: "Open" },
				{ value: "done", label: "Done" },
				{ value: "dismissed", label: "Dismissed" },
			],
			onChange: (value) => {
				this.values.followUpStatus = value === "open" || value === "done" || value === "dismissed" ? value : "";
			},
		});

		this.advanceContainer = document.createElement("div");
		this.advanceContainer.className = "people-atlas-contact-moment-advance";
		this.advanceCheckbox = document.createElement("input");
		this.advanceCheckbox.type = "checkbox";
		this.advanceCheckbox.id = `people-atlas-contact-moment-advance-${++contactMomentModalSequence}`;
		this.advanceCheckbox.checked = false;
		this.advanceCheckbox.addEventListener("change", () => {
			this.values.advanceRelationshipLastContact = this.advanceCheckbox?.checked ?? false;
		});
		const advanceLabel = document.createElement("label");
		advanceLabel.htmlFor = this.advanceCheckbox.id;
		advanceLabel.textContent = "Advance linked relationship's last contact to this date";
		this.advanceContainer.append(this.advanceCheckbox, advanceLabel);
		form.append(this.advanceContainer);

		const advanced = document.createElement("details");
		advanced.className = "people-atlas-contact-moment-advanced";
		const advancedSummary = document.createElement("summary");
		advancedSummary.textContent = "Advanced";
		const advancedBody = document.createElement("div");
		advancedBody.className = "people-atlas-contact-moment-advanced-body";
		this.pathInput = this.addInput(advancedBody, {
			label: this.mode.kind === "create" ? "Contact moment note path" : "Source note path",
			description:
				this.mode.kind === "create"
					? "Review or edit the proposed Markdown path. Existing notes are never overwritten."
					: "The current source path is read-only; moving or renaming is outside this editor.",
			value: this.values.path,
			readOnly: this.mode.kind === "edit",
			onInput: (value) => {
				this.values.path = value;
				this.pathManuallyEdited = true;
			},
		});
		this.addInput(advancedBody, {
			label: "Contact moment ID",
			description: "Stable explicit identity assigned before the note is written.",
			value: this.values.contactMomentId,
			readOnly: true,
			onInput: () => undefined,
		});
		advanced.append(advancedSummary, advancedBody);
		form.append(advanced);

		this.errorEl = document.createElement("div");
		this.errorEl.className = "people-atlas-form-error";
		this.errorEl.setAttribute("role", "alert");
		this.errorEl.setAttribute("aria-live", "assertive");
		this.resultEl = document.createElement("p");
		this.resultEl.className = "people-atlas-contact-moment-result";
		this.resultEl.setAttribute("role", "status");
		this.resultEl.setAttribute("aria-live", "polite");
		this.resultEl.hidden = true;

		const actions = document.createElement("div");
		actions.className = "people-atlas-form-actions";
		const cancelButton = document.createElement("button");
		cancelButton.type = "button";
		cancelButton.textContent = "Cancel";
		cancelButton.addEventListener("click", () => this.close());
		this.retryButton = document.createElement("button");
		this.retryButton.type = "button";
		this.retryButton.textContent = "Retry relationship update";
		this.retryButton.hidden = true;
		this.retryButton.addEventListener("click", () => void this.retryRelationship());
		this.saveButton = document.createElement("button");
		this.saveButton.type = "submit";
		this.saveButton.className = "mod-cta";
		this.saveButton.textContent = "Save";
		actions.append(cancelButton, this.retryButton, this.saveButton);
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			void this.submit();
		});
		form.append(this.errorEl, this.resultEl, actions);
		this.contentEl.append(form);

		this.refreshRelationshipOptions();
		this.refreshProposedPath();
		this.peopleSelect.focus();
	}

	private async submit(): Promise<void> {
		if (!this.saveButton) return;
		this.errorEl?.replaceChildren();
		this.setBusy(this.saveButton, true);
		const result = await this.session.submit(structuredClone(this.values));
		if (result.status === "success") {
			this.close();
			if (result.relationship.status !== "not-requested") new Notice(result.relationship.message);
			if (result.created) await this.openCreatedFile(result.file);
			return;
		}
		if (result.status === "partial-success") {
			this.partialCreatedFile = result.file;
			if (this.resultEl) {
				this.resultEl.hidden = false;
				this.resultEl.textContent =
					`Contact moment saved at “${result.momentPath}”, but relationship “${result.relationshipPath}” ` +
					`was not updated: ${result.reason}`;
			}
			if (this.retryButton) this.retryButton.hidden = false;
			for (const control of Array.from(
				this.contentEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
					"input, select, textarea",
				),
			)) {
				control.disabled = true;
			}
			this.saveButton.disabled = true;
			this.saveButton.removeAttribute("aria-busy");
			return;
		}
		if (result.status === "error" && this.errorEl) this.errorEl.textContent = result.message;
		if (result.status !== "busy" && result.status !== "cancelled") this.setBusy(this.saveButton, false);
	}

	private async retryRelationship(): Promise<void> {
		if (!this.retryButton) return;
		this.errorEl?.replaceChildren();
		this.setBusy(this.retryButton, true);
		const result = await this.session.retryRelationship();
		if (result.status === "success") {
			const createdFile = this.partialCreatedFile;
			if (result.relationship.message) new Notice(result.relationship.message);
			this.close();
			if (createdFile) await this.openCreatedFile(createdFile);
			return;
		}
		if (result.status === "error" && this.errorEl) this.errorEl.textContent = result.message;
		this.setBusy(this.retryButton, false);
	}

	private async openCreatedFile(file: TFile): Promise<void> {
		try {
			await this.app.workspace.getLeaf("tab").openFile(file);
		} catch (error) {
			new Notice(
				`The contact moment was created but could not be opened: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private refreshRelationshipOptions(): void {
		if (!this.relationshipSelect) return;
		const relationships = matchingContactMomentRelationships(this.values.peoplePaths, this.context);
		const options: Array<{ value: string; label: string; disabled?: boolean }> = [
			{ value: "", label: "No linked relationship" },
		];
		for (const relationship of relationships) {
			options.push({
				value: relationship.filePath,
				label: `${relationshipLabel(relationship, this.context)} — ${relationship.filePath}`,
			});
		}
		const selectedIsCanonical = relationships.some(
			(relationship) => relationship.filePath === this.values.relationshipPath,
		);
		if (this.mode.kind === "create" && this.values.relationshipPath && !selectedIsCanonical) {
			this.values.relationshipPath = "";
		}
		this.replaceSelectOptions(this.relationshipSelect, options, this.values.relationshipPath);
		if (this.advanceContainer) this.advanceContainer.hidden = !selectedIsCanonical;
		if (!selectedIsCanonical) {
			this.values.advanceRelationshipLastContact = false;
			if (this.advanceCheckbox) this.advanceCheckbox.checked = false;
		}
	}

	private refreshProposedPath(): void {
		if (this.mode.kind !== "create" || this.pathManuallyEdited) return;
		const proposed = proposeContactMomentPath(this.values, this.context.people, this.getSettings().peopleRootFolder);
		this.values.path = proposed;
		if (this.pathInput) this.pathInput.value = proposed;
	}

	private addGroup(container: HTMLElement, legend: string): HTMLFieldSetElement {
		const group = container.ownerDocument.createElement("fieldset");
		group.className = "people-atlas-contact-moment-section";
		const heading = container.ownerDocument.createElement("legend");
		heading.textContent = legend;
		group.append(heading);
		container.append(group);
		return group;
	}

	private addInput(container: HTMLElement, options: InputOptions): HTMLInputElement {
		const field = container.ownerDocument.createElement("div");
		field.className = "people-atlas-form-field";
		const id = `people-atlas-contact-moment-input-${++contactMomentModalSequence}`;
		const descriptionId = `${id}-description`;
		const label = container.ownerDocument.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = container.ownerDocument.createElement("small");
		description.id = descriptionId;
		description.textContent = options.description;
		const input = container.ownerDocument.createElement("input");
		input.id = id;
		input.type = options.type ?? "text";
		input.value = options.value;
		input.readOnly = options.readOnly ?? false;
		if (options.list) input.setAttribute("list", options.list);
		input.setAttribute("aria-describedby", descriptionId);
		input.addEventListener("input", () => options.onInput(input.value));
		field.append(label, description, input);
		container.append(field);
		return input;
	}

	private addTextarea(container: HTMLElement, options: InputOptions): HTMLTextAreaElement {
		const field = container.ownerDocument.createElement("div");
		field.className = "people-atlas-form-field";
		const id = `people-atlas-contact-moment-textarea-${++contactMomentModalSequence}`;
		const descriptionId = `${id}-description`;
		const label = container.ownerDocument.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = container.ownerDocument.createElement("small");
		description.id = descriptionId;
		description.textContent = options.description;
		const textarea = container.ownerDocument.createElement("textarea");
		textarea.id = id;
		textarea.value = options.value;
		textarea.rows = 3;
		textarea.setAttribute("aria-describedby", descriptionId);
		textarea.addEventListener("input", () => options.onInput(textarea.value));
		field.append(label, description, textarea);
		container.append(field);
		return textarea;
	}

	private addSelect(container: HTMLElement, options: SelectOptions): HTMLSelectElement {
		const field = container.ownerDocument.createElement("div");
		field.className = "people-atlas-form-field";
		const id = `people-atlas-contact-moment-select-${++contactMomentModalSequence}`;
		const descriptionId = `${id}-description`;
		const label = container.ownerDocument.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = container.ownerDocument.createElement("small");
		description.id = descriptionId;
		description.textContent = options.description;
		const select = container.ownerDocument.createElement("select");
		select.id = id;
		select.setAttribute("aria-describedby", descriptionId);
		this.replaceSelectOptions(select, options.options, options.value);
		select.addEventListener("change", () => options.onChange(select.value));
		field.append(label, description, select);
		container.append(field);
		return select;
	}

	private replaceSelectOptions(
		select: HTMLSelectElement,
		options: Array<{ value: string; label: string; disabled?: boolean }>,
		value: string,
	): void {
		const elements = options.map((option) => {
			const element = select.ownerDocument.createElement("option");
			element.value = option.value;
			element.textContent = option.label;
			element.disabled = option.disabled ?? false;
			return element;
		});
		select.replaceChildren(...elements);
		select.value = value;
	}

	private setBusy(button: HTMLButtonElement, busy: boolean): void {
		button.disabled = busy;
		if (busy) button.setAttribute("aria-busy", "true");
		else button.removeAttribute("aria-busy");
	}
}

function comparePeople(left: PersonRecord, right: PersonRecord): number {
	return left.name.localeCompare(right.name) || left.filePath.localeCompare(right.filePath);
}

function relationshipLabel(relationship: RelationshipRecord, context: ContactMomentFormContext): string {
	const from = relationshipPersonLabel(relationship.from, relationship.filePath, context);
	const to = relationshipPersonLabel(relationship.to, relationship.filePath, context);
	return `${from} ↔ ${to}`;
}

function relationshipPersonLabel(
	reference: RelationshipRecord["from"],
	sourcePath: string,
	context: ContactMomentFormContext,
): string {
	const byId = context.people.filter((person) => person.id === reference.target);
	if (byId.length === 1) return byId[0]?.name ?? reference.label ?? "Unknown";
	const path = reference.resolvedPath ?? context.resolveLink(reference.target, sourcePath);
	const byPath = path ? context.people.filter((person) => person.filePath === path) : [];
	if (byPath.length === 1) return byPath[0]?.name ?? reference.label ?? "Unknown";
	const exact = context.people.filter(
		(person) => person.filePath === reference.target || person.filePath.replace(/\.md$/i, "") === reference.target,
	);
	return exact.length === 1 ? (exact[0]?.name ?? reference.label ?? "Unknown") : (reference.label ?? "Unknown");
}

function localToday(): string {
	const now = new Date();
	const year = now.getFullYear().toString().padStart(4, "0");
	const month = (now.getMonth() + 1).toString().padStart(2, "0");
	const day = now.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}
