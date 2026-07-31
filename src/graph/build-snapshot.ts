import { normalizePathIdentity } from "../domain/identity";
import { referenceKey } from "../domain/wikilink";
import type {
	AtlasDiagnostic,
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	ContactMomentRecord,
	ContactMomentSummary,
	NodeId,
	PersonId,
	PersonRecord,
	PersonReference,
	RawIndexSnapshot,
	RelationshipRecord,
	RelationshipReference,
} from "../domain/types";
import { stableHash } from "../utils/hash";
import { filteredEndpointDiagnostic, inferredContactEdgeId } from "./graph-elements";

export type LinkResolver = (referenceTarget: string, sourcePath: string) => string | undefined;

export interface BuildAtlasSnapshotOptions {
	resolutionPeople?: PersonRecord[] | undefined;
}

interface ResolutionContext {
	peopleById: Map<PersonId, PersonRecord[]>;
	peopleByPath: Map<string, PersonRecord>;
	outputNodeIdByPath: Map<string, NodeId>;
	resolveLink: LinkResolver;
}

interface ContactMomentResolutionContext {
	peopleById: Map<string, PersonRecord[]>;
	peopleByPath: Map<string, PersonRecord[]>;
	relationshipsById: Map<string, RelationshipRecord[]>;
	relationshipsByPath: Map<string, RelationshipRecord[]>;
	resolveLink: LinkResolver;
}

interface ResolvedContactMomentReferences {
	personPaths: string[];
	relationshipEndpointPaths: string[];
	relationship?: RelationshipRecord | undefined;
}

interface ValidatedContactMoment {
	record: ContactMomentRecord;
	summary: ContactMomentSummary;
	references: ResolvedContactMomentReferences;
}

export interface ContactMomentProjection {
	contactMoments: ContactMomentSummary[];
	hiddenContactMomentCount: number;
}

const CONTACT_MOMENT_DIAGNOSTIC_CODES = new Set<AtlasDiagnostic["code"]>([
	"duplicate-contact-moment-id",
	"invalid-contact-moment-people",
	"duplicate-contact-moment-person",
	"unresolved-contact-moment-person",
	"ambiguous-contact-moment-person",
	"unresolved-contact-moment-relationship",
	"ambiguous-contact-moment-relationship",
	"contact-moment-relationship-person-mismatch",
	"invalid-contact-moment-occurred-on",
	"invalid-contact-moment-follow-up-date",
	"invalid-contact-moment-follow-up-status",
]);

function ghostId(reference: PersonReference): NodeId {
	return `ghost:${stableHash(referenceKey(reference))}`;
}

function duplicateDiagnostics(resolutionPeople: PersonRecord[], outputPeople: PersonRecord[]): AtlasDiagnostic[] {
	const grouped = new Map<PersonId, Map<string, PersonRecord>>();
	for (const person of [...resolutionPeople, ...outputPeople]) {
		const people = grouped.get(person.id) ?? new Map<string, PersonRecord>();
		people.set(person.filePath, person);
		grouped.set(person.id, people);
	}

	const diagnostics: AtlasDiagnostic[] = [];
	for (const [id, people] of grouped) {
		if (people.size < 2) continue;
		diagnostics.push({
			id: `duplicate-person-id:${id}`,
			severity: "error",
			code: "duplicate-person-id",
			message: `Multiple person notes use the ID “${id}”.`,
			filePaths: [...people.values()].map((person) => person.filePath).sort(),
		});
	}
	return diagnostics;
}

function addPersonToIdIndex(index: Map<PersonId, PersonRecord[]>, person: PersonRecord): void {
	const matches = index.get(person.id) ?? [];
	if (!matches.some((match) => match.filePath === person.filePath)) matches.push(person);
	index.set(person.id, matches);
}

function buildResolutionContext(
	resolutionPeople: PersonRecord[],
	outputPeople: PersonRecord[],
	resolveLink: LinkResolver,
	outputNodeIdByPath: Map<string, NodeId>,
): ResolutionContext {
	const peopleById = new Map<PersonId, PersonRecord[]>();
	for (const person of [...resolutionPeople, ...outputPeople]) addPersonToIdIndex(peopleById, person);

	const peopleByPath = new Map<string, PersonRecord>();
	for (const person of resolutionPeople) peopleByPath.set(person.filePath, person);
	for (const person of outputPeople) {
		if (!peopleByPath.has(person.filePath)) peopleByPath.set(person.filePath, person);
	}

	return {
		peopleById,
		peopleByPath,
		outputNodeIdByPath,
		resolveLink,
	};
}

