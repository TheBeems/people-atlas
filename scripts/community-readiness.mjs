import { execFile } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

export const COMMUNITY_REQUIRED_FILES = Object.freeze([
	"README.md",
	"LICENSE",
	"manifest.json",
	"versions.json",
	"package-lock.json",
]);

export const README_REQUIRED_HEADINGS = Object.freeze([
	"## Compatibility",
	"## Installation",
	"## Usage",
	"## Privacy and data access",
	"## Support",
]);

const README_REQUIRED_DISCLOSURES = Object.freeze([
	"does not use network access",
	"does not collect telemetry",
	"does not require an account or payment",
	"does not access files outside your vault",
]);

const PROHIBITED_PLACEHOLDER_PHRASES = Object.freeze(["plugin scaffold", "v2 foundation", "sample plugin"]);
const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const PLUGIN_ID = /^[a-z]+(?:-[a-z]+)*$/u;
const PLUGIN_NAME = /^[A-Za-z0-9 +()-]+$/u;
const execFileAsync = promisify(execFile);

const SOURCE_POLICY_RULES = Object.freeze([
	["Node.js built-in import", /\bfrom\s+["']node:/u],
	["Electron import", /\bfrom\s+["']electron["']/u],
	["CommonJS require call", /\brequire\s*\(/u],
	["process.platform access", /\bprocess\.platform\b/u],
	["FileSystemAdapter usage", /\bFileSystemAdapter\b/u],
	["direct fetch call", /\bfetch\s*\(/u],
	["axios usage", /\baxios(?:\.|\s)/u],
	["unsafe innerHTML assignment", /\.innerHTML\b/u],
	["unsafe outerHTML assignment", /\.outerHTML\b/u],
	["unsafe insertAdjacentHTML call", /\.insertAdjacentHTML\s*\(/u],
	["global window.app access", /\bwindow\.app\b/u],
	["console.log call", /\bconsole\.log\s*\(/u],
	[
		"hard-coded theme-sensitive DOM style assignment",
		/\.style\.(?:background|backgroundColor|borderColor|boxShadow|color|fill|font|fontFamily|fontSize|fontWeight|stroke)\s*=/u,
	],
	["explicit any assertion", /\bas\s+any\b/u],
	["direct Vault.modify call", /\.vault\.modify\s*\(/u],
	["direct Vault adapter access", /\.vault\.adapter\b/u],
	["direct Vault.delete call", /\.vault\.delete\s*\(/u],
	["default command hotkeys", /\bhotkeys\s*:/u],
	["hard-coded source color", /["'`]#[0-9a-fA-F]{3,8}["'`]/u],
]);

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringProperty(value, property) {
	if (!isRecord(value)) return undefined;
	const candidate = value[property];
	return typeof candidate === "string" ? candidate : undefined;
}

async function inspectRegularFile(filePath, description, errors) {
	try {
		const fileStat = await lstat(filePath);
		if (!fileStat.isFile()) {
			errors.push(`${description} is not a regular file.`);
			return false;
		}
		return true;
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		errors.push(`${description} is missing or inaccessible: ${detail}`);
		return false;
	}
}

async function readJson(rootDir, relativePath, errors) {
	try {
		const source = await readFile(path.join(rootDir, relativePath), "utf8");
		return JSON.parse(source);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		errors.push(`${relativePath} is missing or invalid JSON: ${detail}`);
		return undefined;
	}
}

async function collectTypeScriptFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
			return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
		}),
	);
	return nested.flat();
}

async function inspectSourcePolicies(rootDir, errors) {
	const sourceDir = path.join(rootDir, "src");
	let sourceFiles;
	try {
		sourceFiles = await collectTypeScriptFiles(sourceDir);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		errors.push(`src is missing or inaccessible: ${detail}`);
		return 0;
	}

	for (const sourceFile of sourceFiles) {
		const relativePath = path.relative(rootDir, sourceFile).replaceAll(path.sep, "/");
		const source = await readFile(sourceFile, "utf8");
		for (const [description, pattern] of SOURCE_POLICY_RULES) {
			if (pattern.test(source)) errors.push(`${relativePath} contains prohibited ${description}.`);
		}
	}
	return sourceFiles.length;
}

async function inspectTrackedBundle(rootDir, errors) {
	try {
		await lstat(path.join(rootDir, ".git"));
	} catch {
		return;
	}

	try {
		const { stdout } = await execFileAsync("git", ["ls-files", "--", "main.js"], {
			cwd: rootDir,
			encoding: "utf8",
		});
		if (stdout.trim()) errors.push("main.js must be published as a release asset and must not be tracked by Git.");
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		errors.push(`Unable to inspect whether main.js is tracked by Git: ${detail}`);
	}
}

export async function validateCommunityReadiness({ rootDir = process.cwd(), checkGit = true } = {}) {
	const errors = [];

	for (const requiredFile of COMMUNITY_REQUIRED_FILES) {
		await inspectRegularFile(path.join(rootDir, requiredFile), `Required community input ${requiredFile}`, errors);
	}

	const manifest = await readJson(rootDir, "manifest.json", errors);
	const id = stringProperty(manifest, "id");
	const name = stringProperty(manifest, "name");
	const author = stringProperty(manifest, "author");
	const description = stringProperty(manifest, "description");
	const version = stringProperty(manifest, "version");
	const minAppVersion = stringProperty(manifest, "minAppVersion");
	const isDesktopOnly = isRecord(manifest) ? manifest.isDesktopOnly : undefined;

	if (!id || !PLUGIN_ID.test(id)) {
		errors.push("manifest.json.id must contain only lowercase words separated by single hyphens.");
	} else {
		if (id.includes("obsidian")) errors.push('manifest.json.id must not contain "obsidian".');
		if (id.endsWith("plugin")) errors.push('manifest.json.id must not end with "plugin".');
	}
	if (!name || !PLUGIN_NAME.test(name)) {
		errors.push(
			"manifest.json.name must use Basic Latin letters, numbers, spaces, hyphens, plus signs or parentheses.",
		);
	} else if (/\b(?:obsidian|plugin)\b/iu.test(name)) {
		errors.push('manifest.json.name must not contain the words "Obsidian" or "Plugin".');
	}
	if (!author?.trim()) errors.push("manifest.json.author must be a non-empty string.");
	if (!description) {
		errors.push("manifest.json.description must be a string.");
	} else {
		if (description.length > 250) errors.push("manifest.json.description must contain at most 250 characters.");
		if (!description.endsWith(".")) errors.push("manifest.json.description must end with a period.");
		if (/[\r\n]/u.test(description)) errors.push("manifest.json.description must be a single line.");
	}
	if (!version || !STRICT_SEMVER.test(version)) {
		errors.push("manifest.json.version must use strict unprefixed x.y.z syntax.");
	}
	if (minAppVersion !== "1.13.0") {
		errors.push('manifest.json.minAppVersion must remain "1.13.0".');
	}
	if (isDesktopOnly !== false) {
		errors.push("manifest.json.isDesktopOnly must remain false while People Atlas declares mobile compatibility.");
	}

	let readme = "";
	try {
		readme = await readFile(path.join(rootDir, "README.md"), "utf8");
	} catch {
		// The required-file diagnostic above is more precise.
	}
	for (const heading of README_REQUIRED_HEADINGS) {
		if (!readme.includes(heading)) errors.push(`README.md must contain the heading "${heading}".`);
	}
	const normalizedReadme = readme.toLowerCase();
	for (const disclosure of README_REQUIRED_DISCLOSURES) {
		if (!normalizedReadme.includes(disclosure)) {
			errors.push(`README.md must explicitly state that People Atlas ${disclosure}.`);
		}
	}
	for (const placeholder of PROHIBITED_PLACEHOLDER_PHRASES) {
		if (normalizedReadme.includes(placeholder)) {
			errors.push(`README.md must not contain unfinished product language "${placeholder}".`);
		}
	}

	if (version) {
		const releaseNotesPath = path.join(rootDir, ".github", "release-notes", `${version}.md`);
		if (await inspectRegularFile(releaseNotesPath, `Release notes for manifest version ${version}`, errors)) {
			const releaseNotes = await readFile(releaseNotesPath, "utf8");
			if (!releaseNotes.includes("Obsidian 1.13.0 or newer")) {
				errors.push(`Release notes for ${version} must state the Obsidian 1.13.0 minimum.`);
			}
			if (!releaseNotes.includes("Obsidian 1.12.x and older are not supported")) {
				errors.push(`Release notes for ${version} must state that Obsidian 1.12.x and older are unsupported.`);
			}
		}
	}

	const sourceFileCount = await inspectSourcePolicies(rootDir, errors);
	if (checkGit) await inspectTrackedBundle(rootDir, errors);

	return { errors, id, name, sourceFileCount, version };
}

async function run() {
	const result = await validateCommunityReadiness();
	if (result.errors.length > 0) {
		console.error(`Community readiness failed with ${result.errors.length} error(s):`);
		for (const error of result.errors) console.error(`- ${error}`);
		process.exitCode = 1;
		return;
	}

	console.log(
		`Community readiness passed for ${result.id} ${result.version}: ${result.name}; inspected ${result.sourceFileCount} source files.`,
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	await run();
}
