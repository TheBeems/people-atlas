import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { AtlasSnapshot } from "../../src/domain/types";
import { applyGraphDelta } from "../../src/graph/graph-delta";
import { projectGraph } from "../../src/graph/project-graph";
import { createDeterministicLayout } from "../../src/render/layout";
import {
	assertEquivalentSnapshots,
	assertStableIncrementalIdentities,
	buildPerformanceSnapshot,
	createIncrementalFixtureScenario,
	generatePerformanceFixture,
	validatePerformanceFixture,
	validateSnapshotCounts,
	type IncrementalFixtureScenario,
	type PerformanceFixture,
} from "./fixture";
import {
	FIXTURE_CONTRACT_VERSION,
	NODE_SAMPLE_COUNT,
	NODE_WARMUP_COUNT,
	PERFORMANCE_PROFILES,
	PERFORMANCE_SIZES,
	timingSamples,
	type FixtureCounts,
	type PerformanceProfile,
	type PerformanceSize,
	type TimingSamples,
} from "./performance-model";

export const GRAPH_DELTA_RUNNER_VERSION = "p6b-graph-delta-v1";

type GraphDeltaStage =
	| "graph-delta"
	| "incremental-projection"
	| "incremental-layout"
	| "incremental-recomputation";

interface GraphDeltaCaseResult {
	size: PerformanceSize;
	profile: PerformanceProfile;
	counts: FixtureCounts;
	warmups: number;
	recordedSamples: number;
	timings: Record<GraphDeltaStage, TimingSamples>;
}

interface GraphDeltaCharacterizationResult {
	runnerVersion: typeof GRAPH_DELTA_RUNNER_VERSION;
	fixtureContractVersion: typeof FIXTURE_CONTRACT_VERSION;
	runtime: {
		node: string;
	};
	cases: GraphDeltaCaseResult[];
}

function runIncrementalPipeline(
	fixture: PerformanceFixture,
	baseline: AtlasSnapshot,
	scenario: IncrementalFixtureScenario,
): Record<GraphDeltaStage, number> {
	const aggregateStartedAt = performance.now();

	let startedAt = performance.now();
	const incremental = applyGraphDelta(
		baseline,
		scenario.delta,
		() => undefined,
		{ resolutionPeople: scenario.raw.people },
	);
	const graphDeltaDuration = performance.now() - startedAt;

	startedAt = performance.now();
	const projected = projectGraph(incremental, {
		centerMode: "none",
		projectionMode: "free-network",
		maxNodes: fixture.size,
	});
	const projectionDuration = performance.now() - startedAt;

	startedAt = performance.now();
	const positions = createDeterministicLayout(projected);
	const layoutDuration = performance.now() - startedAt;
	const aggregateDuration = performance.now() - aggregateStartedAt;

	validateSnapshotCounts(fixture, incremental);
	if (positions.size !== fixture.size) {
		throw new Error("Incremental graph-delta characterization layout omitted fixture nodes.");
	}
	return {
		"graph-delta": graphDeltaDuration,
		"incremental-projection": projectionDuration,
		"incremental-layout": layoutDuration,
		"incremental-recomputation": aggregateDuration,
	};
}

function characterizeCase(
	size: PerformanceSize,
	profile: PerformanceProfile,
): GraphDeltaCaseResult {
	const fixture = generatePerformanceFixture(size, profile);
	validatePerformanceFixture(fixture);
	const baseline = buildPerformanceSnapshot(fixture.raw);
	const counts = validateSnapshotCounts(fixture, baseline);
	const scenario = createIncrementalFixtureScenario(fixture);
	const incremental = applyGraphDelta(
		baseline,
		scenario.delta,
		() => undefined,
		{ resolutionPeople: scenario.raw.people },
	);
	assertStableIncrementalIdentities(baseline, incremental, scenario);
	assertEquivalentSnapshots(incremental, buildPerformanceSnapshot(scenario.raw));

	for (let warmup = 0; warmup < NODE_WARMUP_COUNT; warmup += 1) {
		runIncrementalPipeline(fixture, baseline, scenario);
	}
	const samples: Record<GraphDeltaStage, number[]> = {
		"graph-delta": [],
		"incremental-projection": [],
		"incremental-layout": [],
		"incremental-recomputation": [],
	};
	for (let sample = 0; sample < NODE_SAMPLE_COUNT; sample += 1) {
		const durations = runIncrementalPipeline(fixture, baseline, scenario);
		for (const stage of Object.keys(samples) as GraphDeltaStage[]) {
			samples[stage].push(durations[stage]);
		}
	}
	return {
		size,
		profile,
		counts,
		warmups: NODE_WARMUP_COUNT,
		recordedSamples: NODE_SAMPLE_COUNT,
		timings: {
			"graph-delta": timingSamples(samples["graph-delta"]),
			"incremental-projection": timingSamples(samples["incremental-projection"]),
			"incremental-layout": timingSamples(samples["incremental-layout"]),
			"incremental-recomputation": timingSamples(samples["incremental-recomputation"]),
		},
	};
}

describe("P6b graph-delta performance characterization", () => {
	it("records every deterministic fixture case with direct incremental substages", async () => {
		const outputPath = process.env.PEOPLE_ATLAS_GRAPH_DELTA_PERF_OUTPUT;
		if (!outputPath) throw new Error("PEOPLE_ATLAS_GRAPH_DELTA_PERF_OUTPUT is required.");
		const cases: GraphDeltaCaseResult[] = [];
		for (const size of PERFORMANCE_SIZES) {
			for (const profile of PERFORMANCE_PROFILES) {
				cases.push(characterizeCase(size, profile));
			}
		}
		const result: GraphDeltaCharacterizationResult = {
			runnerVersion: GRAPH_DELTA_RUNNER_VERSION,
			fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
			runtime: {
				node: process.version,
			},
			cases,
		};
		await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
		expect(cases).toHaveLength(PERFORMANCE_SIZES.length * PERFORMANCE_PROFILES.length);
	}, 1_200_000);
});
