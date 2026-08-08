import type { App, TFile } from "obsidian";
import { TFile as StubTFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notices } from "../obsidian-stub";
import { createTranslator, type Translator } from "../../src/i18n";
import type { PersonRecord, RelationshipRecord } from "../../src/domain/types";
import {
	RelationshipModal,
	type RelationshipModalMode,
	type RelationshipTemplateCreation,
} from "../../src/editor/relationship-modal";
import type { AtlasMutationService } from "../../src/mutations/atlas-mutation-service";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { RelationshipPresetModal } from "../../src/settings/relationship-preset-modal";
import type { RelationshipPreset } from "../../src/settings/relationship-presets";
import type { PeopleAtlasSettings } from "../../src/settings/types";
import "../../styles.css";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice",
	aliases: [],
	organisations: [],
	gender: "woman",
	emails: [],
	phones: [],
	contacts: [],
};

const bob: PersonRecord = {
	id: "person-bob",
	filePath: "People/Bob.md",
	name: "Bob",
	aliases: [],
	organisations: [],
	gender: "man",
	emails: [],
	phones: [],
	contacts: [],
};

const charlie: PersonRecord = {
	id: "person-charlie",
	filePath: "People/Charlie.md",
	name: "Charlie",
	aliases: [],
	organisations: [],
	gender: "woman",
	emails: [],
	phones: [],
	contacts: [],
};

const friendship: RelationshipPreset = {
	id: "friendship",
	name: "Friendship",
	types: ["friend"],
	fromRole: "friend",
	toRole: "friend",
};

interface SettingsReference {
	current: PeopleAtlasSettings;
}

interface MountedRelationshipModal {
	modal: RelationshipModal;
	content: HTMLElement;
	form: HTMLFormElement;
	settings: SettingsReference;
	createRelationship: ReturnType<typeof vi.fn>;
	updateRelationship: ReturnType<typeof vi.fn>;
	openFile: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
	afterClose: ReturnType<typeof vi.fn>;
}

