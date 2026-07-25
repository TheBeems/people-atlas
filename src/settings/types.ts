import type { AtlasViewState } from "./view-state";

export interface PeopleAtlasSettings {
	schemaVersion: number;
	peopleFolder: string;
	typeProperty: string;
	personTypeValue: string;
	relationshipTypeValue: string;
	personTag: string;
	personIdProperty: string;
	nameProperty: string;
	aliasesProperty: string;
	organisationsProperty: string;
	photoProperty: string;
	contactsProperty: string;
	relationshipIdProperty: string;
	relationshipFromProperty: string;
	relationshipToProperty: string;
	relationshipTypesProperty: string;
	directionProperty: string;
	closenessProperty: string;
	sinceProperty: string;
	lastContactProperty: string;
	statusProperty: string;
	defaultCenterPersonId: string;
	enableBases: boolean;
	showLabels: boolean;
	showDiagnostics: boolean;
	viewStates: Record<string, AtlasViewState>;
}
