import type { AtlasNode, AtlasSnapshot, NodeId } from "../domain/types";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { personPhotoInitials } from "../domain/person-photo";
import { createTranslator, type Translator } from "../i18n";
import type { PeopleAtlasSettings } from "../settings/types";
import { Camera } from "./camera";
import { captureLayoutSnapshot, restoreLayoutSnapshot, type LayoutSnapshot } from "./layout-state";
import { PERSON_PHOTO_THUMBNAIL_MAX_READY, PersonPhotoThumbnailCache } from "./person-photo-thumbnail-cache";
import { safeLocalPhotoResourceUrl, type PersonPhotoResourceResolver } from "./person-profile";
import type { LayoutPoint } from "./layout";

export interface GraphCanvasSurfaceOptions {
	container: HTMLElement;
	getSettings: () => PeopleAtlasSettings;
	getSnapshot: () => AtlasSnapshot;
	getPositions: () => Map<NodeId, LayoutPoint>;
	setPositions: (positions: Map<NodeId, LayoutPoint>) => void;
	getSelectedId: () => NodeId | undefined;
	onLayoutChanged?: (layout: LayoutSnapshot) => void;
	resolvePersonPhoto?: PersonPhotoResourceResolver;
	translator?: Translator;
}

interface CanvasPhotoRequest {
	cacheKey: string;
	resourceUrl: string;
}

export interface AtlasRendererPhotoCacheStats {
	ready: number;
	pending: number;
	failed: number;
	total: number;
	maxReady: number;
	maxPending: number;
	maxFailed: number;
	maxDimension: number;
	retainedPixels: number;
	destroyed: boolean;
	requests: number;
	loadsStarted: number;
	loadsSucceeded: number;
	loadsFailed: number;
	capacityRejections: number;
	readyEvictions: number;
}

const PERSON_RADIUS = 24;
const GHOST_RADIUS = 17;

/** Owns the canvas surface, camera, photo resources, resize loop and draw lifecycle. */
export class GraphCanvasSurface {
	readonly element: HTMLDivElement;
	readonly graphSurface: HTMLDivElement;
	readonly canvas: HTMLCanvasElement;
	readonly graphActions: HTMLDivElement;
	readonly zoomOutButton: HTMLButtonElement;
	readonly zoomInButton: HTMLButtonElement;
	readonly fitButton: HTMLButtonElement;
	readonly detailsButton: HTMLButtonElement;

	private readonly win: Window & typeof globalThis;
	private readonly doc: Document;
	private readonly options: GraphCanvasSurfaceOptions;
	private readonly t: Translator;
	private readonly context: CanvasRenderingContext2D;
	private readonly resizeObserver: ResizeObserver;
	private readonly photoThumbnailCache: PersonPhotoThumbnailCache;
	private readonly camera = new Camera();
	private width = 1;
	private height = 1;
	private ratio = 1;
	private frame: number | undefined;
	private cameraInitialized = false;
	private destroyed = false;
	private canvasPhotoRequests = new Map<NodeId, CanvasPhotoRequest>();
	private admittedCanvasPhotoKeys = new Set<string>();

	constructor(options: GraphCanvasSurfaceOptions) {
		this.options = options;
		this.t = options.translator ?? createTranslator("en");
		this.doc = options.container.ownerDocument;
		const owningWindow = this.doc.defaultView as (Window & typeof globalThis) | null;
		if (!owningWindow) throw new Error("GraphCanvasSurface requires a container with an owning window.");
		this.win = owningWindow;

		this.photoThumbnailCache = new PersonPhotoThumbnailCache({
			window: this.win,
			document: this.doc,
			onStateChange: ({ cacheKey }) => {
				if (
					this.destroyed ||
					!this.admittedCanvasPhotoKeys.has(cacheKey) ||
					![...this.canvasPhotoRequests.values()].some((request) => request.cacheKey === cacheKey)
				) {
					return;
				}
				this.requestDraw();
			},
		});

		this.graphSurface = this.doc.createElement("div");
		this.graphSurface.className = "people-atlas-graph-surface";
		this.element = this.graphSurface;
		this.canvas = this.doc.createElement("canvas");
		this.canvas.className = "people-atlas-canvas";
		this.canvas.tabIndex = 0;
		this.canvas.setAttribute("role", "application");
		this.canvas.setAttribute("aria-label", this.t.atlasRenderer.interactiveAtlas);
		this.graphActions = this.doc.createElement("div");
		this.graphActions.className = "people-atlas-graph-actions";
		this.graphActions.setAttribute("aria-label", this.t.atlasRenderer.graphControls);
		this.zoomOutButton = this.createActionButton(this.t.atlasRenderer.zoomOut);
		this.zoomInButton = this.createActionButton(this.t.atlasRenderer.zoomIn);
		this.fitButton = this.createActionButton(this.t.atlasRenderer.fit);
		this.detailsButton = this.createActionButton(this.t.atlasRenderer.details);
		this.detailsButton.disabled = true;
		this.graphActions.append(this.zoomOutButton, this.zoomInButton, this.fitButton, this.detailsButton);
		this.graphSurface.append(this.canvas, this.graphActions);

		const context = this.canvas.getContext("2d");
		if (!context) throw new Error("Canvas 2D is unavailable.");
		this.context = context;

		this.resizeObserver = new this.win.ResizeObserver(() => this.resize());
		this.resizeObserver.observe(this.graphSurface);
	}

