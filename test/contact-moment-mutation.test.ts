import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { AtlasMutationService, MutationError } from "../src/mutations/atlas-mutation-service";
import {
	captureContactMomentEditSourceBaseline,
	type ContactMomentMutationInput,
} from "../src/mutations/contact-moment";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

interface HarnessNote {
	path: string;
	stat: { mtime: number; size: number };
	frontmatter: Record<string, unknown>;
	body: string;
	source: string;
}

interface HarnessFolder {
	path: string;
	children: unknown[];
}

function createHarness() {
	const entries = new Map<string, HarnessNote | HarnessFolder>();
	const peopleById = new Map<string, string[]>();
	const relationshipsById = new Map<string, string[]>();
	const contactMomentsById = new Map<string, string[]>();
	const linkDestinations = new Map<string, string>();
	const operations: string[] = [];
	const committedFrontmatterWrites: string[] = [];
	let relationshipWriteFailure = false;
	let beforeFrontmatterCallback: ((note: HarnessNote) => void) | undefined;
	let clock = 1;

	const isNote = (entry: HarnessNote | HarnessFolder | undefined): entry is HarnessNote =>
		Boolean(entry && !Array.isArray((entry as HarnessFolder).children));
	const syncSource = (note: HarnessNote): void => {
		note.source = `---\n${JSON.stringify(note.frontmatter)}\n---\n${note.body}`;
		note.stat.mtime = ++clock;
		note.stat.size = note.source.length;
	};
	const addFolder = (path: string): HarnessFolder => {
		const folder = { path, children: [] };
		entries.set(path, folder);
		return folder;
	};
	const addNote = (path: string, frontmatter: Record<string, unknown>, body = ""): HarnessNote => {
		const note: HarnessNote = {
			path,
			stat: { mtime: ++clock, size: 0 },
			frontmatter: structuredClone(frontmatter),
			body,
			source: "",
		};
		syncSource(note);
		entries.set(path, note);
		return note;
	};
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => entries.get(path),
			read: async (file: { path: string }) => {
				const note = entries.get(file.path);
				if (!isNote(note)) throw new Error(`Missing note ${file.path}`);
				return note.source;
			},
			createFolder: async (path: string) => {
				operations.push(`folder:${path}`);
				return addFolder(path);
			},
			create: async (path: string, source: string) => {
				operations.push(`create:${path}`);
				const note: HarnessNote = {
					path,
					stat: { mtime: ++clock, size: source.length },
					frontmatter: {},
					body: "",
					source,
				};
				entries.set(path, note);
				return note;
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => {
				const note = entries.get(file.path);
				return { frontmatter: isNote(note) ? note.frontmatter : {} };
			},
			getFirstLinkpathDest: (target: string) => {
				const mappedPath = linkDestinations.get(target);
				if (mappedPath) {
					const mapped = entries.get(mappedPath);
					return isNote(mapped) ? mapped : null;
				}
				const normalized = target.replace(/\\/g, "/").replace(/\.md$/i, "");
				const note = entries.get(`${normalized}.md`) ?? entries.get(normalized);
				return isNote(note) ? note : null;
			},
		},
		fileManager: {
			processFrontMatter: async (file: { path: string }, callback: (frontmatter: Record<string, unknown>) => void) => {
				const note = entries.get(file.path);
				if (!isNote(note)) throw new Error(`Missing note ${file.path}`);
				operations.push(`frontmatter:${file.path}`);
				beforeFrontmatterCallback?.(note);
				const draft = structuredClone(note.frontmatter);
				callback(draft);
				if (relationshipWriteFailure && file.path === "People/Relationships/Alice - Bob.md") {
					throw new Error("simulated relationship write failure");
				}
				note.frontmatter = draft;
				syncSource(note);
				committedFrontmatterWrites.push(file.path);
			},
		},
	} as unknown as App;
	const index = {
		getPeoplePathsById: (id: string) => peopleById.get(id) ?? [],
		getRelationshipPathsById: (id: string) => relationshipsById.get(id) ?? [],
		getContactMomentPathsById: (id: string) => contactMomentsById.get(id) ?? [],
	};
	const service = new AtlasMutationService(
		app,
		() => DEFAULT_SETTINGS,
		() => true,
		index,
		() => "unused-person-id",
		() => "moment-generated",
	);
	const addCanonicalPeopleAndRelationship = (lastContact?: string): void => {
		addFolder("People");
		addFolder("People/Relationships");
		addFolder("People/Contact moments");
		addNote("People/Alice.md", { type: "person", person_id: "person-alice", name: "Alice" });
		addNote("People/Bob.md", { type: "person", person_id: "person-bob", name: "Bob" });
		addNote("People/Charlie.md", { type: "person", person_id: "person-charlie", name: "Charlie" });
		peopleById.set("person-alice", ["People/Alice.md"]);
		peopleById.set("person-bob", ["People/Bob.md"]);
		peopleById.set("person-charlie", ["People/Charlie.md"]);
		addNote("People/Relationships/Alice - Bob.md", {
			type: "relationship",
			relationship_id: "relationship-alice-bob",
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
			relationship_types: ["friend"],
			status: "active",
			custom: "keep",
			...(lastContact ? { last_contact: lastContact } : {}),
		});
		relationshipsById.set("relationship-alice-bob", ["People/Relationships/Alice - Bob.md"]);
	};
	const createInput = (): ContactMomentMutationInput => ({
		path: "People/Contact moments/2026-07-31 - Alice - generated.md",
		people: [{ id: "person-alice", filePath: "People/Alice.md" }],
		relationship: {
			kind: "canonical",
			id: "relationship-alice-bob",
			filePath: "People/Relationships/Alice - Bob.md",
			personIds: ["person-alice", "person-bob"],
			raw: "[[People/Relationships/Alice - Bob]]",
		},
		occurredOn: "2026-07-31",
		channel: "meeting",
	});
	return {
		addCanonicalPeopleAndRelationship,
		addNote,
		get beforeFrontmatterCallback() {
			return beforeFrontmatterCallback;
		},
		set beforeFrontmatterCallback(value: ((note: HarnessNote) => void) | undefined) {
			beforeFrontmatterCallback = value;
		},
		committedFrontmatterWrites,
		contactMomentsById,
		createInput,
		entries,
		linkDestinations,
		get relationshipWriteFailure() {
			return relationshipWriteFailure;
		},
		set relationshipWriteFailure(value: boolean) {
			relationshipWriteFailure = value;
		},
		operations,
		service,
		syncSource,
	};
}

