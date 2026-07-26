export const EXPECTED_PERFORMANCE_SIZES = [100, 1_000, 5_000];
export const EXPECTED_PERFORMANCE_PROFILES = ["sparse", "stress"];
export const EXPECTED_NODE_STAGES = [
	"index-populate-and-snapshot",
	"canonical-snapshot",
	"free-network-projection",
	"deterministic-layout",
	"incremental-recomputation",
];
export const EXPECTED_BROWSER_STAGES = [
	"snapshot-and-semantic-dom",
	"canvas-first-paint",
	"list-mode-transition",
	"graph-mode-transition",
	"incremental-replacement",
	"incremental-canvas-paint",
	"lifecycle-cleanup",
];
export const EXPECTED_GRAPH_DELTA_STAGES = [
	"graph-delta",
	"incremental-projection",
	"incremental-layout",
	"incremental-recomputation",
];

const EXPECTED_RUNNER_VERSION = "p6a-characterization-v1";
const EXPECTED_GRAPH_DELTA_RUNNER_VERSION = "p6b-graph-delta-v1";
const EXPECTED_FIXTURE_CONTRACT_VERSION = "p6a-ring-lattice-v1";
const NODE_WARMUPS = 5;
const NODE_SAMPLES = 20;
const BROWSER_WARMUPS = 3;
const BROWSER_SAMPLES = 10;
const INTERACTION_SAMPLES = 30;

function fail(message) {
	throw new Error(`Invalid performance result: ${message}`);
}

function objectValue(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
	return value;
}

function finiteNumber(value, label) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		fail(`${label} must be a finite, non-negative number.`);
	}
	return value;
}

function summarize(samples) {
	if (!Array.isArray(samples) || samples.length === 0) fail("timing samples must be a non-empty array.");
	const ordered = samples.map((sample, index) => finiteNumber(sample, `sample ${index}`))
		.sort((left, right) => left - right);
	const middle = Math.floor(ordered.length / 2);
	const median = ordered.length % 2 === 0
		? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
		: (ordered[middle] ?? 0);
	return {
		min: ordered[0] ?? 0,
		median,
		p95: ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0,
		max: ordered.at(-1) ?? 0,
	};
}

function validateSummary(actual, expected, label) {
	const summary = objectValue(actual, `${label}.summary`);
	for (const field of ["min", "median", "p95", "max"]) {
		const observed = finiteNumber(summary[field], `${label}.summary.${field}`);
		if (Math.abs(observed - expected[field]) > 1e-9) {
			fail(`${label}.summary.${field} does not match its raw samples.`);
		}
	}
}

function validateTiming(value, expectedSamples, label) {
	const timing = objectValue(value, label);
	if (timing.unit !== "ms") fail(`${label}.unit must be "ms".`);
	if (!Array.isArray(timing.samples) || timing.samples.length !== expectedSamples) {
		fail(`${label} must contain exactly ${expectedSamples} raw samples.`);
	}
	validateSummary(timing.summary, summarize(timing.samples), label);
}

function validateStages(timingsValue, stages, expectedSamples, label) {
	const timings = objectValue(timingsValue, `${label}.timings`);
	const actualStages = Object.keys(timings);
	for (const stage of stages) {
		if (!Object.hasOwn(timings, stage)) fail(`${label} is missing stage "${stage}".`);
		validateTiming(timings[stage], expectedSamples, `${label}.timings.${stage}`);
	}
	for (const stage of actualStages) {
		if (!stages.includes(stage)) fail(`${label} has unexpected stage "${stage}".`);
	}
}

function validateCounts(countsValue, size, profile, label) {
	const counts = objectValue(countsValue, `${label}.counts`);
	const relationshipCount = size * (profile === "sparse" ? 2 : 8);
	const expected = {
		people: size,
		relationships: relationshipCount,
		nodes: size,
		edges: relationshipCount,
	};
	for (const [field, value] of Object.entries(expected)) {
		if (counts[field] !== value) fail(`${label}.counts.${field} must equal ${value}.`);
	}
}

