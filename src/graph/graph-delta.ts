import { referenceKey } from "../domain/wikilink";
import type {
	AtlasDiagnostic,
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	ContactMomentRecord,
	IndexDelta,
	NodeId,
	PersonRecord,
	PersonReference,
	RelationshipRecord,
} from "../domain/types";
import { stableHash } from "../utils/hash";
import { filterContactMomentDiagnostics, projectContactMomentSummaries, type LinkResolver } from "./build-snapshot";
import { filteredEndpointDiagnostic, inferredContactEdgeId } from "./graph-elements";

export interface ApplyGraphDeltaOptions {
	resolutionPeople?: PersonRecord[];
	visiblePaths?: Set<string>;
	contactMoments?: readonly ContactMomentRecord[];
	relationships?: readonly RelationshipRecord[];
}

interface ResolvedReference {
	person?: PersonRecord;
	ambiguous: PersonRecord[];
}

interface ResolutionContext {
	peopleById: Map<string, PersonRecord[]>;
	peopleByPath: Map<string, PersonRecord>;
	nodeByPersonPath: Map<string, AtlasNode>;
	resolveLink: LinkResolver;
}

function nodeIdForPerson(person: PersonRecord, duplicateIds: Set<string>): NodeId {
	return duplicateIds.has(person.id) ? `ambiguous:${stableHash(`${person.id}:${person.filePath}`)}` : person.id;
}

function buildResolutionContext(
	people: PersonRecord[],
	nodes: Map<NodeId, AtlasNode>,
	resolveLink: LinkResolver,
): ResolutionContext {
	const peopleById = new Map<string, PersonRecord[]>();
	const peopleByPath = new Map<string, PersonRecord>();
	for (const person of people) {
		const matches = peopleById.get(person.id) ?? [];
		matches.push(person);
		peopleById.set(person.id, matches);
		if (!peopleByPath.has(person.filePath)) peopleByPath.set(person.filePath, person);
	}
	const nodeByPersonPath = new Map<string, AtlasNode>();
	for (const node of nodes.values()) {
		if (node.kind === "person" && node.filePath && !nodeByPersonPath.has(node.filePath)) {
			nodeByPersonPath.set(node.filePath, node);
		}
	}
	return { peopleById, peopleByPath, nodeByPersonPath, resolveLink };
}

function resolveReference(
	reference: PersonReference,
	sourcePath: string,
	context: ResolutionContext,
): ResolvedReference {
	const idMatches = context.peopleById.get(reference.target);
	if (idMatches && idMatches.length > 1) return { ambiguous: idMatches };
	if (idMatches?.length === 1) {
		const person = idMatches[0];
		return person ? { person, ambiguous: [] } : { ambiguous: [] };
	}
	const resolvedPath = context.resolveLink(reference.target, sourcePath);
	if (resolvedPath) {
		const person = context.peopleByPath.get(resolvedPath);
		return person ? { person, ambiguous: [] } : { ambiguous: [] };
	}
	const person = context.peopleByPath.get(reference.target);
	return person ? { person, ambiguous: [] } : { ambiguous: [] };
}

function findNodeForPerson(context: ResolutionContext, person: PersonRecord): AtlasNode | undefined {
	return context.nodeByPersonPath.get(person.filePath);
}

