import type { BasesOptions } from "obsidian";

export const BASES_OPTION_KEYS = {
	nameProperty: "nameProperty",
	idProperty: "idProperty",
	photoProperty: "photoProperty",
	organisationsProperty: "organisationsProperty",
	contactsProperty: "contactsProperty",
	centerPersonId: "centerPersonId",
	showLabels: "showLabels",
} as const;

export function buildBasesOptions(): BasesOptions[] {
	return [
		{
			type: "property",
			key: BASES_OPTION_KEYS.nameProperty,
			displayName: "Name property",
			placeholder: "Select a name property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.idProperty,
			displayName: "Person ID property",
			placeholder: "Select a stable ID property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.photoProperty,
			displayName: "Photo property",
			placeholder: "Select a photo property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.organisationsProperty,
			displayName: "Organisations property",
			placeholder: "Select an organisations property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.contactsProperty,
			displayName: "Contacts property",
			placeholder: "Select a contacts property",
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.centerPersonId,
			displayName: "Center person ID",
			placeholder: "Optional person_id",
		},
		{
			type: "toggle",
			key: BASES_OPTION_KEYS.showLabels,
			displayName: "Show labels",
			default: true,
		},
	];
}
