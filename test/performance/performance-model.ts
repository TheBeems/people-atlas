export const PERFORMANCE_RUNNER_VERSION = "p6a-characterization-v1";
export const FIXTURE_CONTRACT_VERSION = "p6a-ring-lattice-v1";
export const PERFORMANCE_SIZES = [100, 1_000, 5_000] as const;
export const PERFORMANCE_PROFILES = ["sparse", "stress"] as const;
export const NODE_WARMUP_COUNT = 5;
export const NODE_SAMPLE_COUNT = 20;
export const BROWSER_WARMUP_COUNT = 3;
export const BROWSER_SAMPLE_COUNT = 10;
export const INTERACTION_FRAME_COUNT = 30;

export type PerformanceSize = (typeof PERFORMANCE_SIZES)[number];
export type PerformanceProfile = (typeof PERFORMANCE_PROFILES)[number];

export interface SampleSummary {
	min: number;
	median: number;
	p95: number;
	max: number;
}

export interface TimingSamples {
	unit: "ms";
	samples: number[];
	summary: SampleSummary;
}

export interface HeapObservation {
	stage: string;
	heapUsedBytes?: number | undefined;
	totalHeapBytes?: number | undefined;
	explicitGcAvailable: boolean;
	kind: "collected-heap" | "retained-heap-observation" | "missing";
	missingReason?: string | undefined;
}

export interface FixtureCounts {
	people: number;
	relationships: number;
	nodes: number;
	edges: number;
}

export function summarizeSamples(samples: number[]): SampleSummary {
	if (samples.length === 0) throw new Error("At least one performance sample is required.");
	if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
		throw new Error("Performance samples must be finite, non-negative numbers.");
	}
	const ordered = [...samples].sort((left, right) => left - right);
	const middle = Math.floor(ordered.length / 2);
	const lower = ordered[middle - 1];
	const upper = ordered[middle];
	const median = ordered.length % 2 === 0
		? ((lower ?? 0) + (upper ?? 0)) / 2
		: (upper ?? 0);
	const p95Index = Math.max(0, Math.ceil(ordered.length * 0.95) - 1);
	return {
		min: ordered[0] ?? 0,
		median,
		p95: ordered[p95Index] ?? 0,
		max: ordered.at(-1) ?? 0,
	};
}

export function timingSamples(samples: number[]): TimingSamples {
	return {
		unit: "ms",
		samples,
		summary: summarizeSamples(samples),
	};
}
