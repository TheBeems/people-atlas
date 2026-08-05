import type { AtlasEdge, AtlasNode, AtlasSnapshot } from "../domain/types";
import { isAmbiguousAtlasNode, isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { deriveFamilyRelationshipTerm, isDerivedFamilyRelationshipTerm } from "../domain/simple-relationships";
import { formatRelationshipRole } from "../settings/relationship-presets";
import { createTranslator, type Translator } from "../i18n";

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
	translator: Translator = createTranslator("en"),
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
			counterpart.kind === "ghost"
				? translator.relationshipRows.unresolvedSuffix
				: isAmbiguousAtlasNode(counterpart)
					? translator.relationshipRows.ambiguousSuffix
					: ""
		}`;
		const noteBacked = !edge.inferred && Boolean(edge.filePath?.trim());
		if (edge.inferred) {
			rows.push({
				edge,
				counterpart,
				description: translator.relationshipRows.linkedPerson({ name: counterpartLabel }),
				noteBacked: false,
				actionContext: counterpartLabel,
			});
			continue;
		}

		const role = selectedIsSource ? edge.fromRole : edge.toRole;
		const roleHolderGender = isResolvedAtlasPersonNode(selected) ? selected.gender : undefined;
		const presentedRole = role ? deriveFamilyRelationshipTerm(role, roleHolderGender) : undefined;
		const localizedRole =
			presentedRole && role && presentedRole !== role && isDerivedFamilyRelationshipTerm(presentedRole)
				? translator.relationshipRows.familyTerms[presentedRole]
				: presentedRole;
		const relationshipDescription =
			edge.fromRole && edge.toRole && localizedRole
				? formatRelationshipRole(relationshipRoleFormat, localizedRole, counterpartLabel)
				: translator.relationshipRows.connectedTo({ name: counterpartLabel });
		const parts = [relationshipDescription];
		if (edge.types.length > 0) parts.push(translator.relationshipRows.types({ types: edge.types.join(", ") }));
		if (edge.status) parts.push(translator.relationshipRows.status({ status: edge.status }));
		if (edge.since) parts.push(translator.relationshipRows.since({ since: edge.since }));
		if (edge.lastContact) parts.push(translator.relationshipRows.lastContact({ lastContact: edge.lastContact }));

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

export function relationshipActionAccessibleName(
	action: "open" | "edit",
	row: IncidentRelationshipRow,
	translator: Translator = createTranslator("en"),
): string {
	const label =
		action === "open" ? translator.atlasRenderer.openRelationshipNote : translator.atlasRenderer.editRelationship;
	return translator.relationshipRows.actionAccessibleName({ action: label, context: row.actionContext });
}
