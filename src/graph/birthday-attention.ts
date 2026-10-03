import { addCalendarDays, isCalendarDate } from "../domain/calendar-date";
import { isResolvedAtlasPersonNode } from "../domain/node-capabilities";
import { parsePersonBirthDate } from "../domain/person-profile";
import type { AtlasNode, AtlasSnapshot } from "../domain/types";

export interface BirthdayAttention {
	person: AtlasNode;
	birthdayOn: string;
	isToday: boolean;
	age?: number;
}

/** Today and the next 30 calendar days; February 29 is never substituted. */
export function birthdayAttention(snapshot: AtlasSnapshot, today: string): BirthdayAttention[] {
	if (!isCalendarDate(today)) throw new RangeError("Birthday attention requires a valid local YYYY-MM-DD today value.");
	const through = addCalendarDays(today, 30);
	if (!through) return [];
	const counts = new Map<string, number>();
	for (const node of snapshot.nodes)
		counts.set(node.personId ?? node.id, (counts.get(node.personId ?? node.id) ?? 0) + 1);
	const result: BirthdayAttention[] = [];
	for (const person of snapshot.nodes) {
		if (!isResolvedAtlasPersonNode(person) || counts.get(person.personId ?? person.id) !== 1) continue;
		const parsed = parsePersonBirthDate(person.birthDate);
		if (!parsed.valid) continue;
		for (let year = Number(today.slice(0, 4)); year <= Number(through.slice(0, 4)); year += 1) {
			const birthdayOn = `${String(year).padStart(4, "0")}-${String(parsed.parts.month).padStart(2, "0")}-${String(parsed.parts.day).padStart(2, "0")}`;
			if (!isCalendarDate(birthdayOn) || birthdayOn < today || birthdayOn > through) continue;
			const age = parsed.parts.year === undefined ? undefined : year - parsed.parts.year;
			if (age !== undefined && age < 0) continue;
			result.push({ person, birthdayOn, isToday: birthdayOn === today, ...(age !== undefined ? { age } : {}) });
		}
	}
	return result.sort(
		(left, right) => left.birthdayOn.localeCompare(right.birthdayOn) || left.person.id.localeCompare(right.person.id),
	);
}
