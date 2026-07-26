import { writeFile } from "node:fs/promises";
import { defineBrowserCommand, playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

interface CdpHeapResult {
	usedSize: number;
	totalSize: number;
}

const capturePerformanceHeap = defineBrowserCommand<[stage: string]>(async (context, stage) => {
	const cdp = await context.provider.getCDPSession?.(context.sessionId);
	if (!cdp) {
		return {
			stage,
			explicitGcAvailable: false,
			kind: "missing" as const,
			missingReason: "The active browser provider does not expose a Chromium CDP session.",
		};
	}
	let explicitGcAvailable = true;
	let gcReason: string | undefined;
	try {
		await cdp.send("HeapProfiler.collectGarbage");
	} catch (error) {
		explicitGcAvailable = false;
		gcReason = error instanceof Error ? error.message : String(error);
	}
	try {
		const heap = await cdp.send("Runtime.getHeapUsage") as CdpHeapResult;
		return {
			stage,
			heapUsedBytes: heap.usedSize,
			totalHeapBytes: heap.totalSize,
			explicitGcAvailable,
			kind: explicitGcAvailable ? "collected-heap" as const : "retained-heap-observation" as const,
			...(gcReason ? { missingReason: `Explicit collection unavailable: ${gcReason}` } : {}),
		};
	} catch (error) {
		return {
			stage,
			explicitGcAvailable,
			kind: "missing" as const,
			missingReason: error instanceof Error ? error.message : String(error),
		};
	}
});

const getPerformanceBrowserVersion = defineBrowserCommand<[]>(async (context) => {
	const cdp = await context.provider.getCDPSession?.(context.sessionId);
	if (!cdp) throw new Error("The active browser provider does not expose a Chromium CDP session.");
	return cdp.send("Browser.getVersion");
});

const writePerformanceBrowserResult = defineBrowserCommand<[result: unknown]>(async (_context, result) => {
	const outputPath = process.env.PEOPLE_ATLAS_PERF_BROWSER_OUTPUT;
	if (!outputPath) throw new Error("PEOPLE_ATLAS_PERF_BROWSER_OUTPUT is required.");
	await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
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
					name: "performance-node",
					environment: "node",
					include: ["test/performance/node-characterization.perf.ts"],
					testTimeout: 1_200_000,
				},
			},
			{
				extends: true,
				test: {
					name: "performance-browser",
					include: ["test/performance/browser-characterization.perf.ts"],
					testTimeout: 1_200_000,
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: "chromium" }],
						commands: {
							capturePerformanceHeap,
							getPerformanceBrowserVersion,
							writePerformanceBrowserResult,
						},
					},
				},
			},
		],
	},
});
