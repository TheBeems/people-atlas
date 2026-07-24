import type { AtlasSnapshot, NodeId } from "../domain/types";
import { hashFraction } from "../utils/hash";

export interface LayoutPoint {
	x: number;
	y: number;
}

export function createDeterministicLayout(snapshot: AtlasSnapshot): Map<NodeId, LayoutPoint> {
	const positions = new Map<NodeId, LayoutPoint>();
	const center = snapshot.nodes.find((node) => node.isCenter);
	if (!center) {
		const radius = Math.max(160, snapshot.nodes.length * 16);
		const ordered = [...snapshot.nodes].sort((a, b) => a.id.localeCompare(b.id));
		ordered.forEach((node, index) => {
			const angle = (index / Math.max(ordered.length, 1)) * Math.PI * 2 - Math.PI / 2;
			positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
		});
		return positions;
	}

	positions.set(center.id, { x: 0, y: 0 });
	const adjacency = new Map<NodeId, Set<NodeId>>();
	for (const edge of snapshot.edges) {
		if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set());
		if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set());
		adjacency.get(edge.sourceId)?.add(edge.targetId);
		adjacency.get(edge.targetId)?.add(edge.sourceId);
	}

	const distance = new Map<NodeId, number>([[center.id, 0]]);
	const queue: NodeId[] = [center.id];
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		const nextDistance = (distance.get(current) ?? 0) + 1;
		for (const neighbor of adjacency.get(current) ?? []) {
			if (distance.has(neighbor)) continue;
			distance.set(neighbor, nextDistance);
			queue.push(neighbor);
		}
	}

	const rings = new Map<number, NodeId[]>();
	for (const node of snapshot.nodes) {
		if (node.id === center.id) continue;
		const ring = Math.max(1, distance.get(node.id) ?? 3);
		const members = rings.get(ring) ?? [];
		members.push(node.id);
		rings.set(ring, members);
	}

	for (const [ring, ids] of rings) {
		ids.sort();
		const radius = 170 * ring;
		const offset = hashFraction(`${center.id}:${ring}`) * Math.PI * 2;
		ids.forEach((id, index) => {
			const angle = offset + (index / ids.length) * Math.PI * 2;
			positions.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
		});
	}
	return positions;
}
