import { Modal, Notice, TFile, type App, type EventRef } from "obsidian";
import {
	canonicalPersonPhotoWikilink,
	dossierPersonPhotoAssets,
	filterPersonPhotoAssets,
	isExternalPhotoReference,
	isSupportedPersonPhotoPath,
	personPhotoInitials,
	supportedPersonPhotoAssets,
	type PersonPhotoAsset,
} from "../domain/person-photo";
import { personDossierPathFromProfile } from "../domain/people-paths";
import type { PersonRecord } from "../domain/types";
import { parsePersonReference } from "../domain/wikilink";
import type { AtlasMutationService } from "../mutations/atlas-mutation-service";
import type { PersonEditSourceBaseline } from "../mutations/person-source-guard";
import { resolvePersonPhotoResource } from "../person-photo-resource";
import type { PeopleAtlasSettings } from "../settings/types";
import {
	PersonFormSession,
	addPersonContact,
	buildPersonCreateInput,
	buildPersonUpdates,
	createPersonFormValues,
	editPersonFormValues,
	getPersonBirthDateError,
	getPersonEmailIssues,
	getPersonPhoneIssues,
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
			rawPhoto?: string | undefined;
			personClassification?: "type" | "tag" | undefined;
			sourceBaseline?: PersonEditSourceBaseline | undefined;
	  };

type PersonModalFocusTarget =
	| { kind: "email"; index: number }
	| { kind: "phone"; index: number }
	| { kind: "linked-person" };

interface PersonInputOptions {
	label: string;
	description: string;
	value: string;
	type?: string;
	readOnly?: boolean;
	inputMode?: "email" | "numeric" | "search" | "tel" | "text";
	onInput?(value: string): void;
}

type PersonPhotoResolution =
	| { status: "empty"; message: string }
	| { status: "missing"; message: string }
	| { status: "unsupported"; message: string }
	| { status: "external"; message: string }
	| { status: "unavailable"; message: string }
	| { status: "ready"; file: TFile };

let personModalSequence = 0;

export class PersonModal extends Modal {
	private readonly values: PersonFormValues;
	private readonly originalValues: PersonFormValues | undefined;
	private readonly session: PersonFormSession;
	private errorEl: HTMLElement | undefined;
	private saveButton: HTMLButtonElement | undefined;
	private advancedDetails: HTMLDetailsElement | undefined;
	private advancedSummary: HTMLElement | undefined;
	private pathInput: HTMLInputElement | undefined;
	private nameInput: HTMLInputElement | undefined;
	private birthInputs: HTMLInputElement[] = [];
	private birthErrorEl: HTMLElement | undefined;
	private emailInputs: HTMLInputElement[] = [];
	private emailErrorEls: HTMLElement[] = [];
	private phoneInputs: HTMLInputElement[] = [];
	private phoneErrorEls: HTMLElement[] = [];
	private photoInput: HTMLInputElement | undefined;
	private photoSearchInput: HTMLInputElement | undefined;
	private photoSelect: HTMLSelectElement | undefined;
	private photoPreviewEl: HTMLElement | undefined;
	private photoInitialsEl: HTMLElement | undefined;
	private photoImageEl: HTMLImageElement | undefined;
	private photoStatusEl: HTMLElement | undefined;
	private filteredPhotoAssets: PersonPhotoAsset[] = [];
	private photoPreviewSequence = 0;
	private photoEventRefs: EventRef[] = [];
	private advancedOpen = false;

	constructor(
		app: App,
		private readonly mode: PersonModalMode,
		private readonly people: PersonRecord[],
		mutations: AtlasMutationService,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly getCurrentPeople: () => PersonRecord[] = () => people,
	) {
		super(app);
		const getCurrentPhotoAssets = () => this.currentPhotoAssets();
		if (mode.kind === "create") {
			const personId = `person-${crypto.randomUUID()}`;
			this.values = createPersonFormValues(getSettings().peopleRootFolder, personId);
			this.originalValues = undefined;
			this.session = new PersonFormSession(
				{ kind: "create" },
				mutations,
				people,
				getCurrentPeople,
				getCurrentPhotoAssets,
				() => getSettings().peopleRootFolder,
				() => this.app.vault.getAllLoadedFiles().map((file) => file.path),
			);
		} else {
			this.values = editPersonFormValues(
				mode.person,
				mode.rawPhoto,
				people,
				(target, sourcePath) => app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
			);
			this.originalValues = structuredClone(this.values);
			this.session = new PersonFormSession(
				{
					kind: "edit",
					file: mode.file,
					original: structuredClone(this.values),
					expectedClassification: mode.personClassification ?? "type",
					...(mode.sourceBaseline ? { sourceBaseline: mode.sourceBaseline } : {}),
				},
				mutations,
				people,
				getCurrentPeople,
				getCurrentPhotoAssets,
				() => getSettings().peopleRootFolder,
				() => this.app.vault.getAllLoadedFiles().map((file) => file.path),
			);
		}
	}

