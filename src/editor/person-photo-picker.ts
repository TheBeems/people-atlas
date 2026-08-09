import { TFile, type App, type EventRef } from "obsidian";
import {
	canonicalPersonPhotoWikilink,
	dossierPersonPhotoAssets,
	filterPersonPhotoAssets,
	getPendingPersonPhotoSelectionError,
	isExternalPhotoReference,
	isSupportedPersonPhotoPath,
	personPhotoInitials,
	supportedPersonPhotoAssets,
	type PersonPhotoAsset,
} from "../domain/person-photo";
import { personDossierPathFromProfile } from "../domain/people-paths";
import type { PersonRecord } from "../domain/types";
import { parsePersonReference } from "../domain/wikilink";
import { resolvePersonPhotoResource } from "../person-photo-resource";
import type { PeopleAtlasSettings } from "../settings/types";
import type { Translator } from "../i18n";

export interface PersonPhotoPickerValues {
	name: string;
	photo: string;
	photoSelectionPath?: string | undefined;
}

export type PersonPhotoPickerMode = { kind: "create" } | { kind: "edit"; file: TFile; personId: string };

interface PersonPhotoPickerOptions {
	app: App;
	mode: PersonPhotoPickerMode;
	values: PersonPhotoPickerValues;
	getSettings: () => PeopleAtlasSettings;
	getCurrentPeople: () => PersonRecord[];
	translator: Translator;
}

type PersonPhotoResolution =
	| { status: "empty" }
	| { status: "unreadable" }
	| { status: "missing" }
	| { status: "unsupported" }
	| { status: "external" }
	| { status: "unavailable" }
	| { status: "ready"; file: TFile };

let pickerSequence = 0;

/** Owns dossier-photo selection, preview, async decode state and vault lifecycle. */
export class PersonPhotoPicker {
	private readonly values: PersonPhotoPickerValues;
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

	constructor(private readonly options: PersonPhotoPickerOptions) {
		this.values = options.values;
	}

	append(container: HTMLElement): void {
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
		this.photoStatusEl.id = `people-atlas-person-photo-status-${++pickerSequence}`;
		this.photoStatusEl.className = "people-atlas-person-photo-status";
		this.photoStatusEl.setAttribute("role", "status");
		this.photoStatusEl.setAttribute("aria-live", "polite");
		this.photoPreviewEl.append(frame, this.photoStatusEl);
		section.append(this.photoPreviewEl);
		this.refreshInitials();

		this.photoInput = this.appendInput(section, {
			label: this.options.translator.personModal.photo,
			description: this.options.translator.personModal.photoDescription,
			value: this.values.photo,
			readOnly: true,
		});
		appendDescribedBy(this.photoInput, this.photoStatusEl.id);

		this.photoSearchInput = this.appendInput(section, {
			label: this.options.translator.personModal.searchDossierImages,
			description: this.options.translator.personModal.searchDossierImagesDescription,
			value: "",
			type: "search",
			inputMode: "search",
			onInput: () => this.refreshPickerOptions(),
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
				this.selectAsset(firstAsset.path);
			}
		});

		const selectRow = document.createElement("div");
		selectRow.className = "people-atlas-form-field";
		const selectId = `people-atlas-person-photo-select-${++pickerSequence}`;
		const selectDescriptionId = `${selectId}-description`;
		const selectLabel = document.createElement("label");
		selectLabel.htmlFor = selectId;
		selectLabel.textContent = this.options.translator.personModal.dossierImage;
		const selectDescription = document.createElement("small");
		selectDescription.id = selectDescriptionId;
		selectDescription.textContent = this.options.translator.personModal.dossierImageDescription;
		this.photoSelect = document.createElement("select");
		this.photoSelect.id = selectId;
		this.photoSelect.dataset.personPhotoSelect = "true";
		this.photoSelect.setAttribute("aria-describedby", `${selectDescriptionId} ${this.photoStatusEl.id}`);
		this.photoSelect.addEventListener("change", () => {
			const path = this.photoSelect?.value;
			if (path) this.selectAsset(path);
		});
		selectRow.append(selectLabel, selectDescription, this.photoSelect);
		section.append(selectRow);

