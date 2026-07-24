import type { AtlasDiagnostic, AtlasSnapshot, RawIndexSnapshot } from "../domain/types";
import { buildAtlasSnapshot, type LinkResolver } from "./build-snapshot";

export interface GraphSourceInput {
	visible: RawIndexSnapshot;
	canonical: RawIndexSnapshot;
}

function mergeDiagnostics(...snapshots: RawIndexSnapshot[]): AtlasDiagnostic[] {
	const diagnostics = new Map<string, AtlasDiagnostic>();
	for (const snapshot of snapshots) {
		for (const diagnostic of snapshot.diagnostics ?? []) diagnostics.set(diagnostic.id, diagnostic);
	}
	return [...diagnostics.values()];
}

export function buildGraphSnapshot(source: GraphSourceInput, resolveLink: LinkResolver): AtlasSnapshot {
	return buildAtlasSnapshot(
		{
			people: source.visible.people,
			relationships: source.canonical.relationships,
			diagnostics: mergeDiagnostics(source.canonical, source.visible),
		},
		resolveLink,
		{ resolutionPeople: source.canonical.people },
	);
}
