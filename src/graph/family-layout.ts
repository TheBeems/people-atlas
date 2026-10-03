import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { AtlasSnapshot, NodeId } from "../domain/types";

export interface FamilyLayoutPoint {
	x: number;
	y: number;
}

/** Only literal paired parent/child roles establish a generation constraint. */
export function createFamilyLayout(snapshot: AtlasSnapshot): Map<NodeId, FamilyLayoutPoint> {
	const ordered = [...snapshot.nodes].sort((left, right) => left.id.localeCompare(right.id));
	const counts = new Map<NodeId, number>();
	for (const node of ordered) counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
	const canonical = new Set(
		ordered.filter((node) => isResolvedAtlasPersonNode(node) && counts.get(node.id) === 1).map((node) => node.id),
	);
	const adjacency = new Map<NodeId, Map<NodeId, number>>();
	const conflicting = new Set<NodeId>();
	for (const node of ordered) adjacency.set(node.id, new Map());
	for (const edge of snapshot.edges) {
		if (edge.inferred || !canonical.has(edge.sourceId) || !canonical.has(edge.targetId)) continue;
		const delta =
			edge.fromRole === "parent" && edge.toRole === "child"
				? 1
				: edge.fromRole === "child" && edge.toRole === "parent"
					? -1
					: undefined;
		if (delta === undefined) continue;
		for (const [from, to, change] of [
			[edge.sourceId, edge.targetId, delta],
			[edge.targetId, edge.sourceId, -delta],
		] as const) {
			const neighbors = adjacency.get(from);
			const existing = neighbors?.get(to);
			if (existing !== undefined && existing !== change) {
				conflicting.add(from);
				conflicting.add(to);
			}
			neighbors?.set(to, change);
		}
	}
	const positions = new Map<NodeId, FamilyLayoutPoint>();
	const visited = new Set<NodeId>();
	let offset = 0;
	for (const root of ordered) {
		if (visited.has(root.id)) continue;
		const generations = new Map<NodeId, number>([[root.id, 0]]);
		const queue: NodeId[] = [root.id];
		visited.add(root.id);
		let conflict = false;
		for (let index = 0; index < queue.length; index++) {
			const id = queue[index] as NodeId;
			if (conflicting.has(id)) conflict = true;
			for (const [neighbor, delta] of [...(adjacency.get(id)?.entries() ?? [])].sort(([a], [b]) =>
				a.localeCompare(b),
			)) {
				const level = (generations.get(id) ?? 0) + delta;
				if (generations.has(neighbor)) {
					if (generations.get(neighbor) !== level) conflict = true;
					continue;
				}
				generations.set(neighbor, level);
				visited.add(neighbor);
				queue.push(neighbor);
			}
		}
		const groups = new Map<number, NodeId[]>();
		const minimum = Math.min(...generations.values());
		for (const [id, generation] of generations) {
			const level = conflict ? 0 : generation - minimum;
			const ids = groups.get(level) ?? [];
			ids.push(id);
			groups.set(level, ids);
		}
		const width = Math.max(...[...groups.values()].map((ids) => ids.length)) * 180;
		for (const [level, ids] of groups) {
			ids.sort();
			ids.forEach((id, index) => {
				positions.set(id, { x: offset + (width - (ids.length - 1) * 180) / 2 + index * 180, y: level * 180 });
			});
		}
		offset += width + 180;
	}
	const middle = offset > 0 ? (offset - 180) / 2 : 0;
	for (const point of positions.values()) point.x -= middle;
	return positions;
}