function diagnosticForAmbiguous(
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

function addDiagnostic(diagnostics: Map<string, AtlasDiagnostic>, diagnostic: AtlasDiagnostic): void {
	diagnostics.set(diagnostic.id, diagnostic);
}

function addContactEdge(
	edges: Map<string, AtlasEdge>,
	nodes: Map<NodeId, AtlasNode>,
	person: PersonRecord,
	reference: PersonReference,
	context: ResolutionContext,
	diagnostics: Map<string, AtlasDiagnostic>,
	contactIndex: number,
): void {
	const source = findNodeForPerson(context, person);
	const resolved = resolveReference(reference, person.filePath, context);
	if (resolved.ambiguous.length > 1) {
		addDiagnostic(diagnostics, diagnosticForAmbiguous(reference, person.filePath, resolved.ambiguous));
		return;
	}
	if (!resolved.person) {
		if (!source) return;
		const targetId: NodeId = `ghost:${stableHash(referenceKey(reference))}`;
		if (!nodes.has(targetId)) {
			nodes.set(targetId, {
				id: targetId,
				kind: "ghost",
				label: reference.label ?? reference.target,
				organisations: [],
				emails: [],
				phones: [],
				isCenter: false,
			});
		}
		addDiagnostic(diagnostics, {
			id: `unresolved-contact:${person.filePath}:${targetId}`,
			severity: "warning",
			code: "unresolved-contact",
			message: `Could not resolve contact “${reference.target}”.`,
			filePaths: [person.filePath],
		});
		if (targetId === source.id) return;
		const id = inferredContactEdgeId(source.id, targetId);
		edges.set(id, {
			id,
			sourceId: source.id,
			targetId,
			types: ["contact"],
			filePath: person.filePath,
			inferred: true,
		});
		return;
	}

	const target = findNodeForPerson(context, resolved.person);
	if (!source || !target) {
		addDiagnostic(
			diagnostics,
			filteredEndpointDiagnostic(person.filePath, "contact", `${referenceKey(reference)}:${contactIndex}`),
		);
		return;
	}
	if (source.id === target.id) return;
	const id = inferredContactEdgeId(source.id, target.id);
	edges.set(id, {
		id,
		sourceId: source.id,
		targetId: target.id,
		types: ["contact"],
		filePath: person.filePath,
		inferred: true,
	});
}

function addRelationshipEdge(
	edges: Map<string, AtlasEdge>,
	relationship: RelationshipRecord,
	duplicateRelationshipIds: Set<string>,
	context: ResolutionContext,
	diagnostics: Map<string, AtlasDiagnostic>,
): void {
	const source = resolveReference(relationship.from, relationship.filePath, context);
	const target = resolveReference(relationship.to, relationship.filePath, context);
	if (source.ambiguous.length > 1 || target.ambiguous.length > 1) {
		if (source.ambiguous.length > 1)
			addDiagnostic(diagnostics, diagnosticForAmbiguous(relationship.from, relationship.filePath, source.ambiguous));
		if (target.ambiguous.length > 1)
			addDiagnostic(diagnostics, diagnosticForAmbiguous(relationship.to, relationship.filePath, target.ambiguous));
		return;
	}
	if (!source.person || !target.person) {
		addDiagnostic(diagnostics, {
			id: `relationship-endpoint:${relationship.id}:${relationship.filePath}`,
			severity: "error",
			code: "unresolved-relationship-endpoint",
			message: `Relationship “${relationship.filePath}” has an unresolved endpoint.`,
			filePaths: [relationship.filePath],
		});
		return;
	}
	if (source.person.filePath === target.person.filePath) {
		addDiagnostic(diagnostics, {
			id: `self:${relationship.id}:${relationship.filePath}`,
			severity: "warning",
			code: "self-relationship",
			message: `Relationship “${relationship.filePath}” links a person to themselves.`,
			filePaths: [relationship.filePath],
		});
		return;
	}
	const sourceNode = findNodeForPerson(context, source.person);
	const targetNode = findNodeForPerson(context, target.person);
	if (!sourceNode || !targetNode) {
		addDiagnostic(diagnostics, {
			id: `filtered-endpoint:${relationship.filePath}:relationship`,
			severity: "info",
			code: "filtered-endpoint",
			message: `The relationship endpoint in “${relationship.filePath}” is a resolved person outside the current Base selection.`,
			filePaths: [relationship.filePath],
		});
		return;
	}
	const id = duplicateRelationshipIds.has(relationship.id)
		? `${relationship.id}:${stableHash(relationship.filePath)}`
		: relationship.id;
	edges.set(id, {
		id,
		sourceId: sourceNode.id,
		targetId: targetNode.id,
		presetId: relationship.presetId,
		types: relationship.types.length > 0 ? relationship.types : ["relationship"],
		fromRole: relationship.fromRole,
		toRole: relationship.toRole,
		closeness: relationship.closeness,
		since: relationship.since,
		lastContact: relationship.lastContact,
		status: relationship.status,
		filePath: relationship.filePath,
		inferred: false,
	});
}

export function applyGraphDelta(
	previous: AtlasSnapshot,
	delta: IndexDelta,
	resolveLink: LinkResolver,
	options: ApplyGraphDeltaOptions = {},
): AtlasSnapshot {
	const people = options.resolutionPeople ?? delta.affectedPeople;
	const visiblePaths = options.visiblePaths;
	const duplicatePersonIds = new Set(delta.duplicatePersonIds);
	const duplicateRelationshipIds = new Set(delta.duplicateRelationshipIds);
	const changedPaths = new Set(delta.changedPaths);
	const changedPeople = new Map<string, PersonRecord>();
	for (const person of delta.affectedPeople) changedPeople.set(person.filePath, person);
	const removedPeople = new Set(delta.removedPeople.map((person) => person.filePath));
	const changedPersonPaths = new Set([...changedPeople.keys(), ...removedPeople]);

	const nodes = new Map<NodeId, AtlasNode>(previous.nodes.map((node) => [node.id, { ...node }]));
	for (const [id, node] of [...nodes.entries()]) {
		if (node.filePath && changedPersonPaths.has(node.filePath)) nodes.delete(id);
	}
	for (const person of changedPeople.values()) {
		if (visiblePaths && !visiblePaths.has(person.filePath)) continue;
		const id = nodeIdForPerson(person, duplicatePersonIds);
		nodes.set(id, {
			id,
			kind: "person",
			personId: person.id,
			label: person.name,
			filePath: person.filePath,
			photoPath: person.photoPath,
			organisations: person.organisations,
			birthDate: person.birthDate,
			pronouns: person.pronouns,
			gender: person.gender,
			emails: person.emails,
			phones: person.phones,
			jobTitle: person.jobTitle,
			isCenter: false,
		});
	}

	const remappedNodes = new Map<NodeId, AtlasNode>();
	const idRemap = new Map<NodeId, NodeId>();
	for (const [oldId, node] of nodes) {
		const desired =
			node.kind === "person" && node.personId && node.filePath
				? nodeIdForPerson(
						{
							id: node.personId,
							filePath: node.filePath,
							name: node.label,
							aliases: [],
							organisations: node.organisations,
							photoPath: node.photoPath,
							birthDate: node.birthDate,
							pronouns: node.pronouns,
							gender: node.gender,
							emails: node.emails,
							phones: node.phones,
							jobTitle: node.jobTitle,
							contacts: [],
						},
						duplicatePersonIds,
					)
				: oldId;
		idRemap.set(oldId, desired);
		remappedNodes.set(desired, { ...node, id: desired });
	}
	const context = buildResolutionContext(people, remappedNodes, resolveLink);
	const previousNodeById = new Map(previous.nodes.map((node) => [node.id, node]));

	const edges = new Map<string, AtlasEdge>();
	for (const edge of previous.edges) {
		const sourcePath = previousNodeById.get(edge.sourceId)?.filePath;
		const targetPath = previousNodeById.get(edge.targetId)?.filePath;
		const affected =
			Boolean(edge.filePath && changedPaths.has(edge.filePath)) ||
			Boolean(sourcePath && changedPersonPaths.has(sourcePath)) ||
			Boolean(targetPath && changedPersonPaths.has(targetPath));
		if (affected) continue;
		const sourceId = idRemap.get(edge.sourceId) ?? edge.sourceId;
		const targetId = idRemap.get(edge.targetId) ?? edge.targetId;
		const edgeId =
			edge.inferred && edge.types.includes("contact") ? inferredContactEdgeId(sourceId, targetId) : edge.id;
		edges.set(edgeId, { ...edge, id: edgeId, sourceId, targetId });
	}

	const diagnostics = new Map<string, AtlasDiagnostic>();
	for (const diagnostic of previous.diagnostics) {
		const changed =
			diagnostic.filePaths.some((path) => changedPaths.has(path)) ||
			diagnostic.code.startsWith("duplicate-") ||
			diagnostic.code === "node-limit";
		if (!changed) diagnostics.set(diagnostic.id, diagnostic);
	}
	for (const diagnostic of delta.diagnostics) addDiagnostic(diagnostics, diagnostic);

	for (const person of changedPeople.values()) {
		for (const [contactIndex, contact] of person.contacts.entries()) {
			addContactEdge(edges, remappedNodes, person, contact, context, diagnostics, contactIndex);
		}
	}
	for (const relationship of delta.affectedRelationships) {
		addRelationshipEdge(edges, relationship, duplicateRelationshipIds, context, diagnostics);
	}

	for (const [id, node] of [...remappedNodes.entries()]) {
		if (node.kind === "ghost" && ![...edges.values()].some((edge) => edge.sourceId === id || edge.targetId === id))
			remappedNodes.delete(id);
	}
	const hiddenNodeCount =
		visiblePaths && options.resolutionPeople
			? options.resolutionPeople.filter((person) => !visiblePaths.has(person.filePath)).length
			: previous.hiddenNodeCount;
	const hiddenEdgeCount = visiblePaths
		? [...diagnostics.values()].filter((diagnostic) => diagnostic.code === "filtered-endpoint").length
		: 0;
	const contactMomentProjection = nextContactMomentProjection(
		previous,
		delta,
		people,
		remappedNodes,
		resolveLink,
		options,
	);
	let outputDiagnostics = [...diagnostics.values()];
	if (visiblePaths && options.contactMoments !== undefined && options.relationships !== undefined) {
		outputDiagnostics = filterContactMomentDiagnostics(
			outputDiagnostics,
			options.contactMoments,
			options.relationships,
			people,
			visiblePaths,
			resolveLink,
		);
	}
	return {
		nodes: [...remappedNodes.values()],
		edges: [...edges.values()],
		contactMoments: contactMomentProjection.contactMoments,
		diagnostics: outputDiagnostics,
		hiddenNodeCount,
		hiddenEdgeCount,
		hiddenContactMomentCount: contactMomentProjection.hiddenContactMomentCount,
		generatedAt: Date.now(),
	};
}

function nextContactMomentProjection(
	previous: AtlasSnapshot,
	delta: IndexDelta,
	people: readonly PersonRecord[],
	nodes: ReadonlyMap<NodeId, AtlasNode>,
	resolveLink: LinkResolver,
	options: ApplyGraphDeltaOptions,
): { contactMoments: AtlasSnapshot["contactMoments"]; hiddenContactMomentCount: number } {
	const visiblePersonPaths =
		options.visiblePaths ??
		new Set(
			[...nodes.values()]
				.filter((node) => node.kind === "person" && node.filePath)
				.map((node) => node.filePath as string),
		);
	const currentContactMoments = options.contactMoments;
	const currentRelationships = options.relationships;
	if (currentContactMoments !== undefined && currentRelationships !== undefined) {
		return projectContactMomentSummaries(
			currentContactMoments,
			currentRelationships,
			people,
			visiblePersonPaths,
			resolveLink,
		);
	}

	const hasContactMomentDelta = [
		delta.affectedContactMomentIds,
		delta.addedContactMoments,
		delta.updatedContactMoments,
		delta.removedContactMoments,
		delta.affectedContactMoments,
	].some((value) => (value?.length ?? 0) > 0);
	if (!hasContactMomentDelta) {
		return {
			contactMoments: [...(previous.contactMoments ?? [])],
			hiddenContactMomentCount: previous.hiddenContactMomentCount ?? 0,
		};
	}

	throw new Error(
		"Contact-moment deltas require complete current contactMoments and relationships projection sources.",
	);
}
