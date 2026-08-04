import type { PersonRecord } from "./types";
import { sanitizeNoteName, validateNotePath } from "../mutations/validation";
import { validatePeopleRootFolder } from "./people-root";

export interface PeopleCollectionPaths {
	root: string;
	profiles: string;
	relationships: string;
	contactMoments: string;
}

function joinVaultPath(parent: string, child: string): string {
	return parent ? `${parent}/${child}` : child;
}

export function normalizePeopleRootFolder(value: string): string {
	return value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

const PERSON_UUID_PATTERN = /^person-([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i;
const CROCKFORD_BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const COLLISION_SUFFIX_PATTERN = /^(.*) · ([0123456789ABCDEFGHJKMNPQRSTVWXYZ]{2,26})$/;
const LEGACY_DOSSIER_PATTERN = /--[0-9a-f]{8}$/i;
const PORTABILITY_IGNORABLE_PATTERN = /[\p{Default_Ignorable_Code_Point}\p{Bidi_Control}]/u;
const WINDOWS_DEVICE_NAME_PATTERN = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const MAX_PORTABLE_SEGMENT_BYTES = 255;

export interface PersonDossierPlanInput {
	peopleRootFolder: string;
	displayName: string;
	personId: string;
	people: readonly PersonRecord[];
	vaultPaths: readonly string[];
	ignoredVaultPaths?: readonly string[];
}

export interface ReadyPersonDossierPlan {
	status: "ready";
	dossierPath: string;
	profilePath: string;
	suffixLength: number;
}

export interface BlockedPersonDossierPlan {
	status: "blocked";
	dossierPath?: string;
	profilePath?: string;
	error: string;
}

export type PersonDossierPlan = ReadyPersonDossierPlan | BlockedPersonDossierPlan;

export function peopleCollectionPaths(peopleRootFolder: string): {
	root: string;
	profiles: string;
	relationships: string;
	contactMoments: string;
} {
	const root = normalizePeopleRootFolder(peopleRootFolder);
	return {
		root,
		profiles: joinVaultPath(root, "Profiles"),
		relationships: joinVaultPath(root, "Relationships"),
		contactMoments: joinVaultPath(root, "Contact moments"),
	};
}

export function personDossierDisplayLabel(displayName: string): string {
	return sanitizeNoteName(displayName);
}

function hasC1ControlCharacter(value: string): boolean {
	return [...value].some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint >= 0x80 && codePoint <= 0x9f;
	});
}

function hasWindowsTrailingPathAlias(value: string): boolean {
	const normalizedValue = value.normalize("NFC");
	return normalizedValue.endsWith(".") || normalizedValue.endsWith(" ");
}

function isPortablePathSegment(segment: string): boolean {
	if (
		!segment ||
		segment !== segment.trim() ||
		hasWindowsTrailingPathAlias(segment) ||
		PORTABILITY_IGNORABLE_PATTERN.test(segment) ||
		hasC1ControlCharacter(segment) ||
		validateNotePath(`${segment}.md`)
	)
		return false;
	if (new TextEncoder().encode(segment).length > MAX_PORTABLE_SEGMENT_BYTES) return false;
	const windowsName = segment.normalize("NFC");
	const deviceStem = windowsName.split(".")[0]?.replace(/[ ]+$/u, "") ?? "";
	return Boolean(windowsName) && !WINDOWS_DEVICE_NAME_PATTERN.test(deviceStem);
}

export function isPortableProfileFilename(filename: string): boolean {
	const basename = filename.endsWith(".md") ? filename.slice(0, -3) : "";
	return (
		!filename.includes("/") &&
		!filename.includes("\\") &&
		Boolean(basename) &&
		isPortablePathSegment(basename) &&
		isPortablePathSegment(filename)
	);
}

function hasSafeDossierLabel(displayName: string, displayLabel: string): boolean {
	return (
		!hasWindowsTrailingPathAlias(displayName.trim()) &&
		!PORTABILITY_IGNORABLE_PATTERN.test(displayName) &&
		isPortablePathSegment(displayLabel) &&
		isPortableProfileFilename(`${displayLabel}.md`) &&
		Boolean(personDossierCollisionKey(displayLabel))
	);
}

export function personDossierCollisionKey(displayName: string): string {
	return portableCaselessKey(personDossierDisplayLabel(displayName))
		.replace(/\p{Mark}+/gu, "")
		.replace(/[^\p{Letter}\p{Number}]+/gu, " ")
		.trim();
}

function portableCaselessKey(value: string): string {
	return value
		.normalize("NFKD")
		.toUpperCase()
		.toLowerCase()
		.replace(/\u03c2/gu, "\u03c3");
}

function personUuidBytes(personId: string): number[] | undefined {
	const match = PERSON_UUID_PATTERN.exec(personId.trim());
	if (!match) return undefined;
	const hexadecimal = match.slice(1).join("");
	const bytes: number[] = [];
	for (let index = 0; index < hexadecimal.length; index += 2) {
		bytes.push(Number.parseInt(hexadecimal.slice(index, index + 2), 16));
	}
	return bytes.length === 16 ? bytes : undefined;
}

export function personIdCrockfordBase32(personId: string): string {
	const bytes = personUuidBytes(personId);
	if (!bytes) return "";
	let accumulator = 0;
	let bitCount = 0;
	let encoded = "";
	for (const byte of bytes) {
		accumulator = (accumulator << 8) | byte;
		bitCount += 8;
		while (bitCount >= 5) {
			bitCount -= 5;
			encoded += CROCKFORD_BASE32_ALPHABET[(accumulator >> bitCount) & 31];
		}
		accumulator &= (1 << bitCount) - 1;
	}
	if (bitCount > 0) encoded += CROCKFORD_BASE32_ALPHABET[(accumulator << (5 - bitCount)) & 31];
	return encoded;
}

export function personDossierSuffix(personId: string): string {
	return personIdCrockfordBase32(personId).slice(0, 2);
}

function dossierCandidate(
	profilesFolder: string,
	displayLabel: string,
	suffix: string,
): Pick<ReadyPersonDossierPlan, "dossierPath" | "profilePath"> | undefined {
	const dossierName = suffix ? `${displayLabel} · ${suffix}` : displayLabel;
	const profileFilename = `${displayLabel}.md`;
	if (!isPortablePathSegment(dossierName) || !isPortableProfileFilename(profileFilename)) return undefined;
	const dossierPath = joinVaultPath(profilesFolder, dossierName);
	return {
		dossierPath,
		profilePath: joinVaultPath(dossierPath, profileFilename),
	};
}

function dossierNameFromPath(profilesFolder: string, path: string): string | undefined {
	const profileParts = collisionPathParts(profilesFolder);
	const pathParts = collisionPathParts(path);
	if (!profileParts || !pathParts || pathParts.length <= profileParts.length) return undefined;
	if (
		!profileParts.every(
			(part, index) => collisionPathSegmentKey(part) === collisionPathSegmentKey(pathParts[index] ?? ""),
		)
	)
		return undefined;
	return pathParts[profileParts.length] || undefined;
}

function directDossierProfileParts(
	profilesFolder: string,
	profilePath: string,
): { dossierName: string; profileFilename: string } | undefined {
	const profileParts = collisionPathParts(profilesFolder);
	const pathParts = collisionPathParts(profilePath);
	if (!profileParts || !pathParts || pathParts.length !== profileParts.length + 2) return undefined;
	if (
		!profileParts.every(
			(part, index) => collisionPathSegmentKey(part) === collisionPathSegmentKey(pathParts[index] ?? ""),
		)
	)
		return undefined;
	const dossierName = pathParts[profileParts.length];
	const profileFilename = pathParts[profileParts.length + 1];
	if (
		!dossierName ||
		!profileFilename ||
		classifyDossierName(dossierName)?.kind !== "plain" ||
		!isPortableProfileFilename(profileFilename)
	)
		return undefined;
	return { dossierName, profileFilename };
}

function isCurrentCanonicalPlannerOwner(
	people: readonly PersonRecord[],
	vaultPaths: ReadonlySet<string>,
	profilesFolder: string,
	person: PersonRecord,
): boolean {
	return Boolean(
		personUuidBytes(person.id) &&
			directDossierProfileParts(profilesFolder, person.filePath) &&
			vaultPaths.has(person.filePath) &&
			people.filter((candidate) => candidate.id === person.id).length === 1 &&
			people.filter((candidate) => candidate.filePath === person.filePath).length === 1,
	);
}

function collisionPathParts(path: string): string[] | undefined {
	if (!path || path !== path.trim() || path.startsWith("/") || path.includes("\\")) return undefined;
	const parts = path.split("/");
	return parts.every((part) => part && part !== "." && part !== "..") ? parts : undefined;
}

function rawPathPartsForScope(path: string): string[] | undefined {
	if (!path || path !== path.trim() || path.startsWith("/") || path.startsWith("\\")) return undefined;
	const parts = path.split(/[\\/]+/);
	return parts.every((part) => part && part !== "." && part !== "..") ? parts : undefined;
}

function pathIsAtOrWithinParent(pathParts: string[] | undefined, parentParts: string[] | undefined): boolean {
	return Boolean(
		pathParts &&
			parentParts &&
			pathParts.length >= parentParts.length &&
			parentParts.every(
				(part, index) => collisionPathSegmentKey(part) === collisionPathSegmentKey(pathParts[index] ?? ""),
			),
	);
}

function pathIsWithinParent(pathParts: string[] | undefined, parentParts: string[] | undefined): boolean {
	return Boolean(
		pathParts && parentParts && pathParts.length > parentParts.length && pathIsAtOrWithinParent(pathParts, parentParts),
	);
}

function unsafeRawPathIsAtOrWithinParent(path: string, parentPath: string): boolean {
	return (
		!collisionPathParts(path) && pathIsAtOrWithinParent(rawPathPartsForScope(path), collisionPathParts(parentPath))
	);
}

function unsafePortabilityAliasPathIsAtOrWithinParent(path: string, parentPath: string): boolean {
	const pathParts = collisionPathParts(path) ?? rawPathPartsForScope(path);
	const parentParts = collisionPathParts(parentPath);
	if (!pathParts || !parentParts || pathParts.length < parentParts.length) return false;
	let hasAlias = false;
	const matchesParent = parentParts.every((parentPart, index) => {
		const pathPart = pathParts[index] ?? "";
		if (hasWindowsTrailingPathAlias(pathPart)) {
			hasAlias = true;
			// Scope evidence only: the trimmed alias is never returned or parsed as a canonical owner.
			const aliasBase = pathPart.normalize("NFC").replace(/[. ]+$/u, "");
			return collisionPathSegmentKey(aliasBase) === collisionPathSegmentKey(parentPart);
		}
		return collisionPathSegmentKey(pathPart) === collisionPathSegmentKey(parentPart);
	});
	return matchesParent && hasAlias;
}

function unsafePathIsAtOrWithinParent(path: string, parentPath: string): boolean {
	return (
		unsafeRawPathIsAtOrWithinParent(path, parentPath) || unsafePortabilityAliasPathIsAtOrWithinParent(path, parentPath)
	);
}

function unsafeRawPathIsInOrdinaryNamespace(path: string, profilesFolder: string, ordinaryKey: string): boolean {
	if (collisionPathParts(path)) return false;
	const pathParts = rawPathPartsForScope(path);
	const profileParts = collisionPathParts(profilesFolder);
	if (!pathIsWithinParent(pathParts, profileParts) || !pathParts || !profileParts) return false;
	const dossierName = pathParts[profileParts.length];
	return dossierName !== undefined && personDossierCollisionKey(dossierName) === ordinaryKey;
}

function collisionPathSegmentKey(segment: string): string {
	return portableCaselessKey(segment).replace(/\p{Mark}+/gu, "");
}

type DossierNameClassification =
	| { kind: "plain"; label: string }
	| { kind: "canonical-suffixed"; label: string; suffix: string };

function classifyDossierName(dossierName: string): DossierNameClassification | undefined {
	if (LEGACY_DOSSIER_PATTERN.test(dossierName)) return undefined;
	const suffixMatch = COLLISION_SUFFIX_PATTERN.exec(dossierName);
	if (suffixMatch) {
		const [, label, suffix] = suffixMatch;
		if (
			!label ||
			!suffix ||
			label.includes("·") ||
			!isPortablePathSegment(dossierName) ||
			!isPortablePathSegment(label) ||
			!personDossierCollisionKey(label)
		) {
			return undefined;
		}
		return { kind: "canonical-suffixed", label, suffix };
	}
	if (dossierName.includes("·") || !isPortablePathSegment(dossierName) || !personDossierCollisionKey(dossierName)) {
		return undefined;
	}
	return { kind: "plain", label: dossierName };
}

function plainDossierCollisionKey(dossierName: string): string | undefined {
	const classification = classifyDossierName(dossierName);
	return classification?.kind === "plain" ? personDossierCollisionKey(classification.label) : undefined;
}

function blockedPlan(
	error: string,
	candidate?: Pick<ReadyPersonDossierPlan, "dossierPath" | "profilePath">,
): BlockedPersonDossierPlan {
	return { status: "blocked", ...candidate, error };
}

export function planPersonDossier(input: PersonDossierPlanInput): PersonDossierPlan {
	const rootError = validatePeopleRootFolder(input.peopleRootFolder);
	const normalizedRoot = normalizePeopleRootFolder(input.peopleRootFolder);
	const displayLabel = personDossierDisplayLabel(input.displayName);
	const encodedId = personIdCrockfordBase32(input.personId);
	if (rootError || normalizedRoot !== input.peopleRootFolder.trim())
		return blockedPlan(rootError ?? "The People root folder is not canonical.");
	if (!hasSafeDossierLabel(input.displayName, displayLabel) || classifyDossierName(displayLabel)?.kind !== "plain")
		return blockedPlan("Enter a display name that has an unambiguous safe dossier label.");
	if (!encodedId) return blockedPlan("A UUID-backed person_id is required before planning the dossier.");

	const profilesFolder = peopleCollectionPaths(normalizedRoot).profiles;
	const plainCandidate = dossierCandidate(profilesFolder, displayLabel, "");
	if (!plainCandidate) return blockedPlan("No portable plain dossier candidate is available.");
	const plainKey = personDossierCollisionKey(displayLabel);
	const ignoredPaths = new Set(input.ignoredVaultPaths ?? []);
	const occupiedPaths = new Set([
		...input.vaultPaths.filter((path) => !ignoredPaths.has(path)),
		...input.people.map((person) => person.filePath),
	]);
	if (
		[...occupiedPaths].some(
			(path) =>
				unsafeRawPathIsInOrdinaryNamespace(path, profilesFolder, plainKey) ||
				unsafePortabilityAliasPathIsAtOrWithinParent(path, plainCandidate.dossierPath),
		)
	) {
		return blockedPlan(
			"The ordinary dossier namespace is occupied without exactly one other canonical person owner.",
			plainCandidate,
		);
	}
	const dossierNames = new Set<string>();
	for (const path of occupiedPaths) {
		const dossierName = dossierNameFromPath(profilesFolder, path);
		if (dossierName) dossierNames.add(dossierName);
	}
	const ordinaryNamespace = [...dossierNames].filter((name) => personDossierCollisionKey(name) === plainKey);
	const plainNamespace = ordinaryNamespace.filter((name) => plainDossierCollisionKey(name) === plainKey);
	if (ordinaryNamespace.length !== plainNamespace.length) {
		return blockedPlan(
			"The ordinary dossier namespace is occupied without exactly one other canonical person owner.",
			plainCandidate,
		);
	}
	if (plainNamespace.length === 0) {
		return { status: "ready", ...plainCandidate, suffixLength: 0 };
	}

	const namespacePeople = input.people.filter((person) => {
		const dossierName = dossierNameFromPath(profilesFolder, person.filePath);
		return dossierName !== undefined && personDossierCollisionKey(dossierName) === plainKey;
	});
	const owner = namespacePeople[0];
	const ownerIsCanonical =
		plainNamespace.length === 1 &&
		namespacePeople.length === 1 &&
		owner !== undefined &&
		owner.id !== input.personId &&
		isCurrentCanonicalPlannerOwner(input.people, new Set(input.vaultPaths), profilesFolder, owner);
	if (!ownerIsCanonical) {
		return blockedPlan(
			"The ordinary dossier namespace is occupied without exactly one other canonical person owner.",
			plainCandidate,
		);
	}

	for (let suffixLength = 2; suffixLength <= encodedId.length; suffixLength += 1) {
		const suffix = encodedId.slice(0, suffixLength);
		const candidate = dossierCandidate(profilesFolder, displayLabel, suffix);
		if (!candidate)
			return blockedPlan("No portable collision suffix remains available for this person_id.", plainCandidate);
		if ([...occupiedPaths].some((path) => unsafePathIsAtOrWithinParent(path, candidate.dossierPath))) {
			return blockedPlan("A collision suffix candidate is occupied by an unsafe raw path.", candidate);
		}
		const candidateKey = personDossierCollisionKey(`${displayLabel} · ${suffix}`);
		const occupied = [...dossierNames].some((name) => personDossierCollisionKey(name) === candidateKey);
		if (!occupied) return { status: "ready", ...candidate, suffixLength };
	}
	return blockedPlan("No collision suffix remains available for this person_id.", plainCandidate);
}

export function personDossierPath(peopleRootFolder: string, displayName: string, personId: string): string {
	const displayLabel = personDossierDisplayLabel(displayName);
	if (!displayLabel || hasWindowsTrailingPathAlias(displayName.trim()) || !personIdCrockfordBase32(personId)) return "";
	return dossierCandidate(peopleCollectionPaths(peopleRootFolder).profiles, displayLabel, "")?.dossierPath ?? "";
}

export function personProfilePath(peopleRootFolder: string, displayName: string, personId: string): string {
	const displayLabel = personDossierDisplayLabel(displayName);
	if (!displayLabel || hasWindowsTrailingPathAlias(displayName.trim()) || !personIdCrockfordBase32(personId)) return "";
	return dossierCandidate(peopleCollectionPaths(peopleRootFolder).profiles, displayLabel, "")?.profilePath ?? "";
}

function rawPathIsAtOrWithinParent(path: string, parentPath: string): boolean {
	return pathIsAtOrWithinParent(collisionPathParts(path), collisionPathParts(parentPath));
}

function pathIsAtOrWithinDossierParentMembership(path: string, parentPath: string): boolean {
	return rawPathIsAtOrWithinParent(path, parentPath) || unsafePortabilityAliasPathIsAtOrWithinParent(path, parentPath);
}

export function personDossierPathFromProfile(
	peopleRootFolder: string,
	profilePath: string,
	personId: string,
	vaultPaths: readonly string[],
	people: readonly PersonRecord[],
): string | undefined {
	const rootError = validatePeopleRootFolder(peopleRootFolder);
	const normalizedRoot = normalizePeopleRootFolder(peopleRootFolder);
	if (rootError || normalizedRoot !== peopleRootFolder.trim()) return undefined;
	const profilesFolder = peopleCollectionPaths(normalizedRoot).profiles;
	const encodedId = personIdCrockfordBase32(personId);
	if (!encodedId || !vaultPaths.includes(profilePath)) return undefined;
	const prefix = `${profilesFolder}/`;
	if (!profilePath.startsWith(prefix)) return undefined;
	const relativeParts = profilePath.slice(prefix.length).split("/");
	if (relativeParts.length !== 2) return undefined;
	const [dossierName, profileFilename] = relativeParts;
	const dossier = dossierName ? classifyDossierName(dossierName) : undefined;
	if (!dossierName || !dossier || !isPortableProfileFilename(profileFilename ?? "")) {
		return undefined;
	}
	if (dossier.kind === "canonical-suffixed" && !encodedId.startsWith(dossier.suffix)) return undefined;
	const dossierPath = joinVaultPath(profilesFolder, dossierName);
	if (
		[...vaultPaths, ...people.map((person) => person.filePath)].some((path) =>
			unsafePathIsAtOrWithinParent(path, dossierPath),
		)
	)
		return undefined;
	const namespacePeople = people.filter((person) =>
		pathIsAtOrWithinDossierParentMembership(person.filePath, dossierPath),
	);
	const owner = namespacePeople[0];
	if (
		namespacePeople.length !== 1 ||
		!owner ||
		owner.id !== personId ||
		owner.filePath !== profilePath ||
		!personUuidBytes(owner.id) ||
		people.filter((person) => person.id === personId).length !== 1 ||
		people.filter((person) => person.filePath === profilePath).length !== 1
	) {
		return undefined;
	}
	return dossierPath;
}
