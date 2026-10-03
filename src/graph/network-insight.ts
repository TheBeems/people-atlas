import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { AtlasEdge, AtlasNode, AtlasSnapshot, NodeId } from "../domain/types";

export interface NetworkStep {
	from: AtlasNode;
	to: AtlasNode;
	/** Parallel relationships and Linked people remain distinguishable. */
	edges: AtlasEdge[];
}

export type ShortestPathResult =
	| { status: "found" | "same-person"; nodes: AtlasNode[]; steps: NetworkStep[] }
	| { status: "invalid-person" | "disconnected"; nodes: []; steps: [] };

export interface CommonContact {
	person: AtlasNode;
	firstEdges: AtlasEdge[];
	secondEdges: AtlasEdge[];
}

export interface CommonContactsResult {
	status: "found" | "same-person" | "invalid-person";
	contacts: CommonContact[];
}

function compareIds(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalGraph(snapshot: AtlasSnapshot): {
	nodes: Map<NodeId, AtlasNode>;
	neighbors: Map<NodeId, Map<NodeId, AtlasEdge[]>>;
} {
	const counts = new Map<NodeId, number>();
	for (const node of snapshot.nodes) counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
	const nodes = new Map(
		snapshot.nodes
			.filter((node) => isResolvedAtlasPersonNode(node) && counts.get(node.id) === 1)
			.map((node) => [node.id, node]),
	);
	const neighbors = new Map<NodeId, Map<NodeId, AtlasEdge[]>>();
	for (const id of nodes.keys()) neighbors.set(id, new Map());
	for (const edge of snapshot.edges) {
		if (edge.sourceId === edge.targetId || !nodes.has(edge.sourceId) || !nodes.has(edge.targetId)) continue;
		for (const [from, to] of [
			[edge.sourceId, edge.targetId],
			[edge.targetId, edge.sourceId],
		] as const) {
			const adjacency = neighbors.get(from);
			const edges = adjacency?.get(to) ?? [];
			edges.push(edge);
			adjacency?.set(to, edges);
		}
	}
	for (const adjacency of neighbors.values()) {
		for (const edges of adjacency.values())
			edges.sort((left, right) => Number(left.inferred) - Number(right.inferred) || compareIds(left.id, right.id));
	}
	return { nodes, neighbors };
}

/** Undirected existing connections only; canonical IDs, never names, select endpoints. */
export function shortestPath(snapshot: AtlasSnapshot, firstId: NodeId, secondId: NodeId): ShortestPathResult {
	const { nodes, neighbors } = canonicalGraph(snapshot);
	const first = nodes.get(firstId);
	const second = nodes.get(secondId);
	if (!first || !second) return { status: "invalid-person", nodes: [], steps: [] };
	if (firstId === secondId) return { status: "same-person", nodes: [first], steps: [] };
	const previous = new Map<NodeId, NodeId>();
	const visited = new Set<NodeId>([firstId]);
	const queue: NodeId[] = [firstId];
	for (let index = 0; index < queue.length && !visited.has(secondId); index++) {
		const id = queue[index];
		if (id === undefined) continue;
		for (const neighbor of [...(neighbors.get(id)?.keys() ?? [])].sort(compareIds)) {
			if (visited.has(neighbor)) continue;
			visited.add(neighbor);
			previous.set(neighbor, id);
			queue.push(neighbor);
		}
	}
	if (!visited.has(secondId)) return { status: "disconnected", nodes: [], steps: [] };
	const ids: NodeId[] = [secondId];
	while (ids[0] !== firstId) {
		const parent = previous.get(ids[0] as NodeId);
		if (!parent) return { status: "disconnected", nodes: [], steps: [] };
		ids.unshift(parent);
	}
	const pathNodes = ids.map((id) => nodes.get(id) as AtlasNode);
	const steps: NetworkStep[] = [];
	for (let index = 1; index < pathNodes.length; index++) {
		const from = pathNodes[index - 1] as AtlasNode;
		const to = pathNodes[index] as AtlasNode;
		steps.push({ from, to, edges: [...(neighbors.get(from.id)?.get(to.id) ?? [])] });
	}
	return { status: "found", nodes: pathNodes, steps };
}

export function commonContacts(snapshot: AtlasSnapshot, firstId: NodeId, secondId: NodeId): CommonContactsResult {
	const { nodes, neighbors } = canonicalGraph(snapshot);
	if (!nodes.has(firstId) || !nodes.has(secondId)) return { status: "invalid-person", contacts: [] };
	if (firstId === secondId) return { status: "same-person", contacts: [] };
	const first = neighbors.get(firstId) as Map<NodeId, AtlasEdge[]>;
	const second = neighbors.get(secondId) as Map<NodeId, AtlasEdge[]>;
	const contacts = [...first.keys()]
		.filter((id) => id !== firstId && id !== secondId && second.has(id))
		.sort(compareIds)
		.map((id) => ({
			person: nodes.get(id) as AtlasNode,
			firstEdges: [...(first.get(id) ?? [])],
			secondEdges: [...(second.get(id) ?? [])],
		}));
	return { status: "found", contacts };
}
