import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { AtlasEdge, AtlasNode, AtlasSnapshot } from "../../src/domain/types";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";

const alice: AtlasNode = {
	id: "person-alice",
	personId: "person-alice",
	kind: "person",
	label: "Alice",
	filePath: "People/Alice.md",
	organisations: ["Example Org"],
	isCenter: true,
};

const bob: AtlasNode = {
	id: "person-bob",
	personId: "person-bob",
	kind: "person",
	label: "Bob",
	filePath: "People/Bob.md",
	organisations: [],
	isCenter: false,
};

const charlie: AtlasNode = {
	id: "person-charlie",
	personId: "person-charlie",
	kind: "person",
	label: "Charlie",
	filePath: "People/Charlie.md",
	organisations: [],
	isCenter: false,
};

const ghost: AtlasNode = {
	id: "ghost:Missing",
	kind: "ghost",
	label: "Missing",
	organisations: [],
	isCenter: false,
};

const nonOpenable: AtlasNode = {
	id: "person-no-note",
	personId: "person-no-note",
	kind: "person",
	label: "No note",
	organisations: [],
	isCenter: false,
};

const ambiguous: AtlasNode = {
	id: "ambiguous:duplicate-alice",
	personId: "duplicate-person",
	kind: "person",
	label: "Ambiguous Alice",
	filePath: "People/Ambiguous Alice.md",
	organisations: [],
	isCenter: true,
};

const baseOnly: AtlasNode = {
	id: "base-only-stable-id",
	kind: "person",
	label: "Base-only person",
	filePath: "People/Base only.md",
	organisations: [],
	isCenter: false,
};

const edges: AtlasEdge[] = [
	{
		id: "relationship-friends",
		sourceId: alice.id,
		targetId: bob.id,
		types: ["friend", "colleague"],
		direction: "undirected",
		status: "active",
		since: "2020-01-02",
		lastContact: "2026-07-20",
		filePath: "People/Relationships/Alice - Bob.md",
		inferred: false,
	},
	{
		id: "relationship-mentor",
		sourceId: charlie.id,
		targetId: alice.id,
		types: ["mentor"],
		direction: "source-to-target",
		status: "dormant",
		inferred: false,
	},
	{
		id: "contact-missing",
		sourceId: alice.id,
		targetId: ghost.id,
		types: ["contact"],
		direction: "undirected",
		inferred: true,
	},
	{
		id: "relationship-parallel",
		sourceId: alice.id,
		targetId: bob.id,
		types: ["neighbour"],
		direction: "source-to-target",
		status: "ended",
		inferred: false,
	},
];

function snapshot(nodes: AtlasNode[], graphEdges: AtlasEdge[] = []): AtlasSnapshot {
	return {
		nodes,
		edges: graphEdges,
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		generatedAt: 1,
	};
}

