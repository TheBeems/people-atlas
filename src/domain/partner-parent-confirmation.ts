import { normalizePathIdentity } from "./identity";
import type { PersonRecord, PersonReference, RelationshipRecord } from "./types";

export interface RecentRelationshipCreate {
	kind: "create";
	fromPersonPath: string;
	toPersonPath: string;
	fromRole: string;
	toRole: string;
}

export interface PartnerParentConfirmationInput {
	people: readonly PersonRecord[];
	relationships: readonly RelationshipRecord[];
	recentCreate: RecentRelationshipCreate;
}

export interface PartnerParentCandidate {
	parent: PersonRecord;
	child: PersonRecord;
	partner: PersonRecord;
}

interface CanonicalPeople {
	byId: ReadonlyMap<string, PersonRecord>;
	byPath: ReadonlyMap<string, PersonRecord>;
	byPathIdentity: ReadonlyMap<string, readonly PersonRecord[]>;
}

interface CanonicalRelationship {
	record: RelationshipRecord;
	from: PersonRecord;
	to: PersonRecord;
}

export function planPartnerParentConfirmation(
	input: PartnerParentConfirmationInput,
): PartnerParentCandidate | undefined {
	const people = canonicalPeople(input.people);
	if (!people) return undefined;
	const created = canonicalCreatedRelationship(input.recentCreate, people);
	if (!created) return undefined;
	const relationships = canonicalRelationships(input.relationships, people);
	if (!relationships) return undefined;

	const partners = new Map<string, PersonRecord>();
	for (const relationship of relationships) {
		if (
			relationship.record.fromRole !== "partner" ||
			relationship.record.toRole !== "partner" ||
			relationship.record.status === "ended"
		) {
			continue;
		}
		if (relationship.from.id === created.parent.id) partners.set(relationship.to.id, relationship.to);
		if (relationship.to.id === created.parent.id) partners.set(relationship.from.id, relationship.from);
	}
	if (partners.size !== 1) return undefined;
	const partner = partners.values().next().value;
	if (!partner || partner.id === created.parent.id || partner.id === created.child.id) return undefined;

	if (
		relationships.some(
			(relationship) =>
				isParentChildPair(relationship) &&
				new Set([relationship.from.id, relationship.to.id]).size === 2 &&
				new Set([relationship.from.id, relationship.to.id]).has(partner.id) &&
				new Set([relationship.from.id, relationship.to.id]).has(created.child.id),
		)
	) {
		return undefined;
	}
	return { parent: created.parent, child: created.child, partner };
}

export function samePartnerParentCandidate(left: PartnerParentCandidate, right: PartnerParentCandidate): boolean {
	return (
		left.parent.id === right.parent.id &&
		left.parent.filePath === right.parent.filePath &&
		left.child.id === right.child.id &&
		left.child.filePath === right.child.filePath &&
		left.partner.id === right.partner.id &&
		left.partner.filePath === right.partner.filePath
	);
}

function isMarkdownPath(path: string): boolean {
	return path.split("/").at(-1)?.toLowerCase().endsWith(".md") ?? false;
}

function isKnownRelationshipStatus(status: unknown): boolean {
	return status === undefined || status === "active" || status === "dormant" || status === "ended";
}

function canonicalPeople(records: readonly PersonRecord[]): CanonicalPeople | undefined {
	const byId = new Map<string, PersonRecord>();
	const byPath = new Map<string, PersonRecord>();
	const byPathIdentity = new Map<string, PersonRecord[]>();
	for (const person of records) {
		const id = person.id.trim();
		const path = person.filePath.trim();
		if (!id || !path || !isMarkdownPath(path) || byId.has(id) || byPath.has(path)) return undefined;
		byId.set(id, person);
		byPath.set(path, person);
		for (const identity of pathIdentities(path)) {
			const matches = byPathIdentity.get(identity) ?? [];
			matches.push(person);
			byPathIdentity.set(identity, matches);
		}
	}
	return { byId, byPath, byPathIdentity };
}

function canonicalCreatedRelationship(
	recentCreate: RecentRelationshipCreate,
	people: CanonicalPeople,
): { parent: PersonRecord; child: PersonRecord } | undefined {
	if (recentCreate.kind !== "create") return undefined;
	const from = people.byPath.get(recentCreate.fromPersonPath);
	const to = people.byPath.get(recentCreate.toPersonPath);
	if (!from || !to || from.id === to.id) return undefined;
	if (recentCreate.fromRole === "parent" && recentCreate.toRole === "child") return { parent: from, child: to };
	if (recentCreate.fromRole === "child" && recentCreate.toRole === "parent") return { parent: to, child: from };
	return undefined;
}

function canonicalRelationships(
	records: readonly RelationshipRecord[],
	people: CanonicalPeople,
): CanonicalRelationship[] | undefined {
	const ids = new Set<string>();
	const paths = new Set<string>();
	const relationships: CanonicalRelationship[] = [];
	for (const record of records) {
		const id = record.id.trim();
		if (
			!id ||
			!record.filePath.trim() ||
			!isMarkdownPath(record.filePath) ||
			!isKnownRelationshipStatus(record.status) ||
			ids.has(id) ||
			paths.has(record.filePath)
		) {
			return undefined;
		}
		ids.add(id);
		paths.add(record.filePath);
		const from = resolveCanonicalReference(record.from, people);
		const to = resolveCanonicalReference(record.to, people);
		if (!from || !to || from.id === to.id) return undefined;
		relationships.push({ record, from, to });
	}
	return relationships;
}

function resolveCanonicalReference(reference: PersonReference, people: CanonicalPeople): PersonRecord | undefined {
	const candidates = new Map<string, PersonRecord>();
	const target = reference.target.trim();
	if (!target) return undefined;
	const byId = people.byId.get(target);
	if (byId) candidates.set(byId.id, byId);
	for (const path of [target, reference.resolvedPath].filter((value): value is string => Boolean(value?.trim()))) {
		for (const identity of pathIdentities(path)) {
			for (const person of people.byPathIdentity.get(identity) ?? []) candidates.set(person.id, person);
		}
	}
	return candidates.size === 1 ? candidates.values().next().value : undefined;
}

function isParentChildPair(relationship: CanonicalRelationship): boolean {
	return (
		(relationship.record.fromRole === "parent" && relationship.record.toRole === "child") ||
		(relationship.record.fromRole === "child" && relationship.record.toRole === "parent")
	);
}

function pathIdentities(path: string): string[] {
	const normalized = normalizePathIdentity(path);
	if (!normalized) return [];
	const identities = new Set([normalized]);
	if (normalized.endsWith(".md")) identities.add(normalized.slice(0, -3));
	else identities.add(`${normalized}.md`);
	return [...identities];
}
