import type { AtlasNode, AtlasSnapshot, NodeId } from "../domain/types";
import type { PeopleAtlasSettings } from "../settings/types";
import { Camera } from "./camera";
import { createDeterministicLayout, type LayoutPoint } from "./layout";
import { captureLayoutSnapshot, restoreLayoutSnapshot, type LayoutSnapshot } from "./layout-state";

export interface AtlasRendererCallbacks {
	onOpenNode(node: AtlasNode): void;
	onCenterNode(node: AtlasNode): void;
	onSelectNode(node: AtlasNode | undefined): void;
	onLayoutChanged?(layout: LayoutSnapshot): void;
}

interface DragState {
	pointerId: number;
	mode: "pan" | "node";
	nodeId?: NodeId | undefined;
	lastX: number;
	lastY: number;
}

const PERSON_RADIUS = 24;
const GHOST_RADIUS = 17;

export class AtlasRenderer {
	private readonly win: Window;
	private readonly canvas: HTMLCanvasElement;
	private readonly context: CanvasRenderingContext2D;
	private readonly accessibleList: HTMLUListElement;
	private readonly resizeObserver: ResizeObserver;
	private readonly camera = new Camera();
	private snapshot: AtlasSnapshot = { nodes: [], edges: [], diagnostics: [], hiddenNodeCount: 0, hiddenEdgeCount: 0, generatedAt: 0 };
	private positions = new Map<NodeId, LayoutPoint>();
	private selectedId: NodeId | undefined;
	private drag: DragState | undefined;
	private width = 1;
	private height = 1;
	private ratio = 1;
	private frame: number | undefined;
	private destroyed = false;

	constructor(
		private readonly container: HTMLElement,
		private readonly getSettings: () => PeopleAtlasSettings,
		private readonly callbacks: AtlasRendererCallbacks,
	) {
		this.win = container.ownerDocument.defaultView ?? window;
		this.canvas = container.ownerDocument.createElement("canvas");
		this.canvas.className = "people-atlas-canvas";
		this.canvas.tabIndex = 0;
		this.canvas.setAttribute("role", "application");
		this.canvas.setAttribute("aria-label", "Interactive people and relationship atlas");
		container.append(this.canvas);

		const context = this.canvas.getContext("2d");
		if (!context) throw new Error("Canvas 2D is unavailable.");
		this.context = context;

		this.accessibleList = container.ownerDocument.createElement("ul");
		this.accessibleList.className = "people-atlas-accessible-list";
		this.accessibleList.setAttribute("aria-label", "People in the current atlas");
		container.append(this.accessibleList);

		this.canvas.addEventListener("pointerdown", this.onPointerDown);
		this.canvas.addEventListener("pointermove", this.onPointerMove);
		this.canvas.addEventListener("pointerup", this.onPointerUp);
		this.canvas.addEventListener("pointercancel", this.onPointerUp);
		this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
		this.canvas.addEventListener("dblclick", this.onDoubleClick);
		this.canvas.addEventListener("keydown", this.onKeyDown);

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(container);
		this.resize();
	}

	setGraph(snapshot: AtlasSnapshot, savedLayout?: LayoutSnapshot): void {
		this.snapshot = snapshot;
		this.positions = createDeterministicLayout(snapshot);
		if (savedLayout) this.restoreLayoutSnapshot(savedLayout);
		if (this.selectedId && !snapshot.nodes.some((node) => node.id === this.selectedId)) {
			this.selectedId = undefined;
			this.callbacks.onSelectNode(undefined);
		}
		this.updateAccessibleList();
		this.requestDraw();
	}

