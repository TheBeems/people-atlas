import { describe, expect, test } from "vitest";
import { resolveReleaseChannel } from "../scripts/release-channel.mjs";

describe("release channel resolver", () => {
	test.each([
		["alpha", "Channel: alpha\nRelease notes\n", "alpha", true, "People Atlas 0.12.1 (Alpha)"],
		["beta", "Channel: beta\nRelease notes\n", "beta", true, "People Atlas 0.12.1 (Beta)"],
		["rc", "Channel: rc\nRelease notes\n", "rc", true, "People Atlas 0.12.1 (Release Candidate)"],
		["stable without marker", "Release notes\n", "stable", false, "People Atlas 0.12.1"],
		["stable with unknown marker", "Channel: preview\nRelease notes\n", "stable", false, "People Atlas 0.12.1"],
	] as const)("resolves %s", (_name, notes, channel, prerelease, title) => {
		expect(resolveReleaseChannel(notes, "0.12.1")).toEqual({ channel, prerelease, title });
	});

	test("ignores leading empty lines before the exact marker", () => {
		expect(resolveReleaseChannel("\n\nChannel: alpha\nNotes\n", "0.12.1")).toEqual({
			channel: "alpha",
			prerelease: true,
			title: "People Atlas 0.12.1 (Alpha)",
		});
	});

	test("fails closed when a recognized marker is not the first non-empty line", () => {
		expect(() => resolveReleaseChannel("Release notes\nChannel: alpha\n", "0.12.1")).toThrow(
			"recognized channel marker must be the first non-empty line",
		);
	});

	test("fails closed when release notes contain multiple recognized markers", () => {
		expect(() => resolveReleaseChannel("Channel: alpha\nChannel: beta\n", "0.12.1")).toThrow(
			"multiple recognized channel markers",
		);
	});
});
