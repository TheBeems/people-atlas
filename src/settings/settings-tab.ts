import { PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type PeopleAtlasPlugin from "../main";
import type { PeopleAtlasSettings } from "./types";
import { validatePeopleFolder, validatePropertyName } from "./validate";

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
			property("Person ID property", "Stable ID. A normalized file path is used only when this is absent.", "personIdProperty"),
			property("Name property", "Human-readable display name.", "nameProperty"),
			property("Aliases property", "Alternative names used only for display and search.", "aliasesProperty"),
			property("Organisations property", "Organisations associated with the person.", "organisationsProperty"),
			property("Photo property", "Wikilink or vault path to a photo.", "photoProperty"),
			property("Contacts property", "List of simple wikilink contacts on a person note.", "contactsProperty"),
			property("Relationship ID property", "Stable ID for a relationship note; the path is used when absent.", "relationshipIdProperty"),
			property("Relationship from property", "Source person wikilink or person ID.", "relationshipFromProperty"),
			property("Relationship to property", "Target person wikilink or person ID.", "relationshipToProperty"),
			property("Relationship types property", "One or more relationship labels.", "relationshipTypesProperty"),
			property("Relationship direction property", "Optional direction: undirected or source-to-target.", "directionProperty"),
			property("Closeness property", "Optional closeness value from 1 to 5.", "closenessProperty"),
			property("Since property", "Optional ISO date when the relationship began.", "sinceProperty"),
			property("Last contact property", "Optional ISO date for the last interaction.", "lastContactProperty"),
			property("Status property", "Optional relationship lifecycle status.", "statusProperty"),
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
}
