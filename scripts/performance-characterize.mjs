import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
	buildScalingTrend,
	garbageCollectionStatements,
	validateCombinedPerformanceResults,
} from "./performance-result.mjs";

const RUNNER_VERSION = "p6a-characterization-v1";
const FIXTURE_CONTRACT_VERSION = "p6a-ring-lattice-v1";
const repositoryRoot = process.cwd();
const timestamp = new Date();
const dateStamp = timestamp.toISOString().slice(0, 10);
const evidenceRelative = `.10x/evidence/${dateStamp}-performance-characterization.md`;
const storageRelative = `.10x/evidence/.storage/${dateStamp}-performance-characterization.json`;
const evidencePath = path.join(repositoryRoot, evidenceRelative);
const storagePath = path.join(repositoryRoot, storageRelative);
const require = createRequire(import.meta.url);

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: options.inherit ? "inherit" : "pipe",
		env: options.env ?? process.env,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		const detail = options.inherit ? "" : `\n${result.stdout ?? ""}\n${result.stderr ?? ""}`;
		throw new Error(`${command} ${args.join(" ")} exited with ${result.status}.${detail}`);
	}
	return (result.stdout ?? "").trim();
}

function git(args) {
	return run("git", args);
}

function normalizePath(value) {
	return value.replaceAll("\\", "/");
}

function isGeneratedEvidencePath(value) {
	const normalized = normalizePath(value);
	return normalized.endsWith(evidenceRelative) || normalized.endsWith(storageRelative);
}

