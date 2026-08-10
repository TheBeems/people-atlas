import { describe, expect, it } from "vitest";
import type { PersonRecord, PersonReference, ReferenceKind } from "../src/domain/types";
import { createReferenceIndex, resolveReference } from "../src/domain/person-reference-resolver";

function person(id: string, filePath: string): PersonRecord {
	return {
		id,
		filePath,
		name: id,
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	};
}

function reference(target: string, kind: ReferenceKind, resolvedPath?: string): PersonReference {
	return {
		raw: kind === "wikilink" ? `[[${target}]]` : target,
		target,
		kind,
		resolvedPath,
	};
}

describe("person-reference-resolver", () => {
	it("resolves a wikilink when path and ID evidence identify the same person", () => {
		const bob = person("Bob", "People/Bob.md");
		const index = createReferenceIndex([person("alice", "People/Alice.md"), bob]);

		const result = resolveReference(reference("Bob", "wikilink", "People/Bob.md"), "Relationships/Alice-Bob.md", index);

		expect(result).toMatchObject({ status: "resolved", resolved: bob, candidatePaths: ["People/Bob.md"] });
	});

	it("reports deterministic ambiguity when a wikilink path and ID identify different people", () => {
		const idOwned = person("Bob", "People/A.md");
		const pathOwned = person("person-bob", "People/Bob.md");
		const index = createReferenceIndex([pathOwned, idOwned]);

		const result = resolveReference(reference("Bob", "wikilink", "People/Bob.md"), "Relationships/A-Bob.md", index);

		expect(result.status).toBe("ambiguous");
		expect(result.resolved).toBeUndefined();
		expect(result.candidatePaths).toEqual(["People/A.md", "People/Bob.md"]);
	});

	it("does not rescue an unresolved wikilink through an ID-only match", () => {
		const idOwned = person("Bob", "People/A.md");
		const index = createReferenceIndex([idOwned]);

		const result = resolveReference(reference("Bob", "wikilink"), "Relationships/A-Bob.md", index);

		expect(result).toMatchObject({ status: "unresolved", candidatePaths: [] });
		expect(result.resolved).toBeUndefined();
	});

	it("uses a path-syntactic wikilink target as literal path evidence", () => {
		const bob = person("person-bob", "People/Bob.md");
		const result = resolveReference(
			reference("People/Bob.md", "wikilink"),
			"Moments/Call.md",
			createReferenceIndex([bob]),
		);

		expect(result).toMatchObject({ status: "resolved", resolved: bob, candidatePaths: ["People/Bob.md"] });
	});

	it("reports an unmatched explicit ID as unresolved", () => {
		const result = resolveReference(reference("missing", "id"), "Moments/Call.md", createReferenceIndex([]));

		expect(result).toMatchObject({ status: "unresolved", candidates: [], candidatePaths: [] });
		expect(result.resolved).toBeUndefined();
	});

	it("uses the resolver adapter only when a wikilink has no stored resolved path", () => {
		const idOwned = person("Bob", "People/A.md");
		const pathOwned = person("person-bob", "People/Bob.md");
		const index = createReferenceIndex([idOwned, pathOwned]);

		const result = resolveReference(reference("Bob", "wikilink"), "Relationships/A-Bob.md", index, (target: string) =>
			target === "Bob" ? "People/Bob.md" : undefined,
		);

		expect(result.status).toBe("ambiguous");
		expect(result.candidatePaths).toEqual(["People/A.md", "People/Bob.md"]);
	});

	it("normalizes explicit paths and remains ambiguous when the resolved ID is duplicated", () => {
		const first = person("duplicate", "People/A.md");
		const second = person("duplicate", "People/Bob.md");
		const index = createReferenceIndex([second, first]);

		const result = resolveReference(reference("people\\bob", "path"), "Moments/Call.md", index);

		expect(result.status).toBe("ambiguous");
		expect(result.candidatePaths).toEqual(["People/A.md", "People/Bob.md"]);
	});

	it("uses stored resolved-path evidence for a relative explicit path", () => {
		const bob = person("person-bob", "People/Bob.md");
		const result = resolveReference(
			reference("Bob.md", "path", "People/Bob.md"),
			"Relationships/Alice-Bob.md",
			createReferenceIndex([bob]),
		);

		expect(result).toMatchObject({ status: "resolved", resolved: bob, candidatePaths: ["People/Bob.md"] });
	});
});
