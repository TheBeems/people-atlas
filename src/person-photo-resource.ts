import { normalizePath, type App, TFile } from "obsidian";
import { isSupportedPersonPhotoPath } from "./domain/person-photo";
import type { PersonPhotoResourceResolution } from "./render/person-profile";

const NETWORK_RESOURCE_PATTERN = /^(?:https?|ftp|wss?):/i;

export function resolvePersonPhotoResource(app: App, photoPath: string): PersonPhotoResourceResolution {
	if (!isSupportedPersonPhotoPath(photoPath)) return { status: "unsupported" };
	const normalizedPath = normalizePath(photoPath);
	const file = app.vault.getAbstractFileByPath(normalizedPath);
	if (!(file instanceof TFile)) return { status: "missing" };
	if (!isSupportedPersonPhotoPath(file.path)) return { status: "unsupported" };

	try {
		const resourceUrl = app.vault.getResourcePath(file).trim();
		if (
			!resourceUrl ||
			resourceUrl === photoPath.trim() ||
			resourceUrl.startsWith("//") ||
			NETWORK_RESOURCE_PATTERN.test(resourceUrl) ||
			!/^[a-z][a-z0-9+.-]*:/i.test(resourceUrl)
		) {
			return { status: "unavailable" };
		}
		return {
			status: "ready",
			resourceUrl: withAssetRevision(resourceUrl, file.stat.mtime, file.stat.size),
			cacheKey: `${normalizedPath}\0${file.stat.mtime}:${file.stat.size}`,
		};
	} catch {
		return { status: "unavailable" };
	}
}

function withAssetRevision(resourceUrl: string, mtime: number, size: number): string {
	if (/^(?:blob|data):/i.test(resourceUrl) || !Number.isFinite(mtime) || !Number.isFinite(size)) {
		return resourceUrl;
	}
	const fragmentIndex = resourceUrl.indexOf("#");
	const base = fragmentIndex >= 0 ? resourceUrl.slice(0, fragmentIndex) : resourceUrl;
	const fragment = fragmentIndex >= 0 ? resourceUrl.slice(fragmentIndex) : "";
	const separator = base.includes("?") ? "&" : "?";
	return `${base}${separator}people-atlas-asset=${encodeURIComponent(`${mtime}:${size}`)}${fragment}`;
}