function mount(graph = snapshot([alice, ghost, charlie], edges)): {
	renderer: AtlasRenderer;
	callbacks: {
		onOpenNode: ReturnType<typeof vi.fn>;
		onCenterNode: ReturnType<typeof vi.fn>;
		onSelectNode: ReturnType<typeof vi.fn>;
		onLayoutChanged: ReturnType<typeof vi.fn>;
	};
} {
	const container = document.createElement("div");
	container.className = "people-atlas-graph";
	container.style.width = "640px";
	container.style.height = "480px";
	document.body.append(container);
	const callbacks = {
		onOpenNode: vi.fn(),
		onCenterNode: vi.fn(),
		onSelectNode: vi.fn(),
		onLayoutChanged: vi.fn(),
	};
	const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks as AtlasRendererCallbacks);
	renderer.setGraph(graph);
	return { renderer, callbacks };
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("accessible atlas renderer", () => {
	it("switches one surface without layout persistence and synchronizes canvas/list selection", async () => {
		const { renderer, callbacks } = mount();
		const graphMode = page.getByRole("button", { name: "Graph" });
		const listMode = page.getByRole("button", { name: "List" });
		const canvas = page.getByRole("application", { name: "Interactive people and relationship atlas" });
		const canvasElement = canvas.element() as HTMLCanvasElement;

		await expect.element(graphMode).toHaveAttribute("aria-pressed", "true");
		await expect.element(listMode).toHaveAttribute("aria-pressed", "false");
		expect(canvasElement.hidden).toBe(false);
		expect(document.querySelector<HTMLElement>(".people-atlas-semantic-panel")?.hidden).toBe(true);

		const layoutBefore = renderer.getLayoutSnapshot();
		await listMode.click();

		await expect.element(listMode).toHaveAttribute("aria-pressed", "true");
		expect(canvasElement.hidden).toBe(true);
		expect(document.querySelector<HTMLElement>(".people-atlas-semantic-panel")?.hidden).toBe(false);
		expect(renderer.getLayoutSnapshot()).toEqual(layoutBefore);
		expect(callbacks.onLayoutChanged).not.toHaveBeenCalled();
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();

		await graphMode.click();
		const box = canvasElement.getBoundingClientRect();
		await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
		await listMode.click();

		await expect.element(page.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Alice, Example Org" })).toHaveAttribute("aria-pressed", "true");
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(alice, "canvas");
	});

	it("uses one roving tab stop and implements every specified list key", async () => {
		const { callbacks } = mount();
		await page.getByRole("button", { name: "List" }).click();
		const aliceButton = page.getByRole("button", { name: "Alice, Example Org" });
		const ghostButton = page.getByRole("button", { name: "Missing, unresolved person" });
		const charlieButton = page.getByRole("button", { name: "Charlie" });

		expect(document.querySelectorAll(".people-atlas-person-button[tabindex='0']")).toHaveLength(1);
		await aliceButton.click();
		await userEvent.keyboard("{ArrowDown}");
		await expect.element(ghostButton).toHaveFocus();
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(ghost, "list");
		await userEvent.keyboard("{Enter}");
		expect(callbacks.onOpenNode).not.toHaveBeenCalled();
		await expect.element(page.getByText("No note is available for this unresolved person.")).toBeInTheDocument();

		await userEvent.keyboard("{End}");
		await expect.element(charlieButton).toHaveFocus();
		await userEvent.keyboard("{ArrowDown}");
		await expect.element(charlieButton).toHaveFocus();
		await userEvent.keyboard("{Home}");
		await expect.element(aliceButton).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		expect(callbacks.onOpenNode).toHaveBeenCalledOnce();
		expect(callbacks.onOpenNode).toHaveBeenCalledWith(alice);

		await userEvent.keyboard("{End}");
		await userEvent.keyboard(" ");
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(charlie, "list");
		await userEvent.keyboard("{Escape}");
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(undefined, "list");
		await expect.element(charlieButton).toHaveFocus();
		expect((charlieButton.element() as HTMLButtonElement).tabIndex).toBe(0);
		await userEvent.keyboard("{ArrowUp}");
		await expect.element(ghostButton).toHaveFocus();
		await userEvent.keyboard("{ArrowUp}");
		await expect.element(aliceButton).toHaveFocus();
	});

	it("describes ordered parallel, directional and inferred relationships without inventing metadata", async () => {
		mount(snapshot([alice, bob, charlie, ghost], edges));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org" }).click();

		const relationshipItems = Array.from(document.querySelectorAll(".people-atlas-relationship-list > li")).map((item) => item.textContent);
		expect(relationshipItems).toEqual([
			"Connected to Bob. Types: friend, colleague. Status: active. Since: 2020-01-02. Last contact: 2026-07-20.",
			"Incoming from Charlie. Types: mentor. Status: dormant.",
			"Connected to Missing (unresolved). Types: contact. Contact-link connection.",
			"Outgoing to Bob. Types: neighbour. Status: ended.",
		]);

		await expect.element(page.getByText("4 people · 4 relationships")).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Open note" })).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Use as center" })).toBeInTheDocument();
	});

	it("delegates resolved actions and keeps ghosts selectable without capabilities", async () => {
		const { callbacks } = mount(snapshot([alice, ghost, nonOpenable]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org" }).click();
		const openAction = page.getByRole("button", { name: "Open note" });
		const centerAction = page.getByRole("button", { name: "Use as center" });
		await openAction.click();
		await expect.element(openAction).toHaveFocus();
		await centerAction.click();
		await expect.element(centerAction).toHaveFocus();
		expect(callbacks.onOpenNode).toHaveBeenCalledWith(alice);
		expect(callbacks.onCenterNode).toHaveBeenCalledWith(alice);
		expect((centerAction.element() as HTMLButtonElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(24);

		await page.getByRole("button", { name: "Missing, unresolved person" }).click();
		expect(document.querySelector("button[aria-label='Open note']")).toBeNull();
		expect(document.querySelector("button[aria-label='Use as center']")).toBeNull();
		await expect.element(page.getByText("No note is available for this unresolved person.")).toBeInTheDocument();

		await page.getByRole("button", { name: "No note" }).click();
		expect(document.querySelector("button[aria-label='Open note']")).toBeNull();
		expect(document.querySelector("button[aria-label='Use as center']")).toBeNull();
		await expect.element(page.getByText("No note is available for this person.")).toBeInTheDocument();
	});

	it("denies every ambiguous capability while retaining stable Base-only Open and Center", async () => {
		const { callbacks } = mount(snapshot([ambiguous, baseOnly]));
		await page.getByRole("button", { name: "List" }).click();
		const ambiguousButton = document.querySelector<HTMLButtonElement>("[data-node-id='ambiguous:duplicate-alice']");
		expect(ambiguousButton).not.toBeNull();
		await userEvent.click(ambiguousButton as HTMLButtonElement);
		await userEvent.keyboard("{Enter}");
		expect(callbacks.onOpenNode).not.toHaveBeenCalled();
		expect(document.querySelector("button[aria-label='Open note']")).toBeNull();
		expect(document.querySelector("button[aria-label='Use as center']")).toBeNull();
		await expect.element(page.getByText("This person record is ambiguous and cannot be opened or centered.")).toBeInTheDocument();

		await page.getByRole("button", { name: "Graph" }).click();
		const canvas = page.getByRole("application", { name: "Interactive people and relationship atlas" });
		const box = (canvas.element() as HTMLCanvasElement).getBoundingClientRect();
		const center = { x: box.width / 2, y: box.height / 2 };
		await canvas.dblClick({ position: center });
		await canvas.dblClick({ position: center, modifiers: ["Shift"] });
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();
		expect(callbacks.onOpenNode).not.toHaveBeenCalled();

		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Base-only person" }).click();
		await page.getByRole("button", { name: "Open note" }).click();
		await page.getByRole("button", { name: "Use as center" }).click();
		expect(callbacks.onOpenNode).toHaveBeenCalledWith(baseOnly);
		expect(callbacks.onCenterNode).toHaveBeenCalledWith(baseOnly);
	});

	it("preserves an explicitly restored zero-offset camera through List and Graph", async () => {
		const { renderer } = mount(snapshot([alice]));
		renderer.setGraph(snapshot([alice]), {
			positions: { [alice.id]: { x: 10, y: 20 } },
			camera: { x: 0, y: 0, scale: 2 },
		});
		const restored = renderer.getLayoutSnapshot();
		const restoredCamera = { x: restored.camera.x, y: restored.camera.y, scale: restored.camera.scale };
		expect(restoredCamera).toEqual({ x: 0, y: 0, scale: 2 });

		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Graph" }).click();

		const afterRoundTrip = renderer.getLayoutSnapshot();
		expect({
			positions: afterRoundTrip.positions,
			camera: { x: afterRoundTrip.camera.x, y: afterRoundTrip.camera.y, scale: afterRoundTrip.camera.scale },
		}).toEqual({ positions: restored.positions, camera: restoredCamera });
	});

	it("preserves stable focus through updates and recovers without label guessing", async () => {
		const { renderer, callbacks } = mount(snapshot([alice, bob, charlie]));
		await page.getByRole("button", { name: "List" }).click();
		const bobButton = page.getByRole("button", { name: "Bob" });
		await bobButton.click();
		await expect.element(bobButton).toHaveFocus();

		renderer.setGraph(snapshot([
			{ ...alice, label: "Alice renamed" },
			{ ...bob, label: "Bob renamed" },
			charlie,
		]));
		const renamedBob = page.getByRole("button", { name: "Bob renamed" });
		await expect.element(renamedBob).toHaveFocus();
		await expect.element(renamedBob).toHaveAttribute("aria-pressed", "true");

		renderer.setGraph(snapshot([{ ...alice, label: "Bob renamed" }, charlie]));
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(undefined, "graph-update");
		await expect.element(page.getByRole("button", { name: "Bob renamed" })).toHaveFocus();

		renderer.setGraph(snapshot([]));
		await expect.element(page.getByText("No people in the current atlas")).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "List" })).toHaveFocus();
	});

	it("preserves equivalent selected action focus through graph updates", async () => {
		const { renderer } = mount(snapshot([alice, bob]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org" }).click();
		const open = page.getByRole("button", { name: "Open note" });
		await open.click();
		await expect.element(open).toHaveFocus();

		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated" }, bob]));
		const updatedOpen = page.getByRole("button", { name: "Open note" });
		await expect.element(updatedOpen).toHaveFocus();

		const center = page.getByRole("button", { name: "Use as center" });
		await center.click();
		await expect.element(center).toHaveFocus();
		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated again" }, bob]));
		await expect.element(page.getByRole("button", { name: "Use as center" })).toHaveFocus();
	});

	it("introduces no motion and uses the owning secondary window for lifecycle resources", async () => {
		const { renderer } = mount(snapshot([alice]));
		const modeControl = document.querySelector<HTMLElement>(".people-atlas-view-modes");
		expect(modeControl).not.toBeNull();
		expect(getComputedStyle(modeControl as HTMLElement).transitionDuration).toBe("0s");
		expect(getComputedStyle(modeControl as HTMLElement).animationDuration).toBe("0s");
		expect(document.querySelector<HTMLButtonElement>(".people-atlas-graph-mode")?.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
		renderer.destroy();

		const frame = document.createElement("iframe");
		document.body.append(frame);
		const frameWindow = frame.contentWindow as Window;
		const frameDocument = frame.contentDocument as Document;
		const requestAnimationFrame = vi.fn(() => 77);
		const cancelAnimationFrame = vi.fn();
		let disconnected = false;
		let observed: Element | undefined;
		class FrameResizeObserver {
			constructor(_callback: ResizeObserverCallback) {}
			observe(target: Element): void {
				observed = target;
			}
			unobserve(): void {}
			disconnect(): void {
				disconnected = true;
			}
		}
		Object.defineProperty(frameWindow, "requestAnimationFrame", { configurable: true, value: requestAnimationFrame });
		Object.defineProperty(frameWindow, "cancelAnimationFrame", { configurable: true, value: cancelAnimationFrame });
		Object.defineProperty(frameWindow, "ResizeObserver", { configurable: true, value: FrameResizeObserver });
		const frameContainer = frameDocument.createElement("div");
		frameDocument.body.append(frameContainer);
		const callbacks: AtlasRendererCallbacks = {
			onOpenNode: vi.fn(),
			onCenterNode: vi.fn(),
			onSelectNode: vi.fn(),
		};

		const frameRenderer = new AtlasRenderer(frameContainer, () => DEFAULT_SETTINGS, callbacks);
		frameRenderer.setGraph(snapshot([alice]));
		expect(requestAnimationFrame).toHaveBeenCalled();
		expect(observed?.ownerDocument).toBe(frameDocument);
		const listMode = frameDocument.querySelector<HTMLButtonElement>(".people-atlas-list-mode");
		expect(listMode).not.toBeNull();
		await userEvent.click(listMode as HTMLButtonElement);
		expect(frameDocument.querySelector<HTMLElement>(".people-atlas-semantic-panel")?.hidden).toBe(false);

		frameRenderer.destroy();
		expect(disconnected).toBe(true);
		expect(cancelAnimationFrame).toHaveBeenCalledWith(77);
		expect(frameContainer.childElementCount).toBe(0);
		const pressed = listMode?.getAttribute("aria-pressed");
		listMode?.click();
		expect(listMode?.getAttribute("aria-pressed")).toBe(pressed);

		const detachedDocument = document.implementation.createHTMLDocument();
		const detachedContainer = detachedDocument.createElement("div");
		expect(() => new AtlasRenderer(detachedContainer, () => DEFAULT_SETTINGS, callbacks)).toThrow(
			"AtlasRenderer requires a container with an owning window.",
		);
	});
});
