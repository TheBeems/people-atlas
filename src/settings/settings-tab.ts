import { Notice, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type PeopleAtlasPlugin from "../main";
import { RelationshipPresetModal } from "./relationship-preset-modal";
import { RelationshipPresetSyncModal } from "./relationship-preset-sync-modal";
import type { PeopleAtlasSettings } from "./types";
import { validatePeopleFolder, validatePropertyName, validateRelationshipRoleFormatSetting } from "./validate";

export class PeopleAtlasSettingTab extends PluginSettingTab {
	plugin: PeopleAtlasPlugin;

	constructor(plugin: PeopleAtlasPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	override getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof PeopleAtlasSettings];
	}

	override setControlValue(key: string, value: unknown): void {
		void this.plugin.updateSetting(key as keyof PeopleAtlasSettings, value);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		const property = (name: string, desc: string, key: keyof PeopleAtlasSettings): SettingDefinitionItem => ({
			name,
			desc,
			control: {
				type: "text",
				key,
				validate: validatePropertyName,
			},
		});

		return [
			{
				name: "People folder",
				desc: "Default vault folder for person notes created by People Atlas.",
				control: { type: "text", key: "peopleFolder", placeholder: "People", validate: validatePeopleFolder },
			},
			{
				name: "Person type value",
				desc: "Value in the type property that identifies a person note.",
				control: { type: "text", key: "personTypeValue", placeholder: "person" },
			},
			{
				name: "Relationship type value",
				desc: "Value in the type property that identifies a relationship note.",
				control: { type: "text", key: "relationshipTypeValue", placeholder: "relationship" },
			},
			{
				name: "Fallback person tag",
				desc: "A note with this tag is also treated as a person when no type value is present.",
				control: { type: "text", key: "personTag", placeholder: "person" },
			},
			property("Type property", "Property used to distinguish person and relationship notes.", "typeProperty"),
			property(
				"Person ID property",
				"Stable ID. A normalized file path is used only when this is absent.",
				"personIdProperty",
			),
			property("Name property", "Human-readable display name.", "nameProperty"),
			property("Aliases property", "Alternative names used only for display and search.", "aliasesProperty"),
			property("Organisations property", "Organisations associated with the person.", "organisationsProperty"),
			property("Photo property", "Wikilink or vault path to a photo.", "photoProperty"),
			property("Contacts property", "List of simple wikilink contacts on a person note.", "contactsProperty"),
			property(
				"Relationship ID property",
				"Stable ID for a relationship note; the path is used when absent.",
				"relationshipIdProperty",
			),
			property("Relationship from property", "Source person wikilink or person ID.", "relationshipFromProperty"),
			property("Relationship to property", "Target person wikilink or person ID.", "relationshipToProperty"),
			property("Relationship types property", "One or more relationship labels.", "relationshipTypesProperty"),
			property(
				"Relationship preset property",
				"Optional stable preset ID copied onto a relationship note.",
				"relationshipPresetProperty",
			),
			property(
				"Person A role property",
				"Optional role of the from endpoint relative to the to endpoint.",
				"relationshipFromRoleProperty",
			),
			property(
				"Person B role property",
				"Optional role of the to endpoint relative to the from endpoint.",
				"relationshipToRoleProperty",
			),
			property(
				"Relationship direction property",
				"Optional direction: undirected or source-to-target.",
				"directionProperty",
			),
			property("Closeness property", "Optional closeness value from 1 to 5.", "closenessProperty"),
			property("Since property", "Optional ISO date when the relationship began.", "sinceProperty"),
			property("Last contact property", "Optional ISO date for the last interaction.", "lastContactProperty"),
			property("Status property", "Optional relationship lifecycle status.", "statusProperty"),
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
				heading: "Relationship presets",
				emptyState: "No relationship presets configured.",
				items: this.plugin.settings.relationshipPresets.map((preset) => ({
					name: preset.name,
					desc: `${preset.id} · ${preset.types.join(", ")} · ${preset.fromRole} / ${preset.toRole} · ${preset.direction}`,
					render: (setting) => {
						setting
							.setName(preset.name)
							.setDesc(
								`${preset.id} · ${preset.types.join(", ")} · ${preset.fromRole} / ${preset.toRole} · ${preset.direction}`,
							)
							.addButton((button) =>
								button
									.setButtonText("Edit")
									.setTooltip(`Edit ${preset.name}`)
									.onClick(() => this.openPresetEditor(preset.id)),
							)
							.addButton((button) => {
								const count = this.plugin.getRelationshipPresetSyncChanges(preset.id).length;
								return button
									.setButtonText("Sync")
									.setTooltip(
										count > 0
											? `Review and synchronize ${count} linked relationship note${count === 1 ? "" : "s"}`
											: "All indexed linked relationship notes already match",
									)
									.setDisabled(count === 0)
									.onClick(() => this.openPresetSync(preset.id));
							});
					},
				})),
				onReorder: (oldIndex, newIndex) => void this.reorderPreset(oldIndex, newIndex),
				onDelete: (index) => void this.deletePreset(index),
				addItem: {
					name: "Add relationship preset",
					action: () => this.openPresetEditor(),
				},
			},
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
	}

	private openPresetEditor(presetId?: string): void {
		const preset = presetId
			? this.plugin.settings.relationshipPresets.find((candidate) => candidate.id === presetId)
			: undefined;
		if (presetId && !preset) {
			new Notice(`Relationship preset “${presetId}” is no longer available.`);
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
		const preset = this.plugin.settings.relationshipPresets.find((candidate) => candidate.id === presetId);
		if (!preset) {
			new Notice(`Relationship preset “${presetId}” is no longer available.`);
			return;
		}
		const changes = this.plugin.getRelationshipPresetSyncChanges(presetId);
		if (changes.length === 0) {
			new Notice("All indexed linked relationship notes already match this preset.");
			return;
		}
		new RelationshipPresetSyncModal(this.app, preset, changes, (approved) =>
			this.plugin.syncRelationshipPreset(presetId, approved),
		).open();
	}

	private async reorderPreset(oldIndex: number, newIndex: number): Promise<void> {
		const presets = [...this.plugin.settings.relationshipPresets];
		const [preset] = presets.splice(oldIndex, 1);
		if (!preset) return;
		presets.splice(newIndex, 0, preset);
		if (await this.plugin.updateSetting("relationshipPresets", presets)) this.update();
	}

	private async deletePreset(index: number): Promise<void> {
		const preset = this.plugin.settings.relationshipPresets[index];
		if (!preset) return;
		const linked = this.plugin.getRelationshipPresetLinkCount(preset.id);
		if (linked > 0) {
			const win = this.containerEl.ownerDocument.defaultView;
			if (
				!win?.confirm(
					`Delete “${preset.name}”? ${linked} linked relationship note${
						linked === 1 ? "" : "s"
					} will retain copied values but the preset link will be unavailable.`,
				)
			) {
				return;
			}
		}
		const presets = this.plugin.settings.relationshipPresets.filter((_, candidateIndex) => candidateIndex !== index);
		if (await this.plugin.updateSetting("relationshipPresets", presets)) this.update();
	}
}
