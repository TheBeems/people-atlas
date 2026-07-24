import type { AtlasDiagnostic, AtlasSnapshot, NodeId, ProjectGraphOptions } from "../domain/types";

export function projectGraph(snapshot: AtlasSnapshot, options: ProjectGraphOptions): AtlasSnapshot {
	const centerExists = options.centerId && snapshot.nodes.some((node) => node.id === options.centerId);
	if (!centerExists) return limitGraph(snapshot, options.maxNodes);

	const adjacency = new Map<NodeId, Set<NodeId>>();
	for (const edge of snapshot.edges) {
		if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set());
		if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set());
		adjacency.get(edge.sourceId)?.add(edge.targetId);
		adjacency.get(edge.targetId)?.add(edge.sourceId);
	}

	const included = new Set<NodeId>([options.centerId as NodeId]);
	let frontier = new Set<NodeId>([options.centerId as NodeId]);
	for (let depth = 0; depth < Math.max(0, options.hops); depth++) {
		const next = new Set<NodeId>();
		for (const id of frontier) {
			for (const neighbor of adjacency.get(id) ?? []) {
				if (!included.has(neighbor)) next.add(neighbor);
				included.add(neighbor);
			}
		}
		frontier = next;
	}

	const projected: AtlasSnapshot = {
		nodes: snapshot.nodes
			.filter((node) => included.has(node.id))
			.map((node) => ({ ...node, isCenter: node.id === options.centerId })),
		edges: snapshot.edges.filter((edge) => included.has(edge.sourceId) && included.has(edge.targetId)),
		diagnostics: snapshot.diagnostics,
		hiddenNodeCount: snapshot.hiddenNodeCount,
		hiddenEdgeCount: snapshot.hiddenEdgeCount,
		generatedAt: snapshot.generatedAt,
	};
	return limitGraph(projected, options.maxNodes);
}

function limitGraph(snapshot: AtlasSnapshot, maxNodes: number): AtlasSnapshot {
	if (snapshot.nodes.length <= maxNodes) return snapshot;
	const nodes = snapshot.nodes.slice(0, maxNodes);
	const ids = new Set(nodes.map((node) => node.id));
	const diagnostic: AtlasDiagnostic = {
		id: `node-limit:${maxNodes}`,
		severity: "warning",
		code: "node-limit",
		message: `The view is limited to ${maxNodes} nodes. Narrow the Base or choose a center person.`,
		filePaths: [],
	};
	return {
		nodes,
		edges: snapshot.edges.filter((edge) => ids.has(edge.sourceId) && ids.has(edge.targetId)),
		diagnostics: [...snapshot.diagnostics, diagnostic],
		hiddenNodeCount: snapshot.hiddenNodeCount,
		hiddenEdgeCount: snapshot.hiddenEdgeCount,
		generatedAt: snapshot.generatedAt,
	};
}
