import { describe, expect, it } from "vitest";
import { normalizePathIdentity } from "../src/domain/identity";

describe("path normalization", () => {
	it("normalizes vault paths for lookup indexes", () => {
		expect(normalizePathIdentity(" /People\\Alice.md ")).toBe("people/alice.md");
	});
});
