const UNSAFE_PEOPLE_ROOT_SEGMENT_CHARACTERS = new Set(`\\<>:"|?*[]#^`);

export function validatePeopleRootFolder(value: string): string | undefined {
	const normalized = value.trim();
	if (!normalized) return "Enter a People root folder.";
	if (normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(normalized))
		return "The People root folder must be relative to the vault.";
	if (normalized.endsWith("/")) return "The People root folder must not end with a trailing slash.";
	const segments = normalized.split("/");
	if (segments.some((part) => part === "." || part === ".." || !part.trim()))
		return "The People root folder must stay inside the vault.";
	if (
		[...value].some((character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return codePoint <= 0x1f || codePoint === 0x7f || UNSAFE_PEOPLE_ROOT_SEGMENT_CHARACTERS.has(character);
		})
	)
		return "People root folder segments cannot contain unsafe characters.";
	return undefined;
}
