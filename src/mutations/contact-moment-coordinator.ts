import type { TFile } from "obsidian";
import type {
	ContactMomentFollowUpStatusMutationInput,
	ContactMomentFollowUpStatusMutationResult,
	ContactMomentMutationInput,
	ContactMomentMutationResult,
	ContactMomentRelationshipRetryResult,
	ContactMomentRelationshipRetryToken,
	ContactMomentSaveOptions,
	ContactMomentUpdateOptions,
	ContactMomentUpdates,
} from "./contact-moment";

export interface ContactMomentMutationOperations {
	createContactMoment(
		input: ContactMomentMutationInput,
		options: ContactMomentSaveOptions,
	): Promise<ContactMomentMutationResult>;
	updateContactMoment(
		file: TFile,
		input: ContactMomentMutationInput,
		updates: ContactMomentUpdates,
		options: ContactMomentUpdateOptions,
	): Promise<ContactMomentMutationResult>;
	updateContactMomentFollowUpStatus(
		input: ContactMomentFollowUpStatusMutationInput,
	): Promise<ContactMomentFollowUpStatusMutationResult>;
	retryContactMomentRelationship(
		retry: ContactMomentRelationshipRetryToken,
	): Promise<ContactMomentRelationshipRetryResult>;
}

/** Coordinates contact-moment, follow-up and retry mutations behind service-owned guards. */
export class ContactMomentMutationCoordinator {
	constructor(private readonly operations: ContactMomentMutationOperations) {}

	createContactMoment(
		input: ContactMomentMutationInput,
		options: ContactMomentSaveOptions,
	): Promise<ContactMomentMutationResult> {
		return this.operations.createContactMoment(input, options);
	}

	updateContactMoment(
		file: TFile,
		input: ContactMomentMutationInput,
		updates: ContactMomentUpdates,
		options: ContactMomentUpdateOptions,
	): Promise<ContactMomentMutationResult> {
		return this.operations.updateContactMoment(file, input, updates, options);
	}

	updateContactMomentFollowUpStatus(
		input: ContactMomentFollowUpStatusMutationInput,
	): Promise<ContactMomentFollowUpStatusMutationResult> {
		return this.operations.updateContactMomentFollowUpStatus(input);
	}

	retryContactMomentRelationship(
		retry: ContactMomentRelationshipRetryToken,
	): Promise<ContactMomentRelationshipRetryResult> {
		return this.operations.retryContactMomentRelationship(retry);
	}
}
