export type PersonId = string;
export type RelationshipId = string;
export type ContactMomentId = string;
export type NodeId = PersonId | `ghost:${string}` | `ambiguous:${string}`;
export type RelationshipStatus = "active" | "dormant" | "ended";
export type ContactMomentFollowUpStatus = "open" | "done" | "dismissed";
export type ProjectionCenterMode = "configured" | "active-note" | "selected-node" | "none";
export type ProjectionMode = "ego" | "free-network" | "contact-health";
export type ReferenceKind = "wikilink" | "path" | "id";

export interface PersonReference {
	raw: string;
	target: string;
	kind: ReferenceKind;
	label?: string | undefined;
	resolvedPath?: string | undefined;
}

export interface RelationshipReference {
	raw: string;
	target: string;
	kind: ReferenceKind;
	label?: string | undefined;
	resolvedPath?: string | undefined;
}

export interface PersonRecord {
	id: PersonId;
	filePath: string;
	name: string;
	aliases: string[];
	organisations: string[];
	photoPath?: string | undefined;
	birthDate?: string | undefined;
	pronouns?: string | undefined;
	gender?: string | undefined;
	emails: string[];
	phones: string[];
	jobTitle?: string | undefined;
	contacts: PersonReference[];
}

export interface RelationshipRecord {
	id: RelationshipId;
	filePath: string;
	from: PersonReference;
	to: PersonReference;
	presetId?: string | undefined;
	fromRole?: string | undefined;
	toRole?: string | undefined;
	types: string[];
	closeness?: number | undefined;
	since?: string | undefined;
	lastContact?: string | undefined;
	status?: RelationshipStatus | undefined;
}

export interface ContactMomentRecord {
	id: ContactMomentId;
	filePath: string;
	people: PersonReference[];
	relationship?: RelationshipReference | undefined;
	occurredOn: string;
	channel?: string | undefined;
	summary?: string | undefined;
	followUpOn?: string | undefined;
	followUpStatus?: ContactMomentFollowUpStatus | undefined;
	personIds: PersonId[];
	relationshipId?: RelationshipId | undefined;
	actionable: boolean;
	followUpActionable: boolean;
}

export interface ContactMomentSummary {
	id: ContactMomentId;
	filePath: string;
	personIds: PersonId[];
	relationshipId?: RelationshipId | undefined;
	occurredOn: string;
	channel?: string | undefined;
	summary?: string | undefined;
	followUpOn?: string | undefined;
	followUpStatus?: ContactMomentFollowUpStatus | undefined;
}

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface AtlasDiagnostic {
	id: string;
	severity: DiagnosticSeverity;
	code:
		| "duplicate-person-id"
		| "missing-person-id"
		| "invalid-person-birth-date"
		| "invalid-person-email"
		| "invalid-person-phone"
		| "ambiguous-person-reference"
		| "duplicate-relationship-id"
		| "missing-relationship-id"
		| "invalid-relationship-status"
		| "invalid-relationship-date"
		| "incomplete-relationship-roles"
		| "duplicate-contact-moment-id"
		| "missing-contact-moment-id"
		| "invalid-contact-moment-people"
		| "duplicate-contact-moment-person"
		| "unresolved-contact-moment-person"
		| "ambiguous-contact-moment-person"
		| "unresolved-contact-moment-relationship"
		| "ambiguous-contact-moment-relationship"
		| "contact-moment-relationship-person-mismatch"
		| "invalid-contact-moment-occurred-on"
		| "invalid-contact-moment-follow-up-date"
		| "invalid-contact-moment-follow-up-status"
		| "missing-asset"
		| "unresolved-contact"
		| "filtered-endpoint"
		| "unresolved-relationship-endpoint"
		| "self-relationship"
		| "node-limit"
		| "projection-center-unresolved"
		| "projection-center-ambiguous";
	message: string;
	filePaths: string[];
	targetPath?: string | undefined;
}

export interface AtlasNode {
	id: NodeId;
	kind: "person" | "ghost";
	label: string;
	filePath?: string | undefined;
	personId?: PersonId | undefined;
	photoPath?: string | undefined;
	organisations: string[];
	birthDate?: string | undefined;
	pronouns?: string | undefined;
	gender?: string | undefined;
	emails: string[];
	phones: string[];
	jobTitle?: string | undefined;
	isCenter: boolean;
}

export interface AtlasEdge {
	id: string;
	sourceId: NodeId;
	targetId: NodeId;
	presetId?: string | undefined;
	types: string[];
	fromRole?: string | undefined;
	toRole?: string | undefined;
	closeness?: number | undefined;
	since?: string | undefined;
	lastContact?: string | undefined;
	status?: RelationshipStatus | undefined;
	filePath?: string | undefined;
	inferred: boolean;
}

export interface AtlasSnapshot {
	nodes: AtlasNode[];
	edges: AtlasEdge[];
	contactMoments: ContactMomentSummary[];
	diagnostics: AtlasDiagnostic[];
	hiddenNodeCount: number;
	hiddenEdgeCount: number;
	hiddenContactMomentCount: number;
	generatedAt: number;
}

export interface RawIndexSnapshot {
	people: PersonRecord[];
	relationships: RelationshipRecord[];
	contactMoments?: ContactMomentRecord[] | undefined;
	diagnostics?: AtlasDiagnostic[] | undefined;
}

export interface IndexDelta {
	revision: number;
	changedPaths: string[];
	removedPaths: string[];
	affectedPersonIds: PersonId[];
	affectedRelationshipIds: RelationshipId[];
	affectedContactMomentIds?: ContactMomentId[] | undefined;
	addedPeople: PersonRecord[];
	updatedPeople: PersonRecord[];
	removedPeople: PersonRecord[];
	addedRelationships: RelationshipRecord[];
	updatedRelationships: RelationshipRecord[];
	removedRelationships: RelationshipRecord[];
	addedContactMoments?: ContactMomentRecord[] | undefined;
	updatedContactMoments?: ContactMomentRecord[] | undefined;
	removedContactMoments?: ContactMomentRecord[] | undefined;
	affectedPeople: PersonRecord[];
	affectedRelationships: RelationshipRecord[];
	affectedContactMoments?: ContactMomentRecord[] | undefined;
	diagnostics: AtlasDiagnostic[];
	duplicatePersonIds: PersonId[];
	duplicateRelationshipIds: RelationshipId[];
	duplicateContactMomentIds?: ContactMomentId[] | undefined;
}

export interface ProjectGraphOptions {
	centerMode?: ProjectionCenterMode | undefined;
	projectionMode?: ProjectionMode | undefined;
	centerId?: PersonId | undefined;
	centerPath?: string | undefined;
	hops?: number | undefined;
	maxNodes?: number | undefined;
}
