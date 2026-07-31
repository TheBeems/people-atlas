import { describe, expect, it, vi } from "vitest";
import {
	PersonPhotoThumbnailCache,
	type PersonPhotoThumbnailRequest,
} from "../src/render/person-photo-thumbnail-cache";

type ImageHandler = (() => void) | null;

class FakeImage {
	decoding = "";
	naturalWidth = 800;
	naturalHeight = 400;
	onload: ImageHandler = null;
	onerror: ImageHandler = null;
	src = "";
	sourceRemoved = false;

	removeAttribute(name: string): void {
		if (name !== "src") return;
		this.src = "";
		this.sourceRemoved = true;
	}

	triggerLoad(): void {
		this.onload?.();
	}

	triggerError(): void {
		this.onerror?.();
	}
}

class FakeCanvas {
	width = 0;
	height = 0;
	readonly context = {
		imageSmoothingEnabled: false,
		imageSmoothingQuality: "low",
		drawImage: vi.fn(),
	};

	constructor(readonly ownerDocument: FakeDocument) {}

	getContext(kind: string): typeof this.context | null {
		return kind === "2d" ? this.context : null;
	}
}

class FakeDocument {
	readonly canvases: FakeCanvas[] = [];

	constructor(readonly defaultView: object) {}

	createElement(name: string): FakeCanvas {
		if (name !== "canvas") throw new Error(`Unexpected element: ${name}`);
		const canvas = new FakeCanvas(this);
		this.canvases.push(canvas);
		return canvas;
	}
}

function createOwningHost(): {
	window: Window & typeof globalThis;
	document: Document;
	images: FakeImage[];
	canvases: FakeCanvas[];
} {
	const images: FakeImage[] = [];
	class OwningImage extends FakeImage {
		constructor() {
			super();
			images.push(this);
		}
	}
	const owningWindow = { Image: OwningImage };
	const owningDocument = new FakeDocument(owningWindow);
	return {
		window: owningWindow as unknown as Window & typeof globalThis,
		document: owningDocument as unknown as Document,
		images,
		canvases: owningDocument.canvases,
	};
}

function request(cacheKey: string): PersonPhotoThumbnailRequest {
	return {
		cacheKey,
		resourceUrl: `app://people-atlas/${encodeURIComponent(cacheKey)}`,
	};
}

