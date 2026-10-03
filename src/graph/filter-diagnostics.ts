import type { AtlasDiagnostic, DiagnosticSeverity } from "../domain/types";

export interface DiagnosticFilters {
	text?: string;
	severity?: DiagnosticSeverity | "all";
	code?: AtlasDiagnostic["code"] | "all";
}

export function filterDiagnostics(
	diagnostics: readonly AtlasDiagnostic[],
	filters: DiagnosticFilters,
): AtlasDiagnostic[] {
	const text = filters.text?.trim().toLocaleLowerCase() ?? "";
	return diagnostics.filter(
		(diagnostic) =>
			(!filters.severity || filters.severity === "all" || diagnostic.severity === filters.severity) &&
			(!filters.code || filters.code === "all" || diagnostic.code === filters.code) &&
			(!text ||
				[diagnostic.code, diagnostic.message, ...diagnostic.filePaths].join(" ").toLocaleLowerCase().includes(text)),
	);
}

/** A restricted Base must never expose another record's path or diagnostic text. */
export function diagnosticsInContext(
	diagnostics: readonly AtlasDiagnostic[],
	allowedPaths?: ReadonlySet<string>,
): AtlasDiagnostic[] {
	if (!allowedPaths) return [...diagnostics];
	return diagnostics.filter(
		(diagnostic) =>
			diagnostic.filePaths.every((path) => allowedPaths.has(path)) &&
			(!diagnostic.targetPath || allowedPaths.has(diagnostic.targetPath)),
	);
}
