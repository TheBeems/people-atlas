export interface EventRef {
	unload(): void;
}

type EventCallback = (...args: unknown[]) => void;

class ControlledEventSource {
	private readonly handlers = new Map<string, Set<EventCallback>>();

	on(name: string, callback: EventCallback): EventRef {
		const callbacks = this.handlers.get(name) ?? new Set<EventCallback>();
		callbacks.add(callback);
		this.handlers.set(name, callbacks);
		let active = true;
		return {
			unload: () => {
				if (!active) return;
				active = false;
				callbacks.delete(callback);
				if (callbacks.size === 0) this.handlers.delete(name);
			},
		};
	}

	emit(name: string, ...args: unknown[]): void {
		for (const callback of [...(this.handlers.get(name) ?? [])]) callback(...args);
	}

	offref(ref: EventRef): void {
		ref.unload();
	}

	listenerCount(name?: string): number {
		if (name) return this.handlers.get(name)?.size ?? 0;
		return [...this.handlers.values()].reduce((total, callbacks) => total + callbacks.size, 0);
	}
}

export function getAllTags(cache: { tags?: Array<{ tag: string }> } | null): string[] {
	const inlineTags = cache?.tags?.map((tag) => tag.tag) ?? [];
	const frontmatterTags = parseFrontMatterTags((cache as { frontmatter?: unknown } | null)?.frontmatter) ?? [];
	return [...inlineTags, ...frontmatterTags];
}

