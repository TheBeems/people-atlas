import { referenceKey } from "../domain/wikilink";
import type {
	AtlasDiagnostic,
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	IndexDelta,
	NodeId,
	PersonRecord,
	PersonReference,
	RelationshipRecord,
} from "../domain/types";
import { stableHash } from "../utils/hash";
import type { LinkResolver } from "./build-snapshot";

export interface ApplyGraphDeltaOptions {
	resolutionPeople?: PersonRecord[];
	visiblePaths?: Set<string>;
}

interface ResolvedReference {
	person?: PersonRecord;
	ambiguous: PersonRecord[];
}

function nodeIdForPerson(person: PersonRecord, duplicateIds: Set<string>): NodeId {
	return duplicateIds.has(person.id) ? `ambiguous:${stableHash(`${person.id}:${person.filePath}`)}` : person.id;
}

function resolveReference(
	reference: PersonReference,
	sourcePath: string,
	people: PersonRecord[],
	resolveLink: LinkResolver,
): ResolvedReference {
	const idMatches = people.filter((person) => person.id === reference.target);
	if (idMatches.length > 1) return { ambiguous: idMatches };
	if (idMatches.length === 1) {
		const person = idMatches[0];
		return person ? { person, ambiguous: [] } : { ambiguous: [] };
	}
	const resolvedPath = resolveLink(reference.target, sourcePath);
	if (resolvedPath) {
		const person = people.find((candidate) => candidate.filePath === resolvedPath);
		return person ? { person, ambiguous: [] } : { ambiguous: [] };
	}
	const person = people.find((candidate) => candidate.filePath === reference.target);
	return person ? { person, ambiguous: [] } : { ambiguous: [] };
}

function findNodeForPerson(nodes: Map<NodeId, AtlasNode>, person: PersonRecord): AtlasNode | undefined {
	return [...nodes.values()].find((node) => node.kind === "person" && node.filePath === person.filePath);
}

function diagnosticForAmbiguous(reference: PersonReference, sourcePath: string, matches: PersonRecord[]): AtlasDiagnostic {
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
	people: PersonRecord[],
	resolveLink: LinkResolver,
	diagnostics: Map<string, AtlasDiagnostic>,
): void {
	const source = findNodeForPerson(nodes, person);
	const resolved = resolveReference(reference, person.filePath, people, resolveLink);
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
		edges.set(`edge:${stableHash(`${source.id}:${targetId}:contact`)}`, {
			id: `edge:${stableHash(`${source.id}:${targetId}:contact`)}`,
			sourceId: source.id,
			targetId,
			types: ["contact"],
			filePath: person.filePath,
			direction: "undirected",
			inferred: true,
		});
		return;
	}

	const target = findNodeForPerson(nodes, resolved.person);
	if (!source || !target) {
		addDiagnostic(diagnostics, {
			id: `filtered-endpoint:${person.filePath}:contact`,
			severity: "info",
			code: "filtered-endpoint",
			message: `The contact endpoint in “${person.filePath}” is a resolved person outside the current Base selection.`,
			filePaths: [person.filePath],
		});
		return;
	}
	if (source.id === target.id) return;
	const id = `edge:${stableHash(`${source.id}:${target.id}:contact`)}`;
	edges.set(id, {
		id,
		sourceId: source.id,
		targetId: target.id,
		types: ["contact"],
		filePath: person.filePath,
		direction: "undirected",
		inferred: true,
	});
}

