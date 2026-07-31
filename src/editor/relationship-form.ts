import type { TFile } from "obsidian";
import type { PersonRecord, PersonReference, RelationshipRecord, RelationshipStatus } from "../domain/types";
import type { RelationshipMutationInput, RelationshipUpdates } from "../mutations/validation";
import { sanitizeNoteName } from "../mutations/validation";
import { relationshipPresetMatches, type RelationshipPreset } from "../settings/relationship-presets";

export interface RelationshipFormValues {
	path: string;
	fromPath: string;
	toPath: string;
	relationshipId: string;
	presetId: string;
	types: string;
	fromRole: string;
	toRole: string;
	closeness: string;
	since: string;
	lastContact: string;
	status: RelationshipStatus | "";
}

export interface RelationshipMutationPort {
	createRelationship(input: RelationshipMutationInput): Promise<TFile>;
	updateRelationship(file: TFile, updates: RelationshipUpdates): Promise<void>;
}

export type RelationshipFormSessionMode =
	| { kind: "create" }
	| { kind: "edit"; file: TFile; original: RelationshipFormValues };

export type RelationshipSubmitResult =
	| { status: "success"; createdFile?: TFile }
	| { status: "error"; message: string }
	| { status: "busy" }
	| { status: "cancelled" };

export type RelationshipPresetState = "unlinked" | "up-to-date" | "modified" | "missing";

export interface RelationshipCreatePrefill {
	fromPersonPath?: string;
	toPersonPath?: string;
	myPersonPath?: string;
}

export interface RelationshipFormPresentation {
	fromPersonLabel: string;
	toPersonLabel: string;
	fromRoleLabel: string;
	toRoleLabel: string;
	rolePreview?: string;
}

export function buildRelationshipCreatePrefill(
	people: PersonRecord[],
	selectedPersonPath: string | undefined,
	myPersonId: string | undefined,
): RelationshipCreatePrefill {
	const selectedPerson = selectedPersonPath ? resolveCanonicalPersonByPath(people, selectedPersonPath) : undefined;
	const myPerson = resolveUniqueExplicitPersonById(people, myPersonId);
	if (!myPerson) {
		return selectedPerson ? { fromPersonPath: selectedPerson.filePath } : {};
	}

	const prefill: RelationshipCreatePrefill = {
		fromPersonPath: myPerson.filePath,
		myPersonPath: myPerson.filePath,
	};
	if (selectedPerson && selectedPerson.filePath !== myPerson.filePath) {
		prefill.toPersonPath = selectedPerson.filePath;
	}
	return prefill;
}

export function createRelationshipFormValues(
	people: PersonRecord[],
	fromPersonPath?: string,
	toPersonPath?: string,
): RelationshipFormValues {
	const fromPerson = fromPersonPath ? resolveCanonicalPersonByPath(people, fromPersonPath) : undefined;
	const toPerson = toPersonPath ? resolveCanonicalPersonByPath(people, toPersonPath) : undefined;
	return {
		path: "",
		fromPath: fromPerson?.filePath ?? "",
		toPath: toPerson?.filePath ?? "",
		relationshipId: "",
		presetId: "",
		types: "",
		fromRole: "",
		toRole: "",
		closeness: "",
		since: "",
		lastContact: "",
		status: "",
	};
}

export function getRelationshipFormPresentation(
	values: Pick<RelationshipFormValues, "fromPath" | "toPath" | "fromRole" | "toRole">,
	people: PersonRecord[],
	myPersonPath?: string,
): RelationshipFormPresentation {
	const fromPerson = values.fromPath ? resolveCanonicalPersonByPath(people, values.fromPath) : undefined;
	const toPerson = values.toPath ? resolveCanonicalPersonByPath(people, values.toPath) : undefined;
	const myPerson = myPersonPath ? resolveCanonicalPersonByPath(people, myPersonPath) : undefined;
	const presentation: RelationshipFormPresentation = {
		fromPersonLabel: fromPerson ? `First person — ${fromPerson.name}` : "First person",
		toPersonLabel: toPerson ? `Second person — ${toPerson.name}` : "Second person",
		fromRoleLabel:
			fromPerson && fromPerson.filePath === myPerson?.filePath
				? "My role"
				: fromPerson
					? `${fromPerson.name}'s role`
					: "First person's role",
		toRoleLabel:
			toPerson && toPerson.filePath === myPerson?.filePath
				? "My role"
				: toPerson
					? `${toPerson.name}'s role`
					: "Second person's role",
	};
	const fromRole = values.fromRole.trim();
	const toRole = values.toRole.trim();
	if (fromPerson && toPerson && fromRole && toRole) {
		presentation.rolePreview =
			`In this relationship, ${fromPerson.name}'s role is ${fromRole} ` + `and ${toPerson.name}'s role is ${toRole}.`;
	}
	return presentation;
}

