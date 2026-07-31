import { describe, expect, it } from "vitest";
import type { AtlasDiagnostic, ContactMomentRecord, RawIndexSnapshot } from "../../src/domain/types";
import { buildAtlasSnapshot } from "../../src/graph/build-snapshot";
import { IndexState } from "../../src/index/index-state";
import type { ParsedAtlasFile } from "../../src/index/frontmatter";
import {
	GENERATED_SEEDS,
	person,
	reference,
	relationship,
	SeededGenerator,
	withGeneratedContext,
} from "./generated-cases";

function contactMoment(
	id: string,
	filePath: string,
	people: string[],
	relationshipTarget?: string,
): ContactMomentRecord {
	return {
		id,
		filePath,
		people: people.map((target) => reference(target)),
		relationship: relationshipTarget ? reference(relationshipTarget) : undefined,
		occurredOn: "2026-07-30",
		followUpOn: "2026-08-01",
		personIds: [],
		actionable: true,
		followUpActionable: true,
	};
}

function comparableDiagnostics(diagnostics: AtlasDiagnostic[] | undefined): AtlasDiagnostic[] {
	return [...(diagnostics ?? [])]
		.map((diagnostic) => ({ ...diagnostic, filePaths: [...diagnostic.filePaths].sort() }))
		.sort((left, right) => left.id.localeCompare(right.id));
}

function comparableMoments(snapshot: RawIndexSnapshot): ContactMomentRecord[] {
	return [...(snapshot.contactMoments ?? [])].sort((left, right) => left.filePath.localeCompare(right.filePath));
}

describe("generated contact-moment index invariants", () => {
	for (let seed = 0; seed < GENERATED_SEEDS; seed += 1) {
		it(`family=contact-moment-index seed=${seed}`, () => {
			const random = new SeededGenerator(seed);
			const suffix = random.token("moment");
			const aliceId = `alice-${suffix}`;
			const bobId = `bob-${suffix}`;
			const carolId = `carol-${suffix}`;
			const relationshipId = `relationship-${suffix}`;
			const duplicateMomentId = `duplicate-moment-${suffix}`;
			const alicePath = `People/${suffix}/Alice.md`;
			const bobPath = `People/${suffix}/Bob.md`;
			const carolPath = `People/${suffix}/Carol.md`;
			const relationshipPath = `Relationships/${suffix}/Alice-Bob.md`;
			const validPath = `People/Contact moments/${suffix}/Valid.md`;
			const unresolvedPath = `People/Contact moments/${suffix}/Unresolved.md`;
			const mismatchPath = `People/Contact moments/${suffix}/Mismatch.md`;
			const duplicateAPath = `People/Contact moments/${suffix}/Duplicate A.md`;
			const duplicateBPath = `People/Contact moments/${suffix}/Duplicate B.md`;
			const records: ParsedAtlasFile[] = [
				{
					filePath: alicePath,
					person: person(aliceId, alicePath, `Alice ${suffix}`),
					diagnostics: [],
				},
				{
					filePath: bobPath,
					person: person(bobId, bobPath, `Bob ${suffix}`),
					diagnostics: [],
				},
				{
					filePath: carolPath,
					person: person(carolId, carolPath, `Carol ${suffix}`),
					diagnostics: [],
				},
				{
					filePath: relationshipPath,
					relationship: relationship(relationshipId, relationshipPath, aliceId, bobId),
					diagnostics: [],
				},
				{
					filePath: validPath,
					contactMoment: contactMoment(`valid-${suffix}`, validPath, [aliceId, bobId], relationshipId),
					diagnostics: [],
				},
				{
					filePath: unresolvedPath,
					contactMoment: contactMoment(`unresolved-${suffix}`, unresolvedPath, [`missing-${suffix}`]),
					diagnostics: [],
				},
				{
					filePath: mismatchPath,
					contactMoment: contactMoment(`mismatch-${suffix}`, mismatchPath, [carolId], relationshipId),
					diagnostics: [],
				},
				{
					filePath: duplicateAPath,
					contactMoment: contactMoment(duplicateMomentId, duplicateAPath, [aliceId], relationshipId),
					diagnostics: [],
				},
				{
					filePath: duplicateBPath,
					contactMoment: contactMoment(duplicateMomentId, duplicateBPath, [aliceId], relationshipId),
					diagnostics: [],
				},
			];
			const state = new IndexState();
			const reorderedState = new IndexState();
			for (const record of random.shuffle(records)) state.upsert(record);
			for (const record of [...records].reverse()) reorderedState.upsert(record);

			const snapshot = withGeneratedContext(`family=contact-moment-index seed=${seed} snapshot`, () =>
				state.getSnapshot(),
			);
			const reorderedSnapshot = reorderedState.getSnapshot();
			expect(comparableMoments(snapshot)).toEqual(comparableMoments(reorderedSnapshot));
			expect(comparableDiagnostics(snapshot.diagnostics)).toEqual(comparableDiagnostics(reorderedSnapshot.diagnostics));

			expect(snapshot.contactMoments?.find((moment) => moment.filePath === validPath)).toMatchObject({
				personIds: [aliceId, bobId],
				relationshipId,
				actionable: true,
				followUpActionable: true,
			});
			expect(snapshot.contactMoments?.find((moment) => moment.filePath === unresolvedPath)).toMatchObject({
				personIds: [],
				actionable: false,
				followUpActionable: false,
			});
			expect(snapshot.contactMoments?.find((moment) => moment.filePath === mismatchPath)).toMatchObject({
				personIds: [carolId],
				relationshipId,
				actionable: false,
			});
			expect(
				snapshot.contactMoments
					?.filter((moment) => moment.id === duplicateMomentId)
					.every((moment) => !moment.actionable && !moment.followUpActionable),
			).toBe(true);
			expect(state.getDuplicateContactMomentIds()).toEqual([duplicateMomentId]);
			expect(snapshot.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "unresolved-contact-moment-person" }),
					expect.objectContaining({ code: "contact-moment-relationship-person-mismatch" }),
					expect.objectContaining({
						code: "duplicate-contact-moment-id",
						filePaths: [duplicateAPath, duplicateBPath],
					}),
				]),
			);

			const graph = buildAtlasSnapshot(snapshot, () => undefined);
			expect(graph.nodes.some((node) => node.id === `valid-${suffix}` || node.id === duplicateMomentId)).toBe(false);
			expect(graph.edges.some((edge) => edge.id === `valid-${suffix}` || edge.id === duplicateMomentId)).toBe(false);

			const identityChange = state.upsert({
				filePath: alicePath,
				person: person(`alice-new-${suffix}`, alicePath, `Alice ${suffix}`),
				diagnostics: [],
			});
			expect([...identityChange.affectedPaths]).toEqual(
				expect.arrayContaining([validPath, duplicateAPath, duplicateBPath, relationshipPath]),
			);
			expect(
				state
					.getContactMomentsForPaths(identityChange.affectedPaths)
					.filter((moment) => [validPath, duplicateAPath, duplicateBPath].includes(moment.filePath))
					.every((moment) => !moment.actionable),
			).toBe(true);

			const relationshipRemoval = state.remove(relationshipPath);
			expect([...relationshipRemoval.affectedPaths]).toEqual(
				expect.arrayContaining([validPath, mismatchPath, duplicateAPath, duplicateBPath]),
			);
		});
	}
});
