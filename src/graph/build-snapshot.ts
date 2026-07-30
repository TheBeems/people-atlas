import { referenceKey } from "../domain/wikilink";
import type {
	AtlasDiagnostic,
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	NodeId,
	PersonId,
	PersonRecord,
	PersonReference,
	RawIndexSnapshot,
	RelationshipRecord,
} from "../domain/types";
import { stableHash } from "../utils/hash";
import { filteredEndpointDiagnostic, inferredContactEdgeId } from "./graph-elements";

export type LinkResolver = (referenceTarget: string, sourcePath: string) => string | undefined;

export interface BuildAtlasSnapshotOptions {
	resolutionPeople?: PersonRecord[] | undefined;
}

interface ResolutionContext {
	peopleById: Map<PersonId, PersonRecord[]>;
	peopleByPath: Map<string, PersonRecord>;
	outputNodeIdByPath: Map<string, NodeId>;
	resolveLink: LinkResolver;
}

function ghostId(reference: PersonReference): NodeId {
	return `ghost:${stableHash(referenceKey(reference))}`;
}

function duplicateDiagnostics(resolutionPeople: PersonRecord[], outputPeople: PersonRecord[]): AtlasDiagnostic[] {
	const grouped = new Map<PersonId, Map<string, PersonRecord>>();
	for (const person of [...resolutionPeople, ...outputPeople]) {
		const people = grouped.get(person.id) ?? new Map<string, PersonRecord>();
		people.set(person.filePath, person);
		grouped.set(person.id, people);
	}

	const diagnostics: AtlasDiagnostic[] = [];
	for (const [id, people] of grouped) {
		if (people.size < 2) continue;
		diagnostics.push({
			id: `duplicate-person-id:${id}`,
			severity: "error",
			code: "duplicate-person-id",
			message: `Multiple person notes use the ID “${id}”.`,
			filePaths: [...people.values()].map((person) => person.filePath).sort(),
		});
	}
	return diagnostics;
}

function addPersonToIdIndex(index: Map<PersonId, PersonRecord[]>, person: PersonRecord): void {
	const matches = index.get(person.id) ?? [];
	if (!matches.some((match) => match.filePath === person.filePath)) matches.push(person);
	index.set(person.id, matches);
}

function buildResolutionContext(
	resolutionPeople: PersonRecord[],
	outputPeople: PersonRecord[],
	resolveLink: LinkResolver,
	outputNodeIdByPath: Map<string, NodeId>,
): ResolutionContext {
	const peopleById = new Map<PersonId, PersonRecord[]>();
	for (const person of [...resolutionPeople, ...outputPeople]) addPersonToIdIndex(peopleById, person);

	const peopleByPath = new Map<string, PersonRecord>();
	for (const person of resolutionPeople) peopleByPath.set(person.filePath, person);
	for (const person of outputPeople) {
		if (!peopleByPath.has(person.filePath)) peopleByPath.set(person.filePath, person);
	}

	return {
		peopleById,
		peopleByPath,
		outputNodeIdByPath,
		resolveLink,
	};
}

function resolveReference(
	reference: PersonReference,
	sourcePath: string,
	context: ResolutionContext,
): PersonRecord | undefined {
	const idMatches = context.peopleById.get(reference.target);
	if (idMatches) return idMatches.length === 1 ? idMatches[0] : undefined;

	const resolvedPath = context.resolveLink(reference.target, sourcePath);
	if (resolvedPath) return context.peopleByPath.get(resolvedPath);
	return context.peopleByPath.get(reference.target);
}

function ambiguousReferenceDiagnostic(
	reference: PersonReference,
	sourcePath: string,
	matches: PersonRecord[],
): AtlasDiagnostic {
	return {
		id: `ambiguous-reference:${sourcePath}:${referenceKey(reference)}`,
		severity: "error",
		code: "ambiguous-person-reference",
		message: `The person reference “${reference.target}” is ambiguous; it matches multiple notes.`,
		filePaths: [sourcePath, ...matches.map((person) => person.filePath)],
	};
}

