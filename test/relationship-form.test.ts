import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { PersonRecord, RelationshipRecord } from "../src/domain/types";
import {
	RelationshipFormSession,
	buildRelationshipCreateInput,
	buildRelationshipUpdates,
	createRelationshipFormValues,
	editRelationshipFormValues,
	proposeRelationshipPath,
	type RelationshipMutationPort,
} from "../src/editor/relationship-form";

const people: PersonRecord[] = [
	{
		id: "person-alice",
		filePath: "People/Alice.md",
		name: "Alice / Admin",
		aliases: [],
		organisations: [],
		contacts: [],
	},
	{
		id: "person-bob",
		filePath: "People/Bob.md",
		name: "Bob",
		aliases: [],
		organisations: [],
		contacts: [],
	},
];

const relationship: RelationshipRecord = {
	id: "relationship-1",
	filePath: "People/Relationships/Alice - Bob.md",
	from: { raw: "[[People/Alice]]", target: "People/Alice" },
	to: { raw: "person-bob", target: "person-bob" },
	direction: "undirected",
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
	it("prefills Person A and proposes a safe People/Relationships path", () => {
		const values = createRelationshipFormValues(people, "People/Alice.md");
		values.toPath = "People/Bob.md";

		expect(values.fromPath).toBe("People/Alice.md");
		expect(values.direction).toBe("undirected");
		expect(proposeRelationshipPath(values, people)).toBe("People/Relationships/Alice - Admin - Bob.md");
	});

	it("maps canonical endpoint paths and optional fields to a create input", () => {
		const values = {
			...createRelationshipFormValues(people),
			path: "People/Relationships/Alice - Bob.md",
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
			relationshipId: "relationship-1",
			types: "friend, colleague",
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
			types: ["friend", "colleague"],
			direction: "undirected",
			closeness: 5,
			since: "2020-01-02",
			lastContact: "2026-07-24",
			status: "active",
		});
	});

	it("resolves edit endpoints by canonical path or unique stable ID", () => {
		const values = editRelationshipFormValues(relationship, "explicit-relationship-id", people, (target) =>
			target === "People/Alice" ? "People/Alice.md" : undefined,
		);

		expect(values).toMatchObject({
			path: relationship.filePath,
			fromPath: "People/Alice.md",
			toPath: "People/Bob.md",
			relationshipId: "explicit-relationship-id",
			types: "friend",
			closeness: "4",
			status: "active",
		});
	});

	it("emits only changed edit fields and uses null to clear an optional value", () => {
		const original = editRelationshipFormValues(
			relationship,
			"explicit-relationship-id",
			people,
			() => "People/Alice.md",
		);
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

		expect(() => buildRelationshipCreateInput(values, people)).toThrow("Person B must be selected");
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

	it("maps edit submit to changed fields only", async () => {
		const port = mutations();
		const file = { path: relationship.filePath } as TFile;
		const original = editRelationshipFormValues(relationship, undefined, people, (target) =>
			target === "People/Alice" ? "People/Alice.md" : undefined,
		);
		original.toPath = "People/Bob.md";
		const session = new RelationshipFormSession({ kind: "edit", file, original }, people, port);

		const result = await session.submit({ ...original, closeness: "3" });

		expect(result.status).toBe("success");
		expect(port.updateRelationship).toHaveBeenCalledWith(file, { closeness: 3 });
		expect(port.createRelationship).not.toHaveBeenCalled();
	});

	it("closes an unchanged edit without rewriting the relationship note", async () => {
		const port = mutations();
		const file = { path: relationship.filePath } as TFile;
		const original = editRelationshipFormValues(relationship, undefined, people, (target) =>
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
