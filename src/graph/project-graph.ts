import type {
	AtlasDiagnostic,
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	NodeId,
	PersonId,
	ProjectGraphOptions,
} from "../domain/types";

const DEFAULT_HOPS = 2;
const DEFAULT_MAX_NODES = 500;

export function projectGraph(snapshot: AtlasSnapshot, options: ProjectGraphOptions = {}): AtlasSnapshot {
	const hops = normalizeHops(options.hops);
	const maxNodes = normalizeMaxNodes(options.maxNodes);
	const projectionMode = options.projectionMode ?? (options.centerId || options.centerPath ? "ego" : "free-network");
	const centerMode = options.centerMode ?? (options.centerId || options.centerPath ? "configured" : "none");
	const center = resolveCenter(snapshot.nodes, centerMode, options.centerId, options.centerPath);
	const projectionDiagnostics = center.diagnostic ? [center.diagnostic] : [];
	const centerNode = center.node;
	const useCenter = projectionMode !== "free-network" && centerNode !== undefined;

	const included = useCenter
		? reachableNodes(snapshot.edges, centerNode.id, hops)
		: new Set(snapshot.nodes.map((node) => node.id));
	const projectedNodes = snapshot.nodes
		.filter((node) => included.has(node.id))
		.map((node) => ({ ...node, isCenter: useCenter && node.id === centerNode?.id }));
	projectedNodes.sort((left, right) => {
		if (left.isCenter !== right.isCenter) return left.isCenter ? -1 : 1;
		return left.id.localeCompare(right.id);
	});
	const projectedEdges = snapshot.edges.filter((edge) => included.has(edge.sourceId) && included.has(edge.targetId));

	if (projectionMode === "contact-health") {
		projectedEdges.sort(compareContactHealthEdges);
	} else {
		projectedEdges.sort((left, right) => left.id.localeCompare(right.id));
	}

	const limited = limitGraph(projectedNodes, projectedEdges, maxNodes);
	const omittedNodes = snapshot.nodes.length - limited.nodes.length;
	const omittedEdges = snapshot.edges.length - limited.edges.length;
	return {
		nodes: limited.nodes,
		edges: limited.edges,
		diagnostics: [...snapshot.diagnostics, ...projectionDiagnostics, ...limited.diagnostics],
		hiddenNodeCount: snapshot.hiddenNodeCount + omittedNodes,
		hiddenEdgeCount: snapshot.hiddenEdgeCount + omittedEdges,
		generatedAt: snapshot.generatedAt,
	};
}

interface CenterResolution {
	node?: AtlasNode;
	diagnostic?: AtlasDiagnostic;
}

function resolveCenter(
	nodes: AtlasNode[],
	mode: ProjectGraphOptions["centerMode"],
	centerId: PersonId | undefined,
	centerPath: string | undefined,
): CenterResolution {
	if (mode === "none" || (!centerId && !centerPath)) return {};
	const candidates = nodes.filter((node) => {
		if (node.kind !== "person") return false;
		if (centerPath) return node.filePath === centerPath;
		return node.personId === centerId || (!node.personId && node.id === centerId);
	});
	if (candidates.length === 1 && candidates[0]) return { node: candidates[0] };
	if (mode !== "configured" && !centerId && !centerPath) return {};
	const requested = centerPath ?? centerId ?? "unknown";
	const ambiguous = candidates.length > 1;
	return {
		diagnostic: {
			id: `${ambiguous ? "projection-center-ambiguous" : "projection-center-unresolved"}:${requested}`,
			severity: "warning",
			code: ambiguous ? "projection-center-ambiguous" : "projection-center-unresolved",
			message: ambiguous
				? `The requested center “${requested}” matches multiple people and was not selected.`
				: `The requested center “${requested}” could not be resolved and was not selected.`,
			filePaths: candidates.flatMap((candidate) => candidate.filePath ? [candidate.filePath] : []),
		},
	};
}

function reachableNodes(edges: AtlasEdge[], centerId: NodeId, hops: number): Set<NodeId> {
	const adjacency = new Map<NodeId, Set<NodeId>>();
	for (const edge of edges) {
		if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set());
		if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set());
		adjacency.get(edge.sourceId)?.add(edge.targetId);
		adjacency.get(edge.targetId)?.add(edge.sourceId);
	}

	const included = new Set<NodeId>([centerId]);
	let frontier = new Set<NodeId>([centerId]);
	for (let depth = 0; depth < hops; depth += 1) {
		const next = new Set<NodeId>();
		for (const id of frontier) {
			for (const neighbor of adjacency.get(id) ?? []) {
				if (!included.has(neighbor)) next.add(neighbor);
				included.add(neighbor);
			}
		}
		frontier = next;
	}
	return included;
}

function limitGraph(nodes: AtlasNode[], edges: AtlasEdge[], maxNodes: number): { nodes: AtlasNode[]; edges: AtlasEdge[]; diagnostics: AtlasDiagnostic[] } {
	if (nodes.length <= maxNodes) return { nodes, edges, diagnostics: [] };
	const ordered = [...nodes].sort((left, right) => {
		if (left.isCenter !== right.isCenter) return left.isCenter ? -1 : 1;
		return left.id.localeCompare(right.id);
	});
	const limitedNodes = ordered.slice(0, maxNodes);
	const ids = new Set(limitedNodes.map((node) => node.id));
	return {
		nodes: limitedNodes,
		edges: edges.filter((edge) => ids.has(edge.sourceId) && ids.has(edge.targetId)),
		diagnostics: [{
			id: `node-limit:${maxNodes}`,
			severity: "warning",
			code: "node-limit",
			message: `The view is limited to ${maxNodes} nodes. Narrow the Base or choose a center person.`,
			filePaths: [],
		}],
	};
}

function compareContactHealthEdges(left: AtlasEdge, right: AtlasEdge): number {
	const leftDate = validDateValue(left.lastContact);
	const rightDate = validDateValue(right.lastContact);
	if (leftDate === undefined && rightDate !== undefined) return 1;
	if (leftDate !== undefined && rightDate === undefined) return -1;
	if (leftDate !== undefined && rightDate !== undefined && leftDate !== rightDate) return leftDate - rightDate;
	return left.id.localeCompare(right.id);
}

function validDateValue(value: string | undefined): number | undefined {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const timestamp = Date.parse(`${value}T00:00:00Z`);
	return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeHops(value: number | undefined): number {
	return Number.isInteger(value) && value !== undefined && value >= 0 ? value : DEFAULT_HOPS;
}

function normalizeMaxNodes(value: number | undefined): number {
	return Number.isInteger(value) && value !== undefined && value > 0 ? value : DEFAULT_MAX_NODES;
}
