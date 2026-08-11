import {
	MarkdownRenderChild,
	Notice,
	Plugin,
	TFile,
	getLanguage,
	type MarkdownPostProcessorContext,
	type QueryController,
	type WorkspaceLeaf,
} from "obsidian";
import { buildBasesOptions } from "./bases/options";
import { PeopleAtlasBasesView } from "./bases/people-atlas-bases-view";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "./constants";
import { PersonIndex } from "./index/person-index";
import { AtlasMutationService } from "./mutations/atlas-mutation-service";
import { CanonicalEntryPointResolver, type CanonicalContactMomentResolution } from "./entrypoints/canonical-resolution";
import { captureContactMomentEditSourceBaseline } from "./mutations/contact-moment";
import { capturePersonEditSourceBaseline } from "./mutations/person-source-guard";
import { PersonMentionSuggest } from "./editor/person-mention-suggest";
import { PersonModal } from "./editor/person-modal";
import { DEFAULT_SETTINGS } from "./settings/defaults";
import { loadPluginSettings } from "./settings/load";
import { PeopleAtlasSettingTab } from "./settings/settings-tab";
import type { PeopleAtlasSettings } from "./settings/types";
import {
	validateConfiguredPropertyNames,
	validateContactMomentPropertyMappings,
	validateNoteTypeValues,
	validatePeopleRootFolder,
	validatePersonPropertyMappings,
	validateSettings,
	YAML_PROPERTY_NAME_SETTING_KEYS,
} from "./settings/validate";
import { PeopleAtlasView } from "./view/people-atlas-view";
import { cloneViewState, DEFAULT_VIEW_STATE, type AtlasViewState } from "./settings/view-state";
import { ViewStateWriteCoordinator } from "./settings/view-state-write-coordinator";
import {
	RelationshipModal,
	type RelationshipCreateSuccess,
	type RelationshipTemplateCreation,
} from "./editor/relationship-modal";
import { PartnerParentConfirmationModal } from "./editor/partner-parent-confirmation-modal";
import { buildRelationshipCreatePrefill, resolveCanonicalPersonByPath } from "./editor/relationship-form";
import {
	planPartnerParentConfirmation,
	samePartnerParentCandidate,
	type PartnerParentCandidate,
} from "./domain/partner-parent-confirmation";
import { ContactMomentModal } from "./editor/contact-moment-modal";
import type { ContactMomentFormContext } from "./editor/contact-moment-form";
import type { ContactMomentRecord, ContactMomentSummary, PersonRecord, RelationshipRecord } from "./domain/types";
import { parseAtlasFile } from "./index/frontmatter";
import type { RelationshipPreset } from "./settings/relationship-presets";
import { validateRelationshipRoleFormat, validateStoredRelationshipPresets } from "./settings/relationship-presets";
import {
	buildRelationshipPresetSyncChanges,
	relationshipPresetUpdates,
	sameRelationshipPresetValues,
	type RelationshipPresetSyncChange,
	type RelationshipPresetSyncResult,
} from "./settings/relationship-preset-sync";
import { createTranslator, type Translator } from "./i18n";

export interface MyPersonCandidate {
	id: string;
	name: string;
	filePath: string;
}

type ResolvedCanonicalContactMoment = CanonicalContactMomentResolution;

