import {
	ConfirmationModal,
	Notice,
	PluginSettingTab,
	type SettingDefinition,
	type SettingDefinitionItem,
} from "obsidian";
import type PeopleAtlasPlugin from "../main";
import { RelationshipPresetModal } from "./relationship-preset-modal";
import { RelationshipPresetSyncModal } from "./relationship-preset-sync-modal";
import type { PeopleAtlasSettings } from "./types";
import {
	validateContactMomentPropertyMappings,
	validateNoteTypeValues,
	validatePeopleRootFolder,
	validatePropertyName,
	validateRelationshipRoleFormatSetting,
} from "./validate";

export class PeopleAtlasSettingTab extends PluginSettingTab {
	plugin: PeopleAtlasPlugin;

	constructor(plugin: PeopleAtlasPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	override getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof PeopleAtlasSettings];
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		await this.plugin.updateSetting(key as keyof PeopleAtlasSettings, value);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		const writesEnabled = this.plugin.canWritePeopleAtlasData();
		const settingsWithTextValue = (key: keyof PeopleAtlasSettings, value: string): PeopleAtlasSettings => ({
			...this.plugin.settings,
			[key]: value.trim(),
		});
		const property = (
			name: string,
			desc: string,
			key: keyof PeopleAtlasSettings,
			validate: (value: string) => string | undefined = validatePropertyName,
		): SettingDefinitionItem => ({
			name,
			desc,
			control: {
				type: "text",
				key,
				validate,
			},
		});
		const typeValue = (
			name: string,
			desc: string,
			key: "personTypeValue" | "relationshipTypeValue" | "contactMomentTypeValue",
			placeholder: string,
		): SettingDefinitionItem => ({
			name,
			desc,
			control: {
				type: "text",
				key,
				placeholder,
				validate: (value) => validateNoteTypeValues(settingsWithTextValue(key, value)),
			},
		});
		const contactMomentProperty = (
			name: string,
			desc: string,
			key:
				| "contactMomentIdProperty"
				| "contactMomentPeopleProperty"
				| "contactMomentRelationshipProperty"
				| "contactMomentOccurredOnProperty"
				| "contactMomentChannelProperty"
				| "contactMomentSummaryProperty"
				| "contactMomentFollowUpOnProperty"
				| "contactMomentFollowUpStatusProperty",
		): SettingDefinitionItem => ({
			name,
			desc,
			control: {
				type: "text",
				key,
				validate: (value) => validateContactMomentPropertyMappings(settingsWithTextValue(key, value)),
			},
		});

