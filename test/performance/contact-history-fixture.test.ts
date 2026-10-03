import { describe, expect, it } from "vitest";
import { IndexState } from "../../src/index/index-state";
import { generateContactHistoryFixture } from "./contact-history-fixture";

describe("contact-history performance fixture", () => {
	it("provides deterministic multi-person history with canonical relationship links and follow-ups", () => {
		const fixture = generateContactHistoryFixture(12);
		expect(fixture).toEqual(generateContactHistoryFixture(12));
		expect(fixture.people).toHaveLength(12);
		expect(fixture.relationships).toHaveLength(12);
		expect(fixture.contactMoments).toHaveLength(12);
		expect(fixture.contactMoments.every((moment) => moment.people.length === 2)).toBe(true);
		expect(fixture.contactMoments.filter((moment) => moment.relationship)).toHaveLength(6);
		expect(fixture.contactMoments.filter((moment) => moment.followUpOn)).toHaveLength(4);
		expect(new Set(fixture.contactMoments.flatMap((moment) => moment.people.map((person) => person.kind)))).toEqual(
			new Set(["id", "path", "wikilink"]),
		);
		const state = new IndexState();
		for (const file of fixture.files) state.upsert(file);
		const snapshot = state.getSnapshot();
		expect(snapshot.diagnostics).toEqual([]);
		expect(snapshot.contactMoments?.every((moment) => moment.actionable && moment.personIds.length === 2)).toBe(true);
	});

	it("retains a simple person-only comparison workload and rejects invalid sizes", () => {
		const fixture = generateContactHistoryFixture(12, "person-only");
		expect(fixture.relationships).toEqual([]);
		expect(fixture.contactMoments.every((moment) => moment.people.length === 1 && !moment.relationship)).toBe(true);
		for (const size of [0, 1, 1.5, Number.NaN]) expect(() => generateContactHistoryFixture(size)).toThrow();
	});
});