	get cameraState(): Camera {
		return this.camera;
	}

	get isDestroyed(): boolean {
		return this.destroyed;
	}

	setDetailsDisabled(disabled: boolean): void {
		this.detailsButton.disabled = disabled;
	}

	refresh(): void {
		if (this.destroyed) return;
		this.reconcileCanvasPhotoRequests();
		this.reconcileCanvasPhotoAdmission();
		this.requestDraw();
	}

	refreshPhotoAdmission(): void {
		if (this.destroyed) return;
		this.reconcileCanvasPhotoAdmission();
		this.requestDraw();
	}

	fitToContent(): void {
		const positions = this.options.getPositions();
		if (positions.size === 0) return;
		const previous = this.cameraSnapshot();
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const point of positions.values()) {
			minX = Math.min(minX, point.x - 50);
			minY = Math.min(minY, point.y - 50);
			maxX = Math.max(maxX, point.x + 50);
			maxY = Math.max(maxY, point.y + 50);
		}
		const graphWidth = Math.max(1, maxX - minX);
		const graphHeight = Math.max(1, maxY - minY);
		this.camera.scale = Math.min(
			2,
			Math.max(0.2, Math.min((this.width - 80) / graphWidth, (this.height - 80) / graphHeight)),
		);
		this.camera.x = this.width / 2 - ((minX + maxX) / 2) * this.camera.scale;
		this.camera.y = this.height / 2 - ((minY + maxY) / 2) * this.camera.scale;
		this.cameraInitialized = true;
		this.persistCameraChange(previous);
		this.requestDraw();
	}

	getLayoutSnapshot(): LayoutSnapshot {
		return captureLayoutSnapshot(this.options.getPositions(), this.camera);
	}

	getPhotoCacheStats(): Readonly<AtlasRendererPhotoCacheStats> {
		const stats = this.photoThumbnailCache.stats();
		return Object.freeze({
			ready: stats.ready,
			pending: stats.pending,
			failed: stats.failures,
			total: stats.ready + stats.pending + stats.failures,
			maxReady: stats.maxReady,
			maxPending: stats.maxPending,
			maxFailed: stats.maxFailures,
			maxDimension: stats.maxDimension,
			retainedPixels: stats.retainedPixels,
			destroyed: stats.destroyed,
			requests: stats.requests,
			loadsStarted: stats.loadsStarted,
			loadsSucceeded: stats.loadsSucceeded,
			loadsFailed: stats.loadsFailed,
			capacityRejections: stats.capacityRejections,
			readyEvictions: stats.readyEvictions,
		});
	}

	restoreLayoutSnapshot(layout: LayoutSnapshot): void {
		const restored = restoreLayoutSnapshot(
			layout,
			this.options.getSnapshot().nodes,
			this.options.getPositions(),
			this.camera,
			this.camera.minScale,
			this.camera.maxScale,
		);
		this.options.setPositions(restored.positions);
		this.camera.x = restored.camera.x;
		this.camera.y = restored.camera.y;
		this.camera.scale = restored.camera.scale;
		this.cameraInitialized = true;
		this.requestDraw();
	}

	cameraSnapshot(): { x: number; y: number; scale: number } {
		return { x: this.camera.x, y: this.camera.y, scale: this.camera.scale };
	}

	zoomAtCanvasCenter(factor: number): void {
		const previous = this.cameraSnapshot();
		this.camera.zoomAt(this.width / 2, this.height / 2, factor);
		this.persistCameraChange(previous);
		this.requestDraw();
	}

	zoomAt(x: number, y: number, factor: number): void {
		this.camera.zoomAt(x, y, factor);
		this.options.onLayoutChanged?.(this.getLayoutSnapshot());
		this.requestDraw();
	}

	pan(dx: number, dy: number): void {
		this.camera.pan(dx, dy);
		this.requestDraw();
	}

	moveNode(nodeId: NodeId, dx: number, dy: number): void {
		const position = this.options.getPositions().get(nodeId);
		if (!position) return;
		position.x += dx / this.camera.scale;
		position.y += dy / this.camera.scale;
		this.requestDraw();
	}

	nodeAt(screenX: number, screenY: number): AtlasNode | undefined {
		if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return undefined;
		const world = this.camera.toWorld(screenX, screenY);
		const snapshot = this.options.getSnapshot();
		const positions = this.options.getPositions();
		for (let index = snapshot.nodes.length - 1; index >= 0; index--) {
			const node = snapshot.nodes[index];
			if (!node) continue;
			const point = positions.get(node.id);
			if (!point) continue;
			const radius = node.kind === "ghost" ? GHOST_RADIUS : PERSON_RADIUS;
			if (Math.hypot(world.x - point.x, world.y - point.y) <= radius + 6) return node;
		}
		return undefined;
	}

	pointerPosition(event: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } | undefined {
		if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return undefined;
		const rect = this.canvas.getBoundingClientRect();
		const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
		return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : undefined;
	}

	capturePointer(pointerId: number): void {
		try {
			this.canvas.setPointerCapture(pointerId);
		} catch {
			// Stable pointer tracking does not depend on browser capture succeeding.
		}
	}

	releasePointer(pointerId: number): void {
		let shouldRelease = true;
		try {
			shouldRelease = this.canvas.hasPointerCapture(pointerId);
		} catch {
			// Attempt release anyway; the browser may have lost only the query state.
		}
		if (!shouldRelease) return;
		try {
			this.canvas.releasePointerCapture(pointerId);
		} catch {
			// Capture can be lost implicitly before renderer cleanup.
		}
	}

	requestDraw(): void {
		if (this.destroyed || this.frame !== undefined) return;
		this.frame = this.win.requestAnimationFrame(() => {
			this.frame = undefined;
			this.draw();
		});
	}

	resize(): void {
		const rect = this.graphSurface.getBoundingClientRect();
		this.width = Math.max(1, rect.width);
		this.height = Math.max(1, rect.height);
		this.ratio = this.win.devicePixelRatio || 1;
		this.canvas.width = Math.round(this.width * this.ratio);
		this.canvas.height = Math.round(this.height * this.ratio);
		// Keep the CSS-pixel surface and high-DPI backing store synchronized, including at fractional DPR.
		this.canvas.style.width = `${this.width}px`;
		this.canvas.style.height = `${this.height}px`;
		if (!this.cameraInitialized) {
			this.camera.reset(this.width, this.height);
			this.cameraInitialized = true;
		}
		this.requestDraw();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.resizeObserver.disconnect();
		if (this.frame !== undefined) this.win.cancelAnimationFrame(this.frame);
		this.frame = undefined;
		this.photoThumbnailCache.destroy();
		this.canvasPhotoRequests.clear();
		this.admittedCanvasPhotoKeys.clear();
		this.element.remove();
	}

	private createActionButton(label: string): HTMLButtonElement {
		const button = this.doc.createElement("button");
		button.type = "button";
		button.textContent = label;
		button.setAttribute("aria-label", label);
		return button;
	}

	private draw(): void {
		const style = this.win.getComputedStyle(this.options.container);
		const background = style.getPropertyValue("--background-primary").trim() || "Canvas";
		const foreground = style.getPropertyValue("--text-normal").trim() || "CanvasText";
		const muted = style.getPropertyValue("--text-muted").trim() || "GrayText";
		const border = style.getPropertyValue("--background-modifier-border").trim() || "GrayText";
		const accent = style.getPropertyValue("--interactive-accent").trim() || "Highlight";
		const secondary = style.getPropertyValue("--background-secondary").trim() || "Canvas";
		const snapshot = this.options.getSnapshot();
		const positions = this.options.getPositions();
		const ctx = this.context;

		ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.save();
		ctx.translate(this.camera.x, this.camera.y);
		ctx.scale(this.camera.scale, this.camera.scale);

		ctx.strokeStyle = border;
		ctx.lineWidth = 1.25 / this.camera.scale;
		for (const edge of snapshot.edges) {
			const source = positions.get(edge.sourceId);
			const target = positions.get(edge.targetId);
			if (!source || !target) continue;
			ctx.setLineDash(edge.inferred ? [5, 5] : []);
			ctx.beginPath();
			ctx.moveTo(source.x, source.y);
			ctx.lineTo(target.x, target.y);
			ctx.stroke();
		}
		ctx.setLineDash([]);

		for (const node of snapshot.nodes) {
			const point = positions.get(node.id);
			if (!point) continue;
			const radius = node.kind === "ghost" ? GHOST_RADIUS : PERSON_RADIUS;
			const selected = node.id === this.options.getSelectedId();

			ctx.beginPath();
			ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
			ctx.fillStyle = node.kind === "ghost" ? background : secondary;
			ctx.fill();

			let photoDrawn = false;
			const photoRequest = this.canvasPhotoRequests.get(node.id);
			if (photoRequest && this.admittedCanvasPhotoKeys.has(photoRequest.cacheKey)) {
				const state = this.photoThumbnailCache.get(photoRequest);
				if (state.status === "ready") {
					ctx.save();
					try {
						ctx.beginPath();
						ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
						ctx.clip();
						ctx.drawImage(state.thumbnail.source, point.x - radius, point.y - radius, radius * 2, radius * 2);
						photoDrawn = true;
					} catch {
						// A released or browser-rejected source remains a deterministic initials fallback.
					} finally {
						ctx.restore();
					}
				}
			}

			ctx.strokeStyle = selected || node.isCenter ? accent : node.kind === "ghost" ? muted : border;
			ctx.lineWidth = (selected || node.isCenter ? 3 : 2) / this.camera.scale;
			ctx.setLineDash(node.kind === "ghost" ? [4, 4] : []);
			ctx.stroke();
			ctx.setLineDash([]);

			if (!photoDrawn) {
				ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
				ctx.font = `${Math.max(10, 13 / this.camera.scale)}px sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(personPhotoInitials(node.label), point.x, point.y);
			}

			if (this.options.getSettings().showLabels) {
				ctx.fillStyle = node.kind === "ghost" ? muted : foreground;
				ctx.font = `${Math.max(9, 11 / this.camera.scale)}px sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				ctx.fillText(node.label, point.x, point.y + radius + 8 / this.camera.scale);
			}
		}
		ctx.restore();
	}

	private reconcileCanvasPhotoRequests(): void {
		const previousKeys = new Set([...this.canvasPhotoRequests.values()].map((request) => request.cacheKey));
		const nextRequests = new Map<NodeId, CanvasPhotoRequest>();
		for (const node of this.options.getSnapshot().nodes) {
			if (!isResolvedAtlasPersonNode(node) || !node.photoPath || !this.options.resolvePersonPhoto) continue;
			try {
				const resolution = this.options.resolvePersonPhoto(node.photoPath);
				if (resolution.status !== "ready") continue;
				const resourceUrl = safeLocalPhotoResourceUrl(resolution.resourceUrl, node.photoPath);
				if (!resourceUrl || !resolution.cacheKey.trim()) continue;
				nextRequests.set(node.id, { cacheKey: resolution.cacheKey, resourceUrl });
			} catch {
				// Resolver failures are contained as initials fallback.
			}
		}
		const nextKeys = new Set([...nextRequests.values()].map((request) => request.cacheKey));
		this.photoThumbnailCache.invalidate([...previousKeys].filter((cacheKey) => !nextKeys.has(cacheKey)));
		this.canvasPhotoRequests = nextRequests;
	}

	private reconcileCanvasPhotoAdmission(): void {
		const selectedId = this.options.getSelectedId();
		const orderedNodes = [...this.options.getSnapshot().nodes].sort((left, right) => {
			const leftSelected = left.id === selectedId ? 1 : 0;
			const rightSelected = right.id === selectedId ? 1 : 0;
			if (leftSelected !== rightSelected) return rightSelected - leftSelected;
			const leftCenter = left.isCenter ? 1 : 0;
			const rightCenter = right.isCenter ? 1 : 0;
			return rightCenter - leftCenter;
		});
		const nextKeys = new Set<string>();
		for (const node of orderedNodes) {
			const request = this.canvasPhotoRequests.get(node.id);
			if (!request || nextKeys.has(request.cacheKey)) continue;
			nextKeys.add(request.cacheKey);
			if (nextKeys.size >= PERSON_PHOTO_THUMBNAIL_MAX_READY) break;
		}
		this.photoThumbnailCache.invalidate(
			[...this.admittedCanvasPhotoKeys].filter((cacheKey) => !nextKeys.has(cacheKey)),
		);
		this.admittedCanvasPhotoKeys = nextKeys;
	}

	private persistCameraChange(previous: { x: number; y: number; scale: number }): void {
		if (previous.x === this.camera.x && previous.y === this.camera.y && previous.scale === this.camera.scale) return;
		this.options.onLayoutChanged?.(this.getLayoutSnapshot());
	}
}
