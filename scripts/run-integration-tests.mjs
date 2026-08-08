import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export async function collectIntegrationTestFiles(rootDir = process.cwd()) {
	const integrationDir = path.join(rootDir, "test", "integration");
	return (await readdir(integrationDir))
		.filter((file) => file.endsWith(".integration.test.ts"))
		.sort()
		.map((file) => path.join("test", "integration", file));
}

function runVitest(filePath, rootDir, vitestCli) {
	return new Promise((resolve) => {
		const child = spawn(
			process.execPath,
			[vitestCli, "run", "--project", "integration", "--no-file-parallelism", "--maxWorkers=1", filePath],
			{ cwd: rootDir, stdio: "inherit" },
		);
		let settled = false;
		const finish = (code) => {
			if (settled) return;
			settled = true;
			resolve(code);
		};
		child.on("error", () => finish(1));
		child.on("close", (code, signal) => finish(signal ? 1 : (code ?? 1)));
	});
}

export async function runIntegrationTests({
	rootDir = process.cwd(),
	vitestCli = path.join(rootDir, "node_modules", "vitest", "vitest.mjs"),
	runTestFile,
	log = console.log,
	error = console.error,
} = {}) {
	const files = await collectIntegrationTestFiles(rootDir);
	if (files.length === 0) {
		error("No integration test files were found.");
		return 1;
	}

	const executeTestFile = runTestFile ?? ((filePath) => runVitest(filePath, rootDir, vitestCli));
	for (const file of files) {
		log(`\n=== ${file} ===`);
		const exitCode = await executeTestFile(file);
		if (exitCode !== 0) return exitCode;
	}
	return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	process.exitCode = await runIntegrationTests();
}
