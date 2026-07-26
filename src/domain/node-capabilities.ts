import type { AtlasNode } from "./types";

export type ResolvedAtlasPersonNode = AtlasNode & {
	kind: "person";
	filePath: string;
};

export function isAmbiguousAtlasNode(node: AtlasNode): boolean {
	return node.id.startsWith("ambiguous:");
}

export function isResolvedAtlasPersonNode(node: AtlasNode | undefined): node is ResolvedAtlasPersonNode {
	return Boolean(node?.kind === "person" && node.filePath && !isAmbiguousAtlasNode(node));
}
