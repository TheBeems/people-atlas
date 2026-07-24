import { Plugin, type QueryController, type WorkspaceLeaf } from "obsidian";
import { buildBasesOptions } from "./bases/options";
import { PeopleAtlasBasesView } from "./bases/people-atlas-bases-view";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "./constants";
import { PersonIndex } from "./index/person-index";
import { DEFAULT_SETTINGS } from "./settings/defaults";
import { PeopleAtlasSettingTab } from "./settings/settings-tab";
import type { PeopleAtlasSettings } from "./settings/types";
import { validateSettings } from "./settings/validate";
import { PeopleAtlasView } from "./view/people-atlas-view";

export default class PeopleAtlasPlugin extends Plugin {
	override settings: PeopleAtlasSettings = structuredClone(DEFAULT_SETTINGS);
	readonly index = new PersonIndex(this.app, () => this.settings);

	override async onload(): Promise<void> {
		this.settings = validateSettings(await this.loadData());

		this.registerView(VIEW_TYPE_PEOPLE_ATLAS, (leaf) => new PeopleAtlasView(leaf, this));
		if (this.settings.enableBases) {
			this.registerBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, {
				name: "People Atlas",
				icon: "map",
				factory: (controller: QueryController, containerEl: HTMLElement) => new PeopleAtlasBasesView(controller, containerEl, this),
				options: buildBasesOptions,
			});
		}

		this.addRibbonIcon("map", "Open People Atlas", () => void this.activateView());
		this.addCommand({
			id: "open-people-atlas",
			name: "Open People Atlas",
			callback: () => void this.activateView(),
		});
		this.addSettingTab(new PeopleAtlasSettingTab(this));

		this.app.workspace.onLayoutReady(() => this.addChild(this.index));
	}

	async updateSetting(key: keyof PeopleAtlasSettings, value: unknown): Promise<void> {
		const next = { ...this.settings, [key]: value };
		this.settings = validateSettings(next);
		await this.saveData(this.settings);
		this.index.rebuildAll();
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PEOPLE_ATLAS)) {
			if (leaf.view instanceof PeopleAtlasView) leaf.view.onSettingsChanged();
		}
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PEOPLE_ATLAS)[0];
		const leaf: WorkspaceLeaf = existing ?? this.app.workspace.getLeaf("tab");
		if (!existing) await leaf.setViewState({ type: VIEW_TYPE_PEOPLE_ATLAS, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