	override onOpen(): void {
		this.contentEl.classList.add("people-atlas-person-modal");
		if (this.mode.kind === "edit") this.registerPhotoAssetListeners();
		this.renderForm();
	}

	override onClose(): void {
		this.unregisterPhotoAssetListeners();
		this.session.cancel();
		this.contentEl.replaceChildren();
		this.resetControls();
	}

	private renderForm(focusTarget?: PersonModalFocusTarget): void {
		this.titleEl.textContent = this.mode.kind === "create" ? "Create person" : "Edit person";
		this.advancedOpen = this.advancedDetails?.open ?? this.advancedOpen;
		this.contentEl.replaceChildren();
		this.resetControls();
		const document = this.contentEl.ownerDocument;
		const form = document.createElement("form");
		form.className = "people-atlas-person-form";

		const basic = this.addGroup(form, "Basic");
		this.nameInput = this.addInput(basic, {
			label: "Name",
			description:
				this.mode.kind === "create"
					? "Required display name. The new note filename is derived from this value."
					: "Changing the display name also proposes a filename change in the current folder.",
			value: this.values.name,
			onInput: (value) => {
				this.values.name = value;
				this.refreshPathPreview();
				this.refreshPhotoInitials();
			},
		});
		if (this.mode.kind === "create") {
			const photoHint = document.createElement("p");
			photoHint.className = "people-atlas-person-photo-create-hint";
			photoHint.setAttribute("role", "note");
			photoHint.textContent =
				"Photo: Save this person first to create its dossier. Place an image in the person's dossier yourself. Then open Edit and choose the dossier image.";
			basic.append(photoHint);
		} else this.addPhotoControl(basic);
		this.addTextarea(basic, {
			label: "Aliases",
			description: "Optional alternative names, one per line.",
			value: this.values.aliases,
			onInput: (value) => {
				this.values.aliases = value;
			},
		});

		const profile = this.addGroup(form, "Profile");
		this.addBirthDateControl(profile);
		this.addInput(profile, {
			label: "Pronouns",
			description: "Optional user-authored pronouns. People Atlas does not infer relationship meaning from them.",
			value: this.values.pronouns,
			onInput: (value) => {
				this.values.pronouns = value;
			},
		});
		this.addInput(profile, {
			label: "Gender",
			description: "Optional user-authored gender. People Atlas does not infer relationship meaning from it.",
			value: this.values.gender,
			onInput: (value) => {
				this.values.gender = value;
			},
		});
		this.addInput(profile, {
			label: "Job title",
			description: "Optional current job title.",
			value: this.values.jobTitle,
			onInput: (value) => {
				this.values.jobTitle = value;
			},
		});
		this.addTextarea(profile, {
			label: "Organisations",
			description: "Optional organisations, one per line.",
			value: this.values.organisations,
			onInput: (value) => {
				this.values.organisations = value;
			},
		});

		const contactDetails = this.addGroup(form, "Contact details");
		this.addProfileList(
			contactDetails,
			"Email addresses",
			"Add one address per entry. Each address needs one @; duplicates are compared without letter case.",
			"email",
		);
		this.addProfileList(
			contactDetails,
			"Phone numbers",
			"Add one number per entry. Formatting and international prefixes are preserved.",
			"phone",
		);

		const linkedPeople = this.addGroup(form, "Linked people");
		this.addLinkedPeople(linkedPeople);

		this.advancedDetails = document.createElement("details");
		this.advancedDetails.className = "people-atlas-person-advanced";
		this.advancedDetails.open = this.advancedOpen;
		this.advancedDetails.addEventListener("toggle", () => {
			this.advancedOpen = this.advancedDetails?.open ?? false;
		});
		this.advancedSummary = document.createElement("summary");
		const advancedBody = document.createElement("div");
		advancedBody.className = "people-atlas-person-advanced-body";
		this.pathInput = this.addInput(advancedBody, {
			label: this.mode.kind === "create" ? "Person note path" : "Current person note path",
			description:
				this.mode.kind === "create"
					? "The configured People folder and a safe filename determine this path."
					: "The note stays in this folder. A changed filename requires a separate confirmation.",
			value: this.values.path,
			readOnly: true,
		});
		this.pathInput.dataset.personPath = "true";
		this.addInput(advancedBody, {
			label: "Person ID",
			description: "Stable identity planned before any vault write and managed by People Atlas.",
			value: this.values.personId,
			readOnly: true,
		});
		this.advancedDetails.append(this.advancedSummary, advancedBody);
		form.append(this.advancedDetails);

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
		this.refreshProfileErrors();
		if (this.mode.kind === "edit") this.refreshPhotoPreview();
		this.restoreFocus(focusTarget);
	}

