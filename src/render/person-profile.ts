import type { AtlasNode } from "../domain/types";
import { formatPersonBirthDateForDisplay, parsePersonBirthDate } from "../domain/person-profile";
import { personPhotoInitials } from "../domain/person-photo";
import { createTranslator, type Translator } from "../i18n";

export type PersonProfileFieldKey =
	| "pronouns"
	| "job-title"
	| "organisations"
	| "birth-date"
	| "gender"
	| "emails"
	| "phones";

export interface PersonProfileField {
	key: PersonProfileFieldKey;
	label: string;
	values: string[];
	linkScheme?: "mailto" | "tel" | undefined;
}

export interface PersonProfilePresentation {
	profileFields: PersonProfileField[];
	contactFields: PersonProfileField[];
}

export type PersonPhotoResourceResolution =
	| { status: "ready"; resourceUrl: string; cacheKey: string }
	| { status: "missing" | "unsupported" | "unavailable" };

/**
 * Resolves an indexed vault path to a local browser resource.
 *
 * Implementations must derive `resourceUrl` from Obsidian's vault resource
 * API. The renderer never treats the indexed path itself as a URL.
 */
export type PersonPhotoResourceResolver = (photoPath: string) => PersonPhotoResourceResolution;

export interface PersonProfileRenderOptions {
	contactHeadingLevel: 3 | 4;
	resolvePhotoResource?: PersonPhotoResourceResolver | undefined;
	translator?: Translator | undefined;
}

export function buildPersonProfilePresentation(
	node: AtlasNode,
	translator: Translator = createTranslator("en"),
): PersonProfilePresentation {
	const profileFields: PersonProfileField[] = [];
	const contactFields: PersonProfileField[] = [];

	appendTextField(profileFields, "pronouns", translator.personProfile.pronouns, node.pronouns);
	appendTextField(profileFields, "job-title", translator.personProfile.jobTitle, node.jobTitle);
	appendListField(profileFields, "organisations", translator.personProfile.organisations, node.organisations);
	const birthDate = node.birthDate ? parsePersonBirthDate(node.birthDate) : undefined;
	if (birthDate?.valid) {
		appendListField(profileFields, "birth-date", translator.personProfile.birthDate, [
			formatPersonBirthDateForDisplay(birthDate.value),
		]);
	}
	appendTextField(profileFields, "gender", translator.personProfile.gender, node.gender);
	appendListField(contactFields, "emails", translator.personProfile.email, node.emails ?? [], "mailto");
	appendListField(contactFields, "phones", translator.personProfile.phone, node.phones ?? [], "tel");

	return { profileFields, contactFields };
}

export function renderPersonProfile(
	doc: Document,
	node: AtlasNode,
	options: PersonProfileRenderOptions,
): HTMLDivElement {
	const translator = options.translator ?? createTranslator("en");
	const presentation = buildPersonProfilePresentation(node, translator);
	const profile = doc.createElement("div");
	profile.className = "people-atlas-profile";
	profile.append(renderProfilePhoto(doc, node, options.resolvePhotoResource, translator));
	if (presentation.profileFields.length > 0) {
		profile.append(renderDefinitionList(doc, presentation.profileFields, "people-atlas-profile-fields"));
	}
	if (presentation.contactFields.length > 0) {
		const contactDetails = doc.createElement("section");
		contactDetails.className = "people-atlas-contact-details";
		contactDetails.setAttribute("aria-label", translator.personProfile.contactDetails);
		const heading = doc.createElement(`h${options.contactHeadingLevel}`);
		heading.textContent = translator.personProfile.contactDetails;
		contactDetails.append(
			heading,
			renderDefinitionList(doc, presentation.contactFields, "people-atlas-contact-fields"),
		);
		profile.append(contactDetails);
	}
	return profile;
}

