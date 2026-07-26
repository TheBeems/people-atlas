import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os, { tmpdir } from "node:os";
import path from "node:path";
import { validateGraphDeltaPerformanceResult } from "./performance-result.mjs";

const RUNNER_VERSION = "p6b-graph-delta-v1";
const FIXTURE_CONTRACT_VERSION = "p6a-ring-lattice-v1";
const TRIGGER_RATIO = 0.80;
const FINAL_MEDIAN_CEILING_MS = 750;
const FINAL_P95_CEILING_MS = 1_000;
const repositoryRoot = process.cwd();
const timestamp = new Date();
const dateStamp = timestamp.toISOString().slice(0, 10);
const phase = process.argv[2];
if (phase !== "baseline" && phase !== "final") {
	throw new Error("Usage: npm run perf:graph-delta -- baseline|final");
}
const artifactSlug = `incremental-graph-delta-${phase}`;
const evidenceRelative = `.10x/evidence/${dateStamp}-${artifactSlug}.md`;
const storageRelative = `.10x/evidence/.storage/${dateStamp}-${artifactSlug}.json`;
const evidencePath = path.join(repositoryRoot, evidenceRelative);
const storagePath = path.join(repositoryRoot, storageRelative);
const baselineStorageRelative = `.10x/evidence/.storage/${dateStamp}-incremental-graph-delta-baseline.json`;
const baselineStoragePath = path.join(repositoryRoot, baselineStorageRelative);
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

function normalizePath(value) {
	return value.replaceAll("\\", "/");
}

function isCurrentGeneratedEvidencePath(value) {
	const normalized = normalizePath(value);
	return normalized.endsWith(evidenceRelative) || normalized.endsWith(storageRelative);
}

