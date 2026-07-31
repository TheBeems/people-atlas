import { access, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const BUNDLE_LIMIT_BYTES = 409_600;
export const REQUIRED_MIN_APP_VERSION = "1.13.0";
export const RELEASE_ASSETS = Object.freeze(["main.js", "manifest.json", "styles.css"]);
export const REQUIRED_INPUTS = Object.freeze(["README.md", "LICENSE", "manifest.json", "versions.json"]);

const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

async function exists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function inspectRegularFile(filePath, description, errors) {
	try {
		const fileStat = await lstat(filePath);
		if (!fileStat.isFile()) {
			errors.push(`${description} is not a regular file.`);
			return undefined;
		}
		return fileStat;
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		errors.push(`${description} is missing or inaccessible: ${detail}`);
		return undefined;
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

function stringProperty(value, property) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	const candidate = value[property];
	return typeof candidate === "string" ? candidate : undefined;
}

export async function validateReleaseContract({
	rootDir = process.cwd(),
	tag,
	bundleLimitBytes = BUNDLE_LIMIT_BYTES,
} = {}) {
	const errors = [];

	for (const requiredInput of REQUIRED_INPUTS) {
		await inspectRegularFile(path.join(rootDir, requiredInput), `Required release input ${requiredInput}`, errors);
	}

	const releaseAssetStats = new Map();
	for (const releaseAsset of RELEASE_ASSETS) {
		releaseAssetStats.set(
			releaseAsset,
			await inspectRegularFile(path.join(rootDir, releaseAsset), `Required release asset ${releaseAsset}`, errors),
		);
	}

	const packageJson = await readJson(rootDir, "package.json", errors);
	const manifest = await readJson(rootDir, "manifest.json", errors);
	const versions = await readJson(rootDir, "versions.json", errors);
	const packageVersion = stringProperty(packageJson, "version");
	const manifestVersion = stringProperty(manifest, "version");
	const minAppVersion = stringProperty(manifest, "minAppVersion");

	if (!packageVersion) {
		errors.push("package.json.version must be a string.");
	}
	if (!manifestVersion) {
		errors.push("manifest.json.version must be a string.");
	} else if (!STRICT_SEMVER.test(manifestVersion)) {
		errors.push(`manifest.json.version must use strict x.y.z syntax; observed "${manifestVersion}".`);
	}
	if (packageVersion && manifestVersion && packageVersion !== manifestVersion) {
		errors.push(`package.json.version "${packageVersion}" does not equal manifest.json.version "${manifestVersion}".`);
	}
	if (minAppVersion !== REQUIRED_MIN_APP_VERSION) {
		errors.push(
			`manifest.json.minAppVersion must remain "${REQUIRED_MIN_APP_VERSION}"; observed ${JSON.stringify(minAppVersion)}.`,
		);
	}

	if (manifestVersion && (typeof versions !== "object" || versions === null || Array.isArray(versions))) {
		errors.push("versions.json must contain an object keyed by plugin version.");
	} else if (manifestVersion) {
		if (!Object.hasOwn(versions, manifestVersion)) {
			errors.push(`versions.json has no entry for manifest version "${manifestVersion}".`);
		} else if (versions[manifestVersion] !== minAppVersion) {
			errors.push(
				`versions.json["${manifestVersion}"] must equal manifest.json.minAppVersion ${JSON.stringify(
					minAppVersion,
				)}; observed ${JSON.stringify(versions[manifestVersion])}.`,
			);
		}
	}

	if (tag !== undefined) {
		if (!STRICT_SEMVER.test(tag)) {
			errors.push(`Release tag must use exact unprefixed x.y.z syntax; observed "${tag}".`);
		}
		if (manifestVersion && tag !== manifestVersion) {
			errors.push(`Release tag "${tag}" does not equal manifest.json.version "${manifestVersion}".`);
		}
	}

	const bundlePath = path.join(rootDir, "main.js");
	let bundleBytes;
	const bundleStat = releaseAssetStats.get("main.js");
	if (bundleStat) {
		try {
			bundleBytes = bundleStat.size;
			if (bundleBytes > bundleLimitBytes) {
				errors.push(`main.js is ${bundleBytes} bytes; the allowed limit is ${bundleLimitBytes} bytes.`);
			}
			const bundleSource = await readFile(bundlePath, "utf8");
			if (/sourceMappingURL\s*=/iu.test(bundleSource)) {
				errors.push("Production main.js must not contain a sourceMappingURL directive.");
			}
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			errors.push(`Unable to inspect main.js: ${detail}`);
		}
	}

	if (await exists(path.join(rootDir, "main.js.map"))) {
		errors.push("Production release must not contain main.js.map.");
	}

	return {
		assets: [...RELEASE_ASSETS],
		bundleBytes,
		bundleLimitBytes,
		errors,
		version: manifestVersion,
	};
}

function parseTag(args) {
	if (args.length === 0) return undefined;
	if (args.length === 2 && args[0] === "--tag" && args[1]) return args[1];
	throw new Error('Usage: node scripts/release-contract.mjs [--tag "x.y.z"]');
}

async function run() {
	let tag;
	try {
		tag = parseTag(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
		return;
	}

	const result = await validateReleaseContract({ tag });
	if (result.errors.length > 0) {
		console.error(`Release contract failed with ${result.errors.length} error(s):`);
		for (const error of result.errors) {
			console.error(`- ${error}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log(
		`Release contract passed for ${result.version}: main.js ${result.bundleBytes}/${result.bundleLimitBytes} bytes; assets ${result.assets.join(
			", ",
		)}.`,
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	await run();
}
