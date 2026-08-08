import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CHANNEL_MARKERS = Object.freeze({
	"Channel: alpha": "alpha",
	"Channel: beta": "beta",
	"Channel: rc": "rc",
});

const CHANNEL_TITLES = Object.freeze({
	alpha: (tag) => `People Atlas ${tag} (Alpha)`,
	beta: (tag) => `People Atlas ${tag} (Beta)`,
	rc: (tag) => `People Atlas ${tag} (Release Candidate)`,
	stable: (tag) => `People Atlas ${tag}`,
});

export function resolveReleaseChannel(notes, tag) {
	const lines = notes.split(/\r?\n/u);
	const recognizedMarkers = lines.filter((line) => Object.hasOwn(CHANNEL_MARKERS, line));
	if (recognizedMarkers.length > 1) {
		throw new Error("Release notes contain multiple recognized channel markers.");
	}

	const firstNonEmptyLine = lines.find((line) => line.trim().length > 0);
	const marker = recognizedMarkers[0];
	if (marker && firstNonEmptyLine !== marker) {
		throw new Error("A recognized channel marker must be the first non-empty line.");
	}

	const channel = marker ? CHANNEL_MARKERS[marker] : "stable";
	return {
		channel,
		prerelease: channel !== "stable",
		title: CHANNEL_TITLES[channel](tag),
	};
}

async function readNotes(notesPath) {
	if (!notesPath) return "";
	try {
		return await readFile(notesPath, "utf8");
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			return "";
		}
		throw error;
	}
}

async function run() {
	const [notesPath, tag] = process.argv.slice(2);
	if (!tag) {
		throw new Error("Usage: node scripts/release-channel.mjs [release-notes-file] <x.y.z>");
	}
	const result = resolveReleaseChannel(await readNotes(notesPath), tag);
	process.stdout.write(`${result.channel}\t${result.title}\t${result.prerelease}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		await run();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