function resolveReference(
	reference: PersonReference,
	sourcePath: string,
	context: ResolutionContext,
): PersonRecord | undefined {
	const idMatches = context.peopleById.get(reference.target);
	if (idMatches) return idMatches.length === 1 ? idMatches[0] : undefined;

	const resolvedPath = context.resolveLink(reference.target, sourcePath);
	if (resolvedPath) return context.peopleByPath.get(resolvedPath);
	return context.peopleByPath.get(reference.target);
}

function ambiguousReferenceDiagnostic(
	reference: PersonReference,
	sourcePath: string,
	matches: PersonRecord[],
): AtlasDiagnostic {
	return {
		id: `ambiguous-reference:${sourcePath}:${referenceKey(reference)}`,
		severity: "error",
		code: "ambiguous-person-reference",
		message: `The person reference “${reference.target}” is ambiguous; it matches multiple notes.`,
		filePaths: [sourcePath, ...matches.map((person) => person.filePath)],
	};
}

function relationshipDuplicateDiagnostics(relationships: RelationshipRecord[]): AtlasDiagnostic[] {
	const grouped = new Map<string, RelationshipRecord[]>();
	for (const relationship of relationships) {
		const matches = grouped.get(relationship.id) ?? [];
		matches.push(relationship);
		grouped.set(relationship.id, matches);
	}

	const diagnostics: AtlasDiagnostic[] = [];
	for (const [id, matches] of grouped) {
		if (matches.length < 2) continue;
		diagnostics.push({
			id: `duplicate-relationship-id:${id}`,
			severity: "error",
			code: "duplicate-relationship-id",
			message: `Multiple relationship notes use the ID “${id}”.`,
			filePaths: matches.map((relationship) => relationship.filePath).sort(),
		});
	}
	return diagnostics;
}

function nodeIdForOutputPerson(person: PersonRecord, duplicateIds: Set<PersonId>): NodeId {
	if (!duplicateIds.has(person.id)) return person.id;
	return `ambiguous:${stableHash(`${person.id}:${person.filePath}`)}`;
}

function pathIdentities(path: string): string[] {
	const normalized = normalizePathIdentity(path);
	if (!normalized) return [];
	const identities = new Set([normalized]);
	if (normalized.endsWith(".md")) {
		const extensionless = normalized.slice(0, -3);
		if (extensionless) identities.add(extensionless);
	} else {
		identities.add(`${normalized}.md`);
	}
	return [...identities];
}

function addRecordByPath<T extends { filePath: string }>(index: Map<string, T[]>, record: T): void {
	for (const identity of pathIdentities(record.filePath)) {
		const records = index.get(identity) ?? [];
		if (!records.some((candidate) => candidate.filePath === record.filePath)) records.push(record);
		index.set(identity, records);
	}
}

function buildContactMomentResolutionContext(
	people: readonly PersonRecord[],
	relationships: readonly RelationshipRecord[],
	resolveLink: LinkResolver,
): ContactMomentResolutionContext {
	const peopleById = new Map<string, PersonRecord[]>();
	const peopleByPath = new Map<string, PersonRecord[]>();
	for (const person of people) {
		const idMatches = peopleById.get(person.id) ?? [];
		idMatches.push(person);
		peopleById.set(person.id, idMatches);
		addRecordByPath(peopleByPath, person);
	}

	const relationshipsById = new Map<string, RelationshipRecord[]>();
	const relationshipsByPath = new Map<string, RelationshipRecord[]>();
	for (const relationship of relationships) {
		const idMatches = relationshipsById.get(relationship.id) ?? [];
		idMatches.push(relationship);
		relationshipsById.set(relationship.id, idMatches);
		addRecordByPath(relationshipsByPath, relationship);
	}
	return { peopleById, peopleByPath, relationshipsById, relationshipsByPath, resolveLink };
}

