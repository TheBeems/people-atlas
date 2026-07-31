import type { AtlasDiagnostic, AtlasSnapshot, RawIndexSnapshot } from "../domain/types";
import { buildAtlasSnapshot, filterContactMomentDiagnostics, type LinkResolver } from "./build-snapshot";

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
	const visiblePersonPaths = new Set(source.visible.people.map((person) => person.filePath));
	const contactMoments = source.canonical.contactMoments ?? [];
	const diagnostics = filterContactMomentDiagnostics(
		mergeDiagnostics(source.canonical, source.visible),
		contactMoments,
		source.canonical.relationships,
		source.canonical.people,
		visiblePersonPaths,
		resolveLink,
	);
	return buildAtlasSnapshot(
		{
			people: source.visible.people,
			relationships: source.canonical.relationships,
			contactMoments,
			diagnostics,
		},
		resolveLink,
		{ resolutionPeople: source.canonical.people },
	);
}
