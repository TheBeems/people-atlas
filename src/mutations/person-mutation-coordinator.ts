import type { TFile } from "obsidian";
import type { PersonEditOptions, PersonEditResult } from "./atlas-mutation-service";
import type { PersonMutationInput, PersonUpdates } from "./validation";

export interface PersonMutationOperations {
	createPerson(input: PersonMutationInput): Promise<TFile>;
	updatePerson(file: TFile, updates: PersonUpdates, options: PersonEditOptions): Promise<PersonEditResult>;
}

/** Coordinates person mutations while leaving queue, guards and reservations with the service. */
export class PersonMutationCoordinator {
	constructor(private readonly operations: PersonMutationOperations) {}

	createPerson(input: PersonMutationInput): Promise<TFile> {
		return this.operations.createPerson(input);
	}

	updatePerson(file: TFile, updates: PersonUpdates, options: PersonEditOptions): Promise<PersonEditResult> {
		return this.operations.updatePerson(file, updates, options);
	}
}