function resolveUniqueRecord<T extends { filePath: string }>(
	reference: PersonReference | RelationshipReference,
	sourcePath: string,
	byId: Map<string, T[]>,
	byPath: Map<string, T[]>,
	resolveLink: LinkResolver,
): T | undefined {
	const candidates = new Map<string, T>();
	for (const record of byId.get(reference.target) ?? []) candidates.set(record.filePath, record);
	const candidatePaths = new Set(pathIdentities(reference.target));
	if (reference.resolvedPath) {
		for (const identity of pathIdentities(reference.resolvedPath)) candidatePaths.add(identity);
	}
	const linkedPath = resolveLink(reference.target, sourcePath);
	if (linkedPath) {
		for (const identity of pathIdentities(linkedPath)) candidatePaths.add(identity);
	}
	for (const identity of candidatePaths) {
		for (const record of byPath.get(identity) ?? []) candidates.set(record.filePath, record);
	}
	return candidates.size === 1 ? candidates.values().next().value : undefined;
}

function resolveContactMomentReferences(
	record: ContactMomentRecord,
	context: ContactMomentResolutionContext,
): ResolvedContactMomentReferences | undefined {
	if (record.people.length === 0 || record.people.length !== record.personIds.length) return undefined;
	const resolvedPeople = record.people.map((reference) =>
		resolveUniqueRecord(reference, record.filePath, context.peopleById, context.peopleByPath, context.resolveLink),
	);
	if (resolvedPeople.some((person) => person === undefined)) return undefined;
	const people = resolvedPeople.filter((person): person is PersonRecord => person !== undefined);
	const resolvedIds = people.map((person) => person.id);
	if (
		new Set(resolvedIds).size !== resolvedIds.length ||
		resolvedIds.some((id, index) => id !== record.personIds[index])
	) {
		return undefined;
	}

	if (!record.relationship && !record.relationshipId) {
		return { personPaths: people.map((person) => person.filePath), relationshipEndpointPaths: [] };
	}
	if (!record.relationship || !record.relationshipId) return undefined;
	const relationship = resolveUniqueRecord(
		record.relationship,
		record.filePath,
		context.relationshipsById,
		context.relationshipsByPath,
		context.resolveLink,
	);
	if (!relationship || relationship.id !== record.relationshipId) return undefined;
	const endpointPeople = [relationship.from, relationship.to].map((reference) =>
		resolveUniqueRecord(
			reference,
			relationship.filePath,
			context.peopleById,
			context.peopleByPath,
			context.resolveLink,
		),
	);
	if (endpointPeople.some((person) => person === undefined)) return undefined;
	const endpoints = endpointPeople.filter((person): person is PersonRecord => person !== undefined);
	if (
		endpoints.length !== 2 ||
		endpoints[0]?.filePath === endpoints[1]?.filePath ||
		!endpoints.some((person) => record.personIds.includes(person.id))
	) {
		return undefined;
	}
	return {
		personPaths: people.map((person) => person.filePath),
		relationshipEndpointPaths: endpoints.map((person) => person.filePath),
		relationship,
	};
}

function isFullCalendarDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return (
		date.getUTCFullYear() === Number(match[1]) &&
		date.getUTCMonth() + 1 === Number(match[2]) &&
		date.getUTCDate() === Number(match[3])
	);
}

