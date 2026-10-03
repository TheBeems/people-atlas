import { addCalendarDays, isCalendarDate, isContactIntervalDays } from "../domain/calendar-date";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import type { AtlasEdge, AtlasSnapshot } from "../domain/types";

/** Missing bounds remain unknown; explicitly authored bounds are inclusive. */
export function relationshipExistsAtDate(edge: AtlasEdge, date: string): boolean {
	if (!isCalendarDate(date)) throw new RangeError("Choose a valid YYYY-MM-DD date.");
	if (edge.since !== undefined && !isCalendarDate(edge.since)) return false;
	if (edge.until !== undefined && !isCalendarDate(edge.until)) return false;
	if (edge.since && edge.until && edge.until < edge.since) return false;
	return (!edge.since || edge.since <= date) && (!edge.until || edge.until >= date);
}

/** Date filtering changes only relationships; contact moments remain explicit observations. */
export function filterRelationshipsAtDate(snapshot: AtlasSnapshot, date: string): AtlasSnapshot {
	if (!isCalendarDate(date)) throw new RangeError("Choose a valid YYYY-MM-DD date.");
	const invalidPeriods = new Set(
		snapshot.diagnostics
			.filter((diagnostic) => diagnostic.code === "invalid-relationship-period")
			.flatMap((diagnostic) => diagnostic.filePaths),
	);
	const edges = snapshot.edges.filter(
		(edge) => edge.inferred || (!invalidPeriods.has(edge.filePath ?? "") && relationshipExistsAtDate(edge, date)),
	);
	return { ...snapshot, edges, hiddenEdgeCount: snapshot.hiddenEdgeCount + snapshot.edges.length - edges.length };
}

export interface RelationshipContactCadence {
	relationship: AtlasEdge;
	lastObservedOn: string;
	dueOn: string;
	state: "upcoming" | "due" | "overdue";
}

/** Suggestions are read-only, based on observations and explicit desired intervals. */
export function relationshipContactCadence(snapshot: AtlasSnapshot, asOf: string): RelationshipContactCadence[] {
	if (!isCalendarDate(asOf)) throw new RangeError("Choose a valid YYYY-MM-DD date.");
	const personCounts = new Map<string, number>();
	for (const node of snapshot.nodes) {
		if (isResolvedAtlasPersonNode(node)) personCounts.set(node.id, (personCounts.get(node.id) ?? 0) + 1);
	}
	const counts = new Map<string, number>();
	for (const edge of snapshot.edges) counts.set(edge.id, (counts.get(edge.id) ?? 0) + 1);
	const unsafeRelationships = new Set(
		snapshot.diagnostics
			.filter(
				(diagnostic) =>
					diagnostic.code === "duplicate-relationship-id" ||
					diagnostic.code === "invalid-relationship-period" ||
					diagnostic.code === "invalid-relationship-contact-interval",
			)
			.flatMap((diagnostic) => diagnostic.filePaths),
	);
	const observations = new Map<string, string>();
	for (const moment of snapshot.contactMoments) {
		if (!moment.relationshipId || !isCalendarDate(moment.occurredOn) || moment.occurredOn > asOf) continue;
		const current = observations.get(moment.relationshipId);
		if (!current || moment.occurredOn > current) observations.set(moment.relationshipId, moment.occurredOn);
	}
	const result: RelationshipContactCadence[] = [];
	for (const edge of snapshot.edges) {
		if (
			edge.inferred ||
			edge.status === "ended" ||
			counts.get(edge.id) !== 1 ||
			unsafeRelationships.has(edge.filePath ?? "") ||
			personCounts.get(edge.sourceId) !== 1 ||
			personCounts.get(edge.targetId) !== 1 ||
			!isContactIntervalDays(edge.contactIntervalDays) ||
			!relationshipExistsAtDate(edge, asOf)
		)
			continue;
		const momentDate = observations.get(edge.id);
		const authoredDate = isCalendarDate(edge.lastContact) && edge.lastContact <= asOf ? edge.lastContact : undefined;
		const lastObservedOn = authoredDate && (!momentDate || authoredDate > momentDate) ? authoredDate : momentDate;
		if (!lastObservedOn) continue;
		const dueOn = addCalendarDays(lastObservedOn, edge.contactIntervalDays);
		if (!dueOn) continue;
		result.push({
			relationship: edge,
			lastObservedOn,
			dueOn,
			state: dueOn < asOf ? "overdue" : dueOn === asOf ? "due" : "upcoming",
		});
	}
	return result.sort(
		(left, right) => left.dueOn.localeCompare(right.dueOn) || left.relationship.id.localeCompare(right.relationship.id),
	);
}
