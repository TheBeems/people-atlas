import type {
	AtlasDiagnostic,
	AtlasSnapshot,
	PersonRecord,
	PersonReference,
	RawIndexSnapshot,
	RelationshipRecord,
} from "../domain/types";
import { normalizePathIdentity } from "../domain/identity";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { createReferenceIndex, resolveReference } from "../domain/person-reference-resolver";
import { referenceKey } from "../domain/wikilink";
import { stableHash } from "../utils/hash";
import { buildAtlasSnapshot, filterContactMomentDiagnostics, type LinkResolver } from "./build-snapshot";

export interface GraphSourceInput {
	visible: RawIndexSnapshot;
	canonical: RawIndexSnapshot;
}

export interface PermittedDiagnosticRelationshipContext {
	people: readonly PersonRecord[];
	relationships: readonly RelationshipRecord[];
	resolveLink: LinkResolver;
}

/** Keeps diagnostic context inside the admitted Base, including after incremental updates. */
export function filterPermittedSnapshotDiagnostics(
	snapshot: AtlasSnapshot,
	admittedEntryPaths: ReadonlySet<string>,
	relationshipContext?: PermittedDiagnosticRelationshipContext,
): AtlasSnapshot {
	const allowedPaths = new Set(admittedEntryPaths);
	for (const edge of snapshot.edges) if (edge.filePath) allowedPaths.add(edge.filePath);
	for (const moment of snapshot.contactMoments) allowedPaths.add(moment.filePath);
	const admittedGhostTargets: string[] = [];
	if (relationshipContext) {
		const people = createReferenceIndex(relationshipContext.people);
		const permittedPeople = new Set(snapshot.nodes.filter(isResolvedAtlasPersonNode).map((node) => node.filePath));
		const ghosts = new Set(snapshot.nodes.filter((node) => node.kind === "ghost").map((node) => node.id));
		for (const relationship of relationshipContext.relationships) {
			const endpoints = [relationship.from, relationship.to].map((reference: PersonReference) => {
				const resolution = resolveReference(reference, relationship.filePath, people, relationshipContext.resolveLink);
				const admittedPerson =
					resolution.status === "resolved" &&
					Boolean(resolution.resolved && permittedPeople.has(resolution.resolved.filePath));
				const admittedGhost =
					resolution.status === "unresolved" && ghosts.has(`ghost:${stableHash(referenceKey(reference))}`);
				return { reference, admittedPerson, admittedGhost };
			});
			if (
				!endpoints.some((endpoint) => endpoint.admittedPerson) ||
				!endpoints.every((endpoint) => endpoint.admittedPerson || endpoint.admittedGhost)
			)
				continue;
			// A broken edge can still belong to an admitted person and their authored ghost reference.
			allowedPaths.add(relationship.filePath);
			for (const endpoint of endpoints)
				if (endpoint.admittedGhost) admittedGhostTargets.push(endpoint.reference.target);
		}
	}
	const allowedTargets = new Set<string>();
	for (const path of allowedPaths) {
		const identity = normalizePathIdentity(path);
		allowedTargets.add(identity);
		if (identity.endsWith(".md")) allowedTargets.add(identity.slice(0, -3));
	}
	for (const node of snapshot.nodes) {
		if (node.personId) allowedTargets.add(node.personId);
		if (node.photoPath) allowedTargets.add(normalizePathIdentity(node.photoPath));
	}
	for (const edge of snapshot.edges) allowedTargets.add(edge.id);
	for (const target of admittedGhostTargets) {
		allowedTargets.add(target);
		allowedTargets.add(normalizePathIdentity(target));
	}
	return {
		...snapshot,
		diagnostics: snapshot.diagnostics.flatMap((diagnostic) => {
			const admittedSources = diagnostic.filePaths.filter((path) => allowedPaths.has(path));
			if (
				admittedSources.length === diagnostic.filePaths.length &&
				(!diagnostic.targetPath ||
					allowedTargets.has(diagnostic.targetPath) ||
					allowedTargets.has(normalizePathIdentity(diagnostic.targetPath)))
			)
				return [diagnostic];
			if (
				(diagnostic.code !== "duplicate-relationship-id" && diagnostic.code !== "duplicate-person-id") ||
				admittedSources.length === 0
			)
				return [];
			// The structural fence must survive without exposing the excluded duplicate's context.
			return [
				{
					id: `permitted-${diagnostic.code}:${admittedSources.join("|")}`,
					severity: diagnostic.severity,
					code: diagnostic.code,
					message:
						diagnostic.code === "duplicate-person-id"
							? "The admitted person has a duplicate stable ID and is not actionable."
							: "The admitted relationship has a duplicate stable ID and is not actionable.",
					filePaths: admittedSources,
				},
			];
		}),
	};
}

function mergeDiagnostics(...snapshots: RawIndexSnapshot[]): AtlasDiagnostic[] {
	const diagnostics = new Map<string, AtlasDiagnostic>();
	for (const snapshot of snapshots) {
		for (const diagnostic of snapshot.diagnostics ?? []) diagnostics.set(diagnostic.id, diagnostic);
	}
	return [...diagnostics.values()];
}

export function buildGraphSnapshot(source: GraphSourceInput, resolveLink: LinkResolver): AtlasSnapshot {
	const visiblePersonPaths = new Set(source.visible.people.map((person) => person.filePath));
	const contactMoments = source.canonical.contactMoments ?? [];
	const diagnostics = filterContactMomentDiagnostics(
		mergeDiagnostics(source.canonical, source.visible),
		contactMoments,
		source.canonical.relationships,
		source.canonical.people,
		visiblePersonPaths,
		resolveLink,
	);
	return buildAtlasSnapshot(
		{
			people: source.visible.people,
			relationships: source.canonical.relationships,
			contactMoments,
			diagnostics,
		},
		resolveLink,
		{ resolutionPeople: source.canonical.people },
	);
}
