import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";
import type { AtlasSnapshot } from "../../src/domain/types";
import {
	AtlasRenderer,
	type AtlasRendererCallbacks,
	type AtlasRendererPhotoCacheStats,
} from "../../src/render/atlas-renderer";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import {
	recordPhotoAvatarCharacterization,
	type PhotoAvatarCharacterizationDriver,
	type PhotoCacheStats,
} from "../performance/photo-avatar-characterization";
import {
	generatePhotoAvatarPerformanceFixture,
	PHOTO_AVATAR_COUNT,
	type PhotoAvatarAssetFixture,
	type PhotoAvatarPerformanceFixture,
} from "../performance/photo-avatar-fixture";
import "../../styles.css";

interface DeferredImage {
	element: HTMLImageElement;
	source: string;
	released: boolean;
}

class DeferredOwningWindowImages {
	private readonly originalImage: typeof window.Image;
	private readonly nativeSourceSetter: ((this: HTMLImageElement, value: string) => void) | undefined;
	readonly images: DeferredImage[] = [];

	constructor(private readonly win: Window & typeof globalThis) {
		this.originalImage = win.Image;
		this.nativeSourceSetter = Object.getOwnPropertyDescriptor(win.HTMLImageElement.prototype, "src")?.set;
		const loader = this;
		function ControlledImage(): HTMLImageElement {
			const element = loader.win.document.createElement("img");
			Object.defineProperty(element, "src", {
				configurable: true,
				get: () => loader.images.find((image) => image.element === element)?.source ?? "",
				set: (value: string) => {
					loader.images.push({ element, source: String(value), released: false });
				},
			});
			return element;
		}
		Object.defineProperty(win, "Image", {
			configurable: true,
			writable: true,
			value: ControlledImage,
		});
	}

	async releaseAll(): Promise<void> {
		if (!this.nativeSourceSetter) throw new Error("The owning window does not expose the native image source setter.");
		await Promise.all(
			this.images.map(async (image) => {
				if (image.released) return;
				image.released = true;
				Reflect.deleteProperty(image.element, "src");
				await new Promise<void>((resolve, reject) => {
					image.element.addEventListener("load", () => resolve(), { once: true });
					image.element.addEventListener(
						"error",
						() => reject(new Error("A deterministic photo-avatar source failed to decode.")),
						{ once: true },
					);
					this.nativeSourceSetter?.call(image.element, image.source);
				});
			}),
		);
	}

	restore(): void {
		Object.defineProperty(this.win, "Image", {
			configurable: true,
			writable: true,
			value: this.originalImage,
		});
	}
}

class AnimationFrameProbe {
	private readonly originalRequest: typeof window.requestAnimationFrame;
	private readonly listeners = new Set<() => void>();
	readonly durations: number[] = [];
	executed = 0;

	constructor(private readonly win: Window & typeof globalThis) {
		this.originalRequest = win.requestAnimationFrame;
		win.requestAnimationFrame = ((callback: FrameRequestCallback): number =>
			this.originalRequest.call(win, (timestamp) => {
				const startedAt = win.performance.now();
				try {
					callback(timestamp);
				} finally {
					this.durations.push(win.performance.now() - startedAt);
					this.executed += 1;
					for (const listener of this.listeners) listener();
				}
			})) as typeof window.requestAnimationFrame;
	}

	async waitForNext(executedBefore: number): Promise<number> {
		if (this.executed <= executedBefore) {
			await new Promise<void>((resolve, reject) => {
				const timeout = this.win.setTimeout(() => {
					this.listeners.delete(listener);
					reject(new Error("Timed out waiting for an AtlasRenderer characterization frame."));
				}, 10_000);
				const listener = (): void => {
					if (this.executed <= executedBefore) return;
					this.win.clearTimeout(timeout);
					this.listeners.delete(listener);
					resolve();
				};
				this.listeners.add(listener);
			});
		}
		const duration = this.durations[this.durations.length - 1];
		if (duration === undefined) throw new Error("Characterization frame completed without a duration.");
		return duration;
	}

