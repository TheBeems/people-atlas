import type { RelationshipRecord } from "../domain/types";
import type { RelationshipUpdates } from "../mutations/validation";
import {
	relationshipPresetMatches,
	type RelationshipPreset,
	type RelationshipPresetValues,
} from "./relationship-presets";

export interface RelationshipPresetSyncChange {
	filePath: string;
	before: RelationshipPresetValues;
	after: RelationshipPresetValues;
}

export interface RelationshipPresetSyncResult {
	completed: number;
	skipped: number;
	remaining: number;
	failure?: {
		filePath?: string | undefined;
		message: string;
	};
}

export function buildRelationshipPresetSyncChanges(
	relationships: RelationshipRecord[],
	preset: RelationshipPreset,
): RelationshipPresetSyncChange[] {
	return relationships
		.filter((relationship) => relationship.presetId === preset.id)
		.filter((relationship) => !relationshipPresetMatches(relationship, preset))
		.map((relationship) => ({
			filePath: relationship.filePath,
			before: relationshipValues(relationship),
			after: presetValues(preset),
		}))
		.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

export function relationshipPresetUpdates(preset: RelationshipPreset): RelationshipUpdates {
	return {
		presetId: preset.id,
		types: [...preset.types],
		fromRole: preset.fromRole,
		toRole: preset.toRole,
		direction: preset.direction,
	};
}

export function sameRelationshipPresetValues(left: RelationshipPresetValues, right: RelationshipPresetValues): boolean {
	return (
		left.presetId === right.presetId &&
		left.direction === right.direction &&
		left.fromRole === right.fromRole &&
		left.toRole === right.toRole &&
		left.types.length === right.types.length &&
		left.types.every((type, index) => type === right.types[index])
	);
}

function relationshipValues(relationship: RelationshipRecord): RelationshipPresetValues {
	return {
		presetId: relationship.presetId,
		types: [...relationship.types],
		direction: relationship.direction,
		fromRole: relationship.fromRole,
		toRole: relationship.toRole,
	};
}

function presetValues(preset: RelationshipPreset): RelationshipPresetValues {
	return {
		presetId: preset.id,
		types: [...preset.types],
		direction: preset.direction,
		fromRole: preset.fromRole,
		toRole: preset.toRole,
	};
}