function validateInteraction(value, label) {
	const interaction = objectValue(value, `${label}.interaction`);
	if (interaction.recordedFrames !== INTERACTION_SAMPLES) {
		fail(`${label}.interaction.recordedFrames must equal ${INTERACTION_SAMPLES}.`);
	}
	validateTiming(interaction.timing, INTERACTION_SAMPLES, `${label}.interaction.timing`);
	for (const field of [
		"redrawTriggers",
		"requestedAnimationFrames",
		"executedAnimationFrames",
		"coalescedTriggers",
	]) {
		finiteNumber(interaction[field], `${label}.interaction.${field}`);
	}
	if (interaction.requestedAnimationFrames !== INTERACTION_SAMPLES) {
		fail(`${label}.interaction.requestedAnimationFrames must equal ${INTERACTION_SAMPLES}.`);
	}
	if (interaction.executedAnimationFrames !== INTERACTION_SAMPLES) {
		fail(`${label}.interaction.executedAnimationFrames must equal ${INTERACTION_SAMPLES}.`);
	}
	if (interaction.coalescedTriggers !== interaction.redrawTriggers - interaction.requestedAnimationFrames) {
		fail(`${label}.interaction coalescing arithmetic is inconsistent.`);
	}
}

function validateCases(partial, surface) {
	const cases = partial.cases;
	if (!Array.isArray(cases)) fail(`${surface}.cases must be an array.`);
	const expectedStages = surface === "node" ? EXPECTED_NODE_STAGES : EXPECTED_BROWSER_STAGES;
	const expectedWarmups = surface === "node" ? NODE_WARMUPS : BROWSER_WARMUPS;
	const expectedSamples = surface === "node" ? NODE_SAMPLES : BROWSER_SAMPLES;
	const seen = new Set();
	for (const [index, resultCaseValue] of cases.entries()) {
		const resultCase = objectValue(resultCaseValue, `${surface}.cases[${index}]`);
		if (!EXPECTED_PERFORMANCE_SIZES.includes(resultCase.size)) {
			fail(`${surface}.cases[${index}] has unsupported size ${String(resultCase.size)}.`);
		}
		if (!EXPECTED_PERFORMANCE_PROFILES.includes(resultCase.profile)) {
			fail(`${surface}.cases[${index}] has unsupported profile ${String(resultCase.profile)}.`);
		}
		const key = `${resultCase.profile}/${resultCase.size}`;
		if (seen.has(key)) fail(`${surface} contains duplicate case ${key}.`);
		seen.add(key);
		validateCounts(resultCase.counts, resultCase.size, resultCase.profile, `${surface}.${key}`);
		if (resultCase.warmups !== expectedWarmups) {
			fail(`${surface}.${key}.warmups must equal ${expectedWarmups}.`);
		}
		if (resultCase.recordedSamples !== expectedSamples) {
			fail(`${surface}.${key}.recordedSamples must equal ${expectedSamples}.`);
		}
		validateStages(resultCase.timings, expectedStages, expectedSamples, `${surface}.${key}`);
		if (surface === "browser") {
			validateInteraction(resultCase.interaction, `${surface}.${key}`);
			if (resultCase.cleanupVerified !== true) fail(`${surface}.${key}.cleanupVerified must be true.`);
		}
	}
	for (const profile of EXPECTED_PERFORMANCE_PROFILES) {
		for (const size of EXPECTED_PERFORMANCE_SIZES) {
			const key = `${profile}/${size}`;
			if (!seen.has(key)) fail(`${surface} is missing case ${key}.`);
		}
	}
}

export function validateCombinedPerformanceResults(nodeResultValue, browserResultValue) {
	const nodeResult = objectValue(nodeResultValue, "node result");
	const browserResult = objectValue(browserResultValue, "browser result");
	for (const [surface, partial] of [["node", nodeResult], ["browser", browserResult]]) {
		if (partial.runnerVersion !== EXPECTED_RUNNER_VERSION) {
			fail(`${surface}.runnerVersion is incompatible.`);
		}
		if (partial.fixtureContractVersion !== EXPECTED_FIXTURE_CONTRACT_VERSION) {
			fail(`${surface}.fixtureContractVersion is incompatible.`);
		}
		if (!Array.isArray(partial.missingData)) fail(`${surface}.missingData must be an array.`);
	}
	if (typeof nodeResult.runtime?.explicitGcAvailable !== "boolean") {
		fail("node.runtime.explicitGcAvailable must be boolean.");
	}
	validateCases(nodeResult, "node");
	validateCases(browserResult, "browser");
}

