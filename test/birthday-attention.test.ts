import { describe, expect, it } from "vitest";
import type { PersonRecord, ContactMomentSummary } from "../src/domain/types";
import { buildAtlasSnapshot } from "../src/graph/build-snapshot";
import { birthdayAttention } from "../src/graph/birthday-attention";
import {
	filterContactMomentFollowUps,
	groupContactMomentFollowUps,
	postponeFollowUpOneWeek,
} from "../src/render/contact-moment-presentation";

function person(id: string, birthDate: string): PersonRecord {
	return {
		id,
		filePath: `People/${id}.md`,
		name: "Same name",
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
		birthDate,
	};
}

function moment(id: string, followUpStatus?: ContactMomentSummary["followUpStatus"]): ContactMomentSummary {
	return {
		id,
		filePath: `Moments/${id}.md`,
		personIds: ["person"],
		occurredOn: "2026-09-30",
		followUpOn: "2026-10-01",
		...(followUpStatus ? { followUpStatus } : {}),
	};
}

describe("local birthday attention", () => {
	it("includes today and the inclusive next 30 calendar days across year rollover, with known age only", () => {
		const snapshot = buildAtlasSnapshot(
			{
				people: [
					person("today", "2000-12-20"),
					person("yearless", "--01-02"),
					person("limit", "1990-01-19"),
					person("later", "1990-01-20"),
				],
				relationships: [],
			},
			() => undefined,
		);
		const rows = birthdayAttention(snapshot, "2026-12-20");
		expect(rows.map(({ person, birthdayOn, isToday, age }) => [person.id, birthdayOn, isToday, age])).toEqual([
			["today", "2026-12-20", true, 26],
			["yearless", "2027-01-02", false, undefined],
			["limit", "2027-01-19", false, 37],
		]);
		const yearless = rows.find((row) => row.person.id === "yearless");
		if (!yearless) throw new Error("The yearless birthday must remain admitted.");
		expect(Object.hasOwn(yearless, "age")).toBe(false);
	});

	it("includes February 29 only on an actual leap-year occurrence", () => {
		const snapshot = buildAtlasSnapshot(
			{ people: [person("leap", "2000-02-29"), person("unknown", "--02-29")], relationships: [] },
			() => undefined,
		);
		expect(birthdayAttention(snapshot, "2027-02-01")).toEqual([]);
		expect(
			birthdayAttention(snapshot, "2028-02-29").map((row) => [row.person.id, row.birthdayOn, row.isToday, row.age]),
		).toEqual([
			["leap", "2028-02-29", true, 28],
			["unknown", "2028-02-29", true, undefined],
		]);
	});

	it("omits invalid, future-born, duplicate and unresolved people without inferring identities", () => {
		const snapshot = buildAtlasSnapshot(
			{
				people: [
					person("invalid", "2026-02-30"),
					person("future", "2030-10-03"),
					person("duplicate", "--10-03"),
					{ ...person("duplicate", "--10-03"), filePath: "People/Other.md" },
				],
				relationships: [],
			},
			() => undefined,
		);
		expect(birthdayAttention(snapshot, "2026-10-03")).toEqual([]);
		expect(() => birthdayAttention(snapshot, "2026-02-30")).toThrow("valid local");
	});
});

describe("reviewed follow-up attention", () => {
	it("adds seven calendar days from the later of today and due date across DST and year boundaries", () => {
		expect(postponeFollowUpOneWeek("2026-03-25", "2026-03-27")).toBe("2026-04-03");
		expect(postponeFollowUpOneWeek("2026-10-24", "2026-10-03")).toBe("2026-10-31");
		expect(postponeFollowUpOneWeek("2026-12-29", "2026-12-01")).toBe("2027-01-05");
		expect(postponeFollowUpOneWeek("2028-02-27", "2028-02-20")).toBe("2028-03-05");
		expect(postponeFollowUpOneWeek(undefined, "2026-10-03")).toBeUndefined();
		expect(postponeFollowUpOneWeek("2026-02-30", "2026-10-03")).toBeUndefined();
	});

	it("defaults to effective-open and retains terminal history without treating it as overdue", () => {
		const rows = [moment("implicit"), moment("open", "open"), moment("done", "done"), moment("dismissed", "dismissed")];
		expect(filterContactMomentFollowUps(rows).map((row) => row.moment.id)).toEqual(["implicit", "open"]);
		expect(filterContactMomentFollowUps(rows, "done").map((row) => row.moment.id)).toEqual(["done"]);
		expect(filterContactMomentFollowUps(rows, "dismissed").map((row) => row.moment.id)).toEqual(["dismissed"]);
		expect(filterContactMomentFollowUps(rows, "all").map((row) => row.moment.id)).toEqual([
			"dismissed",
			"done",
			"implicit",
			"open",
		]);
		expect(groupContactMomentFollowUps(rows, "2026-10-03").overdue.map((row) => row.moment.id)).toEqual([
			"implicit",
			"open",
		]);
		expect(filterContactMomentFollowUps([{ ...moment("bad"), followUpOn: "2026-02-30" }], "all")).toEqual([]);
	});
});
