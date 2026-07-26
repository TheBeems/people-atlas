import { describe, expect, it } from "vitest";
import {
	buildScalingTrend,
	garbageCollectionStatements,
	validateCombinedPerformanceResults,
	validateGraphDeltaPerformanceResult,
} from "../scripts/performance-result.mjs";
import {
	applyPerformanceIncrementalScenario,
	assertEquivalentSnapshots,
	assertStableIncrementalIdentities,
	buildPerformanceSnapshot,
	createIncrementalFixtureScenario,
	generatePerformanceFixture,
	snapshotStructure,
	validatePerformanceFixture,
	validateSnapshotCounts,
} from "./performance/fixture";
import {
	BROWSER_SAMPLE_COUNT,
	BROWSER_WARMUP_COUNT,
	FIXTURE_CONTRACT_VERSION,
	INTERACTION_FRAME_COUNT,
	NODE_SAMPLE_COUNT,
	NODE_WARMUP_COUNT,
	PERFORMANCE_PROFILES,
	PERFORMANCE_RUNNER_VERSION,
	PERFORMANCE_SIZES,
	summarizeSamples,
	timingSamples,
} from "./performance/performance-model";

describe("performance characterization fixtures", () => {
	it("generates exact deterministic sparse and stress counts at every ratified size", () => {
		for (const size of PERFORMANCE_SIZES) {
			for (const profile of PERFORMANCE_PROFILES) {
				const fixture = generatePerformanceFixture(size, profile);
				validatePerformanceFixture(fixture);
				const snapshot = buildPerformanceSnapshot(fixture.raw);
				const counts = validateSnapshotCounts(fixture, snapshot);
				expect(counts).toEqual({
					people: size,
					relationships: size * (profile === "sparse" ? 2 : 8),
					nodes: size,
					edges: size * (profile === "sparse" ? 2 : 8),
				});
			}
		}
	});

	it("uses stable order and values without random or wall-clock inputs", () => {
		const first = generatePerformanceFixture(1_000, "sparse");
		const second = generatePerformanceFixture(1_000, "sparse");
		expect(second).toEqual(first);
		expect(snapshotStructure(buildPerformanceSnapshot(second.raw))).toEqual(
			snapshotStructure(buildPerformanceSnapshot(first.raw)),
		);
	});

	it("keeps incremental identities and matches a complete rebuild", () => {
		const fixture = generatePerformanceFixture(100, "stress");
		const before = buildPerformanceSnapshot(fixture.raw);
		const scenario = createIncrementalFixtureScenario(fixture);
		const incremental = applyPerformanceIncrementalScenario(before, scenario);
		const rebuilt = buildPerformanceSnapshot(scenario.raw);
		assertStableIncrementalIdentities(before, incremental, scenario);
		assertEquivalentSnapshots(incremental, rebuilt);
		expect(incremental.nodes.find((node) => node.id === scenario.person.id)?.label).toContain("updated");
		expect(incremental.edges.find((edge) => edge.id === scenario.relationship.id)?.types).toContain("updated");
	});
});

describe("performance result statistics", () => {
	it("reports raw-sample summary boundaries with a nearest-rank p95", () => {
		expect(summarizeSamples([4, 1, 3, 2])).toEqual({
			min: 1,
			median: 2.5,
			p95: 4,
			max: 4,
		});
	});

	it("rejects empty, negative and non-finite result samples", () => {
		expect(() => summarizeSamples([])).toThrow(/at least one/i);
		expect(() => summarizeSamples([1, -1])).toThrow(/finite, non-negative/i);
		expect(() => summarizeSamples([Number.NaN])).toThrow(/finite, non-negative/i);
		expect(() => summarizeSamples([Number.POSITIVE_INFINITY])).toThrow(/finite, non-negative/i);
	});
});