	async settleWindow(): Promise<void> {
		await new Promise<void>((resolve) => {
			this.originalRequest.call(this.win, () => {
				this.originalRequest.call(this.win, () => resolve());
			});
		});
	}

	restore(): void {
		this.win.requestAnimationFrame = this.originalRequest;
	}
}

function createContainer(doc: Document): HTMLDivElement {
	const container = doc.createElement("div");
	container.className = "people-atlas-graph people-atlas-photo-characterization";
	container.style.width = "960px";
	container.style.height = "640px";
	doc.body.append(container);
	return container;
}

function deterministicRasterUrl(doc: Document, asset: PhotoAvatarAssetFixture): string {
	const canvas = doc.createElement("canvas");
	canvas.width = asset.sourceWidth;
	canvas.height = asset.sourceHeight;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is unavailable for deterministic photo-avatar sources.");
	const red = (asset.paintSeed * 47 + 31) % 256;
	const green = (asset.paintSeed * 71 + 67) % 256;
	const blue = (asset.paintSeed * 97 + 103) % 256;
	context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = `rgb(${blue}, ${red}, ${green})`;
	context.fillRect(
		Math.floor(canvas.width / 4),
		Math.floor(canvas.height / 4),
		Math.floor(canvas.width / 2),
		Math.floor(canvas.height / 2),
	);
	const resourceUrl = canvas.toDataURL("image/png");
	canvas.width = 0;
	canvas.height = 0;
	return resourceUrl;
}

function resourceMap(
	doc: Document,
	fixture: PhotoAvatarPerformanceFixture,
): Map<string, { resourceUrl: string; cacheKey: string }> {
	return new Map(
		fixture.assets.map((asset) => [
			asset.path,
			{
				resourceUrl: deterministicRasterUrl(doc, asset),
				cacheKey: `${asset.path}\0${asset.revision}`,
			},
		]),
	);
}

function cacheStats(stats: Readonly<AtlasRendererPhotoCacheStats>): PhotoCacheStats {
	return {
		ready: stats.ready,
		pending: stats.pending,
		failed: stats.failed,
		total: stats.total,
		maxReady: stats.maxReady,
		maxPending: stats.maxPending,
		maxFailed: stats.maxFailed,
		maxDimension: stats.maxDimension,
		retainedPixels: stats.retainedPixels,
		destroyed: stats.destroyed,
	};
}

type FillTextSpy = MockInstance<CanvasRenderingContext2D["fillText"]>;
type DrawImageSpy = MockInstance<CanvasRenderingContext2D["drawImage"]>;

function fallbackCallCount(spy: FillTextSpy): number {
	return spy.mock.calls.filter(([value]) => value === "P0").length;
}

function thumbnailDrawCount(spy: DrawImageSpy): number {
	return spy.mock.calls.filter(([source]) => source instanceof HTMLCanvasElement).length;
}

class AtlasRendererCharacterizationDriver implements PhotoAvatarCharacterizationDriver {
	readonly evidenceClassification = "controlled-chromium";
	initialFallbacks = 0;
	initialThumbnails = 0;
	settledFallbacks = 0;
	settledThumbnails = 0;

	constructor(
		private readonly renderer: AtlasRenderer,
		private readonly loader: DeferredOwningWindowImages,
		private readonly probe: AnimationFrameProbe,
		private readonly fillText: FillTextSpy,
		private readonly drawImage: DrawImageSpy,
	) {}

	async paintInitial(snapshot: AtlasSnapshot): Promise<number> {
		this.fillText.mockClear();
		this.drawImage.mockClear();
		const executedBefore = this.probe.executed;
		this.renderer.setGraph(snapshot);
		const duration = await this.probe.waitForNext(executedBefore);
		this.initialFallbacks = fallbackCallCount(this.fillText);
		this.initialThumbnails = thumbnailDrawCount(this.drawImage);
		return duration;
	}

