import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const OUTPUTS = ["main.js", "main.js.map"];

async function removeKnownOutputs(rootDir) {
	for (const output of OUTPUTS) {
		await rm(path.join(rootDir, output), { force: true });
	}
}

function runProductionBuild(rootDir) {
	const result = spawnSync(process.execPath, ["esbuild.config.mjs", "production"], {
		cwd: rootDir,
		encoding: "utf8",
	});
	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);
	if (result.status !== 0) {
		throw new Error(`Production build exited with status ${result.status ?? "unknown"}.`);
	}
}

async function sha256(filePath) {
	return createHash("sha256")
		.update(await readFile(filePath))
		.digest("hex");
}

export function compareBuildDigests(firstDigest, secondDigest) {
	if (firstDigest === secondDigest) return undefined;
	return `Reproducibility check failed: first SHA-256 ${firstDigest}; second SHA-256 ${secondDigest}.`;
}

async function run() {
	const rootDir = process.cwd();
	const bundlePath = path.join(rootDir, "main.js");

	await removeKnownOutputs(rootDir);
	runProductionBuild(rootDir);
	const firstDigest = await sha256(bundlePath);

	await removeKnownOutputs(rootDir);
	runProductionBuild(rootDir);
	const secondDigest = await sha256(bundlePath);

	console.log(`First main.js SHA-256:  ${firstDigest}`);
	console.log(`Second main.js SHA-256: ${secondDigest}`);

	const mismatch = compareBuildDigests(firstDigest, secondDigest);
	if (mismatch) {
		throw new Error(mismatch);
	}
	console.log("Reproducibility check passed; the second build remains main.js.");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		await run();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
