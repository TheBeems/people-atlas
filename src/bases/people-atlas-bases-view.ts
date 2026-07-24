import { BasesView, type BasesPropertyId, type QueryController } from "obsidian";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS } from "../constants";
import type { AtlasNode, AtlasSnapshot, IndexDelta, RawIndexSnapshot } from "../domain/types";
import { buildGraphSnapshot } from "../graph/graph-source";
import { applyGraphDelta } from "../graph/graph-delta";
import { projectGraph } from "../graph/project-graph";
import type PeopleAtlasPlugin from "../main";
import { AtlasRenderer } from "../render/atlas-renderer";
import { adaptBasesEntries, type BasesFieldMapping } from "./entry-adapter";
import { BASES_OPTION_KEYS } from "./options";

export class PeopleAtlasBasesView extends BasesView {
	override readonly type = BASES_VIEW_TYPE_PEOPLE_ATLAS;
	private readonly root: HTMLElement;
	private renderer: AtlasRenderer | undefined;
	private unsubscribeIndex: (() => void) | undefined;
	private canonicalSnapshot: RawIndexSnapshot = { people: [], relationships: [], diagnostics: [] };
	private fullSnapshot: AtlasSnapshot | undefined;
	private visiblePaths = new Set<string>();

	constructor(controller: QueryController, parent: HTMLElement, private readonly plugin: PeopleAtlasPlugin) {
		super(controller);
		this.root = parent.ownerDocument.createElement("div");
		this.root.className = "people-atlas-graph people-atlas-bases-view";
		parent.append(this.root);
	}

	override onload(): void {
		this.renderer = new AtlasRenderer(this.root, () => ({
			...this.plugin.settings,
			showLabels: this.readBoolean(BASES_OPTION_KEYS.showLabels, this.plugin.settings.showLabels),
		}), {
			onOpenNode: (node) => this.openNode(node),
			onCenterNode: (node) => {
				if (node.kind === "person") {
					this.config.set(BASES_OPTION_KEYS.centerPersonId, node.id);
					this.onDataUpdated();
				}
			},
			onSelectNode: () => undefined,
		});
		this.unsubscribeIndex = this.plugin.index.subscribe((snapshot, delta) => {
			this.canonicalSnapshot = snapshot;
			this.updateData(delta);
		});
	}

	override onunload(): void {
		this.unsubscribeIndex?.();
		this.renderer?.destroy();
		this.root.remove();
	}

	override onDataUpdated(): void {
		this.updateData();
	}

	private updateData(delta?: IndexDelta): void {
		if (!this.renderer) return;
		const visible = adaptBasesEntries(this.app, this.data.data, this.readMapping());
		const nextVisiblePaths = new Set(visible.people.map((person) => person.filePath));
		const canApplyDelta = Boolean(delta && this.fullSnapshot && setsEqual(this.visiblePaths, nextVisiblePaths));
		const full = canApplyDelta
			? applyGraphDelta(this.fullSnapshot as AtlasSnapshot, delta as IndexDelta, (target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path, {
				resolutionPeople: this.canonicalSnapshot.people,
				visiblePaths: nextVisiblePaths,
			})
			: buildGraphSnapshot(
				{ visible, canonical: this.canonicalSnapshot },
				(target, sourcePath) => this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path,
			);
		this.fullSnapshot = full;
		this.visiblePaths = nextVisiblePaths;
		const center = this.config.get(BASES_OPTION_KEYS.centerPersonId);
		this.renderer.setGraph(projectGraph(full, {
			centerId: typeof center === "string" && center ? center : undefined,
			hops: 2,
			maxNodes: 500,
		}));
	}

	private readMapping(): BasesFieldMapping {
		const settings = this.plugin.settings;
		return {
			name: this.config.getAsPropertyId(BASES_OPTION_KEYS.nameProperty) ?? (`note.${settings.nameProperty}` as BasesPropertyId),
			id: this.config.getAsPropertyId(BASES_OPTION_KEYS.idProperty) ?? (`note.${settings.personIdProperty}` as BasesPropertyId),
			photo: this.config.getAsPropertyId(BASES_OPTION_KEYS.photoProperty) ?? (`note.${settings.photoProperty}` as BasesPropertyId),
			organisations: this.config.getAsPropertyId(BASES_OPTION_KEYS.organisationsProperty) ?? (`note.${settings.organisationsProperty}` as BasesPropertyId),
			contacts: this.config.getAsPropertyId(BASES_OPTION_KEYS.contactsProperty) ?? (`note.${settings.contactsProperty}` as BasesPropertyId),
		};
	}

	private readBoolean(key: string, fallback: boolean): boolean {
		const value = this.config.get(key);
		return typeof value === "boolean" ? value : fallback;
	}

	private openNode(node: AtlasNode): void {
		if (!node.filePath) return;
		const file = this.data.data.find((entry) => entry.file.path === node.filePath)?.file;
		if (file) void this.app.workspace.getLeaf("tab").openFile(file);
	}
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
	if (left.size !== right.size) return false;
	for (const value of left) if (!right.has(value)) return false;
	return true;
}
