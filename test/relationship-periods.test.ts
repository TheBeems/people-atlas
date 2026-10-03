import type { App, CachedMetadata, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { addCalendarDays, isCalendarDate } from "../src/domain/calendar-date";
import type {
	AtlasEdge,
	AtlasNode,
	AtlasSnapshot,
	IndexDelta,
	PersonRecord,
	RelationshipRecord,
} from "../src/domain/types";
import { buildAtlasSnapshot } from "../src/graph/build-snapshot";
import { applyGraphDelta } from "../src/graph/graph-delta";
import {
	filterRelationshipsAtDate,
	relationshipContactCadence,
	relationshipExistsAtDate,
} from "../src/graph/relationship-periods";
import { parseAtlasFile } from "../src/index/frontmatter";
import { validateRelationshipInput } from "../src/mutations/validation";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";

function person(id: string): PersonRecord {
	return {
		id,
		name: id,
		filePath: `People/${id}.md`,
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	};
}
function node(id: string): AtlasNode {
	return {
		id,
		personId: id,
		kind: "person",
		label: id,
		filePath: `People/${id}.md`,
		organisations: [],
		emails: [],
		phones: [],
		isCenter: false,
	};
}
function edge(overrides: Partial<AtlasEdge> = {}): AtlasEdge {
	return {
		id: "r",
		sourceId: "a",
		targetId: "b",
		inferred: false,
		types: [],
		filePath: "People/Relationships/r.md",
		...overrides,
	};
}
function snapshot(edges: AtlasEdge[]): AtlasSnapshot {
	return {
		nodes: [node("a"), node("b")],
		edges,
		contactMoments: [],
		diagnostics: [],
		hiddenNodeCount: 2,
		hiddenEdgeCount: 3,
		hiddenContactMomentCount: 0,
		generatedAt: 12,
	};
}
function parse(properties: Record<string, unknown>, settings = DEFAULT_SETTINGS) {
	const app = { metadataCache: { getFirstLinkpathDest: () => null } } as unknown as App;
	return parseAtlasFile(
		app,
		{ path: "People/Relationships/r.md", basename: "r", extension: "md" } as TFile,
		{
			frontmatter: {
				[settings.typeProperty]: settings.relationshipTypeValue,
				[settings.relationshipIdProperty]: "r",
				[settings.relationshipFromProperty]: "a",
				[settings.relationshipToProperty]: "b",
				...properties,
			},
		} as CachedMetadata,
		settings,
	);
}

describe("explicit relationship periods and cadence", () => {
	it.each(["2024-02-29", "2000-02-29", "0001-01-01", "9999-12-31"])("accepts calendar-valid full date %s", (date) =>
		expect(isCalendarDate(date)).toBe(true));
	it.each([
		"2023-02-29",
		"1900-02-29",
		"0000-01-01",
		"2026-04-31",
		"--02-29",
		"2026-1-01",
		"2026-10-03T00:00:00Z",
	])("rejects invalid full date %s", (date) => expect(isCalendarDate(date)).toBe(false));
	it("adds calendar days across leap days, year boundaries and finite supported years", () => {
		expect(addCalendarDays("2024-02-28", 2)).toBe("2024-03-01");
		expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
		expect(addCalendarDays("9999-12-31", 1)).toBeUndefined();
		expect(addCalendarDays("2026-10-03", Number.MAX_SAFE_INTEGER)).toBeUndefined();
	});
	it("parses mapped bounds/cadence without changing status, roles or last contact", () => {
		const settings = { ...DEFAULT_SETTINGS, untilProperty: "einddatum", contactIntervalDaysProperty: "contactdagen" };
		const parsed = parse(
			{ since: "2024-02-29", einddatum: "2024-02-29", contactdagen: 1, direction: "legacy", status: "dormant" },
			settings,
		);
		expect(parsed.diagnostics).toEqual([]);
		expect(parsed.relationship).toMatchObject({
			since: "2024-02-29",
			until: "2024-02-29",
			contactIntervalDays: 1,
			status: "dormant",
		});
		expect(parsed.relationship?.lastContact).toBeUndefined();
		expect(parsed.relationship?.fromRole).toBeUndefined();
	});
	it.each([
		0,
		-1,
		1.5,
		"30",
		Number.POSITIVE_INFINITY,
		Number.MAX_SAFE_INTEGER + 1,
		true,
		[],
	])("diagnoses invalid authored cadence %s without coercion", (value) => {
		const parsed = parse({ contact_interval_days: value });
		expect(parsed.relationship?.contactIntervalDays).toBeUndefined();
		expect(parsed.diagnostics).toEqual([expect.objectContaining({ code: "invalid-relationship-contact-interval" })]);
	});
	it("diagnoses invalid and reversed end dates without normalization", () => {
		expect(parse({ until: "2023-02-29" }).diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "invalid-relationship-date" }),
				expect.objectContaining({ code: "invalid-relationship-period" }),
			]),
		);
		expect(parse({ until: ["2024-02-29"] }).relationship?.until).toBeUndefined();
		const reversed = parse({ since: "2024-03-01", until: "2024-02-29" });
		expect(reversed.relationship?.until).toBeUndefined();
		expect(reversed.diagnostics).toEqual([expect.objectContaining({ code: "invalid-relationship-period" })]);
	});
	it.each([
		new Date("2024-02-29T00:00:00Z"),
		20240229,
	])("rejects authored non-string dates across relationship and contact fields without changing source: %s", (date) => {
		const relationshipProperties = { since: date, until: date, last_contact: date };
		const originalRelationship = structuredClone(relationshipProperties);
		const relationship = parse(relationshipProperties);
		expect(relationship.relationship).toMatchObject({ since: undefined, until: undefined, lastContact: undefined });
		expect(relationship.diagnostics.filter((item) => item.code === "invalid-relationship-date")).toHaveLength(3);
		expect(relationship.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-relationship-period" }));
		expect(relationshipProperties).toEqual(originalRelationship);

		const contactProperties = {
			type: DEFAULT_SETTINGS.contactMomentTypeValue,
			contact_moment_id: "m",
			occurred_on: date,
			people: ["a"],
			follow_up_on: date,
		};
		const originalContact = structuredClone(contactProperties);
		const contact = parseAtlasFile(
			{ metadataCache: { getFirstLinkpathDest: () => null } } as unknown as App,
			{ path: "People/Contact moments/m.md", basename: "m", extension: "md" } as TFile,
			{ frontmatter: contactProperties } as CachedMetadata,
			DEFAULT_SETTINGS,
		);
		expect(contact.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "invalid-contact-moment-occurred-on" }),
				expect.objectContaining({ code: "invalid-contact-moment-follow-up-date" }),
			]),
		);
		expect(contactProperties).toEqual(originalContact);
	});
	it("requires valid periods/cadence and distinct mappings before a write", () => {
		const base = { path: "People/Relationships/r.md", from: "a", to: "b" };
		expect(
			validateRelationshipInput(
				{ ...base, since: "2024-03-01", until: "2024-02-29", contactIntervalDays: 0 },
				DEFAULT_SETTINGS,
			),
		).toEqual(expect.arrayContaining([expect.stringContaining("precede"), expect.stringContaining("positive whole")]));
		expect(
			validateRelationshipInput({ ...base, until: "2024-02-29", contactIntervalDays: 1 }, DEFAULT_SETTINGS),
		).toEqual([]);
		expect(validateRelationshipInput(base, { ...DEFAULT_SETTINGS, untilProperty: "from" }).length).toBeGreaterThan(0);
	});
	it("filters inclusive periods, unknown bounds and Linked people without changing observations", () => {
		const input = snapshot([
			edge({ id: "bounded", since: "2024-02-29", until: "2024-03-01" }),
			edge({ id: "unknown" }),
			edge({ id: "ended", until: "2024-02-28" }),
			edge({ id: "linked", inferred: true }),
		]);
		input.contactMoments = [
			{ id: "m", filePath: "m.md", occurredOn: "2026-10-01", personIds: ["a"], relationshipId: "ended" },
		];
		expect(filterRelationshipsAtDate(input, "2024-02-29").edges.map((item) => item.id)).toEqual([
			"bounded",
			"unknown",
			"linked",
		]);
		expect(relationshipExistsAtDate(input.edges[0] as AtlasEdge, "2024-03-01")).toBe(true);
		expect(relationshipExistsAtDate(input.edges[0] as AtlasEdge, "2024-03-02")).toBe(false);
		expect(filterRelationshipsAtDate(input, "2024-02-29")).toMatchObject({
			generatedAt: 12,
			hiddenNodeCount: 2,
			hiddenEdgeCount: 4,
			contactMoments: input.contactMoments,
			diagnostics: [],
		});
		expect(input.edges).toHaveLength(4);
		expect(() => filterRelationshipsAtDate(input, "2024-02-30")).toThrow(RangeError);
	});
	it("computes due dates from the latest explicit observation and never invents one", () => {
		const input = snapshot([
			edge({ id: "due", lastContact: "2024-02-20", contactIntervalDays: 2 }),
			edge({ id: "unknown", contactIntervalDays: 1 }),
			edge({ id: "ended", status: "ended", lastContact: "2024-02-01", contactIntervalDays: 1 }),
			edge({ id: "period-ended", until: "2024-02-28", lastContact: "2024-02-01", contactIntervalDays: 1 }),
			edge({ id: "future", lastContact: "2024-03-01", contactIntervalDays: 1 }),
		]);
		input.contactMoments = [
			{ id: "m", filePath: "m.md", relationshipId: "due", personIds: ["a", "b"], occurredOn: "2024-02-27" },
			{ id: "future-m", filePath: "fm.md", relationshipId: "due", personIds: ["a", "b"], occurredOn: "2024-03-10" },
		];
		const original = structuredClone(input);
		expect(relationshipContactCadence(input, "2024-02-29")).toEqual([
			{ relationship: input.edges[0], lastObservedOn: "2024-02-27", dueOn: "2024-02-29", state: "due" },
		]);
		expect(relationshipContactCadence(input, "2024-02-28").find((item) => item.relationship.id === "due")?.state).toBe(
			"upcoming",
		);
		expect(relationshipContactCadence(input, "2024-03-01").find((item) => item.relationship.id === "due")?.state).toBe(
			"overdue",
		);
		expect(input).toEqual(original);
	});
	it("keeps rich period/cadence metadata equal through incremental and full graph construction", () => {
		const people = [person("a"), person("b")];
		const relation: RelationshipRecord = {
			id: "r",
			filePath: "People/Relationships/r.md",
			from: { raw: "a", target: "a", kind: "id" },
			to: { raw: "b", target: "b", kind: "id" },
			types: [],
			since: "2024-02-29",
			until: "2026-10-03",
			contactIntervalDays: 30,
			status: "dormant",
		};
		const delta: IndexDelta = {
			revision: 1,
			changedPaths: [relation.filePath],
			removedPaths: [],
			affectedPersonIds: ["a", "b"],
			affectedRelationshipIds: ["r"],
			addedPeople: [],
			updatedPeople: [],
			removedPeople: [],
			addedRelationships: [relation],
			updatedRelationships: [],
			removedRelationships: [],
			affectedPeople: people,
			affectedRelationships: [relation],
			diagnostics: [],
			duplicatePersonIds: [],
			duplicateRelationshipIds: [],
		};
		const incremental = applyGraphDelta(
			buildAtlasSnapshot({ people, relationships: [] }, () => undefined),
			delta,
			() => undefined,
			{ resolutionPeople: people },
		);
		const full = buildAtlasSnapshot({ people, relationships: [relation] }, () => undefined);
		expect(incremental.edges).toEqual(full.edges);
		expect(full.edges[0]).toMatchObject({ until: "2026-10-03", contactIntervalDays: 30, status: "dormant" });
	});

	it("excludes actual parsed malformed/reversed periods and duplicate relationship notes from historical/cadence results", () => {
		const people = [person("a"), person("b")];
		for (const properties of [
			{ since: "2024-03-01", until: "2024-02-29" },
			{ since: "2024-02-30" },
			{ until: 20241003 },
		]) {
			const parsed = parse({ ...properties, contact_interval_days: 1, last_contact: "2024-02-01" });
			const full = buildAtlasSnapshot(
				{ people, relationships: parsed.relationship ? [parsed.relationship] : [], diagnostics: parsed.diagnostics },
				() => undefined,
			);
			expect(full.edges).toHaveLength(1);
			expect(filterRelationshipsAtDate(full, "2024-03-02").edges).toEqual([]);
			expect(relationshipContactCadence(full, "2024-03-02")).toEqual([]);
		}
		const parsed = parse({ contact_interval_days: 1, last_contact: "2024-02-01" });
		const relationship = parsed.relationship as RelationshipRecord;
		const duplicate = buildAtlasSnapshot(
			{ people, relationships: [relationship, { ...relationship, filePath: "People/Relationships/duplicate.md" }] },
			() => undefined,
		);
		expect(duplicate.edges).toHaveLength(2);
		expect(duplicate.diagnostics.some((item) => item.code === "duplicate-relationship-id")).toBe(true);
		expect(relationshipContactCadence(duplicate, "2024-03-02")).toEqual([]);
	});
});
