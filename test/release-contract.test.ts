import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { BUNDLE_LIMIT_BYTES, RELEASE_ASSETS, validateReleaseContract } from "../scripts/release-contract.mjs";
import { compareBuildDigests } from "../scripts/verify-reproducible-build.mjs";

const fixtureDirectories: string[] = [];

async function writeJson(rootDir: string, relativePath: string, value: unknown): Promise<void> {
	await writeFile(path.join(rootDir, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createReleaseFixture(): Promise<string> {
	const rootDir = await mkdtemp(path.join(tmpdir(), "people-atlas-release-"));
	fixtureDirectories.push(rootDir);
	await mkdir(rootDir, { recursive: true });
	await writeJson(rootDir, "package.json", { version: "0.1.0" });
	await writeJson(rootDir, "manifest.json", {
		version: "0.1.0",
		minAppVersion: "1.13.0",
	});
	await writeJson(rootDir, "versions.json", { "0.1.0": "1.13.0" });
	await Promise.all([
		writeFile(path.join(rootDir, "README.md"), "# Fixture\n", "utf8"),
		writeFile(path.join(rootDir, "LICENSE"), "MIT\n", "utf8"),
		writeFile(path.join(rootDir, "main.js"), "plugin bundle\n", "utf8"),
		writeFile(path.join(rootDir, "styles.css"), ".fixture {}\n", "utf8"),
	]);
	return rootDir;
}

afterEach(async () => {
	await Promise.all(fixtureDirectories.splice(0).map((rootDir) => rm(rootDir, { force: true, recursive: true })));
});

describe("release contract", () => {
	test("accepts coherent metadata, an exact tag and the three release assets", async () => {
		const rootDir = await createReleaseFixture();

		const result = await validateReleaseContract({ rootDir, tag: "0.1.0" });

		expect(result.errors).toEqual([]);
		expect(result.version).toBe("0.1.0");
		expect(result.assets).toEqual(RELEASE_ASSETS);
		expect(result.bundleBytes).toBe(14);
	});

	test.each([
		"package.json",
		"manifest.json",
		"versions.json",
	])("fails closed when %s contains malformed JSON", async (relativePath) => {
		const rootDir = await createReleaseFixture();
		await writeFile(path.join(rootDir, relativePath), "{ malformed", "utf8");

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toContainEqual(expect.stringContaining(`${relativePath} is missing or invalid JSON`));
	});

	test("reports every strict version and minimum-version disagreement", async () => {
		const rootDir = await createReleaseFixture();
		await writeJson(rootDir, "package.json", { version: "0.2.0" });
		await writeJson(rootDir, "manifest.json", {
			version: "01.0.0",
			minAppVersion: "1.12.0",
		});

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toEqual(
			expect.arrayContaining([
				'manifest.json.version must use strict x.y.z syntax; observed "01.0.0".',
				'package.json.version "0.2.0" does not equal manifest.json.version "01.0.0".',
				'manifest.json.minAppVersion must remain "1.13.0"; observed "1.12.0".',
				'versions.json has no entry for manifest version "01.0.0".',
			]),
		);
	});

	test("rejects a prefixed or mismatched release tag", async () => {
		const rootDir = await createReleaseFixture();

		const result = await validateReleaseContract({ rootDir, tag: "v0.1.0" });

		expect(result.errors).toEqual([
			'Release tag must use exact unprefixed x.y.z syntax; observed "v0.1.0".',
			'Release tag "v0.1.0" does not equal manifest.json.version "0.1.0".',
		]);
	});

	test("rejects a versions mapping that disagrees with the manifest minimum", async () => {
		const rootDir = await createReleaseFixture();
		await writeJson(rootDir, "versions.json", { "0.1.0": "1.12.0" });

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toContain(
			'versions.json["0.1.0"] must equal manifest.json.minAppVersion "1.13.0"; observed "1.12.0".',
		);
	});

	test("fails closed for missing required inputs, assets and a production sourcemap", async () => {
		const rootDir = await createReleaseFixture();
		await unlink(path.join(rootDir, "README.md"));
		await unlink(path.join(rootDir, "styles.css"));
		await writeFile(path.join(rootDir, "main.js.map"), "{}", "utf8");

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Required release input README.md is missing or inaccessible:"),
				expect.stringContaining("Required release asset styles.css is missing or inaccessible:"),
				"Production release must not contain main.js.map.",
			]),
		);
	});

	test.each([
		"main.js",
		"manifest.json",
		"styles.css",
	])("rejects release asset %s when its path is a directory", async (relativePath) => {
		const rootDir = await createReleaseFixture();
		await unlink(path.join(rootDir, relativePath));
		await mkdir(path.join(rootDir, relativePath));

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toContain(`Required release asset ${relativePath} is not a regular file.`);
	});

	test("rejects a required non-asset input when its path is a directory", async () => {
		const rootDir = await createReleaseFixture();
		await unlink(path.join(rootDir, "README.md"));
		await mkdir(path.join(rootDir, "README.md"));

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toContain("Required release input README.md is not a regular file.");
	});

	test.each([
		"//# sourceMappingURL=data:application/json;base64,e30=",
		"/*# sourceMappingURL=main.js.map */",
	])("rejects embedded or external source map directive %s", async (directive) => {
		const rootDir = await createReleaseFixture();
		await writeFile(path.join(rootDir, "main.js"), `plugin bundle\n${directive}\n`, "utf8");

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toContain("Production main.js must not contain a sourceMappingURL directive.");
	});

	test("reports observed and allowed sizes for an oversized bundle", async () => {
		const rootDir = await createReleaseFixture();
		await writeFile(path.join(rootDir, "main.js"), Buffer.alloc(BUNDLE_LIMIT_BYTES + 1));

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toContain(
			`main.js is ${BUNDLE_LIMIT_BYTES + 1} bytes; the allowed limit is ${BUNDLE_LIMIT_BYTES} bytes.`,
		);
	});
});

describe("reproducible digest comparison", () => {
	test("accepts identical digests and reports both differing digests", () => {
		expect(compareBuildDigests("first", "first")).toBeUndefined();
		expect(compareBuildDigests("first", "second")).toBe(
			"Reproducibility check failed: first SHA-256 first; second SHA-256 second.",
		);
	});
});

describe("release workflow tag guard", () => {
	test("requires the remote SHA check and --verify-tag immediately before publication", async () => {
		const workflow = await readFile(path.join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");
		const remoteGuardIndex = workflow.indexOf("- name: Verify remote release tag revision");
		const publishIndex = workflow.indexOf("- name: Publish GitHub release");

		expect(remoteGuardIndex).toBeGreaterThan(-1);
		expect(publishIndex).toBeGreaterThan(remoteGuardIndex);
		expect(workflow).toContain('if [[ "$remote_commit" != "$EXPECTED_SHA" ]]');
		expect(workflow).toContain(
			'gh release create "$TAG" --verify-tag --title "$TAG" --generate-notes main.js manifest.json styles.css',
		);
	});
});
