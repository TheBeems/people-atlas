import { defineConfig } from "vitest/config";
import { defineBrowserCommand, playwright } from "@vitest/browser-playwright";

interface CdpTouchPoint {
	id: number;
	x: number;
	y: number;
}

interface CdpTouchStep {
	type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel";
	points: CdpTouchPoint[];
	delayAfterMs?: number | undefined;
}

const dispatchTouch = defineBrowserCommand<[selector: string, steps: CdpTouchStep[]]>(async (context, selector, steps) => {
	for (const step of steps) {
		const expectsActiveTouches = step.type === "touchStart" || step.type === "touchMove";
		if (expectsActiveTouches && step.points.length === 0) {
			throw new Error(`${step.type} requires at least one active touch point.`);
		}
		if (!expectsActiveTouches && step.points.length !== 0) {
			throw new Error(`${step.type} must not contain active touch points.`);
		}
	}
	const frame = await context.frame();
	const locator = frame.locator(selector);
	const box = await locator.boundingBox();
	if (!box) throw new Error(`Unable to locate touch target: ${selector}`);
	const dimensions = await locator.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return { width: rect.width, height: rect.height };
	});
	if (dimensions.width <= 0 || dimensions.height <= 0) throw new Error(`Touch target has no CSS size: ${selector}`);
	const scaleX = box.width / dimensions.width;
	const scaleY = box.height / dimensions.height;
	const cdp = await context.provider.getCDPSession?.(context.sessionId);
	if (!cdp) throw new Error("The active browser provider does not expose a Chromium CDP session.");
	for (const step of steps) {
		await cdp.send("Input.dispatchTouchEvent", {
			type: step.type,
			touchPoints: step.points.map((point) => ({
				id: point.id,
				x: box.x + point.x * scaleX,
				y: box.y + point.y * scaleY,
				radiusX: 1,
				radiusY: 1,
				force: 1,
			})),
		});
		if (step.delayAfterMs) await new Promise((resolve) => setTimeout(resolve, step.delayAfterMs));
	}
});

export default defineConfig({
	resolve: {
		alias: {
			obsidian: new URL("./test/obsidian-stub.ts", import.meta.url).pathname,
		},
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["test/**/*.test.ts"],
					exclude: ["test/browser/**/*.browser.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "browser",
					include: ["test/browser/**/*.browser.test.ts"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: "chromium" }],
						commands: {
							dispatchTouch,
						},
					},
				},
			},
		],
	},
});
