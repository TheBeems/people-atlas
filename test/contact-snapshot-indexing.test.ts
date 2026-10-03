import { afterEach, describe, expect, it, vi } from "vitest";
import * as referenceResolver from "../src/domain/person-reference-resolver";
import { IndexState } from "../src/index/index-state";
import type { ParsedAtlasFile } from "../src/index/frontmatter";
import { generateContactHistoryFixture } from "./performance/contact-history-fixture";

afterEach(() => vi.restoreAllMocks());

describe("contact snapshot reference indexes", () => {
	it.each(["snapshot", "moments", "diagnostics"])("builds each reference index once per %s pass", (operation) => {
		const fixture = generateContactHistoryFixture(100);
		const state = new IndexState();
		for (const file of fixture.files) state.upsert(file);
		const constructIndex = vi.spyOn(referenceResolver, "createReferenceIndex");
		const paths = fixture.contactMoments.map((moment) => moment.filePath);
		if (operation === "snapshot") expect(state.getSnapshot().contactMoments).toHaveLength(100);
		else if (operation === "moments") expect(state.getContactMomentsForPaths(paths)).toHaveLength(100);
		else expect(state.getDiagnosticsForPaths(paths)).toEqual([]);
		expect(constructIndex).toHaveBeenCalledTimes(2);
		expect(constructIndex.mock.calls.map(([records]) => records)).toEqual([fixture.people, fixture.relationships]);
	});

	it("does not construct unused indexes for contact-free or person-only passes", () => {
		const fixture = generateContactHistoryFixture(20, "person-only");
		const state = new IndexState();
		const constructIndex = vi.spyOn(referenceResolver, "createReferenceIndex");
		expect(state.getSnapshot().contactMoments).toEqual([]);
		expect(state.getContactMomentsForPaths([])).toEqual([]);
		expect(state.getDiagnosticsForPaths([])).toEqual([]);
		expect(constructIndex).not.toHaveBeenCalled();
		for (const file of fixture.files) state.upsert(file);
		constructIndex.mockClear();
		expect(state.getSnapshot().contactMoments).toHaveLength(20);
		expect(constructIndex).toHaveBeenCalledTimes(1);
	});

	it("keeps each pass fresh across duplicate, unresolved, rename, removal and clear transitions", () => {
		const fixture = generateContactHistoryFixture(6);
		const state = new IndexState();
		const files = new Map<string, ParsedAtlasFile>();
		const upsert = (file: ParsedAtlasFile) => {
			files.set(file.filePath, file);
			return state.upsert(file);
		};
		const remove = (path: string) => {
			files.delete(path);
			return state.remove(path);
		};
		const compareFresh = () => {
			const fresh = new IndexState();
			for (const file of files.values()) fresh.upsert(file);
			const snapshot = state.getSnapshot();
			expect(snapshot).toEqual(fresh.getSnapshot());
			expect(state.getContactMomentsForPaths(files.keys())).toEqual(snapshot.contactMoments);
			expect(state.getDiagnosticsForPaths(files.keys())).toEqual(snapshot.diagnostics);
			return snapshot;
		};
		for (const file of fixture.files) upsert(file);
		expect(compareFresh().diagnostics).toEqual([]);

		const originalPerson = fixture.people[0];
		const originalRelationship = fixture.relationships[0];
		const originalMoment = fixture.contactMoments[0];
		if (!originalPerson || !originalRelationship || !originalMoment) throw new Error("Missing fixture records.");
		const duplicatePerson = { ...originalPerson, filePath: "People/Duplicate.md" };
		upsert({ filePath: duplicatePerson.filePath, person: duplicatePerson, diagnostics: [] });
		expect(compareFresh().diagnostics).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "ambiguous-contact-moment-person" })]),
		);
		remove(duplicatePerson.filePath);
		expect(compareFresh().diagnostics).toEqual([]);

		const duplicateRelationship = { ...originalRelationship, filePath: "People/Relationships/Duplicate.md" };
		upsert({ filePath: duplicateRelationship.filePath, relationship: duplicateRelationship, diagnostics: [] });
		expect(compareFresh().diagnostics).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "ambiguous-contact-moment-relationship" })]),
		);
		remove(duplicateRelationship.filePath);
		remove(originalRelationship.filePath);
		expect(compareFresh().diagnostics).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "unresolved-contact-moment-relationship" })]),
		);
		upsert({ filePath: originalRelationship.filePath, relationship: originalRelationship, diagnostics: [] });

		const invalidMoment = { ...originalMoment, people: [{ raw: "missing", target: "missing", kind: "id" as const }] };
		const invalidation = upsert({ filePath: invalidMoment.filePath, contactMoment: invalidMoment, diagnostics: [] });
		expect(invalidation.previousContactMoment?.actionable).toBe(true);
		expect(invalidation.nextContactMoment?.actionable).toBe(false);
		compareFresh();
		const repair = upsert({ filePath: originalMoment.filePath, contactMoment: originalMoment, diagnostics: [] });
		expect(repair.previousContactMoment?.actionable).toBe(false);
		expect(repair.nextContactMoment?.actionable).toBe(true);

		remove(originalPerson.filePath);
		const renamed = { ...originalPerson, filePath: "People/Renamed.md" };
		upsert({ filePath: renamed.filePath, person: renamed, diagnostics: [] });
		expect(compareFresh().contactMoments?.find((moment) => moment.id === originalMoment.id)?.actionable).toBe(true);
		remove(renamed.filePath);
		expect(compareFresh().diagnostics).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "unresolved-contact-moment-person" })]),
		);
		state.clear();
		files.clear();
		expect(compareFresh().contactMoments).toEqual([]);
	});
});
