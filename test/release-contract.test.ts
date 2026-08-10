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
		expect(workflow).toContain(
			`gh release create "\${release_args[@]}" release-candidate/main.js release-candidate/manifest.json release-candidate/styles.css`,
		);
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
		expect(workflow).toContain(`release-title: \${{ steps.release-channel.outputs.title }}`);
		expect(workflow).toContain(`release-prerelease: \${{ steps.release-channel.outputs.prerelease }}`);
		expect(publishBlock).toContain(`RELEASE_TITLE: \${{ needs.build.outputs.release-title }}`);
		expect(publishBlock).toContain(`RELEASE_PRERELEASE: \${{ needs.build.outputs.release-prerelease }}`);
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
				RELEASE_CHANNEL: channel.channel,
				RELEASE_TITLE: channel.title,
				RELEASE_PRERELEASE: String(channel.prerelease),
			},
		});

		const args = (await readFile(argsPath, "utf8")).trim().split("\n");
		expect(args.slice(-3)).toEqual([
			"release-candidate/main.js",
			"release-candidate/manifest.json",
			"release-candidate/styles.css",
		]);
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

function majorVersion(version: string): number {
	const match = version.match(/\d+/);
	if (!match) throw new Error(`Expected a numeric version, received ${version}.`);
	return Number(match[0]);
}

function extractJob(workflow: string, jobName: string): string {
	const marker = `\n  ${jobName}:\n`;
	const start = workflow.indexOf(marker);
	if (start === -1) return "";

	const bodyStart = start + marker.length;
	const nextJob = workflow.slice(bodyStart).match(/\n {2}[A-Za-z0-9_-]+:\n/);
	const end = nextJob?.index === undefined ? workflow.length : bodyStart + nextJob.index;
	return workflow.slice(start, end);
}

async function readWorkflow(name: "ci.yml" | "release.yml"): Promise<string> {
	return readFile(path.join(process.cwd(), ".github", "workflows", name), "utf8");
}