async function collectSourceProvenance() {
	const head = git(["rev-parse", "HEAD"]);
	const statusRaw = run("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
	const statusEntries = statusRaw
		.split("\0")
		.filter(Boolean)
		.filter((entry) => !isGeneratedEvidencePath(entry.slice(3)));
	const trackedDiff = run("git", ["diff", "--binary", "HEAD", "--", "."]);
	const untrackedRaw = run("git", ["ls-files", "--others", "--exclude-standard", "-z"]);
	const untracked = untrackedRaw
		.split("\0")
		.filter(Boolean)
		.map(normalizePath)
		.filter((entry) => !isGeneratedEvidencePath(entry))
		.sort();
	const hash = createHash("sha256");
	hash.update("tracked-diff\0");
	hash.update(trackedDiff);
	for (const relativePath of untracked) {
		hash.update("\0untracked-path\0");
		hash.update(relativePath);
		hash.update("\0untracked-content\0");
		hash.update(await readFile(path.join(repositoryRoot, relativePath)));
	}
	return {
		head,
		worktreeDirty: statusEntries.length > 0,
		diffHashAlgorithm: "sha256",
		diffHash: hash.digest("hex"),
		diffScope: "git diff HEAD plus sorted untracked file paths/content; generated evidence output paths excluded",
		statusPorcelain: statusEntries,
	};
}

function packageVersion(packageName) {
	const packagePath = require.resolve(`${packageName}/package.json`);
	return JSON.parse(require("node:fs").readFileSync(packagePath, "utf8")).version;
}

function npmVersion() {
	const npmExecPath = process.env.npm_execpath;
	if (npmExecPath) return run(process.execPath, [npmExecPath, "--version"]);
	const userAgent = process.env.npm_config_user_agent ?? "";
	return /npm\/([^\s]+)/.exec(userAgent)?.[1] ?? "unavailable";
}

function environmentClassification() {
	if (process.platform === "win32") return "calibrated-windows";
	if (process.platform === "linux" && process.env.GITHUB_ACTIONS === "true") return "informative-ci";
	return "informative-local";
}

function round(value, digits = 3) {
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function milliseconds(value) {
	return round(value).toFixed(3);
}

function mebibytes(bytes) {
	return round(bytes / 1024 / 1024).toFixed(3);
}

function candidateWithHeadroom(value, step) {
	return Math.ceil((value * 1.25) / step) * step;
}

function stageEntries(resultCase, surface) {
	return Object.entries(resultCase.timings).map(([stage, timing]) => ({
		surface,
		size: resultCase.size,
		profile: resultCase.profile,
		stage,
		...timing.summary,
	}));
}

function findCase(cases, size, profile) {
	const result = cases.find((candidate) => candidate.size === size && candidate.profile === profile);
	if (!result) throw new Error(`Missing ${profile}/${size} characterization case.`);
	return result;
}

function dominantRecommendation(nodeResult, browserResult, scalingTrend) {
	const nodeStress = findCase(nodeResult.cases, 5_000, "stress");
	const browserStress = findCase(browserResult.cases, 5_000, "stress");
	const entries = [
		...stageEntries(nodeStress, "node"),
		...stageEntries(browserStress, "browser"),
		{
			surface: "browser",
			size: 5_000,
			profile: "stress",
			stage: "interaction-frame",
			...browserStress.interaction.timing.summary,
		},
	];
	entries.sort((left, right) => right.median - left.median);
	const dominant = entries[0];
	if (!dominant) throw new Error("No measured stage is available for an architecture recommendation.");

	const owner =
		dominant.stage === "index-populate-and-snapshot"
			? "src/index/index-state.ts"
			: dominant.stage === "snapshot-and-semantic-dom" || dominant.stage.includes("mode-transition")
				? "src/render/atlas-renderer.ts semantic DOM"
				: dominant.stage.includes("canvas") || dominant.stage === "interaction-frame"
					? "src/render/atlas-renderer.ts canvas draw"
					: dominant.stage === "lifecycle-cleanup"
						? "src/render/atlas-renderer.ts lifecycle"
						: "src/graph graph/projection/layout pipeline";

	const indexP95 = nodeStress.timings["index-populate-and-snapshot"].summary.p95;
	const incrementalP95 = nodeStress.timings["incremental-recomputation"].summary.p95;
	const firstRenderP95 =
		browserStress.timings["snapshot-and-semantic-dom"].summary.p95 +
		browserStress.timings["canvas-first-paint"].summary.p95;
	const interactionP95 = browserStress.interaction.timing.summary.p95;
	const nodeMemoryGrowth = memoryGrowth(nodeStress.memory, "before-fixture", "after-incremental-recomputation");
	const browserMemoryGrowth = memoryGrowth(browserStress.memory, "before-renderer", "after-incremental-replacement");
	const largestMemoryGrowth = Math.max(nodeMemoryGrowth ?? 0, browserMemoryGrowth ?? 0);

	const candidateBudgets = {
		method: "observed p95 or retained-heap growth plus 25 percent headroom, rounded upward; proposal only",
		index5000StressMs: candidateWithHeadroom(indexP95, 25),
		incremental5000StressMs: candidateWithHeadroom(incrementalP95, 25),
		initialRender5000StressMs: candidateWithHeadroom(firstRenderP95, 50),
		settledInteractionFrame5000StressMs: candidateWithHeadroom(interactionP95, 1),
		retainedHeapGrowth5000StressMiB: candidateWithHeadroom(largestMemoryGrowth / 1024 / 1024, 16),
		status: "candidate-for-user-ratification-not-active",
	};

	let nextStep;
	if (dominant.stage === "incremental-recomputation") {
		nextStep =
			"Shape a bounded P6b ticket to split graph-delta, projection and layout timings, then simplify the main-thread graph-delta lookup path if the split confirms it; do not add a Worker before that evidence.";
	} else if (dominant.stage === "snapshot-and-semantic-dom") {
		nextStep =
			"Shape a bounded P6b semantic-list workload/specification and evaluate main-thread semantic-list bounding before any Worker; DOM work is not transferable.";
	} else if (dominant.stage.includes("canvas") || dominant.stage === "interaction-frame") {
		nextStep =
			"Shape a bounded P6b canvas workload and evaluate main-thread culling/draw simplification before any Worker; owning-window canvas work remains on the main thread.";
	} else {
		nextStep =
			"Ratify the candidate budgets first; retain the current main-thread architecture unless a bounded follow-up proves a specific transferable computation exceeds them.";
	}
	return {
		dominant: {
			surface: dominant.surface,
			stage: dominant.stage,
			owner,
			medianMs: dominant.median,
			p95Ms: dominant.p95,
			scope: "5000-node stress fixture on this calibrated environment only",
		},
		candidateBudgets,
		scalingTrend,
		recommendation: nextStep,
		workerDisposition: "not-recommended-from-current-aggregate-evidence",
		imageCacheDisposition: "excluded-no-photo-decode-or-paint-in-workload",
	};
}

function memoryGrowth(observations, startStage, endStage) {
	const start = observations.find((observation) => observation.stage === startStage)?.heapUsedBytes;
	const end = observations.find((observation) => observation.stage === endStage)?.heapUsedBytes;
	return typeof start === "number" && typeof end === "number" ? Math.max(0, end - start) : undefined;
}

function timingTable(cases, includeInteraction) {
	const rows = [
		"| Profile | Nodes | Stage | Min ms | Median ms | P95 ms | Max ms |",
		"| --- | ---: | --- | ---: | ---: | ---: | ---: |",
	];
	for (const resultCase of cases) {
		for (const [stage, timing] of Object.entries(resultCase.timings)) {
			rows.push(
				`| ${resultCase.profile} | ${resultCase.size} | ${stage} | ${milliseconds(timing.summary.min)} | ${milliseconds(timing.summary.median)} | ${milliseconds(timing.summary.p95)} | ${milliseconds(timing.summary.max)} |`,
			);
		}
		if (includeInteraction) {
			const timing = resultCase.interaction.timing;
			rows.push(
				`| ${resultCase.profile} | ${resultCase.size} | interaction-frame | ${milliseconds(timing.summary.min)} | ${milliseconds(timing.summary.median)} | ${milliseconds(timing.summary.p95)} | ${milliseconds(timing.summary.max)} |`,
			);
		}
	}
	return rows.join("\n");
}

function memoryTable(nodeCases, browserCases) {
	const rows = [
		"| Surface | Profile | Nodes | Stage | Heap used MiB | Heap total MiB | GC label |",
		"| --- | --- | ---: | --- | ---: | ---: | --- |",
	];
	for (const [surface, cases] of [
		["Node", nodeCases],
		["Chromium", browserCases],
	]) {
		for (const resultCase of cases) {
			for (const observation of resultCase.memory) {
				rows.push(
					`| ${surface} | ${resultCase.profile} | ${resultCase.size} | ${observation.stage} | ${typeof observation.heapUsedBytes === "number" ? mebibytes(observation.heapUsedBytes) : "missing"} | ${typeof observation.totalHeapBytes === "number" ? mebibytes(observation.totalHeapBytes) : "missing"} | ${observation.kind}${observation.missingReason ? `: ${observation.missingReason.replaceAll("|", "/")}` : ""} |`,
				);
			}
		}
	}
	return rows.join("\n");
}

function evidenceMarkdown(report) {
	const recommendation = report.recommendation;
	const budgets = recommendation.candidateBudgets;
	const scaling = recommendation.scalingTrend;
	const gc = garbageCollectionStatements(report.node, report.browser);
	const missing =
		report.missingData.length > 0
			? report.missingData.map((entry) => `- ${entry}`).join("\n")
			: "- None. No required timing or provenance value is missing.";
	const scalingPoints = scaling.points
		.map(
			(point) =>
				`${point.size.toLocaleString("en-US")} nodes: ${milliseconds(point.medianMs)} ms median / ${milliseconds(point.p95Ms)} ms p95`,
		)
		.join("; ");
	const scalingGrowth = scaling.growth
		.map(
			(step) =>
				`${step.fromSize.toLocaleString("en-US")}→${step.toSize.toLocaleString("en-US")}: ${
					step.medianRatio === null ? "undefined from zero" : `${round(step.medianRatio, 3)}× median`
				}`,
		)
		.join("; ");
	return `Status: recorded
Created: ${dateStamp}
Updated: ${dateStamp}

# P6a performance characterization — ${dateStamp}

## Observation

The largest calibrated stress case attributes the dominant recorded median to
\`${recommendation.dominant.stage}\` in ${recommendation.dominant.owner}:
${milliseconds(recommendation.dominant.medianMs)} ms median and
${milliseconds(recommendation.dominant.p95Ms)} ms p95. This attribution is
limited to the 5,000-node/40,000-edge fixture on this machine.

Before that architecture recommendation, the machine-readable recommendation
records this complete \`${scaling.profile}\` \`${scaling.stage}\` scaling
trend: ${scalingPoints}. Consecutive growth is ${scalingGrowth}. At the
largest case, separately measured free-network projection and deterministic
layout medians are
${milliseconds(findCase(report.node.cases, 5_000, "stress").timings["free-network-projection"].summary.median)}
ms and
${milliseconds(findCase(report.node.cases, 5_000, "stress").timings["deterministic-layout"].summary.median)}
ms, so graph-delta application is the leading hypothesis inside the aggregate
incremental stage; exact substage attribution still requires the proposed
split.

Only after that scaling evidence, the report recommends:
${recommendation.recommendation}
A Worker is not recommended from this aggregate evidence. No image-cache
conclusion is available because the fixtures decode and paint no photos.

## Procedure

- Command: \`npm run perf:characterize\`.
- Node: five untimed warm-ups and twenty recorded samples per size/profile.
- Chromium: three untimed warm-ups and ten recorded setup/update samples per
  size/profile, plus 30 settled interaction frames.
- Fixtures: deterministic \`${report.fixtureContractVersion}\` ring lattices
  at 100, 1,000 and 5,000 nodes; sparse uses \`2N\` relationships and stress
  uses \`8N\`.
- Incremental scenario: the middle person and its offset-1 relationship are
  changed without changing stable IDs or counts; incremental output is checked
  against a complete rebuild before sampling.
- Timing source: the owning runtime's monotonic \`performance.now()\`.
- Raw samples and all environment fields: \`${storageRelative}\`.

## Source and environment provenance

- Classification: \`${report.classification}\`.
- UTC timestamp: \`${report.generatedAtUtc}\`.
- Git HEAD: \`${report.source.head}\`.
- Worktree dirty: \`${report.source.worktreeDirty}\`.
- Diff hash: \`${report.source.diffHashAlgorithm}:${report.source.diffHash}\`.
- Diff scope: ${report.source.diffScope}.
- OS: ${report.environment.os.platform} ${report.environment.os.version}
  (${report.environment.os.release}, ${report.environment.os.arch}).
- CPU: ${report.environment.cpu.model}; ${report.environment.cpu.logicalProcessors}
  logical processors.
- System memory: ${mebibytes(report.environment.totalSystemMemoryBytes)} MiB.
- Node/npm: ${report.environment.versions.node} / ${report.environment.versions.npm}.
- Vitest/Playwright: ${report.environment.versions.vitest} /
  ${report.environment.versions.playwright}.
- Chromium: ${report.browser.browser.product} revision
  ${report.browser.browser.revision}; viewport
  ${report.browser.viewport.width}×${report.browser.viewport.height}, DPR
  ${report.browser.viewport.devicePixelRatio}.
- Runner: \`${report.runnerVersion}\`.

## Node timing summaries

${timingTable(report.node.cases, false)}

## Chromium timing summaries

${timingTable(report.browser.cases, true)}

Every interaction run generated 60 zoom redraw triggers. The renderer requested
and executed 30 animation frames per case, so 30 triggers were coalesced before
the owning-window callback.

## Heap observations

${memoryTable(report.node.cases, report.browser.cases)}

These are stage-bounded retained-heap observations. Where explicit collection
was available, the table says \`collected-heap\`; they are not leak claims.

## Garbage-collection availability

- ${gc.node}
- ${gc.chromium}

## Missing data

${missing}

## Candidate budgets for user ratification

These values are proposals only. They are not accepted budgets and no test,
build, check or CI threshold enforces them. The mechanical proposal uses the
calibrated 5,000-node stress p95 (or retained-heap growth), adds 25% headroom
and rounds upward:

| Candidate | Proposed ceiling |
| --- | ---: |
| Index population plus raw snapshot | ${budgets.index5000StressMs} ms |
| Incremental graph/projection/layout recomputation | ${budgets.incremental5000StressMs} ms |
| Initial semantic DOM plus canvas paint | ${budgets.initialRender5000StressMs} ms |
| Settled interaction frame | ${budgets.settledInteractionFrame5000StressMs} ms |
| Retained-heap growth | ${budgets.retainedHeapGrowth5000StressMiB} MiB |

## What this supports or challenges

- Supports attributing the observed dominant cost to the named owning layer on
  this calibrated machine.
- Supports considering no change or a bounded main-thread simplification
  before a Worker.
- Challenges treating P6's Worker or image cache as an already-justified
  implementation step.
- Proposes the next bounded shaping step and candidate budgets; it does not
  ratify either.

## Limits

- Absolute timings and heap values do not generalize across hardware.
- A Linux/Node 24 run is supported and must be labelled
  \`informative-ci\`; no Linux run was performed by this Windows evidence run.
- Headless Chromium is not live Obsidian, Bases, a pop-out window, assistive
  technology or Obsidian Mobile. Those remain P7/manual evidence.
- The Node incremental stage is aggregate graph-delta, projection and layout
  time; it does not by itself authorize a Worker or identify a transferable
  protocol.
- No photo is decoded or painted, so image-cache behavior is outside this
  evidence.
`;
}

async function main() {
	const vitestCli = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
	const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "people-atlas-p6a-"));
	const nodePartial = path.join(temporaryDirectory, "node.json");
	const browserPartial = path.join(temporaryDirectory, "browser.json");
	try {
		run(
			process.execPath,
			["--expose-gc", vitestCli, "run", "--config", "vitest.performance.config.ts", "--project", "performance-node"],
			{
				inherit: true,
				env: { ...process.env, PEOPLE_ATLAS_PERF_NODE_OUTPUT: nodePartial },
			},
		);
		run(
			process.execPath,
			[vitestCli, "run", "--config", "vitest.performance.config.ts", "--project", "performance-browser"],
			{
				inherit: true,
				env: { ...process.env, PEOPLE_ATLAS_PERF_BROWSER_OUTPUT: browserPartial },
			},
		);

		const nodeResult = JSON.parse(await readFile(nodePartial, "utf8"));
		const browserResult = JSON.parse(await readFile(browserPartial, "utf8"));
		validateCombinedPerformanceResults(nodeResult, browserResult);
		const scalingTrend = buildScalingTrend(nodeResult);
		const source = await collectSourceProvenance();
		const cpu = os.cpus();
		const report = {
			schemaVersion: 1,
			runnerVersion: RUNNER_VERSION,
			fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
			generatedAtUtc: timestamp.toISOString(),
			classification: environmentClassification(),
			source,
			environment: {
				os: {
					platform: process.platform,
					version: os.version(),
					release: os.release(),
					arch: os.arch(),
				},
				cpu: {
					model: cpu[0]?.model ?? "unavailable",
					logicalProcessors: cpu.length,
				},
				totalSystemMemoryBytes: os.totalmem(),
				versions: {
					node: process.version,
					npm: npmVersion(),
					vitest: packageVersion("vitest"),
					playwright: packageVersion("playwright"),
					chromium: browserResult.browser.product,
				},
				ciRuntimeSupport:
					"runner uses ES2022 and repository CI targets Node 24/ubuntu-latest; execution is manual and informative",
			},
			node: nodeResult,
			browser: browserResult,
			missingData: [
				...nodeResult.missingData.map((entry) => `Node: ${entry}`),
				...browserResult.missingData.map((entry) => `Chromium: ${entry}`),
			],
		};
		report.recommendation = dominantRecommendation(nodeResult, browserResult, scalingTrend);
		await mkdir(path.dirname(storagePath), { recursive: true });
		await mkdir(path.dirname(evidencePath), { recursive: true });
		await writeFile(storagePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
		await writeFile(evidencePath, evidenceMarkdown(report), "utf8");
		console.log(`Machine-readable evidence: ${storageRelative}`);
		console.log(`Human-readable evidence: ${evidenceRelative}`);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
}

await main();
