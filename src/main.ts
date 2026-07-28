import { Notice, Plugin, TFile, type QueryController, type WorkspaceLeaf } from "obsidian";
import { buildBasesOptions } from "./bases/options";
import { PeopleAtlasBasesView } from "./bases/people-atlas-bases-view";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "./constants";
import { PersonIndex } from "./index/person-index";
import { AtlasMutationService } from "./mutations/atlas-mutation-service";
import { PersonMentionSuggest } from "./editor/person-mention-suggest";
import { DEFAULT_SETTINGS } from "./settings/defaults";
import { loadPluginSettings } from "./settings/migrations";
import { PeopleAtlasSettingTab } from "./settings/settings-tab";
import type { PeopleAtlasSettings } from "./settings/types";
import { validatePeopleFolder, validateSettings } from "./settings/validate";
import { PeopleAtlasView } from "./view/people-atlas-view";
import { cloneViewState, DEFAULT_VIEW_STATE, type AtlasViewState } from "./settings/view-state";
import { ViewStateWriteCoordinator } from "./settings/view-state-write-coordinator";
import { RelationshipModal } from "./editor/relationship-modal";

export default class PeopleAtlasPlugin extends Plugin {
	override settings: PeopleAtlasSettings = structuredClone(DEFAULT_SETTINGS);
	readonly index = new PersonIndex(this.app, () => this.settings);
	private settingsWriteEnabled = true;
	private readonly viewStateWrites = new ViewStateWriteCoordinator((viewConfigurationKey, state) =>
		this.persistViewState(viewConfigurationKey, state),
	);
	readonly mutations = new AtlasMutationService(
		this.app,
		() => this.settings,
		() => this.settingsWriteEnabled,
		this.index,
	);

	override async onload(): Promise<void> {
		const loaded = loadPluginSettings(await this.loadData());
		this.settings = loaded.settings;
		this.settingsWriteEnabled = loaded.writeEnabled;
		if (loaded.error) new Notice(loaded.error);
		if (loaded.migrated && loaded.writeEnabled) {
			try {
				await this.saveData(this.settings);
			} catch (error) {
				this.settingsWriteEnabled = false;
				new Notice(
					`People Atlas settings migration could not be saved: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		this.registerView(VIEW_TYPE_PEOPLE_ATLAS, (leaf) => new PeopleAtlasView(leaf, this));
		if (this.settings.enableBases) {
			this.registerBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, {
				name: "People Atlas",
				icon: "map",
				factory: (controller: QueryController, containerEl: HTMLElement) =>
					new PeopleAtlasBasesView(controller, containerEl, this),
				options: buildBasesOptions,
			});
		}

		this.addRibbonIcon("map", "Open People Atlas", () => void this.activateView());
		this.addCommand({
			id: "open-people-atlas",
			name: "Open atlas",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "create-relationship",
			name: "Create relationship",
			callback: () => this.openCreateRelationship(),
		});
		this.addCommand({
			id: "edit-current-relationship",
			name: "Edit current relationship",
			callback: () => this.openEditCurrentRelationship(),
		});
		this.addSettingTab(new PeopleAtlasSettingTab(this));
		this.registerEditorSuggest(new PersonMentionSuggest(this.app, this.index, this.mutations, () => this.settings));

		this.app.workspace.onLayoutReady(() => this.addChild(this.index));
	}

	async updateSetting(key: keyof PeopleAtlasSettings, value: unknown): Promise<void> {
		if (!this.settingsWriteEnabled) {
			new Notice("People Atlas settings are read-only until the plugin data is repaired.");
			return;
		}
		const saved = await this.viewStateWrites.serialize(async () => {
			const previous = this.settings;
			const next = validateSettings({ ...this.settings, [key]: value });
			if (validatePeopleFolder(next.peopleFolder)) {
				new Notice("The People folder is invalid.");
				return false;
			}
			this.settings = next;
			try {
				await this.saveData(this.settings);
				return true;
			} catch (error) {
				this.settings = previous;
				new Notice(
					`People Atlas settings could not be saved: ${error instanceof Error ? error.message : String(error)}`,
				);
				return false;
			}
		});
		if (!saved) return;
		this.index.rebuildAll();
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PEOPLE_ATLAS)) {
			if (leaf.view instanceof PeopleAtlasView) leaf.view.onSettingsChanged();
		}
	}

	getViewState(viewConfigurationKey: string): AtlasViewState {
		return (
			this.viewStateWrites.getLatest(viewConfigurationKey) ??
			cloneViewState(this.settings.viewStates[viewConfigurationKey] ?? DEFAULT_VIEW_STATE)
		);
	}

	saveViewState(viewConfigurationKey: string, state: AtlasViewState): Promise<void> {
		if (!this.settingsWriteEnabled) {
			new Notice("People Atlas view state is read-only until the plugin data is repaired.");
			return Promise.resolve();
		}
		return this.viewStateWrites.schedule(viewConfigurationKey, state);
	}

	flushViewState(viewConfigurationKey: string): Promise<void> {
		return this.viewStateWrites.flush(viewConfigurationKey);
	}

	private async persistViewState(viewConfigurationKey: string, state: AtlasViewState): Promise<void> {
		const previous = this.settings;
		this.settings = {
			...this.settings,
			viewStates: {
				...this.settings.viewStates,
				[viewConfigurationKey]: structuredClone(state),
			},
		};
		try {
			await this.saveData(this.settings);
		} catch (error) {
			this.settings = previous;
			new Notice(
				`People Atlas view state could not be saved: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PEOPLE_ATLAS)[0];
		const leaf: WorkspaceLeaf = existing ?? this.app.workspace.getLeaf("tab");
		if (!existing) await leaf.setViewState({ type: VIEW_TYPE_PEOPLE_ATLAS, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	openCreateRelationship(prefillPersonPath?: string): void {
		const people = this.index.getSnapshot().people;
		if (prefillPersonPath && !people.some((person) => person.filePath === prefillPersonPath)) {
			new Notice("The selected person is no longer available in the People Atlas index.");
			return;
		}
		new RelationshipModal(
			this.app,
			prefillPersonPath ? { kind: "create", prefillPersonPath } : { kind: "create" },
			people,
			this.mutations,
		).open();
	}

	openEditCurrentRelationship(): void {
		const file = this.app.workspace.getActiveFile();
		const relationship = file
			? this.index.getSnapshot().relationships.find((candidate) => candidate.filePath === file.path)
			: undefined;
		if (!(file instanceof TFile) || !relationship) {
			new Notice("No editable relationship note is active.");
			return;
		}
		const rawRelationshipId =
			this.app.metadataCache.getFileCache(file)?.frontmatter?.[this.settings.relationshipIdProperty];
		const explicitRelationshipId =
			typeof rawRelationshipId === "string" && rawRelationshipId.trim() ? rawRelationshipId.trim() : undefined;
		new RelationshipModal(
			this.app,
			explicitRelationshipId
				? { kind: "edit", file, relationship, explicitRelationshipId }
				: { kind: "edit", file, relationship },
			this.index.getSnapshot().people,
			this.mutations,
		).open();
	}
}
