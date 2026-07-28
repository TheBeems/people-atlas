import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { validateCommunityReadiness } from "../scripts/community-readiness.mjs";

const fixtureDirectories: string[] = [];

async function writeJson(rootDir: string, relativePath: string, value: unknown): Promise<void> {
	const filePath = path.join(rootDir, relativePath);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createCommunityFixture(): Promise<string> {
	const rootDir = await mkdtemp(path.join(tmpdir(), "people-atlas-community-"));
	fixtureDirectories.push(rootDir);
	await writeJson(rootDir, "manifest.json", {
		id: "people-atlas",
		name: "People Atlas",
		version: "0.1.1",
		minAppVersion: "1.13.0",
		description: "Map people and relationships in your vault.",
		author: "Fixture",
		isDesktopOnly: false,
	});
	await writeJson(rootDir, "versions.json", { "0.1.1": "1.13.0" });
	await writeJson(rootDir, "package-lock.json", { lockfileVersion: 3 });
	await Promise.all([
		writeFile(
			path.join(rootDir, "README.md"),
			[
				"# Fixture",
				"## Compatibility",
				"## Installation",
				"## Usage",
				"## Privacy and data access",
				"People Atlas does not use network access.",
				"People Atlas does not collect telemetry.",
				"People Atlas does not require an account or payment.",
				"People Atlas does not access files outside your vault.",
				"## Support",
			].join("\n"),
			"utf8",
		),
		writeFile(path.join(rootDir, "LICENSE"), "MIT\n", "utf8"),
	]);
	await mkdir(path.join(rootDir, "src"), { recursive: true });
	await writeFile(
		path.join(rootDir, "src", "main.ts"),
		'import { Plugin } from "obsidian";\nexport class Fixture extends Plugin {}\n',
	);
	await mkdir(path.join(rootDir, ".github", "release-notes"), { recursive: true });
	await writeFile(
		path.join(rootDir, ".github", "release-notes", "0.1.1.md"),
		"Requires Obsidian 1.13.0 or newer. Obsidian 1.12.x and older are not supported.\n",
	);
	return rootDir;
}

afterEach(async () => {
	await Promise.all(fixtureDirectories.splice(0).map((rootDir) => rm(rootDir, { force: true, recursive: true })));
});

describe("community readiness", () => {
	test("accepts compliant metadata, disclosures, release notes and mobile-safe source", async () => {
		const rootDir = await createCommunityFixture();

		const result = await validateCommunityReadiness({ rootDir, checkGit: false });

		expect(result.errors).toEqual([]);
		expect(result).toMatchObject({
			id: "people-atlas",
			name: "People Atlas",
			sourceFileCount: 1,
			version: "0.1.1",
		});
	});

	test("reports metadata, documentation and source-policy violations together", async () => {
		const rootDir = await createCommunityFixture();
		await writeJson(rootDir, "manifest.json", {
			id: "obsidian-bad-plugin",
			name: "Obsidian Plugin",
			version: "v1",
			minAppVersion: "1.12.0",
			description: "unfinished",
			author: "",
			isDesktopOnly: true,
		});
		await writeFile(path.join(rootDir, "README.md"), "# Sample plugin scaffold for a v2 foundation\n", "utf8");
		await writeFile(
			path.join(rootDir, "src", "main.ts"),
			'import { readFile } from "node:fs";\nconst color = "#fff";\nelement.style.color = color;\nwindow.app;\n',
		);

		const result = await validateCommunityReadiness({ rootDir, checkGit: false });

		expect(result.errors).toEqual(
			expect.arrayContaining([
				'manifest.json.id must not contain "obsidian".',
				'manifest.json.id must not end with "plugin".',
				'manifest.json.name must not contain the words "Obsidian" or "Plugin".',
				"manifest.json.author must be a non-empty string.",
				"manifest.json.description must end with a period.",
				"manifest.json.version must use strict unprefixed x.y.z syntax.",
				'manifest.json.minAppVersion must remain "1.13.0".',
				"manifest.json.isDesktopOnly must remain false while People Atlas declares mobile compatibility.",
				'README.md must contain the heading "## Compatibility".',
				'README.md must not contain unfinished product language "plugin scaffold".',
				"src/main.ts contains prohibited Node.js built-in import.",
				"src/main.ts contains prohibited hard-coded theme-sensitive DOM style assignment.",
				"src/main.ts contains prohibited global window.app access.",
				"src/main.ts contains prohibited hard-coded source color.",
			]),
		);
	});

	test("the current repository satisfies the durable community contract", async () => {
		const result = await validateCommunityReadiness({ rootDir: process.cwd() });

		expect(result.errors).toEqual([]);
	});
});