	private addPhotoControl(container: HTMLElement): void {
		const document = container.ownerDocument;
		const section = document.createElement("section");
		section.className = "people-atlas-person-photo";

		this.photoPreviewEl = document.createElement("div");
		this.photoPreviewEl.className = "people-atlas-person-photo-preview";
		this.photoPreviewEl.dataset.photoStatus = "empty";
		const frame = document.createElement("div");
		frame.className = "people-atlas-person-photo-frame";
		this.photoInitialsEl = document.createElement("span");
		this.photoInitialsEl.className = "people-atlas-person-photo-initials";
		this.photoInitialsEl.setAttribute("aria-hidden", "true");
		frame.append(this.photoInitialsEl);
		this.photoStatusEl = document.createElement("p");
		this.photoStatusEl.id = `people-atlas-person-photo-status-${++personModalSequence}`;
		this.photoStatusEl.className = "people-atlas-person-photo-status";
		this.photoStatusEl.setAttribute("role", "status");
		this.photoStatusEl.setAttribute("aria-live", "polite");
		this.photoPreviewEl.append(frame, this.photoStatusEl);
		section.append(this.photoPreviewEl);
		this.refreshPhotoInitials();

		this.photoInput = this.addInput(section, {
			label: "Photo",
			description:
				"Stored vault path or wikilink. Use the dossier image picker or Clear photo to change it; unchanged authored text stays exact.",
			value: this.values.photo,
			readOnly: true,
		});
		appendDescribedBy(this.photoInput, this.photoStatusEl.id);

		this.photoSearchInput = this.addInput(section, {
			label: "Search dossier images",
			description: "Filter supported PNG, JPG, JPEG, WebP, GIF and AVIF files in this person's own dossier.",
			value: "",
			type: "search",
			inputMode: "search",
			onInput: () => this.refreshPhotoPickerOptions(),
		});
		this.photoSearchInput.addEventListener("keydown", (event) => {
			const firstAsset = this.filteredPhotoAssets[0];
			if (!firstAsset) return;
			if (event.key === "ArrowDown") {
				event.preventDefault();
				if (this.photoSelect) {
					this.photoSelect.value = firstAsset.path;
					this.photoSelect.focus();
				}
			} else if (event.key === "Enter") {
				event.preventDefault();
				this.selectPhotoAsset(firstAsset.path);
			}
		});

		const selectRow = document.createElement("div");
		selectRow.className = "people-atlas-form-field";
		const selectId = `people-atlas-person-photo-select-${++personModalSequence}`;
		const selectDescriptionId = `${selectId}-description`;
		const selectLabel = document.createElement("label");
		selectLabel.htmlFor = selectId;
		selectLabel.textContent = "Dossier image";
		const selectDescription = document.createElement("small");
		selectDescription.id = selectDescriptionId;
		selectDescription.textContent =
			"Each choice from this person's own dossier uses its full vault-relative path, so equal filenames remain distinct.";
		this.photoSelect = document.createElement("select");
		this.photoSelect.id = selectId;
		this.photoSelect.dataset.personPhotoSelect = "true";
		this.photoSelect.setAttribute("aria-describedby", `${selectDescriptionId} ${this.photoStatusEl.id}`);
		this.photoSelect.addEventListener("change", () => {
			const path = this.photoSelect?.value;
			if (path) this.selectPhotoAsset(path);
		});
		selectRow.append(selectLabel, selectDescription, this.photoSelect);
		section.append(selectRow);

		const actions = document.createElement("div");
		actions.className = "people-atlas-person-photo-actions";
		const clear = document.createElement("button");
		clear.type = "button";
		clear.textContent = "Clear photo";
		clear.addEventListener("click", () => {
			this.values.photo = "";
			this.values.photoSelectionPath = undefined;
			if (this.photoInput) this.photoInput.value = "";
			if (this.photoSelect) this.photoSelect.value = "";
			this.refreshPhotoPreview();
			this.photoInput?.focus();
		});
		actions.append(clear);
		section.append(actions);
		container.append(section);
		this.refreshPhotoPickerOptions();
	}