describe("supply-chain hardening contract", () => {
	test("keeps Node runtime and @types/node on the same major", async () => {
		const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as {
			engines: { node: string };
			devDependencies: { "@types/node": string };
		};
		const packageLock = JSON.parse(await readFile(path.join(process.cwd(), "package-lock.json"), "utf8")) as {
			packages: {
				"": { devDependencies: { "@types/node": string } };
				"node_modules/@types/node": { version: string };
			};
		};

		expect(majorVersion(packageJson.engines.node)).toBe(24);
		expect(majorVersion(packageJson.devDependencies["@types/node"])).toBe(24);
		expect(majorVersion(packageLock.packages[""].devDependencies["@types/node"])).toBe(24);
		expect(majorVersion(packageLock.packages["node_modules/@types/node"].version)).toBe(24);
	});

	test("pins every GitHub Action to a full commit SHA", async () => {
		const workflows = await Promise.all([readWorkflow("ci.yml"), readWorkflow("release.yml")]);
		const actionRefs = workflows.flatMap((workflow) =>
			[...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1]),
		);

		expect(actionRefs).toHaveLength(8);
		for (const actionRef of actionRefs) expect(actionRef).toMatch(/@[0-9a-f]{40}$/);
	});

	test("uses explicit read-only CI permissions and disables checkout credentials", async () => {
		const ci = await readWorkflow("ci.yml");

		expect(ci).toMatch(/^permissions:\s*\n {2}contents: read\s*$/m);
		const checkoutSteps = ci.split("- uses: actions/checkout@").slice(1);
		expect(checkoutSteps).toHaveLength(1);
		expect(checkoutSteps[0]?.split("\n      - ")[0]).toContain("persist-credentials: false");
	});

	test("isolates release permissions and the build/publication job boundary", async () => {
		const release = await readWorkflow("release.yml");
		const build = extractJob(release, "build");
		const publish = extractJob(release, "publish");

		expect(release).toMatch(/^permissions:\s*\{\}\s*$/m);
		expect(build).toContain("permissions:\n      contents: read\n    outputs:");
		expect(build).not.toMatch(/(?:id-token|attestations):\s*write/);
		expect(publish).toContain("needs: build");
		expect(publish).toContain(
			"permissions:\n      contents: write\n      id-token: write\n      attestations: write\n    steps:",
		);
		expect(publish).not.toMatch(/\n\s+if:\s+.*always\(\)/);
		expect(publish).not.toMatch(/\bnpm(?:\s+(?:ci|install|update)|\s+run)\b|\bnpx\b|\bvitest\b|playwright install/);

		const checkoutSteps = release.split("- uses: actions/checkout@").slice(1);
		expect(checkoutSteps).toHaveLength(2);
		for (const checkoutStep of checkoutSteps) {
			expect(checkoutStep.split("\n      - ")[0]).toContain("persist-credentials: false");
		}
	});

	test("runs all verification before uploading exactly the release candidate", async () => {
		const release = await readWorkflow("release.yml");
		const build = extractJob(release, "build");
		const publish = extractJob(release, "publish");

		for (const command of ["npm ci", "npm run dependency:audit", "npm run check", "npm run verify:reproducible"]) {
			expect(build).toContain(command);
		}
		expect(build.indexOf("Validate release tag")).toBeGreaterThan(-1);
		expect(build.indexOf("Validate release channel")).toBeGreaterThan(-1);
		expect(build.indexOf("Validate verified release candidate")).toBeGreaterThan(-1);
		const uploadIndex = build.indexOf("actions/upload-artifact@");
		expect(uploadIndex).toBeGreaterThan(-1);
		for (const gate of [
			"npm ci",
			"npm run dependency:audit",
			"npm run check",
			"Validate release tag",
			"Validate release channel",
			"npm run verify:reproducible",
			"Validate verified release candidate",
		]) {
			const gateIndex = build.indexOf(gate);
			expect(gateIndex).toBeGreaterThan(-1);
			expect(gateIndex, `${gate} must run before artifact upload`).toBeLessThan(uploadIndex);
		}
		expect(build).toContain("- name: Validate release candidate files");
		expect(build).toContain("for release_file in main.js manifest.json styles.css; do");
		expect(build).toContain('[[ ! -f "$release_file" ]]');
		expect(build.indexOf("Validate release candidate files")).toBeLessThan(uploadIndex);
		expect(build).toContain("path: |\n            main.js\n            manifest.json\n            styles.css");
		expect(build).toContain("if-no-files-found: error");

		expect(publish).toContain("actions/download-artifact@");
		expect(publish).toContain("name: release-candidate");
		expect(publish).toContain("path: release-candidate");
		expect(publish).toContain("release-candidate/main.js");
		expect(publish).toContain("release-candidate/manifest.json");
		expect(publish).toContain("release-candidate/styles.css");
		expect(publish).toContain(
			`gh release create "\${release_args[@]}" release-candidate/main.js release-candidate/manifest.json release-candidate/styles.css`,
		);
	});

	test("passes the validated channel outputs from build to publication", async () => {
		const release = await readWorkflow("release.yml");
		const build = extractJob(release, "build");
		const publish = extractJob(release, "publish");

		expect(build).toContain(`release-channel: \${{ steps.release-channel.outputs.channel }}`);
		expect(build).toContain(`release-title: \${{ steps.release-channel.outputs.title }}`);
		expect(build).toContain(`release-prerelease: \${{ steps.release-channel.outputs.prerelease }}`);
		expect(publish).toContain(`RELEASE_CHANNEL: \${{ needs.build.outputs.release-channel }}`);
		expect(publish).toContain(`RELEASE_TITLE: \${{ needs.build.outputs.release-title }}`);
		expect(publish).toContain(`RELEASE_PRERELEASE: \${{ needs.build.outputs.release-prerelease }}`);
		expect(publish).not.toContain("node scripts/release-channel.mjs");
	});
});