	fitToContent(): void {
		if (this.positions.size === 0) return;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const point of this.positions.values()) {
			minX = Math.min(minX, point.x - 50);
			minY = Math.min(minY, point.y - 50);
			maxX = Math.max(maxX, point.x + 50);
			maxY = Math.max(maxY, point.y + 50);
		}
		const graphWidth = Math.max(1, maxX - minX);
		const graphHeight = Math.max(1, maxY - minY);
		this.camera.scale = Math.min(2, Math.max(0.2, Math.min((this.width - 80) / graphWidth, (this.height - 80) / graphHeight)));
		this.camera.x = this.width / 2 - ((minX + maxX) / 2) * this.camera.scale;
		this.camera.y = this.height / 2 - ((minY + maxY) / 2) * this.camera.scale;
		this.callbacks.onLayoutChanged?.(this.getLayoutSnapshot());
		this.requestDraw();
	}

	getLayoutSnapshot(): LayoutSnapshot {
		return captureLayoutSnapshot(this.positions, this.camera);
	}

	restoreLayoutSnapshot(layout: LayoutSnapshot): void {
		const restored = restoreLayoutSnapshot(layout, this.snapshot.nodes, this.positions, this.camera, this.camera.minScale, this.camera.maxScale);
		this.positions = restored.positions;
		this.camera.x = restored.camera.x;
		this.camera.y = restored.camera.y;
		this.camera.scale = restored.camera.scale;
		this.requestDraw();
	}

	destroy(): void {
		this.destroyed = true;
		this.resizeObserver.disconnect();
		if (this.frame !== undefined) this.win.cancelAnimationFrame(this.frame);
		this.canvas.removeEventListener("pointerdown", this.onPointerDown);
		this.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.canvas.removeEventListener("pointerup", this.onPointerUp);
		this.canvas.removeEventListener("pointercancel", this.onPointerUp);
		this.canvas.removeEventListener("wheel", this.onWheel);
		this.canvas.removeEventListener("dblclick", this.onDoubleClick);
		this.canvas.removeEventListener("keydown", this.onKeyDown);
		this.canvas.remove();
		this.accessibleList.remove();
	}

	private resize(): void {
		const rect = this.container.getBoundingClientRect();
		this.width = Math.max(1, rect.width);
		this.height = Math.max(1, rect.height);
		this.ratio = this.win.devicePixelRatio || 1;
		this.canvas.width = Math.round(this.width * this.ratio);
		this.canvas.height = Math.round(this.height * this.ratio);
		this.canvas.style.width = `${this.width}px`;
		this.canvas.style.height = `${this.height}px`;
		if (this.camera.x === 0 && this.camera.y === 0) this.camera.reset(this.width, this.height);
		this.requestDraw();
	}

	private requestDraw(): void {
		if (this.destroyed || this.frame !== undefined) return;
		this.frame = this.win.requestAnimationFrame(() => {
			this.frame = undefined;
			this.draw();
		});
	}

	private draw(): void {
		const style = this.win.getComputedStyle(this.container);
		const background = style.getPropertyValue("--background-primary").trim() || "#1e1e1e";
		const foreground = style.getPropertyValue("--text-normal").trim() || "#dddddd";
		const muted = style.getPropertyValue("--text-muted").trim() || "#999999";
		const border = style.getPropertyValue("--background-modifier-border").trim() || "#666666";
		const accent = style.getPropertyValue("--interactive-accent").trim() || "#7b6cd9";
		const secondary = style.getPropertyValue("--background-secondary").trim() || "#2a2a2a";

		const ctx = this.context;
		ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.save();
		ctx.translate(this.camera.x, this.camera.y);
		ctx.scale(this.camera.scale, this.camera.scale);

		ctx.strokeStyle = border;
		ctx.lineWidth = 1.25 / this.camera.scale;
		for (const edge of this.snapshot.edges) {
			const source = this.positions.get(edge.sourceId);
			const target = this.positions.get(edge.targetId);
			if (!source || !target) continue;
			ctx.setLineDash(edge.inferred ? [5, 5] : []);
			ctx.beginPath();
			ctx.moveTo(source.x, source.y);
			ctx.lineTo(target.x, target.y);
			ctx.stroke();
		}
		ctx.setLineDash([]);

		for (const node of this.snapshot.nodes) {
			const point = this.positions.get(node.id);
			if (!point) continue;
			const radius = node.kind === "ghost" ? GHOST_RADIUS : PERSON_RADIUS;
			const selected = node.id === this.selectedId;

			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
			ctx.fillStyle = node.kind === "ghost" ? background : secondary;
			ctx.fill();
			ctx.strokeStyle = selected || node.isCenter ? accent : node.kind === "ghost" ? muted : border;
			ctx.lineWidth = (selected || node.isCenter ? 3 : 2) / this.camera.scale;
			ctx.setLineDash(node.kind === "ghost" ? [4, 4] : []);
			ctx.stroke();
			ctx.setLineDash([]);

			ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
			ctx.font = `${Math.max(10, 13 / this.camera.scale)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(initials(node.label), point.x, point.y);

			if (this.getSettings().showLabels) {
				ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
				ctx.font = `${Math.max(9, 11 / this.camera.scale)}px sans-serif`;
				ctx.textBaseline = "top";
				ctx.fillText(node.label, point.x, point.y + radius + 8 / this.camera.scale);
			}
		}

		ctx.restore();
	}

	private updateAccessibleList(): void {
		this.accessibleList.replaceChildren();
		for (const node of this.snapshot.nodes) {
			const item = this.container.ownerDocument.createElement("li");
			const button = this.container.ownerDocument.createElement("button");
			button.type = "button";
			button.textContent = `${node.label}${node.kind === "ghost" ? " (unresolved)" : ""}`;
			button.addEventListener("click", () => this.selectNode(node));
			button.addEventListener("dblclick", () => this.callbacks.onOpenNode(node));
			item.append(button);
			this.accessibleList.append(item);
		}
	}

	private selectNode(node: AtlasNode | undefined): void {
		this.selectedId = node?.id;
		this.callbacks.onSelectNode(node);
		this.requestDraw();
	}

	private nodeAt(screenX: number, screenY: number): AtlasNode | undefined {
		const world = this.camera.toWorld(screenX, screenY);
		for (let index = this.snapshot.nodes.length - 1; index >= 0; index--) {
			const node = this.snapshot.nodes[index];
			if (!node) continue;
			const point = this.positions.get(node.id);
			if (!point) continue;
			const radius = node.kind === "ghost" ? GHOST_RADIUS : PERSON_RADIUS;
			if (Math.hypot(world.x - point.x, world.y - point.y) <= radius + 6) return node;
		}
		return undefined;
	}

	private pointerPosition(event: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } {
		const rect = this.canvas.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	private readonly onPointerDown = (event: PointerEvent): void => {
		const point = this.pointerPosition(event);
		const node = this.nodeAt(point.x, point.y);
		this.canvas.setPointerCapture(event.pointerId);
		this.drag = {
			pointerId: event.pointerId,
			mode: node ? "node" : "pan",
			nodeId: node?.id,
			lastX: point.x,
			lastY: point.y,
		};
		if (node) this.selectNode(node);
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (!this.drag || this.drag.pointerId !== event.pointerId) return;
		const point = this.pointerPosition(event);
		const dx = point.x - this.drag.lastX;
		const dy = point.y - this.drag.lastY;
		if (this.drag.mode === "pan") {
			this.camera.pan(dx, dy);
		} else if (this.drag.nodeId) {
			const position = this.positions.get(this.drag.nodeId);
			if (position) {
				position.x += dx / this.camera.scale;
				position.y += dy / this.camera.scale;
			}
		}
		this.drag.lastX = point.x;
		this.drag.lastY = point.y;
		this.requestDraw();
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (!this.drag || this.drag.pointerId !== event.pointerId) return;
		if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
		this.drag = undefined;
		this.callbacks.onLayoutChanged?.(this.getLayoutSnapshot());
	};

	private readonly onWheel = (event: WheelEvent): void => {
		event.preventDefault();
		const point = this.pointerPosition(event);
		this.camera.zoomAt(point.x, point.y, event.deltaY < 0 ? 1.12 : 0.88);
		this.callbacks.onLayoutChanged?.(this.getLayoutSnapshot());
		this.requestDraw();
	};

	private readonly onDoubleClick = (event: MouseEvent): void => {
		const point = this.pointerPosition(event);
		const node = this.nodeAt(point.x, point.y);
		if (!node) {
			this.fitToContent();
			return;
		}
		if (event.shiftKey) this.callbacks.onOpenNode(node);
		else this.callbacks.onCenterNode(node);
	};

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") this.selectNode(undefined);
		if (event.key === "Enter" && this.selectedId) {
			const node = this.snapshot.nodes.find((candidate) => candidate.id === this.selectedId);
			if (node) this.callbacks.onOpenNode(node);
		}
		if (event.key.toLowerCase() === "f") this.fitToContent();
	};
}

function initials(label: string): string {
	const words = label.trim().split(/\s+/).filter(Boolean);
	return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
}
