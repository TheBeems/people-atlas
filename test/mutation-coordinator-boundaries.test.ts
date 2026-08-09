import type { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { ContactMomentMutationCoordinator } from "../src/mutations/contact-moment-coordinator";
import { PersonMutationCoordinator } from "../src/mutations/person-mutation-coordinator";
import { RelationshipMutationCoordinator } from "../src/mutations/relationship-mutation-coordinator";
import type {
	ContactMomentFollowUpStatusMutationInput,
	ContactMomentMutationInput,
	ContactMomentSaveOptions,
	ContactMomentUpdateOptions,
	ContactMomentUpdates,
	ContactMomentRelationshipRetryResult,
	ContactMomentRelationshipRetryToken,
	ContactMomentMutationResult,
	ContactMomentFollowUpStatusMutationResult,
} from "../src/mutations/contact-moment";
import type {
	PersonEditOptions,
	PersonEditResult,
	RelationshipPresetSyncUpdates,
} from "../src/mutations/atlas-mutation-service";
import type {
	PersonMutationInput,
	PersonUpdates,
	RelationshipMutationInput,
	RelationshipUpdates,
} from "../src/mutations/validation";
import type { RelationshipPresetValues } from "../src/settings/relationship-presets";

const file = { path: "People/Example.md" } as TFile;

const personInput = {} as PersonMutationInput;
const personUpdates = {} as PersonUpdates;
const personOptions = {} as PersonEditOptions;
const relationshipInput = {} as RelationshipMutationInput;
const relationshipUpdates = {} as RelationshipUpdates;
const presetBefore = {} as RelationshipPresetValues;
const presetUpdates = {} as RelationshipPresetSyncUpdates;
const momentInput = {} as ContactMomentMutationInput;
const momentSaveOptions = {} as ContactMomentSaveOptions;
const momentUpdates = {} as ContactMomentUpdates;
const momentUpdateOptions = {} as ContactMomentUpdateOptions;
const followUpInput = {} as ContactMomentFollowUpStatusMutationInput;
const retryToken = {} as ContactMomentRelationshipRetryToken;

describe("mutation coordinators", () => {
	it("forward person and relationship operations without owning mutation state", async () => {
		const calls: string[] = [];
		const person = new PersonMutationCoordinator({
			createPerson: async () => {
				calls.push("create-person");
				return file;
			},
			updatePerson: async () => {
				calls.push("update-person");
				return { file, renamed: false } satisfies PersonEditResult;
			},
		});
		const relationship = new RelationshipMutationCoordinator({
			createRelationship: async () => {
				calls.push("create-relationship");
				return file;
			},
			updateRelationship: async () => {
				calls.push("update-relationship");
			},
			syncRelationshipPreset: async () => {
				calls.push("sync-preset");
				return { status: "updated" };
			},
		});

		expect(await person.createPerson(personInput)).toBe(file);
		expect(await person.updatePerson(file, personUpdates, personOptions)).toEqual({ file, renamed: false });
		expect(await relationship.createRelationship(relationshipInput)).toBe(file);
		await relationship.updateRelationship(file, relationshipUpdates);
		expect(await relationship.syncRelationshipPreset(file, presetBefore, presetUpdates)).toEqual({ status: "updated" });
		expect(calls).toEqual([
			"create-person",
			"update-person",
			"create-relationship",
			"update-relationship",
			"sync-preset",
		]);
	});

	it("forwards contact-moment create, update, status and retry as one domain surface", async () => {
		const calls: string[] = [];
		const success = {
			status: "success",
			file,
			created: false,
			relationship: { status: "not-requested", message: "ok" },
		} satisfies ContactMomentMutationResult;
		const statusResult = { file, status: "done" } satisfies ContactMomentFollowUpStatusMutationResult;
		const retryResult = { status: "error", message: "retry" } satisfies ContactMomentRelationshipRetryResult;
		const contact = new ContactMomentMutationCoordinator({
			createContactMoment: async () => {
				calls.push("create");
				return success;
			},
			updateContactMoment: async () => {
				calls.push("update");
				return success;
			},
			updateContactMomentFollowUpStatus: async () => {
				calls.push("status");
				return statusResult;
			},
			retryContactMomentRelationship: async () => {
				calls.push("retry");
				return retryResult;
			},
		});

		expect(await contact.createContactMoment(momentInput, momentSaveOptions)).toBe(success);
		expect(await contact.updateContactMoment(file, momentInput, momentUpdates, momentUpdateOptions)).toBe(success);
		expect(await contact.updateContactMomentFollowUpStatus(followUpInput)).toBe(statusResult);
		expect(await contact.retryContactMomentRelationship(retryToken)).toBe(retryResult);
		expect(calls).toEqual(["create", "update", "status", "retry"]);
	});
});