export function parseFrontMatterTags(frontmatter: unknown): string[] | null {
	if (!frontmatter || typeof frontmatter !== "object") return null;
	const value = (frontmatter as Record<string, unknown>).tags ?? (frontmatter as Record<string, unknown>).tag;
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") {
		const tags = value
			.replace(/^\[|\]$/g, "")
			.split(/[\s,]+/)
			.map((tag) => tag.replace(/^['"]|['"]$/g, ""))
			.filter(Boolean);
		return tags.length > 0 ? tags : null;
	}
	return null;
}

export function parseYaml(yaml: string): Record<string, unknown> {
	const frontmatter: Record<string, unknown> = {};
	const lines = yaml.split(/\r?\n/);
	for (let index = 0; index < lines.length; index += 1) {
		const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(lines[index] ?? "");
		if (!match?.[1]) continue;
		const key = match[1];
		const raw = match[2]?.trim() ?? "";
		if (raw) {
			frontmatter[key] = raw.replace(/^['"]|['"]$/g, "");
			continue;
		}
		const values: string[] = [];
		while (/^\s+-\s+/.test(lines[index + 1] ?? "")) {
			index += 1;
			values.push((lines[index] ?? "").replace(/^\s+-\s+/, "").replace(/^['"]|['"]$/g, ""));
		}
		frontmatter[key] = values;
	}
	return frontmatter;
}

export class TFile {
	path = "";
	extension = "md";
	basename = "";
	stat = { ctime: 0, mtime: 0, size: 0 };

	constructor(path = "") {
		if (path) this.setPath(path);
	}

	setPath(path: string): void {
		this.path = path;
		const filename = path.split("/").at(-1) ?? "";
		const extensionIndex = filename.lastIndexOf(".");
		this.extension = extensionIndex >= 0 ? filename.slice(extensionIndex + 1) : "";
		this.basename = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename;
	}
}

export class Component {
	private readonly eventRefs = new Set<EventRef>();
	private readonly callbacks = new Set<() => unknown>();
	private readonly children = new Set<Component>();
	private loaded = false;

	async load(): Promise<void> {
		if (this.loaded) throw new Error(`${this.constructor.name} is already loaded.`);
		this.loaded = true;
		await this.onload();
		for (const child of this.children) {
			if (!child.isLoaded()) await child.load();
		}
	}

	onload(): Promise<void> | void {}

	async unload(): Promise<void> {
		if (!this.loaded) throw new Error(`${this.constructor.name} is not loaded.`);
		await this.onunload();
		for (const child of [...this.children].reverse()) {
			if (child.isLoaded()) await child.unload();
		}
		this.children.clear();
		for (const eventRef of [...this.eventRefs].reverse()) eventRef.unload();
		this.eventRefs.clear();
		for (const callback of [...this.callbacks].reverse()) callback();
		this.callbacks.clear();
		this.loaded = false;
	}

	onunload(): Promise<void> | void {}

	addChild<T extends Component>(component: T): T {
		if (this.children.has(component)) throw new Error("Component child is already registered.");
		this.children.add(component);
		if (this.loaded && !component.isLoaded()) void component.load();
		return component;
	}

	removeChild<T extends Component>(component: T): T {
		if (!this.children.delete(component)) throw new Error("Component child is not registered.");
		if (component.isLoaded()) void component.unload();
		return component;
	}

	register(callback: () => unknown): void {
		this.callbacks.add(callback);
	}

	registerEvent<T extends EventRef>(eventRef: T): void {
		this.eventRefs.add(eventRef);
	}

	registerDomEvent(
		element: EventTarget,
		type: string,
		callback: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void {
		element.addEventListener(type, callback, options);
		this.register(() => element.removeEventListener(type, callback, options));
	}

	isLoaded(): boolean {
		return this.loaded;
	}

	get registeredEventCount(): number {
		return this.eventRefs.size;
	}

	get registeredCleanupCount(): number {
		return this.callbacks.size;
	}

	get childCount(): number {
		return this.children.size;
	}
}

interface ControlledApp {
	vault: ControlledVault;
	metadataCache: ControlledMetadataCache;
	workspace: ControlledWorkspace;
	fileManager: {
		processFrontMatter(file: TFile, callback: (frontmatter: Record<string, unknown>) => void): Promise<void>;
		renameFile(file: TFile, newPath: string): Promise<void>;
	};
	__runtime: ControlledObsidianRuntime;
}

interface ViewRegistration {
	factory(leaf: ControlledWorkspaceLeaf): ItemView;
}

interface BasesRegistration {
	name: string;
	icon: string;
	factory(controller: ControlledQueryController, containerEl: HTMLElement): BasesView;
	options(): unknown[];
}

interface CommandRegistration {
	id: string;
	name: string;
	callback?: () => unknown;
}

export class Plugin extends Component {
	app: ControlledApp;
	manifest: Record<string, unknown>;
	settings?: unknown;

	constructor(app: ControlledApp, manifest: Record<string, unknown>) {
		super();
		this.app = app;
		this.manifest = manifest;
	}

	addRibbonIcon(icon: string, title: string, callback: (event: MouseEvent) => void): HTMLElement {
		const element = this.app.__runtime.document.createElement("button");
		element.dataset.icon = icon;
		element.title = title;
		element.addEventListener("click", callback);
		this.app.__runtime.ribbonItems.add(element);
		this.register(() => {
			element.removeEventListener("click", callback);
			element.remove();
			this.app.__runtime.ribbonItems.delete(element);
		});
		return element;
	}

	addCommand(command: CommandRegistration): CommandRegistration {
		if (this.app.__runtime.commands.has(command.id)) throw new Error(`Command is already registered: ${command.id}`);
		this.app.__runtime.commands.set(command.id, command);
		this.register(() => this.app.__runtime.commands.delete(command.id));
		return command;
	}

	addSettingTab(settingTab: PluginSettingTab): void {
		this.app.__runtime.settingTabs.add(settingTab);
		this.register(() => this.app.__runtime.settingTabs.delete(settingTab));
	}

	registerView(type: string, factory: (leaf: ControlledWorkspaceLeaf) => ItemView): void {
		this.app.__runtime.registerView(type, { factory });
		this.register(() => this.app.__runtime.unregisterView(type));
	}

	registerBasesView(type: string, registration: BasesRegistration): boolean {
		this.app.__runtime.registerBasesView(type, registration);
		this.register(() => this.app.__runtime.unregisterBasesView(type));
		return true;
	}

	registerEditorSuggest(editorSuggest: EditorSuggest<unknown>): void {
		this.app.__runtime.editorSuggests.add(editorSuggest);
		this.register(() => this.app.__runtime.editorSuggests.delete(editorSuggest));
	}

	loadData(): Promise<unknown> {
		return Promise.resolve(structuredClone(this.app.__runtime.pluginData));
	}

	saveData(data: unknown): Promise<void> {
		this.app.__runtime.pluginData = structuredClone(data);
		this.app.__runtime.savedPluginData.push(structuredClone(data));
		return Promise.resolve();
	}
}

export class ItemView extends Component {
	app: ControlledApp;
	contentEl: HTMLElement;
	leaf: ControlledWorkspaceLeaf;

	constructor(leaf: ControlledWorkspaceLeaf) {
		super();
		this.leaf = leaf;
		this.app = leaf.app;
		this.contentEl = leaf.contentEl;
	}

	override async onload(): Promise<void> {
		await this.onOpen();
	}

	override async onunload(): Promise<void> {
		await this.onClose();
	}

	onOpen(): Promise<void> | void {}
	onClose(): Promise<void> | void {}

	getViewType(): string {
		return "";
	}

	getDisplayText(): string {
		return "";
	}

	getIcon(): string {
		return "";
	}
}

export class ControlledBasesViewConfig {
	readonly values = new Map<string, unknown>();

	constructor(public name: string) {}

	get(key: string): unknown {
		return this.values.get(key);
	}

	getAsPropertyId(key: string): string | null {
		const value = this.values.get(key);
		return typeof value === "string" && value.trim() ? value : null;
	}

	set(key: string, value: unknown): void {
		if (value === null) this.values.delete(key);
		else this.values.set(key, value);
	}
}

export class ControlledQueryController {
	readonly config: ControlledBasesViewConfig;
	readonly data: { data: ControlledBasesEntry[] };

	constructor(
		readonly app: ControlledApp,
		entries: ControlledBasesEntry[],
		name = "People",
	) {
		this.config = new ControlledBasesViewConfig(name);
		this.data = { data: entries };
	}

	setEntries(entries: ControlledBasesEntry[]): void {
		this.data.data.splice(0, this.data.data.length, ...entries);
	}
}

export class BasesView extends Component {
	readonly app: ControlledApp;
	readonly config: ControlledBasesViewConfig;
	readonly data: { data: ControlledBasesEntry[] };
	readonly allProperties: string[] = [];

	constructor(controller: ControlledQueryController) {
		super();
		this.app = controller.app;
		this.config = controller.config;
		this.data = controller.data;
	}

	onDataUpdated(): void {}
}

export class EditorSuggest<T> extends Component {
	context: { value?: T } | undefined;
	limit = 100;
	readonly app: ControlledApp;
	readonly instructions: Array<{ command: string; purpose: string }> = [];

	constructor(app: ControlledApp) {
		super();
		this.app = app;
	}

	setInstructions(instructions: Array<{ command: string; purpose: string }>): void {
		this.instructions.splice(0, this.instructions.length, ...instructions);
	}
}

export class PluginSettingTab extends Component {
	constructor(
		readonly app: ControlledApp,
		readonly plugin: Plugin,
	) {
		super();
	}

	getControlValue(_key: string): unknown {
		return undefined;
	}

	setControlValue(_key: string, _value: unknown): void {}

	getSettingDefinitions(): unknown[] {
		return [];
	}
}

export class ControlledValue {
	constructor(private readonly value: string) {}

	isTruthy(): boolean {
		return Boolean(this.value);
	}

	toString(): string {
		return this.value;
	}
}

export class StringValue extends ControlledValue {}

export class NumberValue extends ControlledValue {
	constructor(value: number) {
		super(String(value));
	}
}

export class DateValue extends ControlledValue {
	static parseFromString(input: string): DateValue | null {
		return input ? new DateValue(input) : null;
	}
}

export class ListValue extends ControlledValue {
	private readonly values: ControlledValue[];

	constructor(values: Array<string | ControlledValue> = []) {
		const normalized = values.map((value) => (typeof value === "string" ? new StringValue(value) : value));
		super(normalized.map((value) => value.toString()).join(", "));
		this.values = normalized;
	}

	length(): number {
		return this.values.length;
	}

	get(index: number): ControlledValue {
		const value = this.values[index];
		if (!value) throw new Error(`ListValue index is out of range: ${index}`);
		return value;
	}
}

export class ControlledBasesEntry {
	readonly values = new Map<string, ControlledValue | ListValue>();

	constructor(
		readonly file: TFile,
		values: Record<string, string | string[]>,
	) {
		for (const [key, value] of Object.entries(values)) {
			this.values.set(key, Array.isArray(value) ? new ListValue(value) : new StringValue(value));
		}
	}

	getValue(property: string): ControlledValue | ListValue | null {
		return this.values.get(property) ?? null;
	}
}

export class Modal {
	app: unknown;
	containerEl = {} as HTMLElement;
	modalEl = {} as HTMLElement;
	titleEl = {} as HTMLElement;
	contentEl = {} as HTMLElement;

	constructor(app: unknown) {
		this.app = app;
	}

	open(): void {}
	close(): void {}
}

export const notices: string[] = [];

export class Notice {
	constructor(message: string) {
		notices.push(message);
	}
}

class ControlledVault extends ControlledEventSource {
	readonly files = new Map<string, TFile>();
	markdownScanCount = 0;

	getFiles(): TFile[] {
		return [...this.files.values()];
	}

	getMarkdownFiles(): TFile[] {
		this.markdownScanCount += 1;
		return [...this.files.values()].filter((file) => file.extension === "md");
	}

	getAbstractFileByPath(path: string): TFile | undefined {
		return this.files.get(path);
	}

	getResourcePath(file: TFile): string {
		return `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==#${file.stat.mtime}:${file.stat.size}`;
	}
}

class ControlledMetadataCache extends ControlledEventSource {
	readonly caches = new Map<string, { frontmatter?: Record<string, unknown>; tags?: Array<{ tag: string }> }>();
	readonly linkDestinations = new Map<string, string>();
	resolvedLinks: Record<string, Record<string, number>> = {};
	private readonly vault: ControlledVault;

	constructor(vault: ControlledVault) {
		super();
		this.vault = vault;
	}

	getFileCache(file: TFile): { frontmatter?: Record<string, unknown>; tags?: Array<{ tag: string }> } | null {
		return this.caches.get(file.path) ?? null;
	}

	getFirstLinkpathDest(target: string, sourcePath: string): TFile | null {
		const path = this.linkDestinations.get(`${sourcePath}\u0000${target}`);
		return path ? (this.vault.files.get(path) ?? null) : null;
	}

	setLinkDestination(sourcePath: string, target: string, targetPath: string): void {
		this.linkDestinations.set(`${sourcePath}\u0000${target}`, targetPath);
		this.resolvedLinks[sourcePath] = {
			...(this.resolvedLinks[sourcePath] ?? {}),
			[targetPath]: 1,
		};
	}

	renameSource(oldPath: string, newPath: string): void {
		for (const [key, targetPath] of [...this.linkDestinations]) {
			const separator = key.indexOf("\u0000");
			if (key.slice(0, separator) !== oldPath) continue;
			const target = key.slice(separator + 1);
			this.linkDestinations.delete(key);
			this.linkDestinations.set(`${newPath}\u0000${target}`, targetPath);
		}
		if (this.resolvedLinks[oldPath]) {
			this.resolvedLinks[newPath] = this.resolvedLinks[oldPath];
			delete this.resolvedLinks[oldPath];
		}
	}
}

export class ControlledWorkspaceLeaf {
	view: ItemView | undefined;
	readonly contentEl: HTMLElement;

	constructor(
		readonly app: ControlledApp,
		readonly document: Document,
	) {
		this.contentEl = document.createElement("div");
		this.contentEl.className = "controlled-workspace-leaf";
		document.body.append(this.contentEl);
	}

	async setViewState(state: { type: string }): Promise<void> {
		const view = this.app.__runtime.createStandaloneView(state.type, this);
		await view.load();
	}

	async openFile(file: TFile): Promise<void> {
		this.app.__runtime.openedPaths.push(file.path);
		this.app.workspace.setActiveFile(file);
	}
}

class ControlledWorkspace extends ControlledEventSource {
	private readonly layoutReadyCallbacks = new Set<() => void>();
	private activeFile: TFile | null = null;
	layoutReady = false;

	constructor(private readonly runtime: ControlledObsidianRuntime) {
		super();
	}

	onLayoutReady(callback: () => void): void {
		if (this.layoutReady) {
			callback();
			return;
		}
		this.layoutReadyCallbacks.add(callback);
	}

	triggerLayoutReady(): void {
		if (this.layoutReady) return;
		this.layoutReady = true;
		const callbacks = [...this.layoutReadyCallbacks];
		this.layoutReadyCallbacks.clear();
		for (const callback of callbacks) callback();
	}

	getActiveFile(): TFile | null {
		return this.activeFile;
	}

	setActiveFile(file: TFile | null): void {
		this.activeFile = file;
		this.emit("active-leaf-change", file ? this.runtime.findLeafForFile(file) : null);
	}

	getLeavesOfType(type: string): ControlledWorkspaceLeaf[] {
		return this.runtime.leaves.filter((leaf) => leaf.view?.constructor && leaf.view.getViewType?.() === type);
	}

	getLeaf(_kind: string): ControlledWorkspaceLeaf {
		return new ControlledWorkspaceLeaf(this.runtime.app, this.runtime.document);
	}

	async revealLeaf(_leaf: ControlledWorkspaceLeaf): Promise<void> {}

	get pendingLayoutReadyCount(): number {
		return this.layoutReadyCallbacks.size;
	}
}

export class ControlledObsidianRuntime {
	readonly document: Document;
	readonly vault = new ControlledVault();
	readonly metadataCache = new ControlledMetadataCache(this.vault);
	readonly workspace = new ControlledWorkspace(this);
	readonly viewRegistrations = new Map<string, ViewRegistration>();
	readonly basesRegistrations = new Map<string, BasesRegistration>();
	readonly commands = new Map<string, CommandRegistration>();
	readonly ribbonItems = new Set<HTMLElement>();
	readonly settingTabs = new Set<PluginSettingTab>();
	readonly editorSuggests = new Set<EditorSuggest<unknown>>();
	readonly leaves: ControlledWorkspaceLeaf[] = [];
	readonly basesViews: BasesView[] = [];
	readonly openedPaths: string[] = [];
	readonly savedPluginData: unknown[] = [];
	pluginData: unknown = null;
	readonly app: ControlledApp;

	constructor(document: Document) {
		this.document = document;
		this.app = {
			vault: this.vault,
			metadataCache: this.metadataCache,
			workspace: this.workspace,
			fileManager: {
				processFrontMatter: async (file, callback) => {
					const cache = this.metadataCache.caches.get(file.path) ?? {};
					const frontmatter = { ...(cache.frontmatter ?? {}) };
					callback(frontmatter);
					this.metadataCache.caches.set(file.path, { ...cache, frontmatter });
				},
				renameFile: async (file, newPath) => {
					this.renameFile(file.path, newPath);
				},
			},
			__runtime: this,
		};
	}

	seedFile(path: string, frontmatter: Record<string, unknown> = {}): TFile {
		if (this.vault.files.has(path)) throw new Error(`Controlled vault path already exists: ${path}`);
		const file = new TFile(path);
		this.vault.files.set(path, file);
		this.metadataCache.caches.set(path, { frontmatter: structuredClone(frontmatter) });
		return file;
	}

	createFile(path: string, frontmatter: Record<string, unknown> = {}): TFile {
		const file = this.seedFile(path, frontmatter);
		this.vault.emit("create", file);
		return file;
	}

	changeMetadata(path: string, frontmatter: Record<string, unknown>): void {
		const file = this.requireFile(path);
		this.metadataCache.caches.set(path, { frontmatter: structuredClone(frontmatter) });
		this.metadataCache.emit("changed", file, "", this.metadataCache.getFileCache(file));
	}

	modifyFile(path: string): void {
		const file = this.requireFile(path);
		file.stat.mtime += 1;
		this.vault.emit("modify", file);
	}

	resolveLink(sourcePath: string, target: string, targetPath: string): void {
		const file = this.requireFile(targetPath);
		this.metadataCache.setLinkDestination(sourcePath, target, targetPath);
		this.metadataCache.emit("resolve", file);
	}

	renameFile(oldPath: string, newPath: string): TFile {
		if (this.vault.files.has(newPath)) throw new Error(`Controlled vault path already exists: ${newPath}`);
		const file = this.requireFile(oldPath);
		const cache = this.metadataCache.caches.get(oldPath);
		this.vault.files.delete(oldPath);
		this.metadataCache.caches.delete(oldPath);
		file.setPath(newPath);
		this.vault.files.set(newPath, file);
		if (cache) this.metadataCache.caches.set(newPath, cache);
		this.metadataCache.renameSource(oldPath, newPath);
		this.vault.emit("rename", file, oldPath);
		return file;
	}

	deleteFile(path: string): TFile {
		const file = this.requireFile(path);
		this.vault.files.delete(path);
		this.metadataCache.caches.delete(path);
		this.vault.emit("delete", file);
		return file;
	}

	emitVault(name: string, ...args: unknown[]): void {
		this.vault.emit(name, ...args);
	}

	emitMetadata(name: string, ...args: unknown[]): void {
		this.metadataCache.emit(name, ...args);
	}

	triggerLayoutReady(): void {
		this.workspace.triggerLayoutReady();
	}

	createBasesEntry(file: TFile, values: Record<string, string | string[]>): ControlledBasesEntry {
		return new ControlledBasesEntry(file, values);
	}

	registerView(type: string, registration: ViewRegistration): void {
		if (this.viewRegistrations.has(type)) throw new Error(`View is already registered: ${type}`);
		this.viewRegistrations.set(type, registration);
	}

	unregisterView(type: string): void {
		this.viewRegistrations.delete(type);
	}

	registerBasesView(type: string, registration: BasesRegistration): void {
		if (this.basesRegistrations.has(type)) throw new Error(`Bases view is already registered: ${type}`);
		this.basesRegistrations.set(type, registration);
	}

	unregisterBasesView(type: string): void {
		this.basesRegistrations.delete(type);
	}

	createStandaloneView(type: string, leaf = new ControlledWorkspaceLeaf(this.app, this.document)): ItemView {
		const registration = this.viewRegistrations.get(type);
		if (!registration) throw new Error(`No controlled standalone view registration exists for: ${type}`);
		const view = registration.factory(leaf);
		leaf.view = view;
		if (!this.leaves.includes(leaf)) this.leaves.push(leaf);
		return view;
	}

	async openStandaloneView(type: string): Promise<{ leaf: ControlledWorkspaceLeaf; view: ItemView }> {
		const leaf = new ControlledWorkspaceLeaf(this.app, this.document);
		const view = this.createStandaloneView(type, leaf);
		await view.load();
		return { leaf, view };
	}

	async openBasesView(
		type: string,
		entries: ControlledBasesEntry[],
		name = "People",
	): Promise<{ parent: HTMLElement; controller: ControlledQueryController; view: BasesView }> {
		const registration = this.basesRegistrations.get(type);
		if (!registration) throw new Error(`No controlled Bases view registration exists for: ${type}`);
		const parent = this.document.createElement("div");
		parent.className = "controlled-bases-parent";
		this.document.body.append(parent);
		const controller = new ControlledQueryController(this.app, entries, name);
		const view = registration.factory(controller, parent);
		this.basesViews.push(view);
		await view.load();
		return { parent, controller, view };
	}

	listenerCount(source: "vault" | "metadataCache" | "workspace", name?: string): number {
		return this[source].listenerCount(name);
	}

	private requireFile(path: string): TFile {
		const file = this.vault.files.get(path);
		if (!file) throw new Error(`Controlled vault path does not exist: ${path}`);
		return file;
	}

	findLeafForFile(_file: TFile): ControlledWorkspaceLeaf | null {
		return null;
	}
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}
