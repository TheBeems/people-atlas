import { describe, expect, it } from "vitest";
import {
	normalizeContactMomentFollowUpStatusMutationInput,
	validateContactMomentFollowUpStatusMutationInput,
	type ContactMomentFollowUpStatusMutationInput,
} from "../src/mutations/contact-moment";

function input(
	overrides: Partial<ContactMomentFollowUpStatusMutationInput> = {},
): ContactMomentFollowUpStatusMutationInput {
	return {
		filePath: "People/Contact moments/moment.md",
		contactMomentId: "moment-one",
		reviewedPersonIds: ["person-alice"],
		reviewedOccurredOn: "2026-07-31",
		reviewedFollowUpOn: "2026-08-01",
		reviewedFollowUpStatus: undefined,
		status: "done",
		...overrides,
	};
}

describe("contact-moment follow-up status input", () => {
	it("normalizes reviewed identity/path/date while preserving missing-versus-explicit-open status", () => {
		expect(
			normalizeContactMomentFollowUpStatusMutationInput(
				input({
					filePath: " People\\Contact moments\\moment.md ",
					contactMomentId: " moment-one ",
					reviewedPersonIds: [" person-alice "],
					reviewedRelationshipId: " relationship-alice-bob ",
					reviewedOccurredOn: " 2026-07-31 ",
					reviewedFollowUpOn: " 2026-08-01 ",
					reviewedFollowUpStatus: undefined,
					status: "dismissed",
				}),
			),
		).toEqual({
			filePath: "People/Contact moments/moment.md",
			contactMomentId: "moment-one",
			reviewedPersonIds: ["person-alice"],
			reviewedRelationshipId: "relationship-alice-bob",
			reviewedOccurredOn: "2026-07-31",
			reviewedFollowUpOn: "2026-08-01",
			reviewedFollowUpStatus: undefined,
			status: "dismissed",
		});
		expect(
			normalizeContactMomentFollowUpStatusMutationInput(input({ reviewedFollowUpStatus: "open" }))
				.reviewedFollowUpStatus,
		).toBe("open");
	});

	it("accepts only a valid reviewed open follow-up and a terminal target status", () => {
		expect(validateContactMomentFollowUpStatusMutationInput(input())).toEqual([]);
		expect(
			validateContactMomentFollowUpStatusMutationInput(input({ reviewedFollowUpStatus: "open", status: "dismissed" })),
		).toEqual([]);

		const errors = validateContactMomentFollowUpStatusMutationInput(
			input({
				filePath: "../moment.md",
				contactMomentId: " ",
				reviewedPersonIds: ["", "person-alice", "person-alice"],
				reviewedRelationshipId: " ",
				reviewedOccurredOn: "2026-02-30",
				reviewedFollowUpOn: "2026-02-30",
				reviewedFollowUpStatus: "done" as "open",
				status: "open" as "done",
			}),
		);
		expect(errors).toEqual([
			"A safe Markdown contact-moment path is required.",
			"A reviewed contact-moment ID is required.",
			"Reviewed contact-moment people must be a non-empty ordered list of unique stable IDs.",
			"Reviewed relationship ID cannot be empty when provided.",
			"The reviewed occurred-on date must use a valid YYYY-MM-DD value.",
			"The reviewed follow-up date must use a valid YYYY-MM-DD value.",
			"Only a reviewed open follow-up can be completed or dismissed.",
			"Follow-up status action must be done or dismissed.",
		]);
	});
});