		const actions = document.createElement("div");
		actions.className = "people-atlas-person-photo-actions";
		const clear = document.createElement("button");
		clear.type = "button";
		clear.textContent = this.options.translator.personModal.clearPhoto;
		clear.addEventListener("click", () => {
			this.values.photo = "";
			this.values.photoSelectionPath = undefined;
			if (this.photoInput) this.photoInput.value = "";
			if (this.photoSelect) this.photoSelect.value = "";
			this.refreshPreview();
			this.photoInput?.focus();
		});
		actions.append(clear);
		section.append(actions);
		container.append(section);
		this.refreshPickerOptions();
	}

	refreshPickerOptions(): void {
		if (!this.photoSelect) return;
		const assets = this.getCurrentPhotoAssets();
		this.filteredPhotoAssets = filterPersonPhotoAssets(assets, this.photoSearchInput?.value ?? "");
		const document = this.photoSelect.ownerDocument;
		const placeholder = document.createElement("option");
		placeholder.value = "";
		if (assets.length === 0) placeholder.textContent = this.options.translator.personModal.noSupportedDossierImages;
		else if (this.filteredPhotoAssets.length === 0)
			placeholder.textContent = this.options.translator.personModal.noDossierImagesMatch;
		else placeholder.textContent = this.options.translator.personModal.chooseDossierImage;
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

	refreshPreview(): void {
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
			this.showFallback(resolution.status, this.fallbackMessage(resolution.status));
			return;
		}
		const resource = resolvePersonPhotoResource(this.options.app, resolution.file.path);
		if (resource.status !== "ready") {
			const fallbackStatus =
				resource.status === "missing" || resource.status === "unsupported" ? resource.status : "unavailable";
			this.showFallback(fallbackStatus, this.fallbackMessage(fallbackStatus));
			return;
		}

		const image = preview.ownerDocument.createElement("img");
		image.className = "people-atlas-person-photo-image";
		image.alt = "";
		image.decoding = "async";
		image.hidden = true;
		this.photoImageEl = image;
		preview.querySelector(".people-atlas-person-photo-frame")?.append(image);
		preview.dataset.photoStatus = "loading";
		status.hidden = false;
		status.textContent = this.options.translator.personModal.photoLoading;
		image.addEventListener("load", () => {
			if (!this.isCurrentImage(image, sequence)) return;
			image.hidden = false;
			initials.hidden = true;
			preview.dataset.photoStatus = "ready";
			status.textContent = "";
			status.hidden = true;
		});
		image.addEventListener("error", () => {
			if (!this.isCurrentImage(image, sequence)) return;
			image.hidden = true;
			initials.hidden = false;
			preview.dataset.photoStatus = "decode-error";
			status.hidden = false;
			status.textContent = this.options.translator.personModal.photoDecodeError;
		});
		image.src = resource.resourceUrl;
	}

	refreshInitials(): void {
		if (this.photoInitialsEl) this.photoInitialsEl.textContent = personPhotoInitials(this.values.name);
	}

	registerAssetListeners(): void {
		this.unregisterAssetListeners();
		const refresh = () => {
			this.refreshPickerOptions();
			this.refreshPreview();
		};
		this.photoEventRefs = [
			this.options.app.vault.on("create", refresh),
			this.options.app.vault.on("modify", refresh),
			this.options.app.vault.on("delete", refresh),
			this.options.app.vault.on("rename", refresh),
		];
	}

	unregisterAssetListeners(): void {
		for (const eventRef of this.photoEventRefs) this.options.app.vault.offref(eventRef);
		this.photoEventRefs = [];
	}

	getCurrentPhotoAssets(): PersonPhotoAsset[] {
		if (this.options.mode.kind !== "edit") return [];
		const dossierPath = this.currentDossierPath();
		if (!dossierPath) return [];
		return dossierPersonPhotoAssets(
			supportedPersonPhotoAssets(this.options.app.vault.getFiles().map((file) => file.path)),
			dossierPath,
		);
	}

	validateSelection(values: Pick<PersonPhotoPickerValues, "photo" | "photoSelectionPath">): void {
		if (values.photoSelectionPath === undefined) return;
		if (this.options.mode.kind === "create") {
			throw new Error("Choose a local photo in Edit after the dossier exists.");
		}
		const dossierPath = this.currentDossierPath();
		if (!dossierPath) {
			throw new Error("The current profile note has no safe canonical dossier boundary.");
		}
		const allAssets = supportedPersonPhotoAssets(this.options.app.vault.getFiles().map((file) => file.path));
		const error = getPendingPersonPhotoSelectionError(values.photo, values.photoSelectionPath, allAssets);
		if (error) throw new Error(error);
		if (
			dossierPersonPhotoAssets(allAssets, dossierPath).filter((asset) => asset.path === values.photoSelectionPath)
				.length !== 1
		) {
			throw new Error("Choose a supported photo from this person's own dossier.");
		}
	}

	private selectAsset(path: string): void {
		const matches = this.getCurrentPhotoAssets().filter((asset) => asset.path === path);
		const asset = matches.length === 1 ? matches[0] : undefined;
		if (!asset) {
			this.showFallback("missing", this.options.translator.personModal.selectedPhotoUnavailable({ path }));
			this.refreshPickerOptions();
			return;
		}
		this.values.photo = canonicalPersonPhotoWikilink(asset.path);
		this.values.photoSelectionPath = asset.path;
		if (this.photoInput) this.photoInput.value = this.values.photo;
		if (this.photoSelect) this.photoSelect.value = asset.path;
		this.refreshPreview();
	}

	private resolvePhoto(): PersonPhotoResolution {
		const rawPhoto = this.values.photo;
		if (!rawPhoto.trim()) return { status: "empty" };
		if (isExternalPhotoReference(rawPhoto)) return { status: "external" };
		const target = parsePersonReference(rawPhoto)?.target.trim();
		if (!target) return { status: "unreadable" };
		if (isExternalPhotoReference(target)) return { status: "external" };

		let file: TFile | undefined;
		if (this.values.photoSelectionPath !== undefined) {
			if (!this.getCurrentPhotoAssets().some((asset) => asset.path === this.values.photoSelectionPath)) {
				return { status: "missing" };
			}
			const matches = this.options.app.vault
				.getFiles()
				.filter((candidate) => candidate.path === this.values.photoSelectionPath);
			file = matches.length === 1 ? matches[0] : undefined;
		} else {
			const exact = this.options.app.vault.getAbstractFileByPath(target);
			if (exact instanceof TFile) file = exact;
			else {
				const resolved = this.options.app.metadataCache.getFirstLinkpathDest(target, this.photoSourcePath());
				if (resolved) file = resolved;
			}
		}
		if (!file) return { status: pathHasUnsupportedExtension(target) ? "unsupported" : "missing" };
		if (!isSupportedPersonPhotoPath(file.path)) return { status: "unsupported" };
		return { status: "ready", file };
	}

	private fallbackMessage(status: Exclude<PersonPhotoResolution["status"], "ready">): string {
		switch (status) {
			case "empty":
				return this.options.translator.personModal.photoEmpty;
			case "external":
				return this.options.translator.personModal.photoExternal;
			case "unreadable":
				return this.options.translator.personModal.photoUnreadable;
			case "missing":
				return this.options.translator.personModal.photoMissing;
			case "unsupported":
				return this.options.translator.personModal.photoUnsupported;
			case "unavailable":
				return this.options.translator.personModal.photoUnavailable;
		}
	}

	private photoSourcePath(): string {
		return this.options.mode.kind === "edit" ? this.options.mode.file.path : "";
	}

	private showFallback(status: Exclude<PersonPhotoResolution["status"], "ready">, message: string): void {
		if (!this.photoPreviewEl || !this.photoInitialsEl || !this.photoStatusEl) return;
		this.photoPreviewSequence += 1;
		this.photoImageEl?.remove();
		this.photoImageEl = undefined;
		this.photoPreviewEl.dataset.photoStatus = status;
		this.photoInitialsEl.hidden = false;
		this.photoStatusEl.hidden = false;
		this.photoStatusEl.textContent = message;
	}

	private currentDossierPath(): string | undefined {
		if (this.options.mode.kind !== "edit") return undefined;
		return personDossierPathFromProfile(
			this.options.getSettings().peopleRootFolder,
			this.options.mode.file.path,
			this.options.mode.personId,
			this.options.app.vault.getAllLoadedFiles().map((file) => file.path),
			this.options.getCurrentPeople(),
		);
	}

	private isCurrentImage(image: HTMLImageElement, sequence: number): boolean {
		return image === this.photoImageEl && sequence === this.photoPreviewSequence && image.isConnected;
	}

	private appendInput(
		container: HTMLElement,
		options: {
			label: string;
			description: string;
			value: string;
			type?: string;
			inputMode?: "email" | "numeric" | "search" | "tel" | "text";
			readOnly?: boolean;
			onInput?(value: string): void;
		},
	): HTMLInputElement {
		const document = container.ownerDocument;
		const row = document.createElement("div");
		row.className = "people-atlas-form-field";
		const id = `people-atlas-person-photo-field-${++pickerSequence}`;
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
}

function appendDescribedBy(control: HTMLElement, id: string): void {
	const ids = new Set((control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
	ids.add(id);
	control.setAttribute("aria-describedby", [...ids].join(" "));
}

function pathHasUnsupportedExtension(path: string): boolean {
	const filename = path.slice(path.lastIndexOf("/") + 1);
	return filename.includes(".") && !isSupportedPersonPhotoPath(path);
}