describe("AtlasMutationService contact moments", () => {
	it("creates the moment first and advances only relationship last_contact", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		const relationship = harness.entries.get("People/Relationships/Alice - Bob.md") as HarnessNote;
		const before = structuredClone(relationship.frontmatter);

		const result = await harness.service.createContactMoment(harness.createInput(), {
			advanceRelationshipLastContact: true,
		});

		expect(result).toMatchObject({
			status: "success",
			created: true,
			relationship: { status: "advanced", lastContact: "2026-07-31" },
		});
		expect(harness.operations.filter((operation) => !operation.startsWith("folder:"))).toEqual([
			"create:People/Contact moments/2026-07-31 - Alice - generated.md",
			"frontmatter:People/Relationships/Alice - Bob.md",
		]);
		expect(relationship.frontmatter).toEqual({ ...before, last_contact: "2026-07-31" });
		const created = harness.entries.get(harness.createInput().path) as HarnessNote;
		expect(created.source).toContain('contact_moment_id: "moment-generated"');
		expect(created.source).toContain('people: ["[[People/Alice]]"]');
	});

	it("preserves an equal or later relationship date without invoking a relationship write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-08-01");

		const result = await harness.service.createContactMoment(harness.createInput(), {
			advanceRelationshipLastContact: true,
		});

		expect(result).toMatchObject({
			status: "success",
			relationship: {
				status: "unchanged",
				currentLastContact: "2026-08-01",
				reason: "later",
			},
		});
		expect(harness.operations).not.toContain("frontmatter:People/Relationships/Alice - Bob.md");
	});

	it("revalidates live relationship endpoints and rejects endpoint drift before any write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		const relationship = harness.entries.get("People/Relationships/Alice - Bob.md") as HarnessNote;
		relationship.frontmatter.to = "[[People/Charlie]]";
		harness.syncSource(relationship);
		harness.operations.length = 0;

		await expect(
			harness.service.createContactMoment(harness.createInput(), {
				advanceRelationshipLastContact: true,
			}),
		).rejects.toThrow("endpoints no longer match");
		expect(harness.operations).toEqual([]);
	});

	it("rejects a relationship endpoint whose stable ID conflicts with live link resolution", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		const relationship = harness.entries.get("People/Relationships/Alice - Bob.md") as HarnessNote;
		relationship.frontmatter.from = "[[person-alice]]";
		harness.syncSource(relationship);
		harness.linkDestinations.set("person-alice", "People/Bob.md");
		harness.operations.length = 0;

		await expect(
			harness.service.createContactMoment(harness.createInput(), {
				advanceRelationshipLastContact: true,
			}),
		).rejects.toThrow("endpoints no longer match");
		expect(harness.operations).toEqual([]);
	});

	it("returns declared partial success and retries only the relationship idempotently", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		harness.relationshipWriteFailure = true;

		const partial = await harness.service.createContactMoment(harness.createInput(), {
			advanceRelationshipLastContact: true,
		});

		expect(partial).toMatchObject({
			status: "partial-success",
			created: true,
			momentPath: harness.createInput().path,
			relationshipPath: "People/Relationships/Alice - Bob.md",
			reason: "simulated relationship write failure",
		});
		if (partial.status !== "partial-success") throw new Error("Expected partial success");
		expect(harness.operations.filter((operation) => operation === `create:${harness.createInput().path}`)).toHaveLength(
			1,
		);

		harness.relationshipWriteFailure = false;
		const firstRetry = await harness.service.retryContactMomentRelationship(partial.retry);
		const writesAfterFirstRetry = harness.operations.filter(
			(operation) => operation === "frontmatter:People/Relationships/Alice - Bob.md",
		).length;
		const secondRetry = await harness.service.retryContactMomentRelationship(partial.retry);

		expect(firstRetry).toMatchObject({ status: "success", relationship: { status: "advanced" } });
		expect(secondRetry).toEqual(firstRetry);
		expect(
			harness.operations.filter((operation) => operation === "frontmatter:People/Relationships/Alice - Bob.md"),
		).toHaveLength(writesAfterFirstRetry);
	});

	it("stops a retry when the saved moment changed after partial success", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		harness.relationshipWriteFailure = true;
		const partial = await harness.service.createContactMoment(harness.createInput(), {
			advanceRelationshipLastContact: true,
		});
		if (partial.status !== "partial-success") throw new Error("Expected partial success");
		const moment = harness.entries.get(partial.momentPath) as HarnessNote;
		moment.body = "\nExternally changed.";
		harness.syncSource(moment);
		harness.relationshipWriteFailure = false;
		const writesBeforeRetry = harness.operations.filter(
			(operation) => operation === "frontmatter:People/Relationships/Alice - Bob.md",
		).length;

		const retry = await harness.service.retryContactMomentRelationship(partial.retry);

		expect(retry).toMatchObject({ status: "error" });
		if (retry.status === "error") expect(retry.message).toContain("changed after the partial save");
		expect(
			harness.operations.filter((operation) => operation === "frontmatter:People/Relationships/Alice - Bob.md"),
		).toHaveLength(writesBeforeRetry);
	});

	it("stops a retry when the relationship changed after partial success", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		harness.relationshipWriteFailure = true;
		const partial = await harness.service.createContactMoment(harness.createInput(), {
			advanceRelationshipLastContact: true,
		});
		if (partial.status !== "partial-success") throw new Error("Expected partial success");
		const relationship = harness.entries.get(partial.relationshipPath) as HarnessNote;
		relationship.frontmatter.custom = "externally changed";
		harness.syncSource(relationship);
		harness.relationshipWriteFailure = false;
		const writesBeforeRetry = harness.operations.filter(
			(operation) => operation === "frontmatter:People/Relationships/Alice - Bob.md",
		).length;

		const retry = await harness.service.retryContactMomentRelationship(partial.retry);

		expect(retry).toMatchObject({ status: "error" });
		if (retry.status === "error") expect(retry.message).toContain("changed after the partial save");
		expect(
			harness.operations.filter((operation) => operation === "frontmatter:People/Relationships/Alice - Bob.md"),
		).toHaveLength(writesBeforeRetry);
	});

	it("preserves the Markdown body and unowned frontmatter on edit", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const file = harness.addNote(
			"People/Contact moments/existing.md",
			{
				type: "contact_moment",
				contact_moment_id: "moment-existing",
				people: ["[[People/Alice]]"],
				occurred_on: "2026-07-30",
				summary: "Before",
				custom: { nested: "keep" },
			},
			"\n# Free-form details\nKeep byte content.",
		);
		harness.contactMomentsById.set("moment-existing", [file.path]);
		const sourceBaseline = captureContactMomentEditSourceBaseline(file.frontmatter, DEFAULT_SETTINGS);
		const bodyBefore = file.body;
		const result = await harness.service.updateContactMoment(
			file as unknown as TFile,
			{
				path: file.path,
				contactMomentId: "moment-existing",
				people: [{ id: "person-alice", filePath: "People/Alice.md" }],
				occurredOn: "2026-07-30",
				summary: "After",
			},
			{ summary: "After" },
			{
				advanceRelationshipLastContact: false,
				expectedContactMomentId: "moment-existing",
				sourceBaseline,
			},
		);

		expect(result).toMatchObject({ status: "success", created: false });
		expect(file.frontmatter).toMatchObject({
			type: "contact_moment",
			contact_moment_id: "moment-existing",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-30",
			summary: "After",
			custom: { nested: "keep" },
		});
		expect(file.body).toBe(bodyBefore);
	});

	it("rejects stale owned contact-moment fields before an edit or relationship write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		const file = harness.addNote("People/Contact moments/existing.md", {
			type: "contact_moment",
			contact_moment_id: "moment-existing",
			people: ["[[People/Alice]]"],
			relationship: "[[People/Relationships/Alice - Bob]]",
			occurred_on: "2026-07-30",
			summary: "Reviewed",
		});
		harness.contactMomentsById.set("moment-existing", [file.path]);
		const sourceBaseline = captureContactMomentEditSourceBaseline(file.frontmatter, DEFAULT_SETTINGS);
		file.frontmatter.occurred_on = "2026-08-10";
		file.frontmatter.summary = "Changed elsewhere";
		harness.syncSource(file);
		harness.operations.length = 0;
		const input = {
			...harness.createInput(),
			path: file.path,
			contactMomentId: "moment-existing",
			occurredOn: "2026-07-31",
			summary: "Edited in stale form",
		};

		await expect(
			harness.service.updateContactMoment(
				file as unknown as TFile,
				input,
				{ occurredOn: input.occurredOn, summary: input.summary },
				{
					advanceRelationshipLastContact: true,
					expectedContactMomentId: "moment-existing",
					sourceBaseline,
				},
			),
		).rejects.toThrow("changed after the editor was opened");
		expect(harness.operations).toEqual([]);
	});

	it("rejects an indexed ID collision before creating a note", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		harness.contactMomentsById.set("duplicate-moment", ["People/Contact moments/other.md"]);
		const input = { ...harness.createInput(), contactMomentId: "duplicate-moment" };
		harness.operations.length = 0;

		await expect(
			harness.service.createContactMoment(input, { advanceRelationshipLastContact: false }),
		).rejects.toBeInstanceOf(MutationError);
		expect(harness.operations).toEqual([]);
	});

	it.each([
		{ reviewedFollowUpStatus: undefined, status: "done" as const },
		{ reviewedFollowUpStatus: "open" as const, status: "dismissed" as const },
	])("writes only the configured follow-up status for a reviewed $reviewedFollowUpStatus row", async ({
		reviewedFollowUpStatus,
		status,
	}) => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship("2026-07-01");
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(
			path,
			{
				type: "contact_moment",
				contact_moment_id: "moment-follow-up",
				people: ["[[People/Alice]]"],
				relationship: "[[People/Relationships/Alice - Bob]]",
				occurred_on: "2026-07-31",
				follow_up_on: "2026-08-01",
				...(reviewedFollowUpStatus ? { follow_up_status: reviewedFollowUpStatus } : {}),
				last_contact: "unowned-value",
				custom: { keep: true },
			},
			"\n# Keep this body\n",
		);
		harness.contactMomentsById.set("moment-follow-up", [path]);
		const before = structuredClone(file.frontmatter);
		const relationship = harness.entries.get("People/Relationships/Alice - Bob.md") as HarnessNote;
		const relationshipBefore = structuredClone(relationship.frontmatter);
		const bodyBefore = file.body;
		harness.operations.length = 0;

		const result = await harness.service.updateContactMomentFollowUpStatus({
			filePath: path,
			contactMomentId: "moment-follow-up",
			reviewedPersonIds: ["person-alice"],
			reviewedRelationshipId: "relationship-alice-bob",
			reviewedOccurredOn: "2026-07-31",
			reviewedFollowUpOn: "2026-08-01",
			reviewedFollowUpStatus,
			status,
		});

		expect(result).toEqual({ file, status });
		expect(harness.operations).toEqual([`frontmatter:${path}`]);
		expect(file.frontmatter).toEqual({ ...before, follow_up_status: status });
		expect(file.body).toBe(bodyBefore);
		expect(relationship.frontmatter).toEqual(relationshipBefore);
		expect(harness.operations).not.toContain("frontmatter:People/Relationships/Alice - Bob.md");
	});

	it.each([
		{
			name: "people",
			change: (file: HarnessNote) => {
				file.frontmatter.people = ["[[People/Bob]]"];
			},
		},
		{
			name: "relationship",
			change: (file: HarnessNote) => {
				file.frontmatter.relationship = "[[People/Relationships/Missing]]";
			},
		},
		{
			name: "occurred-on date",
			change: (file: HarnessNote) => {
				file.frontmatter.occurred_on = "2026-07-30";
			},
		},
		{
			name: "follow-up date",
			change: (file: HarnessNote) => {
				file.frontmatter.follow_up_on = "2026-08-02";
			},
		},
		{
			name: "follow-up status",
			change: (file: HarnessNote) => {
				file.frontmatter.follow_up_status = "done";
			},
		},
		{
			name: "contact-moment identity",
			change: (file: HarnessNote) => {
				file.frontmatter.contact_moment_id = "moment-other";
			},
		},
		{
			name: "canonical type",
			change: (file: HarnessNote) => {
				file.frontmatter.type = "note";
			},
		},
	])("rejects a stale reviewed $name without attempting a write", async ({ change }) => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			relationship: "[[People/Relationships/Alice - Bob]]",
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		change(file);
		harness.syncSource(file);
		const before = structuredClone(file.frontmatter);
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedRelationshipId: "relationship-alice-bob",
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toBeInstanceOf(MutationError);
		expect(harness.operations).toEqual([]);
		expect(file.frontmatter).toEqual(before);
	});

	it("rejects a scalar people value as non-canonical without attempting a write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: "[[People/Alice]]",
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		const before = structuredClone(file.frontmatter);
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toThrow("people are no longer a non-empty list of text references");
		expect(harness.operations).toEqual([]);
		expect(harness.committedFrontmatterWrites).toEqual([]);
		expect(file.frontmatter).toEqual(before);
	});

	it.each([
		{ name: "empty", relationship: "" },
		{ name: "non-text", relationship: ["[[People/Relationships/Alice - Bob]]"] },
	])("rejects an $name relationship value when the reviewed moment had no relationship", async ({ relationship }) => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			relationship,
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		const before = structuredClone(file.frontmatter);
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toThrow("relationship no longer has the reviewed canonical value shape");
		expect(harness.operations).toEqual([]);
		expect(harness.committedFrontmatterWrites).toEqual([]);
		expect(file.frontmatter).toEqual(before);
	});

	it.each([
		{
			name: "contact-moment type",
			change: ({ moment }: { moment: HarnessNote; relationship: HarnessNote }) => {
				moment.frontmatter.type = ["contact_moment"];
			},
		},
		{
			name: "contact-moment identity",
			change: ({ moment }: { moment: HarnessNote; relationship: HarnessNote }) => {
				moment.frontmatter.contact_moment_id = ["moment-follow-up"];
			},
		},
		{
			name: "occurred-on date",
			change: ({ moment }: { moment: HarnessNote; relationship: HarnessNote }) => {
				moment.frontmatter.occurred_on = ["2026-07-31"];
			},
		},
		{
			name: "follow-up date",
			change: ({ moment }: { moment: HarnessNote; relationship: HarnessNote }) => {
				moment.frontmatter.follow_up_on = ["2026-08-01"];
			},
		},
		{
			name: "follow-up status",
			change: ({ moment }: { moment: HarnessNote; relationship: HarnessNote }) => {
				moment.frontmatter.follow_up_status = ["open"];
			},
		},
		{
			name: "relationship type",
			change: ({ relationship }: { moment: HarnessNote; relationship: HarnessNote }) => {
				relationship.frontmatter.type = ["relationship"];
			},
		},
		{
			name: "relationship identity",
			change: ({ relationship }: { moment: HarnessNote; relationship: HarnessNote }) => {
				relationship.frontmatter.relationship_id = ["relationship-alice-bob"];
			},
		},
		{
			name: "relationship from endpoint",
			change: ({ relationship }: { moment: HarnessNote; relationship: HarnessNote }) => {
				relationship.frontmatter.from = ["[[People/Alice]]"];
			},
		},
		{
			name: "relationship to endpoint",
			change: ({ relationship }: { moment: HarnessNote; relationship: HarnessNote }) => {
				relationship.frontmatter.to = ["[[People/Bob]]"];
			},
		},
	])("rejects $name array shape drift before attempting a write", async ({ change }) => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const moment = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			relationship: "[[People/Relationships/Alice - Bob]]",
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
			follow_up_status: "open",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		const relationship = harness.entries.get("People/Relationships/Alice - Bob.md") as HarnessNote;
		change({ moment, relationship });
		harness.syncSource(moment);
		harness.syncSource(relationship);
		const momentBefore = structuredClone(moment.frontmatter);
		const relationshipBefore = structuredClone(relationship.frontmatter);
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedRelationshipId: "relationship-alice-bob",
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: "open",
				status: "done",
			}),
		).rejects.toBeInstanceOf(MutationError);
		expect(harness.operations).toEqual([]);
		expect(harness.committedFrontmatterWrites).toEqual([]);
		expect(moment.frontmatter).toEqual(momentBefore);
		expect(relationship.frontmatter).toEqual(relationshipBefore);
	});

	it("rejects a live non-canonical relationship endpoint without writing the follow-up", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			relationship: "[[People/Relationships/Alice - Bob]]",
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		const relationship = harness.entries.get("People/Relationships/Alice - Bob.md") as HarnessNote;
		relationship.frontmatter.from = "[[person-alice]]";
		harness.linkDestinations.set("person-alice", "People/Bob.md");
		harness.syncSource(relationship);
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedRelationshipId: "relationship-alice-bob",
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toThrow("relationship changed or is no longer canonical");
		expect(harness.operations).toEqual([]);
		expect(file.frontmatter.follow_up_status).toBeUndefined();
	});

	it("rejects a live self-relationship without writing the follow-up", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			relationship: "[[People/Relationships/Alice - Bob]]",
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		const relationship = harness.entries.get("People/Relationships/Alice - Bob.md") as HarnessNote;
		relationship.frontmatter.to = "[[People/Alice]]";
		harness.syncSource(relationship);
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedRelationshipId: "relationship-alice-bob",
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toThrow("relationship changed or is no longer canonical");
		expect(harness.operations).toEqual([]);
		expect(harness.committedFrontmatterWrites).toEqual([]);
		expect(file.frontmatter.follow_up_status).toBeUndefined();
	});

	it("rejects raw-array shape drift inside processFrontMatter and commits no status write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		harness.beforeFrontmatterCallback = (note) => {
			if (note.path !== path) return;
			note.frontmatter.follow_up_on = ["2026-08-01"];
			harness.syncSource(note);
		};
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toThrow("follow-up date changed after it was reviewed");
		expect(harness.operations).toEqual([`frontmatter:${path}`]);
		expect(harness.committedFrontmatterWrites).toEqual([]);
		expect(file.frontmatter.follow_up_on).toEqual(["2026-08-01"]);
		expect(file.frontmatter.follow_up_status).toBeUndefined();
	});

	it("rechecks live frontmatter inside processFrontMatter and commits no stale status write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		harness.beforeFrontmatterCallback = (note) => {
			if (note.path !== path) return;
			note.frontmatter.follow_up_on = "2026-08-02";
			harness.syncSource(note);
		};
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toThrow("follow-up date changed after it was reviewed");
		expect(harness.operations).toEqual([`frontmatter:${path}`]);
		expect(harness.committedFrontmatterWrites).toEqual([]);
		expect(file.frontmatter).toMatchObject({ follow_up_on: "2026-08-02" });
		expect(file.frontmatter.follow_up_status).toBeUndefined();
	});

	it("rechecks index ambiguity inside processFrontMatter and commits no status write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		harness.beforeFrontmatterCallback = () => {
			harness.contactMomentsById.set("moment-follow-up", [path, "People/Contact moments/duplicate.md"]);
		};
		const before = structuredClone(file.frontmatter);
		harness.operations.length = 0;

		await expect(
			harness.service.updateContactMomentFollowUpStatus({
				filePath: path,
				contactMomentId: "moment-follow-up",
				reviewedPersonIds: ["person-alice"],
				reviewedOccurredOn: "2026-07-31",
				reviewedFollowUpOn: "2026-08-01",
				reviewedFollowUpStatus: undefined,
				status: "done",
			}),
		).rejects.toThrow("missing or ambiguous");
		expect(harness.operations).toEqual([`frontmatter:${path}`]);
		expect(harness.committedFrontmatterWrites).toEqual([]);
		expect(file.frontmatter).toEqual(before);
	});

	it("rejects deleted, ambiguous and already-completed rows without a second write", async () => {
		const harness = createHarness();
		harness.addCanonicalPeopleAndRelationship();
		const path = "People/Contact moments/follow-up.md";
		const file = harness.addNote(path, {
			type: "contact_moment",
			contact_moment_id: "moment-follow-up",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-31",
			follow_up_on: "2026-08-01",
		});
		harness.contactMomentsById.set("moment-follow-up", [path]);
		const reviewed = {
			filePath: path,
			contactMomentId: "moment-follow-up",
			reviewedPersonIds: ["person-alice"],
			reviewedOccurredOn: "2026-07-31",
			reviewedFollowUpOn: "2026-08-01",
			reviewedFollowUpStatus: undefined,
			status: "done" as const,
		};

		await harness.service.updateContactMomentFollowUpStatus(reviewed);
		const writesAfterCompletion = harness.operations.length;
		await expect(harness.service.updateContactMomentFollowUpStatus(reviewed)).rejects.toThrow(
			"status changed after it was reviewed",
		);
		expect(harness.operations).toHaveLength(writesAfterCompletion);

		file.frontmatter.follow_up_status = undefined;
		harness.syncSource(file);
		harness.contactMomentsById.set("moment-follow-up", [path, "People/Contact moments/duplicate.md"]);
		await expect(harness.service.updateContactMomentFollowUpStatus(reviewed)).rejects.toThrow("missing or ambiguous");
		expect(harness.operations).toHaveLength(writesAfterCompletion);

		harness.contactMomentsById.set("moment-follow-up", [path]);
		harness.entries.delete(path);
		await expect(harness.service.updateContactMomentFollowUpStatus(reviewed)).rejects.toThrow("no longer available");
		expect(harness.operations).toHaveLength(writesAfterCompletion);
	});
});
