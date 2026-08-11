import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import type { PeopleAtlasSettings } from "../src/settings/types";

export function unicodePropertySettings(): PeopleAtlasSettings {
	return {
		...structuredClone(DEFAULT_SETTINGS),
		typeProperty: "тип_名",
		personIdProperty: "person-id_关系",
		nameProperty: "имя-1",
		aliasesProperty: "aliasé_2",
		organisationsProperty: "организация-3",
		photoProperty: "фото_4",
		contactsProperty: "連絡先-5",
		birthDateProperty: "naissance_6",
		pronounsProperty: "代名詞-7",
		genderProperty: "género_8",
		emailsProperty: "e-mail_9",
		phonesProperty: "телефон-10",
		jobTitleProperty: "職名_11",
		relationshipIdProperty: "relation-id_12",
		relationshipFromProperty: "от-13",
		relationshipToProperty: "to-14",
		relationshipTypesProperty: "τύποι_15",
		relationshipPresetProperty: "preset-16",
		relationshipFromRoleProperty: "rol-17",
		relationshipToRoleProperty: "rol-18",
		closenessProperty: "близость_19",
		sinceProperty: "sinds-20",
		lastContactProperty: "dernier-21",
		statusProperty: "status-22",
		contactMomentIdProperty: "contact-id_23",
		contactMomentPeopleProperty: "personnes-24",
		contactMomentRelationshipProperty: "relatie_25",
		contactMomentOccurredOnProperty: "datum-26",
		contactMomentChannelProperty: "канал-27",
		contactMomentSummaryProperty: "samenvatting_28",
		contactMomentFollowUpOnProperty: "follow-up-29",
		contactMomentFollowUpStatusProperty: "status-opvolging_30",
	};
}

export function serializedPropertyOccurrences(source: string, propertyName: string): number {
	const lines = source.split(/\r?\n/);
	const frontmatterStart = lines[0] === "---" ? 1 : 0;
	const frontmatterEnd = lines.indexOf("---", frontmatterStart);
	const frontmatter = lines.slice(frontmatterStart, frontmatterEnd < 0 ? lines.length : frontmatterEnd);
	return frontmatter.filter((line) => line.startsWith(`${propertyName}:`)).length;
}
