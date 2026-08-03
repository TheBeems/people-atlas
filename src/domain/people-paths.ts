import { sanitizeNoteName } from "../mutations/validation";
import { validatePeopleRootFolder } from "./people-root";

export interface PeopleCollectionPaths {
	root: string;
	profiles: string;
	relationships: string;
	contactMoments: string;
}

const PERSON_UUID_PATTERN = /([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function peopleCollectionPaths(peopleRootFolder: string): PeopleCollectionPaths {
	const root = normalizePeopleRootFolder(peopleRootFolder);
	return {
		root,
		profiles: joinPath(root, "Profiles"),
		relationships: joinPath(root, "Relationships"),
		contactMoments: joinPath(root, "Contact moments"),
	};
}

export function normalizePeopleRootFolder(value: string): string {
	return value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

export function personDossierSlug(displayName: string): string {
	return displayName
		.normalize("NFKD")
		.replace(/\p{Mark}/gu, "")
		.toLocaleLowerCase("en-US")
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

export function personDossierSuffix(personId: string): string {
	return PERSON_UUID_PATTERN.exec(personId.trim())?.[1]?.toLowerCase() ?? "";
}

export function personDossierPath(peopleRootFolder: string, displayName: string, personId: string): string {
	const slug = personDossierSlug(displayName);
	const suffix = personDossierSuffix(personId);
	if (!slug || !suffix) return "";
	return joinPath(peopleCollectionPaths(peopleRootFolder).profiles, `${slug}--${suffix}`);
}

export function personProfilePath(peopleRootFolder: string, displayName: string, personId: string): string {
	const dossier = personDossierPath(peopleRootFolder, displayName, personId);
	const fileName = sanitizeNoteName(displayName);
	return dossier && fileName ? joinPath(dossier, `${fileName}.md`) : "";
}

export function personDossierPathFromProfile(
	peopleRootFolder: string,
	profilePath: string,
	personId: string,
): string | undefined {
	if (validatePeopleRootFolder(peopleRootFolder)) return undefined;
	const root = normalizePeopleRootFolder(peopleRootFolder);
	if (root !== peopleRootFolder || !safePathSegments(root)) return undefined;
	const profiles = peopleCollectionPaths(root).profiles;
	const profilePrefix = `${profiles}/`;
	if (profilePath !== profilePath.trim() || profilePath.includes("\\") || !profilePath.startsWith(profilePrefix)) {
		return undefined;
	}
	const relativeSegments = profilePath.slice(profilePrefix.length).split("/");
	if (relativeSegments.length !== 2) return undefined;
	const [dossierName, fileName] = relativeSegments;
	if (!dossierName || !fileName?.endsWith(".md")) return undefined;
	const profileName = fileName.slice(0, -3);
	if (!profileName || sanitizeNoteName(profileName) !== profileName) return undefined;
	const suffix = personDossierSuffix(personId);
	const suffixMarker = `--${suffix}`;
	if (!suffix || !dossierName.endsWith(suffixMarker)) return undefined;
	const dossierSlug = dossierName.slice(0, -suffixMarker.length);
	if (!dossierSlug || personDossierSlug(dossierSlug) !== dossierSlug) return undefined;
	return joinPath(profiles, dossierName);
}

function safePathSegments(path: string): boolean {
	return path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function joinPath(parent: string, child: string): string {
	return parent ? `${parent}/${child}` : child;
}