function trimmedOptional(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function contactMomentSummary(record: ContactMomentRecord): ContactMomentSummary {
	const summary: ContactMomentSummary = {
		id: record.id,
		filePath: record.filePath,
		personIds: [...record.personIds],
		occurredOn: record.occurredOn,
	};
	if (record.relationshipId) summary.relationshipId = record.relationshipId;
	const channel = trimmedOptional(record.channel);
	if (channel) summary.channel = channel;
	const text = trimmedOptional(record.summary);
	if (text) summary.summary = text;

	const validFollowUpDate = record.followUpOn && isFullCalendarDate(record.followUpOn);
	const terminal = record.followUpStatus === "done" || record.followUpStatus === "dismissed";
	const open = record.followUpStatus === undefined || record.followUpStatus === "open";
	if (validFollowUpDate && (terminal || (open && record.followUpActionable))) {
		summary.followUpOn = record.followUpOn;
		if (record.followUpStatus) summary.followUpStatus = record.followUpStatus;
	}
	return summary;
}

function validatedContactMoments(
	contactMoments: readonly ContactMomentRecord[],
	relationships: readonly RelationshipRecord[],
	resolutionPeople: readonly PersonRecord[],
	resolveLink: LinkResolver,
): ValidatedContactMoment[] {
	const momentsById = new Map<string, ContactMomentRecord[]>();
	for (const record of contactMoments) {
		const matches = momentsById.get(record.id) ?? [];
		matches.push(record);
		momentsById.set(record.id, matches);
	}
	const context = buildContactMomentResolutionContext(resolutionPeople, relationships, resolveLink);
	const validated: ValidatedContactMoment[] = [];
	for (const matches of momentsById.values()) {
		if (matches.length !== 1) continue;
		const record = matches[0];
		if (!record?.actionable || !isFullCalendarDate(record.occurredOn)) continue;
		const references = resolveContactMomentReferences(record, context);
		if (!references) continue;
		validated.push({ record, references, summary: contactMomentSummary(record) });
	}
	return validated.sort(
		(left, right) =>
			left.summary.id.localeCompare(right.summary.id) || left.summary.filePath.localeCompare(right.summary.filePath),
	);
}

export function projectContactMomentSummaries(
	contactMoments: readonly ContactMomentRecord[],
	relationships: readonly RelationshipRecord[],
	resolutionPeople: readonly PersonRecord[],
	visiblePersonPaths: ReadonlySet<string>,
	resolveLink: LinkResolver,
): ContactMomentProjection {
	const projected: ContactMomentSummary[] = [];
	let hiddenContactMomentCount = 0;
	for (const moment of validatedContactMoments(contactMoments, relationships, resolutionPeople, resolveLink)) {
		const visible =
			moment.references.personPaths.every((path) => visiblePersonPaths.has(path)) &&
			moment.references.relationshipEndpointPaths.every((path) => visiblePersonPaths.has(path));
		if (visible) projected.push(moment.summary);
		else hiddenContactMomentCount += 1;
	}
	return { contactMoments: projected, hiddenContactMomentCount };
}

export function isContactMomentDiagnostic(diagnostic: AtlasDiagnostic): boolean {
	return CONTACT_MOMENT_DIAGNOSTIC_CODES.has(diagnostic.code);
}

export function filterContactMomentDiagnostics(
	diagnostics: readonly AtlasDiagnostic[],
	contactMoments: readonly ContactMomentRecord[],
	relationships: readonly RelationshipRecord[],
	resolutionPeople: readonly PersonRecord[],
	visiblePersonPaths: ReadonlySet<string>,
	resolveLink: LinkResolver,
): AtlasDiagnostic[] {
	if (resolutionPeople.every((person) => visiblePersonPaths.has(person.filePath))) return [...diagnostics];
	const context = buildContactMomentResolutionContext(resolutionPeople, relationships, resolveLink);
	const safeMomentPaths = new Set<string>();
	const safeRelationshipPaths = new Set<string>();
	for (const moment of contactMoments) {
		const references = resolveContactMomentReferences(moment, context);
		if (!references) continue;
		const peopleAreVisible = references.personPaths.every((path) => visiblePersonPaths.has(path));
		const relationshipIsVisible = references.relationshipEndpointPaths.every((path) => visiblePersonPaths.has(path));
		if (!peopleAreVisible || !relationshipIsVisible) continue;
		safeMomentPaths.add(moment.filePath);
		if (references.relationship) safeRelationshipPaths.add(references.relationship.filePath);
	}
	const visiblePersonIds = new Set(
		resolutionPeople.filter((person) => visiblePersonPaths.has(person.filePath)).map((person) => person.id),
	);
	const allowedPathIdentities = new Set<string>();
	for (const path of [...visiblePersonPaths, ...safeMomentPaths, ...safeRelationshipPaths]) {
		for (const identity of pathIdentities(path)) allowedPathIdentities.add(identity);
	}
	const safeRelationshipIds = new Set(
		relationships
			.filter((relationship) => safeRelationshipPaths.has(relationship.filePath))
			.map((relationship) => relationship.id),
	);
	return diagnostics.filter((diagnostic) => {
		if (!isContactMomentDiagnostic(diagnostic)) return true;
		const momentPaths = diagnostic.filePaths.filter((path) =>
			contactMoments.some((moment) => moment.filePath === path),
		);
		if (momentPaths.length === 0 || momentPaths.some((path) => !safeMomentPaths.has(path))) return false;
		if (
			diagnostic.filePaths.some(
				(path) => !safeMomentPaths.has(path) && !safeRelationshipPaths.has(path) && !visiblePersonPaths.has(path),
			)
		) {
			return false;
		}
		if (!diagnostic.targetPath) return true;
		return (
			pathIdentities(diagnostic.targetPath).some((identity) => allowedPathIdentities.has(identity)) ||
			visiblePersonIds.has(diagnostic.targetPath) ||
			safeRelationshipIds.has(diagnostic.targetPath)
		);
	});
}

export function buildAtlasSnapshot(
	raw: RawIndexSnapshot,
	resolveLink: LinkResolver,
	options: BuildAtlasSnapshotOptions = {},
): AtlasSnapshot {
	const resolutionPeople = options.resolutionPeople ?? raw.people;
	const outputPeople = raw.people;
	const outputIdCounts = new Map<PersonId, number>();
	for (const person of outputPeople) outputIdCounts.set(person.id, (outputIdCounts.get(person.id) ?? 0) + 1);
	const duplicateOutputIds = new Set<PersonId>(
		[...outputIdCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
	);
	const outputNodeIdByPath = new Map<string, NodeId>();
	for (const person of outputPeople)
		outputNodeIdByPath.set(person.filePath, nodeIdForOutputPerson(person, duplicateOutputIds));

	const context = buildResolutionContext(resolutionPeople, outputPeople, resolveLink, outputNodeIdByPath);
	const diagnostics = [
		...(raw.diagnostics ?? []),
		...duplicateDiagnostics(resolutionPeople, outputPeople),
		...relationshipDuplicateDiagnostics(raw.relationships),
	];
	const nodes = new Map<NodeId, AtlasNode>();
	for (const person of outputPeople) {
		const id = outputNodeIdByPath.get(person.filePath);
		if (!id) continue;
		nodes.set(id, {
			id,
			kind: "person",
			personId: person.id,
			label: person.name,
			filePath: person.filePath,
			photoPath: person.photoPath,
			organisations: person.organisations,
			birthDate: person.birthDate,
			pronouns: person.pronouns,
			gender: person.gender,
			emails: person.emails,
			phones: person.phones,
			jobTitle: person.jobTitle,
			isCenter: false,
		});
	}

	const edges: AtlasEdge[] = [];
	let hiddenEdgeCount = 0;
	const contactPeopleByPath = new Map<string, PersonRecord>();
	for (const person of resolutionPeople) contactPeopleByPath.set(person.filePath, person);
	for (const person of outputPeople) contactPeopleByPath.set(person.filePath, person);
	for (const person of contactPeopleByPath.values()) {
		const sourceId = outputNodeIdByPath.get(person.filePath);
		for (const [contactIndex, reference] of person.contacts.entries()) {
			const target = resolveReference(reference, person.filePath, context);
			if (!target) {
				const ambiguousMatches = context.peopleById.get(reference.target);
				if (ambiguousMatches && ambiguousMatches.length > 1) {
					diagnostics.push(ambiguousReferenceDiagnostic(reference, person.filePath, ambiguousMatches));
					continue;
				}
				if (!sourceId) {
					diagnostics.push({
						id: `unresolved-contact:${person.filePath}:${referenceKey(reference)}`,
						severity: "warning",
						code: "unresolved-contact",
						message: `Could not resolve contact “${reference.target}”.`,
						filePaths: [person.filePath],
					});
					continue;
				}
				const targetId = ghostId(reference);
				if (!nodes.has(targetId)) {
					nodes.set(targetId, {
						id: targetId,
						kind: "ghost",
						label: reference.label ?? reference.target,
						organisations: [],
						emails: [],
						phones: [],
						isCenter: false,
					});
				}
				diagnostics.push({
					id: `unresolved-contact:${person.filePath}:${targetId}`,
					severity: "warning",
					code: "unresolved-contact",
					message: `Could not resolve contact “${reference.target}”.`,
					filePaths: [person.filePath],
				});
				if (targetId === sourceId) continue;
				edges.push({
					id: `edge:${stableHash(`${sourceId}:${targetId}:contact`)}`,
					sourceId,
					targetId,
					types: ["contact"],
					filePath: person.filePath,
					inferred: true,
				});
				continue;
			}

			const targetId = context.outputNodeIdByPath.get(target.filePath);
			if (!sourceId || !targetId) {
				hiddenEdgeCount += 1;
				diagnostics.push(
					filteredEndpointDiagnostic(person.filePath, "contact", `${referenceKey(reference)}:${contactIndex}`),
				);
				continue;
			}
			if (targetId === sourceId) continue;
			edges.push({
				id: inferredContactEdgeId(sourceId, targetId),
				sourceId,
				targetId,
				types: ["contact"],
				filePath: person.filePath,
				inferred: true,
			});
		}
	}

	const relationshipIdCounts = new Map<string, number>();
	for (const relationship of raw.relationships) {
		relationshipIdCounts.set(relationship.id, (relationshipIdCounts.get(relationship.id) ?? 0) + 1);
	}
	for (const relationship of raw.relationships) {
		const source = resolveReference(relationship.from, relationship.filePath, context);
		const target = resolveReference(relationship.to, relationship.filePath, context);
		if (!source || !target) {
			const ambiguousSource = context.peopleById.get(relationship.from.target);
			const ambiguousTarget = context.peopleById.get(relationship.to.target);
			if ((ambiguousSource && ambiguousSource.length > 1) || (ambiguousTarget && ambiguousTarget.length > 1)) {
				if (ambiguousSource && ambiguousSource.length > 1)
					diagnostics.push(ambiguousReferenceDiagnostic(relationship.from, relationship.filePath, ambiguousSource));
				if (ambiguousTarget && ambiguousTarget.length > 1)
					diagnostics.push(ambiguousReferenceDiagnostic(relationship.to, relationship.filePath, ambiguousTarget));
				continue;
			}
			diagnostics.push({
				id: `relationship-endpoint:${relationship.id}:${relationship.filePath}`,
				severity: "error",
				code: "unresolved-relationship-endpoint",
				message: `Relationship “${relationship.filePath}” has an unresolved endpoint.`,
				filePaths: [relationship.filePath],
			});
			continue;
		}
		if (source.filePath === target.filePath) {
			diagnostics.push({
				id: `self:${relationship.id}:${relationship.filePath}`,
				severity: "warning",
				code: "self-relationship",
				message: `Relationship “${relationship.filePath}” links a person to themselves.`,
				filePaths: [relationship.filePath],
			});
			continue;
		}

		const sourceId = context.outputNodeIdByPath.get(source.filePath);
		const targetId = context.outputNodeIdByPath.get(target.filePath);
		if (!sourceId || !targetId) {
			hiddenEdgeCount += 1;
			diagnostics.push(filteredEndpointDiagnostic(relationship.filePath, "relationship"));
			continue;
		}

		const edgeId =
			relationshipIdCounts.get(relationship.id) === 1
				? relationship.id
				: `${relationship.id}:${stableHash(relationship.filePath)}`;
		const types = relationship.types.length > 0 ? relationship.types : ["relationship"];
		edges.push({
			id: edgeId,
			sourceId,
			targetId,
			presetId: relationship.presetId,
			types,
			fromRole: relationship.fromRole,
			toRole: relationship.toRole,
			closeness: relationship.closeness,
			since: relationship.since,
			lastContact: relationship.lastContact,
			status: relationship.status,
			filePath: relationship.filePath,
			inferred: false,
		});
	}

	const outputPaths = new Set(outputPeople.map((person) => person.filePath));
	const hiddenNodeCount = resolutionPeople.filter((person) => !outputPaths.has(person.filePath)).length;
	const contactMomentProjection = projectContactMomentSummaries(
		raw.contactMoments ?? [],
		raw.relationships,
		resolutionPeople,
		outputPaths,
		resolveLink,
	);
	return {
		nodes: [...nodes.values()],
		edges,
		contactMoments: contactMomentProjection.contactMoments,
		diagnostics,
		hiddenNodeCount,
		hiddenEdgeCount,
		hiddenContactMomentCount: contactMomentProjection.hiddenContactMomentCount,
		generatedAt: Date.now(),
	};
}
