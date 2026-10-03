import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("Usage: node scripts/contact-history-characterize.mjs <output.json>");
const root = process.cwd();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const bundle = await build({
	stdin: {
		contents: `export { IndexState } from './src/index/index-state';
export { generateContactHistoryFixture } from './test/performance/contact-history-fixture';
export { NODE_WARMUP_COUNT, NODE_SAMPLE_COUNT, timingSamples } from './test/performance/performance-model';`,
		resolveDir: root,
		loader: "ts",
	},
	bundle: true,
	write: false,
	platform: "node",
	format: "esm",
});
const bundledSource = bundle.outputFiles[0].text;
const { IndexState, generateContactHistoryFixture, NODE_WARMUP_COUNT, NODE_SAMPLE_COUNT, timingSamples } = await import(
	`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`
);
const result = {
	runnerVersion: "contact-history-characterization-v1",
	timestampUtc: new Date().toISOString(),
	source: {
		head: git("rev-parse", "HEAD"),
		status: git("status", "--short"),
		trackedDiffSha256: hash(git("diff", "HEAD")),
		bundleSha256: hash(bundledSource),
		fixtureSha256: hash(await readFile(path.join(root, "test/performance/contact-history-fixture.ts"))),
	},
	environment: {
		node: process.version,
		platform: process.platform,
		architecture: process.arch,
		osRelease: os.release(),
		cpu: os.cpus()[0]?.model,
		logicalProcessors: os.cpus().length,
		systemMemoryBytes: os.totalmem(),
	},
	warmups: NODE_WARMUP_COUNT,
	recordedSamples: NODE_SAMPLE_COUNT,
	cases: [],
	limits: [
		"Node IndexState.getSnapshot computation only; not native Obsidian or end-to-end UI latency.",
		"Fixture population is outside the measured stage; no timing threshold is enforced.",
		"Heap readings are retained-heap observations without forced GC; they do not establish a leak.",
	],
};
for (const size of [100, 1_000]) {
	for (const profile of ["person-only", "linked-history"]) {
		const fixture = generateContactHistoryFixture(size, profile);
		const state = new IndexState();
		for (const file of fixture.files) state.upsert(file);
		let expectedSnapshotHash;
		const samples = [];
		const heapBefore = process.memoryUsage().heapUsed;
		for (let sample = -NODE_WARMUP_COUNT; sample < NODE_SAMPLE_COUNT; sample += 1) {
			const start = performance.now();
			const snapshot = state.getSnapshot();
			const duration = performance.now() - start;
			if (
				snapshot.people.length !== size ||
				snapshot.relationships.length !== fixture.relationships.length ||
				snapshot.contactMoments.length !== size ||
				snapshot.diagnostics.length !== 0 ||
				snapshot.contactMoments.some((moment) => !moment.actionable)
			)
				throw new Error(`Invalid ${size}/${profile} snapshot.`);
			const snapshotHash = hash(JSON.stringify(snapshot));
			expectedSnapshotHash ??= snapshotHash;
			if (snapshotHash !== expectedSnapshotHash) throw new Error("Snapshot changed between samples.");
			if (sample >= 0) samples.push(duration);
		}
		const entry = {
			size,
			profile,
			fixtureContractVersion: fixture.contractVersion,
			counts: { people: size, relationships: fixture.relationships.length, contactMoments: size },
			snapshotSha256: expectedSnapshotHash,
			timing: timingSamples(samples),
			heap: {
				kind: "retained-heap-observation",
				explicitGcAvailable: false,
				before: heapBefore,
				after: process.memoryUsage().heapUsed,
			},
		};
		result.cases.push(entry);
		console.log(
			`${size}/${profile}: median ${entry.timing.summary.median.toFixed(3)} ms; p95 ${entry.timing.summary.p95.toFixed(3)} ms.`,
		);
	}
}
await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Contact-history characterization written to ${outputPath}.`);
