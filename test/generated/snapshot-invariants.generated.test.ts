import { describe, expect, it } from "vitest";
import type { ContactMomentRecord } from "../../src/domain/types";
import { buildGraphSnapshot } from "../../src/graph/graph-source";
import { generatedSnapshotCase, GENERATED_SEEDS } from "./generated-cases";

describe("generated graph snapshot invariants", () => {
	for (let seed = 0; seed < GENERATED_SEEDS; seed += 1) {
		it(`family=snapshot seed=${seed}`, () => {
			const generated = generatedSnapshotCase(seed);
			const snapshot = buildGraphSnapshot(
				{ canonical: generated.canonical, visible: generated.visible },
				generated.resolveLink,
			);
			const nodeIds = snapshot.nodes.map((node) => node.id);
			const edgeIds = snapshot.edges.map((edge) => edge.id);
			const nodeIdSet = new Set(nodeIds);

			const moment = (
				id: string,
				filePath: string,
				personIds: string[],
				overrides: Partial<ContactMomentRecord> = {},
			): ContactMomentRecord => ({
				id,
				filePath,
				people: personIds.map((target) => ({ raw: target, target, kind: "id" })),
				occurredOn: "2026-07-30",
				personIds,
				actionable: true,
				followUpActionable: false,
				...overrides,
			});
			const visibleMoment = moment(
				`visible-${seed}`,
				`Moments/${seed}/Visible.md`,
				[generated.ids.alpha, generated.ids.beta],
				{
					relationship: { raw: generated.ids.richRelationship, target: generated.ids.richRelationship, kind: "id" },
					relationshipId: generated.ids.richRelationship,
				},
			);
			const hiddenMulti = moment(`hidden-multi-${seed}`, `Moments/${seed}/Hidden multi.md`, [
				generated.ids.alpha,
				generated.ids.hidden,
			]);
			const filteredRelationship = generated.canonical.relationships.find(
				(relationship) =>
					relationship.from.target === generated.ids.alpha && relationship.to.target === generated.ids.hidden,
			);
			if (!filteredRelationship) throw new Error("Generated filtered relationship is missing.");
			const hiddenRelationship = moment(
				`hidden-relationship-${seed}`,
				`Moments/${seed}/Hidden relationship.md`,
				[generated.ids.alpha],
				{
					relationship: { raw: filteredRelationship.id, target: filteredRelationship.id, kind: "id" },
					relationshipId: filteredRelationship.id,
				},
			);
			const duplicateA = moment(`duplicate-moment-${seed}`, `Moments/${seed}/Duplicate A.md`, [generated.ids.alpha]);
			const duplicateB = moment(`duplicate-moment-${seed}`, `Moments/${seed}/Duplicate B.md`, [generated.ids.alpha]);
			const projectedMoments = buildGraphSnapshot(
				{
					canonical: {
						...generated.canonical,
						contactMoments: [
							visibleMoment,
							hiddenMulti,
							hiddenRelationship,
							duplicateA,
							duplicateB,
							moment(`invalid-${seed}`, `Moments/${seed}/Invalid.md`, [generated.ids.alpha], {
								actionable: false,
							}),
						],
					},
					visible: generated.visible,
				},
				generated.resolveLink,
			);
			expect(projectedMoments.contactMoments.map((entry) => entry.id)).toEqual([visibleMoment.id]);
			expect(projectedMoments.hiddenContactMomentCount).toBe(2);
			expect(projectedMoments.nodes).toEqual(snapshot.nodes);
			expect(projectedMoments.edges).toEqual(snapshot.edges);

			expect(nodeIdSet.size, `family=snapshot seed=${seed} unique nodes`).toBe(nodeIds.length);
			expect(new Set(edgeIds).size, `family=snapshot seed=${seed} unique edges`).toBe(edgeIds.length);
			for (const edge of snapshot.edges) {
				expect(nodeIdSet.has(edge.sourceId), `family=snapshot seed=${seed} edge=${edge.id} source`).toBe(true);
				expect(nodeIdSet.has(edge.targetId), `family=snapshot seed=${seed} edge=${edge.id} target`).toBe(true);
			}

			for (const person of generated.visible.people) {
				expect(
					snapshot.nodes.filter((node) => node.kind === "person" && node.filePath === person.filePath),
					`family=snapshot seed=${seed} path=${person.filePath}`,
				).toHaveLength(1);
			}
			const ambiguousNodes = snapshot.nodes.filter(
				(node) => node.kind === "person" && node.personId === generated.ids.duplicate,
			);
			expect(ambiguousNodes).toHaveLength(2);
			expect(ambiguousNodes.every((node) => String(node.id).startsWith("ambiguous:"))).toBe(true);
			expect(snapshot.diagnostics.some((item) => item.code === "duplicate-person-id")).toBe(true);
			expect(
				snapshot.diagnostics.some(
					(item) => item.code === "ambiguous-person-reference" && item.filePaths.includes(generated.paths.beta),
				),
			).toBe(true);
			expect(
				snapshot.edges.some(
					(edge) => edge.sourceId === generated.ids.beta && ambiguousNodes.some((node) => node.id === edge.targetId),
				),
			).toBe(false);

			const sameLabelGhost = snapshot.nodes.find(
				(node) => node.kind === "ghost" && node.label === generated.ids.sharedLabel,
			);
			expect(sameLabelGhost, `family=snapshot seed=${seed} display labels do not resolve`).toBeDefined();
			expect(
				snapshot.diagnostics.some(
					(item) => item.code === "unresolved-contact" && item.filePaths.includes(generated.paths.alpha),
				),
			).toBe(true);
			expect(snapshot.edges).toContainEqual(
				expect.objectContaining({
					sourceId: generated.ids.alpha,
					targetId: generated.ids.pathOwned,
					filePath: generated.paths.alpha,
					inferred: true,
				}),
			);

			const rich = snapshot.edges.find((edge) => edge.id === generated.ids.richRelationship);
			const richRecord = generated.canonical.relationships.find((item) => item.id === generated.ids.richRelationship);
			expect(rich).toMatchObject({
				sourceId: generated.ids.alpha,
				targetId: generated.ids.beta,
				presetId: richRecord?.presetId,
				types: richRecord?.types,
				fromRole: richRecord?.fromRole,
				toRole: richRecord?.toRole,
				closeness: richRecord?.closeness,
				since: richRecord?.since,
				lastContact: richRecord?.lastContact,
				status: richRecord?.status,
				filePath: richRecord?.filePath,
				inferred: false,
			});
			expect(rich).not.toHaveProperty("direction");
			expect(
				snapshot.edges.filter(
					(edge) => !edge.inferred && edge.sourceId === generated.ids.alpha && edge.targetId === generated.ids.beta,
				).length,
			).toBeGreaterThanOrEqual(3);

			const duplicateRelationships = generated.canonical.relationships.filter(
				(item) => item.id === generated.ids.duplicateRelationship,
			);
			const duplicateEdges = snapshot.edges.filter((edge) =>
				duplicateRelationships.some((item) => item.filePath === edge.filePath),
			);
			expect(snapshot.diagnostics.some((item) => item.code === "duplicate-relationship-id")).toBe(true);
			expect(duplicateEdges).toHaveLength(2);
			expect(new Set(duplicateEdges.map((edge) => edge.id)).size).toBe(2);
			for (const edge of duplicateEdges) {
				const record = duplicateRelationships.find((item) => item.filePath === edge.filePath);
				expect(edge.id).toMatch(new RegExp(`^${generated.ids.duplicateRelationship}:`));
				expect(edge).toMatchObject({
					types: record?.types,
					filePath: record?.filePath,
				});
				expect(edge).not.toHaveProperty("direction");
			}
			expect(snapshot.diagnostics.some((item) => item.code === "self-relationship")).toBe(true);
			expect(snapshot.diagnostics.some((item) => item.code === "unresolved-relationship-endpoint")).toBe(true);
			const selfRelationship = generated.canonical.relationships.find(
				(item) => item.id === generated.ids.selfRelationship,
			);
			const unresolvedRelationship = generated.canonical.relationships.find(
				(item) => item.id === generated.ids.unresolvedRelationship,
			);
			expect(selfRelationship, `family=snapshot seed=${seed} self relationship fixture`).toBeDefined();
			expect(unresolvedRelationship, `family=snapshot seed=${seed} unresolved relationship fixture`).toBeDefined();
			expect(snapshot.edges.some((edge) => edge.filePath === selfRelationship?.filePath)).toBe(false);
			expect(snapshot.edges.some((edge) => edge.filePath === unresolvedRelationship?.filePath)).toBe(false);

			expect(snapshot.hiddenNodeCount).toBe(generated.canonical.people.length - generated.visible.people.length);
			expect(snapshot.hiddenEdgeCount).toBe(3);
			expect(snapshot.diagnostics.filter((item) => item.code === "filtered-endpoint")).toHaveLength(3);
			expect(
				snapshot.diagnostics.filter(
					(item) => item.code === "unresolved-contact" && item.filePaths.includes(generated.paths.hidden),
				),
			).toHaveLength(0);
			expect(
				snapshot.diagnostics.some(
					(item) =>
						item.code === "unresolved-contact" &&
						item.filePaths.includes(generated.paths.alpha) &&
						item.message.includes(generated.ids.hidden),
				),
				`family=snapshot seed=${seed} visible-to-hidden stays filtered`,
			).toBe(false);
		});
	}
});
