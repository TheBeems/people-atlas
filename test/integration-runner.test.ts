import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { collectIntegrationTestFiles, runIntegrationTests } from "../scripts/run-integration-tests.mjs";

test("enumerates every integration test file in deterministic order", async () => {
	const files = await collectIntegrationTestFiles(process.cwd());

	expect(files).toHaveLength(9);
	expect(files).toEqual([...files].sort());
	expect(files.every((file) => file.endsWith(".integration.test.ts"))).toBe(true);
});

test("stops at and propagates the first non-zero child exit code", async () => {
	const calls: string[] = [];
	const exitCode = await runIntegrationTests({
		log: () => undefined,
		runTestFile: async (file) => {
			calls.push(file);
			return calls.length === 2 ? 17 : 0;
		},
	});

	expect(exitCode).toBe(17);
	expect(calls).toHaveLength(2);
});

test.each([
	["child exit", "#!/usr/bin/env node\nprocess.exit(23);\n", 23],
	["child signal", '#!/usr/bin/env node\nprocess.kill(process.pid, "SIGTERM");\n', 1],
	["spawn error", undefined, 1],
] as const)("fails closed for a %s", async (_name, childSource, expectedExitCode) => {
	const rootDir = await mkdtemp(path.join(tmpdir(), "people-atlas-integration-runner-"));
	try {
		const integrationDir = path.join(rootDir, "test", "integration");
		await mkdir(integrationDir, { recursive: true });
		await writeFile(path.join(integrationDir, "failure.integration.test.ts"), "export {};\n", "utf8");
		const vitestCli = path.join(rootDir, "fake-vitest.mjs");
		if (childSource) await writeFile(vitestCli, childSource, "utf8");

		await expect(
			runIntegrationTests({
				error: () => undefined,
				log: () => undefined,
				rootDir,
				vitestCli,
			}),
		).resolves.toBe(expectedExitCode);
	} finally {
		await rm(rootDir, { force: true, recursive: true });
	}
});
