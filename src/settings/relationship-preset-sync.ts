import type { RelationshipRecord } from "../domain/types";
import type { RelationshipPresetSyncUpdates } from "../mutations/atlas-mutation-service";
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

export function relationshipPresetUpdates(preset: RelationshipPreset): RelationshipPresetSyncUpdates {
	return {
		types: [...preset.types],
		fromRole: preset.fromRole,
		toRole: preset.toRole,
	};
}

export function sameRelationshipPresetValues(left: RelationshipPresetValues, right: RelationshipPresetValues): boolean {
	return (
		left.presetId === right.presetId &&
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
		fromRole: relationship.fromRole,
		toRole: relationship.toRole,
	};
}

function presetValues(preset: RelationshipPreset): RelationshipPresetValues {
	return {
		presetId: preset.id,
		types: [...preset.types],
		fromRole: preset.fromRole,
		toRole: preset.toRole,
	};
}
