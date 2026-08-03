import type { TFile } from "obsidian";
import {
	formatPersonBirthDate,
	parsePersonBirthDate,
	validatePersonEmails,
	validatePersonPhones,
	type PersonProfileListIssue,
} from "../domain/person-profile";
import {
	dossierPersonPhotoAssets,
	getPendingPersonPhotoSelectionError,
	type PersonPhotoAsset,
} from "../domain/person-photo";
import { peopleCollectionPaths, personDossierPathFromProfile, personProfilePath } from "../domain/people-paths";
import type { PersonRecord, PersonReference } from "../domain/types";
import type { PersonMutationInput, PersonUpdates } from "../mutations/validation";
import { sanitizeNoteName } from "../mutations/validation";
import type { PersonEditSourceBaseline } from "../mutations/person-source-guard";

export interface PersonContactFormValue {
	raw: string;
	resolvedPath?: string | undefined;
}

export interface PersonBirthDateFormValue {
	year: string;
	month: string;
	day: string;
}

export interface PersonFormValues {
	path: string;
	name: string;
	personId: string;
	personIdSource: "automatic" | "explicit";
	aliases: string;
	organisations: string;
	photo: string;
	photoSelectionPath?: string | undefined;
	birthDate: PersonBirthDateFormValue;
	pronouns: string;
	gender: string;
	emails: string[];
	phones: string[];
	jobTitle: string;
	contacts: PersonContactFormValue[];
}

export interface PersonEditOptions {
	targetPath?: string | undefined;
	expectedPersonId?: string | undefined;
	expectedClassification?: "type" | "tag" | undefined;
	sourceBaseline?: PersonEditSourceBaseline | undefined;
}

export interface PersonEditResult {
	file: TFile;
	renamed: boolean;
}

export interface PersonMutationPort {
	createPerson(input: PersonMutationInput): Promise<TFile>;
	updatePerson(file: TFile, updates: PersonUpdates, options?: PersonEditOptions): Promise<PersonEditResult>;
}

export type PersonSubmitResult =
	| { status: "success"; file: TFile; created: boolean; renamed: boolean }
	| { status: "confirmation-required"; currentPath: string; targetPath: string }
	| {
			status: "error";
			message: string;
			partial: boolean;
			currentPath?: string | undefined;
			targetPath?: string | undefined;
	  }
	| { status: "busy" }
	| { status: "cancelled" };

export type PersonFormSessionMode =
	| { kind: "create" }
	| {
			kind: "edit";
			file: TFile;
			original: PersonFormValues;
			expectedClassification?: "type" | "tag" | undefined;
			sourceBaseline?: PersonEditSourceBaseline | undefined;
	  };

export function createPersonFormValues(peopleRootFolder: string, personId = ""): PersonFormValues {
	return {
		path: proposeCreatePersonPath("", peopleRootFolder, personId),
		name: "",
		personId,
		personIdSource: "automatic",
		aliases: "",
		organisations: "",
		photo: "",
		birthDate: emptyBirthDate(),
		pronouns: "",
		gender: "",
		emails: [],
		phones: [],
		jobTitle: "",
		contacts: [],
	};
}

export function editPersonFormValues(
	person: PersonRecord,
	rawPhoto: string | undefined,
	people: PersonRecord[],
	resolveLink: (target: string, sourcePath: string) => string | undefined,
): PersonFormValues {
	return {
		path: person.filePath,
		name: person.name,
		personId: person.id,
		personIdSource: "explicit",
		aliases: formatLines(person.aliases),
		organisations: formatLines(person.organisations),
		photo: rawPhoto ?? "",
		birthDate: editBirthDateValue(person.birthDate),
		pronouns: person.pronouns ?? "",
		gender: person.gender ?? "",
		emails: [...person.emails],
		phones: [...person.phones],
		jobTitle: person.jobTitle ?? "",
		contacts: person.contacts.map((reference) => ({
			raw: reference.raw,
			resolvedPath: resolveContactPath(reference, person.filePath, people, resolveLink),
		})),
	};
}

export function proposeCreatePersonPath(name: string, peopleRootFolder: string, personId = ""): string {
	const path = personProfilePath(peopleRootFolder, name, personId);
	if (path) return path;
	const profiles = peopleCollectionPaths(peopleRootFolder).profiles;
	return `${profiles}/<name>--<id>/<name>.md`;
}

export function proposePersonRenamePath(currentPath: string, name: string): string {
	const fileName = sanitizeNoteName(name);
	if (!fileName) return "";
	const slash = currentPath.lastIndexOf("/");
	const parent = slash >= 0 ? currentPath.slice(0, slash + 1) : "";
	return `${parent}${fileName}.md`;
}

