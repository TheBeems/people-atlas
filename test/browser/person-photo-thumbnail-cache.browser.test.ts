import { afterEach, describe, expect, it, vi } from "vitest";
import {
	PersonPhotoThumbnailCache,
	type PersonPhotoThumbnailState,
} from "../../src/render/person-photo-thumbnail-cache";

interface FrameHost {
	frame: HTMLIFrameElement;
	window: Window & typeof globalThis;
	document: Document;
}

function createFrameHost(): FrameHost {
	const frame = document.createElement("iframe");
	document.body.append(frame);
	const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
	const frameDocument = frame.contentDocument;
	if (!frameWindow || !frameDocument) throw new Error("Expected an iframe owning Window and Document.");
	return { frame, window: frameWindow, document: frameDocument };
}

function wideRasterDataUrl(document: Document): string {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 256;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is unavailable.");
	context.fillStyle = "rgb(255, 0, 0)";
	context.fillRect(0, 0, 128, 256);
	context.fillStyle = "rgb(0, 255, 0)";
	context.fillRect(128, 0, 256, 256);
	context.fillStyle = "rgb(0, 0, 255)";
	context.fillRect(384, 0, 128, 256);
	return canvas.toDataURL("image/png");
}

async function waitForReady(
	cache: PersonPhotoThumbnailCache,
	cacheKey: string,
	resourceUrl: string,
): Promise<Extract<PersonPhotoThumbnailState, { status: "ready" }>> {
	await vi.waitFor(() => {
		expect(cache.get({ cacheKey, resourceUrl }).status).toBe("ready");
	});
	const state = cache.get({ cacheKey, resourceUrl });
	if (state.status !== "ready") throw new Error("Expected a ready thumbnail.");
	return state;
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("person photo thumbnail cache in Chromium", () => {
	it("decodes asynchronously in the supplied window and retains a bounded owning-document center crop", async () => {
		const host = createFrameHost();
		const resourceUrl = wideRasterDataUrl(host.document);
		const createdImages: HTMLImageElement[] = [];
		const NativeImage = host.window.Image;
		function TrackingImage(): HTMLImageElement {
			const image = new NativeImage();
			createdImages.push(image);
			return image;
		}
		Object.defineProperty(host.window, "Image", {
			configurable: true,
			value: TrackingImage,
		});
		const onStateChange = vi.fn();
		const cache = new PersonPhotoThumbnailCache({
			window: host.window,
			document: host.document,
			onStateChange,
		});
		const cacheKey = "Assets/Wide portrait.png\u000042:4096";

		expect(cache.get({ cacheKey, resourceUrl })).toEqual({ status: "pending" });
		expect(cache.stats()).toMatchObject({ ready: 0, pending: 1, retainedPixels: 0 });
		const ready = await waitForReady(cache, cacheKey, resourceUrl);

		expect(createdImages).toHaveLength(1);
		expect(createdImages[0]?.ownerDocument).toBe(host.document);
		expect(createdImages[0]?.hasAttribute("src")).toBe(false);
		expect(ready.thumbnail.source.ownerDocument).toBe(host.document);
		expect(ready.thumbnail).toMatchObject({ width: 256, height: 256 });
		const context = ready.thumbnail.source.getContext("2d");
		const center = context?.getImageData(128, 128, 1, 1).data;
		expect(center?.[0]).toBeLessThan(10);
		expect(center?.[1]).toBeGreaterThan(245);
		expect(center?.[2]).toBeLessThan(10);
		expect(cache.stats()).toMatchObject({
			ready: 1,
			pending: 0,
			retainedPixels: 256 * 256,
			maxDimension: 256,
			loadsStarted: 1,
			loadsSucceeded: 1,
		});
		expect(cache.stats().retainedPixels).toBeLessThanOrEqual(cache.stats().ready * cache.stats().maxDimension ** 2);
		expect(onStateChange).toHaveBeenCalledWith({ cacheKey, status: "ready" });

		cache.destroy();
		expect(ready.thumbnail.source).toMatchObject({ width: 0, height: 0 });
		expect(cache.stats()).toMatchObject({ ready: 0, retainedPixels: 0, destroyed: true });
	});

	it("does not share image or canvas objects between owning windows and contains corrupt input", async () => {
		const first = createFrameHost();
		const second = createFrameHost();
		const resourceUrl = wideRasterDataUrl(first.document);
		const firstCache = new PersonPhotoThumbnailCache({
			window: first.window,
			document: first.document,
		});
		const secondCache = new PersonPhotoThumbnailCache({
			window: second.window,
			document: second.document,
		});
		const request = {
			cacheKey: "Assets/Alice.png\u00007:9",
			resourceUrl,
		};

		expect(firstCache.get(request).status).toBe("pending");
		expect(secondCache.get(request).status).toBe("pending");
		const firstReady = await waitForReady(firstCache, request.cacheKey, resourceUrl);
		const secondReady = await waitForReady(secondCache, request.cacheKey, resourceUrl);
		expect(firstReady.thumbnail.source).not.toBe(secondReady.thumbnail.source);
		expect(firstReady.thumbnail.source.ownerDocument).toBe(first.document);
		expect(secondReady.thumbnail.source.ownerDocument).toBe(second.document);

		const corruptKey = "Assets/Corrupt.png\u00008:10";
		const corruptUrl = "data:image/png;base64,not-a-valid-image";
		expect(firstCache.get({ cacheKey: corruptKey, resourceUrl: corruptUrl }).status).toBe("pending");
		await vi.waitFor(() => {
			expect(firstCache.get({ cacheKey: corruptKey, resourceUrl: corruptUrl }).status).toBe("error");
		});
		expect(firstCache.stats()).toMatchObject({ failures: 1, loadsFailed: 1 });

		firstCache.destroy();
		secondCache.destroy();
	});
});
