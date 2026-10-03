import type { ContactMomentRecord, PersonRecord, PersonReference, RelationshipRecord } from "../../src/domain/types";
import type { ParsedAtlasFile } from "../../src/index/frontmatter";

export const CONTACT_HISTORY_FIXTURE_VERSION = "contact-history-v1";
export type ContactHistoryProfile = "person-only" | "linked-history";

function reference(person: PersonRecord, index: number): PersonReference {
	if (index % 3 === 0) return { raw: person.id, target: person.id, kind: "id" };
	if (index % 3 === 1) return { raw: person.filePath, target: person.filePath, kind: "path" };
	return {
		raw: `[[${person.filePath}]]`,
		target: person.filePath,
		kind: "wikilink",
		resolvedPath: person.filePath,
	};
}

export function generateContactHistoryFixture(size: number, profile: ContactHistoryProfile = "linked-history") {
	if (!Number.isSafeInteger(size) || size < 2) throw new Error("Contact-history fixtures require at least two people.");
	const people: PersonRecord[] = Array.from({ length: size }, (_, index) => {
		const suffix = String(index).padStart(6, "0");
		return {
			id: `person-${suffix}`,
			filePath: `People/Person ${suffix}.md`,
			name: `Person ${suffix}`,
			aliases: [],
			organisations: [`Organisation ${index % 17}`],
			emails: [],
			phones: [],
			contacts: [],
		};
	});
	const relationships: RelationshipRecord[] = [];
	const contactMoments: ContactMomentRecord[] = [];
	for (let index = 0; index < size; index += 1) {
		const first = people[index];
		const second = people[(index + 1) % size];
		const primary = profile === "person-only" ? people[0] : first;
		if (!first || !second || !primary) throw new Error("Contact-history fixture ordinal resolution failed.");
		const suffix = String(index).padStart(6, "0");
		const relationship: RelationshipRecord = {
			id: `relationship-${suffix}`,
			filePath: `People/Relationships/Relationship ${suffix}.md`,
			from: reference(first, index),
			to: reference(second, index + 1),
			types: ["colleague"],
			status: "active",
		};
		if (profile === "linked-history") relationships.push(relationship);
		const moment: ContactMomentRecord = {
			id: `moment-${suffix}`,
			filePath: `People/Contact moments/Moment ${suffix}.md`,
			people:
				profile === "person-only"
					? [{ raw: primary.id, target: primary.id, kind: "id" }]
					: [reference(primary, index), reference(second, index + 1)],
			occurredOn: `2026-09-${String((index % 28) + 1).padStart(2, "0")}`,
			channel: index % 2 === 0 ? "meeting" : "message",
			summary: `Synthetic contact ${suffix}`,
			personIds: [],
			actionable: true,
			followUpActionable: profile === "linked-history" && index % 3 === 0,
		};
		if (profile === "linked-history" && index % 2 === 0) {
			moment.relationship = { raw: relationship.id, target: relationship.id, kind: "id" };
		}
		if (moment.followUpActionable) {
			moment.followUpOn = "2026-10-03";
			moment.followUpStatus = "open";
		}
		contactMoments.push(moment);
	}
	const files: ParsedAtlasFile[] = [
		...people.map((person) => ({ filePath: person.filePath, person, diagnostics: [] })),
		...relationships.map((relationship) => ({ filePath: relationship.filePath, relationship, diagnostics: [] })),
		...contactMoments.map((contactMoment) => ({ filePath: contactMoment.filePath, contactMoment, diagnostics: [] })),
	];
	return {
		contractVersion: CONTACT_HISTORY_FIXTURE_VERSION,
		size,
		profile,
		people,
		relationships,
		contactMoments,
		files,
	};
}