export function validateGraphDeltaPerformanceResult(resultValue) {
	const result = objectValue(resultValue, "graph-delta result");
	if (result.runnerVersion !== EXPECTED_GRAPH_DELTA_RUNNER_VERSION) {
		fail("graph-delta runnerVersion is incompatible.");
	}
	if (result.fixtureContractVersion !== EXPECTED_FIXTURE_CONTRACT_VERSION) {
		fail("graph-delta fixtureContractVersion is incompatible.");
	}
	if (typeof result.runtime?.node !== "string" || result.runtime.node.length === 0) {
		fail("graph-delta runtime.node must be a non-empty string.");
	}
	if (!Array.isArray(result.cases)) fail("graph-delta.cases must be an array.");
	const seen = new Set();
	for (const [index, resultCaseValue] of result.cases.entries()) {
		const resultCase = objectValue(resultCaseValue, `graph-delta.cases[${index}]`);
		if (!EXPECTED_PERFORMANCE_SIZES.includes(resultCase.size)) {
			fail(`graph-delta.cases[${index}] has unsupported size ${String(resultCase.size)}.`);
		}
		if (!EXPECTED_PERFORMANCE_PROFILES.includes(resultCase.profile)) {
			fail(`graph-delta.cases[${index}] has unsupported profile ${String(resultCase.profile)}.`);
		}
		const key = `${resultCase.profile}/${resultCase.size}`;
		if (seen.has(key)) fail(`graph-delta contains duplicate case ${key}.`);
		seen.add(key);
		validateCounts(resultCase.counts, resultCase.size, resultCase.profile, `graph-delta.${key}`);
		if (resultCase.warmups !== NODE_WARMUPS) {
			fail(`graph-delta.${key}.warmups must equal ${NODE_WARMUPS}.`);
		}
		if (resultCase.recordedSamples !== NODE_SAMPLES) {
			fail(`graph-delta.${key}.recordedSamples must equal ${NODE_SAMPLES}.`);
		}
		validateStages(
			resultCase.timings,
			EXPECTED_GRAPH_DELTA_STAGES,
			NODE_SAMPLES,
			`graph-delta.${key}`,
		);
		const aggregateSamples = resultCase.timings["incremental-recomputation"].samples;
		for (let sampleIndex = 0; sampleIndex < NODE_SAMPLES; sampleIndex += 1) {
			const substageTotal = (
				resultCase.timings["graph-delta"].samples[sampleIndex]
				+ resultCase.timings["incremental-projection"].samples[sampleIndex]
				+ resultCase.timings["incremental-layout"].samples[sampleIndex]
			);
			if (aggregateSamples[sampleIndex] + 1e-9 < substageTotal) {
				fail(`graph-delta.${key} aggregate sample ${sampleIndex} is smaller than its substages.`);
			}
		}
	}
	for (const profile of EXPECTED_PERFORMANCE_PROFILES) {
		for (const size of EXPECTED_PERFORMANCE_SIZES) {
			const key = `${profile}/${size}`;
			if (!seen.has(key)) fail(`graph-delta is missing case ${key}.`);
		}
	}
}

export function buildScalingTrend(nodeResult, stage = "incremental-recomputation", profile = "stress") {
	const points = EXPECTED_PERFORMANCE_SIZES.map((size) => {
		const resultCase = nodeResult.cases.find((candidate) => (
			candidate.size === size && candidate.profile === profile
		));
		if (!resultCase) fail(`cannot build scaling trend without node case ${profile}/${size}.`);
		const timing = resultCase.timings?.[stage];
		if (!timing) fail(`cannot build scaling trend without node stage "${stage}".`);
		return {
			size,
			medianMs: timing.summary.median,
			p95Ms: timing.summary.p95,
		};
	});
	const growth = points.slice(1).map((point, index) => {
		const previous = points[index];
		return {
			fromSize: previous.size,
			toSize: point.size,
			medianRatio: previous.medianMs === 0 ? null : point.medianMs / previous.medianMs,
			p95Ratio: previous.p95Ms === 0 ? null : point.p95Ms / previous.p95Ms,
		};
	});
	return {
		surface: "node",
		stage,
		profile,
		metric: "elapsed-ms",
		points,
		growth,
	};
}

export function garbageCollectionStatements(nodeResult, browserResult) {
	const nodeAvailable = nodeResult.runtime?.explicitGcAvailable === true;
	const browserObservations = browserResult.cases.flatMap((resultCase) => (
		Array.isArray(resultCase.memory) ? resultCase.memory : []
	));
	const browserAvailableCount = browserObservations.filter((observation) => (
		observation.explicitGcAvailable === true
	)).length;
	const browserStatement = browserObservations.length === 0
		? "Chromium explicit-GC availability is unknown because no browser heap observation was recorded."
		: browserAvailableCount === browserObservations.length
			? `Chromium explicit GC was available for all ${browserObservations.length} heap observations.`
			: `Chromium explicit GC was available for ${browserAvailableCount} of ${browserObservations.length} heap observations; every other observation retains its non-GC or missing label.`;
	return {
		node: nodeAvailable
			? "Node explicit GC was available; Node heap rows retain their per-observation collection labels."
			: "Node explicit GC was unavailable in the Vitest worker; Node heap rows are retained-heap observations, not collected-footprint or leak evidence.",
		chromium: browserStatement,
	};
}