	async settleDecodesAndRedraw(): Promise<number> {
		await this.loader.releaseAll();
		if (this.renderer.getPhotoCacheStats().ready !== PHOTO_AVATAR_COUNT) {
			throw new Error("Controlled photo decodes did not settle the complete fixture.");
		}
		await this.probe.settleWindow();
		this.fillText.mockClear();
		this.drawImage.mockClear();
		const executedBefore = this.probe.executed;
		this.renderer.fitToContent();
		const duration = await this.probe.waitForNext(executedBefore);
		this.settledFallbacks = fallbackCallCount(this.fillText);
		this.settledThumbnails = thumbnailDrawCount(this.drawImage);
		return duration;
	}

	getPhotoCacheStats(): PhotoCacheStats {
		return cacheStats(this.renderer.getPhotoCacheStats());
	}

	destroy(): void {
		this.renderer.destroy();
	}
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("UX5 photo-avatar production characterization adapter", () => {
	it("records initials-first paint, deterministic settlement, retained pixels, and zero-entry destroy", async () => {
		const fixture = generatePhotoAvatarPerformanceFixture();
		const resources = resourceMap(document, fixture);
		const loader = new DeferredOwningWindowImages(window);
		const probe = new AnimationFrameProbe(window);
		const container = createContainer(document);
		const callbacks: AtlasRendererCallbacks = {
			onOpenNode: () => undefined,
			onCenterNode: () => undefined,
			onSelectNode: () => undefined,
			resolvePersonPhoto: (photoPath) => {
				const resource = resources.get(photoPath);
				return resource ? { status: "ready", ...resource } : { status: "missing" };
			},
		};
		const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks);
		try {
			await probe.waitForNext(0);
			await probe.settleWindow();
			const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
			const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
			const driver = new AtlasRendererCharacterizationDriver(renderer, loader, probe, fillText, drawImage);

			const record = await recordPhotoAvatarCharacterization(fixture, driver);

			expect(loader.images).toHaveLength(PHOTO_AVATAR_COUNT);
			expect(loader.images.every((image) => image.element.ownerDocument === document)).toBe(true);
			expect(driver.initialFallbacks).toBe(fixture.counts.nodes);
			expect(driver.initialThumbnails).toBe(0);
			expect(driver.settledFallbacks).toBe(fixture.counts.nodes - fixture.counts.photos);
			expect(driver.settledThumbnails).toBe(fixture.counts.photos);
			expect(record.initialPaint.cache).toMatchObject({
				ready: 0,
				pending: PHOTO_AVATAR_COUNT,
				failed: 0,
				retainedPixels: 0,
			});
			expect(record.settledRedraw.cache).toMatchObject({
				ready: PHOTO_AVATAR_COUNT,
				pending: 0,
				failed: 0,
				maxReady: 64,
				maxPending: 64,
				maxFailed: 64,
				maxDimension: 256,
				retainedPixels: PHOTO_AVATAR_COUNT * 240 * 240,
			});
			expect(record.retainedCache.cache).toEqual(record.settledRedraw.cache);
			expect(record.retainedCache.heap).toEqual({
				stage: "photo-avatar-retained-cache",
				explicitGcAvailable: false,
				kind: "missing",
				missingReason: "No CDP retained-heap provider was configured for this controlled Chromium observation.",
			});
			expect(record.afterDestroy).toMatchObject({
				ready: 0,
				pending: 0,
				failed: 0,
				total: 0,
				retainedPixels: 0,
				destroyed: true,
			});
			expect(record.evidenceBoundary).toMatchObject({
				classification: "controlled-chromium",
				thresholdsApplied: false,
				workerClaim: false,
				liveObsidianProof: false,
			});
		} finally {
			renderer.destroy();
			probe.restore();
			loader.restore();
			container.remove();
		}
	});
});