	private currentPhotoAssets(): PersonPhotoAsset[] {
		if (this.mode.kind !== "edit") return [];
		const personId = this.mode.person.id;
		const dossierPath = personDossierPathFromProfile(
			this.getSettings().peopleRootFolder,
			this.mode.file.path,
			personId,
			this.app.vault.getAllLoadedFiles().map((file) => file.path),
			this.getCurrentPeople(),
		);
		if (!dossierPath) return [];
		return dossierPersonPhotoAssets(
			supportedPersonPhotoAssets(this.app.vault.getFiles().map((file) => file.path)),
			dossierPath,
		);
	}

	private refreshPhotoPickerOptions(): void {
		if (!this.photoSelect) return;
		const assets = this.currentPhotoAssets();
		this.filteredPhotoAssets = filterPersonPhotoAssets(assets, this.photoSearchInput?.value ?? "");
		const document = this.photoSelect.ownerDocument;
		const placeholder = document.createElement("option");
		placeholder.value = "";
		if (assets.length === 0) placeholder.textContent = "No supported dossier images";
		else if (this.filteredPhotoAssets.length === 0) placeholder.textContent = "No dossier images match";
		else placeholder.textContent = "Choose a dossier image";
		this.photoSelect.replaceChildren(placeholder);
		for (const asset of this.filteredPhotoAssets) {
			const option = document.createElement("option");
			option.value = asset.path;
			option.textContent = `${asset.path.slice(asset.path.lastIndexOf("/") + 1)} — ${asset.path}`;
			this.photoSelect.append(option);
		}
		const pendingPath = this.values.photoSelectionPath;
		this.photoSelect.value =
			pendingPath && this.filteredPhotoAssets.some((asset) => asset.path === pendingPath) ? pendingPath : "";
	}

	private selectPhotoAsset(path: string): void {
		const matches = this.currentPhotoAssets().filter((asset) => asset.path === path);
		const asset = matches.length === 1 ? matches[0] : undefined;
		if (!asset) {
			this.showPhotoFallback(
				"missing",
				`The selected photo “${path}” is no longer uniquely available in the vault. Choose it again or clear the photo.`,
			);
			this.refreshPhotoPickerOptions();
			return;
		}
		this.values.photo = canonicalPersonPhotoWikilink(asset.path);
		this.values.photoSelectionPath = asset.path;
		if (this.photoInput) this.photoInput.value = this.values.photo;
		if (this.photoSelect) this.photoSelect.value = asset.path;
		this.refreshPhotoPreview();
	}

	private refreshPhotoPreview(): void {
		const preview = this.photoPreviewEl;
		const initials = this.photoInitialsEl;
		const status = this.photoStatusEl;
		if (!preview || !initials || !status) return;
		const sequence = ++this.photoPreviewSequence;
		this.photoImageEl?.remove();
		this.photoImageEl = undefined;
		initials.hidden = false;

		const resolution = this.resolvePhoto();
		if (resolution.status !== "ready") {
			this.showPhotoFallback(resolution.status, resolution.message);
			return;
		}

		const resource = resolvePersonPhotoResource(this.app, resolution.file.path);
		if (resource.status !== "ready") {
			const fallbackStatus =
				resource.status === "missing" || resource.status === "unsupported" ? resource.status : "unavailable";
			this.showPhotoFallback(
				fallbackStatus,
				resource.status === "missing"
					? "The referenced vault image is missing. Initials will be shown."
					: resource.status === "unsupported"
						? "This photo format is unsupported. Choose a PNG, JPG, JPEG, WebP, GIF or AVIF image."
						: "The selected vault image is temporarily unavailable. Initials will be shown.",
			);
			return;
		}

		const image = preview.ownerDocument.createElement("img");
		image.className = "people-atlas-person-photo-image";
		image.alt = "";
		image.decoding = "async";
		image.hidden = true;
		this.photoImageEl = image;
		const frame = preview.querySelector(".people-atlas-person-photo-frame");
		frame?.append(image);
		preview.dataset.photoStatus = "loading";
		status.hidden = false;
		status.textContent = "Loading the selected vault image. Initials are shown until it is ready.";
		image.addEventListener("load", () => {
			if (!this.isCurrentPhotoImage(image, sequence)) return;
			image.hidden = false;
			initials.hidden = true;
			preview.dataset.photoStatus = "ready";
			status.textContent = "";
			status.hidden = true;
		});
		image.addEventListener("error", () => {
			if (!this.isCurrentPhotoImage(image, sequence)) return;
			image.hidden = true;
			initials.hidden = false;
			preview.dataset.photoStatus = "decode-error";
			status.hidden = false;
			status.textContent = "The selected vault image could not be decoded. Initials will be shown.";
		});
		image.src = resource.resourceUrl;
	}

