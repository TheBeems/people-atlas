import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { AtlasNode, AtlasSnapshot } from "../../src/domain/types";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";

const LOCAL_PHOTO_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

interface DeferredImage {
	element: HTMLImageElement;
	source: string;
	released: boolean;
}

class DeferredImageLoader {
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
					image.element.addEventListener("error", () => reject(new Error("Controlled photo failed to decode.")), {
						once: true,
					});
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

function person(index: number, overrides: Partial<AtlasNode> = {}): AtlasNode {
	return {
		id: `person-${index.toString().padStart(3, "0")}`,
		personId: `person-${index.toString().padStart(3, "0")}`,
		kind: "person",
		label: `Person ${index}`,
		filePath: `People/Person ${index}.md`,
		photoPath: `Assets/person-${index}.png`,
		organisations: [],
		emails: [],
		phones: [],
		isCenter: false,
		...overrides,
	};
}

function snapshot(nodes: AtlasNode[]): AtlasSnapshot {
	return {
		nodes,
		edges: [],
		contactMoments: [],
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount: 0,
		generatedAt: 1,
	};
}

function mount(
	graph: AtlasSnapshot,
	resolvePersonPhoto: NonNullable<AtlasRendererCallbacks["resolvePersonPhoto"]>,
): {
	renderer: AtlasRenderer;
	container: HTMLDivElement;
	callbacks: AtlasRendererCallbacks & { onSelectNode: ReturnType<typeof vi.fn> };
} {
	const container = document.createElement("div");
	container.className = "people-atlas-graph people-atlas-avatar-test";
	container.style.width = "640px";
	container.style.height = "480px";
	document.body.append(container);
	const callbacks = {
		onOpenNode: vi.fn(),
		onCenterNode: vi.fn(),
		onSelectNode: vi.fn(),
		onLayoutChanged: vi.fn(),
		resolvePersonPhoto,
	};
	const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks);
	renderer.setGraph(graph);
	return { renderer, container, callbacks };
}

async function nextFrame(win: Window & typeof globalThis = window): Promise<void> {
	await new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()));
}

