import type { App, TFile } from "obsidian";
import { TFile as StubTFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonRecord } from "../../src/domain/types";
import { PersonModal, type PersonModalMode } from "../../src/editor/person-modal";
import type { AtlasMutationService } from "../../src/mutations/atlas-mutation-service";
import type { PersonEditSourceBaseline } from "../../src/mutations/person-source-guard";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";
import { UNSAFE_PEOPLE_ROOT_CASES } from "../people-root-fixtures";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: ["Al"],
	organisations: ["Example Org"],
	emails: [],
	phones: [],
	contacts: [{ raw: "[[Missing|Unknown]]", target: "Missing", label: "Unknown" }],
};

const bob: PersonRecord = {
	id: "person-bob",
	filePath: "People/Bob.md",
	name: "Bob",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const alexPhotoPerson: PersonRecord = {
	id: "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb",
	filePath: "People/Profiles/alex-example--11112222/Alex Example.md",
	name: "Alex Example",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const alexPhotoDossier = "People/Profiles/alex-example--11112222";

const tagSourceBaseline: PersonEditSourceBaseline = {
	mtime: 1,
	size: 8,
	source: "#person\n",
	tagSources: ["body"],
};

interface MountedPersonModal {
	modal: PersonModal;
	content: HTMLElement;
	form: HTMLFormElement;
	title: HTMLElement;
	vaultFiles: TFile[];
	createPerson: ReturnType<typeof vi.fn>;
	updatePerson: ReturnType<typeof vi.fn>;
	getResourcePath: ReturnType<typeof vi.fn>;
	openFile: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
	emitVaultEvent(name: "create" | "modify" | "delete" | "rename", ...args: unknown[]): void;
	photoListenerCount(): number;
}

function mountModal(options?: {
	mode?: PersonModalMode;
	people?: PersonRecord[];
	createPerson?: ReturnType<typeof vi.fn>;
	updatePerson?: ReturnType<typeof vi.fn>;
	getCurrentPeople?: () => PersonRecord[];
	photoFiles?: TFile[];
	getResourcePath?: ReturnType<typeof vi.fn>;
	width?: number;
	ownerDocument?: Document;
	getSettings?: () => typeof DEFAULT_SETTINGS;
}): MountedPersonModal {
	const people = options?.people ?? [alice, bob];
	const createPerson = options?.createPerson ?? vi.fn(async () => personFile("People/Created.md"));
	const updatePerson = options?.updatePerson ?? vi.fn(async (file: TFile) => ({ file, renamed: false }));
	const openFile = vi.fn(async () => undefined);
	const vaultFiles = options?.photoFiles ?? [];
	const getResourcePath = options?.getResourcePath ?? vi.fn((file: TFile) => `app://people-atlas/${file.path}`);
	type VaultListener = (...args: unknown[]) => void;
	interface VaultEventRef {
		name: string;
		callback: VaultListener;
	}
	const vaultListeners = new Map<string, Set<VaultListener>>();
	const vault = {
		getFiles: () => [...vaultFiles],
		getAbstractFileByPath: (path: string) => vaultFiles.find((file) => file.path === path) ?? null,
		getResourcePath,
		on: (name: string, callback: VaultListener): VaultEventRef => {
			const listeners = vaultListeners.get(name) ?? new Set<VaultListener>();
			listeners.add(callback);
			vaultListeners.set(name, listeners);
			return { name, callback };
		},
		offref: (ref: VaultEventRef) => {
			vaultListeners.get(ref.name)?.delete(ref.callback);
		},
	};
	const emitVaultEvent = (name: "create" | "modify" | "delete" | "rename", ...args: unknown[]) => {
		for (const listener of vaultListeners.get(name) ?? []) listener(...args);
	};
	const app = {
		vault,
		metadataCache: {
			getFirstLinkpathDest: (target: string) => {
				const photo = vaultFiles.find((file) => file.path === target);
				if (photo) return photo;
				const person = people.find(
					(candidate) =>
						candidate.id === target ||
						candidate.filePath === target ||
						candidate.filePath.replace(/\.md$/i, "") === target,
				);
				return person ? ({ path: person.filePath } as TFile) : null;
			},
		},
		workspace: {
			getLeaf: () => ({ openFile }),
		},
	} as unknown as App;
	const modal = new PersonModal(
		app,
		options?.mode ?? { kind: "create" },
		people,
		{ createPerson, updatePerson } as unknown as AtlasMutationService,
		options?.getSettings ?? (() => DEFAULT_SETTINGS),
		options?.getCurrentPeople,
	);
	const ownerDocument = options?.ownerDocument ?? document;
	const title = ownerDocument.createElement("h2");
	const content = ownerDocument.createElement("div");
	content.style.boxSizing = "border-box";
	content.style.width = `${options?.width ?? 640}px`;
	content.style.height = "420px";
	content.style.overflow = "auto";
	ownerDocument.body.append(title, content);
	modal.titleEl = title;
	modal.contentEl = content;
	const close = vi.fn(() => modal.onClose());
	modal.close = close;
	modal.onOpen();
	const form = content.querySelector<HTMLFormElement>("form");
	if (!form) throw new Error("Person form was not mounted.");
	return {
		modal,
		content,
		form,
		title,
		vaultFiles,
		createPerson,
		updatePerson,
		getResourcePath,
		openFile,
		close,
		emitVaultEvent,
		photoListenerCount: () => [...vaultListeners.values()].reduce((count, listeners) => count + listeners.size, 0),
	};
}

function personFile(path: string): TFile {
	const file = new StubTFile();
	file.path = path;
	const name = path.split("/").at(-1) ?? "";
	const dot = name.lastIndexOf(".");
	file.name = name;
	file.basename = dot < 0 ? name : name.slice(0, dot);
	file.extension = dot < 0 ? "" : name.slice(dot + 1);
	return file;
}

function inputForLabel(content: HTMLElement, text: string): HTMLInputElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === text);
	const input = label?.htmlFor ? content.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
	if (!input) throw new Error(`No input found for ${text}.`);
	return input;
}

