import type { AtlasViewState } from "./view-state";
import type { RelationshipPreset } from "./relationship-presets";

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
	relationshipPresetProperty: string;
	relationshipFromRoleProperty: string;
	relationshipToRoleProperty: string;
	directionProperty: string;
	closenessProperty: string;
	sinceProperty: string;
	lastContactProperty: string;
	statusProperty: string;
	defaultCenterPersonId: string;
	enableBases: boolean;
	showLabels: boolean;
	showDiagnostics: boolean;
	relationshipRoleFormat: string;
	relationshipPresets: RelationshipPreset[];
	viewStates: Record<string, AtlasViewState>;
}