function relationshipDuplicateDiagnostics(relationships: RelationshipRecord[]): AtlasDiagnostic[] {
	const grouped = new Map<string, RelationshipRecord[]>();
	for (const relationship of relationships) {
		const matches = grouped.get(relationship.id) ?? [];
		matches.push(relationship);
		grouped.set(relationship.id, matches);
	}

	const diagnostics: AtlasDiagnostic[] = [];
	for (const [id, matches] of grouped) {
		if (matches.length < 2) continue;
		diagnostics.push({
			id: `duplicate-relationship-id:${id}`,
			severity: "error",
			code: "duplicate-relationship-id",
			message: `Multiple relationship notes use the ID “${id}”.`,
			filePaths: matches.map((relationship) => relationship.filePath).sort(),
		});
	}
	return diagnostics;
}

function nodeIdForOutputPerson(person: PersonRecord, duplicateIds: Set<PersonId>): NodeId {
	if (!duplicateIds.has(person.id)) return person.id;
	return `ambiguous:${stableHash(`${person.id}:${person.filePath}`)}`;
}

export function buildAtlasSnapshot(
	raw: RawIndexSnapshot,
	resolveLink: LinkResolver,
	options: BuildAtlasSnapshotOptions = {},
): AtlasSnapshot {
	const resolutionPeople = options.resolutionPeople ?? raw.people;
	const outputPeople = raw.people;
	const outputIdCounts = new Map<PersonId, number>();
	for (const person of outputPeople) outputIdCounts.set(person.id, (outputIdCounts.get(person.id) ?? 0) + 1);
	const duplicateOutputIds = new Set<PersonId>(
		[...outputIdCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
	);
	const outputNodeIdByPath = new Map<string, NodeId>();
	for (const person of outputPeople)
		outputNodeIdByPath.set(person.filePath, nodeIdForOutputPerson(person, duplicateOutputIds));

	const context = buildResolutionContext(resolutionPeople, outputPeople, resolveLink, outputNodeIdByPath);
	const diagnostics = [
		...(raw.diagnostics ?? []),
		...duplicateDiagnostics(resolutionPeople, outputPeople),
		...relationshipDuplicateDiagnostics(raw.relationships),
	];
	const nodes = new Map<NodeId, AtlasNode>();
	for (const person of outputPeople) {
		const id = outputNodeIdByPath.get(person.filePath);
		if (!id) continue;
		nodes.set(id, {
			id,
			kind: "person",
			personId: person.id,
			label: person.name,
			filePath: person.filePath,
			photoPath: person.photoPath,
			organisations: person.organisations,
			isCenter: false,
		});
	}

	const edges: AtlasEdge[] = [];
	let hiddenEdgeCount = 0;
	const contactPeopleByPath = new Map<string, PersonRecord>();
	for (const person of resolutionPeople) contactPeopleByPath.set(person.filePath, person);
	for (const person of outputPeople) contactPeopleByPath.set(person.filePath, person);
	for (const person of contactPeopleByPath.values()) {
		const sourceId = outputNodeIdByPath.get(person.filePath);
		for (const [contactIndex, reference] of person.contacts.entries()) {
			const target = resolveReference(reference, person.filePath, context);
			if (!target) {
				const ambiguousMatches = context.peopleById.get(reference.target);
				if (ambiguousMatches && ambiguousMatches.length > 1) {
					diagnostics.push(ambiguousReferenceDiagnostic(reference, person.filePath, ambiguousMatches));
					continue;
				}
				if (!sourceId) {
					diagnostics.push({
						id: `unresolved-contact:${person.filePath}:${referenceKey(reference)}`,
						severity: "warning",
						code: "unresolved-contact",
						message: `Could not resolve contact “${reference.target}”.`,
						filePaths: [person.filePath],
					});
					continue;
				}
				const targetId = ghostId(reference);
				if (!nodes.has(targetId)) {
					nodes.set(targetId, {
						id: targetId,
						kind: "ghost",
						label: reference.label ?? reference.target,
						organisations: [],
						isCenter: false,
					});
				}
				diagnostics.push({
					id: `unresolved-contact:${person.filePath}:${targetId}`,
					severity: "warning",
					code: "unresolved-contact",
					message: `Could not resolve contact “${reference.target}”.`,
					filePaths: [person.filePath],
				});
				if (targetId === sourceId) continue;
				edges.push({
					id: `edge:${stableHash(`${sourceId}:${targetId}:contact`)}`,
					sourceId,
					targetId,
					types: ["contact"],
					filePath: person.filePath,
					direction: "undirected",
					inferred: true,
				});
				continue;
			}

			const targetId = context.outputNodeIdByPath.get(target.filePath);
			if (!sourceId || !targetId) {
				hiddenEdgeCount += 1;
				diagnostics.push(
					filteredEndpointDiagnostic(person.filePath, "contact", `${referenceKey(reference)}:${contactIndex}`),
				);
				continue;
			}
			if (targetId === sourceId) continue;
			edges.push({
				id: inferredContactEdgeId(sourceId, targetId),
				sourceId,
				targetId,
				types: ["contact"],
				filePath: person.filePath,
				direction: "undirected",
				inferred: true,
			});
		}
	}

	const relationshipIdCounts = new Map<string, number>();
	for (const relationship of raw.relationships) {
		relationshipIdCounts.set(relationship.id, (relationshipIdCounts.get(relationship.id) ?? 0) + 1);
	}
	for (const relationship of raw.relationships) {
		const source = resolveReference(relationship.from, relationship.filePath, context);
		const target = resolveReference(relationship.to, relationship.filePath, context);
		if (!source || !target) {
			const ambiguousSource = context.peopleById.get(relationship.from.target);
			const ambiguousTarget = context.peopleById.get(relationship.to.target);
			if ((ambiguousSource && ambiguousSource.length > 1) || (ambiguousTarget && ambiguousTarget.length > 1)) {
				if (ambiguousSource && ambiguousSource.length > 1)
					diagnostics.push(ambiguousReferenceDiagnostic(relationship.from, relationship.filePath, ambiguousSource));
				if (ambiguousTarget && ambiguousTarget.length > 1)
					diagnostics.push(ambiguousReferenceDiagnostic(relationship.to, relationship.filePath, ambiguousTarget));
				continue;
			}
			diagnostics.push({
				id: `relationship-endpoint:${relationship.id}:${relationship.filePath}`,
				severity: "error",
				code: "unresolved-relationship-endpoint",
				message: `Relationship “${relationship.filePath}” has an unresolved endpoint.`,
				filePaths: [relationship.filePath],
			});
			continue;
		}
		if (source.filePath === target.filePath) {
			diagnostics.push({
				id: `self:${relationship.id}:${relationship.filePath}`,
				severity: "warning",
				code: "self-relationship",
				message: `Relationship “${relationship.filePath}” links a person to themselves.`,
				filePaths: [relationship.filePath],
			});
			continue;
		}

		const sourceId = context.outputNodeIdByPath.get(source.filePath);
		const targetId = context.outputNodeIdByPath.get(target.filePath);
		if (!sourceId || !targetId) {
			hiddenEdgeCount += 1;
			diagnostics.push(filteredEndpointDiagnostic(relationship.filePath, "relationship"));
			continue;
		}

		const edgeId =
			relationshipIdCounts.get(relationship.id) === 1
				? relationship.id
				: `${relationship.id}:${stableHash(relationship.filePath)}`;
		const types = relationship.types.length > 0 ? relationship.types : ["relationship"];
		edges.push({
			id: edgeId,
			sourceId,
			targetId,
			presetId: relationship.presetId,
			types,
			fromRole: relationship.fromRole,
			toRole: relationship.toRole,
			direction: relationship.direction,
			closeness: relationship.closeness,
			since: relationship.since,
			lastContact: relationship.lastContact,
			status: relationship.status,
			filePath: relationship.filePath,
			inferred: false,
		});
	}

	const outputPaths = new Set(outputPeople.map((person) => person.filePath));
	const hiddenNodeCount = resolutionPeople.filter((person) => !outputPaths.has(person.filePath)).length;
	return {
		nodes: [...nodes.values()],
		edges,
		diagnostics,
		hiddenNodeCount,
		hiddenEdgeCount,
		generatedAt: Date.now(),
	};
}
