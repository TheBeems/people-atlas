import type { App } from "obsidian";
import { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { resolvePersonPhotoResource } from "../src/person-photo-resource";

function asset(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.extension = path.split(".").at(-1) ?? "";
	file.basename =
		path
			.split("/")
			.at(-1)
			?.replace(/\.[^.]+$/, "") ?? "";
	return file;
}

function appWith(file: TFile | undefined, resourcePath: string | (() => string) = "app://local/Assets/alice.png"): App {
	return {
		vault: {
			getAbstractFileByPath: (path: string) => (file?.path === path ? file : null),
			getResourcePath: () => {
				if (typeof resourcePath === "function") return resourcePath();
				return resourcePath;
			},
		},
	} as unknown as App;
}

describe("person photo resource adapter", () => {
	it("resolves only a current supported TFile through the vault resource API", () => {
		const file = asset("Assets/alice.png");
		file.stat.mtime = 42;
		file.stat.size = 2048;

		expect(resolvePersonPhotoResource(appWith(file), file.path)).toEqual({
			status: "ready",
			resourceUrl: "app://local/Assets/alice.png?people-atlas-asset=42%3A2048",
			cacheKey: "Assets/alice.png\u000042:2048",
		});
	});

	it("distinguishes missing and unsupported vault paths", () => {
		expect(resolvePersonPhotoResource(appWith(undefined), "Assets/missing.webp")).toEqual({
			status: "missing",
		});
		expect(resolvePersonPhotoResource(appWith(asset("Assets/profile.pdf")), "Assets/profile.pdf")).toEqual({
			status: "unsupported",
		});
		expect(resolvePersonPhotoResource(appWith(undefined), "https://example.test/profile.png")).toEqual({
			status: "unsupported",
		});
	});

	it.each([
		"https://example.test/alice.png",
		"//example.test/alice.png",
		"Assets/alice.png",
	])("rejects unsafe or raw resource output %s", (resourcePath) => {
		const file = asset("Assets/alice.png");
		expect(resolvePersonPhotoResource(appWith(file, resourcePath), file.path)).toEqual({
			status: "unavailable",
		});
	});

	it("accepts a non-network host-owned resource scheme and preserves existing query and fragment data", () => {
		const file = asset("Assets/alice.png");
		file.stat.mtime = 7;
		file.stat.size = 9;
		expect(
			resolvePersonPhotoResource(
				appWith(file, "capacitor://localhost/_app_file_/Assets/alice.png?token=local#preview"),
				file.path,
			),
		).toEqual({
			status: "ready",
			resourceUrl: "capacitor://localhost/_app_file_/Assets/alice.png?token=local&people-atlas-asset=7%3A9#preview",
			cacheKey: "Assets/alice.png\u00007:9",
		});
	});

	it("keeps normalized path and modification state in the cache key even for stable data URLs", () => {
		const file = asset("Assets/alice.png");
		file.stat.mtime = 11;
		file.stat.size = 13;
		const resourcePath = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

		const first = resolvePersonPhotoResource(appWith(file, resourcePath), file.path);
		file.stat.mtime = 12;
		const modified = resolvePersonPhotoResource(appWith(file, resourcePath), file.path);

		expect(first).toMatchObject({ status: "ready", cacheKey: "Assets/alice.png\u000011:13" });
		expect(modified).toMatchObject({ status: "ready", cacheKey: "Assets/alice.png\u000012:13" });
	});

	it("returns unavailable when the host resource adapter throws", () => {
		const file = asset("Assets/alice.png");
		expect(
			resolvePersonPhotoResource(
				appWith(file, () => {
					throw new Error("resource failure");
				}),
				file.path,
			),
		).toEqual({ status: "unavailable" });
	});
});
