export const PERSON_PHOTO_THUMBNAIL_MAX_READY = 64;
export const PERSON_PHOTO_THUMBNAIL_MAX_PENDING = 64;
export const PERSON_PHOTO_THUMBNAIL_MAX_FAILURES = 64;
export const PERSON_PHOTO_THUMBNAIL_MAX_DIMENSION = 256;

export interface PersonPhotoThumbnailRequest {
	/** Opaque identity containing the normalized vault path and asset modification state. */
	cacheKey: string;
	/** Safe local URL produced by the vault resource adapter, never the vault path itself. */
	resourceUrl: string;
}

export interface PersonPhotoThumbnail {
	source: HTMLCanvasElement;
	width: number;
	height: number;
}

export type PersonPhotoThumbnailState =
	| { status: "pending" }
	| { status: "error" }
	| { status: "ready"; thumbnail: PersonPhotoThumbnail };

export interface PersonPhotoThumbnailChange {
	/** Renderer integrations must redraw only when this identity still belongs to a live node. */
	cacheKey: string;
	status: "ready" | "error";
}

export interface PersonPhotoThumbnailCacheStats {
	ready: number;
	pending: number;
	failures: number;
	retainedPixels: number;
	destroyed: boolean;
	maxReady: number;
	maxPending: number;
	maxFailures: number;
	maxDimension: number;
	requests: number;
	loadsStarted: number;
	loadsSucceeded: number;
	loadsFailed: number;
	capacityRejections: number;
	readyEvictions: number;
}

export interface PersonPhotoThumbnailCacheLimits {
	maxReady?: number | undefined;
	maxPending?: number | undefined;
	maxFailures?: number | undefined;
	maxDimension?: number | undefined;
}

export interface PersonPhotoThumbnailCacheOptions {
	window: Window & typeof globalThis;
	document: Document;
	onStateChange?(change: PersonPhotoThumbnailChange): void;
	limits?: PersonPhotoThumbnailCacheLimits | undefined;
}

interface ReadyEntry {
	thumbnail: PersonPhotoThumbnail;
}

interface PendingEntry {
	image: HTMLImageElement;
	active: boolean;
}

const PENDING_STATE = Object.freeze({ status: "pending" } as const);
const ERROR_STATE = Object.freeze({ status: "error" } as const);

export class PersonPhotoThumbnailCache {
	private readonly win: Window & typeof globalThis;
	private readonly doc: Document;
	private readonly onStateChange: (change: PersonPhotoThumbnailChange) => void;
	private readonly maxReady: number;
	private readonly maxPending: number;
	private readonly maxFailures: number;
	private readonly maxDimension: number;
	private readonly ready = new Map<string, ReadyEntry>();
	private readonly pending = new Map<string, PendingEntry>();
	private readonly failures = new Map<string, true>();
	private destroyed = false;
	private requests = 0;
	private loadsStarted = 0;
	private loadsSucceeded = 0;
	private loadsFailed = 0;
	private capacityRejections = 0;
	private readyEvictions = 0;

	constructor(options: PersonPhotoThumbnailCacheOptions) {
		if (options.document.defaultView !== options.window) {
			throw new Error("PersonPhotoThumbnailCache requires a matching owning Window and Document.");
		}
		this.win = options.window;
		this.doc = options.document;
		this.onStateChange = options.onStateChange ?? (() => undefined);
		this.maxReady = boundedLimit(options.limits?.maxReady, PERSON_PHOTO_THUMBNAIL_MAX_READY);
		this.maxPending = boundedLimit(options.limits?.maxPending, PERSON_PHOTO_THUMBNAIL_MAX_PENDING);
		this.maxFailures = boundedLimit(options.limits?.maxFailures, PERSON_PHOTO_THUMBNAIL_MAX_FAILURES);
		this.maxDimension = boundedLimit(options.limits?.maxDimension, PERSON_PHOTO_THUMBNAIL_MAX_DIMENSION);
	}

