import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import type { AtlasSnapshot } from "../../src/domain/types";
import { createTranslator } from "../../src/i18n";
import { GraphCanvasSurface } from "../../src/render/graph-canvas-surface";
import { GraphInteractionController } from "../../src/render/graph-interaction-controller";
import { FollowUpPanel } from "../../src/render/follow-up-panel";
import { PersonDetailsPanel } from "../../src/render/person-details-panel";
import { RelationshipDetailsPanel } from "../../src/render/relationship-details-panel";
import { SemanticPeopleList } from "../../src/render/semantic-people-list";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";

const emptySnapshot: AtlasSnapshot = {
	nodes: [],
	edges: [],
	contactMoments: [],
	diagnostics: [],
	hiddenNodeCount: 0,
	hiddenEdgeCount: 0,
	hiddenContactMomentCount: 0,
	generatedAt: 0,
};

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("GraphCanvasSurface", () => {
	it("owns its graph DOM and tears down the owning-window resources", () => {
		const container = document.createElement("div");
		const onLayoutChanged = vi.fn();
		document.body.append(container);

		const surface = new GraphCanvasSurface({
			container,
			getSettings: () => DEFAULT_SETTINGS,
			getSnapshot: () => emptySnapshot,
			getPositions: () => new Map(),
			setPositions: () => undefined,
			getSelectedId: () => undefined,
			onLayoutChanged,
			translator: createTranslator("en"),
		});
		container.append(surface.element);

		expect(surface.element.ownerDocument).toBe(document);
		expect(surface.canvas.ownerDocument).toBe(document);
		expect(surface.graphSurface.ownerDocument).toBe(document);
		expect(surface.canvas.getAttribute("role")).toBe("application");
		expect(surface.element).toContainElement(surface.canvas);

		surface.destroy();

		expect(surface.element.isConnected).toBe(false);
		expect(surface.getPhotoCacheStats()).toMatchObject({ destroyed: true, pending: 0, total: 0 });
		expect(onLayoutChanged).not.toHaveBeenCalled();
	});

	it("lets AtlasRenderer delegate graph refresh to its canvas surface", () => {
		const container = document.createElement("div");
		document.body.append(container);
		const callbacks = {
			onOpenNode: vi.fn(),
			onCenterNode: vi.fn(),
			onSelectNode: vi.fn(),
		} as AtlasRendererCallbacks;
		const refresh = vi.spyOn(GraphCanvasSurface.prototype, "refresh");
		const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks, createTranslator("en"));

		renderer.setGraph(emptySnapshot);

		expect(refresh).toHaveBeenCalledOnce();
		renderer.destroy();
	});

	it("delegates graph interaction lifecycle to its interaction controller", () => {
		const container = document.createElement("div");
		document.body.append(container);
		const callbacks = {
			onOpenNode: vi.fn(),
			onCenterNode: vi.fn(),
			onSelectNode: vi.fn(),
		} as AtlasRendererCallbacks;
		const cancel = vi.spyOn(GraphInteractionController.prototype, "cancel");
		const destroy = vi.spyOn(GraphInteractionController.prototype, "destroy");
		const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks, createTranslator("en"));

		renderer.setGraph(emptySnapshot);
		expect(cancel).toHaveBeenCalled();

		renderer.destroy();
		expect(destroy).toHaveBeenCalledOnce();
	});

	it("gives semantic, detail, relationship and follow-up surfaces explicit DOM owners", () => {
		const semantic = new SemanticPeopleList(document, {
			panelLabel: "List",
			peopleLabel: "People",
			searchLabel: "Search people",
			searchPlaceholder: "Search by name",
			noPeopleLabel: "No people",
			noSearchResultsLabel: "No people found",
			translator: createTranslator("en"),
			getSnapshot: () => emptySnapshot,
			getSelectedId: () => undefined,
			getFocusedId: () => undefined,
			setFocusedId: () => undefined,
			getSummary: () => "0 people",
			onSelectNode: () => undefined,
			onOpenNode: () => undefined,
			onRenderDetails: () => undefined,
		});
		const details = new PersonDetailsPanel(document, {
			label: "Selected person",
			translator: createTranslator("en"),
			getSnapshot: () => emptySnapshot,
			getSelectedId: () => undefined,
			getSettings: () => DEFAULT_SETTINGS,
			getRelationshipRows: () => [],
			renderContactMoments: () => undefined,
			renderRelationshipGroups: () => document.createElement("div"),
		});
		const relationships = new RelationshipDetailsPanel(document, { translator: createTranslator("en") });
		const followUps = new FollowUpPanel(document, {
			panelLabel: "Contact follow-ups",
			heading: "Contact follow-ups",
			translator: createTranslator("en"),
			getContactMoments: () => [],
			getLocalCalendarDay: () => "2025-01-01",
			getHiddenCount: () => 0,
			renderRow: () => document.createElement("li"),
		});
		for (const component of [semantic, details, relationships, followUps]) {
			document.body.append(component.element);
			expect(component.element.ownerDocument).toBe(document);
		}

		semantic.attach();
		semantic.update();
		expect(semantic.summary.textContent).toBe("0 people");
		expect(semantic.emptyMessage.hidden).toBe(false);
		expect(semantic.peopleList.hidden).toBe(true);

		expect(semantic.peopleList.ownerDocument).toBe(document);
		expect(details.element.className).toBe("people-atlas-semantic-details");
		expect(followUps.content.className).toBe("people-atlas-follow-ups-content");

		for (const component of [semantic, details, relationships, followUps]) component.destroy();
		expect(document.body.childElementCount).toBe(0);
	});
});