		const flatDefinitions: SettingDefinitionItem[] = [
			{
				name: "People root folder",
				desc: "Vault-relative root for the fixed Profiles, Relationships and Contact moments collections.",
				control: {
					type: "text",
					key: "peopleRootFolder",
					placeholder: "People",
					validate: validatePeopleRootFolder,
				},
			},
			typeValue(
				"Person type value",
				"Value in the type property that identifies a person note. It must differ from the other note type values.",
				"personTypeValue",
				"person",
			),
			typeValue(
				"Relationship type value",
				"Value in the type property that identifies a relationship note. It must differ from the other note type values.",
				"relationshipTypeValue",
				"relationship",
			),
			typeValue(
				"Contact moment type value",
				"Value in the type property that identifies a contact-moment note. It must differ from the person and relationship type values.",
				"contactMomentTypeValue",
				"contact_moment",
			),
			{
				name: "Fallback person tag",
				desc: "A note with this tag is also treated as a person when no type value is present.",
				control: { type: "text", key: "personTag", placeholder: "person" },
			},
			property(
				"Type property",
				"Property used to distinguish person, relationship and contact-moment notes.",
				"typeProperty",
				(value) => validateContactMomentPropertyMappings(settingsWithTextValue("typeProperty", value)),
			),
			property(
				"Person ID property",
				"Stable ID. A normalized file path is used only when this is absent.",
				"personIdProperty",
			),
			property("Name property", "Human-readable display name.", "nameProperty"),
			property("Aliases property", "Alternative names used only for display and search.", "aliasesProperty"),
			property("Organisations property", "Organisations associated with the person.", "organisationsProperty"),
			property("Photo property", "Wikilink or vault path to a photo.", "photoProperty"),
			property(
				"Birth date property",
				"Optional text date stored as YYYY-MM-DD or --MM-DD when the year is unknown.",
				"birthDateProperty",
			),
			property("Pronouns property", "Optional user-authored pronouns.", "pronounsProperty"),
			property("Gender property", "Optional user-authored gender.", "genderProperty"),
			property("Email addresses property", "Ordered list of email addresses.", "emailsProperty"),
			property("Phone numbers property", "Ordered list of phone numbers with formatting preserved.", "phonesProperty"),
			property("Job title property", "Optional user-authored job title.", "jobTitleProperty"),
			property(
				"Linked people property",
				"List of simple person-note connections, separate from email addresses, phone numbers and rich relationship notes.",
				"contactsProperty",
			),
			property(
				"Relationship ID property",
				"Stable ID for a relationship note; the path is used when absent.",
				"relationshipIdProperty",
			),
			property(
				"First relationship person property",
				"First endpoint person wikilink or person ID.",
				"relationshipFromProperty",
			),
			property(
				"Second relationship person property",
				"Second endpoint person wikilink or person ID.",
				"relationshipToProperty",
			),
			property("Relationship types property", "One or more relationship labels.", "relationshipTypesProperty"),
			property(
				"Relationship template property",
				"Optional stable template ID copied onto a relationship note as provenance.",
				"relationshipPresetProperty",
			),
			property(
				"First-person role property",
				"Optional role of the first endpoint relative to the second endpoint.",
				"relationshipFromRoleProperty",
			),
			property(
				"Second-person role property",
				"Optional role of the second endpoint relative to the first endpoint.",
				"relationshipToRoleProperty",
			),
			property("Closeness property", "Optional closeness value from 1 to 5.", "closenessProperty"),
			property("Since property", "Optional ISO date when the relationship began.", "sinceProperty"),
			property("Last contact property", "Optional ISO date for the last interaction.", "lastContactProperty"),
			property("Status property", "Optional relationship lifecycle status.", "statusProperty"),
			contactMomentProperty(
				"Contact moment ID property",
				"Stable ID for a contact-moment note. A normalized file path is used only when this is absent.",
				"contactMomentIdProperty",
			),
			contactMomentProperty(
				"Contact moment people property",
				"Canonical person-note wikilinks associated with the contact moment; at least one is required.",
				"contactMomentPeopleProperty",
			),
			contactMomentProperty(
				"Contact moment relationship property",
				"Optional canonical relationship-note wikilink associated with the contact moment.",
				"contactMomentRelationshipProperty",
			),
			contactMomentProperty(
				"Contact moment occurred-on property",
				"Local calendar date when contact occurred, stored as YYYY-MM-DD.",
				"contactMomentOccurredOnProperty",
			),
			contactMomentProperty(
				"Contact moment channel property",
				"Optional user-authored contact channel.",
				"contactMomentChannelProperty",
			),
			contactMomentProperty(
				"Contact moment summary property",
				"Optional short user-authored summary.",
				"contactMomentSummaryProperty",
			),
			contactMomentProperty(
				"Contact moment follow-up date property",
				"Optional local calendar follow-up date stored as YYYY-MM-DD.",
				"contactMomentFollowUpOnProperty",
			),
			contactMomentProperty(
				"Contact moment follow-up status property",
				"Optional follow-up status: open, done or dismissed.",
				"contactMomentFollowUpStatusProperty",
			),
			{
				name: "Relationship role format",
				desc: "Text format used when both endpoint roles are present. Include {role} and {person} exactly once.",
				control: {
					type: "text",
					key: "relationshipRoleFormat",
					placeholder: "{role} of {person}",
					validate: validateRelationshipRoleFormatSetting,
				},
			},
			{
				type: "list",
				heading: "Relationship templates",
				emptyState: `No relationship templates yet. Relationship types and roles can still be entered manually. Templates copy repeatable types and both roles; they are not live links.${
					writesEnabled ? "" : " Template settings are read-only until the People Atlas plugin data is repaired."
				}`,
				items: this.plugin.settings.relationshipPresets.map((preset) => {
					const description = `${preset.id} · types: ${preset.types.join(", ")} · first-person role: ${
						preset.fromRole
					} · second-person role: ${preset.toRole}`;
					return {
						name: preset.name,
						desc: description,
						render: (setting) => {
							setting
								.setName(preset.name)
								.setDesc(description)
								.addButton((button) =>
									button
										.setButtonText("Edit")
										.setTooltip(
											writesEnabled
												? `Edit ${preset.name} relationship template`
												: "Relationship template settings are read-only until the plugin data is repaired",
										)
										.setDisabled(!writesEnabled)
										.onClick(() => this.openPresetEditor(preset.id)),
								)
								.addButton((button) => {
									const count = this.plugin.getRelationshipPresetSyncChanges(preset.id).length;
									return button
										.setButtonText("Update linked relationships from template")
										.setTooltip(
											!writesEnabled
												? "Relationship template updates are read-only until the plugin data is repaired"
												: count > 0
													? `Review ${count} relationship note${count === 1 ? "" : "s"} with this template provenance`
													: "All indexed relationship notes with this template provenance already match its copied values",
										)
										.setDisabled(!writesEnabled || count === 0)
										.onClick(() => this.openPresetSync(preset.id));
								});
						},
					};
				}),
				onReorder: writesEnabled ? (oldIndex, newIndex) => void this.reorderPreset(oldIndex, newIndex) : undefined,
				onDelete: writesEnabled ? (index) => void this.deletePreset(index) : undefined,
				addItem: writesEnabled
					? {
							name: "Add relationship template",
							action: () => this.openPresetEditor(),
						}
					: undefined,
			},
			this.myPersonSettingDefinition(),
			{
				name: "Default center person ID",
				desc: "The stable person_id used as the initial center in the standalone view.",
				control: { type: "text", key: "defaultCenterPersonId" },
			},
			{
				name: "Enable Bases view",
				desc: "Register People Atlas as a custom Bases view. Requires a plugin reload after changing.",
				control: { type: "toggle", key: "enableBases" },
			},
			{
				name: "Show labels",
				desc: "Draw person names below nodes by default.",
				control: { type: "toggle", key: "showLabels" },
			},
			{
				name: "Show diagnostics",
				desc: "Display data-quality warnings in the standalone view.",
				control: { type: "toggle", key: "showDiagnostics" },
			},
		];
		const requiredControlDefinition = (key: keyof PeopleAtlasSettings): SettingDefinitionItem => {
			const definition = flatDefinitions.find(
				(candidate): candidate is SettingDefinition => "control" in candidate && candidate.control?.key === key,
			);
			if (!definition) throw new Error(`People Atlas Settings definition is missing: ${key}.`);
			return definition;
		};
		const peopleRootFolder = requiredControlDefinition("peopleRootFolder");
		const relationshipTemplates = flatDefinitions.find(
			(definition) => "type" in definition && definition.type === "list",
		);
		if (!relationshipTemplates) throw new Error("People Atlas Settings relationship template list is missing.");
		const myPerson = requiredControlDefinition("myPersonId");
		const showLabels = requiredControlDefinition("showLabels");

