import { ConfirmationModal, TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "../src/i18n";
import type PeopleAtlasPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import type { RelationshipPreset } from "../src/settings/relationship-presets";
import { PeopleAtlasSettingTab } from "../src/settings/settings-tab";
import { validatePeopleRootFolder } from "../src/settings/validate";

const relationshipTemplate: RelationshipPreset = {
	id: "friend-colleague",
	name: "Friend and colleague",
	types: ["friend", "colleague"],
	fromRole: "Friend",
	toRole: "Colleague",
};

const otherRelationshipTemplate: RelationshipPreset = {
	id: "family",
	name: "Family",
	types: ["family"],
	fromRole: "Relative",
	toRole: "Relative",
};

type ControlledConfirmationModal = ConfirmationModal & {
	buttons: Array<{ click(): Promise<unknown> }>;
	cancelButton?: { click(): Promise<unknown> };
	cancelButtonText?: string;
};

type RelationshipTemplateList = {
	type?: string;
	onDelete?: (index: number) => void;
};

type DeclarativeSettingDefinition = {
	type?: string;
	heading?: string;
	name?: string;
	desc?: string;
	items?: DeclarativeSettingDefinition[];
	control?: {
		type?: string;
		key?: string;
		placeholder?: string;
		validate?: unknown;
		options?: Record<string, string>;
		filter?: (file: TFile) => boolean;
	};
};

function settingDefinitionNodes(tab: PeopleAtlasSettingTab): DeclarativeSettingDefinition[] {
	return definitionNodes(tab.getSettingDefinitions() as unknown as DeclarativeSettingDefinition[]);
}

function definitionNodes(definitions: DeclarativeSettingDefinition[]): DeclarativeSettingDefinition[] {
	const nodes: DeclarativeSettingDefinition[] = [];
	const visit = (items: DeclarativeSettingDefinition[]): void => {
		for (const item of items) {
			nodes.push(item);
			if (item.type === "group" || item.type === "page") visit(item.items ?? []);
		}
	};
	visit(definitions);
	return nodes;
}

function flattenedSettingDefinitions(tab: PeopleAtlasSettingTab): DeclarativeSettingDefinition[] {
	return settingDefinitionNodes(tab).filter((definition) => definition.control !== undefined);
}

function relationshipTemplateList(tab: PeopleAtlasSettingTab): RelationshipTemplateList {
	const definitions = settingDefinitionNodes(tab) as RelationshipTemplateList[];
	const templates = definitions.find((definition) => definition.type === "list");
	if (!templates) throw new Error("Relationship template list definition is missing.");
	return templates;
}

function createRelationshipTemplateTab({
	linked,
	writesEnabled = true,
	saved = true,
	presets = [relationshipTemplate, otherRelationshipTemplate],
}: {
	linked: number;
	writesEnabled?: boolean;
	saved?: boolean;
	presets?: RelationshipPreset[];
}): {
	tab: PeopleAtlasSettingTab;
	plugin: { settings: { relationshipPresets: RelationshipPreset[] } };
	updateSetting: ReturnType<typeof vi.fn>;
	refresh: ReturnType<typeof vi.fn>;
	nativeConfirm: ReturnType<typeof vi.fn>;
} {
	const updateSetting = vi.fn(async () => saved);
	const plugin = {
		app: {},
		t: createTranslator("en"),
		settings: {
			...structuredClone(DEFAULT_SETTINGS),
			relationshipPresets: structuredClone(presets),
		},
		getMyPersonCandidates: vi.fn(() => []),
		getMyPersonWarning: vi.fn(() => undefined),
		canWritePeopleAtlasData: vi.fn(() => writesEnabled),
		getRelationshipPresetSyncChanges: vi.fn(() => []),
		getRelationshipPresetLinkCount: vi.fn(() => linked),
		updateSetting,
	};
	const tab = new PeopleAtlasSettingTab(plugin as unknown as PeopleAtlasPlugin);
	const refresh = vi.fn();
	(tab as unknown as { update: () => void }).update = refresh;
	const nativeConfirm = vi.fn(() => true);
	tab.containerEl = { ownerDocument: { defaultView: { confirm: nativeConfirm } } } as unknown as HTMLElement;
	return { tab, plugin, updateSetting, refresh, nativeConfirm };
}

afterEach(() => {
	vi.restoreAllMocks();
});

function createTab(myPersonId = "", writesEnabled = true): PeopleAtlasSettingTab {
	const plugin = {
		app: {},
		t: createTranslator("en"),
		settings: {
			...structuredClone(DEFAULT_SETTINGS),
			myPersonId,
			relationshipPresets: [
				{
					id: "friend-colleague",
					name: "Friend and colleague",
					types: ["friend", "colleague"],
					fromRole: "Friend",
					toRole: "Colleague",
				},
			],
		},
		getMyPersonCandidates: vi.fn(() => [
			{ id: "alice-id", name: "Alice", filePath: "People/Alice.md" },
			{ id: "bob-id", name: "Bob", filePath: "Archive/Bob.md" },
		]),
		getMyPersonWarning: vi.fn(() =>
			myPersonId === "missing-id" ? "The stored person_id is missing or ambiguous." : undefined,
		),
		canWritePeopleAtlasData: vi.fn(() => writesEnabled),
	} as unknown as PeopleAtlasPlugin;
	return new PeopleAtlasSettingTab(plugin);
}

function createMyPersonPickerTab({
	myPersonId = "",
	candidates = [
		{ id: "alice-id", name: "Alice", filePath: "People/Alice.md" },
		{ id: "bob-id", name: "Bob", filePath: "Archive/Bob.md" },
	],
}: {
	myPersonId?: string;
	candidates?: Array<{ id: string; name: string; filePath: string }>;
} = {}): {
	tab: PeopleAtlasSettingTab;
	updateSetting: ReturnType<typeof vi.fn>;
} {
	const updateSetting = vi.fn(async () => true);
	const plugin = {
		app: {},
		t: createTranslator("en"),
		settings: { ...structuredClone(DEFAULT_SETTINGS), myPersonId },
		getMyPersonCandidates: vi.fn(() => candidates),
		getMyPersonWarning: vi.fn(() => undefined),
		canWritePeopleAtlasData: vi.fn(() => true),
		updateSetting,
	} as unknown as PeopleAtlasPlugin;
	return { tab: new PeopleAtlasSettingTab(plugin), updateSetting };
}

describe("People Atlas declarative setting persistence", () => {
	it.each([true, false])("returns a promise that waits for a handled update result of %s", async (saved) => {
		let completeUpdate: (value: boolean) => void = () => {
			throw new Error("Test update was not initialized.");
		};
		const updateSetting = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					completeUpdate = resolve;
				}),
		);
		const tab = new PeopleAtlasSettingTab({ app: {}, updateSetting } as unknown as PeopleAtlasPlugin);

		const result = tab.setControlValue("showLabels", false);
		expect(result).toBeInstanceOf(Promise);
		expect(updateSetting).toHaveBeenCalledWith("showLabels", false);

		let settled = false;
		void Promise.resolve(result).then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		completeUpdate(saved);
		await expect(Promise.resolve(result)).resolves.toBeUndefined();
		expect(settled).toBe(true);
	});
});

