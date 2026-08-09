import type { TFile } from "obsidian";
import type { RelationshipPresetSyncMutationResult, RelationshipPresetSyncUpdates } from "./atlas-mutation-service";
import type { RelationshipMutationInput, RelationshipUpdates } from "./validation";
import type { RelationshipPresetValues } from "../settings/relationship-presets";

export interface RelationshipMutationOperations {
	createRelationship(input: RelationshipMutationInput): Promise<TFile>;
	updateRelationship(file: TFile, updates: RelationshipUpdates): Promise<void>;
	syncRelationshipPreset(
		file: TFile,
		approvedBefore: RelationshipPresetValues,
		updates: RelationshipPresetSyncUpdates,
	): Promise<RelationshipPresetSyncMutationResult>;
}

/** Coordinates relationship mutations while leaving queue, guards and reservations with the service. */
export class RelationshipMutationCoordinator {
	constructor(private readonly operations: RelationshipMutationOperations) {}

	createRelationship(input: RelationshipMutationInput): Promise<TFile> {
		return this.operations.createRelationship(input);
	}

	updateRelationship(file: TFile, updates: RelationshipUpdates): Promise<void> {
		return this.operations.updateRelationship(file, updates);
	}

	syncRelationshipPreset(
		file: TFile,
		approvedBefore: RelationshipPresetValues,
		updates: RelationshipPresetSyncUpdates,
	): Promise<RelationshipPresetSyncMutationResult> {
		return this.operations.syncRelationshipPreset(file, approvedBefore, updates);
	}
}
