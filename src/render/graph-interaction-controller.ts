import type { AtlasNode, AtlasSnapshot, NodeId } from "../domain/types";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { LayoutSnapshot } from "./layout-state";
import type { GraphCanvasSurface } from "./graph-canvas-surface";
import { TouchGestureController, type TouchGestureUpdate } from "./touch-gesture";

export type GraphInteractionMode = "graph" | "list" | "follow-ups";

export interface GraphInteractionControllerOptions {
	surface: GraphCanvasSurface;
	getSnapshot: () => AtlasSnapshot;
	getSelectedId: () => NodeId | undefined;
	getMode: () => GraphInteractionMode;
	selectNode: (node: AtlasNode | undefined) => void;
	onOpenNode: (node: AtlasNode) => void;
	onCenterNode: (node: AtlasNode) => void;
	onLayoutChanged?: (layout: LayoutSnapshot) => void;
	fitToContent: () => void;
	openDetailsSheet: () => void;
}

const LONG_PRESS_DELAY = 500;

/** Owns graph pointer, touch, pen, wheel and keyboard interaction lifecycle. */
export class GraphInteractionController {
	private readonly win: Window & typeof globalThis;
	private readonly surface: GraphCanvasSurface;
	private readonly options: GraphInteractionControllerOptions;
	private readonly touchGesture = new TouchGestureController(0.2, 4);
	private drag:
		| {
				pointerId: number;
				mode: "pan" | "node";
				nodeId?: NodeId | undefined;
				lastX: number;
				lastY: number;
		  }
		| undefined;
	private longPressTimer: number | undefined;
	private suppressMouseUntil = 0;
	private attached = false;
	private destroyed = false;

	constructor(options: GraphInteractionControllerOptions) {
		this.options = options;
		this.surface = options.surface;
		const owningWindow = this.surface.canvas.ownerDocument.defaultView as (Window & typeof globalThis) | null;
		if (!owningWindow) throw new Error("GraphInteractionController requires a surface with an owning window.");
		this.win = owningWindow;
	}

	attach(): void {
		if (this.attached || this.destroyed) return;
		this.attached = true;
		this.surface.canvas.addEventListener("pointerdown", this.onPointerDown);
		this.surface.canvas.addEventListener("pointermove", this.onPointerMove);
		this.surface.canvas.addEventListener("pointerup", this.onPointerUp);
		this.surface.canvas.addEventListener("pointercancel", this.onPointerCancel);
		this.surface.canvas.addEventListener("wheel", this.onWheel, { passive: false });
		this.surface.canvas.addEventListener("dblclick", this.onDoubleClick);
		this.surface.canvas.addEventListener("keydown", this.onCanvasKeyDown);
	}

	cancel(): void {
		this.cancelLongPress();
		for (const pointerId of this.touchGesture.cancel()) this.surface.releasePointer(pointerId);
		if (this.drag) {
			this.surface.releasePointer(this.drag.pointerId);
			this.drag = undefined;
		}
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.cancel();
		this.surface.canvas.removeEventListener("pointerdown", this.onPointerDown);
		this.surface.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.surface.canvas.removeEventListener("pointerup", this.onPointerUp);
		this.surface.canvas.removeEventListener("pointercancel", this.onPointerCancel);
		this.surface.canvas.removeEventListener("wheel", this.onWheel);
		this.surface.canvas.removeEventListener("dblclick", this.onDoubleClick);
		this.surface.canvas.removeEventListener("keydown", this.onCanvasKeyDown);
		this.attached = false;
	}

	handlePointerDown(event: PointerEvent): void {
		this.onPointerDown(event);
	}

	handlePointerMove(event: PointerEvent): void {
		this.onPointerMove(event);
	}

	handlePointerUp(event: PointerEvent): void {
		this.onPointerUp(event);
	}

	handlePointerCancel(event: PointerEvent): void {
		this.onPointerCancel(event);
	}

	private applyTouchUpdate(update: TouchGestureUpdate): void {
		if (update.cancelLongPress) this.cancelLongPress();
		if (update.camera) {
			const camera = this.surface.cameraState;
			camera.x = update.camera.x;
			camera.y = update.camera.y;
			camera.scale = update.camera.scale;
			this.surface.requestDraw();
		}
		if (update.tapTargetId !== undefined) {
			const node = update.tapTargetId === null ? undefined : this.nodeById(update.tapTargetId);
			this.options.selectNode(node);
		}
		if (update.persistLayout) this.options.onLayoutChanged?.(this.surface.getLayoutSnapshot());
	}