function validPartialResults(): { node: Record<string, unknown>; browser: Record<string, unknown> } {
	const nodeStages = [
		"index-populate-and-snapshot",
		"canonical-snapshot",
		"free-network-projection",
		"deterministic-layout",
		"incremental-recomputation",
	];
	const browserStages = [
		"snapshot-and-semantic-dom",
		"canvas-first-paint",
		"list-mode-transition",
		"graph-mode-transition",
		"incremental-replacement",
		"incremental-canvas-paint",
		"lifecycle-cleanup",
	];
	const cases = (surface: "node" | "browser"): Array<Record<string, unknown>> => (
		PERFORMANCE_PROFILES.flatMap((profile, profileIndex) => PERFORMANCE_SIZES.map((size, sizeIndex) => {
			const sampleCount = surface === "node" ? NODE_SAMPLE_COUNT : BROWSER_SAMPLE_COUNT;
			const sampleValue = (profileIndex + 1) * (sizeIndex + 1);
			const stages = surface === "node" ? nodeStages : browserStages;
			const result: Record<string, unknown> = {
				size,
				profile,
				counts: {
					people: size,
					relationships: size * (profile === "sparse" ? 2 : 8),
					nodes: size,
					edges: size * (profile === "sparse" ? 2 : 8),
				},
				warmups: surface === "node" ? NODE_WARMUP_COUNT : BROWSER_WARMUP_COUNT,
				recordedSamples: sampleCount,
				timings: Object.fromEntries(stages.map((stage) => [
					stage,
					timingSamples(Array.from({ length: sampleCount }, () => sampleValue)),
				])),
				memory: [],
			};
			if (surface === "browser") {
				result.interaction = {
					recordedFrames: INTERACTION_FRAME_COUNT,
					timing: timingSamples(Array.from({ length: INTERACTION_FRAME_COUNT }, () => sampleValue)),
					redrawTriggers: INTERACTION_FRAME_COUNT * 2,
					requestedAnimationFrames: INTERACTION_FRAME_COUNT,
					executedAnimationFrames: INTERACTION_FRAME_COUNT,
					coalescedTriggers: INTERACTION_FRAME_COUNT,
				};
				result.cleanupVerified = true;
			}
			return result;
		}))
	);
	return {
		node: {
			runnerVersion: PERFORMANCE_RUNNER_VERSION,
			fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
			runtime: { node: process.version, explicitGcAvailable: false },
			cases: cases("node"),
			missingData: [],
		},
		browser: {
			runnerVersion: PERFORMANCE_RUNNER_VERSION,
			fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
			cases: cases("browser"),
			missingData: [],
		},
	};
}

function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function validGraphDeltaResult(): Record<string, unknown> {
	return {
		runnerVersion: "p6b-graph-delta-v1",
		fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
		runtime: { node: process.version },
		cases: PERFORMANCE_PROFILES.flatMap((profile) => PERFORMANCE_SIZES.map((size) => ({
			size,
			profile,
			counts: {
				people: size,
				relationships: size * (profile === "sparse" ? 2 : 8),
				nodes: size,
				edges: size * (profile === "sparse" ? 2 : 8),
			},
			warmups: NODE_WARMUP_COUNT,
			recordedSamples: NODE_SAMPLE_COUNT,
			timings: {
				"graph-delta": timingSamples(Array.from({ length: NODE_SAMPLE_COUNT }, () => 8)),
				"incremental-projection": timingSamples(Array.from({ length: NODE_SAMPLE_COUNT }, () => 1)),
				"incremental-layout": timingSamples(Array.from({ length: NODE_SAMPLE_COUNT }, () => 1)),
				"incremental-recomputation": timingSamples(Array.from({ length: NODE_SAMPLE_COUNT }, () => 10)),
			},
		}))),
	};
}

