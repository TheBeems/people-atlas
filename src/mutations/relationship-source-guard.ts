import type { PeopleAtlasSettings } from "../settings/types";

export interface RelationshipEditSourceBaseline {
	readonly path: string;
	readonly signature: string;
}

export function captureRelationshipEditSourceBaseline(
	path: string,
	frontmatter: Record<string, unknown>,
	settings: PeopleAtlasSettings,
): RelationshipEditSourceBaseline {
	const properties = [
		settings.typeProperty,
		settings.relationshipIdProperty,
		settings.relationshipFromProperty,
		settings.relationshipToProperty,
		settings.relationshipTypesProperty,
		settings.relationshipPresetProperty,
		settings.relationshipFromRoleProperty,
		settings.relationshipToRoleProperty,
		settings.closenessProperty,
		settings.sinceProperty,
		settings.untilProperty,
		settings.contactIntervalDaysProperty,
		settings.lastContactProperty,
		settings.statusProperty,
	];
	return Object.freeze({
		path,
		signature: JSON.stringify([
			settings.relationshipTypeValue,
			...properties.map((property) => [
				property,
				Object.prototype.hasOwnProperty.call(frontmatter, property),
				frontmatter[property],
			]),
		]),
	});
}

export function relationshipEditSourceMatches(
	path: string,
	frontmatter: Record<string, unknown>,
	settings: PeopleAtlasSettings,
	baseline: RelationshipEditSourceBaseline,
): boolean {
	return (
		path === baseline.path &&
		captureRelationshipEditSourceBaseline(path, frontmatter, settings).signature === baseline.signature
	);
}
