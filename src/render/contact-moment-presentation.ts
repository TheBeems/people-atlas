import type { ContactMomentFollowUpStatus, ContactMomentSummary } from "../domain/types";

export type ContactMomentPresentationSource = ContactMomentSummary;

export interface ContactMomentFollowUpRow {
	moment: ContactMomentPresentationSource;
	followUpOn: string;
	reviewedFollowUpStatus: "open" | undefined;
}

export interface SelectedPersonContactMomentPresentation {
	recentMoments: ContactMomentPresentationSource[];
	earliestOpenFollowUp?: ContactMomentFollowUpRow | undefined;
}

export interface ContactMomentFollowUpGroups {
	overdue: ContactMomentFollowUpRow[];
	dueToday: ContactMomentFollowUpRow[];
	upcoming: ContactMomentFollowUpRow[];
}

const DEFAULT_RECENT_MOMENT_LIMIT = 3;

export function buildSelectedPersonContactMomentPresentation(
	moments: readonly ContactMomentPresentationSource[],
	personId: string,
	maxRecent = DEFAULT_RECENT_MOMENT_LIMIT,
): SelectedPersonContactMomentPresentation {
	const selectedPersonId = personId.trim();
	if (!selectedPersonId) return { recentMoments: [] };

	const selected = moments
		.filter(isValidContactMomentPresentationSource)
		.filter((moment) => moment.personIds.includes(selectedPersonId));
	const recentLimit = normalizeRecentLimit(maxRecent, selected.length);
	const recentMoments = [...selected].sort(compareRecentMoments).slice(0, recentLimit);
	const earliestOpenFollowUp = selected
		.map(openFollowUpRow)
		.filter((row): row is ContactMomentFollowUpRow => row !== undefined)
		.sort(compareFollowUpRows)[0];

	return earliestOpenFollowUp ? { recentMoments, earliestOpenFollowUp } : { recentMoments };
}

export function groupContactMomentFollowUps(
	moments: readonly ContactMomentPresentationSource[],
	today: string,
): ContactMomentFollowUpGroups {
	if (!isFullCalendarDate(today)) {
		throw new Error("Follow-up grouping requires a valid local YYYY-MM-DD today value.");
	}

	const groups: ContactMomentFollowUpGroups = {
		overdue: [],
		dueToday: [],
		upcoming: [],
	};
	for (const moment of moments) {
		if (!isValidContactMomentPresentationSource(moment)) continue;
		const row = openFollowUpRow(moment);
		if (!row) continue;
		if (row.followUpOn < today) groups.overdue.push(row);
		else if (row.followUpOn === today) groups.dueToday.push(row);
		else groups.upcoming.push(row);
	}
	groups.overdue.sort(compareFollowUpRows);
	groups.dueToday.sort((left, right) => compareStableMomentIdentity(left.moment, right.moment));
	groups.upcoming.sort(compareFollowUpRows);
	return groups;
}

function openFollowUpRow(moment: ContactMomentPresentationSource): ContactMomentFollowUpRow | undefined {
	if (
		(moment.followUpStatus !== undefined && moment.followUpStatus !== "open") ||
		!moment.followUpOn ||
		!isFullCalendarDate(moment.followUpOn)
	) {
		return undefined;
	}
	return {
		moment,
		followUpOn: moment.followUpOn,
		reviewedFollowUpStatus: moment.followUpStatus,
	};
}

function isValidContactMomentPresentationSource(moment: ContactMomentPresentationSource): boolean {
	if (!moment.id.trim() || !moment.filePath.trim() || !isFullCalendarDate(moment.occurredOn)) return false;
	const personIds = moment.personIds.map((personId) => personId.trim());
	if (
		personIds.length === 0 ||
		personIds.some((personId) => !personId) ||
		new Set(personIds).size !== personIds.length
	) {
		return false;
	}
	if (moment.followUpOn !== undefined && !isFullCalendarDate(moment.followUpOn)) return false;
	if (moment.followUpStatus !== undefined && !isFollowUpStatus(moment.followUpStatus)) return false;
	return moment.followUpStatus === undefined || moment.followUpOn !== undefined;
}

function compareRecentMoments(left: ContactMomentPresentationSource, right: ContactMomentPresentationSource): number {
	return compareText(right.occurredOn, left.occurredOn) || compareStableMomentIdentity(left, right);
}

function compareFollowUpRows(left: ContactMomentFollowUpRow, right: ContactMomentFollowUpRow): number {
	return compareText(left.followUpOn, right.followUpOn) || compareStableMomentIdentity(left.moment, right.moment);
}

function compareStableMomentIdentity(
	left: ContactMomentPresentationSource,
	right: ContactMomentPresentationSource,
): number {
	return compareText(left.id, right.id) || compareText(left.filePath, right.filePath);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeRecentLimit(value: number, available: number): number {
	if (value === Number.POSITIVE_INFINITY) return available;
	if (!Number.isFinite(value)) return DEFAULT_RECENT_MOMENT_LIMIT;
	return Math.max(0, Math.floor(value));
}

function isFollowUpStatus(value: string): value is ContactMomentFollowUpStatus {
	return value === "open" || value === "done" || value === "dismissed";
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
