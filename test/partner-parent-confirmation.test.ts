import { describe, expect, it } from "vitest";
import {
	planPartnerParentConfirmation,
	type PartnerParentConfirmationInput,
} from "../src/domain/partner-parent-confirmation";
import type { PersonRecord, RelationshipRecord } from "../src/domain/types";

const alex: PersonRecord = {
	id: "person-alex",
	filePath: "People/Alex.md",
	name: "Alex",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const robin: PersonRecord = {
	id: "person-robin",
	filePath: "People/Robin.md",
	name: "Robin",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const sam: PersonRecord = {
	id: "person-sam",
	filePath: "People/Sam.md",
	name: "Sam",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const casey: PersonRecord = {
	id: "person-casey",
	filePath: "People/Casey.md",
	name: "Casey",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

const ambiguousRobin: PersonRecord = {
	id: "person-robin-alternative",
	filePath: "People/robin.md",
	name: "Robin alternative",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
};

function relationship(
	id: string,
	from: PersonRecord,
	to: PersonRecord,
	overrides: Partial<RelationshipRecord> = {},
): RelationshipRecord {
	return {
		id,
		filePath: `People/Relationships/${id}.md`,
		from: {
			raw: `[[${from.filePath.replace(/\.md$/i, "")}]]`,
			target: from.filePath,
			kind: "wikilink",
			resolvedPath: from.filePath,
		},
		to: {
			raw: `[[${to.filePath.replace(/\.md$/i, "")}]]`,
			target: to.filePath,
			kind: "wikilink",
			resolvedPath: to.filePath,
		},
		types: [],
		...overrides,
	};
}

const recentCreate: PartnerParentConfirmationInput["recentCreate"] = {
	kind: "create",
	fromPersonPath: alex.filePath,
	toPersonPath: sam.filePath,
	fromRole: "parent",
	toRole: "child",
};

function plan(overrides: Partial<PartnerParentConfirmationInput> = {}) {
	return planPartnerParentConfirmation({
		people: [alex, robin, sam],
		relationships: [relationship("partner-alex-robin", alex, robin, { fromRole: "partner", toRole: "partner" })],
		recentCreate,
		...overrides,
	});
}

describe("partner-ouderbevestigingsplanner", () => {
	it("plant een partner-oudervraag na een succesvolle nieuwe parent-child-create met één canonieke partner", () => {
		expect(plan()).toEqual({ parent: alex, child: sam, partner: robin });
	});

	it("herkent de ene partner vanuit beide endpointrichtingen en telt parallelle notities naar die persoon maar één keer", () => {
		expect(
			plan({
				relationships: [
					relationship("partner-robin-alex", robin, alex, { fromRole: "partner", toRole: "partner" }),
					relationship("partner-alex-robin-duplicate-note", alex, robin, { fromRole: "partner", toRole: "partner" }),
				],
			}),
		).toEqual({ parent: alex, child: sam, partner: robin });
	});

	it("herkent de inverse nieuwe child-parent-create zonder endpoints te wisselen", () => {
		expect(
			plan({
				recentCreate: {
					...recentCreate,
					fromPersonPath: sam.filePath,
					toPersonPath: alex.filePath,
					fromRole: "child",
					toRole: "parent",
				},
			}),
		).toEqual({ parent: alex, child: sam, partner: robin });
	});

	it("plant niets wanneer relationship-IDs alleen in voor- of naloopspaties verschillen", () => {
		expect(
			plan({
				people: [alex, robin, sam, casey],
				relationships: [
					relationship("relationship-1", alex, robin, { fromRole: "partner", toRole: "partner" }),
					relationship(" relationship-1 ", alex, casey, {
						filePath: "People/Relationships/relationship-1-copy.md",
					}),
				],
			}),
		).toBeUndefined();
	});

	it("plant niets wanneer een partnerendpoint werkelijk ambigue oplost", () => {
		expect(
			plan({
				people: [alex, robin, ambiguousRobin, sam],
				relationships: [
					relationship("partner-ambiguous-endpoint", alex, robin, {
						fromRole: "partner",
						toRole: "partner",
						to: { raw: "[[People/Robin]]", target: "People/Robin", kind: "wikilink" as const },
					}),
				],
			}),
		).toBeUndefined();
	});

	it("plant niets wanneer dezelfde relationship-ID twee verschillende Markdown-notitiepaden heeft", () => {
		expect(
			plan({
				people: [alex, robin, sam, casey],
				relationships: [
					relationship("duplicate-id", alex, robin, { fromRole: "partner", toRole: "partner" }),
					relationship("duplicate-id", robin, casey, {
						filePath: "People/Relationships/duplicate-id-second.md",
					}),
				],
			}),
		).toBeUndefined();
	});

	it.each([
		{
			name: "de status van een partnerrelatie corrupt is",
			overrides: {
				relationships: [
					relationship("partner-corrupt-status", alex, robin, {
						fromRole: "partner",
						toRole: "partner",
						status: "unknown" as unknown as RelationshipRecord["status"],
					}),
				],
			},
		},
		{
			name: "een partnerrecord geen Markdown-notitie heeft",
			overrides: {
				relationships: [
					{
						...relationship("partner-no-note", alex, robin, { fromRole: "partner", toRole: "partner" }),
						filePath: "synthetic",
					},
				],
			},
		},
	])("plant niets wanneer $name", ({ overrides }) => {
		expect(plan(overrides)).toBeUndefined();
	});

	it.each([
		{
			name: "er geen canonieke partnerrelatie is",
			overrides: { relationships: [] },
		},
		{
			name: "de enige partnerrelatie ended is",
			overrides: {
				relationships: [
					relationship("partner-ended", alex, robin, { fromRole: "partner", toRole: "partner", status: "ended" }),
				],
			},
		},
		{
			name: "er meer dan één unieke partnerpersoon is",
			overrides: {
				people: [alex, robin, sam, casey],
				relationships: [
					relationship("partner-alex-robin", alex, robin, { fromRole: "partner", toRole: "partner" }),
					relationship("partner-alex-casey", alex, casey, { fromRole: "partner", toRole: "partner" }),
				],
			},
		},
		{
			name: "de partner al een parent-child-relatie met het kind heeft",
			overrides: {
				relationships: [
					relationship("partner-alex-robin", alex, robin, { fromRole: "partner", toRole: "partner" }),
					relationship("parent-child-robin-sam", robin, sam, { fromRole: "parent", toRole: "child" }),
				],
			},
		},
		{
			name: "de bestaande tweede ouderrelatie omgekeerd is opgeslagen",
			overrides: {
				relationships: [
					relationship("partner-alex-robin", alex, robin, { fromRole: "partner", toRole: "partner" }),
					relationship("child-parent-sam-robin", sam, robin, { fromRole: "child", toRole: "parent" }),
				],
			},
		},
		{
			name: "vrije rollen of type metadata alleen op een partner wijzen",
			overrides: {
				relationships: [
					relationship("free-metadata", alex, robin, { fromRole: "wife", toRole: "husband", types: ["partner"] }),
				],
			},
		},
		{
			name: "de kandidaatpartner de ouder of het kind zelf is",
			overrides: {
				relationships: [relationship("self-partner", alex, alex, { fromRole: "partner", toRole: "partner" })],
			},
		},
		{
			name: "een partnerendpoint ghost of onopgelost is",
			overrides: {
				relationships: [
					{
						...relationship("partner-ghost", alex, robin, { fromRole: "partner", toRole: "partner" }),
						to: { raw: "[[People/Missing]]", target: "People/Missing", kind: "wikilink" as const },
					},
				],
			},
		},
		{
			name: "een betrokken persoon een duplicate person_id heeft",
			overrides: {
				people: [...[alex, robin, sam], { ...robin, filePath: "People/Robin duplicate.md" }],
			},
		},
		{
			name: "de succesvolle save geen parent-child-paar is",
			overrides: { recentCreate: { ...recentCreate, fromRole: "mentor", toRole: "mentee" } },
		},
		{
			name: "de nieuwe endpoints dezelfde canonieke persoon zijn",
			overrides: { recentCreate: { ...recentCreate, toPersonPath: alex.filePath } },
		},
		{
			name: "een nieuwe endpoint verdwenen of ambigue is",
			overrides: { recentCreate: { ...recentCreate, toPersonPath: "People/Missing.md" } },
		},
	])("plant niets wanneer $name", ({ overrides }) => {
		expect(plan(overrides)).toBeUndefined();
	});
});