export function addPersonContact(
	contacts: PersonContactFormValue[],
	personPath: string,
	people: PersonRecord[],
	selfPath?: string,
): { contacts: PersonContactFormValue[]; error?: string | undefined } {
	const person = resolveCanonicalPersonByPath(people, personPath);
	if (!person) return { contacts, error: "Choose one canonical indexed person." };
	if (selfPath === person.filePath) return { contacts, error: "A person cannot be linked to themselves." };
	if (contacts.some((contact) => contact.resolvedPath === person.filePath))
		return { contacts, error: "That person is already listed under Linked people." };
	return {
		contacts: [
			...contacts,
			{
				raw: `[[${person.filePath.replace(/\.md$/i, "")}]]`,
				resolvedPath: person.filePath,
			},
		],
	};
}

export function buildPersonCreateInput(values: PersonFormValues): PersonMutationInput {
	const input: PersonMutationInput = { name: values.name.trim(), reviewedPath: values.path };
	const personId = optionalString(values.personId);
	const aliases = parseLines(values.aliases);
	const organisations = parseLines(values.organisations);
	const birthDate = serializeBirthDate(values.birthDate);
	const pronouns = optionalString(values.pronouns);
	const gender = optionalString(values.gender);
	const emails = validatedEmails(values.emails);
	const phones = validatedPhones(values.phones);
	const jobTitle = optionalString(values.jobTitle);
	const contacts = values.contacts.map((contact) => contact.raw);
	if (personId !== undefined) input.personId = personId;
	if (aliases.length > 0) input.aliases = aliases;
	if (organisations.length > 0) input.organisations = organisations;
	if (birthDate !== undefined) input.birthDate = birthDate;
	if (pronouns !== undefined) input.pronouns = pronouns;
	if (gender !== undefined) input.gender = gender;
	if (emails.length > 0) input.emails = emails;
	if (phones.length > 0) input.phones = phones;
	if (jobTitle !== undefined) input.jobTitle = jobTitle;
	if (contacts.length > 0) input.contacts = contacts;
	return input;
}

export function buildPersonUpdates(values: PersonFormValues, original: PersonFormValues): PersonUpdates {
	const updates: PersonUpdates = {};
	const name = values.name.trim();
	if (name !== original.name.trim()) updates.name = name || null;
	const aliases = parseLines(values.aliases);
	const originalAliases = parseLines(original.aliases);
	if (!sameStrings(aliases, originalAliases)) updates.aliases = aliases.length > 0 ? aliases : null;
	const organisations = parseLines(values.organisations);
	const originalOrganisations = parseLines(original.organisations);
	if (!sameStrings(organisations, originalOrganisations))
		updates.organisations = organisations.length > 0 ? organisations : null;
	const photo = optionalString(values.photo);
	const originalPhoto = optionalString(original.photo);
	if (photo !== originalPhoto) updates.photo = photo ?? null;
	if (!sameBirthDate(values.birthDate, original.birthDate)) {
		updates.birthDate = serializeBirthDate(values.birthDate) ?? null;
	}
	assignOptionalTextUpdate(updates, "pronouns", values.pronouns, original.pronouns);
	assignOptionalTextUpdate(updates, "gender", values.gender, original.gender);
	if (!sameStrings(values.emails, original.emails)) {
		const emails = validatedEmails(values.emails);
		updates.emails = emails.length > 0 ? emails : null;
	}
	if (!sameStrings(values.phones, original.phones)) {
		const phones = validatedPhones(values.phones);
		updates.phones = phones.length > 0 ? phones : null;
	}
	assignOptionalTextUpdate(updates, "jobTitle", values.jobTitle, original.jobTitle);
	const contacts = values.contacts.map((contact) => contact.raw);
	const originalContacts = original.contacts.map((contact) => contact.raw);
	if (!sameStrings(contacts, originalContacts)) updates.contacts = contacts.length > 0 ? contacts : null;
	return updates;
}