	private resolvePhoto(): PersonPhotoResolution {
		const rawPhoto = this.values.photo;
		if (!rawPhoto.trim()) {
			return { status: "empty", message: "No photo is selected. Initials will be shown." };
		}
		if (isExternalPhotoReference(rawPhoto)) {
			return {
				status: "external",
				message: "External or network photo references are not supported. Initials will be shown.",
			};
		}
		const target = parsePersonReference(rawPhoto)?.target.trim();
		if (!target) {
			return { status: "missing", message: "The photo reference is not readable. Initials will be shown." };
		}
		if (isExternalPhotoReference(target)) {
			return {
				status: "external",
				message: "External or network photo references are not supported. Initials will be shown.",
			};
		}

		let file: TFile | undefined;
		if (this.values.photoSelectionPath !== undefined) {
			const matches = this.app.vault
				.getFiles()
				.filter((candidate) => candidate.path === this.values.photoSelectionPath);
			file = matches.length === 1 ? matches[0] : undefined;
		} else {
			const exact = this.app.vault.getAbstractFileByPath(target);
			if (exact instanceof TFile) file = exact;
			else {
				const resolved = this.app.metadataCache.getFirstLinkpathDest(target, this.photoSourcePath());
				if (resolved) file = resolved;
			}
		}
		if (!file) {
			if (pathHasUnsupportedExtension(target)) {
				return {
					status: "unsupported",
					message: "This photo format is unsupported. Choose a PNG, JPG, JPEG, WebP, GIF or AVIF image.",
				};
			}
			return { status: "missing", message: "The referenced vault image is missing. Initials will be shown." };
		}
		if (!isSupportedPersonPhotoPath(file.path)) {
			return {
				status: "unsupported",
				message: "This photo format is unsupported. Choose a PNG, JPG, JPEG, WebP, GIF or AVIF image.",
			};
		}
		return { status: "ready", file };
	}

	private photoSourcePath(): string {
		return this.mode.kind === "edit" ? this.mode.file.path : this.values.path;
	}

	private showPhotoFallback(status: Exclude<PersonPhotoResolution["status"], "ready">, message: string): void {
		if (!this.photoPreviewEl || !this.photoInitialsEl || !this.photoStatusEl) return;
		this.photoPreviewEl.dataset.photoStatus = status;
		this.photoInitialsEl.hidden = false;
		this.photoStatusEl.hidden = false;
		this.photoStatusEl.textContent = message;
	}

	private refreshPhotoInitials(): void {
		if (this.photoInitialsEl) this.photoInitialsEl.textContent = personPhotoInitials(this.values.name);
	}

	private isCurrentPhotoImage(image: HTMLImageElement, sequence: number): boolean {
		return image === this.photoImageEl && sequence === this.photoPreviewSequence && image.isConnected;
	}

	private registerPhotoAssetListeners(): void {
		this.unregisterPhotoAssetListeners();
		const refresh = () => {
			this.refreshPhotoPickerOptions();
			this.refreshPhotoPreview();
		};
		this.photoEventRefs = [
			this.app.vault.on("create", refresh),
			this.app.vault.on("modify", refresh),
			this.app.vault.on("delete", refresh),
			this.app.vault.on("rename", refresh),
		];
	}

	private unregisterPhotoAssetListeners(): void {
		for (const eventRef of this.photoEventRefs) this.app.vault.offref(eventRef);
		this.photoEventRefs = [];
	}

	private addBirthDateControl(container: HTMLElement): void {
		const document = container.ownerDocument;
		const group = document.createElement("fieldset");
		group.className = "people-atlas-person-birth-date";
		const legend = document.createElement("legend");
		legend.textContent = "Birth date";
		const description = document.createElement("small");
		description.id = `people-atlas-person-birth-description-${++personModalSequence}`;
		description.textContent =
			"Enter month and day. A four-digit year is optional; clearing only the year keeps a birthday without a known year.";
		const controls = document.createElement("div");
		controls.className = "people-atlas-person-birth-date-controls";
		const month = this.addInput(controls, {
			label: "Month",
			description: "Month number from 1 to 12.",
			value: this.values.birthDate.month,
			inputMode: "numeric",
			onInput: (value) => {
				this.values.birthDate.month = value;
				this.refreshBirthDateError();
			},
		});
		const day = this.addInput(controls, {
			label: "Day",
			description: "Calendar-valid day for the selected month.",
			value: this.values.birthDate.day,
			inputMode: "numeric",
			onInput: (value) => {
				this.values.birthDate.day = value;
				this.refreshBirthDateError();
			},
		});
		const year = this.addInput(controls, {
			label: "Year (optional)",
			description: "Optional four-digit year from 0001 to 9999.",
			value: this.values.birthDate.year,
			inputMode: "numeric",
			onInput: (value) => {
				this.values.birthDate.year = value;
				this.refreshBirthDateError();
			},
		});
		this.birthInputs = [month, day, year];
		const clear = document.createElement("button");
		clear.type = "button";
		clear.textContent = "Clear birth date";
		clear.addEventListener("click", () => {
			this.values.birthDate = { year: "", month: "", day: "" };
			for (const input of this.birthInputs) input.value = "";
			this.refreshBirthDateError();
			month.focus();
		});
		this.birthErrorEl = document.createElement("p");
		this.birthErrorEl.id = `people-atlas-person-birth-error-${++personModalSequence}`;
		this.birthErrorEl.className = "people-atlas-profile-entry-error";
		this.birthErrorEl.setAttribute("role", "alert");
		this.birthErrorEl.setAttribute("aria-live", "polite");
		for (const input of this.birthInputs) {
			appendDescribedBy(input, description.id);
			appendDescribedBy(input, this.birthErrorEl.id);
		}
		group.append(legend, description, controls, clear, this.birthErrorEl);
		container.append(group);
	}

