import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { personProfilePath } from "../src/domain/people-paths";
import type { PersonRecord, RelationshipRecord } from "../src/domain/types";
import { parsePersonReference } from "../src/domain/wikilink";
import {
	RelationshipFormSession,
	applyRelationshipPreset,
	applySimpleRelationshipChoice,
	buildRelationshipCreatePrefill,
	buildRelationshipCreateInput,
	buildRelationshipUpdates,
	createRelationshipFormValues,
	detachRelationshipPreset,
	editRelationshipFormValues,
	getRelationshipFormPresentation,
	getRelationshipPresetState,
	getSimpleRelationshipChoice,
	proposeRelationshipPath,
	resolveCanonicalPersonByPath,
	type RelationshipMutationPort,
} from "../src/editor/relationship-form";
import { contactMomentWikilink } from "../src/mutations/contact-moment";
import { validatePeopleRootFolder } from "../src/settings/validate";

const people: PersonRecord[] = [
	{
		id: "person-alice",
		filePath: "People/Alice.md",
		name: "Alice / Admin",
		aliases: [],
		organisations: [],
		gender: "woman",
		emails: [],
		phones: [],
		contacts: [],
	},
	{
		id: "person-bob",
		filePath: "People/Bob.md",
		name: "Bob",
		aliases: [],
		organisations: [],
		gender: "man",
		emails: [],
		phones: [],
		contacts: [],
	},
	{
		id: "person-mathijs",
		filePath: "People/Mathijs.md",
		name: "Mathijs",
		aliases: [],
		organisations: [],
		gender: "man",
		emails: [],
		phones: [],
		contacts: [],
	},
];

const relationship: RelationshipRecord = {
	id: "relationship-1",
	filePath: "People/Relationships/Alice - Bob.md",
	from: { raw: "[[People/Alice]]", target: "People/Alice", kind: "wikilink" },
	to: { raw: "person-bob", target: "person-bob", kind: "id" },
	types: ["friend"],
	closeness: 4,
	since: "2020-01-02",
	lastContact: "2026-07-24",
	status: "active",
};

function mutations(overrides: Partial<RelationshipMutationPort> = {}): RelationshipMutationPort {
	return {
		createRelationship: vi.fn(async () => ({ path: "People/Relationships/Alice - Bob.md" }) as TFile),
		updateRelationship: vi.fn(async () => undefined),
		...overrides,
	};
}