function mountModal(options?: {
	mode?: RelationshipModalMode;
	settings?: PeopleAtlasSettings;
	templateCreation?: RelationshipTemplateCreation;
	createRelationship?: ReturnType<typeof vi.fn>;
	updateRelationship?: ReturnType<typeof vi.fn>;
	getCurrentPeople?: () => PersonRecord[];
	width?: number;
	ownerDocument?: Document;
	translator?: Translator;
}): MountedRelationshipModal {
	const settings = { current: structuredClone(options?.settings ?? DEFAULT_SETTINGS) };
	const createRelationship = options?.createRelationship ?? vi.fn(async () => relationshipFile("Created.md"));
	const updateRelationship = options?.updateRelationship ?? vi.fn(async () => undefined);
	const openFile = vi.fn(async () => undefined);
	const app = {
		metadataCache: {
			getFirstLinkpathDest: (target: string) => {
				const person = [alice, bob, charlie].find(
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
	const afterClose = vi.fn();
	const RelationshipModalWithTranslator = RelationshipModal as unknown as new (
		app: App,
		mode: RelationshipModalMode,
		people: PersonRecord[],
		mutations: AtlasMutationService,
		getSettings: () => PeopleAtlasSettings,
		afterClose?: () => void,
		templateCreation?: RelationshipTemplateCreation,
		getCurrentPeople?: () => PersonRecord[],
		onCreateSuccess?: undefined,
		translator?: Translator,
	) => RelationshipModal;
	const modal = new RelationshipModalWithTranslator(
		app,
		options?.mode ?? {
			kind: "create",
			fromPersonPath: alice.filePath,
			toPersonPath: bob.filePath,
			myPersonPath: alice.filePath,
		},
		[alice, bob, charlie],
		{ createRelationship, updateRelationship } as unknown as AtlasMutationService,
		() => settings.current,
		afterClose,
		options?.templateCreation,
		options?.getCurrentPeople,
		undefined,
		options?.translator,
	);
	const ownerDocument = options?.ownerDocument ?? document;
	const title = ownerDocument.createElement("h2");
	const content = ownerDocument.createElement("div");
	content.style.boxSizing = "border-box";
	content.style.width = `${options?.width ?? 640}px`;
	content.style.height = "360px";
	content.style.overflow = "auto";
	ownerDocument.body.append(title, content);
	modal.titleEl = title;
	modal.contentEl = content;
	const close = vi.fn(() => modal.onClose());
	modal.close = close;
	modal.onOpen();
	const form = content.querySelector<HTMLFormElement>("form");
	if (!form) throw new Error("Relationship form was not mounted.");
	return {
		modal,
		content,
		form,
		settings,
		createRelationship,
		updateRelationship,
		openFile,
		close,
		afterClose,
	};
}

function relationshipFile(path: string): TFile {
	const file = new StubTFile();
	file.path = path;
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
	if (!button) throw new Error(`No button found for ${text}.`);
	return button;
}

function setInput(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

function choose(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("relationship modal", () => {
	it("collapses the shortcut and template conveniences by default, keeping only the core relationship fields visible", () => {
		const { content } = mountModal();
		const section = Array.from(
			content.querySelectorAll<HTMLFieldSetElement>("fieldset.people-atlas-relationship-section"),
		).find((fieldset) => fieldset.querySelector("legend")?.textContent === "Relationship");
		if (!section) throw new Error("Expected Relationship section.");

		const shortcut = section.querySelector<HTMLDetailsElement>(".people-atlas-relationship-shortcut");
		const template = section.querySelector<HTMLDetailsElement>(".people-atlas-relationship-template");
		if (!shortcut) throw new Error("Expected a collapsed shortcut disclosure.");
		if (!template) throw new Error("Expected a collapsed template disclosure.");

		// Both disclosures are collapsed by default.
		expect(shortcut.open).toBe(false);
		expect(template.open).toBe(false);

		// The collapsed template summary reflects the no-template state (spec clause 8).
		expect(template.querySelector("summary")?.textContent).toContain("No template");

		// The three sub-groups render in the order Shortcut, Template, Core (spec clause 1):
		// measure DOM position of a concrete core field (the types input) after the
		// template disclosure, not just the role preview which is always last.
		const typesField = inputForLabel(content, "Relationship types").closest(".people-atlas-form-field");
		if (!typesField) throw new Error("Expected the Relationship types field wrapper.");
		const sectionChildren = Array.from(
			section.querySelectorAll<HTMLElement>(
				".people-atlas-relationship-shortcut, .people-atlas-relationship-template, .people-atlas-form-field, .people-atlas-role-preview",
			),
		);
		const shortcutIndex = sectionChildren.findIndex((child) =>
			child.classList.contains("people-atlas-relationship-shortcut"),
		);
		const templateIndex = sectionChildren.findIndex((child) =>
			child.classList.contains("people-atlas-relationship-template"),
		);
		const typesIndex = sectionChildren.findIndex((child) => child === typesField);
		const corePreviewIndex = sectionChildren.findIndex((child) =>
			child.classList.contains("people-atlas-role-preview"),
		);
		expect(shortcutIndex).toBeGreaterThanOrEqual(0);
		expect(templateIndex).toBeGreaterThan(shortcutIndex);
		expect(typesIndex).toBeGreaterThan(templateIndex);
		expect(corePreviewIndex).toBeGreaterThan(typesIndex);

		// The Simple relationship selector lives inside the shortcut disclosure.
		const simpleSelect = shortcut.querySelector<HTMLSelectElement>("select");
		if (!simpleSelect) throw new Error("Expected the simple relationship selector inside the shortcut disclosure.");
		expect(simpleSelect.getAttribute("aria-describedby")).toBeTruthy();

		// The template machinery (selector, empty state, create action) lives inside the template disclosure.
		expect(template.querySelector("select")).toBeDefined();
		expect(template.querySelector(".people-atlas-template-empty-state")).toBeDefined();
		expect(template.querySelector("button")).toBeDefined();

		// The core relationship fields are directly in the section, not nested in a disclosure.
		for (const label of ["Relationship types", "My role", "Bob's role"]) {
			const field = inputForLabel(content, label);
			expect(shortcut.contains(field)).toBe(false);
			expect(template.contains(field)).toBe(false);
			expect(section.contains(field)).toBe(true);
		}
		expect(section.querySelector(".people-atlas-role-preview")).toBeDefined();
	});

	it("opens the template disclosure on load in edit mode when a template is attached, and keeps it collapsed otherwise", () => {
		const templateRelationship: RelationshipRecord = {
			id: "relationship-alice-bob",
			filePath: "People/Relationships/Alice - Bob.md",
			from: { raw: "person-alice", target: "person-alice", label: "Alice" },
			to: { raw: "person-bob", target: "person-bob", label: "Bob" },
			types: ["friend"],
			fromRole: "friend",
			toRole: "friend",
			presetId: "friendship",
		};
		const file = relationshipFile(templateRelationship.filePath);
		const { content } = mountModal({
			mode: { kind: "edit", file, relationship: templateRelationship, myPersonPath: alice.filePath },
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [friendship] },
		});
		const template = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-template");
		if (!template) throw new Error("Expected a template disclosure.");
		expect(template.open).toBe(true);
		expect(template.querySelector("summary")?.textContent).toContain("Friendship");

		const detached: RelationshipRecord = { ...templateRelationship, presetId: undefined };
		const detachedFile = relationshipFile(detached.filePath);
		const detachedModal = mountModal({
			mode: { kind: "edit", file: detachedFile, relationship: detached, myPersonPath: alice.filePath },
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [friendship] },
		});
		const detachedTemplate = detachedModal.content.querySelector<HTMLDetailsElement>(
			".people-atlas-relationship-template",
		);
		if (!detachedTemplate) throw new Error("Expected a template disclosure.");
		expect(detachedTemplate.open).toBe(false);
	});

	it("opens the template disclosure and shows a missing affordance when the attached template no longer exists", async () => {
		const missingRelationship: RelationshipRecord = {
			id: "relationship-alice-bob",
			filePath: "People/Relationships/Alice - Bob.md",
			from: { raw: "person-alice", target: "person-alice", label: "Alice" },
			to: { raw: "person-bob", target: "person-bob", label: "Bob" },
			types: ["friend"],
			fromRole: "friend",
			toRole: "friend",
			presetId: "vanished",
		};
		const file = relationshipFile(missingRelationship.filePath);
		const { content, updateRelationship, close } = mountModal({
			mode: { kind: "edit", file, relationship: missingRelationship, myPersonPath: alice.filePath },
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [friendship] },
		});
		const template = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-template");
		if (!template) throw new Error("Expected a template disclosure.");
		expect(template.open).toBe(true);
		expect(template.querySelector("summary")?.textContent).toContain("Missing template — vanished");

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
		expect(updateRelationship).not.toHaveBeenCalled();
	});

	it("fills core roles and preview in place after a shortcut choice without requiring the disclosure to stay open", () => {
		const { content } = mountModal();
		const shortcut = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-shortcut");
		if (!shortcut) throw new Error("Expected a shortcut disclosure.");
		shortcut.open = true;
		const simple = shortcut.querySelector<HTMLSelectElement>("select");
		if (!simple) throw new Error("Expected the simple relationship selector.");
		choose(simple, "parent");
		// Core fields update in place and are visible without the disclosure.
		expect(inputForLabel(content, "My role").value).toBe("parent");
		expect(inputForLabel(content, "Bob's role").value).toBe("child");
		expect(content.textContent).toContain("Alice's role is mother and Bob's role is son");
	});

	it("localizes fixed relationship-modal and accessible form text without changing stored values", () => {
		const { content } = mountModal({ translator: createTranslator("nl") });

		expect(content.ownerDocument.querySelector("h2")?.textContent).toBe("Relatie aanmaken");
		expect(Array.from(content.querySelectorAll("fieldset > legend")).map((legend) => legend.textContent)).toEqual([
			"Personen",
			"Relatie",
			"Context",
		]);
		expect(selectForLabel(content, "Eenvoudige relatie").value).toBe("custom");
		expect(
			Array.from(selectForLabel(content, "Status").options).map((option) => [option.value, option.textContent]),
		).toEqual([
			["", "Niet ingesteld"],
			["active", "Actief"],
			["dormant", "Inactief"],
			["ended", "Beëindigd"],
		]);
		expect(buttonWithText(content, "Annuleren")).toBeInstanceOf(HTMLButtonElement);
		expect(buttonWithText(content, "Opslaan")).toBeInstanceOf(HTMLButtonElement);
		expect(inputForLabel(content, "Eerste persoon — Alice").value).toBe(alice.filePath);
	});

	it("applies explicit simple relationships in place for two other people without writing before Save", () => {
		const { content, form, createRelationship, updateRelationship } = mountModal({
			mode: {
				kind: "create",
				fromPersonPath: charlie.filePath,
				toPersonPath: bob.filePath,
				myPersonPath: alice.filePath,
			},
			width: 320,
		});
		const simple = selectForLabel(content, "Simple relationship");
		expect(Array.from(simple.options).map((option) => [option.value, option.textContent])).toEqual([
			["custom", "Custom — use template or roles below"],
			["parent", "Parent of the second person"],
			["child", "Child of the second person"],
			["sibling", "Sibling of the second person"],
			["partner", "Partner of the second person"],
		]);
		expect(simple.getAttribute("aria-describedby")).toBeTruthy();
		expect(content.textContent).toContain("shortcut from the first person to the second person");

		setInput(inputForLabel(content, "Relationship types"), "family");
		setInput(inputForLabel(content, "Closeness"), "5");
		const advanced = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-advanced");
		if (!advanced) throw new Error("Expected Advanced disclosure.");
		advanced.open = true;
		setInput(inputForLabel(content, "Relationship note path"), "People/Relationships/Keep path.md");
		content.scrollTop = 80;
		const scrollTop = content.scrollTop;
		const shortcut = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-shortcut");
		if (!shortcut) throw new Error("Expected shortcut disclosure.");
		shortcut.open = true;
		simple.focus();

		choose(simple, "parent");
		expect(document.activeElement).toBe(simple);
		expect(inputForLabel(content, "Charlie's role").value).toBe("parent");
		expect(inputForLabel(content, "Bob's role").value).toBe("child");
		expect(content.textContent).toContain("Charlie's role is mother and Bob's role is son");
		expect(inputForLabel(content, "Relationship types").value).toBe("family");
		expect(inputForLabel(content, "Closeness").value).toBe("5");
		expect(inputForLabel(content, "Relationship note path").value).toBe("People/Relationships/Keep path.md");
		expect(selectForLabel(content, "Relationship template").value).toBe("");
		expect(advanced.open).toBe(true);
		expect(content.scrollTop).toBe(scrollTop);
		expect(content.querySelector("form")).toBe(form);
		const secondPerson = inputForLabel(content, "Second person — Bob");
		setInput(secondPerson, alice.filePath);
		expect(simple.value).toBe("parent");
		expect(content.textContent).toContain("Charlie's role is mother and Alice's role is daughter");
		setInput(secondPerson, bob.filePath);

		choose(simple, "child");
		expect(inputForLabel(content, "Charlie's role").value).toBe("child");
		expect(inputForLabel(content, "Bob's role").value).toBe("parent");
		expect(content.textContent).toContain("Charlie's role is daughter and Bob's role is father");

		choose(simple, "sibling");
		expect(inputForLabel(content, "Charlie's role").value).toBe("sibling");
		expect(inputForLabel(content, "Bob's role").value).toBe("sibling");
		expect(content.textContent).toContain("Charlie's role is sister and Bob's role is brother");

		choose(simple, "partner");
		expect(document.activeElement).toBe(simple);
		expect(inputForLabel(content, "Charlie's role").value).toBe("partner");
		expect(inputForLabel(content, "Bob's role").value).toBe("partner");
		expect(content.textContent).toContain("Charlie's role is partner and Bob's role is partner");
		expect(inputForLabel(content, "Relationship types").value).toBe("family");
		expect(inputForLabel(content, "Closeness").value).toBe("5");
		expect(inputForLabel(content, "Relationship note path").value).toBe("People/Relationships/Keep path.md");
		expect(selectForLabel(content, "Relationship template").value).toBe("");
		expect(advanced.open).toBe(true);
		expect(content.scrollTop).toBe(scrollTop);
		expect(content.querySelector("form")).toBe(form);
		expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
		expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
		expect(createRelationship).not.toHaveBeenCalled();
		expect(updateRelationship).not.toHaveBeenCalled();
	});

	it("localizes generated family-role previews while preserving stored canonical roles", () => {
		const { content, createRelationship } = mountModal({ translator: createTranslator("nl") });
		const simple = Array.from(content.querySelectorAll<HTMLSelectElement>("select")).find((select) =>
			Array.from(select.options).some((option) => option.value === "parent"),
		);
		if (!simple) throw new Error("Expected simple relationship selector.");

		choose(simple, "parent");

		expect(content.textContent).toContain("In deze relatie is de rol van Alice moeder en de rol van Bob zoon.");
		expect(Array.from(content.querySelectorAll<HTMLInputElement>("input")).map((input) => input.value)).toContain(
			"parent",
		);
		expect(Array.from(content.querySelectorAll<HTMLInputElement>("input")).map((input) => input.value)).toContain(
			"child",
		);
		expect(createRelationship).not.toHaveBeenCalled();
	});

	it("derives the simple choice after manual and template role changes without changing template provenance", () => {
		const familyTemplate: RelationshipPreset = {
			id: "family-parent-child",
			name: "Family",
			types: ["family"],
			fromRole: "parent",
			toRole: "child",
		};
		const { content, createRelationship } = mountModal({
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [familyTemplate] },
		});
		const simple = selectForLabel(content, "Simple relationship");
		const template = selectForLabel(content, "Relationship template");

		choose(template, familyTemplate.id);
		expect(simple.value).toBe("parent");
		expect(content.textContent).toContain("Alice's role is mother and Bob's role is son");

		setInput(inputForLabel(content, "My role"), "mentor");
		expect(simple.value).toBe("custom");
		expect(inputForLabel(content, "Bob's role").value).toBe("child");
		expect(template.value).toBe(familyTemplate.id);
		expect(content.textContent).toContain("differ from the selected template");

		buttonWithText(content, "Apply latest template values").click();
		expect(simple.value).toBe("parent");
		choose(simple, "sibling");
		expect(template.value).toBe(familyTemplate.id);
		expect(inputForLabel(content, "My role").value).toBe("sibling");
		expect(inputForLabel(content, "Bob's role").value).toBe("sibling");
		expect(content.textContent).toContain("differ from the selected template");
		expect(createRelationship).not.toHaveBeenCalled();
	});

	it("saves only canonical neutral roles after an explicit simple choice", async () => {
		const { content, createRelationship } = mountModal();
		choose(selectForLabel(content, "Simple relationship"), "parent");
		expect(createRelationship).not.toHaveBeenCalled();

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(createRelationship).toHaveBeenCalledOnce());
		expect(createRelationship).toHaveBeenCalledWith(
			expect.objectContaining({
				fromRole: "parent",
				toRole: "child",
			}),
		);
		expect(createRelationship.mock.calls[0]?.[0]).not.toHaveProperty("simpleRelationship");
	});

	it("keeps one semantic form and every unsaved value while a new template is saved and choices refresh", async () => {
		let mounted: MountedRelationshipModal | undefined;
		const save = vi.fn(async (preset: RelationshipPreset) => {
			if (!mounted) return false;
			mounted.settings.current = {
				...mounted.settings.current,
				relationshipPresets: [...mounted.settings.current.relationshipPresets, preset],
			};
			return true;
		});
		const templateCreation: RelationshipTemplateCreation = {
			enabled: () => true,
			save,
		};
		let nestedModal: RelationshipPresetModal | undefined;
		vi.spyOn(RelationshipPresetModal.prototype, "open").mockImplementation(function (this: RelationshipPresetModal) {
			this.titleEl = document.createElement("h2");
			this.contentEl = document.createElement("div");
			nestedModal = this;
		});
		mounted = mountModal({ templateCreation });
		const { content, form } = mounted;

		expect(
			Array.from(form.children)
				.filter((child) => child.matches("fieldset, details"))
				.map((child) => child.querySelector("legend, summary")?.textContent?.split(" — ")[0]),
		).toEqual(["People", "Relationship", "Context", "Advanced"]);
		const advanced = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-advanced");
		expect(advanced?.querySelector("summary")?.textContent).toContain(
			"Destination: People/Relationships/Alice - Bob.md",
		);
		expect(content.textContent).toContain("No relationship templates yet");
		expect(content.textContent).toContain("Manual relationship values remain available.");
		expect(selectForLabel(content, "Relationship template").options[0]?.textContent).toBe(
			"No template — enter values manually",
		);
		for (const control of Array.from(
			content.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
				".people-atlas-form-field input, .people-atlas-form-field select",
			),
		)) {
			const descriptionId = control.getAttribute("aria-describedby");
			expect(descriptionId).toBeTruthy();
			expect(descriptionId ? content.querySelector(`#${descriptionId}`) : null).not.toBeNull();
		}

		setInput(inputForLabel(content, "Relationship types"), "manual-type");
		setInput(inputForLabel(content, "My role"), "manual-first-role");
		setInput(inputForLabel(content, "Bob's role"), "manual-second-role");
		setInput(inputForLabel(content, "Closeness"), "4");
		setInput(inputForLabel(content, "Since"), "2020-01-02");
		setInput(inputForLabel(content, "Last contact"), "2026-07-30");
		choose(selectForLabel(content, "Status"), "active");
		if (!advanced) throw new Error("Expected Advanced disclosure.");
		advanced.open = true;
		setInput(inputForLabel(content, "Relationship note path"), "People/Relationships/Manual.md");
		setInput(inputForLabel(content, "Relationship ID"), "relationship-manual");
		content.scrollTop = 90;
		const originalScrollTop = content.scrollTop;
		const templateDisclosure = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-template");
		if (!templateDisclosure) throw new Error("Expected template disclosure.");
		templateDisclosure.open = true;
		const createTemplate = buttonWithText(content, "Create template");
		createTemplate.focus();
		createTemplate.click();
		expect(nestedModal).toBeDefined();

		const createdTemplate: RelationshipPreset = {
			id: "new-template",
			name: "New template",
			types: ["new"],
			fromRole: "new-first",
			toRole: "new-second",
		};
		const nestedSave = (
			nestedModal as unknown as {
				onSave(preset: RelationshipPreset): Promise<boolean>;
			}
		).onSave;
		expect(await nestedSave(createdTemplate)).toBe(true);
		nestedModal?.onClose();
		await vi.waitFor(() => expect(document.activeElement).toBe(createTemplate));

		expect(save).toHaveBeenCalledWith(createdTemplate);
		expect(content.querySelector("form")).toBe(form);
		expect(advanced.open).toBe(true);
		expect(content.scrollTop).toBe(originalScrollTop);
		expect(inputForLabel(content, "Relationship note path").value).toBe("People/Relationships/Manual.md");
		expect(inputForLabel(content, "Relationship ID").value).toBe("relationship-manual");
		expect(inputForLabel(content, "Relationship types").value).toBe("manual-type");
		expect(inputForLabel(content, "My role").value).toBe("manual-first-role");
		expect(inputForLabel(content, "Bob's role").value).toBe("manual-second-role");
		expect(inputForLabel(content, "Closeness").value).toBe("4");
		expect(inputForLabel(content, "Since").value).toBe("2020-01-02");
		expect(inputForLabel(content, "Last contact").value).toBe("2026-07-30");
		expect(selectForLabel(content, "Status").value).toBe("active");
		const templateSelect = selectForLabel(content, "Relationship template");
		expect(Array.from(templateSelect.options).map((option) => option.value)).toContain("new-template");
		expect(templateSelect.value).toBe("");
		expect(content.querySelector<HTMLElement>(".people-atlas-template-empty-state")?.hidden).toBe(true);
	});

	it("ignores a pending template save after the parent relationship modal closes", async () => {
		let nestedModal: RelationshipPresetModal | undefined;
		let resolveSave: ((saved: boolean) => void) | undefined;
		const save = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolveSave = resolve;
				}),
		);
		const templateCreation: RelationshipTemplateCreation = {
			enabled: () => true,
			save,
		};
		const mounted = mountModal({ templateCreation });
		vi.spyOn(RelationshipPresetModal.prototype, "open").mockImplementation(function (this: RelationshipPresetModal) {
			this.titleEl = document.createElement("h2");
			this.contentEl = document.createElement("div");
			nestedModal = this;
		});
		const refreshOptions = vi.spyOn(
			mounted.modal as unknown as { refreshTemplateOptions: () => void },
			"refreshTemplateOptions",
		);
		const refreshAvailability = vi.spyOn(
			mounted.modal as unknown as { refreshTemplateCreationAvailability: () => void },
			"refreshTemplateCreationAvailability",
		);
		const noticeCountBeforeClose = notices.length;

		buttonWithText(mounted.content, "Create template").click();
		if (!nestedModal) throw new Error("Expected a nested relationship template modal.");
		const createdTemplate: RelationshipPreset = {
			id: "pending-template",
			name: "Pending template",
			types: ["pending"],
			fromRole: "pending-first",
			toRole: "pending-second",
		};
		const nestedSave = (
			nestedModal as unknown as {
				onSave(preset: RelationshipPreset): Promise<boolean>;
			}
		).onSave;
		const saveResult = nestedSave(createdTemplate);
		await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
		const optionsCallsBeforeClose = refreshOptions.mock.calls.length;
		const availabilityCallsBeforeClose = refreshAvailability.mock.calls.length;

		mounted.modal.onClose();
		resolveSave?.(true);

		expect(await saveResult).toBe(true);
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(refreshOptions).toHaveBeenCalledTimes(optionsCallsBeforeClose);
		expect(refreshAvailability).toHaveBeenCalledTimes(availabilityCallsBeforeClose);
		expect(mounted.content.querySelector("form")).toBeNull();
		expect(notices).toHaveLength(noticeCountBeforeClose);
	});

	it("updates dynamic labels, applies, modifies, reapplies and detaches a template without replacing controls", () => {
		const { content, form } = mountModal({
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [friendship] },
			templateCreation: { enabled: () => true, save: vi.fn(async () => true) },
		});
		expect(inputForLabel(content, "My role").value).toBe("");
		expect(inputForLabel(content, "Bob's role").value).toBe("");
		const firstPerson = inputForLabel(content, "First person — Alice");
		firstPerson.focus();
		setInput(firstPerson, charlie.filePath);
		expect(document.activeElement).toBe(firstPerson);
		expect(inputForLabel(content, "Charlie's role")).toBeDefined();
		expect(inputForLabel(content, "Bob's role")).toBeDefined();
		expect(content.querySelector("form")).toBe(form);

		setInput(firstPerson, alice.filePath);
		const advanced = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-advanced");
		if (!advanced) throw new Error("Expected Advanced disclosure.");
		advanced.open = true;
		setInput(inputForLabel(content, "Relationship note path"), "People/Relationships/Keep me.md");
		const templateDisclosure = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-template");
		if (!templateDisclosure) throw new Error("Expected template disclosure.");
		templateDisclosure.open = true;
		const templateSelect = selectForLabel(content, "Relationship template");
		templateSelect.focus();
		choose(templateSelect, friendship.id);
		expect(document.activeElement).toBe(templateSelect);
		expect(inputForLabel(content, "Relationship types").value).toBe("friend");
		expect(inputForLabel(content, "My role").value).toBe("friend");
		expect(inputForLabel(content, "Bob's role").value).toBe("friend");
		expect(content.textContent).toContain("In this relationship, Alice's role is friend and Bob's role is friend.");

		setInput(inputForLabel(content, "Relationship types"), "locally changed");
		setInput(inputForLabel(content, "Bob's role"), "locally changed");
		const applyLatest = buttonWithText(content, "Apply latest template values");
		expect(applyLatest.hidden).toBe(false);
		applyLatest.focus();
		applyLatest.click();
		expect(document.activeElement).toBe(applyLatest);
		expect(inputForLabel(content, "Relationship types").value).toBe("friend");
		expect(inputForLabel(content, "Bob's role").value).toBe("friend");
		expect(inputForLabel(content, "Relationship note path").value).toBe("People/Relationships/Keep me.md");
		expect(advanced.open).toBe(true);
		expect(content.querySelector("form")).toBe(form);

		templateSelect.focus();
		choose(templateSelect, "");
		expect(document.activeElement).toBe(templateSelect);
		expect(inputForLabel(content, "Relationship types").value).toBe("friend");
		expect(inputForLabel(content, "My role").value).toBe("friend");
		expect(inputForLabel(content, "Bob's role").value).toBe("friend");
		expect(content.textContent).toContain("No template is selected.");
		expect(content.querySelector("form")).toBe(form);
	});

	it("resynchronizes a template selection that disappears before it can be applied", () => {
		const { content, settings } = mountModal({
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [friendship] },
			templateCreation: { enabled: () => true, save: vi.fn(async () => true) },
		});
		const firstPerson = inputForLabel(content, "First person — Alice");
		const secondPerson = inputForLabel(content, "Second person — Bob");
		const types = inputForLabel(content, "Relationship types");
		const firstRole = inputForLabel(content, "My role");
		const secondRole = inputForLabel(content, "Bob's role");
		const closeness = inputForLabel(content, "Closeness");
		const path = inputForLabel(content, "Relationship note path");
		setInput(types, "manual");
		setInput(firstRole, "mentor");
		setInput(secondRole, "mentee");
		setInput(closeness, "4");
		setInput(path, "People/Relationships/Keep manual.md");
		const templateSelect = selectForLabel(content, "Relationship template");

		settings.current = { ...settings.current, relationshipPresets: [] };
		choose(templateSelect, friendship.id);

		expect(Array.from(templateSelect.options).map((option) => option.value)).toEqual([""]);
		expect(templateSelect.value).toBe("");
		expect(content.textContent).toContain("No template is selected.");
		expect(firstPerson.value).toBe(alice.filePath);
		expect(secondPerson.value).toBe(bob.filePath);
		expect(types.value).toBe("manual");
		expect(firstRole.value).toBe("mentor");
		expect(secondRole.value).toBe("mentee");
		expect(closeness.value).toBe("4");
		expect(path.value).toBe("People/Relationships/Keep manual.md");
	});

	it("shows a selected template as missing when it disappears before reapply", () => {
		const { content, settings } = mountModal({
			settings: { ...structuredClone(DEFAULT_SETTINGS), relationshipPresets: [friendship] },
			templateCreation: { enabled: () => true, save: vi.fn(async () => true) },
		});
		const templateSelect = selectForLabel(content, "Relationship template");
		choose(templateSelect, friendship.id);
		setInput(inputForLabel(content, "Closeness"), "4");
		const path = inputForLabel(content, "Relationship note path");
		setInput(path, "People/Relationships/Keep selected.md");

		settings.current = { ...settings.current, relationshipPresets: [] };
		buttonWithText(content, "Apply latest template values").click();

		expect(Array.from(templateSelect.options).map((option) => [option.value, option.textContent])).toEqual([
			["", "No template — enter values manually"],
			[friendship.id, `Missing template — ${friendship.id}`],
		]);
		expect(templateSelect.value).toBe(friendship.id);
		expect(content.textContent).toContain(`Template “${friendship.id}” is unavailable.`);
		expect(inputForLabel(content, "Relationship types").value).toBe("friend");
		expect(inputForLabel(content, "My role").value).toBe("friend");
		expect(inputForLabel(content, "Bob's role").value).toBe("friend");
		expect(inputForLabel(content, "Closeness").value).toBe("4");
		expect(path.value).toBe("People/Relationships/Keep selected.md");
	});

	it("shows inline feedback when settings become read-only after the template editor opens", async () => {
		let enabled = true;
		const save = vi.fn(async () => true);
		let nestedModal: RelationshipPresetModal | undefined;
		vi.spyOn(RelationshipPresetModal.prototype, "open").mockImplementation(function (this: RelationshipPresetModal) {
			this.titleEl = document.createElement("h2");
			this.contentEl = document.createElement("div");
			document.body.append(this.titleEl, this.contentEl);
			this.onOpen();
			nestedModal = this;
		});
		const { content } = mountModal({
			templateCreation: {
				enabled: () => enabled,
				save,
			},
		});
		buttonWithText(content, "Create template").click();
		if (!nestedModal) throw new Error("Expected a nested relationship template modal.");
		const nestedContent = nestedModal.contentEl;
		setInput(inputForLabel(nestedContent, "Name"), "Colleague");
		setInput(inputForLabel(nestedContent, "Relationship types"), "colleague");
		setInput(inputForLabel(nestedContent, "First-person role"), "colleague");
		setInput(inputForLabel(nestedContent, "Second-person role"), "colleague");

		enabled = false;
		buttonWithText(nestedContent, "Save").click();
		await vi.waitFor(() => expect(nestedContent.textContent).toContain("could not be saved"));

		expect(nestedContent.textContent).toContain("read-only or invalid");
		expect(save).not.toHaveBeenCalled();
		expect(buttonWithText(nestedContent, "Save").disabled).toBe(false);
	});

	it("opens Advanced, associates an identity error and focuses its control without writing a note", async () => {
		const createRelationship = vi.fn(async () => {
			throw new Error("relationship_id “relationship-duplicate” is already in use.");
		});
		const { content } = mountModal({ createRelationship });
		const advanced = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-advanced");
		if (!advanced) throw new Error("Expected Advanced disclosure.");
		expect(advanced.open).toBe(false);
		advanced.open = true;
		const relationshipId = inputForLabel(content, "Relationship ID");
		setInput(relationshipId, "relationship-duplicate");
		advanced.open = false;

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(content.textContent).toContain("relationship-duplicate"));

		expect(createRelationship).toHaveBeenCalledOnce();
		expect(advanced.open).toBe(true);
		expect(document.activeElement).toBe(relationshipId);
		expect(relationshipId.getAttribute("aria-invalid")).toBe("true");
		const describedBy = relationshipId.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
		expect(describedBy).toHaveLength(2);
		expect(describedBy.some((id) => content.querySelector(`#${id}`)?.getAttribute("role") === "alert")).toBe(true);
		expect(buttonWithText(content, "Save").disabled).toBe(false);
	});

	it("keeps create open and write-free when a selected person disappears after open", async () => {
		let currentPeople = [alice, bob, charlie];
		const { content, createRelationship, close } = mountModal({
			getCurrentPeople: () => currentPeople,
		});
		currentPeople = [alice, charlie];

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(content.textContent).toContain("Second person must be selected"));

		expect(createRelationship).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
		expect(buttonWithText(content, "Save").disabled).toBe(false);
	});

	it("ignores a late create success after the modal was closed", async () => {
		const createdFile = relationshipFile("People/Relationships/Late.md");
		let resolveCreate: ((file: TFile) => void) | undefined;
		const createRelationship = vi.fn(
			() =>
				new Promise<TFile>((resolve) => {
					resolveCreate = resolve;
				}),
		);
		const { content, modal, close, afterClose, openFile } = mountModal({ createRelationship });

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(createRelationship).toHaveBeenCalledOnce());
		modal.close();
		resolveCreate?.(createdFile);
		await vi.waitFor(() => expect(afterClose).toHaveBeenCalledOnce());
		await new Promise<void>((resolve) => queueMicrotask(resolve));

		expect(close).toHaveBeenCalledOnce();
		expect(openFile).not.toHaveBeenCalled();
	});

	it("ignores a late create error after the modal was closed", async () => {
		let rejectCreate: ((error: Error) => void) | undefined;
		const createRelationship = vi.fn(
			() =>
				new Promise<TFile>((_, reject) => {
					rejectCreate = reject;
				}),
		);
		const { content, modal, close, afterClose } = mountModal({ createRelationship });
		const noticeCountBeforeClose = notices.length;

		buttonWithText(content, "Save").click();
		await vi.waitFor(() => expect(createRelationship).toHaveBeenCalledOnce());
		modal.close();
		rejectCreate?.(new Error("late failure"));
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		await vi.waitFor(() => expect(afterClose).toHaveBeenCalledOnce());

		expect(close).toHaveBeenCalledOnce();
		expect(content.querySelector("form")).toBeNull();
		expect(notices).toHaveLength(noticeCountBeforeClose);
	});

	it("closes after create and opens the created relationship note", async () => {
		const createdFile = relationshipFile("People/Relationships/Created relationship.md");
		const createRelationship = vi.fn(async () => createdFile);
		const { content, close, afterClose, openFile } = mountModal({ createRelationship });

		buttonWithText(content, "Save").click();

		await vi.waitFor(() => expect(createRelationship).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(openFile).toHaveBeenCalledWith(createdFile));
		expect(close).toHaveBeenCalledOnce();
		expect(afterClose).toHaveBeenCalledOnce();
	});

	it("closes after edit without opening another relationship note", async () => {
		const relationship: RelationshipRecord = {
			id: "relationship-alice-bob",
			filePath: "People/Relationships/Alice - Bob.md",
			from: { raw: "person-alice", target: "person-alice", label: "Alice" },
			to: { raw: "person-bob", target: "person-bob", label: "Bob" },
			types: ["friend"],
			fromRole: "parent",
			toRole: "child",
		};
		const file = relationshipFile(relationship.filePath);
		const { content, updateRelationship, close, afterClose, openFile } = mountModal({
			mode: {
				kind: "edit",
				file,
				relationship,
				myPersonPath: alice.filePath,
			},
		});
		expect(selectForLabel(content, "Simple relationship").value).toBe("parent");
		setInput(inputForLabel(content, "Closeness"), "3");

		buttonWithText(content, "Save").click();

		await vi.waitFor(() => expect(updateRelationship).toHaveBeenCalledWith(file, { closeness: 3 }));
		await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
		expect(afterClose).toHaveBeenCalledOnce();
		expect(openFile).not.toHaveBeenCalled();
	});

	it("keeps an edit form reflow-safe, shows its source path and cancels without any mutation", () => {
		const relationship: RelationshipRecord = {
			id: "relationship-alice-bob",
			filePath: "People/Relationships/Alice - Bob.md",
			from: { raw: "person-alice", target: "person-alice", label: "Alice" },
			to: { raw: "person-bob", target: "person-bob", label: "Bob" },
			types: ["friend"],
		};
		const file = relationshipFile(relationship.filePath);
		const { content, form, createRelationship, updateRelationship, close, afterClose } = mountModal({
			mode: {
				kind: "edit",
				file,
				relationship,
				myPersonPath: alice.filePath,
			},
			width: 320,
		});
		const advanced = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-advanced");
		expect(advanced?.querySelector("summary")?.textContent).toBe(
			"Advanced — Source: People/Relationships/Alice - Bob.md",
		);
		advanced?.setAttribute("open", "");
		expect(inputForLabel(content, "Source note path").readOnly).toBe(true);
		expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
		expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
		const cancel = buttonWithText(content, "Cancel");
		const save = buttonWithText(content, "Save");
		expect(advanced?.contains(cancel)).toBe(false);
		expect(advanced?.contains(save)).toBe(false);
		const createTemplate = buttonWithText(content, "Create template");
		expect(createTemplate.disabled).toBe(true);
		expect(content.textContent).toContain("settings are read-only or invalid");

		cancel.click();

		expect(close).toHaveBeenCalledOnce();
		expect(afterClose).toHaveBeenCalledOnce();
		expect(createRelationship).not.toHaveBeenCalled();
		expect(updateRelationship).not.toHaveBeenCalled();
	});

	it("creates controls in the owning pop-out document and restores its cross-realm focus", async () => {
		const frame = document.createElement("iframe");
		document.body.append(frame);
		const frameDocument = frame.contentDocument;
		if (!frameDocument) throw new Error("Expected an iframe document.");
		let nestedModal: RelationshipPresetModal | undefined;
		vi.spyOn(RelationshipPresetModal.prototype, "open").mockImplementation(function (this: RelationshipPresetModal) {
			this.titleEl = frameDocument.createElement("h2");
			this.contentEl = frameDocument.createElement("div");
			nestedModal = this;
		});
		const { content } = mountModal({
			ownerDocument: frameDocument,
			templateCreation: { enabled: () => true, save: vi.fn(async () => true) },
		});
		expect(content.ownerDocument).toBe(frameDocument);
		expect(Array.from(content.querySelectorAll("*")).every((element) => element.ownerDocument === frameDocument)).toBe(
			true,
		);
		const templateSelect = selectForLabel(content, "Relationship template");
		const templateDisclosure = content.querySelector<HTMLDetailsElement>(".people-atlas-relationship-template");
		if (!templateDisclosure) throw new Error("Expected template disclosure.");
		templateDisclosure.open = true;
		templateSelect.focus();
		expect(frameDocument.activeElement).toBe(templateSelect);
		buttonWithText(content, "Create template").click();
		expect(nestedModal).toBeDefined();

		nestedModal?.onClose();
		await vi.waitFor(() => expect(frameDocument.activeElement).toBe(templateSelect));
	});
});
