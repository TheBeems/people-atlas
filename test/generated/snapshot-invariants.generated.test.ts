import { describe, expect, it } from "vitest";
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
				direction: richRecord?.direction,
				since: richRecord?.since,
				lastContact: richRecord?.lastContact,
				status: richRecord?.status,
				filePath: richRecord?.filePath,
				inferred: false,
			});
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
					direction: record?.direction,
					types: record?.types,
					filePath: record?.filePath,
				});
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
