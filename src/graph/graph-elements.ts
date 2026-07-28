import type { AtlasDiagnostic, NodeId } from "../domain/types";
import { stableHash } from "../utils/hash";

export function inferredContactEdgeId(sourceId: NodeId, targetId: NodeId): string {
	return `edge:${stableHash(`${sourceId}:${targetId}:contact`)}`;
}

export function filteredEndpointDiagnostic(filePath: string, label: string, discriminator?: string): AtlasDiagnostic {
	const suffix = discriminator ? `:${stableHash(discriminator)}` : "";
	return {
		id: `filtered-endpoint:${filePath}:${label}${suffix}`,
		severity: "info",
		code: "filtered-endpoint",
		message: `The ${label} endpoint in “${filePath}” is a resolved person outside the current Base selection.`,
		filePaths: [filePath],
	};
}
