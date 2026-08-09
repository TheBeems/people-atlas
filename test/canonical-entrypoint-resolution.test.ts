import { describe, expect, it } from "vitest";
import { uniqueCanonicalRecord } from "../src/entrypoints/canonical-resolution";

describe("canonical entrypoint resolution", () => {
	it("accepts one path and one identity and rejects duplicate paths or identities", () => {
		const records = [
			{ id: "person-1", filePath: "People/A.md" },
			{ id: "person-2", filePath: "People/B.md" },
		];

		expect(uniqueCanonicalRecord(records, "People/A.md")).toEqual(records[0]);
		expect(uniqueCanonicalRecord(records, "People/missing.md")).toBeUndefined();
		expect(
			uniqueCanonicalRecord([...records, { id: "person-1", filePath: "People/C.md" }], "People/A.md"),
		).toBeUndefined();
		expect(
			uniqueCanonicalRecord([...records, { id: "person-2", filePath: "People/A.md" }], "People/A.md"),
		).toBeUndefined();
	});
});