	private addProfileList(
		container: HTMLElement,
		title: string,
		descriptionText: string,
		kind: "email" | "phone",
	): void {
		const document = container.ownerDocument;
		const section = document.createElement("section");
		section.className = "people-atlas-person-profile-list";
		const heading = document.createElement("h3");
		heading.textContent = title;
		const description = document.createElement("small");
		description.id = `people-atlas-person-list-description-${++personModalSequence}`;
		description.textContent = descriptionText;
		section.append(heading, description);
		const values = kind === "email" ? this.values.emails : this.values.phones;
		const list = document.createElement("ol");
		list.className = "people-atlas-person-profile-list-entries";
		for (const [index, value] of values.entries()) {
			const item = document.createElement("li");
			const row = document.createElement("div");
			row.className = "people-atlas-person-profile-list-row";
			const id = `people-atlas-person-${kind}-${++personModalSequence}`;
			const errorId = `${id}-error`;
			const label = document.createElement("label");
			label.htmlFor = id;
			label.textContent = kind === "email" ? `Email address ${index + 1}` : `Phone number ${index + 1}`;
			const input = document.createElement("input");
			input.id = id;
			input.type = "text";
			input.inputMode = kind === "email" ? "email" : "tel";
			input.autocomplete = kind === "email" ? "email" : "tel";
			input.value = value;
			input.dataset.profileList = kind;
			input.dataset.profileIndex = String(index);
			input.setAttribute("aria-describedby", `${description.id} ${errorId}`);
			input.addEventListener("input", () => {
				values[index] = input.value;
				this.refreshProfileErrors();
			});
			const remove = document.createElement("button");
			remove.type = "button";
			remove.textContent = "Remove";
			remove.setAttribute(
				"aria-label",
				kind === "email" ? `Remove email address ${index + 1}` : `Remove phone number ${index + 1}`,
			);
			remove.addEventListener("click", () => {
				values.splice(index, 1);
				this.renderForm(values.length > 0 ? { kind, index: Math.min(index, values.length - 1) } : undefined);
			});
			const error = document.createElement("small");
			error.id = errorId;
			error.className = "people-atlas-profile-entry-error";
			error.setAttribute("role", "alert");
			row.append(label, input, remove);
			item.append(row, error);
			list.append(item);
			if (kind === "email") {
				this.emailInputs.push(input);
				this.emailErrorEls.push(error);
			} else {
				this.phoneInputs.push(input);
				this.phoneErrorEls.push(error);
			}
		}
		const add = document.createElement("button");
		add.type = "button";
		add.textContent = kind === "email" ? "Add email address" : "Add phone number";
		add.addEventListener("click", () => {
			values.push("");
			this.renderForm({ kind, index: values.length - 1 });
		});
		section.append(list, add);
		container.append(section);
	}

	private addLinkedPeople(container: HTMLElement): void {
		const document = container.ownerDocument;
		const description = document.createElement("small");
		description.id = `people-atlas-person-linked-description-${++personModalSequence}`;
		description.textContent =
			"Links are stored on this person note as simple connections. New links must resolve to one canonical, non-self person. Existing unresolved values remain until you remove them. Use Create relationship for roles, dates, status and other rich metadata.";
		const list = document.createElement("ul");
		list.className = "people-atlas-person-linked-list";
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
			remove.setAttribute("aria-label", `Remove linked person ${resolved?.name ?? contact.raw}`);
			remove.addEventListener("click", () => {
				this.values.contacts = this.values.contacts.filter((_, candidateIndex) => candidateIndex !== index);
				this.renderForm({ kind: "linked-person" });
			});
			item.append(text, remove);
			list.append(item);
		}

