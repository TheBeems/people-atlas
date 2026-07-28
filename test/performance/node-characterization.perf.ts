import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { AtlasSnapshot, RawIndexSnapshot } from "../../src/domain/types";
import { buildAtlasSnapshot } from "../../src/graph/build-snapshot";
import { applyGraphDelta } from "../../src/graph/graph-delta";
import { projectGraph } from "../../src/graph/project-graph";
import { IndexState } from "../../src/index/index-state";
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
	PERFORMANCE_RUNNER_VERSION,
	PERFORMANCE_SIZES,
	timingSamples,
	type FixtureCounts,
	type HeapObservation,
	type PerformanceProfile,
	type PerformanceSize,
	type TimingSamples,
} from "./performance-model";

type NodeStage =
	| "index-populate-and-snapshot"
	| "canonical-snapshot"
	| "free-network-projection"
	| "deterministic-layout"
	| "incremental-recomputation";

interface NodeCaseResult {
	size: PerformanceSize;
	profile: PerformanceProfile;
	counts: FixtureCounts;
	warmups: number;
	recordedSamples: number;
	timings: Record<NodeStage, TimingSamples>;
	memory: HeapObservation[];
}

interface NodeCharacterizationResult {
	runnerVersion: typeof PERFORMANCE_RUNNER_VERSION;
	fixtureContractVersion: typeof FIXTURE_CONTRACT_VERSION;
	runtime: {
		node: string;
		explicitGcAvailable: boolean;
	};
	cases: NodeCaseResult[];
	missingData: string[];
}

interface PipelineResult {
	raw: RawIndexSnapshot;
	snapshot: AtlasSnapshot;
	projected: AtlasSnapshot;
	incremental: AtlasSnapshot;
	durations: Record<NodeStage, number>;
}

function populateIndex(fixture: PerformanceFixture): RawIndexSnapshot {
	const index = new IndexState();
	for (const file of fixture.files) index.upsert(file);
	return index.getSnapshot();
}

function runPipeline(fixture: PerformanceFixture, scenario: IncrementalFixtureScenario): PipelineResult {
	const durations = {} as Record<NodeStage, number>;
	let startedAt = performance.now();
	const raw = populateIndex(fixture);
	durations["index-populate-and-snapshot"] = performance.now() - startedAt;
	if (raw.people.length !== fixture.size || raw.relationships.length !== fixture.size * fixture.offsets) {
		throw new Error("Indexed raw snapshot does not retain exact fixture counts.");
	}

	startedAt = performance.now();
	const snapshot = buildAtlasSnapshot(raw, () => undefined);
	durations["canonical-snapshot"] = performance.now() - startedAt;
	validateSnapshotCounts(fixture, snapshot);

	startedAt = performance.now();
	const projected = projectGraph(snapshot, {
		centerMode: "none",
		projectionMode: "free-network",
		maxNodes: fixture.size,
	});
	durations["free-network-projection"] = performance.now() - startedAt;
	validateSnapshotCounts(fixture, projected);

	startedAt = performance.now();
	const positions = createDeterministicLayout(projected);
	durations["deterministic-layout"] = performance.now() - startedAt;
	if (positions.size !== fixture.size) throw new Error("Layout omitted fixture nodes.");

	startedAt = performance.now();
	const incremental = applyGraphDelta(snapshot, scenario.delta, () => undefined, {
		resolutionPeople: scenario.raw.people,
	});
	const projectedIncremental = projectGraph(incremental, {
		centerMode: "none",
		projectionMode: "free-network",
		maxNodes: fixture.size,
	});
	const incrementalPositions = createDeterministicLayout(projectedIncremental);
	durations["incremental-recomputation"] = performance.now() - startedAt;
	validateSnapshotCounts(fixture, incremental);
	if (incrementalPositions.size !== fixture.size) {
		throw new Error("Incremental recomputation layout omitted fixture nodes.");
	}
	return { raw, snapshot, projected, incremental, durations };
}

function collectNodeHeap(stage: string): HeapObservation {
	const explicitGc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
	try {
		explicitGc?.();
		const memory = process.memoryUsage();
		return {
			stage,
			heapUsedBytes: memory.heapUsed,
			totalHeapBytes: memory.heapTotal,
			explicitGcAvailable: explicitGc !== undefined,
			kind: explicitGc ? "collected-heap" : "retained-heap-observation",
		};
	} catch (error) {
		return {
			stage,
			explicitGcAvailable: explicitGc !== undefined,
			kind: "missing",
			missingReason: error instanceof Error ? error.message : String(error),
		};
	}
}

