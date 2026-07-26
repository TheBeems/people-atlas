import type { HeapObservation } from "./performance-model";

interface BrowserVersionResult {
	protocolVersion: string;
	product: string;
	revision: string;
	userAgent: string;
	jsVersion: string;
}

declare module "vitest/browser" {
	interface BrowserCommands {
		capturePerformanceHeap(stage: string): Promise<HeapObservation>;
		getPerformanceBrowserVersion(): Promise<BrowserVersionResult>;
		writePerformanceBrowserResult(result: unknown): Promise<void>;
	}
}

export {};
