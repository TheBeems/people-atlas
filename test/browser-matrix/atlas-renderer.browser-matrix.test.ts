import { afterEach, describe, expect, inject, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { AtlasNode, AtlasSnapshot } from "../../src/domain/types";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";

const expectedFactor = inject("browserMatrixExpectedFactor");
const primarySize = { width: 420, height: 320 };
const resizedSize = { width: 510, height: 390 };
const matrixNode: AtlasNode = {
	id: "matrix-person",
	personId: "matrix-person",
	kind: "person",
	label: "Matrix person",
	filePath: "People/Matrix person.md",
	photoPath: "Assets/Matrix person.png",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: true,
};

function matrixSnapshot(): AtlasSnapshot {
	return {
		nodes: [matrixNode],
		edges: [],
		contactMoments: [],
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount: 0,
		generatedAt: 1,
	};
}

function callbacks(resolvePersonPhoto?: AtlasRendererCallbacks["resolvePersonPhoto"]) {
	return {
		onOpenNode: vi.fn<AtlasRendererCallbacks["onOpenNode"]>(),
		onCenterNode: vi.fn<AtlasRendererCallbacks["onCenterNode"]>(),
		onSelectNode: vi.fn<AtlasRendererCallbacks["onSelectNode"]>(),
		onLayoutChanged: vi.fn<NonNullable<AtlasRendererCallbacks["onLayoutChanged"]>>(),
		resolvePersonPhoto,
	};
}

function wideRasterDataUrl(doc: Document): string {
	const canvas = doc.createElement("canvas");
	canvas.width = 512;
	canvas.height = 256;
	const context = canvas.getContext("2d");
	if (!context) throw new Error(`[DPR ${expectedFactor}] avatar fixture canvas is unavailable.`);
	context.fillStyle = "rgb(255, 0, 0)";
	context.fillRect(0, 0, 128, 256);
	context.fillStyle = "rgb(0, 255, 0)";
	context.fillRect(128, 0, 256, 256);
	context.fillStyle = "rgb(0, 0, 255)";
	context.fillRect(384, 0, 128, 256);
	return canvas.toDataURL("image/png");
}

function photoResolver(resourceUrl: string): NonNullable<AtlasRendererCallbacks["resolvePersonPhoto"]> {
	return (photoPath) => ({
		status: "ready",
		resourceUrl,
		cacheKey: `${photoPath}\u000042:4096`,
	});
}

function canvasPixelAtCss(canvas: HTMLCanvasElement, x: number, y: number, ratio: number): Uint8ClampedArray {
	const context = canvas.getContext("2d");
	if (!context) throw new Error(`[DPR ${expectedFactor}] graph canvas context is unavailable.`);
	return context.getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data;
}

function expectGreenAvatarPixel(pixel: Uint8ClampedArray, boundary: string): void {
	expect(pixel[0], `[DPR ${expectedFactor}] ${boundary}: red channel`).toBeLessThan(20);
	expect(pixel[1], `[DPR ${expectedFactor}] ${boundary}: green channel`).toBeGreaterThan(235);
	expect(pixel[2], `[DPR ${expectedFactor}] ${boundary}: blue channel`).toBeLessThan(20);
	expect(pixel[3], `[DPR ${expectedFactor}] ${boundary}: alpha channel`).toBe(255);
}

function trackFillTextAlignment(win: Window & typeof globalThis): {
	alignments: Array<{ text: string; textAlign: CanvasTextAlign }>;
} {
	const alignments: Array<{ text: string; textAlign: CanvasTextAlign }> = [];
	const nativeFillText = win.CanvasRenderingContext2D.prototype.fillText;
	vi.spyOn(win.CanvasRenderingContext2D.prototype, "fillText").mockImplementation(function (
		this: CanvasRenderingContext2D,
		text: string,
		x: number,
		y: number,
		maxWidth?: number,
	): void {
		alignments.push({ text, textAlign: this.textAlign });
		if (maxWidth === undefined) nativeFillText.call(this, text, x, y);
		else nativeFillText.call(this, text, x, y, maxWidth);
	});
	return { alignments };
}

function fixedContainer(doc: Document, size: { width: number; height: number }): HTMLDivElement {
	const container = doc.createElement("div");
	container.className = "people-atlas-graph";
	container.style.width = `${size.width}px`;
	container.style.height = `${size.height}px`;
	doc.body.append(container);
	return container;
}

function canvasDimensions(canvas: HTMLCanvasElement): {
	cssWidth: number;
	cssHeight: number;
	backingWidth: number;
	backingHeight: number;
} {
	const rect = canvas.getBoundingClientRect();
	return {
		cssWidth: rect.width,
		cssHeight: rect.height,
		backingWidth: canvas.width,
		backingHeight: canvas.height,
	};
}

async function waitFor(boundary: string, predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
	const started = performance.now();
	while (!predicate()) {
		if (performance.now() - started >= timeoutMs) {
			throw new Error(`[DPR ${expectedFactor}] ${boundary} timed out after ${timeoutMs} ms.`);
		}
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	}
}

async function waitForCanvas(
	boundary: string,
	canvas: HTMLCanvasElement,
	expectedCssWidth: number,
	expectedCssHeight: number,
): Promise<void> {
	const expectedBackingWidth = Math.round(expectedCssWidth * expectedFactor);
	const expectedBackingHeight = Math.round(expectedCssHeight * expectedFactor);
	const diagnostic =
		`${boundary}: expected CSS ${expectedCssWidth}x${expectedCssHeight}px` +
		` and backing ${expectedBackingWidth}x${expectedBackingHeight}px`;
	await waitFor(diagnostic, () => {
		const dimensions = canvasDimensions(canvas);
		return (
			dimensions.cssWidth === expectedCssWidth &&
			dimensions.cssHeight === expectedCssHeight &&
			dimensions.backingWidth === expectedBackingWidth &&
			dimensions.backingHeight === expectedBackingHeight
		);
	});
}

function copyProductionStyles(target: Document): void {
	const style = target.createElement("style");
	const rules: string[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			rules.push(...Array.from(sheet.cssRules, (rule) => rule.cssText));
		} catch {
			// Cross-origin harness styles are unrelated to the imported production stylesheet.
		}
	}
	style.textContent = rules.join("\n");
	target.head.append(style);
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe(`P7c renderer browser matrix at DPR ${expectedFactor}`, () => {
	it(`proves main-document scale, far-pixel coverage, CSS selection and resize at DPR ${expectedFactor}`, async () => {
		expect(
			window.devicePixelRatio,
			`[DPR ${expectedFactor}] provider context must expose the configured device scale`,
		).toBe(expectedFactor);

		const container = fixedContainer(document, primarySize);
		const fillText = trackFillTextAlignment(window);
		const rendererCallbacks = callbacks(photoResolver(wideRasterDataUrl(document)));
		const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, rendererCallbacks);
		renderer.setGraph(matrixSnapshot());
		const canvas = page.getByRole("application", { name: "Interactive people and relationship atlas" });
		const canvasElement = canvas.element() as HTMLCanvasElement;
		const surface = container.querySelector<HTMLElement>(".people-atlas-graph-surface");
		expect(surface, `[DPR ${expectedFactor}] main-document graph surface must exist`).not.toBeNull();

		const primarySurface = (surface as HTMLElement).getBoundingClientRect();
		expect(primarySurface.width).toBe(primarySize.width);
		expect(primarySurface.height).toBeGreaterThan(0);
		await waitForCanvas("main-document scale", canvasElement, primarySurface.width, primarySurface.height);
		expect(canvasElement.style.width).toBe(`${primarySurface.width}px`);
		expect(canvasElement.style.height).toBe(`${primarySurface.height}px`);

		await waitFor("main-document far-pixel draw", () => {
			const context = canvasElement.getContext("2d");
			if (!context || canvasElement.width < 1 || canvasElement.height < 1) return false;
			return context.getImageData(canvasElement.width - 1, canvasElement.height - 1, 1, 1).data[3] === 255;
		});
		await waitFor("main-document avatar decode", () => renderer.getPhotoCacheStats().ready === 1);
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		const avatarLayout = renderer.getLayoutSnapshot();
		const avatarPosition = avatarLayout.positions[matrixNode.id];
		if (!avatarPosition) throw new Error(`[DPR ${expectedFactor}] matrix avatar has no layout position.`);
		const avatarX = avatarPosition.x * avatarLayout.camera.scale + avatarLayout.camera.x;
		const avatarY = avatarPosition.y * avatarLayout.camera.scale + avatarLayout.camera.y;
		expectGreenAvatarPixel(
			canvasPixelAtCss(canvasElement, avatarX, avatarY, expectedFactor),
			"main-document center crop",
		);
		const ringPixel = canvasPixelAtCss(
			canvasElement,
			avatarX + 23 * avatarLayout.camera.scale,
			avatarY,
			expectedFactor,
		);
		expect(
			(ringPixel[1] ?? 0) < 235 || (ringPixel[0] ?? 0) >= 20 || (ringPixel[2] ?? 0) >= 20,
			`[DPR ${expectedFactor}] main-document ring must remain painted over the avatar`,
		).toBe(true);
		expect(
			fillText.alignments.some(({ text, textAlign }) => text === matrixNode.label && textAlign === "center"),
			`[DPR ${expectedFactor}] main-document label must remain painted beside the avatar`,
		).toBe(true);

		const box = canvasElement.getBoundingClientRect();
		await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
		expect(rendererCallbacks.onSelectNode).toHaveBeenLastCalledWith(matrixNode, "canvas");

		const oldDimensions = canvasDimensions(canvasElement);
		container.style.width = `${resizedSize.width}px`;
		container.style.height = `${resizedSize.height}px`;
		await waitFor("main-document resize surface", () => {
			const rect = (surface as HTMLElement).getBoundingClientRect();
			return rect.width === resizedSize.width && rect.height !== primarySurface.height;
		});
		const resizedSurface = (surface as HTMLElement).getBoundingClientRect();
		await waitForCanvas("main-document resize", canvasElement, resizedSurface.width, resizedSurface.height);
		const newDimensions = canvasDimensions(canvasElement);
		expect(newDimensions.cssWidth).toBe(resizedSize.width);
		expect(newDimensions.backingWidth).not.toBe(oldDimensions.backingWidth);
		expect(newDimensions.backingHeight).not.toBe(oldDimensions.backingHeight);

		renderer.destroy();
	});

	it(`proves popup creation, ownership and teardown at DPR ${expectedFactor}`, async () => {
		expect(
			window.devicePixelRatio,
			`[DPR ${expectedFactor}] provider context must expose the configured device scale`,
		).toBe(expectedFactor);

		const openPopup = document.createElement("button");
		openPopup.type = "button";
		openPopup.textContent = `Open matrix popup at DPR ${expectedFactor}`;
		document.body.append(openPopup);
		const popupState: { current: Window | null } = { current: null };
		openPopup.addEventListener(
			"click",
			() => {
				popupState.current = window.open("", `people-atlas-p7c-${expectedFactor}`, "popup,width=700,height=520");
			},
			{ once: true },
		);

		await userEvent.click(openPopup);
		const popup = popupState.current;
		if (!popup) throw new Error(`[DPR ${expectedFactor}] popup creation returned null or was blocked.`);

		try {
			let popupDocument: Document;
			try {
				popupDocument = popup.document;
			} catch (error) {
				throw new Error(`[DPR ${expectedFactor}] popup ownership is not same-origin accessible.`, { cause: error });
			}
			expect(popup, `[DPR ${expectedFactor}] popup must be distinct from its opener`).not.toBe(window);
			expect(popupDocument, `[DPR ${expectedFactor}] popup document must be distinct`).not.toBe(document);
			expect(popup.top, `[DPR ${expectedFactor}] popup must be top-level`).toBe(popup);
			expect(popup.opener, `[DPR ${expectedFactor}] popup must retain its opener`).toBe(window);
			expect(popup.devicePixelRatio, `[DPR ${expectedFactor}] popup scale must match its context`).toBe(expectedFactor);

			popupDocument.title = `People Atlas P7c DPR ${expectedFactor}`;
			copyProductionStyles(popupDocument);

			const popupWindow = popup as Window & typeof globalThis;
			const NativeResizeObserver = popupWindow.ResizeObserver;
			const NativeImage = popupWindow.Image;
			const nativeRequestAnimationFrame = popupWindow.requestAnimationFrame.bind(popupWindow);
			const nativeCancelAnimationFrame = popupWindow.cancelAnimationFrame.bind(popupWindow);
			const observedTargets: Element[] = [];
			const popupImages: HTMLImageElement[] = [];
			let observerDisconnects = 0;
			const requestedFrames: number[] = [];
			const cancelledFrames: number[] = [];
			const pendingFrames = new Set<number>();

			class ObservablePopupResizeObserver {
				private readonly delegate: ResizeObserver;

				constructor(callback: ResizeObserverCallback) {
					this.delegate = new NativeResizeObserver(callback);
				}

				observe(target: Element, options?: ResizeObserverOptions): void {
					observedTargets.push(target);
					this.delegate.observe(target, options);
				}

				unobserve(target: Element): void {
					this.delegate.unobserve(target);
				}

				disconnect(): void {
					observerDisconnects += 1;
					this.delegate.disconnect();
				}
			}

			function ObservablePopupImage(): HTMLImageElement {
				const image = new NativeImage();
				popupImages.push(image);
				return image;
			}

			Object.defineProperty(popupWindow, "ResizeObserver", {
				configurable: true,
				value: ObservablePopupResizeObserver,
			});
			Object.defineProperty(popupWindow, "Image", {
				configurable: true,
				value: ObservablePopupImage,
			});
			Object.defineProperty(popupWindow, "requestAnimationFrame", {
				configurable: true,
				value: (callback: FrameRequestCallback): number => {
					let frameId = 0;
					frameId = nativeRequestAnimationFrame((time) => {
						pendingFrames.delete(frameId);
						callback(time);
					});
					requestedFrames.push(frameId);
					pendingFrames.add(frameId);
					return frameId;
				},
			});
			Object.defineProperty(popupWindow, "cancelAnimationFrame", {
				configurable: true,
				value: (frameId: number): void => {
					cancelledFrames.push(frameId);
					pendingFrames.delete(frameId);
					nativeCancelAnimationFrame(frameId);
				},
			});

			const popupContainer = fixedContainer(popupDocument, primarySize);
			const popupDrawImage = vi.spyOn(popupWindow.CanvasRenderingContext2D.prototype, "drawImage");
			const popupFillText = trackFillTextAlignment(popupWindow);
			const popupCallbacks = callbacks(photoResolver(wideRasterDataUrl(popupDocument)));
			const renderer = new AtlasRenderer(popupContainer, () => DEFAULT_SETTINGS, popupCallbacks);
			renderer.setGraph(matrixSnapshot());
			const root = popupDocument.querySelector<HTMLElement>(".people-atlas-renderer");
			const canvas = popupDocument.querySelector<HTMLCanvasElement>(".people-atlas-canvas");
			const listMode = popupDocument.querySelector<HTMLButtonElement>(".people-atlas-list-mode");
			const graphMode = popupDocument.querySelector<HTMLButtonElement>(".people-atlas-graph-mode");
			const details = popupDocument.querySelector<HTMLButtonElement>(
				".people-atlas-graph-actions button[aria-label='Details']",
			);
			const dialog = popupDocument.querySelector<HTMLDialogElement>(".people-atlas-details-sheet");
			expect(root?.ownerDocument).toBe(popupDocument);
			expect(canvas?.ownerDocument).toBe(popupDocument);
			expect(dialog?.ownerDocument).toBe(popupDocument);
			expect(canvas).not.toBeNull();
			expect(listMode).not.toBeNull();
			expect(graphMode).not.toBeNull();
			expect(details).not.toBeNull();
			expect(dialog).not.toBeNull();

			const popupSurface = popupContainer.querySelector<HTMLElement>(".people-atlas-graph-surface");
			expect(popupSurface).not.toBeNull();
			const popupSurfaceRect = (popupSurface as HTMLElement).getBoundingClientRect();
			await waitForCanvas(
				"popup ownership scale",
				canvas as HTMLCanvasElement,
				popupSurfaceRect.width,
				popupSurfaceRect.height,
			);
			expect(observedTargets).toContain(popupSurface);
			expect(observedTargets.every((target) => target.ownerDocument === popupDocument)).toBe(true);
			expect(requestedFrames.length).toBeGreaterThan(0);
			await waitFor("popup avatar decode", () => renderer.getPhotoCacheStats().ready === 1);
			await new Promise<void>((resolve) => popupWindow.requestAnimationFrame(() => resolve()));
			expect(popupImages).toHaveLength(1);
			expect(popupImages[0]?.ownerDocument).toBe(popupDocument);
			expect(popupImages[0]?.hasAttribute("src")).toBe(false);
			const popupThumbnailDraw = popupDrawImage.mock.calls.find(
				([source]) => source instanceof popupWindow.HTMLCanvasElement && source !== canvas,
			);
			expect(
				popupThumbnailDraw,
				`[DPR ${expectedFactor}] popup avatar must use a popup-owned thumbnail canvas`,
			).toBeDefined();
			expect((popupThumbnailDraw?.[0] as HTMLCanvasElement | undefined)?.ownerDocument).toBe(popupDocument);
			expect((popupThumbnailDraw?.[0] as HTMLCanvasElement | undefined)?.ownerDocument).not.toBe(document);
			const popupLayout = renderer.getLayoutSnapshot();
			const popupPosition = popupLayout.positions[matrixNode.id];
			if (!popupPosition) throw new Error(`[DPR ${expectedFactor}] popup avatar has no layout position.`);
			const popupAvatarX = popupPosition.x * popupLayout.camera.scale + popupLayout.camera.x;
			const popupAvatarY = popupPosition.y * popupLayout.camera.scale + popupLayout.camera.y;
			expectGreenAvatarPixel(
				canvasPixelAtCss(canvas as HTMLCanvasElement, popupAvatarX, popupAvatarY, expectedFactor),
				"popup center crop",
			);
			const popupRingPixel = canvasPixelAtCss(
				canvas as HTMLCanvasElement,
				popupAvatarX + 23 * popupLayout.camera.scale,
				popupAvatarY,
				expectedFactor,
			);
			expect(
				(popupRingPixel[1] ?? 0) < 235 || (popupRingPixel[0] ?? 0) >= 20 || (popupRingPixel[2] ?? 0) >= 20,
				`[DPR ${expectedFactor}] popup ring must remain painted over the avatar`,
			).toBe(true);
			expect(
				popupFillText.alignments.some(({ text, textAlign }) => text === matrixNode.label && textAlign === "center"),
				`[DPR ${expectedFactor}] popup label must remain painted beside the avatar`,
			).toBe(true);

			await userEvent.click(listMode as HTMLButtonElement);
			const popupPerson = popupDocument.querySelector<HTMLButtonElement>(".people-atlas-person-button");
			expect(popupPerson?.dataset.nodeId).toBe(matrixNode.id);
			await userEvent.click(popupPerson as HTMLButtonElement);
			await userEvent.click(graphMode as HTMLButtonElement);
			await userEvent.click(details as HTMLButtonElement);
			expect(dialog?.open).toBe(true);
			expect(popupDocument.activeElement?.textContent).toBe("Close");
			expect(document.activeElement).not.toBe(popupDocument.activeElement);

			await waitFor("popup animation-frame drain", () => pendingFrames.size === 0);
			renderer.setGraph(matrixSnapshot());
			const popupTeardown = `[DPR ${expectedFactor}] popup teardown`;
			expect(pendingFrames.size, `${popupTeardown}: must start with exactly one pending popup frame`).toBe(1);
			const pendingFrame = Array.from(pendingFrames)[0] as number;
			const capturedPressed = listMode?.getAttribute("aria-pressed");
			renderer.destroy();
			expect(renderer.getPhotoCacheStats()).toMatchObject({
				ready: 0,
				pending: 0,
				failed: 0,
				total: 0,
				retainedPixels: 0,
				destroyed: true,
			});
			expect(dialog?.open, `${popupTeardown}: destroy must close the native dialog`).toBe(false);
			expect(observerDisconnects, `${popupTeardown}: destroy must disconnect the popup observer exactly once`).toBe(1);
			expect(cancelledFrames, `${popupTeardown}: destroy must cancel the pending popup frame`).toContain(pendingFrame);
			expect(pendingFrames.size, `${popupTeardown}: destroy must leave no pending popup frame`).toBe(0);
			expect(root?.isConnected, `${popupTeardown}: destroy must detach renderer DOM`).toBe(false);
			expect(popupContainer.childElementCount, `${popupTeardown}: destroy must empty the renderer container`).toBe(0);

			listMode?.click();
			details?.click();
			expect(
				listMode?.getAttribute("aria-pressed"),
				`${popupTeardown}: captured List control must not reactivate renderer state`,
			).toBe(capturedPressed);
			expect(dialog?.open, `${popupTeardown}: captured Details control must not reopen the dialog`).toBe(false);
			expect(
				popupCallbacks.onOpenNode,
				`${popupTeardown}: captured controls must not invoke Open`,
			).not.toHaveBeenCalled();
			expect(
				popupCallbacks.onCenterNode,
				`${popupTeardown}: captured controls must not invoke Center`,
			).not.toHaveBeenCalled();
		} finally {
			popup.close();
			expect(popup.closed, `[DPR ${expectedFactor}] popup teardown must close the browsing context`).toBe(true);
		}
	});
});