	get(request: PersonPhotoThumbnailRequest): PersonPhotoThumbnailState {
		this.requests += 1;
		if (this.destroyed) return ERROR_STATE;
		const cacheKey = request.cacheKey;
		const resourceUrl = safeLocalResourceUrl(request.resourceUrl);
		if (!cacheKey.trim() || !resourceUrl) {
			if (cacheKey.trim()) {
				this.loadsFailed += 1;
				this.rememberFailure(cacheKey);
			}
			return ERROR_STATE;
		}

		const ready = this.ready.get(cacheKey);
		if (ready) {
			touchEntry(this.ready, cacheKey, ready);
			return { status: "ready", thumbnail: ready.thumbnail };
		}
		const pending = this.pending.get(cacheKey);
		if (pending) {
			touchEntry(this.pending, cacheKey, pending);
			return PENDING_STATE;
		}
		if (this.failures.delete(cacheKey)) {
			this.failures.set(cacheKey, true);
			return ERROR_STATE;
		}

		if (
			this.pending.size >= this.maxPending ||
			this.ready.size + this.pending.size >= this.maxReady ||
			this.failures.size >= this.maxFailures
		) {
			this.capacityRejections += 1;
			return ERROR_STATE;
		}
		let image: HTMLImageElement;
		try {
			image = new this.win.Image();
		} catch {
			this.loadsFailed += 1;
			this.rememberFailure(cacheKey);
			return ERROR_STATE;
		}
		const entry: PendingEntry = { image, active: true };
		image.decoding = "async";
		image.onload = () => this.completeLoad(cacheKey, entry);
		image.onerror = () => this.completeFailure(cacheKey, entry);
		this.pending.set(cacheKey, entry);
		this.loadsStarted += 1;
		try {
			image.src = resourceUrl;
		} catch {
			this.completeFailure(cacheKey, entry);
			return ERROR_STATE;
		}
		return this.failures.has(cacheKey) ? ERROR_STATE : PENDING_STATE;
	}

	evictLeastRecentlyUsedReady(count = 1): string[] {
		const evicted: string[] = [];
		const target = Math.max(0, Math.floor(count));
		while (evicted.length < target) {
			const oldest = this.ready.entries().next().value;
			if (!oldest) break;
			const [cacheKey, entry] = oldest;
			this.ready.delete(cacheKey);
			releaseThumbnail(entry.thumbnail);
			evicted.push(cacheKey);
			this.readyEvictions += 1;
		}
		return evicted;
	}

	invalidate(cacheKeys: string | Iterable<string>): number {
		const keys = typeof cacheKeys === "string" ? [cacheKeys] : new Set(cacheKeys);
		let invalidated = 0;
		for (const cacheKey of keys) {
			const ready = this.ready.get(cacheKey);
			if (ready) {
				this.ready.delete(cacheKey);
				releaseThumbnail(ready.thumbnail);
				invalidated += 1;
			}
			const pending = this.pending.get(cacheKey);
			if (pending) {
				this.pending.delete(cacheKey);
				releasePending(pending);
				invalidated += 1;
			}
			if (this.failures.delete(cacheKey)) invalidated += 1;
		}
		return invalidated;
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		for (const entry of this.pending.values()) releasePending(entry);
		for (const entry of this.ready.values()) releaseThumbnail(entry.thumbnail);
		this.pending.clear();
		this.ready.clear();
		this.failures.clear();
	}

	stats(): Readonly<PersonPhotoThumbnailCacheStats> {
		const retainedPixels = [...this.ready.values()].reduce(
			(total, entry) => total + entry.thumbnail.width * entry.thumbnail.height,
			0,
		);
		return Object.freeze({
			ready: this.ready.size,
			pending: this.pending.size,
			failures: this.failures.size,
			retainedPixels,
			destroyed: this.destroyed,
			maxReady: this.maxReady,
			maxPending: this.maxPending,
			maxFailures: this.maxFailures,
			maxDimension: this.maxDimension,
			requests: this.requests,
			loadsStarted: this.loadsStarted,
			loadsSucceeded: this.loadsSucceeded,
			loadsFailed: this.loadsFailed,
			capacityRejections: this.capacityRejections,
			readyEvictions: this.readyEvictions,
		});
	}

