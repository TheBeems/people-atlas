export function getAllTags(cache: { tags?: Array<{ tag: string }> } | null): string[] {
	return cache?.tags?.map((tag) => tag.tag) ?? [];
}

export class TFile {
	path = "";
	extension = "md";
	basename = "";
}

export class Component {
	private readonly eventRefs: Array<{ unload?: () => void }> = [];

	registerEvent<T extends { unload?: () => void }>(eventRef: T): void {
		this.eventRefs.push(eventRef);
	}
}
