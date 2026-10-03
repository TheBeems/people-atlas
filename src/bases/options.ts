import type { BasesOptions } from "obsidian";
import { createTranslator, type Translator } from "../i18n";

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
	layoutMode: "layoutMode",
	relationshipDate: "relationshipDate",
} as const;

export function buildBasesOptions(t: Translator = createTranslator("en")): BasesOptions[] {
	const options: BasesOptions[] = [
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
			type: "dropdown",
			key: BASES_OPTION_KEYS.centerMode,
			displayName: "Center mode",
			default: "configured",
			options: {
				configured: t.peopleAtlasView.configuredCenter,
				"active-note": t.peopleAtlasView.activeNote,
				"selected-node": t.peopleAtlasView.selectedNode,
				none: t.peopleAtlasView.noCenter,
			},
		},
		{
			type: "dropdown",
			key: BASES_OPTION_KEYS.projectionMode,
			displayName: "Projection mode",
			default: "ego",
			options: {
				ego: t.peopleAtlasView.egoNetwork,
				"free-network": t.peopleAtlasView.freeNetwork,
				"contact-health": t.peopleAtlasView.contactHealth,
			},
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
			type: "dropdown",
			key: BASES_OPTION_KEYS.layoutMode,
			displayName: t.networkInsight.layout,
			default: "radial",
			options: { radial: t.networkInsight.radial, family: t.networkInsight.family },
		},
		{
			type: "text",
			key: BASES_OPTION_KEYS.relationshipDate,
			displayName: t.networkInsight.asOfDate,
			placeholder: "YYYY-MM-DD",
		},
		{
			type: "toggle",
			key: BASES_OPTION_KEYS.showLabels,
			displayName: "Show labels",
			default: true,
		},
	];
	return options.map((option) => ({
		...option,
		displayName: t.basesOptions[option.key as keyof typeof BASES_OPTION_KEYS],
		...(option.type === "property" ? { placeholder: t.basesOptions.propertyPlaceholder } : {}),
		...(option.key === BASES_OPTION_KEYS.centerPersonId ? { placeholder: t.basesOptions.personIdPlaceholder } : {}),
		...(option.key === BASES_OPTION_KEYS.stateKey ? { placeholder: t.basesOptions.stateKeyPlaceholder } : {}),
	}));
}