function selectForLabel(content: HTMLElement, text: string): HTMLSelectElement {
	const label = Array.from(content.querySelectorAll("label")).find((candidate) => candidate.textContent === text);
	const select = label?.htmlFor ? content.querySelector<HTMLSelectElement>(`#${label.htmlFor}`) : null;
	if (!select) throw new Error(`No select found for ${text}.`);
	return select;
}

function buttonWithText(content: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(content.querySelectorAll("button")).find((candidate) => candidate.textContent === text);
	if (!button) throw new Error(`No button found with text ${text}.`);
	return button;
}

function setInput(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

function pressKey(input: HTMLInputElement, key: string): void {
	const OwnerKeyboardEvent = input.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
	input.dispatchEvent(new OwnerKeyboardEvent("keydown", { bubbles: true, key }));
}

function dispatchImageEvent(image: HTMLImageElement, name: "load" | "error"): void {
	const OwnerEvent = image.ownerDocument.defaultView?.Event ?? Event;
	image.dispatchEvent(new OwnerEvent(name));
}

function describedByElements(content: HTMLElement, input: HTMLInputElement): HTMLElement[] {
	const ids = input.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) ?? [];
	const OwnerHTMLElement = content.ownerDocument.defaultView?.HTMLElement;
	return ids.map((id) => {
		const element = content.ownerDocument.getElementById(id);
		if (!OwnerHTMLElement || !(element instanceof OwnerHTMLElement) || !content.contains(element)) {
			throw new Error(`aria-describedby target ${id} is missing from the person modal.`);
		}
		return element as HTMLElement;
	});
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("person modal", () => {
	it("renders the curated semantic sections in order with Advanced collapsed and reviewable identity", () => {
		const file = personFile(alice.filePath);
		const { content, form, title } = mountModal({
			mode: {
				kind: "edit",
				file,
				person: alice,
				rawPhoto: "[[Assets/alice.png]]",
			},
		});

		expect(title.textContent).toBe("Edit person");
		expect(
			Array.from(form.children)
				.filter((child) => child.matches("fieldset, details"))
				.map((child) => child.querySelector("legend, summary")?.textContent?.split(" — ")[0]),
		).toEqual(["Basic", "Profile", "Contact details", "Linked people", "Advanced"]);
		expect(Array.from(content.querySelectorAll("label")).map((label) => label.textContent)).toEqual([
			"Name",
			"Photo",
			"Search dossier images",
			"Dossier image",
			"Aliases",
			"Month",
			"Day",
			"Year (optional)",
			"Pronouns",
			"Gender",
			"Job title",
			"Organisations",
			"Add a linked person",
			"Current person note path",
			"Person ID",
		]);
		const advanced = content.querySelector<HTMLDetailsElement>(".people-atlas-person-advanced");
		expect(advanced?.open).toBe(false);
		expect(advanced?.querySelector("summary")?.textContent).toBe("Advanced — Current path: People/Alice.md");
		expect(inputForLabel(content, "Current person note path").readOnly).toBe(true);
		expect(inputForLabel(content, "Person ID").readOnly).toBe(true);
		expect(inputForLabel(content, "Photo").readOnly).toBe(true);
		expect(content.textContent).toContain("Unresolved or ambiguous — [[Missing|Unknown]]");
		expect(content.textContent).toContain("Use Create relationship for roles, dates, status");
		expect(content.textContent).not.toContain("Relationship ID");
		expect(content.textContent).not.toContain("Contacts");
		for (const control of Array.from(content.querySelectorAll<HTMLInputElement>(".people-atlas-person-form input"))) {
			expect(describedByElements(content, control).length).toBeGreaterThan(0);
		}
	});

	it("plans one stable person ID at open and reuses its dossier path through the first Save", async () => {
		vi.spyOn(crypto, "randomUUID").mockReturnValue("7d9f4a12-6b3c-4d5e-8f90-123456789abc");
		const createdFile = personFile("People/Profiles/alice-admin--7d9f4a12/Alice - Admin.md");
		const createPerson = vi.fn(async (_input: unknown) => createdFile);
		const { content, openFile, photoListenerCount } = mountModal({ createPerson });

		expect(inputForLabel(content, "Person ID").value).toBe("person-7d9f4a12-6b3c-4d5e-8f90-123456789abc");
		expect(Array.from(content.querySelectorAll("label")).map((label) => label.textContent)).not.toContain("Photo");
		expect(content.querySelector("[data-person-photo-select]")).toBeNull();
		expect(content.textContent).not.toContain("Search dossier images");
		expect(photoListenerCount()).toBe(0);
		setInput(inputForLabel(content, "Name"), "Alice / Admin");
		expect(inputForLabel(content, "Person note path").value).toBe(createdFile.path);
		expect(createPerson).not.toHaveBeenCalled();

		buttonWithText(content, "Save").click();
		await vi.waitFor(() =>
			expect(createPerson).toHaveBeenCalledExactlyOnceWith({
				name: "Alice / Admin",
				personId: "person-7d9f4a12-6b3c-4d5e-8f90-123456789abc",
				reviewedPath: "People/Profiles/alice-admin--7d9f4a12/Alice - Admin.md",
			}),
		);
		await vi.waitFor(() => expect(openFile).toHaveBeenCalledWith(createdFile));
		expect(createPerson.mock.calls[0]?.[0]).not.toHaveProperty("photo");
	});

	it("explains the create photo steps accessibly and keeps Cancel and host close mutation-free", () => {
		const cancelled = mountModal();
		const note = cancelled.content.querySelector<HTMLElement>('[role="note"]');
		expect(note).not.toBeNull();
		if (!note) throw new Error("Expected the accessible create photo note.");
		expect(note.isConnected).toBe(true);
		expect(note.hidden).toBe(false);
		expect(getComputedStyle(note).display).not.toBe("none");
		expect(note.textContent).toMatch(/Save.+person.+dossier/i);
		expect(note.textContent).toMatch(/place.+image.+dossier/i);
		expect(note.textContent).toMatch(/Edit.+choose/i);
		expect(note.textContent).not.toMatch(/upload|import/i);
		expect(Array.from(cancelled.content.querySelectorAll("label")).map((label) => label.textContent)).not.toContain(
			"Photo",
		);
		expect(cancelled.content.querySelector("[data-person-photo-select]")).toBeNull();
		expect(cancelled.content.textContent).not.toContain("Search dossier images");
		expect(cancelled.photoListenerCount()).toBe(0);

		buttonWithText(cancelled.content, "Cancel").click();

		expect(cancelled.createPerson).not.toHaveBeenCalled();
		expect(cancelled.updatePerson).not.toHaveBeenCalled();
		expect(cancelled.photoListenerCount()).toBe(0);

		const hostClosed = mountModal();
		expect(hostClosed.photoListenerCount()).toBe(0);

		hostClosed.modal.onClose();

		expect(hostClosed.createPerson).not.toHaveBeenCalled();
		expect(hostClosed.updatePerson).not.toHaveBeenCalled();
		expect(hostClosed.photoListenerCount()).toBe(0);
		expect(hostClosed.content.childElementCount).toBe(0);
	});

	it("selects duplicate-named vault images by exact path during edit and writes only on Save", async () => {
		const dossierPortrait = personFile(`${alexPhotoDossier}/Alex.jpg`);
		const descendantPortrait = personFile(`${alexPhotoDossier}/Photos/Alex.jpg`);
		const outsidePortrait = personFile("Assets/Alex.jpg");
		const siblingPortrait = personFile("People/Profiles/alex-other--99999999/Photos/Alex.jpg");
		const prefixLookalikePortrait = personFile("People/Profiles/alex-example--111122220/Photos/Alex.jpg");
		const unsupported = personFile(`${alexPhotoDossier}/Alex.svg`);
		const file = personFile(alexPhotoPerson.filePath);
		const updatePerson = vi.fn(async (updatedFile: TFile) => ({ file: updatedFile, renamed: false }));
		const { content, createPerson, getResourcePath } = mountModal({
			mode: { kind: "edit", file, person: alexPhotoPerson },
			people: [alexPhotoPerson, bob],
			photoFiles: [
				outsidePortrait,
				descendantPortrait,
				siblingPortrait,
				unsupported,
				prefixLookalikePortrait,
				dossierPortrait,
			],
			updatePerson,
		});
		const select = selectForLabel(content, "Dossier image");
		expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
			"Choose a dossier image",
			`Alex.jpg — ${dossierPortrait.path}`,
			`Alex.jpg — ${descendantPortrait.path}`,
		]);
		expect(content.textContent).toContain("this person's own dossier");

		const search = inputForLabel(content, "Search dossier images");
		setInput(search, "photos");
		expect(Array.from(select.options).map((option) => option.value)).toEqual(["", descendantPortrait.path]);
		pressKey(search, "ArrowDown");
		expect(select.value).toBe(descendantPortrait.path);
		expect(select.ownerDocument.activeElement).toBe(select);
		expect(inputForLabel(content, "Photo").value).toBe("");
		search.focus();
		pressKey(search, "Enter");

		expect(inputForLabel(content, "Photo").value).toBe(`[[${descendantPortrait.path}]]`);
		expect(createPerson).not.toHaveBeenCalled();
		expect(getResourcePath).toHaveBeenCalledWith(descendantPortrait);
		select.value = outsidePortrait.path;
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(select.value).toBe("");
		expect(inputForLabel(content, "Photo").value).toBe(`[[${descendantPortrait.path}]]`);
		const image = content.querySelector<HTMLImageElement>(".people-atlas-person-photo-image");
		if (!image) throw new Error("Expected a pending photo preview.");
		expect(content.querySelector(".people-atlas-person-photo-initials")?.textContent).toBe("AE");
		expect(image.alt).toBe("");
		expect(image.hidden).toBe(true);
		expect(content.textContent).toContain("Loading the selected vault image");

		dispatchImageEvent(image, "load");

		expect(image.hidden).toBe(false);
		expect(getComputedStyle(image).objectFit).toBe("cover");
		expect(content.querySelector<HTMLElement>(".people-atlas-person-photo-initials")?.hidden).toBe(true);
		buttonWithText(content, "Save").click();
		await vi.waitFor(() =>
			expect(updatePerson).toHaveBeenCalledWith(
				file,
				{ photo: `[[${descendantPortrait.path}]]` },
				{ expectedPersonId: alexPhotoPerson.id, expectedClassification: "type" },
			),
		);
		expect(createPerson).not.toHaveBeenCalled();
	});

	it("requeries the current dossier and fails a pending selection closed after People root drift", async () => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const portrait = personFile(`${alexPhotoDossier}/Alex.jpg`);
		const file = personFile(alexPhotoPerson.filePath);
		const mounted = mountModal({
			mode: { kind: "edit", file, person: alexPhotoPerson },
			people: [alexPhotoPerson, bob],
			photoFiles: [portrait],
			getSettings: () => settings,
		});
		const select = selectForLabel(mounted.content, "Dossier image");
		select.value = portrait.path;
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(inputForLabel(mounted.content, "Photo").value).toBe(`[[${portrait.path}]]`);
		expect(mounted.updatePerson).not.toHaveBeenCalled();

		settings.peopleRootFolder = "Archive";
		mounted.emitVaultEvent("modify", portrait);

		expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["No supported dossier images"]);
		expect(inputForLabel(mounted.content, "Photo").value).toBe(`[[${portrait.path}]]`);
		buttonWithText(mounted.content, "Save").click();
		await vi.waitFor(() => expect(mounted.content.textContent).toContain("no safe canonical dossier boundary"));
		expect(mounted.updatePerson).not.toHaveBeenCalled();
	});

	it.each(UNSAFE_PEOPLE_ROOT_CASES)("shows no dossier option for a directly injected $label People root", ({
		root,
	}) => {
		const dossierPath = `${root}/Profiles/alex-example--11112222`;
		const person = {
			...alexPhotoPerson,
			filePath: `${dossierPath}/Alex Example.md`,
		};
		const portrait = personFile(`${dossierPath}/Alex.jpg`);
		const mounted = mountModal({
			mode: { kind: "edit", file: personFile(person.filePath), person },
			people: [person, bob],
			photoFiles: [portrait],
			getSettings: () => ({ ...DEFAULT_SETTINGS, peopleRootFolder: root }),
		});
		const select = selectForLabel(mounted.content, "Dossier image");

		expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["No supported dossier images"]);
		select.value = portrait.path;
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(inputForLabel(mounted.content, "Photo").value).toBe("");
		expect(mounted.updatePerson).not.toHaveBeenCalled();
		expect(mounted.close).not.toHaveBeenCalled();
		mounted.modal.onClose();
	});

	it.each(
		UNSAFE_PEOPLE_ROOT_CASES,
	)("keeps a pending direct selection Save update- and close-free after a $label People root is injected", async ({
		root,
	}) => {
		const settings = structuredClone(DEFAULT_SETTINGS);
		const portrait = personFile(`${alexPhotoDossier}/Alex.jpg`);
		const file = personFile(alexPhotoPerson.filePath);
		const mounted = mountModal({
			mode: { kind: "edit", file, person: alexPhotoPerson },
			people: [alexPhotoPerson, bob],
			photoFiles: [portrait],
			getSettings: () => settings,
		});
		const select = selectForLabel(mounted.content, "Dossier image");
		select.value = portrait.path;
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(inputForLabel(mounted.content, "Photo").value).toBe(`[[${portrait.path}]]`);

		settings.peopleRootFolder = root;
		mounted.emitVaultEvent("modify", portrait);

		expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["No supported dossier images"]);
		expect(inputForLabel(mounted.content, "Photo").value).toBe(`[[${portrait.path}]]`);
		buttonWithText(mounted.content, "Save").click();
		await vi.waitFor(() => expect(mounted.content.textContent).toContain("no safe canonical dossier boundary"));
		expect(mounted.updatePerson).not.toHaveBeenCalled();
		expect(mounted.close).not.toHaveBeenCalled();
		mounted.modal.onClose();
	});

	it("keeps an unchanged authored photo byte-exact and blocks direct input editing", async () => {
		const file = personFile(alice.filePath);
		const portrait = personFile("Assets/alice.png");
		const rawPhoto = "  [[Assets/alice.png|Portrait]]  ";
		const updatePerson = vi.fn(async (updatedFile: TFile) => ({ file: updatedFile, renamed: false }));
		const { content } = mountModal({
			mode: {
				kind: "edit",
				file,
				person: alice,
				rawPhoto,
			},
			photoFiles: [portrait],
			updatePerson,
		});
		const photo = inputForLabel(content, "Photo");
		expect(photo.readOnly).toBe(true);
		expect(photo.value).toBe(rawPhoto);
		setInput(photo, "https://example.test/replacement.jpg");
		setInput(inputForLabel(content, "Pronouns"), "she/her");

		buttonWithText(content, "Save").click();

		await vi.waitFor(() =>
			expect(updatePerson).toHaveBeenCalledWith(
				file,
				{ pronouns: "she/her" },
				{
					expectedPersonId: alice.id,
					expectedClassification: "type",
				},
			),
		);
	});

	it("shows visible network, unsupported, missing and decode fallbacks without fetching raw references", () => {
		const editFile = personFile(alice.filePath);
		const network = mountModal({
			mode: {
				kind: "edit",
				file: editFile,
				person: alice,
				rawPhoto: "https://example.test/alice.jpg",
			},
		});
		expect(network.content.textContent).toContain("External or network photo references are not supported");
		expect(network.getResourcePath).not.toHaveBeenCalled();
		expect(network.content.querySelector(".people-atlas-person-photo-image")).toBeNull();
		buttonWithText(network.content, "Cancel").click();

		const vector = personFile("Assets/alice.svg");
		const unsupported = mountModal({
			mode: {
				kind: "edit",
				file: editFile,
				person: alice,
				rawPhoto: "[[Assets/alice.svg]]",
			},
			photoFiles: [vector],
		});
		expect(unsupported.content.textContent).toContain("This photo format is unsupported");
		expect(unsupported.getResourcePath).not.toHaveBeenCalled();
		buttonWithText(unsupported.content, "Cancel").click();

		const missing = mountModal({
			mode: {
				kind: "edit",
				file: editFile,
				person: alice,
				rawPhoto: "[[Assets/missing.webp]]",
			},
		});
		expect(missing.content.textContent).toContain("referenced vault image is missing");
		expect(missing.getResourcePath).not.toHaveBeenCalled();
		buttonWithText(missing.content, "Cancel").click();

		const portrait = personFile("Assets/alice.png");
		const decode = mountModal({
			mode: {
				kind: "edit",
				file: editFile,
				person: alice,
				rawPhoto: "[[Assets/alice.png]]",
			},
			photoFiles: [portrait],
		});
		const image = decode.content.querySelector<HTMLImageElement>(".people-atlas-person-photo-image");
		if (!image) throw new Error("Expected a vault image preview.");
		dispatchImageEvent(image, "error");
		expect(decode.content.textContent).toContain("could not be decoded");
		expect(decode.content.querySelector<HTMLElement>(".people-atlas-person-photo-initials")?.hidden).toBe(false);
		buttonWithText(decode.content, "Cancel").click();
	});

	it("clears only the photo property after explicit Save", async () => {
		const file = personFile(alice.filePath);
		const portrait = personFile("Assets/alice.png");
		const updatePerson = vi.fn(async (updatedFile: TFile) => ({ file: updatedFile, renamed: false }));
		const { content } = mountModal({
			mode: {
				kind: "edit",
				file,
				person: alice,
				rawPhoto: "[[Assets/alice.png]]",
			},
			photoFiles: [portrait],
			updatePerson,
		});

		buttonWithText(content, "Clear photo").click();

		expect(inputForLabel(content, "Photo").value).toBe("");
		expect(content.textContent).toContain("No photo is selected");
		expect(updatePerson).not.toHaveBeenCalled();
		buttonWithText(content, "Save").click();
		await vi.waitFor(() =>
			expect(updatePerson).toHaveBeenCalledWith(
				file,
				{ photo: null },
				{
					expectedPersonId: alice.id,
					expectedClassification: "type",
				},
			),
		);
	});

	it("refreshes on asset events, ignores late preview events and fails a renamed selection closed", async () => {
		const portrait = personFile(`${alexPhotoDossier}/Carol.jpg`);
		const file = personFile(alexPhotoPerson.filePath);
		const mounted = mountModal({
			mode: { kind: "edit", file, person: alexPhotoPerson },
			people: [alexPhotoPerson, bob],
			photoFiles: [portrait],
		});
		const select = selectForLabel(mounted.content, "Dossier image");
		select.value = portrait.path;
		select.dispatchEvent(new Event("change", { bubbles: true }));
		const firstImage = mounted.content.querySelector<HTMLImageElement>(".people-atlas-person-photo-image");
		if (!firstImage) throw new Error("Expected the first preview image.");
		expect(mounted.photoListenerCount()).toBe(4);

		portrait.stat.mtime = 2;
		mounted.emitVaultEvent("modify", portrait);
		const refreshedImage = mounted.content.querySelector<HTMLImageElement>(".people-atlas-person-photo-image");
		if (!refreshedImage) throw new Error("Expected the refreshed preview image.");
		expect(refreshedImage).not.toBe(firstImage);
		expect(refreshedImage.getAttribute("src")).not.toBe(firstImage.getAttribute("src"));
		dispatchImageEvent(firstImage, "load");
		expect(mounted.content.querySelector(".people-atlas-person-photo-preview")?.getAttribute("data-photo-status")).toBe(
			"loading",
		);
		dispatchImageEvent(refreshedImage, "load");
		expect(mounted.content.querySelector(".people-atlas-person-photo-preview")?.getAttribute("data-photo-status")).toBe(
			"ready",
		);

		const oldPath = portrait.path;
		portrait.path = `${alexPhotoDossier}/Renamed Carol.jpg`;
		portrait.name = "Renamed Carol.jpg";
		portrait.basename = "Renamed Carol";
		mounted.emitVaultEvent("rename", portrait, oldPath);
		expect(mounted.content.textContent).toContain("referenced vault image is missing");
		expect(inputForLabel(mounted.content, "Photo").value).toBe(`[[${alexPhotoDossier}/Carol.jpg]]`);

		buttonWithText(mounted.content, "Save").click();
		await vi.waitFor(() => expect(mounted.content.textContent).toContain("no longer uniquely available"));
		expect(mounted.updatePerson).not.toHaveBeenCalled();

		mounted.vaultFiles.splice(0, 1);
		mounted.emitVaultEvent("delete", portrait);
		expect(mounted.content.textContent).toContain("referenced vault image is missing");
		buttonWithText(mounted.content, "Cancel").click();
		expect(mounted.photoListenerCount()).toBe(0);
	});

	it("shows inline email feedback, focuses the invalid entry, and remains retryable after a mutation failure", async () => {
		vi.spyOn(crypto, "randomUUID").mockReturnValue("bbbbbbbb-cccc-4ddd-8eee-ffffffffffff");
		const createdFile = personFile("People/Carol.md");
		const createPerson = vi.fn(async () => createdFile);
		createPerson.mockRejectedValueOnce(new Error("The vault is temporarily busy."));
		const { content, close, openFile } = mountModal({ createPerson });
		setInput(inputForLabel(content, "Name"), "Carol");
		buttonWithText(content, "Add email address").click();
		const email = inputForLabel(content, "Email address 1");

		for (const invalid of ["person @example.com", "person@@example.com"]) {
			setInput(email, invalid);
			expect(email.getAttribute("aria-invalid")).toBe("true");
			expect(describedByElements(content, email).some((element) => element.textContent?.includes("one @"))).toBe(true);
		}
		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(document.activeElement).toBe(email));
		expect(createPerson).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();

		setInput(email, " person@example.com ");
		expect(email.hasAttribute("aria-invalid")).toBe(false);
		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(content.textContent).toContain("temporarily busy"));
		expect(createPerson).toHaveBeenCalledWith({
			name: "Carol",
			personId: "person-bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
			reviewedPath: "People/Profiles/carol--bbbbbbbb/Carol.md",
			emails: ["person@example.com"],
		});
		expect(buttonWithText(content, "Save").disabled).toBe(false);
		expect(close).not.toHaveBeenCalled();

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(createPerson).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => expect(openFile).toHaveBeenCalledWith(createdFile));
		expect(close).toHaveBeenCalledOnce();
	});

	it("adds, validates and removes ordered email and phone entries without hiding their normalization", async () => {
		vi.spyOn(crypto, "randomUUID").mockReturnValue("cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa");
		const { content, createPerson } = mountModal();
		setInput(inputForLabel(content, "Name"), "Carol");
		buttonWithText(content, "Add email address").click();
		setInput(inputForLabel(content, "Email address 1"), " Alice@example.com ");
		buttonWithText(content, "Add email address").click();
		const duplicateEmail = inputForLabel(content, "Email address 2");
		setInput(duplicateEmail, "alice@example.com");
		expect(duplicateEmail.getAttribute("aria-invalid")).toBe("true");
		expect(
			describedByElements(content, duplicateEmail).some((element) => element.textContent?.includes("Duplicate")),
		).toBe(true);
		content.querySelector<HTMLButtonElement>('[aria-label="Remove email address 1"]')?.click();
		expect(content.querySelectorAll('[data-profile-list="email"]')).toHaveLength(1);

		buttonWithText(content, "Add phone number").click();
		setInput(inputForLabel(content, "Phone number 1"), " +31 (0)20 123 ");
		buttonWithText(content, "Add phone number").click();
		const duplicatePhone = inputForLabel(content, "Phone number 2");
		setInput(duplicatePhone, "+31 (0)20 123");
		expect(duplicatePhone.getAttribute("aria-invalid")).toBe("true");
		expect(
			describedByElements(content, duplicatePhone).some((element) => element.textContent?.includes("Duplicate")),
		).toBe(true);
		content.querySelector<HTMLButtonElement>('[aria-label="Remove phone number 1"]')?.click();
		expect(content.querySelectorAll('[data-profile-list="phone"]')).toHaveLength(1);

		buttonWithText(content, "Save").click();
		await vi.waitFor(() =>
			expect(createPerson).toHaveBeenCalledWith({
				name: "Carol",
				personId: "person-cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa",
				reviewedPath: "People/Profiles/carol--cccccccc/Carol.md",
				emails: ["alice@example.com"],
				phones: ["+31 (0)20 123"],
			}),
		);
	});

	it("distinguishes clearing only a birth year from explicitly clearing the full birth date", async () => {
		const datedAlice: PersonRecord = { ...alice, birthDate: "2000-02-29" };
		const firstFile = personFile(datedAlice.filePath);
		const firstUpdate = vi.fn(async (file: TFile) => ({ file, renamed: false }));
		const first = mountModal({
			mode: {
				kind: "edit",
				file: firstFile,
				person: datedAlice,
			},
			people: [datedAlice, bob],
			updatePerson: firstUpdate,
		});
		expect(inputForLabel(first.content, "Month").value).toBe("02");
		expect(inputForLabel(first.content, "Day").value).toBe("29");
		expect(inputForLabel(first.content, "Year (optional)").value).toBe("2000");
		setInput(inputForLabel(first.content, "Year (optional)"), "");
		buttonWithText(first.content, "Save").click();
		await vi.waitFor(() =>
			expect(firstUpdate).toHaveBeenCalledWith(firstFile, { birthDate: "--02-29" }, expect.anything()),
		);

		const secondFile = personFile(datedAlice.filePath);
		const secondUpdate = vi.fn(async (file: TFile) => ({ file, renamed: false }));
		const second = mountModal({
			mode: {
				kind: "edit",
				file: secondFile,
				person: datedAlice,
			},
			people: [datedAlice, bob],
			updatePerson: secondUpdate,
		});
		buttonWithText(second.content, "Clear birth date").click();
		expect(inputForLabel(second.content, "Month").value).toBe("");
		expect(inputForLabel(second.content, "Day").value).toBe("");
		expect(inputForLabel(second.content, "Year (optional)").value).toBe("");
		buttonWithText(second.content, "Save").click();
		await vi.waitFor(() =>
			expect(secondUpdate).toHaveBeenCalledWith(secondFile, { birthDate: null }, expect.anything()),
		);
	});

	it("requires explicit rename confirmation and sends the original identity and classification guards", async () => {
		const file = personFile(alice.filePath);
		const updatePerson = vi.fn(async (updatedFile: TFile) => ({ file: updatedFile, renamed: true }));
		const { content, title, close } = mountModal({
			mode: {
				kind: "edit",
				file,
				person: alice,
				personClassification: "tag",
				sourceBaseline: tagSourceBaseline,
			},
			updatePerson,
		});
		setInput(inputForLabel(content, "Name"), "Alice Example");

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(title.textContent).toBe("Confirm person rename"));
		expect(content.textContent).toContain("People/Alice.md");
		expect(content.textContent).toContain("People/Alice Example.md");
		expect(updatePerson).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();

		buttonWithText(content, "Rename and save").click();
		await vi.waitFor(() => expect(updatePerson).toHaveBeenCalledOnce());
		expect(updatePerson).toHaveBeenCalledWith(
			file,
			{ name: "Alice Example" },
			{
				targetPath: "People/Alice Example.md",
				expectedPersonId: alice.id,
				expectedClassification: "tag",
				sourceBaseline: tagSourceBaseline,
			},
		);
		await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
	});

	it("keeps create open and write-free when a newly linked person disappears after open", async () => {
		let currentPeople = [alice, bob];
		const { content, createPerson, close } = mountModal({
			getCurrentPeople: () => currentPeople,
		});
		setInput(inputForLabel(content, "Name"), "Carol");
		setInput(inputForLabel(content, "Add a linked person"), bob.filePath);
		buttonWithText(content, "Add linked person").click();
		expect(content.textContent).toContain("Bob — People/Bob.md");
		currentPeople = [alice];

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(content.textContent).toContain("no longer uniquely available"));
		expect(createPerson).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
		expect(buttonWithText(content, "Save").disabled).toBe(false);
	});

	it("reflows at narrow width, keeps actions outside Advanced, and cancels without a mutation", () => {
		const file = personFile(alexPhotoPerson.filePath);
		const portrait = personFile(`${alexPhotoDossier}/Alex.jpg`);
		const { content, form, createPerson, updatePerson, close } = mountModal({
			mode: {
				kind: "edit",
				file,
				person: alexPhotoPerson,
			},
			people: [alexPhotoPerson, bob],
			photoFiles: [portrait],
			width: 320,
		});
		const advanced = content.querySelector<HTMLDetailsElement>(".people-atlas-person-advanced");
		if (!advanced) throw new Error("Expected Advanced disclosure.");
		expect(advanced.open).toBe(false);
		advanced.open = true;
		expect(inputForLabel(content, "Current person note path").readOnly).toBe(true);
		expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
		expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
		const cancel = buttonWithText(content, "Cancel");
		const save = buttonWithText(content, "Save");
		expect(advanced.contains(cancel)).toBe(false);
		expect(advanced.contains(save)).toBe(false);
		const photoSelect = selectForLabel(content, "Dossier image");
		photoSelect.value = portrait.path;
		photoSelect.dispatchEvent(new Event("change", { bubbles: true }));
		expect(inputForLabel(content, "Photo").value).toBe(`[[${portrait.path}]]`);

		cancel.click();

		expect(close).toHaveBeenCalledOnce();
		expect(createPerson).not.toHaveBeenCalled();
		expect(updatePerson).not.toHaveBeenCalled();
	});

	it("creates and focuses controls in the modal's owning pop-out document", () => {
		const frame = document.createElement("iframe");
		document.body.append(frame);
		const frameDocument = frame.contentDocument;
		if (!frameDocument) throw new Error("Expected an iframe document.");
		const portrait = personFile(`${alexPhotoDossier}/Popout.webp`);
		const file = personFile(alexPhotoPerson.filePath);
		const { content } = mountModal({
			mode: { kind: "edit", file, person: alexPhotoPerson },
			people: [alexPhotoPerson, bob],
			ownerDocument: frameDocument,
			photoFiles: [portrait],
		});

		expect(Array.from(content.querySelectorAll("*")).every((element) => element.ownerDocument === frameDocument)).toBe(
			true,
		);
		const name = inputForLabel(content, "Name");
		expect(frameDocument.activeElement).toBe(name);
		const select = selectForLabel(content, "Dossier image");
		select.value = portrait.path;
		const OwnerEvent = frameDocument.defaultView?.Event ?? Event;
		select.dispatchEvent(new OwnerEvent("change", { bubbles: true }));
		const image = content.querySelector<HTMLImageElement>(".people-atlas-person-photo-image");
		if (!image) throw new Error("Expected a pop-out-owned preview image.");
		expect(image.ownerDocument).toBe(frameDocument);
		expect(image.alt).toBe("");
		dispatchImageEvent(image, "load");
		expect(image.hidden).toBe(false);
	});
});
