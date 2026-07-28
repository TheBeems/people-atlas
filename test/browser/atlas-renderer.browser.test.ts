import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
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
		onCreateRelationship: ReturnType<typeof vi.fn>;
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
		canCreateRelationship: vi.fn((node: AtlasNode) => node.id === alice.id),
		onCreateRelationship: vi.fn(),
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
		await expect
			.element(page.getByRole("button", { name: "Alice, Example Org" }))
			.toHaveAttribute("aria-pressed", "true");
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

		const relationshipItems = Array.from(document.querySelectorAll(".people-atlas-relationship-list > li")).map(
			(item) => item.textContent,
		);
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
		await expect
			.element(page.getByText("This person record is ambiguous and cannot be opened or centered."))
			.toBeInTheDocument();

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

		renderer.setGraph(snapshot([{ ...alice, label: "Alice renamed" }, { ...bob, label: "Bob renamed" }, charlie]));
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

	it("provides touch-sized graph alternatives and a guarded modal details sheet", async () => {
		await page.viewport(390, 700);
		const { renderer, callbacks } = mount(snapshot([alice, bob, ghost, ambiguous], edges));
		const details = page.getByRole("button", { name: "Details" });
		await expect.element(details).toBeDisabled();
		for (const name of ["Zoom out", "Zoom in", "Fit", "Details"]) {
			await expect.element(page.getByRole("button", { name })).toBeInTheDocument();
		}

		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org" }).click();
		await page.getByRole("button", { name: "Graph" }).click();
		await expect.element(details).not.toBeDisabled();
		for (const name of ["Graph", "List", "Zoom out", "Zoom in", "Fit", "Details"]) {
			const box = (page.getByRole("button", { name }).element() as HTMLButtonElement).getBoundingClientRect();
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
		callbacks.onLayoutChanged.mockClear();
		const scaleBeforeZoom = renderer.getLayoutSnapshot().camera.scale;
		await page.getByRole("button", { name: "Zoom in" }).click();
		expect(renderer.getLayoutSnapshot().camera.scale).toBeGreaterThan(scaleBeforeZoom);
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();
		callbacks.onLayoutChanged.mockClear();
		await page.getByRole("button", { name: "Zoom out" }).click();
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();
		callbacks.onLayoutChanged.mockClear();
		await page.getByRole("button", { name: "Fit" }).click();
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();

		await details.click();
		const dialog = page.getByRole("dialog", { name: "Selected person details" });
		await expect.element(dialog).toBeInTheDocument();
		const dialogElement = dialog.element() as HTMLDialogElement;
		await expect.element(page.getByRole("button", { name: "Close" })).toHaveFocus();
		const descriptions = Array.from(dialogElement.querySelectorAll(".people-atlas-relationship-list > li")).map(
			(item) => item.textContent,
		);
		expect(descriptions).toEqual([
			"Connected to Bob. Types: friend, colleague. Status: active. Since: 2020-01-02. Last contact: 2026-07-20.",
			"Connected to Missing (unresolved). Types: contact. Contact-link connection.",
			"Outgoing to Bob. Types: neighbour. Status: ended.",
		]);
		await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
		await expect.element(page.getByRole("button", { name: "Create relationship" })).toHaveFocus();
		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated" }, bob, ghost, ambiguous], edges));
		expect(dialogElement.open).toBe(true);
		await expect.element(page.getByRole("heading", { name: "Alice updated" })).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Create relationship" })).toHaveFocus();
		await page.getByRole("button", { name: "Close" }).click();
		await expect.element(details).toHaveFocus();

		await details.click();
		await userEvent.keyboard("{Escape}");
		expect(dialogElement.open).toBe(false);
		await expect.element(details).toHaveFocus();

		callbacks.onOpenNode.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Open note" }).click();
		expect(callbacks.onOpenNode).toHaveBeenCalledOnce();
		callbacks.onCenterNode.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Use as center" }).click();
		expect(callbacks.onCenterNode).toHaveBeenCalledOnce();
		callbacks.onCreateRelationship.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Create relationship" }).click();
		expect(dialogElement.open).toBe(false);
		expect(callbacks.onCreateRelationship).toHaveBeenCalledOnce();
		expect(callbacks.onCreateRelationship).toHaveBeenCalledWith(
			expect.objectContaining({ id: alice.id, label: "Alice updated" }),
		);

		await details.click();
		(page.getByRole("button", { name: "List" }).element() as HTMLButtonElement).click();
		expect(dialogElement.open).toBe(false);
		await page.getByRole("button", { name: "Ambiguous Alice, ambiguous person" }).click();
		await page.getByRole("button", { name: "Graph" }).click();
		await details.click();
		await expect
			.element(page.getByText("This person record is ambiguous. No actions are available."))
			.toBeInTheDocument();
		expect(dialogElement.querySelector("button[aria-label='Open note']")).toBeNull();
		expect(dialogElement.querySelector("button[aria-label='Use as center']")).toBeNull();
		expect(dialogElement.querySelector("button[aria-label='Create relationship']")).toBeNull();
		renderer.setGraph(snapshot([{ ...alice, label: "Ambiguous Alice" }]));
		expect(dialogElement.open).toBe(false);
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(undefined, "graph-update");
		await page.viewport(800, 600);
	});

	it("uses trusted touch input for tap, node-origin pan and long press", async () => {
		await page.viewport(800, 600);
		const { renderer, callbacks } = mount(snapshot([alice]));
		const canvas = document.querySelector<HTMLCanvasElement>(".people-atlas-canvas");
		expect(canvas).not.toBeNull();
		const box = (canvas as HTMLCanvasElement).getBoundingClientRect();
		const center = { x: box.width / 2, y: box.height / 2 };

		expect(callbacks.onSelectNode).not.toHaveBeenCalled();
		await commands.dispatchTouch(".people-atlas-canvas", [
			{ type: "touchStart", points: [{ id: 1, ...center }] },
			{ type: "touchEnd", points: [] },
		]);
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(alice, "canvas");
		expect(callbacks.onOpenNode).not.toHaveBeenCalled();
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();

		callbacks.onSelectNode.mockClear();
		callbacks.onLayoutChanged.mockClear();
		const beforePan = renderer.getLayoutSnapshot();
		await commands.dispatchTouch(".people-atlas-canvas", [
			{ type: "touchStart", points: [{ id: 2, ...center }] },
			{ type: "touchMove", points: [{ id: 2, x: center.x + 36, y: center.y + 18 }] },
			{ type: "touchEnd", points: [] },
		]);
		const afterPan = renderer.getLayoutSnapshot();
		expect(afterPan.positions).toEqual(beforePan.positions);
		expect(afterPan.camera.x).toBeCloseTo(beforePan.camera.x + 36);
		expect(afterPan.camera.y).toBeCloseTo(beforePan.camera.y + 18);
		expect(callbacks.onSelectNode).not.toHaveBeenCalled();
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();

		callbacks.onSelectNode.mockClear();
		callbacks.onLayoutChanged.mockClear();
		await commands.dispatchTouch(".people-atlas-canvas", [
			{ type: "touchStart", points: [{ id: 4, x: 50, y: box.height - 50 }] },
			{ type: "touchEnd", points: [] },
		]);
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(undefined, "canvas");
		expect(callbacks.onLayoutChanged).not.toHaveBeenCalled();

		callbacks.onLayoutChanged.mockClear();
		await commands.dispatchTouch(".people-atlas-canvas", [
			{ type: "touchStart", points: [{ id: 3, x: center.x + 36, y: center.y + 18 }], delayAfterMs: 550 },
			{ type: "touchEnd", points: [] },
		]);
		const dialog = document.querySelector<HTMLDialogElement>(".people-atlas-details-sheet");
		expect(dialog?.open).toBe(true);
		await expect.element(page.getByRole("button", { name: "Close" })).toHaveFocus();
		expect(callbacks.onOpenNode).not.toHaveBeenCalled();
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();
		expect(callbacks.onCreateRelationship).not.toHaveBeenCalled();
		expect(callbacks.onLayoutChanged).not.toHaveBeenCalled();
		await page.getByRole("button", { name: "Close" }).click();
		await expect
			.element(page.getByRole("application", { name: "Interactive people and relationship atlas" }))
			.toHaveFocus();
	});

	it("pinches and pans through protocol-valid Chromium CDP input and persists once", async () => {
		const { renderer, callbacks } = mount(snapshot([alice, bob]));
		const canvas = document.querySelector<HTMLCanvasElement>(".people-atlas-canvas");
		expect(canvas).not.toBeNull();
		const box = (canvas as HTMLCanvasElement).getBoundingClientRect();
		const center = { x: box.width / 2, y: box.height / 2 };
		const before = renderer.getLayoutSnapshot();
		const pointerEvents: Array<{ type: string; id: number; x: number; y: number; target: string }> = [];
		for (const type of ["pointerdown", "pointermove", "pointerup"]) {
			document.addEventListener(
				type,
				(event) => {
					const pointer = event as PointerEvent;
					pointerEvents.push({
						type,
						id: pointer.pointerId,
						x: pointer.clientX,
						y: pointer.clientY,
						target: (pointer.target as Element | null)?.className?.toString() ?? "",
					});
				},
				true,
			);
		}

		await expect(
			commands.dispatchTouch(".people-atlas-canvas", [{ type: "touchEnd", points: [{ id: 99, ...center }] }]),
		).rejects.toThrow("touchEnd must not contain active touch points.");

		await commands.dispatchTouch(".people-atlas-canvas", [
			{
				type: "touchStart",
				points: [{ id: 11, x: center.x - 50, y: center.y }],
			},
			{
				type: "touchStart",
				points: [
					{ id: 11, x: center.x - 50, y: center.y },
					{ id: 12, x: center.x + 50, y: center.y },
				],
			},
			{
				type: "touchMove",
				points: [
					{ id: 11, x: center.x - 80, y: center.y + 10 },
					{ id: 12, x: center.x + 120, y: center.y + 10 },
				],
			},
			{ type: "touchEnd", points: [] },
		]);

		const after = renderer.getLayoutSnapshot();
		const pointerDowns = pointerEvents.filter((event) => event.type === "pointerdown");
		expect(pointerDowns).toHaveLength(2);
		expect(new Set(pointerDowns.map((event) => event.id)).size).toBe(2);
		const pointerUps = pointerEvents.filter((event) => event.type === "pointerup");
		expect(new Set(pointerUps.map((event) => event.id))).toEqual(new Set(pointerDowns.map((event) => event.id)));
		expect(after.positions).toEqual(before.positions);
		expect(after.camera.scale).toBeCloseTo(2);
		expect(after.camera.x).toBeCloseTo(before.camera.x + 20, 1);
		expect(after.camera.y).toBeCloseTo(before.camera.y + 10, 1);
		expect(callbacks.onSelectNode).not.toHaveBeenCalled();
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();
	});

	it("cancels pending long press across movement, multi-touch, release, graph, mode and cancel paths", () => {
		const { renderer, callbacks } = mount(snapshot([alice]));
		const canvas = document.querySelector<HTMLCanvasElement>(".people-atlas-canvas") as HTMLCanvasElement;
		Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
		Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => false) });
		Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });
		const box = canvas.getBoundingClientRect();
		const center = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
		const dispatch = (type: string, pointerId: number, clientX = center.clientX, clientY = center.clientY): void => {
			canvas.dispatchEvent(
				new PointerEvent(type, { bubbles: true, pointerId, pointerType: "touch", clientX, clientY }),
			);
		};
		const sheet = document.querySelector<HTMLDialogElement>(".people-atlas-details-sheet") as HTMLDialogElement;

		vi.useFakeTimers();
		try {
			dispatch("pointerdown", 31);
			renderer.setGraph(snapshot([bob]));
			vi.advanceTimersByTime(501);
			expect(sheet.open).toBe(false);

			renderer.setGraph(snapshot([alice]));
			dispatch("pointerdown", 32);
			document.querySelector<HTMLButtonElement>(".people-atlas-list-mode")?.click();
			vi.advanceTimersByTime(501);
			expect(sheet.open).toBe(false);
			document.querySelector<HTMLButtonElement>(".people-atlas-graph-mode")?.click();

			dispatch("pointerdown", 33);
			dispatch("pointermove", 33, center.clientX + 9, center.clientY);
			vi.advanceTimersByTime(501);
			expect(sheet.open).toBe(false);
			dispatch("pointerup", 33, center.clientX + 9, center.clientY);

			dispatch("pointerdown", 34);
			dispatch("pointerdown", 35, center.clientX + 80, center.clientY);
			vi.advanceTimersByTime(501);
			expect(sheet.open).toBe(false);
			dispatch("pointercancel", 34);

			dispatch("pointerdown", 36);
			dispatch("pointerup", 36);
			vi.advanceTimersByTime(501);
			expect(sheet.open).toBe(false);

			dispatch("pointerdown", 37);
			dispatch("pointercancel", 37);
			vi.advanceTimersByTime(501);
			expect(sheet.open).toBe(false);
			expect(callbacks.onOpenNode).not.toHaveBeenCalled();
			expect(callbacks.onCenterNode).not.toHaveBeenCalled();
			expect(callbacks.onCreateRelationship).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("ignores unusable coordinates and contains pointer-capture failures", () => {
		const { renderer, callbacks } = mount(snapshot([alice]));
		const canvas = document.querySelector<HTMLCanvasElement>(".people-atlas-canvas") as HTMLCanvasElement;
		Object.defineProperty(canvas, "setPointerCapture", {
			configurable: true,
			value: vi.fn(() => {
				throw new DOMException("Pointer is not active", "NotFoundError");
			}),
		});
		Object.defineProperty(canvas, "hasPointerCapture", {
			configurable: true,
			value: vi.fn(() => {
				throw new DOMException("Capture state is unavailable", "InvalidStateError");
			}),
		});
		Object.defineProperty(canvas, "releasePointerCapture", {
			configurable: true,
			value: vi.fn(() => {
				throw new DOMException("Capture was already lost", "NotFoundError");
			}),
		});
		const handlers = renderer as unknown as {
			onPointerDown(event: PointerEvent): void;
			onPointerMove(event: PointerEvent): void;
			onPointerUp(event: PointerEvent): void;
			onPointerCancel(event: PointerEvent): void;
		};
		const box = canvas.getBoundingClientRect();
		const start = { clientX: box.left + 50, clientY: box.bottom - 50 };
		const pointer = (type: string, clientX: number, clientY: number): PointerEvent =>
			new PointerEvent(type, {
				cancelable: true,
				pointerId: 81,
				pointerType: "touch",
				clientX,
				clientY,
			});
		const invalidMove = pointer("pointermove", start.clientX, start.clientY);
		Object.defineProperty(invalidMove, "clientX", { configurable: true, value: Number.NaN });
		const before = renderer.getLayoutSnapshot();

		expect(() => handlers.onPointerDown(pointer("pointerdown", start.clientX, start.clientY))).not.toThrow();
		expect(() => handlers.onPointerMove(invalidMove)).not.toThrow();
		expect(renderer.getLayoutSnapshot().camera).toEqual(before.camera);
		expect(() => handlers.onPointerMove(pointer("pointermove", start.clientX + 20, start.clientY + 10))).not.toThrow();
		expect(() => handlers.onPointerUp(pointer("pointerup", start.clientX + 20, start.clientY + 10))).not.toThrow();

		const after = renderer.getLayoutSnapshot();
		expect(Object.values(after.camera).every(Number.isFinite)).toBe(true);
		expect(after.camera.x).toBeCloseTo(before.camera.x + 20);
		expect(after.camera.y).toBeCloseTo(before.camera.y + 10);
		expect(after.positions).toEqual(before.positions);
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();

		expect(() => handlers.onPointerDown(pointer("pointerdown", start.clientX, start.clientY))).not.toThrow();
		expect(() => handlers.onPointerCancel(pointer("pointercancel", start.clientX, start.clientY))).not.toThrow();
	});

	it("rolls back modal state when native showModal fails and remains operable", async () => {
		const { renderer, callbacks } = mount(snapshot([alice]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org" }).click();
		await page.getByRole("button", { name: "Graph" }).click();
		const dialog = document.querySelector<HTMLDialogElement>(".people-atlas-details-sheet") as HTMLDialogElement;
		const originalShowModal = dialog.showModal.bind(dialog);
		Object.defineProperty(dialog, "showModal", {
			configurable: true,
			value: vi.fn(() => {
				throw new DOMException("Dialog is not eligible for modal display", "InvalidStateError");
			}),
		});
		const internals = renderer as unknown as {
			openSheet(invoker: "details" | "canvas"): void;
			sheetNodeId: string | undefined;
			sheetInvoker: string | undefined;
		};

		expect(() => internals.openSheet("details")).not.toThrow();
		expect(dialog.open).toBe(false);
		expect(internals.sheetNodeId).toBeUndefined();
		expect(internals.sheetInvoker).toBeUndefined();
		expect(dialog.childElementCount).toBe(1);
		expect(dialog.textContent).toBe("");
		expect(callbacks.onOpenNode).not.toHaveBeenCalled();
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();
		expect(callbacks.onCreateRelationship).not.toHaveBeenCalled();

		Object.defineProperty(dialog, "showModal", { configurable: true, value: originalShowModal });
		expect(() => internals.openSheet("details")).not.toThrow();
		expect(dialog.open).toBe(true);
		await page.getByRole("button", { name: "Close" }).click();
		await expect
			.element(page.getByRole("application", { name: "Interactive people and relationship atlas" }))
			.toBeInTheDocument();
	});

	it("retains mouse and pen drag, mouse pan and wheel while lifecycle cancellation prevents delayed touch callbacks", async () => {
		const { renderer, callbacks } = mount(snapshot([alice]));
		const canvas = document.querySelector<HTMLCanvasElement>(".people-atlas-canvas") as HTMLCanvasElement;
		Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
		Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => false) });
		Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });
		const box = canvas.getBoundingClientRect();
		const center = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
		const before = renderer.getLayoutSnapshot();
		canvas.dispatchEvent(
			new PointerEvent("pointerdown", { bubbles: true, pointerId: 21, pointerType: "pen", ...center }),
		);
		canvas.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerId: 21,
				pointerType: "pen",
				clientX: center.clientX + 20,
				clientY: center.clientY + 10,
			}),
		);
		canvas.dispatchEvent(
			new PointerEvent("pointerup", {
				bubbles: true,
				pointerId: 21,
				pointerType: "pen",
				clientX: center.clientX + 20,
				clientY: center.clientY + 10,
			}),
		);
		const afterPen = renderer.getLayoutSnapshot();
		expect(afterPen.positions[alice.id]?.x).toBeCloseTo((before.positions[alice.id]?.x ?? 0) + 20);
		expect(afterPen.positions[alice.id]?.y).toBeCloseTo((before.positions[alice.id]?.y ?? 0) + 10);
		expect(callbacks.onSelectNode).toHaveBeenCalledWith(alice, "canvas");

		callbacks.onSelectNode.mockClear();
		callbacks.onLayoutChanged.mockClear();
		canvas.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				pointerId: 23,
				pointerType: "mouse",
				clientX: center.clientX + 20,
				clientY: center.clientY + 10,
			}),
		);
		canvas.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerId: 23,
				pointerType: "mouse",
				clientX: center.clientX + 35,
				clientY: center.clientY + 5,
			}),
		);
		canvas.dispatchEvent(
			new PointerEvent("pointerup", {
				bubbles: true,
				pointerId: 23,
				pointerType: "mouse",
				clientX: center.clientX + 35,
				clientY: center.clientY + 5,
			}),
		);
		const afterMouseDrag = renderer.getLayoutSnapshot();
		expect(afterMouseDrag.positions[alice.id]?.x).toBeCloseTo((afterPen.positions[alice.id]?.x ?? 0) + 15);
		expect(afterMouseDrag.positions[alice.id]?.y).toBeCloseTo((afterPen.positions[alice.id]?.y ?? 0) - 5);
		expect(callbacks.onSelectNode).toHaveBeenCalledWith(alice, "canvas");
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();

		callbacks.onSelectNode.mockClear();
		callbacks.onLayoutChanged.mockClear();
		const panStart = { clientX: box.left + 8, clientY: box.top + 8 };
		canvas.dispatchEvent(
			new PointerEvent("pointerdown", { bubbles: true, pointerId: 24, pointerType: "mouse", ...panStart }),
		);
		canvas.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerId: 24,
				pointerType: "mouse",
				clientX: panStart.clientX + 18,
				clientY: panStart.clientY + 12,
			}),
		);
		canvas.dispatchEvent(
			new PointerEvent("pointerup", {
				bubbles: true,
				pointerId: 24,
				pointerType: "mouse",
				clientX: panStart.clientX + 18,
				clientY: panStart.clientY + 12,
			}),
		);
		const afterMousePan = renderer.getLayoutSnapshot();
		expect(afterMousePan.positions).toEqual(afterMouseDrag.positions);
		expect(afterMousePan.camera.x).toBeCloseTo(afterMouseDrag.camera.x + 18);
		expect(afterMousePan.camera.y).toBeCloseTo(afterMouseDrag.camera.y + 12);
		expect(callbacks.onSelectNode).not.toHaveBeenCalled();
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();

		callbacks.onLayoutChanged.mockClear();
		canvas.dispatchEvent(
			new WheelEvent("wheel", {
				bubbles: true,
				cancelable: true,
				clientX: center.clientX,
				clientY: center.clientY,
				deltaY: -1,
			}),
		);
		expect(renderer.getLayoutSnapshot().camera.scale).toBeGreaterThan(afterMousePan.camera.scale);
		expect(callbacks.onLayoutChanged).toHaveBeenCalledOnce();

		callbacks.onSelectNode.mockClear();
		canvas.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				pointerId: 22,
				pointerType: "touch",
				...center,
			}),
		);
		renderer.destroy();
		await new Promise((resolve) => setTimeout(resolve, 550));
		expect(callbacks.onSelectNode).not.toHaveBeenCalled();
		expect(document.querySelector(".people-atlas-details-sheet")).toBeNull();
	});

	it("introduces no motion and uses the owning secondary window for lifecycle resources", async () => {
		const { renderer } = mount(snapshot([alice]));
		const modeControl = document.querySelector<HTMLElement>(".people-atlas-view-modes");
		expect(modeControl).not.toBeNull();
		expect(getComputedStyle(modeControl as HTMLElement).transitionDuration).toBe("0s");
		expect(getComputedStyle(modeControl as HTMLElement).animationDuration).toBe("0s");
		expect(
			document.querySelector<HTMLButtonElement>(".people-atlas-graph-mode")?.getBoundingClientRect().height,
		).toBeGreaterThanOrEqual(24);
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
		const framePerson = frameDocument.querySelector<HTMLButtonElement>(".people-atlas-person-button");
		expect(framePerson).not.toBeNull();
		await userEvent.click(framePerson as HTMLButtonElement);
		const frameGraphMode = frameDocument.querySelector<HTMLButtonElement>(".people-atlas-graph-mode");
		await userEvent.click(frameGraphMode as HTMLButtonElement);
		const frameDetails = frameDocument.querySelector<HTMLButtonElement>(
			".people-atlas-graph-actions button[aria-label='Details']",
		);
		expect(frameDetails?.disabled).toBe(false);
		await userEvent.click(frameDetails as HTMLButtonElement);
		const frameSheet = frameDocument.querySelector<HTMLDialogElement>(".people-atlas-details-sheet");
		expect(frameSheet?.ownerDocument).toBe(frameDocument);
		expect(frameSheet?.open).toBe(true);
		expect(frameDocument.activeElement?.textContent).toBe("Close");

		frameRenderer.destroy();
		expect(frameSheet?.open).toBe(false);
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
