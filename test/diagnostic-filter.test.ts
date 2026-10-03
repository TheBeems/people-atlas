import { describe, expect, it } from "vitest";
import type { AtlasDiagnostic } from "../src/domain/types";
import { diagnosticsInContext, filterDiagnostics } from "../src/graph/filter-diagnostics";

const diagnostics: AtlasDiagnostic[] = [
	{
		id: "1",
		severity: "warning",
		code: "missing-person-id",
		message: "Person missing identity",
		filePaths: ["People/A.md"],
	},
	{
		id: "2",
		severity: "error",
		code: "duplicate-person-id",
		message: "Duplicate identity",
		filePaths: ["People/A.md", "Private/B.md"],
	},
	{
		id: "3",
		severity: "warning",
		code: "missing-asset",
		message: "Private photo",
		filePaths: ["People/A.md"],
		targetPath: "Private/image.jpg",
	},
];
describe("complete diagnostic filters", () => {
	it("combines text, severity and code without modifying diagnostics", () => {
		expect(
			filterDiagnostics(diagnostics, { text: "  PEOPLE/a  ", severity: "warning", code: "missing-person-id" }),
		).toEqual([diagnostics[0]]);
		expect(filterDiagnostics(diagnostics, { severity: "error" })).toEqual([diagnostics[1]]);
		expect(filterDiagnostics(diagnostics, {})).toHaveLength(3);
	});
	it("never reveals diagnostic messages or paths outside a restricted Base context", () => {
		expect(diagnosticsInContext(diagnostics, new Set(["People/A.md"]))).toEqual([diagnostics[0]]);
		expect(diagnosticsInContext(diagnostics)).toEqual(diagnostics);
	});
});