function addRelationshipEdge(
	edges: Map<string, AtlasEdge>,
	nodes: Map<NodeId, AtlasNode>,
	relationship: RelationshipRecord,
	people: PersonRecord[],
	duplicateRelationshipIds: Set<string>,
	resolveLink: LinkResolver,
	diagnostics: Map<string, AtlasDiagnostic>,
): void {
	const source = resolveReference(relationship.from, relationship.filePath, people, resolveLink);
	const target = resolveReference(relationship.to, relationship.filePath, people, resolveLink);
	if (source.ambiguous.length > 1 || target.ambiguous.length > 1) {
		if (source.ambiguous.length > 1) addDiagnostic(diagnostics, diagnosticForAmbiguous(relationship.from, relationship.filePath, source.ambiguous));
		if (target.ambiguous.length > 1) addDiagnostic(diagnostics, diagnosticForAmbiguous(relationship.to, relationship.filePath, target.ambiguous));
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
	const sourceNode = findNodeForPerson(nodes, source.person);
	const targetNode = findNodeForPerson(nodes, target.person);
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
	const id = duplicateRelationshipIds.has(relationship.id) ? `${relationship.id}:${stableHash(relationship.filePath)}` : relationship.id;
	edges.set(id, {
		id,
		sourceId: sourceNode.id,
		targetId: targetNode.id,
		types: relationship.types.length > 0 ? relationship.types : ["relationship"],
		closeness: relationship.closeness,
		direction: relationship.direction,
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
			isCenter: false,
		});
	}

	const remappedNodes = new Map<NodeId, AtlasNode>();
	const idRemap = new Map<NodeId, NodeId>();
	for (const [oldId, node] of nodes) {
		const desired = node.kind === "person" && node.personId && node.filePath
			? nodeIdForPerson({ id: node.personId, filePath: node.filePath, name: node.label, aliases: [], organisations: node.organisations, contacts: [] }, duplicatePersonIds)
			: oldId;
		idRemap.set(oldId, desired);
		remappedNodes.set(desired, { ...node, id: desired });
	}

	const edges = new Map<string, AtlasEdge>();
	for (const edge of previous.edges) {
		const sourcePath = previous.nodes.find((node) => node.id === edge.sourceId)?.filePath;
		const targetPath = previous.nodes.find((node) => node.id === edge.targetId)?.filePath;
		const affected = Boolean(edge.filePath && changedPaths.has(edge.filePath)) || Boolean(sourcePath && changedPersonPaths.has(sourcePath)) || Boolean(targetPath && changedPersonPaths.has(targetPath));
		if (affected) continue;
		const sourceId = idRemap.get(edge.sourceId) ?? edge.sourceId;
		const targetId = idRemap.get(edge.targetId) ?? edge.targetId;
		edges.set(edge.id, { ...edge, sourceId, targetId });
	}

	const diagnostics = new Map<string, AtlasDiagnostic>();
	for (const diagnostic of previous.diagnostics) {
		const changed = diagnostic.filePaths.some((path) => changedPaths.has(path)) || diagnostic.code.startsWith("duplicate-") || diagnostic.code === "node-limit";
		if (!changed) diagnostics.set(diagnostic.id, diagnostic);
	}
	for (const diagnostic of delta.diagnostics) addDiagnostic(diagnostics, diagnostic);

	for (const person of changedPeople.values()) {
		for (const contact of person.contacts) addContactEdge(edges, remappedNodes, person, contact, people, resolveLink, diagnostics);
	}
	for (const relationship of delta.affectedRelationships) {
		addRelationshipEdge(edges, remappedNodes, relationship, people, duplicateRelationshipIds, resolveLink, diagnostics);
	}

	for (const [id, node] of [...remappedNodes.entries()]) {
		if (node.kind === "ghost" && ![...edges.values()].some((edge) => edge.sourceId === id || edge.targetId === id)) remappedNodes.delete(id);
	}
	const hiddenNodeCount = visiblePaths && options.resolutionPeople
		? options.resolutionPeople.filter((person) => !visiblePaths.has(person.filePath)).length
		: previous.hiddenNodeCount;
	const hiddenEdgeCount = visiblePaths
		? [...diagnostics.values()].filter((diagnostic) => diagnostic.code === "filtered-endpoint").length
		: 0;
	return {
		nodes: [...remappedNodes.values()],
		edges: [...edges.values()],
		diagnostics: [...diagnostics.values()],
		hiddenNodeCount,
		hiddenEdgeCount,
		generatedAt: Date.now(),
	};
}
