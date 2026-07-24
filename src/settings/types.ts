export interface PeopleAtlasSettings {
	schemaVersion: number;
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
}
