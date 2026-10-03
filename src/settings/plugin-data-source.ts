import type { App } from "obsidian";

export function readOriginalPluginDataText(app: App): Promise<string> {
	return app.vault.adapter.read(`${app.vault.configDir}/plugins/people-atlas/data.json`);
}