function collectCaseMemory(size: PerformanceSize, profile: PerformanceProfile): HeapObservation[] {
	const memory: HeapObservation[] = [collectNodeHeap("before-fixture")];
	const fixture = generatePerformanceFixture(size, profile);
	const scenario = createIncrementalFixtureScenario(fixture);
	memory.push(collectNodeHeap("after-fixture"));

	const raw = populateIndex(fixture);
	memory.push(collectNodeHeap("after-index-populate-and-snapshot"));
	const snapshot = buildAtlasSnapshot(raw, () => undefined);
	memory.push(collectNodeHeap("after-canonical-snapshot"));
	const projected = projectGraph(snapshot, {
		centerMode: "none",
		projectionMode: "free-network",
		maxNodes: size,
	});
	memory.push(collectNodeHeap("after-free-network-projection"));
	const positions = createDeterministicLayout(projected);
	if (positions.size !== size) throw new Error("Memory layout case omitted fixture nodes.");
	memory.push(collectNodeHeap("after-deterministic-layout"));
	const incremental = applyGraphDelta(snapshot, scenario.delta, () => undefined, {
		resolutionPeople: scenario.raw.people,
	});
	const incrementalProjection = projectGraph(incremental, {
		centerMode: "none",
		projectionMode: "free-network",
		maxNodes: size,
	});
	const incrementalPositions = createDeterministicLayout(incrementalProjection);
	if (incrementalPositions.size !== size) throw new Error("Memory incremental case omitted fixture nodes.");
	memory.push(collectNodeHeap("after-incremental-recomputation"));
	return memory;
}

function characterizeCase(size: PerformanceSize, profile: PerformanceProfile): NodeCaseResult {
	const fixture = generatePerformanceFixture(size, profile);
	validatePerformanceFixture(fixture);
	const baseline = buildPerformanceSnapshot(fixture.raw);
	const counts = validateSnapshotCounts(fixture, baseline);
	const scenario = createIncrementalFixtureScenario(fixture);
	const incremental = applyGraphDelta(baseline, scenario.delta, () => undefined, {
		resolutionPeople: scenario.raw.people,
	});
	assertStableIncrementalIdentities(baseline, incremental, scenario);
	assertEquivalentSnapshots(incremental, buildPerformanceSnapshot(scenario.raw));

	for (let warmup = 0; warmup < NODE_WARMUP_COUNT; warmup += 1) {
		runPipeline(fixture, scenario);
	}
	const samples: Record<NodeStage, number[]> = {
		"index-populate-and-snapshot": [],
		"canonical-snapshot": [],
		"free-network-projection": [],
		"deterministic-layout": [],
		"incremental-recomputation": [],
	};
	for (let sample = 0; sample < NODE_SAMPLE_COUNT; sample += 1) {
		const result = runPipeline(fixture, scenario);
		for (const stage of Object.keys(samples) as NodeStage[]) {
			samples[stage].push(result.durations[stage]);
		}
	}
	return {
		size,
		profile,
		counts,
		warmups: NODE_WARMUP_COUNT,
		recordedSamples: NODE_SAMPLE_COUNT,
		timings: {
			"index-populate-and-snapshot": timingSamples(samples["index-populate-and-snapshot"]),
			"canonical-snapshot": timingSamples(samples["canonical-snapshot"]),
			"free-network-projection": timingSamples(samples["free-network-projection"]),
			"deterministic-layout": timingSamples(samples["deterministic-layout"]),
			"incremental-recomputation": timingSamples(samples["incremental-recomputation"]),
		},
		memory: collectCaseMemory(size, profile),
	};
}

describe("P6a Node performance characterization", () => {
	it("records every ratified fixture case", async () => {
		const outputPath = process.env.PEOPLE_ATLAS_PERF_NODE_OUTPUT;
		if (!outputPath) throw new Error("PEOPLE_ATLAS_PERF_NODE_OUTPUT is required.");
		const cases: NodeCaseResult[] = [];
		for (const size of PERFORMANCE_SIZES) {
			for (const profile of PERFORMANCE_PROFILES) {
				cases.push(characterizeCase(size, profile));
			}
		}
		const missingData = cases.flatMap((result) =>
			result.memory
				.filter((observation) => observation.kind === "missing")
				.map(
					(observation) =>
						`${result.profile}/${result.size}/${observation.stage}: ${observation.missingReason ?? "unknown reason"}`,
				),
		);
		const result: NodeCharacterizationResult = {
			runnerVersion: PERFORMANCE_RUNNER_VERSION,
			fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
			runtime: {
				node: process.version,
				explicitGcAvailable: (globalThis as typeof globalThis & { gc?: () => void }).gc !== undefined,
			},
			cases,
			missingData,
		};
		await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
		expect(cases).toHaveLength(PERFORMANCE_SIZES.length * PERFORMANCE_PROFILES.length);
	}, 1_200_000);
});