async function collectSourceProvenance() {
	const head = run("git", ["rev-parse", "HEAD"]);
	const statusRaw = run("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
	const statusEntries = statusRaw.split("\0").filter(Boolean)
		.filter((entry) => !isCurrentGeneratedEvidencePath(entry.slice(3)));
	const trackedDiff = run("git", ["diff", "--binary", "HEAD", "--", "."]);
	const untrackedRaw = run("git", ["ls-files", "--others", "--exclude-standard", "-z"]);
	const untracked = untrackedRaw.split("\0").filter(Boolean)
		.map(normalizePath)
		.filter((entry) => !isCurrentGeneratedEvidencePath(entry))
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
		diffScope: "git diff HEAD plus sorted untracked file paths/content; current generated evidence paths excluded",
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
	return "informative-local";
}

function findStressCase(result) {
	const resultCase = result.cases.find((candidate) => (
		candidate.size === 5_000 && candidate.profile === "stress"
	));
	if (!resultCase) throw new Error("Missing stress/5000 graph-delta performance case.");
	return resultCase;
}

function preChangeTrigger(result) {
	const resultCase = findStressCase(result);
	const graphDeltaMedianMs = resultCase.timings["graph-delta"].summary.median;
	const aggregateMedianMs = resultCase.timings["incremental-recomputation"].summary.median;
	const ratio = aggregateMedianMs === 0 ? null : graphDeltaMedianMs / aggregateMedianMs;
	return {
		fixture: "stress/5000 nodes/40000 edges",
		formula: "graph-delta median / aggregate incremental median",
		graphDeltaMedianMs,
		aggregateMedianMs,
		ratio,
		requiredRatio: TRIGGER_RATIO,
		optimizationAuthorized: ratio !== null && ratio >= TRIGGER_RATIO,
	};
}

function finalGate(result) {
	const resultCase = findStressCase(result);
	const aggregate = resultCase.timings["incremental-recomputation"].summary;
	return {
		fixture: "stress/5000 nodes/40000 edges",
		medianMs: aggregate.median,
		p95Ms: aggregate.p95,
		medianCeilingMs: FINAL_MEDIAN_CEILING_MS,
		p95CeilingMs: FINAL_P95_CEILING_MS,
		passed: aggregate.median <= FINAL_MEDIAN_CEILING_MS && aggregate.p95 <= FINAL_P95_CEILING_MS,
	};
}

function round(value, digits = 3) {
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function milliseconds(value) {
	return round(value).toFixed(3);
}

function timingTable(cases) {
	const rows = [
		"| Profile | Nodes | Stage | Min ms | Median ms | P95 ms | Max ms |",
		"| --- | ---: | --- | ---: | ---: | ---: | ---: |",
	];
	for (const resultCase of cases) {
		for (const [stage, timing] of Object.entries(resultCase.timings)) {
			rows.push(`| ${resultCase.profile} | ${resultCase.size} | ${stage} | ${milliseconds(timing.summary.min)} | ${milliseconds(timing.summary.median)} | ${milliseconds(timing.summary.p95)} | ${milliseconds(timing.summary.max)} |`);
		}
	}
	return rows.join("\n");
}

function evidenceMarkdown(report) {
	const trigger = report.preChangeTrigger;
	const ratio = trigger.ratio === null ? "undefined" : trigger.ratio.toFixed(6);
	const phaseObservation = report.phase === "baseline"
		? `The direct graph-delta median is ${milliseconds(trigger.graphDeltaMedianMs)} ms
and the aggregate incremental median is ${milliseconds(trigger.aggregateMedianMs)} ms.
Their ratio is \`${ratio}\` against the ratified \`${TRIGGER_RATIO.toFixed(2)}\`
trigger. Product-source optimization is therefore
\`${trigger.optimizationAuthorized ? "authorized" : "not-authorized"}\` under P6b.`
		: `The final 5,000-node/40,000-edge stress aggregate measures
${milliseconds(report.finalGate.medianMs)} ms median and
${milliseconds(report.finalGate.p95Ms)} ms nearest-rank p95. The ratified
\`${FINAL_MEDIAN_CEILING_MS}/${FINAL_P95_CEILING_MS} ms\` gate is
\`${report.finalGate.passed ? "passed" : "not-passed"}\`.`;
	const finalSection = report.phase === "final"
		? `
## Final calibrated gate

| Metric | Observed | Ceiling | Result |
| --- | ---: | ---: | --- |
| Aggregate median | ${milliseconds(report.finalGate.medianMs)} ms | ${FINAL_MEDIAN_CEILING_MS} ms | ${report.finalGate.medianMs <= FINAL_MEDIAN_CEILING_MS ? "pass" : "fail"} |
| Aggregate nearest-rank p95 | ${milliseconds(report.finalGate.p95Ms)} ms | ${FINAL_P95_CEILING_MS} ms | ${report.finalGate.p95Ms <= FINAL_P95_CEILING_MS ? "pass" : "fail"} |

This is a manual ticket-closure gate, not a default-test or CI threshold.
`
		: "";
	return `Status: recorded
Created: ${dateStamp}
Updated: ${dateStamp}

# P6b incremental graph-delta ${report.phase} — ${dateStamp}

## Observation

${phaseObservation}

The pre-change trigger uses direct graph-delta median divided by aggregate
incremental median: \`${milliseconds(trigger.graphDeltaMedianMs)} /
${milliseconds(trigger.aggregateMedianMs)} = ${ratio}\`.

## Procedure

- Command: \`npm run perf:graph-delta -- ${report.phase}\`.
- Fixture: unchanged deterministic \`${report.fixtureContractVersion}\`
  ring-lattice cases at 100, 1,000 and 5,000 nodes; sparse uses \`2N\`
  relationships and stress uses \`8N\`.
- Sampling: five untimed warm-ups and twenty recorded samples per case.
- Each sample times \`applyGraphDelta()\`, incremental free-network projection
  and incremental deterministic layout directly, while one outer monotonic
  timer retains aggregate incremental recomputation.
- Before sampling, stable identities and counts are checked and incremental
  output is compared with a complete deterministic rebuild.
- Raw samples and provenance: \`${storageRelative}\`.
${report.phase === "final" ? `- Pre-change raw evidence: \`${baselineStorageRelative}\`.` : ""}

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
- System memory: ${round(report.environment.totalSystemMemoryBytes / 1024 / 1024)} MiB.
- Node/npm/Vitest: ${report.environment.versions.node} /
  ${report.environment.versions.npm} / ${report.environment.versions.vitest}.
- Runner: \`${report.runnerVersion}\`.

## Timing summaries

${timingTable(report.cases)}

## Pre-change implementation trigger

| Graph-delta median | Aggregate median | Ratio | Required | Disposition |
| ---: | ---: | ---: | ---: | --- |
| ${milliseconds(trigger.graphDeltaMedianMs)} ms | ${milliseconds(trigger.aggregateMedianMs)} ms | ${ratio} | ${TRIGGER_RATIO.toFixed(2)} | ${trigger.optimizationAuthorized ? "per-call maps authorized" : "no product optimization"} |
${finalSection}
## What this supports

- Direct substage attribution for the unchanged calibrated deterministic
  workload on this machine.
- The conditional P6b lookup-map change only when the persisted baseline ratio
  meets the ratified trigger.
- A final manual closure decision from the raw nearest-rank statistics.

## Limits

- Absolute timings do not generalize beyond this calibrated machine.
- This evidence does not authorize or evaluate a Worker, persistent cache,
  image cache, dependency, public API change or CI threshold.
- It does not prove Linux, live Obsidian desktop, Bases, pop-out or Mobile
  performance.
`;
}

async function main() {
	const vitestCli = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
	const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "people-atlas-p6b-"));
	const partialPath = path.join(temporaryDirectory, "graph-delta.json");
	try {
		run(process.execPath, [
			vitestCli,
			"run",
			"--config",
			"vitest.performance.config.ts",
			"--project",
			"performance-graph-delta",
		], {
			inherit: true,
			env: { ...process.env, PEOPLE_ATLAS_GRAPH_DELTA_PERF_OUTPUT: partialPath },
		});
		const partial = JSON.parse(await readFile(partialPath, "utf8"));
		validateGraphDeltaPerformanceResult(partial);

		let baseline;
		if (phase === "final") {
			baseline = JSON.parse(await readFile(baselineStoragePath, "utf8"));
			validateGraphDeltaPerformanceResult(baseline);
			if (baseline.phase !== "baseline") {
				throw new Error(`${baselineStorageRelative} is not P6b baseline evidence.`);
			}
		}
		const source = await collectSourceProvenance();
		const cpu = os.cpus();
		const report = {
			schemaVersion: 1,
			runnerVersion: RUNNER_VERSION,
			fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
			phase,
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
				},
			},
			runtime: partial.runtime,
			cases: partial.cases,
			preChangeTrigger: preChangeTrigger(baseline ?? partial),
			...(phase === "final" ? {
				baselineEvidence: baselineStorageRelative,
				finalGate: finalGate(partial),
			} : {}),
		};
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
