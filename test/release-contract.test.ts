import { chmod, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import { RELEASE_ASSETS, validateReleaseContract } from "../scripts/release-contract.mjs";
import { compareBuildDigests } from "../scripts/verify-reproducible-build.mjs";
import { resolveReleaseChannel } from "../scripts/release-channel.mjs";

const execFileAsync = promisify(execFile);

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

async function readPublishScript(): Promise<string> {
	const workflow = await readFile(path.join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");
	const publishIndex = workflow.indexOf("- name: Publish GitHub release");
	const runIndex = workflow.indexOf("run: |", publishIndex);
	const nextStepIndex = workflow.indexOf("\n      - ", runIndex);
	const block = workflow.slice(runIndex + "run: |\n".length, nextStepIndex === -1 ? undefined : nextStepIndex);
	return block
		.split("\n")
		.map((line) => (line.startsWith("          ") ? line.slice(10) : line))
		.join("\n");
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

	test("reports the observed bundle size without enforcing a fixed byte budget", async () => {
		const rootDir = await createReleaseFixture();
		const observedBytes = 500_001;
		await writeFile(path.join(rootDir, "main.js"), Buffer.alloc(observedBytes));

		const result = await validateReleaseContract({ rootDir });

		expect(result.errors).toEqual([]);
		expect(result.bundleBytes).toBe(observedBytes);
		expect(result).not.toHaveProperty("bundleLimitBytes");
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
	test("requires the remote SHA check, verified tag and optional versioned notes before publication", async () => {
		const workflow = await readFile(path.join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");
		const remoteGuardIndex = workflow.indexOf("- name: Verify remote release tag revision");
		const publishIndex = workflow.indexOf("- name: Publish GitHub release");

		expect(remoteGuardIndex).toBeGreaterThan(-1);
		expect(publishIndex).toBeGreaterThan(remoteGuardIndex);
		expect(workflow).toContain('if [[ "$remote_commit" != "$EXPECTED_SHA" ]]');
		expect(workflow).toContain("--verify-tag");
		expect(workflow).toContain(`release_notes_file=".github/release-notes/\${TAG}.md"`);
		expect(workflow).toContain('release_args+=(--notes "$(cat "$release_notes_file")")');
		expect(workflow).toContain(`gh release create "\${release_args[@]}" main.js manifest.json styles.css`);
	});

	test("resolves the release channel before attestation and reuses the validated outputs for publication", async () => {
		const workflow = await readFile(path.join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");
		const channelValidationIndex = workflow.indexOf("- name: Validate release channel");
		const attestationIndex = workflow.indexOf("- name: Attest release files");
		const publishIndex = workflow.indexOf("- name: Publish GitHub release");
		const publishBlock = workflow.slice(publishIndex);

		expect(channelValidationIndex).toBeGreaterThan(-1);
		expect(channelValidationIndex).toBeLessThan(attestationIndex);
		expect(workflow).toContain("id: release-channel");
		expect(workflow).toContain(
			'channel_resolution="$(node scripts/release-channel.mjs "$release_notes_file" "$RELEASE_TAG")"',
		);
		expect(workflow).toContain('} >> "$GITHUB_OUTPUT"');
		expect(workflow).toContain(`RELEASE_TITLE: \${{ steps.release-channel.outputs.title }}`);
		expect(workflow).toContain(`RELEASE_PRERELEASE: \${{ steps.release-channel.outputs.prerelease }}`);
		expect(publishBlock).not.toContain("node scripts/release-channel.mjs");
		expect(publishBlock).toContain('if [[ "$RELEASE_PRERELEASE" == "true" ]]');
	});

	test.each([
		["alpha", "Channel: alpha\nAlpha notes\n"],
		["beta", "Channel: beta\nBeta notes\n"],
		["rc", "Channel: rc\nRC notes\n"],
		["stable", "Stable notes\n"],
	] as const)("executes the publish branch for %s with a mocked gh", async (_name, notes) => {
		const rootDir = await mkdtemp(path.join(tmpdir(), "people-atlas-publish-"));
		fixtureDirectories.push(rootDir);
		const notesDir = path.join(rootDir, ".github", "release-notes");
		const binDir = path.join(rootDir, "bin");
		const argsPath = path.join(rootDir, "gh-args.txt");
		await mkdir(notesDir, { recursive: true });
		await mkdir(binDir, { recursive: true });
		await writeFile(path.join(notesDir, "0.12.1.md"), notes, "utf8");
		const ghPath = path.join(binDir, "gh");
		await writeFile(ghPath, '#!/bin/sh\nprintf "%s\\n" "$@" > "$GH_ARGS_FILE"\n', "utf8");
		await chmod(ghPath, 0o755);

		const channel = resolveReleaseChannel(notes, "0.12.1");
		await execFileAsync("bash", ["-euo", "pipefail", "-c", await readPublishScript()], {
			cwd: rootDir,
			env: {
				...process.env,
				PATH: `${binDir}:${process.env.PATH ?? ""}`,
				GH_ARGS_FILE: argsPath,
				GITHUB_TOKEN: "[REDACTED]",
				TAG: "0.12.1",
				RELEASE_TITLE: channel.title,
				RELEASE_PRERELEASE: String(channel.prerelease),
			},
		});

		const args = (await readFile(argsPath, "utf8")).trim().split("\n");
		expect(args.slice(-3)).toEqual(["main.js", "manifest.json", "styles.css"]);
		expect(args.slice(0, 3)).toEqual(["release", "create", "0.12.1"]);
		expect(args).toContain("--verify-tag");
		expect(args).toContain("--generate-notes");
		const titleIndex = args.indexOf("--title");
		expect(args[titleIndex + 1]).toBe(channel.title);
		const notesIndex = args.indexOf("--notes");
		expect(args.slice(notesIndex + 1, notesIndex + 1 + notes.trim().split("\n").length)).toEqual(
			notes.trim().split("\n"),
		);
		if (channel.prerelease) expect(args).toContain("--prerelease");
		else expect(args).not.toContain("--prerelease");
	});

	test("0.1.0 release notes state the exact Obsidian compatibility boundary", async () => {
		const notes = await readFile(path.join(process.cwd(), ".github", "release-notes", "0.1.0.md"), "utf8");

		expect(notes).toContain("only supports Obsidian 1.13.0 or newer");
		expect(notes).toContain("Obsidian 1.12.x and older are not supported");
		expect(notes).toContain("Catalyst early-access (beta) release");
	});

	test("the candidate release notes keep the permanent Obsidian compatibility boundary", async () => {
		const notes = await readFile(path.join(process.cwd(), ".github", "release-notes", "0.1.1.md"), "utf8");

		expect(notes).toContain("only supports Obsidian 1.13.0 or newer");
		expect(notes).toContain("Obsidian 1.12.x and older are not supported");
		expect(notes).not.toContain("currently");
	});
});