export function editRelationshipFormValues(
	relationship: RelationshipRecord,
	people: PersonRecord[],
	resolveLink: (target: string, sourcePath: string) => string | undefined,
): RelationshipFormValues {
	return {
		path: relationship.filePath,
		fromPath: resolveEndpointPath(relationship.from, relationship.filePath, people, resolveLink),
		toPath: resolveEndpointPath(relationship.to, relationship.filePath, people, resolveLink),
		relationshipId: relationship.id,
		presetId: relationship.presetId ?? "",
		types: relationship.types.join(", "),
		fromRole: relationship.fromRole ?? "",
		toRole: relationship.toRole ?? "",
		closeness: relationship.closeness === undefined ? "" : String(relationship.closeness),
		since: relationship.since ?? "",
		lastContact: relationship.lastContact ?? "",
		status: relationship.status ?? "",
	};
}

export function proposeRelationshipPath(
	values: Pick<RelationshipFormValues, "fromPath" | "toPath">,
	people: PersonRecord[],
): string {
	const from = people.find((person) => person.filePath === values.fromPath);
	const to = people.find((person) => person.filePath === values.toPath);
	if (!from || !to) return "";
	const fromName = sanitizeNoteName(from.name);
	const toName = sanitizeNoteName(to.name);
	if (!fromName || !toName) return "";
	return `People/Relationships/${fromName} - ${toName}.md`;
}

export function applyRelationshipPreset(
	values: RelationshipFormValues,
	preset: RelationshipPreset,
): RelationshipFormValues {
	return {
		...values,
		presetId: preset.id,
		types: preset.types.join(", "),
		fromRole: preset.fromRole,
		toRole: preset.toRole,
	};
}

export function detachRelationshipPreset(values: RelationshipFormValues): RelationshipFormValues {
	return { ...values, presetId: "" };
}

export function getRelationshipPresetState(
	values: RelationshipFormValues,
	presets: RelationshipPreset[],
): RelationshipPresetState {
	const presetId = values.presetId.trim();
	if (!presetId) return "unlinked";
	const preset = presets.find((candidate) => candidate.id === presetId);
	if (!preset) return "missing";
	return relationshipPresetMatches(
		{
			presetId,
			types: parseTypes(values.types),
			fromRole: optionalString(values.fromRole),
			toRole: optionalString(values.toRole),
		},
		preset,
	)
		? "up-to-date"
		: "modified";
}

export function buildRelationshipCreateInput(
	values: RelationshipFormValues,
	people: PersonRecord[],
): RelationshipMutationInput {
	const input: RelationshipMutationInput = {
		path: values.path.trim(),
		from: endpointReference(values.fromPath, "First person", people),
		to: endpointReference(values.toPath, "Second person", people),
	};
	const relationshipId = optionalString(values.relationshipId);
	const presetId = optionalString(values.presetId);
	const types = parseTypes(values.types);
	const fromRole = optionalString(values.fromRole);
	const toRole = optionalString(values.toRole);
	const closeness = optionalNumber(values.closeness);
	const since = optionalString(values.since);
	const lastContact = optionalString(values.lastContact);
	if (relationshipId !== undefined) input.relationshipId = relationshipId;
	if (presetId !== undefined) input.presetId = presetId;
	if (types.length > 0) input.types = types;
	if (fromRole !== undefined) input.fromRole = fromRole;
	if (toRole !== undefined) input.toRole = toRole;
	if (closeness !== undefined) input.closeness = closeness;
	if (since !== undefined) input.since = since;
	if (lastContact !== undefined) input.lastContact = lastContact;
	if (values.status) input.status = values.status;
	return input;
}

export function buildRelationshipUpdates(
	values: RelationshipFormValues,
	original: RelationshipFormValues,
	people: PersonRecord[],
): RelationshipUpdates {
	const updates: RelationshipUpdates = {};
	if (values.fromPath !== original.fromPath) {
		updates.from = endpointReference(values.fromPath, "First person", people);
	}
	if (values.toPath !== original.toPath) {
		updates.to = endpointReference(values.toPath, "Second person", people);
	}
	if (values.relationshipId.trim() !== original.relationshipId.trim()) {
		updates.relationshipId = optionalString(values.relationshipId) ?? null;
	}
	if (values.presetId.trim() !== original.presetId.trim()) {
		updates.presetId = optionalString(values.presetId) ?? null;
	}
	const types = parseTypes(values.types);
	const originalTypes = parseTypes(original.types);
	if (!sameStrings(types, originalTypes)) updates.types = types.length > 0 ? types : null;
	if (values.fromRole.trim() !== original.fromRole.trim()) {
		updates.fromRole = optionalString(values.fromRole) ?? null;
	}
	if (values.toRole.trim() !== original.toRole.trim()) {
		updates.toRole = optionalString(values.toRole) ?? null;
	}
	if (values.closeness.trim() !== original.closeness.trim()) {
		updates.closeness = optionalNumber(values.closeness) ?? null;
	}
	if (values.since.trim() !== original.since.trim()) {
		updates.since = optionalString(values.since) ?? null;
	}
	if (values.lastContact.trim() !== original.lastContact.trim()) {
		updates.lastContact = optionalString(values.lastContact) ?? null;
	}
	if (values.status !== original.status) updates.status = values.status || null;
	return updates;
}