export default class PeopleAtlasPlugin extends Plugin {
	override settings: PeopleAtlasSettings = structuredClone(DEFAULT_SETTINGS);
	readonly t: Translator = createTranslator(getLanguage());
	readonly index = new PersonIndex(this.app, () => this.settings);
	private settingsWriteEnabled = true;
	private lifecycleGeneration = 0;
	private readonly renderedNoteActionDocumentIds = new Set<string>();
	private readonly viewStateWrites = new ViewStateWriteCoordinator((viewConfigurationKey, state) =>
		this.persistViewState(viewConfigurationKey, state),
	);
	readonly mutations = new AtlasMutationService(
		this.app,
		() => this.settings,
		() => this.settingsWriteEnabled,
		this.index,
	);
	private readonly canonicalResolver = new CanonicalEntryPointResolver({
		people: () => this.index.getSnapshot().people,
		relationships: () => this.index.getSnapshot().relationships,
		contactMoments: () => this.index.getSnapshot().contactMoments ?? [],
		file: (path) => this.app.vault.getAbstractFileByPath(path),
		readPerson: (file) => {
			const cache = this.app.metadataCache.getFileCache(file);
			const person = parseAtlasFile(this.app, file, cache, this.settings).person;
			if (!person) return undefined;
			const rawType = cache?.frontmatter?.[this.settings.typeProperty];
			return {
				file,
				person,
				frontmatter: cache?.frontmatter ?? {},
				personClassification:
					typeof rawType === "string" &&
					rawType.trim().toLowerCase() === this.settings.personTypeValue.trim().toLowerCase()
						? "type"
						: "tag",
			};
		},
		readRelationship: (file) => {
			const cache = this.app.metadataCache.getFileCache(file);
			return parseAtlasFile(this.app, file, cache, this.settings).relationship;
		},
		readContactMoment: (file) => {
			const cache = this.app.metadataCache.getFileCache(file);
			const contactMoment = parseAtlasFile(this.app, file, cache, this.settings).contactMoment;
			if (!contactMoment) return undefined;
			return {
				file,
				contactMoment,
				sourceBaseline: captureContactMomentEditSourceBaseline(cache?.frontmatter ?? {}, this.settings),
			};
		},
	});

	override async onload(): Promise<void> {
		const lifecycleGeneration = ++this.lifecycleGeneration;
		const loaded = loadPluginSettings(await this.loadData());
		this.settings = loaded.settings;
		this.settingsWriteEnabled = loaded.writeEnabled;
		if (loaded.error) new Notice(this.t.noticeSettingsLoadFailed({ error: loaded.error }));

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

		this.addRibbonIcon("map", this.t.ribbonOpenPeopleAtlas, () => void this.activateView());
		this.addCommand({
			id: "open-people-atlas",
			name: this.t.commandOpenAtlas,
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "open-follow-ups",
			name: this.t.commandOpenFollowUps,
			callback: () => void this.activateView("follow-ups"),
		});
		this.addCommand({
			id: "create-person",
			name: this.t.commandCreatePerson,
			callback: () => this.openCreatePerson(),
		});
		this.addCommand({
			id: "edit-current-person",
			name: this.t.commandEditCurrentPerson,
			callback: () => this.openEditCurrentPerson(),
		});
		this.addCommand({
			id: "create-relationship",
			name: this.t.commandCreateRelationship,
			callback: () => this.openCreateRelationship(),
		});
		this.addCommand({
			id: "edit-current-relationship",
			name: this.t.commandEditCurrentRelationship,
			callback: () => this.openEditCurrentRelationship(),
		});
		this.addCommand({
			id: "log-contact",
			name: this.t.commandLogContact,
			callback: () => this.openLogContact(),
		});
		this.addCommand({
			id: "edit-current-contact-moment",
			name: this.t.commandEditCurrentContactMoment,
			callback: () => this.openEditCurrentContactMoment(),
		});
		this.addCommand({
			id: "rebuild-index",
			name: this.t.commandRebuildIndex,
			callback: () => this.index.rebuildAll(),
		});
		this.addSettingTab(new PeopleAtlasSettingTab(this));
		this.registerEditorSuggest(
			new PersonMentionSuggest(this.app, this.index, this.mutations, () => this.settings, this.t),
		);
		this.registerMarkdownPostProcessor((section, context) => this.renderNoteContextActions(section, context));

		this.app.workspace.onLayoutReady(() => {
			if (this.lifecycleGeneration !== lifecycleGeneration) return;
			this.addChild(this.index);
		});
	}

	override onunload(): void {
		this.lifecycleGeneration += 1;
	}