	private completeLoad(cacheKey: string, entry: PendingEntry): void {
		if (!this.isCurrentPending(cacheKey, entry)) {
			releasePending(entry);
			return;
		}
		let thumbnail: PersonPhotoThumbnail;
		try {
			thumbnail = this.createThumbnail(entry.image);
		} catch {
			this.completeFailure(cacheKey, entry);
			return;
		}
		if (!this.isCurrentPending(cacheKey, entry)) {
			releasePending(entry);
			releaseThumbnail(thumbnail);
			return;
		}
		this.pending.delete(cacheKey);
		releasePending(entry);
		this.ready.set(cacheKey, { thumbnail });
		this.loadsSucceeded += 1;
		this.trimReady();
		this.notify({ cacheKey, status: "ready" });
	}

	private completeFailure(cacheKey: string, entry: PendingEntry): void {
		if (!this.isCurrentPending(cacheKey, entry)) {
			releasePending(entry);
			return;
		}
		this.pending.delete(cacheKey);
		releasePending(entry);
		if (this.destroyed) return;
		this.loadsFailed += 1;
		this.rememberFailure(cacheKey);
		this.notify({ cacheKey, status: "error" });
	}

	private createThumbnail(image: HTMLImageElement): PersonPhotoThumbnail {
		const sourceWidth = image.naturalWidth;
		const sourceHeight = image.naturalHeight;
		if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
			throw new Error("The image has no decodable dimensions.");
		}
		const sourceSize = Math.min(sourceWidth, sourceHeight);
		const dimension = Math.max(1, Math.min(this.maxDimension, Math.floor(sourceSize)));
		const canvas = this.doc.createElement("canvas");
		canvas.width = dimension;
		canvas.height = dimension;
		try {
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas 2D is unavailable for a photo thumbnail.");
			context.imageSmoothingEnabled = true;
			context.imageSmoothingQuality = "high";
			context.drawImage(
				image,
				(sourceWidth - sourceSize) / 2,
				(sourceHeight - sourceSize) / 2,
				sourceSize,
				sourceSize,
				0,
				0,
				dimension,
				dimension,
			);
		} catch (error) {
			canvas.width = 0;
			canvas.height = 0;
			throw error;
		}
		return {
			source: canvas,
			width: dimension,
			height: dimension,
		};
	}

	private isCurrentPending(cacheKey: string, entry: PendingEntry): boolean {
		return !this.destroyed && entry.active && this.pending.get(cacheKey) === entry;
	}

	private trimReady(): void {
		while (this.ready.size > this.maxReady) {
			const oldest = this.ready.entries().next().value;
			if (!oldest) return;
			const [cacheKey, entry] = oldest;
			this.ready.delete(cacheKey);
			releaseThumbnail(entry.thumbnail);
			this.readyEvictions += 1;
		}
	}

	private rememberFailure(cacheKey: string): void {
		if (!this.failures.has(cacheKey) && this.failures.size >= this.maxFailures) return;
		this.failures.delete(cacheKey);
		this.failures.set(cacheKey, true);
	}

	private notify(change: PersonPhotoThumbnailChange): void {
		if (this.destroyed) return;
		try {
			this.onStateChange(change);
		} catch {
			// Renderer redraw callbacks are a failure boundary; cache state remains valid.
		}
	}
}

function boundedLimit(value: number | undefined, maximum: number): number {
	if (value === undefined || !Number.isFinite(value)) return maximum;
	return Math.max(1, Math.min(maximum, Math.floor(value)));
}

function safeLocalResourceUrl(resourceUrl: string): string | undefined {
	const value = resourceUrl.trim();
	if (
		!value ||
		value.startsWith("//") ||
		/^(?:https?|ftp|wss?|javascript|vbscript):/i.test(value) ||
		!/^[a-z][a-z0-9+.-]*:/i.test(value)
	) {
		return undefined;
	}
	return value;
}

function touchEntry<T>(entries: Map<string, T>, cacheKey: string, entry: T): void {
	entries.delete(cacheKey);
	entries.set(cacheKey, entry);
}

function releasePending(entry: PendingEntry): void {
	if (!entry.active) return;
	entry.active = false;
	entry.image.onload = null;
	entry.image.onerror = null;
	try {
		entry.image.removeAttribute("src");
	} catch {
		// The owning browser may already have detached the source.
	}
}

function releaseThumbnail(thumbnail: PersonPhotoThumbnail): void {
	thumbnail.source.width = 0;
	thumbnail.source.height = 0;
}