describe("relationship form contract", () => {
	it("derives a safe relationship path from the configured People root", () => {
		const values = createRelationshipFormValues(people, "People/Alice.md");
		values.toPath = "People/Bob.md";

		expect(values.fromPath).toBe("People/Alice.md");
		expect(values).not.toHaveProperty("direction");
		expect(proposeRelationshipPath(values, people, "Second Brain/People")).toBe(
			"Second Brain/People/Relationships/Alice - Admin - Bob.md",
		);
	});

	it("round-trips safe Unicode and spaces from a person path through relationship and contact wikilinks", () => {
		const peopleRootFolder = "Second Brain/Mensen & contacten/Ámsterdam";
		expect(validatePeopleRootFolder(peopleRootFolder)).toBeUndefined();
		const filePath = personProfilePath(peopleRootFolder, "Zoë van Dijk", "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb");
		const zoe: PersonRecord = {
			id: "person-zoe",
			filePath,
			name: "Zoë van Dijk",
			aliases: [],
			organisations: [],
			emails: [],
			phones: [],
			contacts: [],
		};
		const bob = people[1];
		if (!bob) throw new Error("Bob fixture is required.");
		const safePeople = [zoe, bob];
		const values = createRelationshipFormValues(safePeople, zoe.filePath, bob.filePath);
		const relationshipReference = buildRelationshipCreateInput(values, safePeople).from;
		const contactReference = contactMomentWikilink(zoe.filePath);
		const expectedTarget = zoe.filePath.replace(/\.md$/i, "");

		expect([relationshipReference, contactReference].map((raw) => parsePersonReference(raw)?.target)).toEqual([
			expectedTarget,
			expectedTarget,
		]);
	});

	it.each([
		{
			name: "global create with My person",
			selectedPath: undefined,
			myPersonId: "person-mathijs",
			expected: {
				fromPersonPath: "People/Mathijs.md",
				myPersonPath: "People/Mathijs.md",
			},
		},
		{
			name: "another selected person with My person",
			selectedPath: "People/Alice.md",
			myPersonId: "person-mathijs",
			expected: {
				fromPersonPath: "People/Mathijs.md",
				toPersonPath: "People/Alice.md",
				myPersonPath: "People/Mathijs.md",
			},
		},
		{
			name: "My person selected",
			selectedPath: "People/Mathijs.md",
			myPersonId: "person-mathijs",
			expected: {
				fromPersonPath: "People/Mathijs.md",
				myPersonPath: "People/Mathijs.md",
			},
		},
		{
			name: "selected person without My person",
			selectedPath: "People/Alice.md",
			myPersonId: "",
			expected: { fromPersonPath: "People/Alice.md" },
		},
		{
			name: "global create without My person",
			selectedPath: undefined,
			myPersonId: "",
			expected: {},
		},
		{
			name: "global create with missing My person",
			selectedPath: undefined,
			myPersonId: "person-missing",
			expected: {},
		},
		{
			name: "selected person with missing My person",
			selectedPath: "People/Alice.md",
			myPersonId: "person-missing",
			expected: { fromPersonPath: "People/Alice.md" },
		},
	])("uses the self-first prefill contract for $name", ({ selectedPath, myPersonId, expected }) => {
		expect(buildRelationshipCreatePrefill(people, selectedPath, myPersonId)).toEqual(expected);
	});

	it("does not prefill ambiguous My person or an identity-ambiguous selected path", () => {
		const alice = people.find((person) => person.id === "person-alice");
		expect(alice).toBeDefined();
		if (!alice) throw new Error("Alice fixture is required.");
		const duplicateAlice: PersonRecord = {
			...alice,
			filePath: "People/Alice duplicate.md",
		};
		const ambiguousPeople = [...people, duplicateAlice];

		expect(buildRelationshipCreatePrefill(ambiguousPeople, undefined, "person-alice")).toEqual({});
		expect(buildRelationshipCreatePrefill(ambiguousPeople, "People/Alice.md", undefined)).toEqual({});
		expect(resolveCanonicalPersonByPath(ambiguousPeople, "People/Alice.md")).toBeUndefined();
	});

	it("provides locale-neutral dynamic person and role presentation data without changing endpoint slots", () => {
		const values = {
			...createRelationshipFormValues(people, "People/Mathijs.md", "People/Alice.md"),
			fromRole: "colleague",
			toRole: "manager",
		};

		expect(getRelationshipFormPresentation(values, people, "People/Mathijs.md")).toEqual({
			fromPerson: { name: "Mathijs", isMyPerson: true },
			toPerson: { name: "Alice / Admin", isMyPerson: false },
			fromRoleTerm: "colleague",
			toRoleTerm: "manager",
		});
		expect(values).toMatchObject({
			fromPath: "People/Mathijs.md",
			toPath: "People/Alice.md",
		});
	});

	it("keeps actual names and neutral omissions locale-neutral", () => {
		const thirdParty = {
			...createRelationshipFormValues(people, "People/Alice.md", "People/Bob.md"),
			fromRole: "mentor",
			toRole: "mentee",
		};
		expect(getRelationshipFormPresentation(thirdParty, people, "People/Mathijs.md")).toMatchObject({
			fromPerson: { name: "Alice / Admin", isMyPerson: false },
			toPerson: { name: "Bob", isMyPerson: false },
		});
		expect(getRelationshipFormPresentation(createRelationshipFormValues(people), people)).toEqual({});
	});

	it("applies simple choices to only the two unsaved roles and derives Custom without rewriting values", () => {
		const original = {
			...createRelationshipFormValues(people, "People/Alice.md", "People/Bob.md"),
			path: "People/Relationships/Manual.md",
			relationshipId: "relationship-manual",
			presetId: "family-template",
			types: "family",
			fromRole: "mentor",
			toRole: "mentee",
			closeness: "4",
			since: "2020-01-02",
			lastContact: "2026-07-31",
			status: "active" as const,
		};

		const parent = applySimpleRelationshipChoice(original, "parent");
		expect(parent).toEqual({ ...original, fromRole: "parent", toRole: "child" });
		expect(getSimpleRelationshipChoice(parent)).toBe("parent");
		const partner = applySimpleRelationshipChoice(original, "partner");
		expect(partner).toEqual({ ...original, fromRole: "partner", toRole: "partner" });
		expect(getSimpleRelationshipChoice(partner)).toBe("partner");
		expect(getSimpleRelationshipChoice({ ...partner, fromRole: " Partner " })).toBe("custom");
		expect(applySimpleRelationshipChoice(original, "custom")).toBe(original);
		expect(original).toMatchObject({ fromRole: "mentor", toRole: "mentee" });
	});

	it("uses each role holder's own gender in preview while keeping literal roles unchanged", () => {
		const parentChild = {
			...createRelationshipFormValues(people, "People/Alice.md", "People/Bob.md"),
			fromRole: "parent",
			toRole: "child",
		};
		expect(getRelationshipFormPresentation(parentChild, people)).toMatchObject({
			fromRoleTerm: "mother",
			toRoleTerm: "son",
		});

		const literal = { ...parentChild, fromRole: "mother", toRole: "daughter" };
		expect(getRelationshipFormPresentation(literal, people)).toMatchObject({
			fromRoleTerm: "mother",
			toRoleTerm: "daughter",
		});
	});

	it("maps canonical endpoint paths and optional fields to a create input", () => {
		const values = {
			...createRelationshipFormValues(people),
			path: "People/Relationships/Alice - Bob.md",
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
			relationshipId: "relationship-1",
			presetId: "friend-colleague",
			types: "friend, colleague",
			fromRole: "Friend",
			toRole: "Friend",
			closeness: "5",
			since: "2020-01-02",
			lastContact: "2026-07-24",
			status: "active" as const,
		};

		expect(buildRelationshipCreateInput(values, people)).toEqual({
			path: "People/Relationships/Alice - Bob.md",
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
			relationshipId: "relationship-1",
			presetId: "friend-colleague",
			types: ["friend", "colleague"],
			fromRole: "Friend",
			toRole: "Friend",
			closeness: 5,
			since: "2020-01-02",
			lastContact: "2026-07-24",
			status: "active",
		});
	});

	it("applies, detects, customizes and detaches a preset without losing copied values", () => {
		const preset = {
			id: "sibling",
			name: "Sibling",
			types: ["sibling"],
			fromRole: "Brother",
			toRole: "Sister",
		};
		const applied = applyRelationshipPreset(createRelationshipFormValues(people), preset);
		const withEndpoints = applyRelationshipPreset(
			createRelationshipFormValues(people, "People/Alice.md", "People/Bob.md"),
			preset,
		);

		expect(getRelationshipPresetState(applied, [preset])).toBe("up-to-date");
		expect(withEndpoints).toMatchObject({
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
			fromRole: "Brother",
			toRole: "Sister",
		});
		const customized = { ...applied, fromRole: "Sibling" };
		expect(getRelationshipPresetState(customized, [preset])).toBe("modified");
		expect(getRelationshipPresetState(customized, [])).toBe("missing");
		expect(detachRelationshipPreset(customized)).toMatchObject({
			presetId: "",
			fromRole: "Sibling",
			toRole: "Sister",
			types: "sibling",
		});
	});

	it("resolves edit endpoints by canonical path or unique stable ID", () => {
		const values = editRelationshipFormValues(relationship, people, (target) =>
			target === "People/Alice" ? "People/Alice.md" : undefined,
		);

		expect(values).toMatchObject({
			path: relationship.filePath,
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
			relationshipId: "relationship-1",
			types: "friend",
			closeness: "4",
			status: "active",
		});
	});

	it("does not turn an identity-ambiguous edit endpoint into a selected canonical path", () => {
		const alice = people.find((person) => person.id === "person-alice");
		expect(alice).toBeDefined();
		if (!alice) throw new Error("Alice fixture is required.");
		const ambiguousPeople = [...people, { ...alice, filePath: "People/Alice duplicate.md" }];
		const stored: RelationshipRecord = {
			...relationship,
			from: { raw: "person-alice", target: "person-alice", kind: "id" },
		};

		const values = editRelationshipFormValues(stored, ambiguousPeople, () => "People/Alice.md");

		expect(values.fromPath).toBe("person-alice");
	});

	it("preserves stored endpoint and role order while My person is second", () => {
		const stored: RelationshipRecord = {
			...relationship,
			from: { raw: "person-alice", target: "person-alice", kind: "id" },
			to: { raw: "person-mathijs", target: "person-mathijs", kind: "id" },
			fromRole: "manager",
			toRole: "colleague",
		};

		const values = editRelationshipFormValues(stored, people, () => undefined);

		expect(values).toMatchObject({
			fromPath: "People/Alice.md",
			toPath: "People/Mathijs.md",
			fromRole: "manager",
			toRole: "colleague",
		});
		expect(getRelationshipFormPresentation(values, people, "People/Mathijs.md")).toMatchObject({
			fromPerson: { name: "Alice / Admin", isMyPerson: false },
			toPerson: { name: "Mathijs", isMyPerson: true },
			fromRoleTerm: "manager",
			toRoleTerm: "colleague",
		});
	});

	it("emits only changed edit fields and uses null to clear an optional value", () => {
		const original = editRelationshipFormValues(relationship, people, () => "People/Alice.md");
		original.toPath = "People/Bob.md";
		const changed = { ...original, status: "ended" as const, lastContact: "" };

		expect(buildRelationshipUpdates(changed, original, people)).toEqual({
			lastContact: null,
			status: "ended",
		});
	});

	it("rejects a typed endpoint that is not a canonical indexed person", () => {
		const values = {
			...createRelationshipFormValues(people),
			path: "People/Relationships/Alice - Unknown.md",
			fromPath: "People/Alice.md",
			toPath: "Unknown",
		};

		expect(() => buildRelationshipCreateInput(values, people)).toThrow("Second person must be selected");
	});

	it("allows a third-party relationship when My person is not an endpoint", async () => {
		const port = mutations();
		const session = new RelationshipFormSession({ kind: "create" }, people, port);
		const values = {
			...createRelationshipFormValues(people, "People/Alice.md", "People/Bob.md"),
			path: "People/Relationships/Alice - Bob.md",
		};

		await expect(session.submit(values)).resolves.toMatchObject({ status: "success" });
		expect(port.createRelationship).toHaveBeenCalledWith(
			expect.objectContaining({
				from: "[[People/Alice]]",
				to: "[[People/Bob]]",
			}),
		);
	});

	it("cancels without invoking a mutation", async () => {
		const port = mutations();
		const session = new RelationshipFormSession({ kind: "create" }, people, port);
		session.cancel();

		const result = await session.submit(createRelationshipFormValues(people));

		expect(result.status).toBe("cancelled");
		expect(port.createRelationship).not.toHaveBeenCalled();
		expect(port.updateRelationship).not.toHaveBeenCalled();
	});

	it("maps a create submit through the single mutation boundary", async () => {
		const port = mutations();
		const session = new RelationshipFormSession({ kind: "create" }, people, port);
		const values = {
			...createRelationshipFormValues(people),
			path: "People/Relationships/Alice - Bob.md",
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
		};

		const result = await session.submit(values);

		expect(result.status).toBe("success");
		expect(port.createRelationship).toHaveBeenCalledOnce();
		if (result.status === "success") expect(result.createdFile?.path).toBe(values.path);
	});

	it.each([
		{
			change: "deleted",
			currentPeople: people.filter((person) => person.filePath !== "People/Bob.md"),
		},
		{
			change: "renamed",
			currentPeople: people.map((person) =>
				person.filePath === "People/Bob.md" ? { ...person, filePath: "People/Robert.md" } : person,
			),
		},
		{
			change: "made identity-ambiguous",
			currentPeople: [
				...people,
				{
					id: "person-bob",
					filePath: "People/Bob duplicate.md",
					name: "Bob duplicate",
					aliases: [],
					organisations: [],
					emails: [],
					phones: [],
					contacts: [],
				},
			],
		},
	])("rejects a create when an endpoint is $change after the form opens", async ({ currentPeople }) => {
		const port = mutations();
		let livePeople = people;
		const session = new RelationshipFormSession({ kind: "create" }, people, port, () => livePeople);
		const values = {
			...createRelationshipFormValues(people),
			path: "People/Relationships/Alice - Bob.md",
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
		};
		livePeople = currentPeople;

		await expect(session.submit(values)).resolves.toEqual({
			status: "error",
			message: "Second person must be selected from indexed people.",
		});
		expect(port.createRelationship).not.toHaveBeenCalled();
		expect(port.updateRelationship).not.toHaveBeenCalled();
	});

	it("maps edit submit to changed fields only", async () => {
		const port = mutations();
		const file = { path: relationship.filePath } as TFile;
		const original = editRelationshipFormValues(relationship, people, (target) =>
			target === "People/Alice" ? "People/Alice.md" : undefined,
		);
		original.toPath = "People/Bob.md";
		const session = new RelationshipFormSession({ kind: "edit", file, original }, people, port);

		const result = await session.submit({ ...original, closeness: "3" });

		expect(result.status).toBe("success");
		expect(port.updateRelationship).toHaveBeenCalledWith(file, { closeness: 3 });
		expect(port.createRelationship).not.toHaveBeenCalled();
	});

	it("validates only changed edit endpoints so historical unresolved people do not block metadata edits", async () => {
		const port = mutations();
		const file = { path: relationship.filePath } as TFile;
		const original = {
			...editRelationshipFormValues(relationship, people, () => undefined),
			fromPath: "People/Historical Alice.md",
			toPath: "People/Historical Bob.md",
		};
		const session = new RelationshipFormSession({ kind: "edit", file, original }, people, port, () => []);

		const result = await session.submit({ ...original, closeness: "3" });

		expect(result.status).toBe("success");
		expect(port.updateRelationship).toHaveBeenCalledWith(file, { closeness: 3 });
	});

	it("revalidates a changed edit endpoint while allowing the unchanged endpoint to remain historical", async () => {
		const port = mutations();
		const file = { path: relationship.filePath } as TFile;
		const original = {
			...editRelationshipFormValues(relationship, people, () => undefined),
			fromPath: "People/Historical Alice.md",
			toPath: "People/Bob.md",
		};
		const currentPeople = people.filter((person) => person.filePath === "People/Mathijs.md");
		const session = new RelationshipFormSession({ kind: "edit", file, original }, people, port, () => currentPeople);

		const result = await session.submit({
			...original,
			toPath: "People/Mathijs.md",
			closeness: "3",
		});

		expect(result.status).toBe("success");
		expect(port.updateRelationship).toHaveBeenCalledWith(file, {
			to: "[[People/Mathijs]]",
			closeness: 3,
		});
	});

	it("closes an unchanged edit without rewriting the relationship note", async () => {
		const port = mutations();
		const file = { path: relationship.filePath } as TFile;
		const original = editRelationshipFormValues(relationship, people, (target) =>
			target === "People/Alice" ? "People/Alice.md" : undefined,
		);
		original.toPath = "People/Bob.md";
		const session = new RelationshipFormSession({ kind: "edit", file, original }, people, port);

		const result = await session.submit(structuredClone(original));

		expect(result.status).toBe("success");
		expect(port.updateRelationship).not.toHaveBeenCalled();
	});

	it("keeps a failed submission retryable with its error message", async () => {
		const port = mutations({
			createRelationship: vi.fn(async () => {
				throw new Error("A note already exists at the proposed path.");
			}),
		});
		const session = new RelationshipFormSession({ kind: "create" }, people, port);
		const values = {
			...createRelationshipFormValues(people),
			path: "People/Relationships/Alice - Bob.md",
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
		};

		expect(await session.submit(values)).toEqual({
			status: "error",
			message: "A note already exists at the proposed path.",
		});
		expect(await session.submit(values)).toMatchObject({ status: "error" });
		expect(port.createRelationship).toHaveBeenCalledTimes(2);
	});

	it("coalesces duplicate Save attempts while a mutation is pending", async () => {
		let finish: ((file: TFile) => void) | undefined;
		const port = mutations({
			createRelationship: vi.fn(
				async () =>
					new Promise<TFile>((resolve) => {
						finish = resolve;
					}),
			),
		});
		const session = new RelationshipFormSession({ kind: "create" }, people, port);
		const values = {
			...createRelationshipFormValues(people),
			path: "People/Relationships/Alice - Bob.md",
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
		};

		const first = session.submit(values);
		const second = await session.submit(values);

		expect(second.status).toBe("busy");
		expect(port.createRelationship).toHaveBeenCalledOnce();
		finish?.({ path: values.path } as TFile);
		expect((await first).status).toBe("success");
	});
});
