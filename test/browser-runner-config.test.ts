import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";

interface PackageScripts {
	scripts?: Record<string, string>;
}

test("serializes files and browser-matrix instances in the canonical test scripts", async () => {
	const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as PackageScripts;
	const scripts = packageJson.scripts ?? {};
	const projectInvocations = scripts.test?.split(" && ");

	expect(projectInvocations).toEqual([
		"vitest run --project node",
		"vitest run --project browser --no-file-parallelism",
		"node scripts/run-integration-tests.mjs",
		"vitest run --project chromium-dpr-1 --no-file-parallelism",
		"vitest run --project chromium-dpr-1.5 --no-file-parallelism",
		"vitest run --project chromium-dpr-2 --no-file-parallelism",
	]);
	expect(scripts["test:browser"]).toBe("vitest run --project browser --no-file-parallelism");
	expect(scripts["test:integration"]).toBe("node scripts/run-integration-tests.mjs");
	expect(scripts["test:browser-matrix"]).toBe(
		"vitest run --project chromium-dpr-1 --no-file-parallelism && " +
			"vitest run --project chromium-dpr-1.5 --no-file-parallelism && " +
			"vitest run --project chromium-dpr-2 --no-file-parallelism",
	);
	expect(projectInvocations?.[0]).not.toContain("--no-file-parallelism");
	expect(`${scripts.test ?? ""}\n${scripts["test:browser"] ?? ""}`).not.toMatch(/retry|passWithNoTests|timeout/i);
});
