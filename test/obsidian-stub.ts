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

export class Plugin extends Component {}
export class ItemView extends Component {}
export class BasesView extends Component {}
export class EditorSuggest extends Component {}
export class PluginSettingTab extends Component {}
export class ListValue {}

export const notices: string[] = [];

export class Notice {
	constructor(message: string) {
		notices.push(message);
	}
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}
