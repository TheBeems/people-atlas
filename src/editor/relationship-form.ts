import type { TFile } from "obsidian";
import type {
	PersonRecord,
	PersonReference,
	RelationshipDirection,
	RelationshipRecord,
	RelationshipStatus,
} from "../domain/types";
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
	direction: RelationshipDirection;
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

export function createRelationshipFormValues(
	people: PersonRecord[],
	prefillPersonPath?: string,
): RelationshipFormValues {
	const fromPath =
		prefillPersonPath && people.some((person) => person.filePath === prefillPersonPath) ? prefillPersonPath : "";
	return {
		path: "",
		fromPath,
		toPath: "",
		relationshipId: "",
		presetId: "",
		types: "",
		fromRole: "",
		toRole: "",
		direction: "undirected",
		closeness: "",
		since: "",
		lastContact: "",
		status: "",
	};
}

export function editRelationshipFormValues(
	relationship: RelationshipRecord,
	explicitRelationshipId: string | undefined,
	people: PersonRecord[],
	resolveLink: (target: string, sourcePath: string) => string | undefined,
): RelationshipFormValues {
	return {
		path: relationship.filePath,
		fromPath: resolveEndpointPath(relationship.from, relationship.filePath, people, resolveLink),
		toPath: resolveEndpointPath(relationship.to, relationship.filePath, people, resolveLink),
		relationshipId: explicitRelationshipId ?? "",
		presetId: relationship.presetId ?? "",
		types: relationship.types.join(", "),
		fromRole: relationship.fromRole ?? "",
		toRole: relationship.toRole ?? "",
		direction: relationship.direction,
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
		direction: preset.direction,
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
			direction: values.direction,
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
		from: endpointReference(values.fromPath, "Person A", people),
		to: endpointReference(values.toPath, "Person B", people),
		direction: values.direction,
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
		updates.from = endpointReference(values.fromPath, "Person A", people);
	}
	if (values.toPath !== original.toPath) {
		updates.to = endpointReference(values.toPath, "Person B", people);
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
	if (values.direction !== original.direction) updates.direction = values.direction;
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
		private readonly people: PersonRecord[],
		private readonly mutations: RelationshipMutationPort,
	) {}

	cancel(): void {
		if (!this.pending && !this.completed) this.cancelled = true;
	}

	async submit(values: RelationshipFormValues): Promise<RelationshipSubmitResult> {
		if (this.cancelled || this.completed) return { status: "cancelled" };
		if (this.pending) return { status: "busy" };
		this.pending = true;
		try {
			if (this.mode.kind === "create") {
				const createdFile = await this.mutations.createRelationship(buildRelationshipCreateInput(values, this.people));
				this.completed = true;
				return { status: "success", createdFile };
			}
			const updates = buildRelationshipUpdates(values, this.mode.original, this.people);
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

function resolveEndpointPath(
	reference: PersonReference,
	sourcePath: string,
	people: PersonRecord[],
	resolveLink: (target: string, sourcePath: string) => string | undefined,
): string {
	const idMatches = people.filter((person) => person.id === reference.target);
	if (idMatches.length === 1) return idMatches[0]?.filePath ?? reference.target;
	if (idMatches.length > 1) return reference.target;
	const resolvedPath = resolveLink(reference.target, sourcePath);
	if (resolvedPath && people.some((person) => person.filePath === resolvedPath)) return resolvedPath;
	const exact = people.find(
		(person) => person.filePath === reference.target || person.filePath.replace(/\.md$/i, "") === reference.target,
	);
	return exact?.filePath ?? reference.target;
}

function endpointReference(path: string, label: string, people: PersonRecord[]): string {
	const person = people.find((candidate) => candidate.filePath === path);
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