export class RelationshipFormSession {
	private pending = false;
	private cancelled = false;
	private completed = false;

	constructor(
		private readonly mode: RelationshipFormSessionMode,
		people: PersonRecord[],
		private readonly mutations: RelationshipMutationPort,
		private readonly getCurrentPeople: () => PersonRecord[] = () => people,
	) {}

	cancel(): void {
		if (!this.pending && !this.completed) this.cancelled = true;
	}

	async submit(values: RelationshipFormValues): Promise<RelationshipSubmitResult> {
		if (this.cancelled || this.completed) return { status: "cancelled" };
		if (this.pending) return { status: "busy" };
		this.pending = true;
		try {
			const currentPeople = this.getCurrentPeople();
			if (this.mode.kind === "create") {
				const createdFile = await this.mutations.createRelationship(
					buildRelationshipCreateInput(values, currentPeople),
				);
				this.completed = true;
				return { status: "success", createdFile };
			}
			const updates = buildRelationshipUpdates(values, this.mode.original, currentPeople);
			if (Object.keys(updates).length > 0) {
				await this.mutations.updateRelationship(this.mode.file, updates);
			}
			this.completed = true;
			return { status: "success" };
		} catch (error) {
			return {
				status: "error",
				message: error instanceof Error ? error.message : String(error),
			};
		} finally {
			this.pending = false;
		}
	}
}

export function resolveCanonicalPersonByPath(people: PersonRecord[], personPath: string): PersonRecord | undefined {
	const pathMatches = people.filter((person) => person.filePath === personPath);
	if (pathMatches.length !== 1) return undefined;
	const person = pathMatches[0];
	if (!person || people.filter((candidate) => candidate.id === person.id).length !== 1) return undefined;
	return person;
}

function resolveEndpointPath(
	reference: PersonReference,
	sourcePath: string,
	people: PersonRecord[],
	resolveLink: (target: string, sourcePath: string) => string | undefined,
): string {
	const idMatches = people.filter((person) => person.id === reference.target);
	if (idMatches.length === 1) {
		const person = idMatches[0];
		if (person && resolveCanonicalPersonByPath(people, person.filePath)) return person.filePath;
		return reference.target;
	}
	if (idMatches.length > 1) return reference.target;
	const resolvedPath = resolveLink(reference.target, sourcePath);
	if (resolvedPath && resolveCanonicalPersonByPath(people, resolvedPath)) return resolvedPath;
	const exact = people.find(
		(person) => person.filePath === reference.target || person.filePath.replace(/\.md$/i, "") === reference.target,
	);
	return exact && resolveCanonicalPersonByPath(people, exact.filePath) ? exact.filePath : reference.target;
}

function resolveUniqueExplicitPersonById(
	people: PersonRecord[],
	personId: string | undefined,
): PersonRecord | undefined {
	const normalizedId = personId?.trim();
	if (!normalizedId) return undefined;
	const matches = people.filter((person) => person.id === normalizedId);
	if (matches.length !== 1) return undefined;
	const person = matches[0];
	if (!person) return undefined;
	return resolveCanonicalPersonByPath(people, person.filePath)?.id === normalizedId ? person : undefined;
}

function endpointReference(path: string, label: string, people: PersonRecord[]): string {
	const person = resolveCanonicalPersonByPath(people, path);
	if (!person) throw new Error(`${label} must be selected from indexed people.`);
	return `[[${person.filePath.replace(/\.md$/i, "")}]]`;
}

function optionalString(value: string): string | undefined {
	const normalized = value.trim();
	return normalized || undefined;
}

function optionalNumber(value: string): number | undefined {
	const normalized = value.trim();
	return normalized ? Number(normalized) : undefined;
}

function parseTypes(value: string): string[] {
	return [
		...new Set(
			value
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
		),
	];
}

function sameStrings(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}