describe("combined performance result validation", () => {
	it("accepts the complete semantic result and derives its ordered scaling trend", () => {
		const result = validPartialResults();
		expect(() => validateCombinedPerformanceResults(result.node, result.browser)).not.toThrow();
		const trend = buildScalingTrend(result.node as unknown as Parameters<typeof buildScalingTrend>[0]);
		expect(trend.points.map((point) => point.size)).toEqual([100, 1_000, 5_000]);
		expect(trend.points.map((point) => point.medianMs)).toEqual([2, 4, 6]);
		expect(trend.growth.map((step) => step.medianRatio)).toEqual([2, 1.5]);
	});

	it("describes Node and Chromium explicit-GC availability independently", () => {
		const result = validPartialResults();
		for (const resultCase of result.browser.cases as Array<Record<string, unknown>>) {
			resultCase.memory = [{ explicitGcAvailable: true }];
		}
		const statements = garbageCollectionStatements(
			result.node as { runtime: { explicitGcAvailable: boolean } },
			result.browser as unknown as Parameters<typeof garbageCollectionStatements>[1],
		);
		expect(statements.node).toMatch(/Node explicit GC was unavailable/i);
		expect(statements.chromium).toMatch(/available for all 6 heap observations/i);
		expect(statements.node).not.toMatch(/every required/i);
	});

	it("rejects missing and duplicate size-profile cases", () => {
		const missing = validPartialResults();
		(missing.node.cases as unknown[]).pop();
		expect(() => validateCombinedPerformanceResults(missing.node, missing.browser)).toThrow(/missing case/i);

		const duplicate = validPartialResults();
		(duplicate.browser.cases as unknown[]).push(deepCopy((duplicate.browser.cases as unknown[])[0]));
		expect(() => validateCombinedPerformanceResults(duplicate.node, duplicate.browser)).toThrow(/duplicate case/i);
	});

	it("rejects missing stages and wrong raw-sample cardinalities", () => {
		const missingStage = validPartialResults();
		const firstNodeCase = (missingStage.node.cases as Array<Record<string, unknown>>)[0];
		delete (firstNodeCase?.timings as Record<string, unknown>)["canonical-snapshot"];
		expect(() => validateCombinedPerformanceResults(missingStage.node, missingStage.browser)).toThrow(/missing stage/i);

		const wrongSamples = validPartialResults();
		const firstBrowserCase = (wrongSamples.browser.cases as Array<Record<string, unknown>>)[0];
		const timing = (firstBrowserCase?.timings as Record<string, { samples: number[] }>)[
			"snapshot-and-semantic-dom"
		];
		timing?.samples.pop();
		expect(() => validateCombinedPerformanceResults(wrongSamples.node, wrongSamples.browser)).toThrow(
			/exactly 10 raw samples/i,
		);
	});

	it("rejects invalid fixture counts and summaries inconsistent with raw samples", () => {
		const wrongCounts = validPartialResults();
		const firstNodeCase = (wrongCounts.node.cases as Array<Record<string, unknown>>)[0];
		const counts = firstNodeCase?.counts as Record<string, number>;
		counts.edges = (counts.edges ?? 0) + 1;
		expect(() => validateCombinedPerformanceResults(wrongCounts.node, wrongCounts.browser)).toThrow(
			/counts.edges/i,
		);

		const wrongSummary = validPartialResults();
		const firstBrowserCase = (wrongSummary.browser.cases as Array<Record<string, unknown>>)[0];
		const timing = (firstBrowserCase?.timings as Record<string, { summary: { p95: number } }>)[
			"canvas-first-paint"
		];
		if (timing) timing.summary.p95 += 1;
		expect(() => validateCombinedPerformanceResults(wrongSummary.node, wrongSummary.browser)).toThrow(
			/does not match its raw samples/i,
		);
	});
});

describe("graph-delta performance result validation", () => {
	it("accepts the complete direct-substage matrix", () => {
		expect(() => validateGraphDeltaPerformanceResult(validGraphDeltaResult())).not.toThrow();
	});

	it("rejects missing substages and aggregate samples smaller than their substages", () => {
		const missingStage = validGraphDeltaResult();
		const firstCase = (missingStage.cases as Array<Record<string, unknown>>)[0];
		delete (firstCase?.timings as Record<string, unknown>)["graph-delta"];
		expect(() => validateGraphDeltaPerformanceResult(missingStage)).toThrow(/missing stage/i);

		const invalidAggregate = validGraphDeltaResult();
		const invalidFirstCase = (invalidAggregate.cases as Array<Record<string, unknown>>)[0];
		const aggregate = (invalidFirstCase?.timings as Record<string, {
			samples: number[];
			summary: { min: number; median: number; p95: number; max: number };
		}>)["incremental-recomputation"];
		if (aggregate) {
			aggregate.samples = Array.from({ length: NODE_SAMPLE_COUNT }, () => 9);
			aggregate.summary = { min: 9, median: 9, p95: 9, max: 9 };
		}
		expect(() => validateGraphDeltaPerformanceResult(invalidAggregate)).toThrow(/smaller than its substages/i);
	});
});