async function waitFor(boundary: string, predicate: () => boolean): Promise<void> {
	const started = performance.now();
	while (!predicate()) {
		if (performance.now() - started > 2_000) throw new Error(`${boundary} timed out.`);
		await nextFrame();
	}
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("graph photo avatars", () => {
	it("paints initials first, then a clipped local avatar below unchanged rings and labels", async () => {
		const loader = new DeferredImageLoader(window);
		const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
		const clip = vi.spyOn(CanvasRenderingContext2D.prototype, "clip");
		const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
		const stroke = vi.spyOn(CanvasRenderingContext2D.prototype, "stroke");
		const alice = person(1, {
			label: "Alice Example",
			isCenter: true,
		});
		const ghost: AtlasNode = {
			...person(2),
			id: "ghost:missing-photo",
			personId: undefined,
			kind: "ghost",
			filePath: undefined,
			label: "Missing photo",
		};
		const ambiguous = person(3, {
			id: "ambiguous:person-003",
			label: "Ambiguous photo",
		});
		const resolvePersonPhoto = vi.fn((photoPath: string) => ({
			status: "ready" as const,
			resourceUrl: LOCAL_PHOTO_DATA_URL,
			cacheKey: `${photoPath}\u00001:43`,
		}));
		const { renderer, callbacks } = mount(snapshot([alice, ghost, ambiguous]), resolvePersonPhoto);
		try {
			await nextFrame();
			expect(resolvePersonPhoto).toHaveBeenCalledOnce();
			expect(resolvePersonPhoto).toHaveBeenCalledWith(alice.photoPath);
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				ready: 0,
				pending: 1,
				failed: 0,
			});
			expect(fillText.mock.calls.some(([text]) => text === "AE")).toBe(true);
			const layoutBeforeDecode = renderer.getLayoutSnapshot();

			fillText.mockClear();
			clip.mockClear();
			drawImage.mockClear();
			stroke.mockClear();
			await loader.releaseAll();
			await waitFor("ready thumbnail", () => renderer.getPhotoCacheStats().ready === 1);
			await nextFrame();

			const avatarDrawIndex = drawImage.mock.calls.findIndex(([source]) => source instanceof HTMLCanvasElement);
			expect(avatarDrawIndex).toBeGreaterThanOrEqual(0);
			expect(drawImage.mock.calls[avatarDrawIndex]?.slice(-2)).toEqual([48, 48]);
			const avatarDrawOrder = drawImage.mock.invocationCallOrder[avatarDrawIndex] ?? -1;
			expect(clip.mock.invocationCallOrder.some((order) => order < avatarDrawOrder)).toBe(true);
			expect(stroke.mock.invocationCallOrder.some((order) => order > avatarDrawOrder)).toBe(true);
			expect(fillText.mock.calls.some(([text]) => text === "AE")).toBe(false);
			expect(fillText.mock.calls.some(([text]) => text === alice.label)).toBe(true);
			expect(renderer.getLayoutSnapshot()).toEqual(layoutBeforeDecode);

			const canvas = page.getByRole("application", { name: "Interactive people and relationship atlas" });
			const layout = renderer.getLayoutSnapshot();
			const position = layout.positions[alice.id];
			if (!position) throw new Error("Alice has no deterministic layout position.");
			await canvas.click({
				position: {
					x: position.x * layout.camera.scale + layout.camera.x,
					y: position.y * layout.camera.scale + layout.camera.y,
				},
			});
			expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(alice, "canvas");
		} finally {
			renderer.destroy();
			loader.restore();
		}
	});

	it("invalidates changed keys while retaining unrelated and shared ready thumbnails", async () => {
		const loader = new DeferredImageLoader(window);
		const revisions = new Map([
			["Assets/alice.png", "1:10"],
			["Assets/bob.png", "1:20"],
			["Assets/shared.png", "1:30"],
		]);
		const throwingPaths = new Set<string>();
		const resolvePersonPhoto = (photoPath: string) => {
			if (throwingPaths.has(photoPath)) throw new Error("host resolver failure");
			const revision = revisions.get(photoPath);
			if (!revision) return { status: "missing" as const };
			return {
				status: "ready" as const,
				resourceUrl: LOCAL_PHOTO_DATA_URL,
				cacheKey: `${photoPath}\0${revision}`,
			};
		};
		const alice = person(1, { photoPath: "Assets/alice.png" });
		const bob = person(2, { photoPath: "Assets/bob.png" });
		const sharedAlice = person(3, { photoPath: "Assets/shared.png" });
		const sharedBob = person(4, { photoPath: "Assets/shared.png" });
		const { renderer } = mount(snapshot([alice, bob, sharedAlice, sharedBob]), resolvePersonPhoto);
		try {
			await nextFrame();
			expect(renderer.getPhotoCacheStats().pending).toBe(3);
			await loader.releaseAll();
			await waitFor("three ready thumbnails", () => renderer.getPhotoCacheStats().ready === 3);

			revisions.set("Assets/alice.png", "2:11");
			renderer.setGraph(snapshot([alice, bob, sharedAlice, sharedBob]));
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 2, pending: 1 });

			renderer.setGraph(snapshot([alice, bob, sharedAlice]));
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 2, pending: 1 });

			revisions.delete("Assets/shared.png");
			renderer.setGraph(snapshot([alice, bob, sharedAlice]));
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 1, pending: 1 });

			revisions.set("Assets/alice.png", "3:12");
			renderer.setGraph(snapshot([alice, bob]));
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 1, pending: 1 });
			await loader.releaseAll();
			await waitFor("latest Alice and unchanged Bob", () => renderer.getPhotoCacheStats().ready === 2);
			expect(renderer.getPhotoCacheStats().loadsSucceeded).toBe(4);

			throwingPaths.add("Assets/alice.png");
			expect(() => renderer.setGraph(snapshot([alice, bob]))).not.toThrow();
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 1, pending: 0, failed: 0 });
		} finally {
			renderer.destroy();
			loader.restore();
		}
	});

	it("admits a stable 64-key working set and reprioritizes a selected overflow node without retry churn", async () => {
		const loader = new DeferredImageLoader(window);
		const nodes = Array.from({ length: 66 }, (_, index) => person(index));
		const resolvePersonPhoto = vi.fn((photoPath: string) => ({
			status: "ready" as const,
			resourceUrl: LOCAL_PHOTO_DATA_URL,
			cacheKey: `${photoPath}\u00001:43`,
		}));
		const { renderer, container } = mount(snapshot(nodes), resolvePersonPhoto);
		try {
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				pending: 64,
				loadsStarted: 64,
				capacityRejections: 0,
			});

			renderer.fitToContent();
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				pending: 64,
				loadsStarted: 64,
				capacityRejections: 0,
			});

			const overflowButton = container.querySelector<HTMLButtonElement>(
				`.people-atlas-person-button[data-node-id="${nodes[65]?.id}"]`,
			);
			if (!overflowButton) throw new Error("The overflow person button is unavailable.");
			overflowButton.click();
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				pending: 64,
				loadsStarted: 65,
				capacityRejections: 0,
			});

			renderer.setGraph(snapshot(nodes));
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				pending: 64,
				loadsStarted: 65,
				capacityRejections: 0,
			});
		} finally {
			renderer.destroy();
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				ready: 0,
				pending: 0,
				failed: 0,
				total: 0,
				destroyed: true,
			});
			await loader.releaseAll();
			expect(renderer.getPhotoCacheStats()).toMatchObject({ ready: 0, pending: 0, total: 0 });
			loader.restore();
		}
	});

	it("contains corrupt image decoding and keeps the deterministic initials fallback", async () => {
		const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
		const broken = person(7, { label: "Broken Portrait" });
		const { renderer } = mount(snapshot([broken]), (photoPath) => ({
			status: "ready",
			resourceUrl: "data:image/png;base64,not-a-valid-image",
			cacheKey: `${photoPath}\u00001:20`,
		}));
		try {
			await waitFor("corrupt avatar fallback", () => renderer.getPhotoCacheStats().failed === 1);
			fillText.mockClear();
			renderer.fitToContent();
			await nextFrame();
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				ready: 0,
				pending: 0,
				failed: 1,
				total: 1,
				loadsFailed: 1,
			});
			expect(fillText.mock.calls.some(([text]) => text === "BP")).toBe(true);
		} finally {
			renderer.destroy();
		}
	});
});
