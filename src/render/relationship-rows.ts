import type { AtlasEdge, AtlasNode, AtlasSnapshot } from "../domain/types";
import { isAmbiguousAtlasNode } from "../domain/node-capabilities";
import { formatRelationshipRole } from "../settings/relationship-presets";

export interface IncidentRelationshipRow {
	edge: AtlasEdge;
	counterpart: AtlasNode;
	description: string;
	noteBacked: boolean;
	actionContext: string;
}

export function buildIncidentRelationshipRows(
	snapshot: AtlasSnapshot,
	selected: AtlasNode,
	relationshipRoleFormat: string,
): IncidentRelationshipRow[] {
	const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
	const rows: IncidentRelationshipRow[] = [];

	for (const edge of snapshot.edges) {
		const selectedIsSource = edge.sourceId === selected.id;
		const selectedIsTarget = edge.targetId === selected.id;
		if (!selectedIsSource && !selectedIsTarget) continue;

		const counterpart = nodesById.get(selectedIsSource ? edge.targetId : edge.sourceId);
		if (!counterpart) continue;

		const counterpartLabel = `${counterpart.label}${
			counterpart.kind === "ghost" ? " (unresolved)" : isAmbiguousAtlasNode(counterpart) ? " (ambiguous)" : ""
		}`;
		const noteBacked = !edge.inferred && Boolean(edge.filePath?.trim());
		if (edge.inferred) {
			rows.push({
				edge,
				counterpart,
				description: `Linked person: ${counterpartLabel}.`,
				noteBacked: false,
				actionContext: counterpartLabel,
			});
			continue;
		}

		const role = selectedIsSource ? edge.fromRole : edge.toRole;
		const relationshipDescription =
			edge.fromRole && edge.toRole && role
				? formatRelationshipRole(relationshipRoleFormat, role, counterpartLabel)
				: `Connected to ${counterpartLabel}`;
		const parts = [relationshipDescription];
		if (edge.types.length > 0) parts.push(`Types: ${edge.types.join(", ")}`);
		if (edge.status) parts.push(`Status: ${edge.status}`);
		if (edge.since) parts.push(`Since: ${edge.since}`);
		if (edge.lastContact) parts.push(`Last contact: ${edge.lastContact}`);

		const contextParts = [counterpartLabel];
		if (edge.types.length > 0) contextParts.push(edge.types.join(", "));
		if (edge.filePath) contextParts.push(edge.filePath);
		rows.push({
			edge,
			counterpart,
			description: `${parts.join(". ")}.`,
			noteBacked,
			actionContext: contextParts.join(", "),
		});
	}

	return rows;
}

export function relationshipActionAccessibleName(action: "open" | "edit", row: IncidentRelationshipRow): string {
	const label = action === "open" ? "Open relationship note" : "Edit relationship";
	return `${label} with ${row.actionContext}`;
}
