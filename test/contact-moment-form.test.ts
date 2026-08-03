import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { ContactMomentRecord, PersonRecord, RelationshipRecord } from "../src/domain/types";
import {
	ContactMomentFormSession,
	buildContactMomentMutationInput,
	buildContactMomentUpdates,
	createContactMomentFormValues,
	editContactMomentFormValues,
	matchingContactMomentRelationships,
	type ContactMomentFormContext,
} from "../src/editor/contact-moment-form";
import type {
	ContactMomentMutationResult,
	ContactMomentRelationshipRetryResult,
} from "../src/mutations/contact-moment";

const alice: PersonRecord = {
	id: "person-alice",
	filePath: "People/Alice.md",
	name: "Alice / Admin",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};
const bob: PersonRecord = {
	id: "person-bob",
	filePath: "People/Bob.md",
	name: "Bob",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};
const charlie: PersonRecord = {
	id: "person-charlie",
	filePath: "People/Charlie.md",
	name: "Charlie",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};
const aliceBob: RelationshipRecord = {
	id: "relationship-alice-bob",
	filePath: "People/Relationships/Alice - Bob.md",
	from: { raw: "[[People/Alice]]", target: "People/Alice", resolvedPath: alice.filePath },
	to: { raw: "[[People/Bob]]", target: "People/Bob", resolvedPath: bob.filePath },
	types: ["friend"],
};
const bobCharlie: RelationshipRecord = {
	id: "relationship-bob-charlie",
	filePath: "People/Relationships/Bob - Charlie.md",
	from: { raw: "[[People/Bob]]", target: "People/Bob", resolvedPath: bob.filePath },
	to: { raw: "[[People/Charlie]]", target: "People/Charlie", resolvedPath: charlie.filePath },
	types: ["colleague"],
};

function context(): ContactMomentFormContext {
	const paths = new Map([
		["People/Alice", alice.filePath],
		["People/Bob", bob.filePath],
		["People/Charlie", charlie.filePath],
		["People/Relationships/Alice - Bob", aliceBob.filePath],
		["People/Relationships/Bob - Charlie", bobCharlie.filePath],
	]);
	return {
		people: [alice, bob, charlie],
		relationships: [aliceBob, bobCharlie],
		resolveLink: (target) => paths.get(target),
	};
}

function moment(overrides: Partial<ContactMomentRecord> = {}): ContactMomentRecord {
	return {
		id: "moment-one",
		filePath: "People/Contact moments/2026-07-31 - Alice - mentone.md",
		people: [{ raw: "[[People/Alice]]", target: "People/Alice", resolvedPath: alice.filePath }],
		occurredOn: "2026-07-31",
		personIds: [alice.id],
		actionable: true,
		followUpActionable: false,
		...overrides,
	};
}

describe("contact-moment form mapping", () => {
	it("derives a reviewable contact-moment path from the People root and starts advancement unchecked", () => {
		const values = createContactMomentFormValues({
			peopleRootFolder: "Second Brain/People",
			contactMomentId: "contact-12345678",
			today: "2026-07-31",
			people: context().people,
			prefilledPersonPaths: [alice.filePath],
		});

		expect(values.path).toBe("Second Brain/People/Contact moments/2026-07-31 - Alice - Admin - 12345678.md");
		expect(values.peoplePaths).toEqual([alice.filePath]);
		expect(values.advanceRelationshipLastContact).toBe(false);
	});

	it("matches only unique canonical relationships sharing a selected person", () => {
		expect(matchingContactMomentRelationships([alice.filePath], context())).toEqual([aliceBob]);
		expect(matchingContactMomentRelationships([charlie.filePath], context())).toEqual([bobCharlie]);
		expect(matchingContactMomentRelationships(["Missing.md"], context())).toEqual([]);
	});

	it("rejects a relationship endpoint when stable ID and resolved path identify different people", () => {
		const conflicting: RelationshipRecord = {
			...aliceBob,
			from: {
				raw: `[[${alice.id}]]`,
				target: alice.id,
				resolvedPath: bob.filePath,
			},
		};
		const conflictingContext: ContactMomentFormContext = {
			people: [alice, bob],
			relationships: [conflicting],
			resolveLink: (target) => (target === alice.id ? bob.filePath : undefined),
		};

		expect(matchingContactMomentRelationships([alice.filePath], conflictingContext)).toEqual([]);
	});

	it("rejects a manually retained relationship path that does not overlap the selected people", () => {
		const values = createContactMomentFormValues({
			peopleRootFolder: "People",
			contactMomentId: "moment-manual",
			today: "2026-07-31",
			people: context().people,
			prefilledPersonPaths: [alice.filePath],
		});
		values.relationshipPath = bobCharlie.filePath;

		expect(() => buildContactMomentMutationInput(values, context())).toThrow(
			"must be selected from matching canonical relationships",
		);
	});

	it("rejects editing a contact moment with a non-canonical relationship", () => {
		const record = moment({
			relationship: {
				raw: "[[People/Relationships/Archived]]",
				target: "People/Relationships/Archived",
			},
		});
		expect(() => editContactMomentFormValues(record, context())).toThrow("not currently canonical");
	});

	it("writes an explicit open status when a follow-up is newly authored", () => {
		const original = editContactMomentFormValues(moment(), context());
		const values = { ...original, followUpOn: "2026-08-02" };
		const input = buildContactMomentMutationInput(values, context());
		const updates = buildContactMomentUpdates(values, original, context());

		expect(input.followUpStatus).toBe("open");
		expect(updates).toMatchObject({
			followUpOn: "2026-08-02",
			followUpStatus: "open",
		});
	});
});

describe("ContactMomentFormSession", () => {
	it("does not create a second moment after partial success and retries only the relationship", async () => {
		const file = { path: "People/Contact moments/moment.md" } as TFile;
		const retry = Object.freeze({
			attemptId: "retry-one",
			momentPath: file.path,
			relationshipPath: aliceBob.filePath,
			occurredOn: "2026-07-31",
		});
		const partial: ContactMomentMutationResult = {
			status: "partial-success",
			file,
			created: true,
			momentPath: file.path,
			relationshipPath: aliceBob.filePath,
			reason: "simulated relationship failure",
			retry,
		};
		const retried: ContactMomentRelationshipRetryResult = {
			status: "success",
			relationship: {
				status: "advanced",
				relationshipPath: aliceBob.filePath,
				lastContact: "2026-07-31",
				message: "advanced",
			},
		};
		const mutations = {
			createContactMoment: vi.fn().mockResolvedValue(partial),
			updateContactMoment: vi.fn(),
			retryContactMomentRelationship: vi.fn().mockResolvedValue(retried),
		};
		const session = new ContactMomentFormSession({ kind: "create" }, context(), mutations);
		const values = createContactMomentFormValues({
			peopleRootFolder: "People",
			contactMomentId: "moment-one",
			today: "2026-07-31",
			people: context().people,
			prefilledPersonPaths: [alice.filePath],
		});

		expect(await session.submit(values)).toBe(partial);
		expect(await session.submit(values)).toBe(partial);
		expect(mutations.createContactMoment).toHaveBeenCalledTimes(1);
		expect(await session.retryRelationship()).toEqual(retried);
		expect(mutations.retryContactMomentRelationship).toHaveBeenCalledExactlyOnceWith(retry);
	});
});