describe("People Atlas relationship-template deletion confirmation", () => {
	it("opens a native ConfirmationModal for a linked template and keeps settings unchanged on cancel", async () => {
		const { nativeConfirm, plugin, refresh, tab, updateSetting } = createRelationshipTemplateTab({ linked: 2 });
		const originalPresets = structuredClone(plugin.settings.relationshipPresets);
		const open = vi.spyOn(ConfirmationModal.prototype, "open");

		relationshipTemplateList(tab).onDelete?.(0);

		expect(open).toHaveBeenCalledOnce();
		expect(nativeConfirm).not.toHaveBeenCalled();
		const modal = open.mock.instances[0] as ControlledConfirmationModal | undefined;
		if (!modal) throw new Error("Expected a relationship-template confirmation modal.");
		expect(modal).toBeInstanceOf(ConfirmationModal);
		expect(modal.titleEl.textContent).toContain("Friend and colleague");
		expect(modal.contentEl.textContent).toContain("2 relationship notes");
		expect(modal.contentEl.textContent).toContain("copied types and roles");
		expect(modal.contentEl.textContent).toContain("no longer refer to an existing template");
		expect(modal.cancelButtonText).toBe("Cancel");
		expect(modal.buttons).toMatchObject([{ text: "Delete relationship template", isCta: true, isDestructive: true }]);

		await modal.cancelButton?.click();

		expect(updateSetting).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
		expect(plugin.settings.relationshipPresets).toEqual(originalPresets);
	});

	it("keeps a linked template unchanged when ConfirmationModal.close() is called directly without Cancel", () => {
		const { plugin, refresh, tab, updateSetting } = createRelationshipTemplateTab({ linked: 2 });
		const originalPresets = structuredClone(plugin.settings.relationshipPresets);
		const open = vi.spyOn(ConfirmationModal.prototype, "open");

		relationshipTemplateList(tab).onDelete?.(0);

		const modal = open.mock.instances[0] as ControlledConfirmationModal | undefined;
		if (!modal) throw new Error("Expected a relationship-template confirmation modal.");
		modal.close();

		expect(updateSetting).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
		expect(plugin.settings.relationshipPresets).toEqual(originalPresets);
	});

	it("deletes only the originally selected linked template after its primary ConfirmationModal action", async () => {
		const { plugin, refresh, tab, updateSetting } = createRelationshipTemplateTab({ linked: 2 });
		const open = vi.spyOn(ConfirmationModal.prototype, "open");

		relationshipTemplateList(tab).onDelete?.(0);

		const modal = open.mock.instances[0] as ControlledConfirmationModal | undefined;
		if (!modal) throw new Error("Expected a relationship-template confirmation modal.");
		plugin.settings.relationshipPresets = [
			structuredClone(otherRelationshipTemplate),
			structuredClone(relationshipTemplate),
		];
		await modal.buttons[0]?.click();

		expect(updateSetting).toHaveBeenCalledTimes(1);
		expect(updateSetting).toHaveBeenCalledWith("relationshipPresets", [otherRelationshipTemplate]);
		expect(refresh).toHaveBeenCalledOnce();
	});

	it("deletes an unlinked template directly without opening a ConfirmationModal", async () => {
		const { refresh, tab, updateSetting } = createRelationshipTemplateTab({ linked: 0 });
		const open = vi.spyOn(ConfirmationModal.prototype, "open");

		relationshipTemplateList(tab).onDelete?.(0);

		await vi.waitFor(() => expect(updateSetting).toHaveBeenCalledOnce());
		expect(open).not.toHaveBeenCalled();
		expect(updateSetting).toHaveBeenCalledWith("relationshipPresets", [otherRelationshipTemplate]);
		expect(refresh).toHaveBeenCalledOnce();
	});

	it("does not open a confirmation modal or mutate templates while writes are disabled", async () => {
		const { plugin, tab, updateSetting } = createRelationshipTemplateTab({ linked: 2, writesEnabled: false });
		const originalPresets = structuredClone(plugin.settings.relationshipPresets);
		const open = vi.spyOn(ConfirmationModal.prototype, "open");

		expect(relationshipTemplateList(tab).onDelete).toBeUndefined();
		await (tab as unknown as { deletePreset(index: number): Promise<void> }).deletePreset(0);

		expect(open).not.toHaveBeenCalled();
		expect(updateSetting).not.toHaveBeenCalled();
		expect(plugin.settings.relationshipPresets).toEqual(originalPresets);
	});

	it("keeps the existing failed-update flow to one primary write without refreshing", async () => {
		const { plugin, refresh, tab, updateSetting } = createRelationshipTemplateTab({ linked: 2, saved: false });
		const originalPresets = structuredClone(plugin.settings.relationshipPresets);
		const open = vi.spyOn(ConfirmationModal.prototype, "open");

		relationshipTemplateList(tab).onDelete?.(0);

		const modal = open.mock.instances[0] as ControlledConfirmationModal | undefined;
		if (!modal) throw new Error("Expected a relationship-template confirmation modal.");
		await modal.buttons[0]?.click();

		expect(updateSetting).toHaveBeenCalledTimes(1);
		expect(updateSetting).toHaveBeenCalledWith("relationshipPresets", [otherRelationshipTemplate]);
		expect(refresh).not.toHaveBeenCalled();
		expect(plugin.settings.relationshipPresets).toEqual(originalPresets);
	});
});

