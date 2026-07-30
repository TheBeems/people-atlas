import type { TFile } from "obsidian";
import type { PersonRecord, PersonReference } from "../domain/types";
import type { PersonMutationInput, PersonUpdates } from "../mutations/validation";
import { sanitizeNoteName } from "../mutations/validation";

export interface PersonContactFormValue {
	raw: string;
	resolvedPath?: string | undefined;
}

export interface PersonFormValues {
	path: string;
	name: string;
	personId: string;
	personIdSource: "automatic" | "explicit" | "path-fallback";
	aliases: string;
	organisations: string;
	photo: string;
	contacts: PersonContactFormValue[];
}

export interface PersonEditOptions {
	targetPath?: string | undefined;
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

export type PersonFormSessionMode = { kind: "create" } | { kind: "edit"; file: TFile; original: PersonFormValues };

export function createPersonFormValues(peopleFolder: string): PersonFormValues {
	return {
		path: proposeCreatePersonPath("", peopleFolder),
		name: "",
		personId: "",
		personIdSource: "automatic",
		aliases: "",
		organisations: "",
		photo: "",
		contacts: [],
	};
}

export function editPersonFormValues(
	person: PersonRecord,
	explicitPersonId: string | undefined,
	rawPhoto: string | undefined,
	people: PersonRecord[],
	resolveLink: (target: string, sourcePath: string) => string | undefined,
): PersonFormValues {
	return {
		path: person.filePath,
		name: person.name,
		personId: explicitPersonId ?? person.id,
		personIdSource: explicitPersonId ? "explicit" : "path-fallback",
		aliases: formatLines(person.aliases),
		organisations: formatLines(person.organisations),
		photo: rawPhoto ?? "",
		contacts: person.contacts.map((reference) => ({
			raw: reference.raw,
			resolvedPath: resolveContactPath(reference, person.filePath, people, resolveLink),
		})),
	};
}

export function proposeCreatePersonPath(name: string, peopleFolder: string): string {
	const folder = normalizeFolder(peopleFolder);
	const fileName = sanitizeNoteName(name);
	return fileName ? `${folder ? `${folder}/` : ""}${fileName}.md` : `${folder ? `${folder}/` : ""}<name>.md`;
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
	const person = people.find((candidate) => candidate.filePath === personPath);
	if (!person) return { contacts, error: "Choose an indexed person." };
	if (selfPath === person.filePath) return { contacts, error: "A person cannot be their own contact." };
	if (contacts.some((contact) => contact.resolvedPath === person.filePath))
		return { contacts, error: "That person is already listed as a contact." };
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
	const input: PersonMutationInput = { name: values.name.trim() };
	const aliases = parseLines(values.aliases);
	const organisations = parseLines(values.organisations);
	const photo = optionalString(values.photo);
	const contacts = values.contacts.map((contact) => contact.raw);
	if (aliases.length > 0) input.aliases = aliases;
	if (organisations.length > 0) input.organisations = organisations;
	if (photo !== undefined) input.photo = photo;
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
	const contacts = values.contacts.map((contact) => contact.raw);
	const originalContacts = original.contacts.map((contact) => contact.raw);
	if (!sameStrings(contacts, originalContacts)) updates.contacts = contacts.length > 0 ? contacts : null;
	return updates;
}

export class PersonFormSession {
	private pending = false;
	private completed = false;
	private cancelled = false;

	constructor(
		private readonly mode: PersonFormSessionMode,
		private readonly mutations: PersonMutationPort,
	) {}

	cancel(): void {
		if (!this.pending && !this.completed) this.cancelled = true;
	}

	async submit(values: PersonFormValues, renameConfirmed = false): Promise<PersonSubmitResult> {
		if (this.cancelled || this.completed) return { status: "cancelled" };
		if (this.pending) return { status: "busy" };
		this.pending = true;
		try {
			if (this.mode.kind === "create") {
				const file = await this.mutations.createPerson(buildPersonCreateInput(values));
				this.completed = true;
				return { status: "success", file, created: true, renamed: false };
			}

			const targetPath = proposePersonRenamePath(this.mode.original.path, values.name);
			if (!targetPath) throw new Error("The person name cannot produce a valid note name.");
			const renameRequired = targetPath !== this.mode.original.path;
			if (renameRequired && !renameConfirmed) {
				return {
					status: "confirmation-required",
					currentPath: this.mode.original.path,
					targetPath,
				};
			}
			const updates = buildPersonUpdates(values, this.mode.original);
			if (Object.keys(updates).length === 0 && !renameRequired) {
				this.completed = true;
				return { status: "success", file: this.mode.file, created: false, renamed: false };
			}
			const result = await this.mutations.updatePerson(
				this.mode.file,
				updates,
				renameRequired ? { targetPath } : undefined,
			);
			this.completed = true;
			return { status: "success", file: result.file, created: false, renamed: result.renamed };
		} catch (error) {
			return mutationFailure(error);
		} finally {
			this.pending = false;
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
	if (idMatches.length === 1) return idMatches[0]?.filePath;
	if (idMatches.length > 1) return undefined;
	const resolvedPath = resolveLink(reference.target, sourcePath);
	if (resolvedPath && people.some((person) => person.filePath === resolvedPath)) return resolvedPath;
	const normalizedTarget = normalizeReferencePath(reference.target);
	return people.find((person) => {
		const normalizedPath = normalizeReferencePath(person.filePath);
		return normalizedPath === normalizedTarget || normalizedPath.replace(/\.md$/i, "") === normalizedTarget;
	})?.filePath;
}

function normalizeReferencePath(value: string): string {
	return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function normalizeFolder(value: string): string {
	return value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "");
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

function sameStrings(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}
