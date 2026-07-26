export interface ScalingPoint {
	size: number;
	medianMs: number;
	p95Ms: number;
}

export interface ScalingTrend {
	surface: "node";
	stage: string;
	profile: string;
	metric: "elapsed-ms";
	points: ScalingPoint[];
	growth: Array<{
		fromSize: number;
		toSize: number;
		medianRatio: number | null;
		p95Ratio: number | null;
	}>;
}

export function validateCombinedPerformanceResults(nodeResult: unknown, browserResult: unknown): void;
export function buildScalingTrend(
	nodeResult: {
		cases: Array<{
			size: number;
			profile: string;
			timings: Record<string, { summary: { median: number; p95: number } }>;
		}>;
	},
	stage?: string,
	profile?: string,
): ScalingTrend;
export function garbageCollectionStatements(
	nodeResult: { runtime?: { explicitGcAvailable?: boolean } },
	browserResult: {
		cases: Array<{
			memory?: Array<{ explicitGcAvailable?: boolean }>;
		}>;
	},
): { node: string; chromium: string };