		return [
			{
				type: "group",
				heading: "General",
				items: [
					peopleRootFolder as SettingDefinition,
					myPerson as SettingDefinition,
					relationshipTemplates as SettingDefinition,
					showLabels as SettingDefinition,
				],
			},
		];
	}

	private myPersonSettingDefinition(): SettingDefinitionItem {
		const candidates = this.plugin.getMyPersonCandidates();
		const entries: Array<[string, string]> = [
			["", "None"],
			...candidates.map((person): [string, string] => [person.id, `${person.name} — ${person.filePath}`]),
		];
		const stored = this.plugin.settings.myPersonId;
		if (stored && !candidates.some((person) => person.id === stored)) {
			entries.push([stored, `Unavailable: ${stored}`]);
		}
		const warning = this.plugin.getMyPersonWarning();
		const description =
			"Perspective anchor selected only by one unique explicit person_id. It stays independent from graph navigation.";
		return {
			name: "My person",
			desc: warning ? `${description} Warning: ${warning}` : description,
			control: {
				type: "dropdown",
				key: "myPersonId",
				options: Object.fromEntries(entries),
			},
		};
	}

	private openPresetEditor(presetId?: string): void {
		if (!this.canManageRelationshipTemplates()) return;
		const preset = presetId
			? this.plugin.settings.relationshipPresets.find((candidate) => candidate.id === presetId)
			: undefined;
		if (presetId && !preset) {
			new Notice(`Relationship template “${presetId}” is no longer available.`);
			return;
		}
		const existingIds = this.plugin.settings.relationshipPresets
			.filter((candidate) => candidate.id !== presetId)
			.map((candidate) => candidate.id);
		new RelationshipPresetModal(
			this.app,
			preset ? { kind: "edit", preset } : { kind: "create" },
			existingIds,
			async (next) => {
				const presets = [...this.plugin.settings.relationshipPresets];
				if (preset) {
					const index = presets.findIndex((candidate) => candidate.id === preset.id);
					if (index < 0) return false;
					presets[index] = next;
				} else presets.push(next);
				const saved = await this.plugin.updateSetting("relationshipPresets", presets);
				if (saved) this.update();
				return saved;
			},
		).open();
	}

	private openPresetSync(presetId: string): void {
		if (!this.canManageRelationshipTemplates()) return;
		const preset = this.plugin.settings.relationshipPresets.find((candidate) => candidate.id === presetId);
		if (!preset) {
			new Notice(`Relationship template “${presetId}” is no longer available.`);
			return;
		}
		const changes = this.plugin.getRelationshipPresetSyncChanges(presetId);
		if (changes.length === 0) {
			new Notice("All indexed relationship notes with this template provenance already match its copied values.");
			return;
		}
		new RelationshipPresetSyncModal(this.app, preset, changes, (approved) =>
			this.plugin.syncRelationshipPreset(presetId, approved),
		).open();
	}

	private async reorderPreset(oldIndex: number, newIndex: number): Promise<void> {
		if (!this.canManageRelationshipTemplates()) return;
		const presets = [...this.plugin.settings.relationshipPresets];
		const [preset] = presets.splice(oldIndex, 1);
		if (!preset) return;
		presets.splice(newIndex, 0, preset);
		if (await this.plugin.updateSetting("relationshipPresets", presets)) this.update();
	}

	private deletePreset(index: number): void {
		if (!this.canManageRelationshipTemplates()) return;
		const preset = this.plugin.settings.relationshipPresets[index];
		if (!preset) return;
		const deleteSelectedPreset = async (): Promise<void> => {
			const selectedIndex = this.plugin.settings.relationshipPresets.findIndex(
				(candidate) => candidate.id === preset.id,
			);
			if (selectedIndex < 0) return;
			const presets = this.plugin.settings.relationshipPresets.filter(
				(_, candidateIndex) => candidateIndex !== selectedIndex,
			);
			if (await this.plugin.updateSetting("relationshipPresets", presets)) this.update();
		};
		const linked = this.plugin.getRelationshipPresetLinkCount(preset.id);
		if (linked === 0) {
			void deleteSelectedPreset();
			return;
		}

		const modal = new ConfirmationModal(this.app)
			.setTitle(`Delete “${preset.name}” relationship template?`)
			.setContent(
				`This template is linked to ${linked} relationship note${
					linked === 1 ? "" : "s"
				}. Those notes will keep their copied types and roles. Their template provenance will no longer refer to an existing template.`,
			);
		modal.addCancelButton("Cancel");
		modal.addButton((button) =>
			button
				.setButtonText("Delete relationship template")
				.setDestructive()
				.setCta()
				.onClick(async () => {
					if (!this.canManageRelationshipTemplates()) return;
					await deleteSelectedPreset();
				}),
		);
		modal.open();
	}

	private canManageRelationshipTemplates(): boolean {
		if (this.plugin.canWritePeopleAtlasData()) return true;
		new Notice("Relationship template settings are read-only until the People Atlas plugin data is repaired.");
		return false;
	}
}