	private scheduleLongPress(pointerId: number): void {
		this.cancelLongPress();
		this.longPressTimer = this.win.setTimeout(() => {
			this.longPressTimer = undefined;
			if (this.destroyed || this.options.getMode() !== "graph") return;
			const nodeId = this.touchGesture.consumeLongPress(pointerId);
			const node = nodeId ? this.nodeById(nodeId) : undefined;
			if (!node) return;
			this.options.selectNode(node);
			if (!this.destroyed && this.options.getSelectedId() === node.id && this.nodeById(node.id)) {
				this.options.openDetailsSheet();
			}
		}, LONG_PRESS_DELAY);
	}

	private cancelLongPress(): void {
		if (this.longPressTimer === undefined) return;
		this.win.clearTimeout(this.longPressTimer);
		this.longPressTimer = undefined;
	}

	private nodeById(nodeId: NodeId | string): AtlasNode | undefined {
		return this.options.getSnapshot().nodes.find((node) => node.id === nodeId);
	}

	private readonly onPointerDown = (event: PointerEvent): void => {
		const point = this.surface.pointerPosition(event);
		if (!point) return;
		const node = this.surface.nodeAt(point.x, point.y);
		this.surface.capturePointer(event.pointerId);
		if (event.pointerType === "touch") {
			event.preventDefault();
			this.suppressMouseUntil = this.win.performance.now() + 1000;
			const camera = this.surface.cameraSnapshot();
			const update = this.touchGesture.begin(
				{
					pointerId: event.pointerId,
					x: point.x,
					y: point.y,
					time: event.timeStamp,
					targetId: node?.id,
				},
				camera,
			);
			this.applyTouchUpdate(update);
			if (!update.cancelLongPress && node) this.scheduleLongPress(event.pointerId);
			return;
		}
		this.drag = {
			pointerId: event.pointerId,
			mode: node ? "node" : "pan",
			nodeId: node?.id,
			lastX: point.x,
			lastY: point.y,
		};
		if (node) this.options.selectNode(node);
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			event.preventDefault();
			const point = this.surface.pointerPosition(event);
			if (!point) return;
			this.applyTouchUpdate(this.touchGesture.move(event.pointerId, point));
			return;
		}
		if (!this.drag || this.drag.pointerId !== event.pointerId) return;
		const point = this.surface.pointerPosition(event);
		if (!point) return;
		const dx = point.x - this.drag.lastX;
		const dy = point.y - this.drag.lastY;
		if (this.drag.mode === "pan") this.surface.pan(dx, dy);
		else if (this.drag.nodeId) this.surface.moveNode(this.drag.nodeId, dx, dy);
		this.drag.lastX = point.x;
		this.drag.lastY = point.y;
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			event.preventDefault();
			const point = this.surface.pointerPosition(event);
			if (!point) {
				this.cancel();
				return;
			}
			const update = this.touchGesture.end(event.pointerId, point, event.timeStamp);
			this.surface.releasePointer(event.pointerId);
			this.applyTouchUpdate(update);
			return;
		}
		if (!this.drag || this.drag.pointerId !== event.pointerId) return;
		this.surface.releasePointer(event.pointerId);
		this.drag = undefined;
		this.options.onLayoutChanged?.(this.surface.getLayoutSnapshot());
	};

	private readonly onPointerCancel = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			this.cancel();
			return;
		}
		this.onPointerUp(event);
	};

	private readonly onWheel = (event: WheelEvent): void => {
		event.preventDefault();
		const point = this.surface.pointerPosition(event);
		if (!point) return;
		this.surface.zoomAt(point.x, point.y, event.deltaY < 0 ? 1.12 : 0.88);
	};

	private readonly onDoubleClick = (event: MouseEvent): void => {
		if (this.win.performance.now() < this.suppressMouseUntil) return;
		const point = this.surface.pointerPosition(event);
		if (!point) return;
		const node = this.surface.nodeAt(point.x, point.y);
		if (!node) {
			this.options.fitToContent();
			return;
		}
		if (!isResolvedAtlasPersonNode(node)) return;
		if (event.shiftKey) this.options.onOpenNode(node);
		else this.options.onCenterNode(node);
	};

	private readonly onCanvasKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") this.options.selectNode(undefined);
		if (event.key === "Enter") {
			const selectedId = this.options.getSelectedId();
			const node = selectedId ? this.nodeById(selectedId) : undefined;
			if (isResolvedAtlasPersonNode(node)) this.options.onOpenNode(node);
		}
		if (event.key.toLowerCase() === "f") this.options.fitToContent();
	};
}