function renderProfilePhoto(
	doc: Document,
	node: AtlasNode,
	resolvePhotoResource: PersonPhotoResourceResolver | undefined,
	translator: Translator,
): HTMLDivElement {
	const photo = doc.createElement("div");
	photo.className = "people-atlas-profile-photo";
	photo.dataset.photoStatus = node.photoPath ? "unavailable" : "empty";

	const frame = doc.createElement("div");
	frame.className = "people-atlas-profile-photo-frame";
	const fallback = doc.createElement("span");
	fallback.className = "people-atlas-profile-photo-fallback";
	fallback.textContent = personPhotoInitials(node.label);
	fallback.setAttribute("aria-hidden", "true");
	frame.append(fallback);

	const explanation = doc.createElement("p");
	explanation.className = "people-atlas-profile-photo-explanation";
	explanation.setAttribute("role", "status");
	explanation.setAttribute("aria-live", "polite");
	explanation.hidden = true;
	photo.append(frame, explanation);

	if (!node.photoPath) return photo;

	let resolution: PersonPhotoResourceResolution | undefined;
	try {
		resolution = resolvePhotoResource?.(node.photoPath);
	} catch {
		resolution = { status: "unavailable" };
	}
	if (!resolution) resolution = { status: "unavailable" };
	if (resolution.status !== "ready") {
		showPhotoExplanation(photo, explanation, resolution.status, translator);
		return photo;
	}
	const resourceUrl = safeLocalPhotoResourceUrl(resolution.resourceUrl, node.photoPath);
	if (!resourceUrl) {
		showPhotoExplanation(photo, explanation, "unavailable", translator);
		return photo;
	}

	photo.dataset.photoStatus = "loading";
	const image = doc.createElement("img");
	image.className = "people-atlas-profile-photo-image";
	image.alt = "";
	image.decoding = "async";
	image.hidden = true;
	const cleanup = (): void => {
		image.removeEventListener("load", onLoad);
		image.removeEventListener("error", onError);
	};
	const onLoad = (): void => {
		cleanup();
		if (!image.isConnected) return;
		photo.dataset.photoStatus = "ready";
		fallback.hidden = true;
		image.hidden = false;
		explanation.hidden = true;
		explanation.textContent = "";
	};
	const onError = (): void => {
		cleanup();
		if (!image.isConnected) return;
		image.remove();
		fallback.hidden = false;
		showPhotoExplanation(photo, explanation, "decode-error", translator);
	};
	image.addEventListener("load", onLoad);
	image.addEventListener("error", onError);
	frame.append(image);
	image.src = resourceUrl;
	return photo;
}

export function safeLocalPhotoResourceUrl(resourceUrl: string, photoPath: string): string | undefined {
	const value = resourceUrl.trim();
	if (!value || value === photoPath.trim()) return undefined;
	if (/^(?:https?|ftp|wss?|javascript|vbscript):/i.test(value) || value.startsWith("//")) return undefined;
	return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : undefined;
}

function showPhotoExplanation(
	photo: HTMLElement,
	explanation: HTMLElement,
	status: "missing" | "unsupported" | "unavailable" | "decode-error",
	translator: Translator,
): void {
	photo.dataset.photoStatus = status;
	explanation.hidden = false;
	explanation.textContent =
		status === "missing"
			? translator.personProfile.photoMissing
			: status === "unsupported"
				? translator.personProfile.photoUnsupported
				: status === "decode-error"
					? translator.personProfile.photoDecodeError
					: translator.personProfile.photoUnavailable;
}

function appendTextField(
	target: PersonProfileField[],
	key: PersonProfileFieldKey,
	label: string,
	rawValue: string | undefined,
): void {
	const value = rawValue?.trim();
	if (value) appendListField(target, key, label, [value]);
}

function appendListField(
	target: PersonProfileField[],
	key: PersonProfileFieldKey,
	label: string,
	rawValues: readonly string[],
	linkScheme?: "mailto" | "tel",
): void {
	const values = rawValues.map((value) => value.trim()).filter(Boolean);
	if (values.length === 0) return;
	target.push({ key, label, values, linkScheme });
}

function renderDefinitionList(
	doc: Document,
	fields: readonly PersonProfileField[],
	className: string,
): HTMLDListElement {
	const list = doc.createElement("dl");
	list.className = className;
	for (const field of fields) {
		const term = doc.createElement("dt");
		term.textContent = field.label;
		const details = doc.createElement("dd");
		details.dataset.profileField = field.key;
		if (field.values.length === 1) {
			details.append(renderValue(doc, field.values[0] as string, field.linkScheme));
		} else {
			const values = doc.createElement("ul");
			for (const value of field.values) {
				const item = doc.createElement("li");
				item.append(renderValue(doc, value, field.linkScheme));
				values.append(item);
			}
			details.append(values);
		}
		list.append(term, details);
	}
	return list;
}

function renderValue(doc: Document, value: string, linkScheme: "mailto" | "tel" | undefined): Node {
	if (!linkScheme) return doc.createTextNode(value);
	const link = doc.createElement("a");
	link.textContent = value;
	link.setAttribute("href", `${linkScheme}:${value}`);
	return link;
}