describe("person photo thumbnail cache", () => {
	it("returns pending immediately, deduplicates loads and retains only an owning-document center crop", () => {
		const host = createOwningHost();
		const onStateChange = vi.fn();
		const cache = new PersonPhotoThumbnailCache({
			window: host.window,
			document: host.document,
			onStateChange,
		});
		const asset = request("Assets/Alice.jpg\u000042:2048");

		expect(cache.get(asset)).toEqual({ status: "pending" });
		expect(cache.get(asset)).toEqual({ status: "pending" });
		expect(host.images).toHaveLength(1);
		expect(cache.stats()).toMatchObject({
			ready: 0,
			pending: 1,
			loadsStarted: 1,
			requests: 2,
			maxReady: 64,
			maxDimension: 256,
		});

		host.images[0]?.triggerLoad();

		const ready = cache.get(asset);
		expect(ready.status).toBe("ready");
		if (ready.status !== "ready") throw new Error("Expected a ready thumbnail.");
		expect(ready.thumbnail).toMatchObject({ width: 256, height: 256 });
		expect((ready.thumbnail.source as unknown as FakeCanvas).ownerDocument).toBe(
			host.document as unknown as FakeDocument,
		);
		expect(host.canvases[0]?.context.drawImage).toHaveBeenCalledWith(host.images[0], 200, 0, 400, 400, 0, 0, 256, 256);
		expect(host.images[0]).toMatchObject({
			onload: null,
			onerror: null,
			sourceRemoved: true,
		});
		expect(onStateChange).toHaveBeenCalledWith({ cacheKey: asset.cacheKey, status: "ready" });
		expect(cache.stats()).toMatchObject({
			ready: 1,
			pending: 0,
			loadsSucceeded: 1,
			retainedPixels: 256 * 256,
		});
	});

	it("rejects over-capacity requests without replacing active work and supports explicit ready LRU eviction", () => {
		const host = createOwningHost();
		const cache = new PersonPhotoThumbnailCache({
			window: host.window,
			document: host.document,
			limits: { maxReady: 2, maxPending: 2, maxFailures: 2, maxDimension: 128 },
		});
		const alice = request("Assets/Alice.jpg\u00001:1");
		const bob = request("Assets/Bob.jpg\u00001:1");
		const carol = request("Assets/Carol.jpg\u00001:1");

		expect(cache.get(alice).status).toBe("pending");
		expect(cache.get(bob).status).toBe("pending");
		expect(cache.get(carol).status).toBe("error");
		expect(cache.get(carol).status).toBe("error");
		expect(host.images).toHaveLength(2);
		expect(cache.stats()).toMatchObject({
			pending: 2,
			capacityRejections: 2,
			maxReady: 2,
			maxPending: 2,
			maxFailures: 2,
			maxDimension: 128,
		});

		host.images[0]?.triggerLoad();
		host.images[1]?.triggerLoad();
		expect(cache.get(alice).status).toBe("ready");
		const bobReady = cache.get(bob);
		if (bobReady.status !== "ready") throw new Error("Expected Bob's ready thumbnail.");
		expect(cache.get(alice).status).toBe("ready");

		expect(cache.evictLeastRecentlyUsedReady()).toEqual([bob.cacheKey]);
		expect(bobReady.thumbnail.source.width).toBe(0);
		expect(cache.get(carol).status).toBe("pending");
		expect(host.images).toHaveLength(3);
		host.images[2]?.triggerLoad();
		expect(cache.stats()).toMatchObject({
			ready: 2,
			pending: 0,
			readyEvictions: 1,
			loadsStarted: 3,
			retainedPixels: 2 * 128 * 128,
		});
		expect(cache.stats().retainedPixels).toBeLessThanOrEqual(cache.stats().ready * cache.stats().maxDimension ** 2);
	});

	it("bounds failures and stops new load attempts until an exact failure is invalidated", () => {
		const host = createOwningHost();
		const cache = new PersonPhotoThumbnailCache({
			window: host.window,
			document: host.document,
			limits: { maxReady: 4, maxPending: 4, maxFailures: 2 },
		});
		const alice = request("Assets/Alice.jpg\u00001:1");
		const bob = request("Assets/Bob.jpg\u00001:1");
		const carol = request("Assets/Carol.jpg\u00001:1");

		cache.get(alice);
		cache.get(bob);
		host.images[0]?.triggerError();
		host.images[1]?.triggerError();
		expect(cache.stats()).toMatchObject({ failures: 2, loadsFailed: 2 });

		expect(cache.get(carol).status).toBe("error");
		expect(cache.get(carol).status).toBe("error");
		expect(host.images).toHaveLength(2);
		expect(cache.stats().capacityRejections).toBe(2);

		expect(cache.invalidate(alice.cacheKey)).toBe(1);
		expect(cache.get(carol).status).toBe("pending");
		expect(host.images).toHaveLength(3);
		host.images[2]?.triggerError();
		expect(cache.stats()).toMatchObject({ failures: 2, loadsFailed: 3 });
	});

	it("invalidates exact revisions and ignores deleted or rapidly replaced late completions", () => {
		const host = createOwningHost();
		const onStateChange = vi.fn();
		const cache = new PersonPhotoThumbnailCache({
			window: host.window,
			document: host.document,
			onStateChange,
		});
		const oldRevision = request("Assets/Alice.jpg\u00001:10");
		const newRevision = request("Assets/Alice.jpg\u00002:11");
		cache.get(oldRevision);
		const lateLoad = host.images[0]?.onload;

		expect(cache.invalidate(oldRevision.cacheKey)).toBe(1);
		expect(cache.invalidate("Assets/Other.jpg\u00001:1")).toBe(0);
		lateLoad?.();
		expect(cache.stats()).toMatchObject({ ready: 0, pending: 0 });
		expect(onStateChange).not.toHaveBeenCalled();

		expect(cache.get(newRevision).status).toBe("pending");
		host.images[1]?.triggerLoad();
		expect(cache.get(newRevision).status).toBe("ready");
		expect(cache.get(oldRevision).status).toBe("pending");
		expect(host.images).toHaveLength(3);
	});

	it("releases ready and pending resources on destroy and contains late work and callback errors", () => {
		const host = createOwningHost();
		const onStateChange = vi.fn(() => {
			throw new Error("detached renderer");
		});
		const cache = new PersonPhotoThumbnailCache({
			window: host.window,
			document: host.document,
			onStateChange,
			limits: { maxReady: 2, maxPending: 2 },
		});
		const readyRequest = request("Assets/Alice.jpg\u00001:1");
		const pendingRequest = request("Assets/Bob.jpg\u00001:1");
		cache.get(readyRequest);
		expect(() => host.images[0]?.triggerLoad()).not.toThrow();
		const ready = cache.get(readyRequest);
		if (ready.status !== "ready") throw new Error("Expected a ready thumbnail.");
		cache.get(pendingRequest);
		const lateLoad = host.images[1]?.onload;
		const callbacksBeforeDestroy = onStateChange.mock.calls.length;

		cache.destroy();
		cache.destroy();
		lateLoad?.();

		expect(onStateChange).toHaveBeenCalledWith({ cacheKey: readyRequest.cacheKey, status: "ready" });
		expect(onStateChange).toHaveBeenCalledTimes(callbacksBeforeDestroy);
		expect(ready.thumbnail.source).toMatchObject({ width: 0, height: 0 });
		expect(host.images[1]).toMatchObject({ onload: null, onerror: null, sourceRemoved: true });
		expect(cache.stats()).toMatchObject({
			ready: 0,
			pending: 0,
			failures: 0,
			retainedPixels: 0,
			destroyed: true,
		});
		expect(cache.get(request("Assets/Carol.jpg\u00001:1"))).toEqual({ status: "error" });
		expect(host.images).toHaveLength(2);
	});

	it("rejects mismatched owners and network resource URLs without using a global image constructor", () => {
		const host = createOwningHost();
		const otherHost = createOwningHost();
		expect(
			() =>
				new PersonPhotoThumbnailCache({
					window: host.window,
					document: otherHost.document,
				}),
		).toThrow("matching owning Window and Document");

		const cache = new PersonPhotoThumbnailCache({
			window: host.window,
			document: host.document,
			limits: { maxReady: 999, maxPending: 999, maxFailures: 999, maxDimension: 999 },
		});
		expect(cache.stats()).toMatchObject({
			maxReady: 64,
			maxPending: 64,
			maxFailures: 64,
			maxDimension: 256,
		});
		expect(
			cache.get({
				cacheKey: "Assets/Alice.jpg\u00001:1",
				resourceUrl: "https://example.test/alice.jpg",
			}),
		).toEqual({ status: "error" });
		expect(host.images).toHaveLength(0);
	});
});
