import type { AtlasNode, NodeId } from "../domain/types";
import type { LayoutPoint } from "./layout";

export interface LayoutCamera {
	x: number;
	y: number;
	scale: number;
}

export interface LayoutSnapshot {
	positions: Record<string, LayoutPoint>;
	camera: LayoutCamera;
}

export function captureLayoutSnapshot(positions: Map<NodeId, LayoutPoint>, camera: LayoutCamera): LayoutSnapshot {
	const savedPositions: Record<string, LayoutPoint> = {};
	for (const [id, point] of positions) {
		if (Number.isFinite(point.x) && Number.isFinite(point.y)) savedPositions[id] = { x: point.x, y: point.y };
	}
	return {
		positions: savedPositions,
		camera: { ...camera },
	};
}

export function restoreLayoutSnapshot(
	snapshot: LayoutSnapshot | undefined,
	nodes: AtlasNode[],
	fallbackPositions: Map<NodeId, LayoutPoint>,
	fallbackCamera: LayoutCamera,
	minScale: number,
	maxScale: number,
): { positions: Map<NodeId, LayoutPoint>; camera: LayoutCamera } {
	const positions = new Map<NodeId, LayoutPoint>();
	for (const node of nodes) {
		const fallback = fallbackPositions.get(node.id) ?? { x: 0, y: 0 };
		const saved = snapshot?.positions[node.id];
		positions.set(
			node.id,
			saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? { x: saved.x, y: saved.y } : { ...fallback },
		);
	}
	const camera = snapshot?.camera;
	const validCamera =
		camera &&
		Number.isFinite(camera.x) &&
		Number.isFinite(camera.y) &&
		Number.isFinite(camera.scale) &&
		camera.scale >= minScale &&
		camera.scale <= maxScale;
	return {
		positions,
		camera: validCamera ? { ...camera } : { ...fallbackCamera },
	};
}
