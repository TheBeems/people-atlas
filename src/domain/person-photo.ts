const SUPPORTED_PERSON_PHOTO_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

export interface PersonPhotoAsset {
	path: string;
	basename: string;
	extension: string;
}

export function isSupportedPersonPhotoPath(path: string): boolean {
	if (!isCanonicalVaultRelativePath(path)) return false;
	return SUPPORTED_PERSON_PHOTO_EXTENSIONS.has(extensionOf(path));
}

export function supportedPersonPhotoAssets(paths: readonly string[]): PersonPhotoAsset[] {
	return paths.flatMap((path) => {
		if (!isSupportedPersonPhotoPath(path)) return [];
		const extension = extensionOf(path);
		const filename = path.slice(path.lastIndexOf("/") + 1);
		return [
			{
				path,
				basename: filename.slice(0, -(extension.length + 1)),
				extension,
			},
		];
	});
}

export function filterPersonPhotoAssets(assets: readonly PersonPhotoAsset[], query: string): PersonPhotoAsset[] {
	const normalizedQuery = query.trim().toLowerCase();
	return assets
		.filter((asset) => {
			if (!normalizedQuery) return true;
			return (
				asset.path.toLowerCase().includes(normalizedQuery) ||
				asset.basename.toLowerCase().includes(normalizedQuery) ||
				asset.extension.includes(normalizedQuery)
			);
		})
		.sort(comparePersonPhotoAssets);
}

export function canonicalPersonPhotoWikilink(path: string): string {
	if (!isSupportedPersonPhotoPath(path)) {
		throw new Error("Choose a supported image from the current vault.");
	}
	return `[[${path}]]`;
}

export function getPendingPersonPhotoSelectionError(
	rawPhoto: string,
	selectedPath: string | undefined,
	currentAssets: readonly PersonPhotoAsset[],
): string | undefined {
	if (selectedPath === undefined) return undefined;
	let canonicalPhoto: string;
	try {
		canonicalPhoto = canonicalPersonPhotoWikilink(selectedPath);
	} catch {
		return "The selected photo is no longer a supported vault image. Choose it again or clear the photo.";
	}
	if (rawPhoto !== canonicalPhoto) {
		return "The pending photo selection changed unexpectedly. Choose the vault image again or clear the photo.";
	}
	if (currentAssets.filter((asset) => asset.path === selectedPath).length !== 1) {
		return `The selected photo “${selectedPath}” is no longer uniquely available in the vault. Choose it again or clear the photo.`;
	}
	return undefined;
}

export function isExternalPhotoReference(value: string): boolean {
	const normalized = value.trim();
	return /^(?:https?:)?\/\//i.test(normalized) || /^[a-z][a-z0-9+.-]*:/i.test(normalized);
}

export function personPhotoInitials(label: string): string {
	const words = label.trim().split(/\s+/).filter(Boolean);
	return (
		words
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

function isCanonicalVaultRelativePath(path: string): boolean {
	if (
		!path ||
		path !== path.trim() ||
		path.startsWith("/") ||
		path.includes("\\") ||
		path.includes("|") ||
		path.includes("?") ||
		path.includes("#") ||
		path.includes("[[") ||
		path.includes("]]")
	)
		return false;
	if (isExternalPhotoReference(path)) return false;
	const segments = path.split("/");
	return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function extensionOf(path: string): string {
	const filename = path.slice(path.lastIndexOf("/") + 1);
	const dot = filename.lastIndexOf(".");
	return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

function comparePersonPhotoAssets(left: PersonPhotoAsset, right: PersonPhotoAsset): number {
	return (
		compareText(left.basename, right.basename) ||
		compareText(left.extension, right.extension) ||
		compareText(left.path, right.path)
	);
}

function compareText(left: string, right: string): number {
	const normalizedLeft = left.toLowerCase();
	const normalizedRight = right.toLowerCase();
	if (normalizedLeft < normalizedRight) return -1;
	if (normalizedLeft > normalizedRight) return 1;
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
