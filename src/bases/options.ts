import type { BasesOptions } from "obsidian";

export const BASES_OPTION_KEYS = {
	nameProperty: "nameProperty",
	idProperty: "idProperty",
	photoProperty: "photoProperty",
	organisationsProperty: "organisationsProperty",
	contactsProperty: "contactsProperty",
	birthDateProperty: "birthDateProperty",
	pronounsProperty: "pronounsProperty",
	genderProperty: "genderProperty",
	emailsProperty: "emailsProperty",
	phonesProperty: "phonesProperty",
	jobTitleProperty: "jobTitleProperty",
	centerPersonId: "centerPersonId",
	centerMode: "centerMode",
	projectionMode: "projectionMode",
	hops: "hops",
	maxNodes: "maxNodes",
	stateKey: "stateKey",
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
			key: BASES_OPTION_KEYS.birthDateProperty,
			displayName: "Birth date property",
			placeholder: "Select a birth date property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.pronounsProperty,
			displayName: "Pronouns property",
			placeholder: "Select a pronouns property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.genderProperty,
			displayName: "Gender property",
			placeholder: "Select a gender property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.emailsProperty,
			displayName: "Email addresses property",
			placeholder: "Select an email addresses property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.phonesProperty,
			displayName: "Phone numbers property",
			placeholder: "Select a phone numbers property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.jobTitleProperty,
			displayName: "Job title property",
			placeholder: "Select a job title property",
		},
		{
			type: "property",
			key: BASES_OPTION_KEYS.contactsProperty,
			displayName: "Linked people property",
			placeholder: "Select a linked people property",
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.centerPersonId,
			displayName: "Center person ID",
			placeholder: "Optional person_id",
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.centerMode,
			displayName: "Center mode",
			placeholder: "configured, active-note, selected-node or none",
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.projectionMode,
			displayName: "Projection mode",
			placeholder: "ego, free-network or contact-health",
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.hops,
			displayName: "Ego hops",
			placeholder: "2",
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.maxNodes,
			displayName: "Maximum nodes",
			placeholder: "500",
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.stateKey,
			displayName: "View state key",
			placeholder: "Optional stable key for this view",
		},
		{
			type: "toggle",
			key: BASES_OPTION_KEYS.showLabels,
			displayName: "Show labels",
			default: true,
		},
	];
}