	async updateSetting(key: keyof PeopleAtlasSettings, value: unknown): Promise<boolean> {
		if (!this.settingsWriteEnabled) {
			new Notice(this.t.noticeSettingsReadOnly);
			return false;
		}
		if ((YAML_PROPERTY_NAME_SETTING_KEYS as readonly string[]).includes(key) && typeof value !== "string") {
			new Notice(
				this.t.noticeInvalidPropertyNames({
					error: `${key} must be a text property name.`,
				}),
			);
			return false;
		}
		if (key === "relationshipPresets") {
			const presetError = validateStoredRelationshipPresets(value);
			if (presetError) {
				new Notice(this.t.noticeInvalidRelationshipTemplates({ error: presetError }));
				return false;
			}
		}
		if (key === "relationshipRoleFormat") {
			if (typeof value !== "string") {
				new Notice(this.t.noticeRelationshipRoleFormatMustBeText);
				return false;
			}
			const formatError = validateRelationshipRoleFormat(value);
			if (formatError) {
				new Notice(this.t.noticeInvalidRelationshipRoleFormat({ error: formatError }));
				return false;
			}
		}
		const saved = await this.viewStateWrites.serialize(async () => {
			const previous = this.settings;
			const next = validateSettings({ ...this.settings, [key]: value });
			const peopleRootFolderError = validatePeopleRootFolder(next.peopleRootFolder);
			if (peopleRootFolderError) {
				new Notice(this.t.noticeInvalidPeopleRootFolder({ error: peopleRootFolderError }));
				return false;
			}
			const configuredPropertyNameError = validateConfiguredPropertyNames(next);
			if (configuredPropertyNameError) {
				new Notice(this.t.noticeInvalidPropertyNames({ error: configuredPropertyNameError }));
				return false;
			}
			const personPropertyError = validatePersonPropertyMappings(next);
			if (personPropertyError) {
				new Notice(this.t.noticeInvalidPersonProperties({ error: personPropertyError }));
				return false;
			}
			const contactMomentPropertyError = validateContactMomentPropertyMappings(next);
			if (contactMomentPropertyError) {
				new Notice(this.t.noticeInvalidContactMomentProperties({ error: contactMomentPropertyError }));
				return false;
			}
			const noteTypeError = validateNoteTypeValues(next);
			if (noteTypeError) {
				new Notice(this.t.noticeInvalidNoteTypeValues({ error: noteTypeError }));
				return false;
			}
			this.settings = next;
			try {
				await this.saveData(this.settings);
				return true;
			} catch (error) {
				this.settings = previous;
				new Notice(this.t.noticeSettingsSaveFailed({ error: error instanceof Error ? error.message : String(error) }));
				return false;
			}
		});
		if (!saved) return false;
		this.index.rebuildAll();
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_PEOPLE_ATLAS)) {
			if (leaf.view instanceof PeopleAtlasView) leaf.view.onSettingsChanged();
		}
		return true;
	}

	canWritePeopleAtlasData(): boolean {
		return this.settingsWriteEnabled;
	}

	getRelationshipPresetSyncChanges(presetId: string): RelationshipPresetSyncChange[] {
		const preset = this.settings.relationshipPresets.find((candidate) => candidate.id === presetId);
		if (!preset) return [];
		return buildRelationshipPresetSyncChanges(this.index.getSnapshot().relationships, preset);
	}

	getRelationshipPresetLinkCount(presetId: string): number {
		return this.index.getSnapshot().relationships.filter((relationship) => relationship.presetId === presetId).length;
	}

	async syncRelationshipPreset(
		presetId: string,
		approvedChanges: RelationshipPresetSyncChange[],
	): Promise<RelationshipPresetSyncResult> {
		const preset = this.settings.relationshipPresets.find((candidate) => candidate.id === presetId);
		if (!preset) {
			return {
				completed: 0,
				skipped: 0,
				remaining: approvedChanges.length,
				failure: { message: `Relationship template “${presetId}” is no longer available.` },
			};
		}
		const approvedPresetValues = approvedChanges[0]?.after;
		const currentPresetValues = presetValues(preset);
		if (approvedPresetValues && !sameRelationshipPresetValues(approvedPresetValues, currentPresetValues)) {
			return {
				completed: 0,
				skipped: 0,
				remaining: approvedChanges.length,
				failure: {
					message: "The relationship template changed after this preview was opened. Review a new preview.",
				},
			};
		}

		let completed = 0;
		let skipped = 0;
		for (const [index, approved] of approvedChanges.entries()) {
			const relationship = this.index
				.getSnapshot()
				.relationships.find((candidate) => candidate.filePath === approved.filePath && candidate.presetId === presetId);
			if (!relationship) {
				skipped += 1;
				continue;
			}
			const currentChange = buildRelationshipPresetSyncChanges([relationship], preset)[0];
			if (!currentChange) {
				skipped += 1;
				continue;
			}
			if (!sameRelationshipPresetValues(currentChange.before, approved.before)) {
				return {
					completed,
					skipped,
					remaining: approvedChanges.length - index,
					failure: {
						filePath: approved.filePath,
						message: "The relationship changed after this preview was opened. Review a new preview.",
					},
				};
			}
			const file = this.app.vault.getAbstractFileByPath(approved.filePath);
			if (!(file instanceof TFile)) {
				return {
					completed,
					skipped,
					remaining: approvedChanges.length - index,
					failure: { filePath: approved.filePath, message: "The relationship note is no longer available." },
				};
			}
			try {
				const result = await this.mutations.syncRelationshipPreset(
					file,
					approved.before,
					relationshipPresetUpdates(preset),
				);
				if (result.status === "updated") completed += 1;
				else skipped += 1;
			} catch (error) {
				return {
					completed,
					skipped,
					remaining: approvedChanges.length - index,
					failure: {
						filePath: approved.filePath,
						message: error instanceof Error ? error.message : String(error),
					},
				};
			}
		}
		return { completed, skipped, remaining: 0 };
	}

	getViewState(viewConfigurationKey: string): AtlasViewState {
		return (
			this.viewStateWrites.getLatest(viewConfigurationKey) ??
			cloneViewState(this.settings.viewStates[viewConfigurationKey] ?? DEFAULT_VIEW_STATE)
		);
	}

	saveViewState(viewConfigurationKey: string, state: AtlasViewState): Promise<void> {
		if (!this.settingsWriteEnabled) {
			new Notice(this.t.noticeViewStateReadOnly);
			return Promise.resolve();
		}
		return this.viewStateWrites.schedule(viewConfigurationKey, state);
	}

	flushViewState(viewConfigurationKey: string): Promise<void> {
		return this.viewStateWrites.flush(viewConfigurationKey);
	}

	getMyPersonCandidates(): MyPersonCandidate[] {
		return this.index
			.getSnapshot()
			.people.map((person) => ({ id: person.id, name: person.name, filePath: person.filePath }))
			.sort(
				(left, right) =>
					left.name.localeCompare(right.name) ||
					left.filePath.localeCompare(right.filePath) ||
					left.id.localeCompare(right.id),
			);
	}

	resolveMyPerson(): PersonRecord | undefined {
		const configuredId = this.settings.myPersonId.trim();
		if (!configuredId) return undefined;
		const matches = this.index.getSnapshot().people.filter((person) => person.id === configuredId);
		return matches.length === 1 ? matches[0] : undefined;
	}

	getMyPersonWarning(): string | undefined {
		const configuredId = this.settings.myPersonId.trim();
		if (!configuredId) return undefined;
		const matches = this.index.getSnapshot().people.filter((person) => person.id === configuredId);
		if (matches.length === 1) return undefined;
		return matches.length === 0
			? this.t.settingsMyPersonUnavailableWarning({ id: configuredId })
			: this.t.settingsMyPersonAmbiguousWarning({ id: configuredId, count: matches.length });
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
			new Notice(this.t.noticeViewStateSaveFailed({ error: error instanceof Error ? error.message : String(error) }));
		}
	}

	async activateView(mode?: "follow-ups"): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_PEOPLE_ATLAS)[0];
		const leaf: WorkspaceLeaf = existing ?? this.app.workspace.getLeaf("tab");
		if (!existing) await leaf.setViewState({ type: VIEW_TYPE_PEOPLE_ATLAS, active: true });
		await this.app.workspace.revealLeaf(leaf);
		if (mode === "follow-ups" && leaf.view instanceof PeopleAtlasView) leaf.view.showFollowUps();
	}

	openCreatePerson(): void {
		if (!this.canWritePeopleAtlasData()) {
			this.noticePersonWritesDisabled();
			return;
		}
		const people = this.index.getSnapshot().people;
		new PersonModal(
			this.app,
			{ kind: "create" },
			people,
			this.mutations,
			() => this.settings,
			() => this.index.getSnapshot().people,
			this.t,
		).open();
	}

	openEditCurrentPerson(): void {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) {
			new Notice(this.t.noticeNoEditablePersonActive);
			return;
		}
		void this.openEditPerson(file.path);
	}

	async openEditPerson(personPath: string): Promise<void> {
		if (!this.canWritePeopleAtlasData()) {
			this.noticePersonWritesDisabled();
			return;
		}
		let target = this.resolveCanonicalPerson(personPath);
		if (!target) {
			new Notice(this.t.noticePersonUnavailable);
			return;
		}
		const sourceBaseline =
			target.personClassification === "tag"
				? await capturePersonEditSourceBaseline(this.app, target.file, this.settings.personTag)
				: undefined;
		if (target.personClassification === "tag") {
			const refreshedTarget = this.resolveCanonicalPerson(personPath);
			if (
				!sourceBaseline ||
				!refreshedTarget ||
				refreshedTarget.file !== target.file ||
				refreshedTarget.personClassification !== "tag" ||
				!this.canWritePeopleAtlasData()
			) {
				new Notice(this.t.noticePersonSourceChanged);
				return;
			}
			target = refreshedTarget;
		}
		const { file, person, frontmatter } = target;
		const rawPhotoValue = frontmatter[this.settings.photoProperty];
		const rawPhoto = typeof rawPhotoValue === "string" ? rawPhotoValue : undefined;
		const people = this.index.getSnapshot().people;
		new PersonModal(
			this.app,
			{
				kind: "edit",
				file,
				person,
				rawPhoto,
				personClassification: target.personClassification,
				...(sourceBaseline ? { sourceBaseline } : {}),
			},
			people,
			this.mutations,
			() => this.settings,
			() => this.index.getSnapshot().people,
			this.t,
		).open();
	}

	openCreateRelationship(prefillPersonPath?: string): void {
		if (!this.canWritePeopleAtlasData()) {
			this.noticeRelationshipWritesDisabled();
			return;
		}
		const people = this.index.getSnapshot().people;
		if (prefillPersonPath && !resolveCanonicalPersonByPath(people, prefillPersonPath)) {
			new Notice(this.t.noticePersonUnavailable);
			return;
		}
		const prefill = buildRelationshipCreatePrefill(people, prefillPersonPath, this.settings.myPersonId);
		new RelationshipModal(
			this.app,
			{ kind: "create", ...prefill },
			people,
			this.mutations,
			() => this.settings,
			undefined,
			this.relationshipTemplateCreation(),
			() => this.index.getSnapshot().people,
			(success) => this.offerPartnerParentConfirmation(success),
			this.t,
		).open();
	}

	private offerPartnerParentConfirmation(success: RelationshipCreateSuccess): void {
		const initialCandidate = this.partnerParentCandidateFor(success);
		if (!initialCandidate) return;
		new PartnerParentConfirmationModal(
			this.app,
			initialCandidate,
			() => {
				const currentCandidate = this.partnerParentCandidateFor(success);
				if (!currentCandidate || !samePartnerParentCandidate(initialCandidate, currentCandidate)) return;
				this.openConfirmedPartnerParentEditor(currentCandidate);
			},
			this.t,
		).open();
	}

	private partnerParentCandidateFor(success: RelationshipCreateSuccess) {
		const snapshot = this.index.getSnapshot();
		return planPartnerParentConfirmation({
			people: snapshot.people,
			relationships: snapshot.relationships,
			recentCreate: {
				kind: "create",
				fromPersonPath: success.values.fromPath,
				toPersonPath: success.values.toPath,
				fromRole: success.values.fromRole.trim(),
				toRole: success.values.toRole.trim(),
			},
		});
	}

	private openConfirmedPartnerParentEditor(candidate: PartnerParentCandidate) {
		const people = this.index.getSnapshot().people;
		new RelationshipModal(
			this.app,
			{
				kind: "create",
				fromPersonPath: candidate.partner.filePath,
				toPersonPath: candidate.child.filePath,
				fromRole: "parent",
				toRole: "child",
			},
			people,
			this.mutations,
			() => this.settings,
			undefined,
			this.relationshipTemplateCreation(),
			() => this.index.getSnapshot().people,
			undefined,
			this.t,
		).open();
	}

	openEditCurrentRelationship(): void {
		const file = this.app.workspace.getActiveFile();
		if (
			!(file instanceof TFile) ||
			this.index.getSnapshot().relationships.filter((candidate) => candidate.filePath === file.path).length !== 1
		) {
			new Notice(this.t.noticeNoEditableRelationshipActive);
			return;
		}
		this.openEditRelationship(file.path);
	}

	canOpenRelationship(relationshipPath: string): boolean {
		return this.resolveCanonicalRelationship(relationshipPath) !== undefined;
	}

	async openRelationship(relationshipPath: string): Promise<boolean> {
		const target = this.resolveCanonicalRelationship(relationshipPath);
		if (!target) {
			this.noticeRelationshipUnavailable();
			return false;
		}
		try {
			await this.app.workspace.getLeaf("tab").openFile(target.file);
			return true;
		} catch (error) {
			new Notice(
				this.t.noticeOpenNoteFailed({
					kind: "relationship",
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return false;
		}
	}

	openEditRelationship(relationshipPath: string, onClose?: () => void): boolean {
		if (!this.canWritePeopleAtlasData()) {
			this.noticeRelationshipWritesDisabled();
			return false;
		}
		const target = this.resolveCanonicalRelationship(relationshipPath);
		if (!target) {
			this.noticeRelationshipUnavailable();
			return false;
		}
		const myPersonPath = this.resolveMyPerson()?.filePath;
		new RelationshipModal(
			this.app,
			{
				kind: "edit",
				file: target.file,
				relationship: target.relationship,
				...(myPersonPath ? { myPersonPath } : {}),
			},
			this.index.getSnapshot().people,
			this.mutations,
			() => this.settings,
			onClose,
			this.relationshipTemplateCreation(),
			() => this.index.getSnapshot().people,
			undefined,
			this.t,
		).open();
		return true;
	}

	openLogContact(prefilledPersonPath?: string): boolean {
		if (!this.canWritePeopleAtlasData()) {
			this.noticeContactMomentWritesDisabled();
			return false;
		}
		let canonicalPrefillPath: string | undefined;
		if (prefilledPersonPath) {
			const person = this.resolveCanonicalPerson(prefilledPersonPath);
			if (!person) {
				new Notice(this.t.noticePersonUnavailable);
				return false;
			}
			canonicalPrefillPath = person.person.filePath;
		} else {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile instanceof TFile) {
				canonicalPrefillPath = this.resolveCanonicalPerson(activeFile.path)?.person.filePath;
			}
		}
		const context = this.contactMomentContext();
		new ContactMomentModal(
			this.app,
			{
				kind: "create",
				...(canonicalPrefillPath ? { prefilledPersonPath: canonicalPrefillPath } : {}),
			},
			context,
			this.mutations,
			() => this.settings,
			undefined,
			() => this.contactMomentContext(),
			this.t,
		).open();
		return true;
	}

	openEditCurrentContactMoment(): void {
		const file = this.app.workspace.getActiveFile();
		if (
			!(file instanceof TFile) ||
			(this.index.getSnapshot().contactMoments ?? []).filter((candidate) => candidate.filePath === file.path).length !==
				1
		) {
			new Notice(this.t.noticeNoEditableContactMomentActive);
			return;
		}
		this.openEditContactMoment(file.path);
	}

	openEditContactMoment(contactMomentPath: string, onClose?: () => void): boolean {
		if (!this.canWritePeopleAtlasData()) {
			this.noticeContactMomentWritesDisabled();
			return false;
		}
		const target = this.resolveCanonicalContactMoment(contactMomentPath);
		if (!target) {
			this.noticeContactMomentUnavailable();
			return false;
		}
		return this.openResolvedContactMomentEditor(target, onClose);
	}

	canOpenContactMomentSummary(moment: ContactMomentSummary): boolean {
		return this.resolveCanonicalContactMomentSummary(moment) !== undefined;
	}

	noticeContactMomentActionUnavailable(): void {
		new Notice(this.t.noticeContactMomentActionUnavailable);
	}

	async openContactMomentSummary(moment: ContactMomentSummary): Promise<boolean> {
		const target = this.resolveCanonicalContactMomentSummary(moment);
		if (!target) {
			this.noticeContactMomentUnavailable();
			return false;
		}
		try {
			await this.app.workspace.getLeaf("tab").openFile(target.file);
			return true;
		} catch (error) {
			new Notice(
				this.t.noticeOpenNoteFailed({
					kind: "contact-moment",
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return false;
		}
	}

	canEditContactMomentSummary(moment: ContactMomentSummary): boolean {
		return this.canWritePeopleAtlasData() && this.resolveCanonicalContactMomentSummary(moment) !== undefined;
	}

	openEditContactMomentSummary(moment: ContactMomentSummary, onClose?: () => void): boolean {
		if (!this.canWritePeopleAtlasData()) {
			this.noticeContactMomentWritesDisabled();
			return false;
		}
		const target = this.resolveCanonicalContactMomentSummary(moment);
		if (!target) {
			this.noticeContactMomentUnavailable();
			return false;
		}
		return this.openResolvedContactMomentEditor(target, onClose);
	}

	canUpdateContactMomentFollowUp(moment: ContactMomentSummary): boolean {
		if (
			!this.canWritePeopleAtlasData() ||
			!moment.followUpOn ||
			(moment.followUpStatus !== undefined && moment.followUpStatus !== "open")
		) {
			return false;
		}
		const target = this.resolveCanonicalContactMomentSummary(moment);
		const indexed = this.resolveIndexedContactMomentSummary(moment);
		return Boolean(
			target &&
				indexed?.actionable &&
				indexed.followUpActionable &&
				indexed.followUpOn === moment.followUpOn &&
				indexed.followUpStatus === moment.followUpStatus,
		);
	}

	async updateContactMomentFollowUp(moment: ContactMomentSummary, status: "done" | "dismissed"): Promise<boolean> {
		if (!this.canWritePeopleAtlasData()) {
			this.noticeContactMomentWritesDisabled();
			return false;
		}
		if (!this.canUpdateContactMomentFollowUp(moment) || !moment.followUpOn) {
			new Notice(this.t.noticeFollowUpUnavailable);
			return false;
		}
		try {
			await this.mutations.updateContactMomentFollowUpStatus({
				filePath: moment.filePath,
				contactMomentId: moment.id,
				reviewedPersonIds: [...moment.personIds],
				...(moment.relationshipId ? { reviewedRelationshipId: moment.relationshipId } : {}),
				reviewedOccurredOn: moment.occurredOn,
				reviewedFollowUpOn: moment.followUpOn,
				reviewedFollowUpStatus: moment.followUpStatus === "open" ? "open" : undefined,
				status,
			});
			new Notice(status === "done" ? this.t.noticeFollowUpMarkedDone : this.t.noticeFollowUpDismissed);
			return true;
		} catch (error) {
			new Notice(this.t.noticeFollowUpChangeFailed({ error: error instanceof Error ? error.message : String(error) }));
			return false;
		}
	}

	private openResolvedContactMomentEditor(target: ResolvedCanonicalContactMoment, onClose?: () => void): boolean {
		const context = this.contactMomentContext();
		try {
			new ContactMomentModal(
				this.app,
				{
					kind: "edit",
					file: target.file,
					record: target.contactMoment,
					sourceBaseline: target.sourceBaseline,
				},
				context,
				this.mutations,
				() => this.settings,
				onClose,
				() => this.contactMomentContext(),
				this.t,
			).open();
		} catch (error) {
			new Notice(
				this.t.noticeContactMomentEditUnavailable({ error: error instanceof Error ? error.message : String(error) }),
			);
			return false;
		}
		return true;
	}

	canOpenContactMoment(contactMomentPath: string): boolean {
		return this.resolveCanonicalContactMoment(contactMomentPath) !== undefined;
	}

	async openContactMoment(contactMomentPath: string): Promise<boolean> {
		const target = this.resolveCanonicalContactMoment(contactMomentPath);
		if (!target) {
			this.noticeContactMomentUnavailable();
			return false;
		}
		try {
			await this.app.workspace.getLeaf("tab").openFile(target.file);
			return true;
		} catch (error) {
			new Notice(
				this.t.noticeOpenNoteFailed({
					kind: "contact-moment",
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return false;
		}
	}

	private relationshipTemplateCreation(): RelationshipTemplateCreation {
		return {
			enabled: () => this.canWritePeopleAtlasData(),
			save: async (template) =>
				this.updateSetting("relationshipPresets", [...this.settings.relationshipPresets, template]),
		};
	}

	private renderNoteContextActions(section: HTMLElement, context: MarkdownPostProcessorContext): void {
		if (this.renderedNoteActionDocumentIds.has(context.docId)) return;
		const action = this.resolveNoteContextAction(context.sourcePath);
		if (!action) return;

		const document = section.ownerDocument;
		const panel = document.createElement("div");
		panel.className = "people-atlas-note-actions";
		panel.setAttribute("aria-label", this.t.readingView.actions);
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = action === "person" ? this.t.atlasRenderer.editPerson : this.t.atlasRenderer.editRelationship;
		button.setAttribute("aria-label", button.textContent);
		const addRelationship = action === "person" ? document.createElement("button") : undefined;
		if (addRelationship) {
			addRelationship.type = "button";
			addRelationship.textContent = this.t.readingView.addRelationship;
			addRelationship.setAttribute("aria-label", addRelationship.textContent);
		}
		panel.append(button, ...(addRelationship ? [addRelationship] : []));
		section.append(panel);

		const child = new MarkdownRenderChild(panel);
		child.registerDomEvent(button, "click", () => {
			if (action === "person") void this.openEditPerson(context.sourcePath);
			else this.openEditRelationship(context.sourcePath);
		});
		if (addRelationship) {
			child.registerDomEvent(addRelationship, "click", () => this.openCreateRelationship(context.sourcePath));
		}
		context.addChild(child);
		this.renderedNoteActionDocumentIds.add(context.docId);
		child.register(() => this.renderedNoteActionDocumentIds.delete(context.docId));
	}

	private resolveNoteContextAction(sourcePath: string): "person" | "relationship" | undefined {
		const person = this.resolveCanonicalPerson(sourcePath);
		const relationship = this.resolveCanonicalRelationship(sourcePath);
		if (Boolean(person) === Boolean(relationship)) return undefined;
		return person ? "person" : "relationship";
	}

	private resolveCanonicalRelationship(
		relationshipPath: string,
	): { file: TFile; relationship: RelationshipRecord } | undefined {
		return this.canonicalResolver.resolveRelationship(relationshipPath);
	}

	private resolveCanonicalContactMoment(contactMomentPath: string): ResolvedCanonicalContactMoment | undefined {
		return this.canonicalResolver.resolveContactMoment(contactMomentPath);
	}

	private resolveCanonicalContactMomentSummary(
		moment: ContactMomentSummary,
	): ResolvedCanonicalContactMoment | undefined {
		return this.canonicalResolver.resolveContactMomentSummary(moment);
	}

	private resolveIndexedContactMomentSummary(moment: ContactMomentSummary): ContactMomentRecord | undefined {
		return this.canonicalResolver.resolveIndexedContactMomentSummary(moment);
	}

	private contactMomentContext(): ContactMomentFormContext {
		const snapshot = this.index.getSnapshot();
		return {
			people: snapshot.people,
			relationships: snapshot.relationships,
			resolveLink: (target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
		};
	}

	private resolveCanonicalPerson(personPath: string):
		| {
				file: TFile;
				person: PersonRecord;
				frontmatter: Record<string, unknown>;
				personClassification: "type" | "tag";
		  }
		| undefined {
		return this.canonicalResolver.resolvePerson(personPath);
	}

	private noticePersonWritesDisabled(): void {
		new Notice(this.t.noticePersonWritesReadOnly);
	}

	private noticeRelationshipUnavailable(): void {
		new Notice(this.t.noticeRelationshipUnavailable);
	}

	private noticeRelationshipWritesDisabled(): void {
		new Notice(this.t.noticeRelationshipWritesReadOnly);
	}

	private noticeContactMomentUnavailable(): void {
		new Notice(this.t.noticeContactMomentUnavailable);
	}

	private noticeContactMomentWritesDisabled(): void {
		new Notice(this.t.noticeContactMomentWritesReadOnly);
	}
}

function presetValues(preset: RelationshipPreset): RelationshipPresetSyncChange["after"] {
	return {
		presetId: preset.id,
		types: [...preset.types],
		fromRole: preset.fromRole,
		toRole: preset.toRole,
	};
}
