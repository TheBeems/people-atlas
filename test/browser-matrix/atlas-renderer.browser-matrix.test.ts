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
	organisations: [],
	isCenter: true,
};

function matrixSnapshot(): AtlasSnapshot {
	return {
		nodes: [matrixNode],
		edges: [],
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		generatedAt: 1,
	};
}

function callbacks() {
	return {
		onOpenNode: vi.fn<AtlasRendererCallbacks["onOpenNode"]>(),
		onCenterNode: vi.fn<AtlasRendererCallbacks["onCenterNode"]>(),
		onSelectNode: vi.fn<AtlasRendererCallbacks["onSelectNode"]>(),
		onLayoutChanged: vi.fn<NonNullable<AtlasRendererCallbacks["onLayoutChanged"]>>(),
	};
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
		const rendererCallbacks = callbacks();
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
			const nativeRequestAnimationFrame = popupWindow.requestAnimationFrame.bind(popupWindow);
			const nativeCancelAnimationFrame = popupWindow.cancelAnimationFrame.bind(popupWindow);
			const observedTargets: Element[] = [];
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

			Object.defineProperty(popupWindow, "ResizeObserver", {
				configurable: true,
				value: ObservablePopupResizeObserver,
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
			const popupCallbacks = callbacks();
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
