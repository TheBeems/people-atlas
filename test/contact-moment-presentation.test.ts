import { describe, expect, it } from "vitest";
import {
	buildSelectedPersonContactMomentPresentation,
	groupContactMomentFollowUps,
	getLatestSelectedPersonContactMoment,
	type ContactMomentPresentationSource,
} from "../src/render/contact-moment-presentation";

function moment(
	id: string,
	occurredOn: string,
	overrides: Partial<ContactMomentPresentationSource> = {},
): ContactMomentPresentationSource {
	return {
		id,
		filePath: `People/Contact moments/${id}.md`,
		personIds: ["person-alice"],
		occurredOn,
		...overrides,
	};
}

describe("contact-moment presentation", () => {
	it("selects at most three recent moments by newest occurred date and then stable ID", () => {
		const moments = [
			moment("moment-z", "2026-07-31"),
			moment("moment-b", "2026-08-01"),
			moment("moment-a", "2026-08-01"),
			moment("moment-old", "2026-07-01"),
			moment("moment-other", "2026-09-01", { personIds: ["person-bob"] }),
			moment("moment-invalid", "2026-02-30"),
		];

		expect(
			buildSelectedPersonContactMomentPresentation(moments, "person-alice").recentMoments.map(({ id }) => id),
		).toEqual(["moment-a", "moment-b", "moment-z"]);
		expect(
			buildSelectedPersonContactMomentPresentation(moments, "person-alice", 99).recentMoments.map(({ id }) => id),
		).toEqual(["moment-a", "moment-b", "moment-z", "moment-old"]);
		expect(
			buildSelectedPersonContactMomentPresentation(moments, "person-alice", Number.POSITIVE_INFINITY).recentMoments.map(
				({ id }) => id,
			),
		).toEqual(["moment-a", "moment-b", "moment-z", "moment-old"]);
		expect(
			buildSelectedPersonContactMomentPresentation(moments, "person-alice", 1).recentMoments.map(({ id }) => id),
		).toEqual(["moment-a"]);
	});

	it("derives the latest explicit contact only from valid moments for the selected person", () => {
		const latest = moment("moment-latest", "2026-08-01");
		expect(
			getLatestSelectedPersonContactMoment(
				[latest, moment("moment-old", "2026-07-31"), moment("invalid", "2026-02-30")],
				"person-alice",
			),
		).toEqual(latest);
		expect(
			getLatestSelectedPersonContactMoment(
				[moment("other", "2026-08-02", { personIds: ["person-bob"] })],
				"person-alice",
			),
		).toBeUndefined();
	});

	it("selects the earliest effective-open follow-up for the selected person", () => {
		const moments = [
			moment("moment-later", "2026-07-20", { followUpOn: "2026-08-10" }),
			moment("moment-open-b", "2026-07-21", { followUpOn: "2026-08-01", followUpStatus: "open" }),
			moment("moment-open-a", "2026-07-22", { followUpOn: "2026-08-01" }),
			moment("moment-done", "2026-07-23", { followUpOn: "2026-07-25", followUpStatus: "done" }),
			moment("moment-dismissed", "2026-07-24", {
				followUpOn: "2026-07-24",
				followUpStatus: "dismissed",
			}),
			moment("moment-other", "2026-07-25", {
				personIds: ["person-bob"],
				followUpOn: "2026-07-01",
			}),
		];

		const earliest = buildSelectedPersonContactMomentPresentation(moments, "person-alice").earliestOpenFollowUp;
		expect(earliest).toMatchObject({
			moment: { id: "moment-open-a" },
			followUpOn: "2026-08-01",
		});
		expect(earliest?.reviewedFollowUpStatus).toBeUndefined();
		expect(buildSelectedPersonContactMomentPresentation(moments, " ").earliestOpenFollowUp).toBeUndefined();
	});

	it("groups only valid open follow-ups against explicit local today with stable ordering", () => {
		const moments = [
			moment("overdue-newer", "2026-07-01", { followUpOn: "2026-07-30", followUpStatus: "open" }),
			moment("overdue-old-b", "2026-07-01", { followUpOn: "2026-07-20" }),
			moment("overdue-old-a", "2026-07-01", { followUpOn: "2026-07-20" }),
			moment("today-b", "2026-07-01", { followUpOn: "2026-07-31" }),
			moment("today-a", "2026-07-01", { followUpOn: "2026-07-31", followUpStatus: "open" }),
			moment("upcoming-later", "2026-07-01", { followUpOn: "2026-08-10" }),
			moment("upcoming-sooner", "2026-07-01", { followUpOn: "2026-08-01" }),
			moment("done", "2026-07-01", { followUpOn: "2026-07-01", followUpStatus: "done" }),
			moment("dismissed", "2026-07-01", { followUpOn: "2026-07-01", followUpStatus: "dismissed" }),
			moment("no-follow-up", "2026-07-01"),
			moment("invalid-follow-up", "2026-07-01", { followUpOn: "2026-02-30" }),
			moment("invalid-summary", "2026-02-30", { followUpOn: "2026-07-01" }),
		];

		const groups = groupContactMomentFollowUps(moments, "2026-07-31");

		expect(groups.overdue.map(({ moment: entry }) => entry.id)).toEqual([
			"overdue-old-a",
			"overdue-old-b",
			"overdue-newer",
		]);
		expect(groups.dueToday.map(({ moment: entry }) => entry.id)).toEqual(["today-a", "today-b"]);
		expect(groups.dueToday.map(({ reviewedFollowUpStatus }) => reviewedFollowUpStatus)).toEqual(["open", undefined]);
		expect(groups.upcoming.map(({ moment: entry }) => entry.id)).toEqual(["upcoming-sooner", "upcoming-later"]);
	});

	it("rejects an invalid explicit today instead of assigning misleading groups", () => {
		expect(() => groupContactMomentFollowUps([], "2026-02-30")).toThrow("valid local YYYY-MM-DD");
	});
});