describe("People Atlas settings definitions", () => {
	it("adapts a selected canonical person note path to the stable My person ID", async () => {
		const { tab, updateSetting } = createMyPersonPickerTab({ myPersonId: "alice-id" });
		const myPerson = flattenedSettingDefinitions(tab).find((definition) => definition.control?.key === "myPersonId");

		expect(myPerson).toMatchObject({
			name: "My person",
			control: { type: "file", key: "myPersonId" },
		});
		const canonicalFile = Object.assign(new TFile(), { path: "People/Alice.md" });
		const ordinaryFile = Object.assign(new TFile(), { path: "Notes/Ordinary.md" });
		expect(myPerson?.control?.filter?.(canonicalFile)).toBe(true);
		expect(myPerson?.control?.filter?.(ordinaryFile)).toBe(false);
		expect(tab.getControlValue("myPersonId")).toBe("People/Alice.md");

		await tab.setControlValue("myPersonId", "People/Alice.md");

		expect(updateSetting).toHaveBeenCalledExactlyOnceWith("myPersonId", "alice-id");
	});

	it("rejects ordinary, stale and ambiguous picker paths without writing, while explicit clear only clears My person", async () => {
		const { tab, updateSetting } = createMyPersonPickerTab({
			myPersonId: "alice-id",
			candidates: [
				{ id: "alice-id", name: "Alice", filePath: "People/Alice.md" },
				{ id: "duplicate-one", name: "Duplicate one", filePath: "People/Ambiguous.md" },
				{ id: "duplicate-two", name: "Duplicate two", filePath: "People/Ambiguous.md" },
			],
		});
		const myPerson = flattenedSettingDefinitions(tab).find((definition) => definition.control?.key === "myPersonId");
		const ambiguousFile = Object.assign(new TFile(), { path: "People/Ambiguous.md" });

		expect(myPerson?.control?.filter?.(ambiguousFile)).toBe(false);
		await tab.setControlValue("myPersonId", "Notes/Ordinary.md");
		await tab.setControlValue("myPersonId", "People/Stale.md");
		await tab.setControlValue("myPersonId", "People/Ambiguous.md");
		expect(updateSetting).not.toHaveBeenCalled();

		await tab.setControlValue("myPersonId", "");
		expect(updateSetting).toHaveBeenCalledExactlyOnceWith("myPersonId", "");
	});

	it("requires byte-exact picker paths and treats whitespace-only input as invalid rather than clear", async () => {
		const { tab, updateSetting } = createMyPersonPickerTab({ myPersonId: "alice-id" });

		await tab.setControlValue("myPersonId", " People/Alice.md");
		await tab.setControlValue("myPersonId", "People/Alice.md ");
		await tab.setControlValue("myPersonId", "	 ");

		expect(updateSetting).not.toHaveBeenCalled();
	});

	it("exposes one People root control and no independent person or contact-moment folder controls", () => {
		const definitions = flattenedSettingDefinitions(createTab());
		const folderDefinitions = definitions.filter((definition) =>
			["peopleRootFolder", "peopleFolder", "contactMomentsFolder"].includes(definition.control?.key ?? ""),
		);

		expect(folderDefinitions).toHaveLength(1);
		expect(folderDefinitions[0]).toMatchObject({
			name: "People root folder",
			desc: "Vault-relative root for the fixed Profiles, Relationships and Contact moments collections.",
			control: { type: "text", key: "peopleRootFolder", placeholder: "People" },
		});
		const validate = folderDefinitions[0]?.control?.validate as ((value: string) => string | undefined) | undefined;
		expect(validate?.("/People")).toContain("relative to the vault");
	});

	it("uses the central unsafe People root segment validator for the inline control", () => {
		const definition = flattenedSettingDefinitions(createTab()).find(
			(candidate) => candidate.control?.key === "peopleRootFolder",
		);
		const validate = definition?.control?.validate as ((value: string) => string | undefined) | undefined;

		expect(validate).toBe(validatePeopleRootFolder);
		expect(validate?.("Second Brain/People|Archive")).toContain("unsafe characters");
		expect(validate?.("Second Brain/Mensen en contacten")).toBeUndefined();
	});

	it.each([
		"People/",
		"Second Brain/People/",
	])("rejects the trailing-slash People root %j through the shared inline validator", (peopleRootFolder) => {
		const definition = flattenedSettingDefinitions(createTab()).find(
			(candidate) => candidate.control?.key === "peopleRootFolder",
		);
		const validate = definition?.control?.validate as ((value: string) => string | undefined) | undefined;

		expect({
			sharedValidator: validate === validatePeopleRootFolder,
			error: validate?.(peopleRootFolder),
		}).toEqual({
			sharedValidator: true,
			error: expect.stringMatching(/(?:trailing slash|must not end)/i),
		});
	});

	it("exposes only the daily configuration surface in one General group", () => {
		const tab = createTab();
		const definitions = tab.getSettingDefinitions() as unknown as DeclarativeSettingDefinition[];

		expect(definitions).toHaveLength(1);
		const general = definitions[0];
		if (!general) throw new Error("Expected the General root group.");
		expect(general).toMatchObject({ type: "group", heading: "General" });
		const rootItems = general.items ?? [];
		expect(rootItems.filter((definition) => definition.type === "page")).toEqual([]);
		expect(
			rootItems.filter((definition) => definition.control !== undefined).map((definition) => definition.control?.key),
		).toEqual(["peopleRootFolder", "myPersonId", "showLabels"]);
		expect(rootItems.filter((definition) => definition.type === "list")).toMatchObject([
			{ heading: "Relationship templates" },
		]);
	});

	it("keeps only the user-facing controls unique with their current metadata", () => {
		const metadata = flattenedSettingDefinitions(createTab()).map((definition) => ({
			key: definition.control?.key,
			type: definition.control?.type,
			placeholder: definition.control?.placeholder ?? null,
			validates: typeof definition.control?.validate === "function",
			optionKeys: Object.keys(definition.control?.options ?? {}),
		}));

		expect(metadata).toEqual([
			{ key: "peopleRootFolder", type: "text", placeholder: "People", validates: true, optionKeys: [] },
			{
				key: "myPersonId",
				type: "file",
				placeholder: "Select a person note",
				validates: false,
				optionKeys: [],
			},
			{ key: "showLabels", type: "toggle", placeholder: null, validates: false, optionKeys: [] },
		]);
		expect(new Set(metadata.map((definition) => definition.key)).size).toBe(metadata.length);
	});

	it("does not expose contact-moment schema mappings or technical type controls", () => {
		const definitions = flattenedSettingDefinitions(createTab());
		const technicalKeys = definitions
			.map((definition) => definition.control?.key)
			.filter((key): key is string => key !== undefined && (key.startsWith("contactMoment") || key === "typeProperty"));

		expect(technicalKeys).toEqual([]);
	});

	it("offers a native canonical My person note picker without direction or Person A/B settings", () => {
		const definitions = flattenedSettingDefinitions(createTab()) as Array<Record<string, unknown>>;
		const myPerson = definitions.find((definition) => definition.name === "My person");
		const direction = definitions.find((definition) => definition.name === "Relationship direction property");
		const legacyPreset = definitions.find((definition) => definition.name === "Relationship preset property");
		const legacyFirstRole = definitions.find((definition) => definition.name === "Person A role property");
		const legacySecondRole = definitions.find((definition) => definition.name === "Person B role property");

		expect(direction).toBeUndefined();
		expect(legacyPreset).toBeUndefined();
		expect(legacyFirstRole).toBeUndefined();
		expect(legacySecondRole).toBeUndefined();
		expect(myPerson).toMatchObject({
			name: "My person",
			control: {
				type: "file",
				key: "myPersonId",
				placeholder: "Select a person note",
			},
		});
	});

	it("keeps relationship templates while hiding their technical mapping controls", () => {
		const definitions = settingDefinitionNodes(createTab()) as Array<Record<string, unknown>>;
		const templateProperty = definitions.find((definition) => definition.name === "Relationship template property");
		const firstRole = definitions.find((definition) => definition.name === "First-person role property");
		const secondRole = definitions.find((definition) => definition.name === "Second-person role property");
		const templates = definitions.find((definition) => definition.type === "list") as
			| {
					heading?: string;
					emptyState?: string;
					items?: Array<{ desc?: string }>;
					addItem?: { name?: string };
			  }
			| undefined;

		expect(templateProperty).toBeUndefined();
		expect(firstRole).toBeUndefined();
		expect(secondRole).toBeUndefined();
		expect(templates).toMatchObject({
			heading: "Relationship templates",
			addItem: { name: "Add relationship template" },
		});
		expect(templates?.emptyState).toContain("they are not live links");
		expect(templates?.items?.[0]?.desc).toBe(
			"friend-colleague · types: friend, colleague · first-person role: Friend · second-person role: Colleague",
		);
	});

	it("keeps an unavailable stored My person visible and reports the recoverable warning", () => {
		const tab = createTab("missing-id");
		const definitions = flattenedSettingDefinitions(tab) as Array<Record<string, unknown>>;
		const myPerson = definitions.find((definition) => definition.name === "My person");

		expect(myPerson?.desc).toContain("Warning: The stored person_id is missing or ambiguous.");
		expect(tab.getControlValue("myPersonId")).toBe("");
		expect(myPerson).toMatchObject({
			control: {
				type: "file",
				key: "myPersonId",
				placeholder: "Select a person note",
			},
		});
	});

	it("exposes relationship templates as read-only while plugin data writes are disabled", () => {
		const definitions = settingDefinitionNodes(createTab("", false)) as Array<Record<string, unknown>>;
		const templates = definitions.find((definition) => definition.type === "list") as
			| {
					emptyState?: string;
					onReorder?: unknown;
					onDelete?: unknown;
					addItem?: unknown;
			  }
			| undefined;

		expect(templates?.emptyState).toContain("Template settings are read-only");
		expect(templates?.onReorder).toBeUndefined();
		expect(templates?.onDelete).toBeUndefined();
		expect(templates?.addItem).toBeUndefined();
	});
});