		const controls = document.createElement("div");
		controls.className = "people-atlas-person-linked-controls";
		const inputId = `people-atlas-person-linked-${++personModalSequence}`;
		const datalistId = `${inputId}-choices`;
		const label = document.createElement("label");
		label.htmlFor = inputId;
		label.textContent = "Add a linked person";
		const input = document.createElement("input");
		input.id = inputId;
		input.type = "search";
		input.autocomplete = "off";
		input.setAttribute("list", datalistId);
		input.setAttribute("aria-describedby", description.id);
		input.dataset.linkedPersonInput = "true";
		const datalist = document.createElement("datalist");
		datalist.id = datalistId;
		for (const person of [...this.people].sort(comparePeople)) {
			if (!isCanonicalPerson(this.people, person)) continue;
			if (this.mode.kind === "edit" && person.filePath === this.mode.file.path) continue;
			const option = document.createElement("option");
			option.value = person.filePath;
			option.label = `${person.name} — ${person.filePath}`;
			datalist.append(option);
		}
		const add = document.createElement("button");
		add.type = "button";
		add.textContent = "Add linked person";
		add.addEventListener("click", () => {
			const result = addPersonContact(
				this.values.contacts,
				input.value,
				this.people,
				this.mode.kind === "edit" ? this.mode.file.path : undefined,
			);
			if (result.error) {
				this.showError(result.error);
				input.focus();
				return;
			}
			this.values.contacts = result.contacts;
			this.renderForm({ kind: "linked-person" });
		});
		controls.append(label, input, datalist, add);
		container.append(description, list, controls);
	}

	private renderRenameConfirmation(currentPath: string, targetPath: string, errorMessage?: string): void {
		this.titleEl.textContent = "Confirm person rename";
		this.contentEl.replaceChildren();
		this.resetControls();
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
		try {
			if (this.mode.kind === "create") buildPersonCreateInput(this.values);
			else if (this.originalValues) buildPersonUpdates(this.values, this.originalValues);
		} catch (error) {
			this.showError(error instanceof Error ? error.message : String(error));
			this.refreshProfileErrors();
			this.focusFirstProfileError();
			return;
		}
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
		this.associateAdvancedError(result.message);
		this.saveButton.disabled = false;
		this.saveButton.removeAttribute("aria-busy");
	}

	private refreshPathPreview(): void {
		if (!this.pathInput) return;
		this.values.path =
			this.mode.kind === "create"
				? proposeCreatePersonPath(
						this.values.name,
						this.getSettings().peopleRootFolder,
						this.values.personId,
						this.getCurrentPeople(),
						this.app.vault.getAllLoadedFiles().map((entry) => entry.path),
					)
				: this.mode.file.path;
		const proposedRename =
			this.mode.kind === "edit" ? proposePersonRenamePath(this.mode.file.path, this.values.name) : "";
		const preview =
			this.mode.kind === "edit" && proposedRename && proposedRename !== this.mode.file.path
				? `${this.mode.file.path} → ${proposedRename}`
				: this.values.path;
		this.pathInput.value = preview;
		if (this.advancedSummary) {
			this.advancedSummary.textContent =
				this.mode.kind === "create" ? `Advanced — Destination: ${preview}` : `Advanced — Current path: ${preview}`;
		}
	}

	private refreshProfileErrors(): void {
		this.refreshBirthDateError();
		this.applyListIssues(this.emailInputs, this.emailErrorEls, getPersonEmailIssues(this.values.emails));
		this.applyListIssues(this.phoneInputs, this.phoneErrorEls, getPersonPhoneIssues(this.values.phones));
	}

	private refreshBirthDateError(): void {
		if (!this.birthErrorEl) return;
		const error = getPersonBirthDateError(this.values.birthDate);
		this.birthErrorEl.textContent = error ?? "";
		for (const input of this.birthInputs) setAriaInvalid(input, Boolean(error));
	}

	private applyListIssues(
		inputs: HTMLInputElement[],
		errorElements: HTMLElement[],
		issues: Array<{ index: number; message: string }>,
	): void {
		for (const [index, input] of inputs.entries()) {
			const issue = issues.find((candidate) => candidate.index === index);
			setAriaInvalid(input, Boolean(issue));
			const error = errorElements[index];
			if (error) error.textContent = issue?.message ?? "";
		}
	}

	private focusFirstProfileError(): void {
		if (getPersonBirthDateError(this.values.birthDate)) {
			this.birthInputs[0]?.focus();
			return;
		}
		const emailIssue = getPersonEmailIssues(this.values.emails)[0];
		if (emailIssue) {
			this.emailInputs[emailIssue.index]?.focus();
			return;
		}
		const phoneIssue = getPersonPhoneIssues(this.values.phones)[0];
		if (phoneIssue) this.phoneInputs[phoneIssue.index]?.focus();
	}

	private associateAdvancedError(message: string): void {
		if (!/person(?:_| )?id|person identity|path|destination|already exists|filename/i.test(message)) return;
		if (this.advancedDetails) {
			this.advancedDetails.open = true;
			this.advancedOpen = true;
		}
		this.pathInput?.focus();
	}

	private restoreFocus(target?: PersonModalFocusTarget): void {
		if (!target) {
			this.nameInput?.focus();
			return;
		}
		if (target.kind === "email") this.emailInputs[target.index]?.focus();
		else if (target.kind === "phone") this.phoneInputs[target.index]?.focus();
		else this.contentEl.querySelector<HTMLInputElement>("[data-linked-person-input]")?.focus();
	}

	private showError(message: string): void {
		if (this.errorEl) this.errorEl.textContent = message;
	}

	private addGroup(form: HTMLFormElement, title: string): HTMLFieldSetElement {
		const fieldset = form.ownerDocument.createElement("fieldset");
		fieldset.className = "people-atlas-person-section";
		const legend = form.ownerDocument.createElement("legend");
		legend.textContent = title;
		fieldset.append(legend);
		form.append(fieldset);
		return fieldset;
	}

	private addInput(container: HTMLElement, options: PersonInputOptions): HTMLInputElement {
		const document = container.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-person-field-${++personModalSequence}`;
		const descriptionId = `${id}-description`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = document.createElement("small");
		description.id = descriptionId;
		description.textContent = options.description;
		const input = document.createElement("input");
		input.id = id;
		input.type = options.type ?? "text";
		input.inputMode = options.inputMode ?? "text";
		input.value = options.value;
		input.readOnly = options.readOnly ?? false;
		input.autocomplete = "off";
		input.setAttribute("aria-describedby", descriptionId);
		if (options.onInput) input.addEventListener("input", () => options.onInput?.(input.value));
		row.append(label, description, input);
		container.append(row);
		return input;
	}

	private addTextarea(
		container: HTMLElement,
		options: {
			label: string;
			description: string;
			value: string;
			onInput(value: string): void;
		},
	): HTMLTextAreaElement {
		const document = container.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-person-field-${++personModalSequence}`;
		const descriptionId = `${id}-description`;
		const label = document.createElement("label");
		label.htmlFor = id;
		label.textContent = options.label;
		const description = document.createElement("small");
		description.id = descriptionId;
		description.textContent = options.description;
		const textarea = document.createElement("textarea");
		textarea.id = id;
		textarea.value = options.value;
		textarea.rows = 3;
		textarea.setAttribute("aria-describedby", descriptionId);
		textarea.addEventListener("input", () => options.onInput(textarea.value));
		row.append(label, description, textarea);
		container.append(row);
		return textarea;
	}

	private resetControls(): void {
		this.photoPreviewSequence += 1;
		this.errorEl = undefined;
		this.saveButton = undefined;
		this.advancedDetails = undefined;
		this.advancedSummary = undefined;
		this.pathInput = undefined;
		this.nameInput = undefined;
		this.birthInputs = [];
		this.birthErrorEl = undefined;
		this.emailInputs = [];
		this.emailErrorEls = [];
		this.phoneInputs = [];
		this.phoneErrorEls = [];
		this.photoInput = undefined;
		this.photoSearchInput = undefined;
		this.photoSelect = undefined;
		this.photoPreviewEl = undefined;
		this.photoInitialsEl = undefined;
		this.photoImageEl = undefined;
		this.photoStatusEl = undefined;
		this.filteredPhotoAssets = [];
	}
}

function comparePeople(left: PersonRecord, right: PersonRecord): number {
	return left.name.localeCompare(right.name) || left.filePath.localeCompare(right.filePath);
}

function isCanonicalPerson(people: PersonRecord[], person: PersonRecord): boolean {
	return (
		people.filter((candidate) => candidate.filePath === person.filePath).length === 1 &&
		people.filter((candidate) => candidate.id === person.id).length === 1
	);
}

function appendDescribedBy(control: HTMLElement, id: string): void {
	const ids = new Set((control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
	ids.add(id);
	control.setAttribute("aria-describedby", [...ids].join(" "));
}

function setAriaInvalid(control: HTMLElement, invalid: boolean): void {
	if (invalid) control.setAttribute("aria-invalid", "true");
	else control.removeAttribute("aria-invalid");
}

function pathHasUnsupportedExtension(path: string): boolean {
	const filename = path.slice(path.lastIndexOf("/") + 1);
	return filename.includes(".") && !isSupportedPersonPhotoPath(path);
}
