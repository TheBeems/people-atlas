import { TFile } from "obsidian";
import type { ContactMomentRecord, ContactMomentSummary, PersonRecord, RelationshipRecord } from "../domain/types";
import type { ContactMomentEditSourceBaseline } from "../mutations/contact-moment";

export interface CanonicalPersonResolution {
	file: TFile;
	person: PersonRecord;
	frontmatter: Record<string, unknown>;
	personClassification: "type" | "tag";
}

export interface CanonicalContactMomentResolution {
	file: TFile;
	contactMoment: ContactMomentRecord;
	sourceBaseline: ContactMomentEditSourceBaseline;
}

export interface CanonicalResolutionSource {
	people(): readonly PersonRecord[];
	relationships(): readonly RelationshipRecord[];
	contactMoments(): readonly ContactMomentRecord[];
	file(path: string): unknown;
	readPerson(file: TFile): CanonicalPersonResolution | undefined;
	readRelationship(file: TFile): RelationshipRecord | undefined;
	readContactMoment(file: TFile): CanonicalContactMomentResolution | undefined;
}

export function uniqueCanonicalRecord<T extends { id: string; filePath: string }>(
	records: readonly T[],
	filePath: string,
): T | undefined {
	const pathMatches = records.filter((record) => record.filePath === filePath);
	if (pathMatches.length !== 1) return undefined;
	const record = pathMatches[0];
	if (!record || records.filter((candidate) => candidate.id === record.id).length !== 1) return undefined;
	return record;
}

/** Owns path/identity revalidation shared by plugin entrypoints and note actions. */
export class CanonicalEntryPointResolver {
	constructor(private readonly source: CanonicalResolutionSource) {}

	resolvePerson(personPath: string): CanonicalPersonResolution | undefined {
		const indexed = uniqueCanonicalRecord(this.source.people(), personPath);
		if (!indexed) return undefined;
		const file = this.source.file(personPath);
		if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") return undefined;
		const current = this.source.readPerson(file);
		return current?.person.id === indexed.id ? current : undefined;
	}

	resolveRelationship(relationshipPath: string): { file: TFile; relationship: RelationshipRecord } | undefined {
		const indexed = uniqueCanonicalRecord(this.source.relationships(), relationshipPath);
		if (!indexed) return undefined;
		const file = this.source.file(relationshipPath);
		if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") return undefined;
		const relationship = this.source.readRelationship(file);
		return relationship?.id === indexed.id ? { file, relationship } : undefined;
	}

	resolveContactMoment(contactMomentPath: string): CanonicalContactMomentResolution | undefined {
		const indexed = uniqueCanonicalRecord(this.source.contactMoments(), contactMomentPath);
		if (!indexed) return undefined;
		const file = this.source.file(contactMomentPath);
		if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") return undefined;
		const current = this.source.readContactMoment(file);
		return current?.contactMoment.id === indexed.id ? current : undefined;
	}

	resolveContactMomentSummary(moment: ContactMomentSummary): CanonicalContactMomentResolution | undefined {
		const current = this.resolveContactMoment(moment.filePath);
		if (!current || current.contactMoment.id !== moment.id) return undefined;
		return this.resolveIndexedContactMomentSummary(moment) ? current : undefined;
	}

	resolveIndexedContactMomentSummary(moment: ContactMomentSummary): ContactMomentRecord | undefined {
		const matches = this.source
			.contactMoments()
			.filter((candidate) => candidate.id === moment.id && candidate.filePath === moment.filePath);
		const indexed = matches.length === 1 ? matches[0] : undefined;
		if (!indexed?.actionable) return undefined;
		if (
			indexed.occurredOn !== moment.occurredOn ||
			indexed.relationshipId !== moment.relationshipId ||
			indexed.personIds.length !== moment.personIds.length ||
			indexed.personIds.some((personId, index) => personId !== moment.personIds[index])
		) {
			return undefined;
		}
		return indexed;
	}
}
