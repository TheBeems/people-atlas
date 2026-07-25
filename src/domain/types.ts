export type PersonId = string;
export type RelationshipId = string;
export type NodeId = PersonId | `ghost:${string}` | `ambiguous:${string}`;
export type RelationshipDirection = "undirected" | "source-to-target";
export type RelationshipStatus = "active" | "dormant" | "ended";
export type ProjectionCenterMode = "configured" | "active-note" | "selected-node" | "none";
export type ProjectionMode = "ego" | "free-network" | "contact-health";

export interface PersonReference {
	raw: string;
	target: string;
	label?: string | undefined;
}

export interface PersonRecord {
	id: PersonId;
	filePath: string;
	name: string;
	aliases: string[];
	organisations: string[];
	photoPath?: string | undefined;
	contacts: PersonReference[];
}

export interface RelationshipRecord {
	id: RelationshipId;
	filePath: string;
	from: PersonReference;
	to: PersonReference;
	direction: RelationshipDirection;
	types: string[];
	closeness?: number | undefined;
	since?: string | undefined;
	lastContact?: string | undefined;
	status?: RelationshipStatus | undefined;
}

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface AtlasDiagnostic {
	id: string;
	severity: DiagnosticSeverity;
	code:
		| "duplicate-person-id"
		| "ambiguous-person-reference"
		| "duplicate-relationship-id"
		| "invalid-relationship-direction"
		| "invalid-relationship-status"
		| "invalid-relationship-date"
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
	isCenter: boolean;
}

export interface AtlasEdge {
	id: string;
	sourceId: NodeId;
	targetId: NodeId;
	types: string[];
	closeness?: number | undefined;
	direction: RelationshipDirection;
	since?: string | undefined;
	lastContact?: string | undefined;
	status?: RelationshipStatus | undefined;
	filePath?: string | undefined;
	inferred: boolean;
}

export interface AtlasSnapshot {
	nodes: AtlasNode[];
	edges: AtlasEdge[];
	diagnostics: AtlasDiagnostic[];
	hiddenNodeCount: number;
	hiddenEdgeCount: number;
	generatedAt: number;
}

export interface RawIndexSnapshot {
	people: PersonRecord[];
	relationships: RelationshipRecord[];
	diagnostics?: AtlasDiagnostic[] | undefined;
}

export interface IndexDelta {
	revision: number;
	changedPaths: string[];
	removedPaths: string[];
	affectedPersonIds: PersonId[];
	affectedRelationshipIds: RelationshipId[];
	addedPeople: PersonRecord[];
	updatedPeople: PersonRecord[];
	removedPeople: PersonRecord[];
	addedRelationships: RelationshipRecord[];
	updatedRelationships: RelationshipRecord[];
	removedRelationships: RelationshipRecord[];
	affectedPeople: PersonRecord[];
	affectedRelationships: RelationshipRecord[];
	diagnostics: AtlasDiagnostic[];
	duplicatePersonIds: PersonId[];
	duplicateRelationshipIds: RelationshipId[];
}

export interface ProjectGraphOptions {
	centerMode?: ProjectionCenterMode | undefined;
	projectionMode?: ProjectionMode | undefined;
	centerId?: PersonId | undefined;
	centerPath?: string | undefined;
	hops?: number | undefined;
	maxNodes?: number | undefined;
}