export function getPersonBirthDateError(value: PersonBirthDateFormValue): string | undefined {
	try {
		serializeBirthDate(value);
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

export function getPersonEmailIssues(values: readonly string[]): PersonProfileListIssue[] {
	return validatePersonEmails(values).issues;
}

export function getPersonPhoneIssues(values: readonly string[]): PersonProfileListIssue[] {
	return validatePersonPhones(values).issues;
}

export class PersonFormSession {
	private pending = false;
	private completed = false;
	private cancelled = false;

	constructor(
		private readonly mode: PersonFormSessionMode,
		private readonly mutations: PersonMutationPort,
		people: PersonRecord[] = [],
		private readonly getCurrentPeople: () => PersonRecord[] = () => people,
		private readonly getCurrentPhotoAssets: () => readonly PersonPhotoAsset[] = () => [],
		private readonly getPeopleRootFolder: () => string = () => "",
	) {}

	cancel(): void {
		if (!this.pending && !this.completed) this.cancelled = true;
	}

	async submit(values: PersonFormValues, renameConfirmed = false): Promise<PersonSubmitResult> {
		if (this.cancelled || this.completed) return { status: "cancelled" };
		if (this.pending) return { status: "busy" };
		this.pending = true;
		try {
			this.validatePhotoChange(values);
			if (this.mode.kind === "create") {
				const input = buildPersonCreateInput(values);
				this.validateChangedLinkedPeople(values, this.getCurrentPeople());
				const file = await this.mutations.createPerson(input);
				this.completed = true;
				return { status: "success", file, created: true, renamed: false };
			}

			const targetPath = proposePersonRenamePath(this.mode.original.path, values.name);
			if (!targetPath) throw new Error("The person name cannot produce a valid note name.");
			const renameRequired = targetPath !== this.mode.original.path;
			const updates = buildPersonUpdates(values, this.mode.original);
			if (renameRequired && !renameConfirmed) {
				return {
					status: "confirmation-required",
					currentPath: this.mode.original.path,
					targetPath,
				};
			}
			this.validateChangedLinkedPeople(values, this.getCurrentPeople());
			if (Object.keys(updates).length === 0 && !renameRequired) {
				this.completed = true;
				return { status: "success", file: this.mode.file, created: false, renamed: false };
			}
			const result = await this.mutations.updatePerson(this.mode.file, updates, {
				...(renameRequired ? { targetPath } : {}),
				expectedPersonId: this.mode.original.personId,
				expectedClassification: this.mode.expectedClassification ?? "type",
				...(this.mode.sourceBaseline ? { sourceBaseline: this.mode.sourceBaseline } : {}),
			});
			this.completed = true;
			return { status: "success", file: result.file, created: false, renamed: result.renamed };
		} catch (error) {
			return mutationFailure(error);
		} finally {
			this.pending = false;
		}
	}

	private validatePhotoChange(values: PersonFormValues): void {
		if (values.photoSelectionPath !== undefined) {
			if (this.mode.kind === "create") {
				throw new Error("Choose a local photo in Edit after the dossier exists.");
			}
			const dossierPath = personDossierPathFromProfile(
				this.getPeopleRootFolder(),
				this.mode.original.path,
				this.mode.original.personId,
			);
			if (!dossierPath) {
				throw new Error("The current profile note has no safe canonical dossier boundary.");
			}
			const currentAssets = this.getCurrentPhotoAssets();
			const error = getPendingPersonPhotoSelectionError(values.photo, values.photoSelectionPath, currentAssets);
			if (error) throw new Error(error);
			if (
				dossierPersonPhotoAssets(currentAssets, dossierPath).filter((asset) => asset.path === values.photoSelectionPath)
					.length !== 1
			) {
				throw new Error("Choose a supported photo from this person's own dossier.");
			}
			return;
		}
		const originalPhoto = this.mode.kind === "edit" ? this.mode.original.photo : "";
		if (values.photo === originalPhoto || values.photo === "") return;
		throw new Error("Choose a supported vault image with the photo picker, or clear the existing photo.");
	}

	private validateChangedLinkedPeople(values: PersonFormValues, currentPeople: PersonRecord[]): void {
		const originalContacts = this.mode.kind === "edit" ? this.mode.original.contacts : [];
		const newContacts = values.contacts.filter(
			(contact) =>
				!originalContacts.some(
					(original) => original.raw === contact.raw && original.resolvedPath === contact.resolvedPath,
				),
		);
		for (const contact of newContacts) {
			if (!contact.resolvedPath) {
				throw new Error("New Linked people entries must resolve to one canonical indexed person.");
			}
			const person = resolveCanonicalPersonByPath(currentPeople, contact.resolvedPath);
			if (!person) {
				throw new Error(`Linked person “${contact.resolvedPath}” is no longer uniquely available.`);
			}
			if (this.mode.kind === "edit" && person.filePath === this.mode.file.path) {
				throw new Error("A person cannot be linked to themselves.");
			}
		}
	}
}

function mutationFailure(error: unknown): Extract<PersonSubmitResult, { status: "error" }> {
	if (isPartialPersonMutationError(error)) {
		return {
			status: "error",
			message: error.message,
			partial: true,
			currentPath: error.currentPath,
			targetPath: error.targetPath,
		};
	}
	return {
		status: "error",
		message: error instanceof Error ? error.message : String(error),
		partial: false,
	};
}

function isPartialPersonMutationError(
	error: unknown,
): error is Error & { propertiesSaved: true; currentPath: string; targetPath: string } {
	return (
		error instanceof Error &&
		(error as { propertiesSaved?: unknown }).propertiesSaved === true &&
		typeof (error as { currentPath?: unknown }).currentPath === "string" &&
		typeof (error as { targetPath?: unknown }).targetPath === "string"
	);
}

function resolveContactPath(
	reference: PersonReference,
	sourcePath: string,
	people: PersonRecord[],
	resolveLink: (target: string, sourcePath: string) => string | undefined,
): string | undefined {
	const idMatches = people.filter((person) => person.id === reference.target);
	if (idMatches.length === 1) {
		const person = idMatches[0];
		return person && resolveCanonicalPersonByPath(people, person.filePath) ? person.filePath : undefined;
	}
	if (idMatches.length > 1) return undefined;
	const resolvedPath = resolveLink(reference.target, sourcePath);
	if (resolvedPath && resolveCanonicalPersonByPath(people, resolvedPath)) return resolvedPath;
	const normalizedTarget = normalizeReferencePath(reference.target);
	const pathMatch = people.find((person) => {
		const normalizedPath = normalizeReferencePath(person.filePath);
		return normalizedPath === normalizedTarget || normalizedPath.replace(/\.md$/i, "") === normalizedTarget;
	});
	return pathMatch && resolveCanonicalPersonByPath(people, pathMatch.filePath) ? pathMatch.filePath : undefined;
}

function resolveCanonicalPersonByPath(people: PersonRecord[], personPath: string): PersonRecord | undefined {
	const pathMatches = people.filter((person) => person.filePath === personPath);
	if (pathMatches.length !== 1) return undefined;
	const person = pathMatches[0];
	if (!person || people.filter((candidate) => candidate.id === person.id).length !== 1) return undefined;
	return person;
}

function editBirthDateValue(structuredValue: string | undefined): PersonBirthDateFormValue {
	if (!structuredValue) return emptyBirthDate();
	const parsed = parsePersonBirthDate(structuredValue);
	if (!parsed.valid) return emptyBirthDate();
	return {
		year: parsed.parts.year === undefined ? "" : String(parsed.parts.year).padStart(4, "0"),
		month: String(parsed.parts.month).padStart(2, "0"),
		day: String(parsed.parts.day).padStart(2, "0"),
	};
}

function serializeBirthDate(value: PersonBirthDateFormValue): string | undefined {
	const year = value.year.trim();
	const month = value.month.trim();
	const day = value.day.trim();
	if (!year && !month && !day) return undefined;
	if (!month || !day) throw new Error("Birth date requires both month and day, or all fields must be cleared.");
	if (year && !/^\d{4}$/.test(year)) throw new Error("Birth year must contain exactly four digits or be blank.");
	if (!/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
		throw new Error("Birth month and day must contain one or two digits.");
	}
	const formatted = formatPersonBirthDate({
		...(year ? { year: Number(year) } : {}),
		month: Number(month),
		day: Number(day),
	});
	if (!formatted) throw new Error("Birth date must be a calendar-valid date.");
	return formatted;
}

function validatedEmails(values: readonly string[]): string[] {
	const validation = validatePersonEmails(values);
	if (validation.issues.length > 0) {
		throw new Error(validation.issues.map((issue) => `Email address ${issue.index + 1}: ${issue.message}`).join(" "));
	}
	return validation.values;
}

function validatedPhones(values: readonly string[]): string[] {
	const validation = validatePersonPhones(values);
	if (validation.issues.length > 0) {
		throw new Error(validation.issues.map((issue) => `Phone number ${issue.index + 1}: ${issue.message}`).join(" "));
	}
	return validation.values;
}

function assignOptionalTextUpdate(
	updates: PersonUpdates,
	key: "pronouns" | "gender" | "jobTitle",
	value: string,
	original: string,
): void {
	const normalized = optionalString(value);
	const originalNormalized = optionalString(original);
	if (normalized !== originalNormalized) updates[key] = normalized ?? null;
}

function emptyBirthDate(): PersonBirthDateFormValue {
	return { year: "", month: "", day: "" };
}

function sameBirthDate(left: PersonBirthDateFormValue, right: PersonBirthDateFormValue): boolean {
	return left.year === right.year && left.month === right.month && left.day === right.day;
}

function normalizeReferencePath(value: string): string {
	return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function formatLines(values: string[]): string {
	return values.join("\n");
}

function parseLines(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function optionalString(value: string): string | undefined {
	const normalized = value.trim();
	return normalized || undefined;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}
