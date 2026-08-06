import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { PeopleAtlasBasesView } from "../../src/bases/people-atlas-bases-view";
import { createTranslator, type Translator } from "../../src/i18n";
import type { AtlasEdge, AtlasNode, AtlasSnapshot, ContactMomentSummary } from "../../src/domain/types";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import { renderPersonProfile } from "../../src/render/person-profile";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { DEFAULT_VIEW_STATE } from "../../src/settings/view-state";
import type { PeopleAtlasSettings } from "../../src/settings/types";
import { PeopleAtlasView } from "../../src/view/people-atlas-view";
import "../../styles.css";

const alice: AtlasNode = {
	id: "person-alice",
	personId: "person-alice",
	kind: "person",
	label: "Alice",
	filePath: "People/Alice.md",
	organisations: ["Example Org"],
	emails: [],
	phones: [],
	isCenter: true,
};

const bob: AtlasNode = {
	id: "person-bob",
	personId: "person-bob",
	kind: "person",
	label: "Bob",
	filePath: "People/Bob.md",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

const charlie: AtlasNode = {
	id: "person-charlie",
	personId: "person-charlie",
	kind: "person",
	label: "Charlie",
	filePath: "People/Charlie.md",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

const ghost: AtlasNode = {
	id: "ghost:Missing",
	kind: "ghost",
	label: "Missing",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

const nonOpenable: AtlasNode = {
	id: "person-no-note",
	personId: "person-no-note",
	kind: "person",
	label: "No note",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

const ambiguous: AtlasNode = {
	id: "ambiguous:duplicate-alice",
	personId: "duplicate-person",
	kind: "person",
	label: "Ambiguous Alice",
	filePath: "People/Ambiguous Alice.md",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: true,
};

const baseOnly: AtlasNode = {
	id: "base-only-stable-id",
	kind: "person",
	label: "Base-only person",
	filePath: "People/Base only.md",
	organisations: [],
	emails: [],
	phones: [],
	isCenter: false,
};

const profileAlice: AtlasNode = {
	...alice,
	pronouns: "she/her",
	jobTitle: "Principal engineer",
	birthDate: "--02-29",
	gender: "Woman",
	emails: ["alice@example.com", "alice@work.example"],
	phones: ["+31 6 12 34 56 78"],
};

const photographedAlice: AtlasNode = {
	...profileAlice,
	label: "Alice Example",
	photoPath: "Assets/People/Alice portrait.png",
};

const LOCAL_PHOTO_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const edges: AtlasEdge[] = [
	{
		id: "relationship-friends",
		sourceId: alice.id,
		targetId: bob.id,
		types: ["friend", "colleague"],
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
		status: "dormant",
		filePath: "People/Relationships/Charlie - Alice mentor.md",
		inferred: false,
	},
	{
		id: "contact-missing",
		sourceId: alice.id,
		targetId: ghost.id,
		types: ["contact"],
		inferred: true,
	},
	{
		id: "relationship-parallel",
		sourceId: alice.id,
		targetId: bob.id,
		types: ["neighbour"],
		status: "ended",
		filePath: "People/Relationships/Alice - Bob neighbour.md",
		inferred: false,
	},
];

function snapshot(
	nodes: AtlasNode[],
	graphEdges: AtlasEdge[] = [],
	contactMoments: ContactMomentSummary[] = [],
	hiddenContactMomentCount = 0,
): AtlasSnapshot {
	return {
		nodes,
		edges: graphEdges,
		contactMoments,
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount,
		generatedAt: 1,
	};
}

function localDay(offset: number, from = new Date()): string {
	const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
	return [
		String(date.getFullYear()).padStart(4, "0"),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
}

function mount(
	graph = snapshot([alice, ghost, charlie], edges),
	settings: PeopleAtlasSettings = DEFAULT_SETTINGS,
	callbackOverrides: Partial<AtlasRendererCallbacks> = {},
	translator: Translator = createTranslator("en"),
): {
	renderer: AtlasRenderer;
	callbacks: {
		onOpenNode: ReturnType<typeof vi.fn>;
		onCenterNode: ReturnType<typeof vi.fn>;
		onSelectNode: ReturnType<typeof vi.fn>;
		onLayoutChanged: ReturnType<typeof vi.fn>;
		onEditPerson: ReturnType<typeof vi.fn>;
		onCreateRelationship: ReturnType<typeof vi.fn>;
		onLogContact: ReturnType<typeof vi.fn>;
		canOpenRelationship: ReturnType<typeof vi.fn>;
		onOpenRelationship: ReturnType<typeof vi.fn>;
		canEditRelationship: ReturnType<typeof vi.fn>;
		onEditRelationship: ReturnType<typeof vi.fn>;
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
		canEditPerson: vi.fn((node: AtlasNode) => node.id === alice.id),
		onEditPerson: vi.fn(),
		canCreateRelationship: vi.fn((node: AtlasNode) => node.id === alice.id),
		onCreateRelationship: vi.fn(),
		canLogContact: vi.fn((node: AtlasNode) => node.id === alice.id),
		onLogContact: vi.fn(),
		canOpenRelationship: vi.fn((edge: AtlasEdge) => Boolean(edge.filePath)),
		onOpenRelationship: vi.fn(),
		canEditRelationship: vi.fn((edge: AtlasEdge) => Boolean(edge.filePath)),
		onEditRelationship: vi.fn(),
	};
	Object.assign(callbacks, callbackOverrides);
	const renderer = new AtlasRenderer(container, () => settings, callbacks as AtlasRendererCallbacks, translator);
	renderer.setGraph(graph);
	return { renderer, callbacks };
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("accessible atlas renderer", () => {
	it("localizes fixed graph, list and follow-up controls without changing person or contact values", async () => {
		const moment: ContactMomentSummary = {
			id: "contact-alice",
			filePath: "People/Contact moments/Alice.md",
			personIds: [alice.personId as string],
			occurredOn: localDay(0),
			channel: "call",
			summary: "Private note",
			followUpOn: localDay(1),
			followUpStatus: "open",
		};
		mount(snapshot([alice], [], [moment]), DEFAULT_SETTINGS, {}, createTranslator("nl-BE"));

		expect(document.querySelector("legend")?.textContent).toBe("Weergave");
		expect(page.getByRole("button", { name: "Grafiek" }).element()).toBeInstanceOf(HTMLButtonElement);
		expect(page.getByRole("button", { name: "Lijst" }).element()).toBeInstanceOf(HTMLButtonElement);
		expect(page.getByRole("button", { name: "Opvolgingen" }).element()).toBeInstanceOf(HTMLButtonElement);
		expect(page.getByRole("application", { name: "Interactieve personen- en relatieatlas" }).element()).toBeInstanceOf(
			HTMLCanvasElement,
		);
		expect(page.getByRole("button", { name: "Uitzoomen" }).element()).toBeInstanceOf(HTMLButtonElement);

		await page.getByRole("button", { name: "Lijst" }).click();
		expect(document.querySelector(".people-atlas-semantic-panel")?.getAttribute("aria-label")).toBe(
			"Lijstweergave van Personenatlas",
		);
		expect(page.getByRole("button", { name: "Alice, Example Org", exact: true }).element().textContent).toContain(
			"Alice",
		);

		await page.getByRole("button", { name: "Opvolgingen" }).click();
		expect(page.getByRole("heading", { name: "Contactopvolgingen" }).element()).toBeInstanceOf(HTMLHeadingElement);
		expect(document.querySelector(".people-atlas-follow-ups-panel")?.textContent).toContain("Private note");
		expect(document.querySelector(".people-atlas-follow-ups-summary")?.textContent).toBe("1 openstaande opvolging");
	});

	it("formats contact-moment dates only at the localized renderer boundary", () => {
		const moment: ContactMomentSummary = {
			id: "moment-localized-date",
			filePath: "People/Contact moments/Localized date.md",
			personIds: [alice.id],
			occurredOn: "2026-07-30",
			followUpOn: "2026-08-01",
			followUpStatus: "open",
		};
		const { renderer } = mount(
			snapshot([alice], [], [moment]),
			DEFAULT_SETTINGS,
			{ canUpdateFollowUp: () => true, onUpdateFollowUp: () => true },
			createTranslator("nl"),
		);

		renderer.showFollowUps();

		const row = document.querySelector<HTMLElement>('[data-contact-moment-id="moment-localized-date"]');
		expect(row?.querySelector('time[datetime="2026-08-01"]')?.textContent).toBe("1 augustus 2026");
		expect(row?.querySelector('time[datetime="2026-07-30"]')?.textContent).toBe("30 juli 2026");
		expect(row?.querySelector('time[datetime="2026-08-01"]')?.getAttribute("datetime")).toBe("2026-08-01");
		expect(row?.querySelector('button[data-contact-moment-action="done"]')?.getAttribute("aria-label")).toContain(
			"gepland 1 augustus 2026",
		);
	});

	it("localizes semantic-list live summaries including hidden contact moments", async () => {
		mount(snapshot([alice], [], [], 1), DEFAULT_SETTINGS, {}, createTranslator("nl"));

		await page.getByRole("button", { name: "Lijst" }).click();

		expect(document.querySelector(".people-atlas-semantic-summary")?.getAttribute("aria-live")).toBe("polite");
		expect(document.querySelector(".people-atlas-semantic-summary")?.textContent).toBe(
			"1 persoon · 0 verbindingen · 1 verborgen contactmoment",
		);
	});

	it("localizes noncanonical list metadata and accessible names without changing node labels", async () => {
		mount(snapshot([ghost, ambiguous]), DEFAULT_SETTINGS, {}, createTranslator("nl"));

		await page.getByRole("button", { name: "Lijst" }).click();

		const ghostButton = document.querySelector<HTMLButtonElement>("[data-node-id='ghost:Missing']");
		const ambiguousButton = document.querySelector<HTMLButtonElement>("[data-node-id='ambiguous:duplicate-alice']");
		expect(ghostButton?.getAttribute("aria-label")).toBe("Missing, onopgeloste persoon");
		expect(ghostButton?.textContent).toBe("MissingOnopgeloste persoon");
		expect(ambiguousButton?.getAttribute("aria-label")).toBe("Ambiguous Alice, ambigue persoon");
		expect(ambiguousButton?.textContent).toBe("Ambiguous AliceAmbigue persoon");
	});

	it("localizes selected Bases actions while preserving the canonical person path", () => {
		const actions = document.createElement("div");
		const openEditPerson = vi.fn();
		const openCreateRelationship = vi.fn();
		const openLogContact = vi.fn();
		const view = Object.create(PeopleAtlasBasesView.prototype) as {
			selectionActionsEl: HTMLElement;
			plugin: {
				t: Translator;
				openEditPerson: (path: string) => void;
				openCreateRelationship: (path: string) => void;
				openLogContact: (path: string) => void;
			};
			canEditPerson: (node: AtlasNode | undefined) => boolean;
		};
		Object.assign(view, {
			selectionActionsEl: actions,
			plugin: { t: createTranslator("nl"), openEditPerson, openCreateRelationship, openLogContact },
			canEditPerson: () => true,
		});

		(view as unknown as { renderSelectionActions: (node: AtlasNode | undefined) => void }).renderSelectionActions(
			alice,
		);

		expect(Array.from(actions.querySelectorAll("button")).map((button) => button.textContent)).toEqual([
			"Alice bewerken",
			"Relatie met Alice aanmaken",
			"Contact met Alice vastleggen",
		]);
		for (const button of Array.from(actions.querySelectorAll("button"))) button.click();
		expect(openEditPerson).toHaveBeenCalledExactlyOnceWith("People/Alice.md");
		expect(openCreateRelationship).toHaveBeenCalledExactlyOnceWith("People/Alice.md");
		expect(openLogContact).toHaveBeenCalledExactlyOnceWith("People/Alice.md");
	});

	it("localizes standalone-view graph statistics without changing the graph snapshot", () => {
		const statsEl = document.createElement("span");
		const renderer = { setGraph: vi.fn() };
		const view = Object.create(PeopleAtlasView.prototype) as {
			selectedPath: string | undefined;
			selectedCenterPath: string | undefined;
			centerMode: "configured";
			projectionMode: "free";
			centerId: string | undefined;
			activePath: string | undefined;
			viewState: typeof DEFAULT_VIEW_STATE;
			viewConfigurationKey: string;
			fullSnapshot: AtlasSnapshot;
			renderer: typeof renderer;
			statsEl: HTMLElement;
			plugin: { t: Translator };
			renderDiagnostics: (snapshot: AtlasSnapshot) => void;
		};
		Object.assign(view, {
			selectedPath: undefined,
			selectedCenterPath: undefined,
			centerMode: "configured",
			projectionMode: "free",
			centerId: undefined,
			activePath: undefined,
			viewState: structuredClone(DEFAULT_VIEW_STATE),
			viewConfigurationKey: "localized-stats",
			fullSnapshot: snapshot([alice], []),
			renderer,
			statsEl,
			plugin: { t: createTranslator("nl") },
			renderDiagnostics: vi.fn(),
		});

		(view as unknown as { renderSnapshot: () => void }).renderSnapshot();

		expect(statsEl.textContent).toBe("1 persoon · 0 verbindingen");
		expect(renderer.setGraph.mock.calls[0]?.[0]).toMatchObject({ nodes: [{ id: "person-alice" }], edges: [] });
	});

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
			.element(page.getByRole("button", { name: "Alice, Example Org", exact: true }))
			.toHaveAttribute("aria-pressed", "true");
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(alice, "canvas");
	});

	it("shows one ordered compact profile in semantic details and the graph sheet without leaking contacts", async () => {
		const privateBob: AtlasNode = {
			...bob,
			emails: ["private-bob@example.com"],
			phones: ["+1 555 0100"],
		};
		const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
		mount(snapshot([profileAlice, privateBob, ghost], [edges[0] as AtlasEdge, edges[2] as AtlasEdge]));
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		const drawnText = fillText.mock.calls.map(([value]) => String(value)).join(" ");
		expect(drawnText).not.toContain("alice@example.com");
		expect(drawnText).not.toContain("+31 6 12 34 56 78");
		expect(drawnText).not.toContain("private-bob@example.com");
		expect(drawnText).not.toContain("+1 555 0100");

		await page.getByRole("button", { name: "List" }).click();
		const aliceButton = page.getByRole("button", { name: "Alice, Example Org", exact: true });
		const bobButton = page.getByRole("button", { name: "Bob", exact: true });
		expect((aliceButton.element() as HTMLButtonElement).getAttribute("aria-label")).not.toContain("alice@");
		expect((bobButton.element() as HTMLButtonElement).getAttribute("aria-label")).not.toContain("private-bob@");
		expect(aliceButton.element().textContent).not.toContain("+31 6");
		expect(bobButton.element().textContent).not.toContain("+1 555");

		await aliceButton.click();
		const semanticDetails = document.querySelector<HTMLElement>(".people-atlas-semantic-details");
		expect(semanticDetails).not.toBeNull();
		expect(
			Array.from(semanticDetails?.querySelectorAll(".people-atlas-profile dt") ?? []).map((term) => term.textContent),
		).toEqual(["Pronouns", "Job title", "Organisations", "Birth date", "Gender", "Email", "Phone"]);
		expect(semanticDetails?.querySelector<HTMLElement>("[data-profile-field='birth-date']")?.textContent).toBe(
			"February 29 (year unknown)",
		);
		expect(
			Array.from(semanticDetails?.querySelectorAll(".people-atlas-connection-group > h4") ?? []).map(
				(heading) => heading.textContent,
			),
		).toEqual(["Relationships", "Linked people"]);
		expect(
			Array.from(
				semanticDetails?.querySelectorAll<HTMLElement>(
					"[data-connection-group='relationships'] .people-atlas-relationship-list > li",
				) ?? [],
			).map((item) => item.dataset.edgeId),
		).toEqual(["relationship-friends"]);
		expect(
			Array.from(
				semanticDetails?.querySelectorAll<HTMLElement>(
					"[data-connection-group='linked-people'] .people-atlas-relationship-list > li",
				) ?? [],
			).map((item) => item.dataset.edgeId),
		).toEqual(["contact-missing"]);
		expect(semanticDetails?.querySelector("[data-connection-group='linked-people'] button")).toBeNull();
		expect(semanticDetails?.querySelector("a[href='mailto:alice@example.com']")?.textContent).toBe("alice@example.com");
		expect(semanticDetails?.querySelector("a[href='tel:+31 6 12 34 56 78']")?.textContent).toBe("+31 6 12 34 56 78");
		expect(semanticDetails?.textContent).not.toContain("People/Alice.md");
		expect(semanticDetails?.textContent).not.toContain("person-alice");
		expect(semanticDetails?.querySelector("[data-connection-group='relationships']")?.textContent).not.toContain(
			"private-bob@example.com",
		);
		expect(semanticDetails?.querySelector("[data-connection-group='relationships']")?.textContent).not.toContain(
			"+1 555 0100",
		);

		await page.getByRole("button", { name: "Graph" }).click();
		await page.getByRole("button", { name: "Details" }).click();
		const dialog = page.getByRole("dialog", { name: "Selected person details" }).element() as HTMLDialogElement;
		expect(Array.from(dialog.querySelectorAll(".people-atlas-profile dt")).map((term) => term.textContent)).toEqual([
			"Pronouns",
			"Job title",
			"Organisations",
			"Birth date",
			"Gender",
			"Email",
			"Phone",
		]);
		expect(
			Array.from(dialog.querySelectorAll(".people-atlas-connection-group > h3")).map((heading) => heading.textContent),
		).toEqual(["Relationships", "Linked people"]);
		expect(dialog.querySelector("a[href='mailto:alice@work.example']")?.ownerDocument).toBe(document);
		expect(dialog.textContent).not.toContain("People/Alice.md");
		expect(dialog.textContent).not.toContain("person-alice");
	});

	it("resolves graph and selected-profile photo surfaces while keeping profile images decorative", async () => {
		const resolvePersonPhoto = vi.fn(() => ({
			status: "ready" as const,
			resourceUrl: LOCAL_PHOTO_DATA_URL,
			cacheKey: "Assets/People/Alice portrait.png\u00001:43",
		}));
		mount(snapshot([photographedAlice]), DEFAULT_SETTINGS, { resolvePersonPhoto });

		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice Example, Example Org", exact: true }).click();
		const semanticDetails = document.querySelector<HTMLElement>(".people-atlas-semantic-details");
		const listPhoto = semanticDetails?.querySelector<HTMLElement>(".people-atlas-profile-photo");
		const listImage = listPhoto?.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
		if (!listPhoto || !listImage) throw new Error("Expected the list profile photo.");
		expect(semanticDetails?.querySelector("h3")?.textContent).toBe("Alice Example");
		expect(listPhoto?.ownerDocument).toBe(document);
		expect(listImage?.ownerDocument).toBe(document);
		expect(listImage?.alt).toBe("");
		expect(listImage?.getAttribute("src")).toBe(LOCAL_PHOTO_DATA_URL);
		expect(listImage?.getAttribute("src")).not.toBe(photographedAlice.photoPath);
		if (listPhoto.dataset.photoStatus !== "ready") listImage.dispatchEvent(new Event("load"));
		expect(listPhoto.dataset.photoStatus).toBe("ready");
		expect(listImage.hidden).toBe(false);
		expect(listPhoto?.querySelector<HTMLElement>(".people-atlas-profile-photo-fallback")?.hidden).toBe(true);
		expect(getComputedStyle(listImage).objectFit).toBe("cover");
		expect(getComputedStyle(listImage).objectPosition).toBe("50% 50%");
		expect(semanticDetails?.textContent).not.toContain(photographedAlice.photoPath as string);

		await page.getByRole("button", { name: "Graph" }).click();
		await page.getByRole("button", { name: "Details" }).click();
		const dialog = page.getByRole("dialog", { name: "Selected person details" }).element() as HTMLDialogElement;
		const sheetPhoto = dialog.querySelector<HTMLElement>(".people-atlas-profile-photo");
		const sheetImage = sheetPhoto?.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
		if (!sheetPhoto || !sheetImage) throw new Error("Expected the sheet profile photo.");
		expect(dialog.querySelector("h2")?.textContent).toBe("Alice Example");
		expect(sheetImage?.alt).toBe("");
		expect(sheetImage).not.toBe(listImage);
		if (sheetPhoto.dataset.photoStatus !== "ready") sheetImage.dispatchEvent(new Event("load"));
		expect(sheetPhoto.dataset.photoStatus).toBe("ready");
		expect(dialog.textContent).not.toContain(photographedAlice.photoPath as string);
		expect(resolvePersonPhoto).toHaveBeenCalledTimes(3);
		expect(resolvePersonPhoto).toHaveBeenNthCalledWith(1, photographedAlice.photoPath);
		expect(resolvePersonPhoto).toHaveBeenNthCalledWith(2, photographedAlice.photoPath);
		expect(resolvePersonPhoto).toHaveBeenNthCalledWith(3, photographedAlice.photoPath);
	});

	it("localizes profile-photo live-region fallbacks without exposing the vault path", () => {
		const profile = renderPersonProfile(
			document,
			{ ...bob, photoPath: "Private/missing-person.png" },
			{
				contactHeadingLevel: 4,
				resolvePhotoResource: () => ({ status: "missing" }),
				translator: createTranslator("nl"),
			},
		);
		const explanation = profile.querySelector<HTMLElement>(".people-atlas-profile-photo-explanation");

		expect(explanation?.getAttribute("role")).toBe("status");
		expect(explanation?.getAttribute("aria-live")).toBe("polite");
		expect(explanation?.textContent).toBe(
			"Foto niet beschikbaar: de verwezen vaultafbeelding kon niet worden gevonden.",
		);
		expect(profile.textContent).not.toContain("Private/missing-person.png");
	});

	it("covers every remaining localized profile-photo fallback without exposing vault paths", () => {
		const cases: Array<{
			status: "unsupported" | "unavailable";
			expected: string;
		}> = [
			{ status: "unsupported", expected: "Foto niet beschikbaar: dit bestandstype wordt niet ondersteund." },
			{
				status: "unavailable",
				expected: "Foto niet beschikbaar: er kon geen veilige vaultresource worden voorbereid.",
			},
		];
		for (const testCase of cases) {
			const profile = renderPersonProfile(
				document,
				{ ...bob, photoPath: "Private/source.png" },
				{
					contactHeadingLevel: 4,
					resolvePhotoResource: () => ({ status: testCase.status }),
					translator: createTranslator("nl"),
				},
			);
			expect(profile.querySelector(".people-atlas-profile-photo-explanation")?.textContent).toBe(testCase.expected);
			expect(profile.textContent).not.toContain("Private/source.png");
		}

		const decoding = renderPersonProfile(
			document,
			{ ...bob, photoPath: "Private/decode.png" },
			{
				contactHeadingLevel: 4,
				resolvePhotoResource: () => ({
					status: "ready",
					resourceUrl: "about:blank#localized-profile-photo",
					cacheKey: "Private/decode.png\u00001:1",
				}),
				translator: createTranslator("nl"),
			},
		);
		document.body.append(decoding);
		const image = decoding.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
		if (!image) throw new Error("Expected a profile-photo image.");
		image.dispatchEvent(new Event("error"));
		expect(decoding.querySelector(".people-atlas-profile-photo-explanation")?.textContent).toBe(
			"Foto niet beschikbaar: de afbeelding kon niet worden gedecodeerd.",
		);
		expect(decoding.textContent).not.toContain("Private/decode.png");
	});

	it("renders private, owning-document photo fallbacks for absent, missing, unsupported, and undecodable images", () => {
		const frame = document.createElement("iframe");
		document.body.append(frame);
		const frameDocument = frame.contentDocument as Document;
		const cases: Array<{
			node: AtlasNode;
			status: "empty" | "missing" | "unsupported";
			explanation?: string;
		}> = [
			{ node: { ...bob, label: "Bob Example" }, status: "empty" },
			{
				node: { ...bob, label: "Missing Photo", photoPath: "Private/missing-person.png" },
				status: "missing",
				explanation: "Photo unavailable: the referenced vault image could not be found.",
			},
			{
				node: { ...bob, label: "Unsupported Photo", photoPath: "Private/person.pdf" },
				status: "unsupported",
				explanation: "Photo unavailable: this file type is not supported.",
			},
		];

		for (const testCase of cases) {
			const profile = renderPersonProfile(frameDocument, testCase.node, {
				contactHeadingLevel: 4,
				resolvePhotoResource: () => ({ status: testCase.status === "empty" ? "unavailable" : testCase.status }),
			});
			const photo = profile.querySelector<HTMLElement>(".people-atlas-profile-photo");
			const fallback = photo?.querySelector<HTMLElement>(".people-atlas-profile-photo-fallback");
			const explanation = photo?.querySelector<HTMLElement>(".people-atlas-profile-photo-explanation");
			expect(profile.ownerDocument).toBe(frameDocument);
			expect(photo?.dataset.photoStatus).toBe(testCase.status);
			expect(fallback?.ownerDocument).toBe(frameDocument);
			expect(fallback?.getAttribute("aria-hidden")).toBe("true");
			expect(fallback?.hidden).toBe(false);
			expect(explanation?.hidden).toBe(testCase.status === "empty");
			expect(explanation?.textContent).toBe(testCase.explanation ?? "");
			expect(profile.textContent).not.toContain(testCase.node.photoPath ?? "not-a-real-path");
			frameDocument.body.append(profile);
		}

		const readyProfile = renderPersonProfile(
			frameDocument,
			{ ...bob, label: "Ready Photo", photoPath: "Private/ready.png" },
			{
				contactHeadingLevel: 4,
				resolvePhotoResource: () => ({
					status: "ready",
					resourceUrl: "custom-vault-resource://vault-id/Private/ready.png",
					cacheKey: "Private/ready.png\u00001:1",
				}),
			},
		);
		frameDocument.body.append(readyProfile);
		const readyPhoto = readyProfile.querySelector<HTMLElement>(".people-atlas-profile-photo");
		const readyImage = readyPhoto?.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
		expect(readyImage?.ownerDocument).toBe(frameDocument);
		expect(readyImage?.alt).toBe("");
		expect(readyImage?.getAttribute("src")).toBe("custom-vault-resource://vault-id/Private/ready.png");
		if (readyPhoto?.dataset.photoStatus !== "ready") readyImage?.dispatchEvent(new Event("load"));
		expect(readyPhoto?.dataset.photoStatus).toBe("ready");
		expect(readyImage?.hidden).toBe(false);

		for (const resourceUrl of [
			"Private/raw-path.png",
			"https://example.com/remote.png",
			"ftp://example.com/remote.png",
			"wss://example.com/remote.png",
			"//example.com/remote.png",
		]) {
			const unsafeProfile = renderPersonProfile(
				frameDocument,
				{ ...bob, label: "Unsafe Photo", photoPath: "Private/raw-path.png" },
				{
					contactHeadingLevel: 4,
					resolvePhotoResource: () => ({
						status: "ready",
						resourceUrl,
						cacheKey: "Private/raw-path.png\u00001:1",
					}),
				},
			);
			frameDocument.body.append(unsafeProfile);
			expect(unsafeProfile.querySelector(".people-atlas-profile-photo")?.getAttribute("data-photo-status")).toBe(
				"unavailable",
			);
			expect(unsafeProfile.querySelector(".people-atlas-profile-photo-image")).toBeNull();
			expect(unsafeProfile.textContent).not.toContain(resourceUrl);
		}

		const decodeProfile = renderPersonProfile(
			frameDocument,
			{ ...bob, label: "Decode Failure", photoPath: "Private/decode.png" },
			{
				contactHeadingLevel: 4,
				resolvePhotoResource: () => ({
					status: "ready",
					resourceUrl: "about:blank#person-photo",
					cacheKey: "Private/decode.png\u00001:1",
				}),
			},
		);
		frameDocument.body.append(decodeProfile);
		const decodePhoto = decodeProfile.querySelector<HTMLElement>(".people-atlas-profile-photo");
		const decodeImage = decodePhoto?.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
		expect(decodePhoto?.dataset.photoStatus).toBe("loading");
		expect(decodeImage?.alt).toBe("");
		expect(decodeImage?.hidden).toBe(true);
		expect(decodePhoto?.querySelector(".people-atlas-profile-photo-fallback")?.textContent).toBe("DF");
		decodeImage?.dispatchEvent(new Event("error"));
		expect(decodePhoto?.dataset.photoStatus).toBe("decode-error");
		expect(decodePhoto?.querySelector(".people-atlas-profile-photo-image")).toBeNull();
		expect(decodePhoto?.querySelector(".people-atlas-profile-photo-explanation")?.textContent).toBe(
			"Photo unavailable: the image could not be decoded.",
		);
		expect(decodeProfile.textContent).not.toContain("Private/decode.png");
	});

	it("ignores late photo completion from replaced or destroyed renderer DOM", () => {
		const resolvePersonPhoto = vi.fn(() => ({
			status: "ready" as const,
			resourceUrl: "blob:people-atlas-pending-photo",
			cacheKey: "Assets/People/Alice portrait.png\u00001:1",
		}));
		const { renderer } = mount(snapshot([photographedAlice]), DEFAULT_SETTINGS, { resolvePersonPhoto });
		document.querySelector<HTMLButtonElement>(".people-atlas-list-mode")?.click();
		document.querySelector<HTMLButtonElement>(".people-atlas-person-button[data-node-id='person-alice']")?.click();

		const oldPhoto = document.querySelector<HTMLElement>(".people-atlas-semantic-details .people-atlas-profile-photo");
		const oldImage = oldPhoto?.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
		expect(oldPhoto?.dataset.photoStatus).toBe("loading");
		if (!oldImage) throw new Error("Expected the pending list photo.");

		renderer.setGraph(snapshot([{ ...photographedAlice, label: "Alice Updated" }]));
		const currentPhoto = document.querySelector<HTMLElement>(
			".people-atlas-semantic-details .people-atlas-profile-photo",
		);
		const currentImage = currentPhoto?.querySelector<HTMLImageElement>(".people-atlas-profile-photo-image");
		expect(currentPhoto).not.toBe(oldPhoto);
		expect(currentPhoto?.dataset.photoStatus).toBe("loading");
		expect(currentImage?.isConnected).toBe(true);

		oldImage.dispatchEvent(new Event("error"));
		expect(oldPhoto?.dataset.photoStatus).toBe("loading");
		expect(currentPhoto?.dataset.photoStatus).toBe("loading");
		expect(currentImage?.isConnected).toBe(true);

		renderer.destroy();
		currentImage?.dispatchEvent(new Event("load"));
		expect(document.querySelector(".people-atlas-renderer")).toBeNull();
		expect(document.querySelector(".people-atlas-profile-photo")).toBeNull();
	});

	it("reuses the profile presenter for standalone details and creates every node in the owning document", () => {
		const frame = document.createElement("iframe");
		document.body.append(frame);
		const frameDocument = frame.contentDocument as Document;
		const details = frameDocument.createElement("section");
		frameDocument.body.append(details);
		const view = Object.create(PeopleAtlasView.prototype) as {
			detailsEl: HTMLElement;
			plugin: {
				t: Translator;
				index: {
					getSnapshot(): { people: Array<{ id: string; filePath: string }> };
				};
				openEditPerson(path: string): void;
				openCreateRelationship(path: string): void;
			};
			renderDetails(node: AtlasNode | undefined): void;
		};
		view.detailsEl = details;
		view.plugin = {
			t: createTranslator("en"),
			index: {
				getSnapshot: () => ({ people: [{ id: profileAlice.id, filePath: profileAlice.filePath as string }] }),
			},
			openEditPerson: vi.fn(),
			openCreateRelationship: vi.fn(),
		};

		view.renderDetails(profileAlice);

		const profile = details.querySelector<HTMLElement>(".people-atlas-profile");
		expect(profile?.ownerDocument).toBe(frameDocument);
		expect(profile?.querySelector("a[href='mailto:alice@example.com']")?.ownerDocument).toBe(frameDocument);
		expect(Array.from(profile?.querySelectorAll("dt") ?? []).map((term) => term.textContent)).toEqual([
			"Pronouns",
			"Job title",
			"Organisations",
			"Birth date",
			"Gender",
			"Email",
			"Phone",
		]);
		expect(details.textContent).not.toContain("People/Alice.md");
		expect(details.textContent).not.toContain("person-alice");

		view.renderDetails(bob);
		const fallbackProfile = details.querySelector<HTMLElement>(".people-atlas-profile");
		expect(fallbackProfile?.ownerDocument).toBe(frameDocument);
		expect(fallbackProfile?.querySelector(".people-atlas-profile-photo-fallback")?.textContent).toBe("B");
		expect(fallbackProfile?.querySelector(".people-atlas-profile-photo-explanation")?.textContent).toBe("");
		expect(details.textContent).not.toContain("Pronouns");
		expect(details.textContent).not.toContain("Contact details");
	});

	it("uses one roving tab stop and implements every specified list key", async () => {
		const { callbacks } = mount();
		await page.getByRole("button", { name: "List" }).click();
		const aliceButton = page.getByRole("button", { name: "Alice, Example Org", exact: true });
		const ghostButton = page.getByRole("button", { name: "Missing, unresolved person", exact: true });
		const charlieButton = page.getByRole("button", { name: "Charlie", exact: true });

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

	it("describes parallel and inferred relationships without inventing direction metadata", async () => {
		const { callbacks } = mount(snapshot([alice, bob, charlie, ghost], edges));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();

		const relationshipRows = Array.from(
			document.querySelectorAll<HTMLLIElement>(".people-atlas-relationship-list > li"),
		);
		const relationshipItems = relationshipRows.map((item) => item.querySelector("span")?.textContent);
		expect(relationshipItems).toEqual([
			"Connected to Bob. Types: friend, colleague. Status: active. Since: January 2, 2020. Last contact: July 20, 2026.",
			"Connected to Charlie. Types: mentor. Status: dormant.",
			"Connected to Bob. Types: neighbour. Status: ended.",
			"Linked person: Missing (unresolved).",
		]);
		expect(relationshipRows.map((row) => row.dataset.edgeId)).toEqual([
			"relationship-friends",
			"relationship-mentor",
			"relationship-parallel",
			"contact-missing",
		]);
		expect(relationshipRows[2]?.dataset.relationshipPath).toBe("People/Relationships/Alice - Bob neighbour.md");
		expect(relationshipRows[3]?.querySelector("button")).toBeNull();
		expect(
			Array.from(document.querySelectorAll(".people-atlas-connection-group > h4")).map(
				(heading) => heading.textContent,
			),
		).toEqual(["Relationships", "Linked people"]);

		const workOpen = page.getByRole("button", {
			name: "Open relationship note with Bob, friend, colleague, People/Relationships/Alice - Bob.md",
		});
		await workOpen.click();
		const workOpenElement = workOpen.element() as HTMLButtonElement;
		expect(workOpenElement.tagName).toBe("BUTTON");
		expect(callbacks.onOpenRelationship).toHaveBeenCalledWith(edges[0], workOpenElement);
		await expect.element(workOpen).toHaveFocus();

		const parallelEdit = page.getByRole("button", {
			name: "Edit relationship with Bob, neighbour, People/Relationships/Alice - Bob neighbour.md",
		});
		(parallelEdit.element() as HTMLButtonElement).focus();
		await userEvent.keyboard("{Enter}");
		expect(callbacks.onEditRelationship).toHaveBeenCalledWith(edges[3], parallelEdit.element());
		await expect.element(parallelEdit).toHaveFocus();

		await expect.element(page.getByText("4 people · 4 connections")).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Open note" })).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Use as center" })).toBeInTheDocument();
	});

	it("keeps a path-resolved ambiguous counterpart visible while actions target the relationship row", async () => {
		const relationship: AtlasEdge = {
			id: "relationship-ambiguous-counterpart",
			sourceId: alice.id,
			targetId: ambiguous.id,
			types: ["family"],
			filePath: "People/Relationships/Alice - Ambiguous.md",
			inferred: false,
		};
		const { callbacks } = mount(snapshot([alice, ambiguous], [relationship]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();

		await expect
			.element(page.getByText("Connected to Ambiguous Alice (ambiguous). Types: family."))
			.toBeInTheDocument();
		const edit = page.getByRole("button", {
			name: "Edit relationship with Ambiguous Alice (ambiguous), family, People/Relationships/Alice - Ambiguous.md",
		});
		await edit.click();
		expect(callbacks.onEditRelationship).toHaveBeenCalledWith(relationship, edit.element());
	});

	it("renders explicit endpoint roles from both perspectives with the configured grammar", async () => {
		const roleEdge: AtlasEdge = {
			id: "relationship-parent-child",
			sourceId: alice.id,
			targetId: bob.id,
			types: ["parent-child"],
			fromRole: "Kind",
			toRole: "Vader",
			status: "active",
			inferred: false,
		};
		mount(snapshot([alice, bob], [roleEdge]), {
			...DEFAULT_SETTINGS,
			relationshipRoleFormat: "{role} van {person}",
		});
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
		await expect.element(page.getByText("Kind van Bob. Types: parent-child. Status: active.")).toBeInTheDocument();
		expect(document.body.textContent).not.toContain("Outgoing to Bob");
		expect(document.body.textContent).not.toContain("Incoming from Bob");

		await page.getByRole("button", { name: "Bob", exact: true }).click();
		await expect.element(page.getByText("Vader van Alice. Types: parent-child. Status: active.")).toBeInTheDocument();
		expect(document.body.textContent).not.toContain("Incoming from Alice");
		expect(document.body.textContent).not.toContain("Outgoing to Alice");
	});

	it("delegates resolved actions and keeps ghosts selectable without capabilities", async () => {
		const { callbacks } = mount(snapshot([alice, ghost, nonOpenable]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
		const openAction = page.getByRole("button", { name: "Open note" });
		const centerAction = page.getByRole("button", { name: "Use as center" });
		await openAction.click();
		await expect.element(openAction).toHaveFocus();
		await centerAction.click();
		await expect.element(centerAction).toHaveFocus();
		expect(callbacks.onOpenNode).toHaveBeenCalledWith(alice);
		expect(callbacks.onCenterNode).toHaveBeenCalledWith(alice);
		expect((centerAction.element() as HTMLButtonElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(24);

		await page.getByRole("button", { name: "Missing, unresolved person", exact: true }).click();
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
		const bobButton = page.getByRole("button", { name: "Bob", exact: true });
		await bobButton.click();
		await expect.element(bobButton).toHaveFocus();

		renderer.setGraph(snapshot([{ ...alice, label: "Alice renamed" }, { ...bob, label: "Bob renamed" }, charlie]));
		const renamedBob = page.getByRole("button", { name: "Bob renamed", exact: true });
		await expect.element(renamedBob).toHaveFocus();
		await expect.element(renamedBob).toHaveAttribute("aria-pressed", "true");

		renderer.setGraph(snapshot([{ ...alice, label: "Bob renamed" }, charlie]));
		expect(callbacks.onSelectNode).toHaveBeenLastCalledWith(undefined, "graph-update");
		await expect.element(page.getByRole("button", { name: "Bob renamed, Example Org", exact: true })).toHaveFocus();

		renderer.setGraph(snapshot([]));
		await expect.element(page.getByText("No people in the current atlas")).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "List" })).toHaveFocus();
	});

	it("preserves equivalent selected action focus through graph updates", async () => {
		const { renderer } = mount(snapshot([alice, bob]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
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

	it("preserves relationship action focus and falls back to the selected heading when capability changes", async () => {
		const { renderer, callbacks } = mount(snapshot([alice, bob], [edges[0] as AtlasEdge]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();

		const accessibleName = "Edit relationship with Bob, friend, colleague, People/Relationships/Alice - Bob.md";
		const initialEdit = page.getByRole("button", { name: accessibleName });
		(initialEdit.element() as HTMLButtonElement).focus();
		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated" }, bob], [edges[0] as AtlasEdge]));

		const updatedEdit = page.getByRole("button", { name: accessibleName });
		await expect.element(updatedEdit).toHaveFocus();
		const updatedInvoker = updatedEdit.element() as HTMLButtonElement;
		(document.querySelector(".people-atlas-list-mode") as HTMLButtonElement).focus();
		renderer.restoreRelationshipActionFocus(updatedInvoker);
		await expect.element(updatedEdit).toHaveFocus();

		callbacks.canEditRelationship.mockReturnValue(false);
		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated again" }, bob], [edges[0] as AtlasEdge]));
		expect(document.querySelector(`button[aria-label="${accessibleName}"]`)).toBeNull();
		const heading = page.getByRole("heading", { name: "Alice updated again", exact: true });
		await expect.element(heading).toHaveFocus();

		(document.querySelector(".people-atlas-list-mode") as HTMLButtonElement).focus();
		renderer.restoreRelationshipActionFocus(updatedInvoker);
		await expect.element(heading).toHaveFocus();
		updatedInvoker.click();
		expect(callbacks.onEditRelationship).not.toHaveBeenCalled();
	});

	it("preserves sheet relationship focus by stable row identity and removes stale capabilities", async () => {
		const relationship = edges[0] as AtlasEdge;
		const { renderer, callbacks } = mount(snapshot([alice, bob], [relationship]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
		await page.getByRole("button", { name: "Graph" }).click();
		await page.getByRole("button", { name: "Details" }).click();

		const accessibleName = "Edit relationship with Bob, friend, colleague, People/Relationships/Alice - Bob.md";
		const initialEdit = page.getByRole("button", { name: accessibleName });
		(initialEdit.element() as HTMLButtonElement).focus();
		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated" }, bob], [relationship]));
		await expect.element(page.getByRole("button", { name: accessibleName })).toHaveFocus();

		callbacks.canEditRelationship.mockReturnValue(false);
		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated again" }, bob], [relationship]));
		const dialog = page.getByRole("dialog", { name: "Selected person details" });
		expect((dialog.element() as HTMLDialogElement).open).toBe(true);
		expect((dialog.element() as HTMLDialogElement).querySelector(`button[aria-label="${accessibleName}"]`)).toBeNull();
		await expect.element(page.getByRole("heading", { name: "Alice updated again", exact: true })).toHaveFocus();
	});

	it("cleans delegated relationship actions and focus restoration on destroy", async () => {
		const { renderer, callbacks } = mount(snapshot([alice, bob], [edges[0] as AtlasEdge]));
		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
		const open = page.getByRole("button", {
			name: "Open relationship note with Bob, friend, colleague, People/Relationships/Alice - Bob.md",
		});
		const detachedInvoker = open.element() as HTMLButtonElement;

		renderer.destroy();
		detachedInvoker.click();
		expect(callbacks.onOpenRelationship).not.toHaveBeenCalled();
		expect(() => renderer.restoreRelationshipActionFocus(detachedInvoker)).not.toThrow();
		expect(document.querySelector(".people-atlas-renderer")).toBeNull();
	});

	it("provides touch-sized graph alternatives and a guarded modal details sheet", async () => {
		await page.viewport(390, 700);
		const touchMoment: ContactMomentSummary = {
			id: "moment-touch-target",
			filePath: "People/Contact moments/Touch target.md",
			personIds: [alice.id],
			occurredOn: "2026-07-30",
			summary: "Touch target check",
		};
		const { renderer, callbacks } = mount(
			snapshot([alice, bob, ghost, ambiguous], edges, [touchMoment]),
			DEFAULT_SETTINGS,
			{
				canOpenContactMoment: () => true,
				onOpenContactMoment: vi.fn(),
				canEditContactMoment: () => true,
				onEditContactMoment: vi.fn(),
			},
		);
		const details = page.getByRole("button", { name: "Details" });
		await expect.element(details).toBeDisabled();
		for (const name of ["Zoom out", "Zoom in", "Fit", "Details"]) {
			await expect.element(page.getByRole("button", { name })).toBeInTheDocument();
		}

		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
		const contactMomentActions = Array.from(
			document.querySelectorAll<HTMLButtonElement>(
				".people-atlas-semantic-details .people-atlas-contact-moment-actions button",
			),
		);
		expect(contactMomentActions).toHaveLength(2);
		for (const action of contactMomentActions) {
			const box = action.getBoundingClientRect();
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
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
		const descriptions = Array.from(dialogElement.querySelectorAll(".people-atlas-relationship-list > li > span")).map(
			(item) => item.textContent,
		);
		expect(descriptions).toEqual([
			"Connected to Bob. Types: friend, colleague. Status: active. Since: January 2, 2020. Last contact: July 20, 2026.",
			"Connected to Bob. Types: neighbour. Status: ended.",
			"Linked person: Missing (unresolved).",
		]);
		await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
		await expect.element(page.getByRole("button", { name: "Log contact" })).toHaveFocus();
		renderer.setGraph(snapshot([{ ...alice, label: "Alice updated" }, bob, ghost, ambiguous], edges));
		expect(dialogElement.open).toBe(true);
		await expect.element(page.getByRole("heading", { name: "Alice updated" })).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Log contact" })).toHaveFocus();
		await page.getByRole("button", { name: "Close" }).click();
		await expect.element(details).toHaveFocus();

		await details.click();
		await userEvent.keyboard("{Escape}");
		expect(dialogElement.open).toBe(false);
		await expect.element(details).toHaveFocus();

		const requestedActionFocus = document.createElement("button");
		requestedActionFocus.textContent = "Requested relationship action focus";
		document.body.append(requestedActionFocus);
		callbacks.onEditRelationship.mockImplementation((_edge: AtlasEdge, invoker: HTMLButtonElement) => {
			expect(dialogElement.open).toBe(false);
			expect(invoker.ownerDocument).toBe(document);
			expect(document.activeElement).toBe(invoker);
			requestedActionFocus.focus();
		});
		await details.click();
		const sheetRelationshipEdit = page.getByRole("button", {
			name: "Edit relationship with Bob, friend, colleague, People/Relationships/Alice - Bob.md",
		});
		const sheetRelationshipEditElement = sheetRelationshipEdit.element() as HTMLButtonElement;
		await sheetRelationshipEdit.click();
		expect(dialogElement.open).toBe(false);
		await expect.element(requestedActionFocus).toHaveFocus();
		expect(callbacks.onEditRelationship).toHaveBeenCalledWith(edges[0], sheetRelationshipEditElement);

		callbacks.onOpenRelationship.mockImplementation(async (_edge: AtlasEdge, invoker: HTMLButtonElement) => {
			expect(dialogElement.open).toBe(false);
			expect(document.activeElement).toBe(invoker);
			await Promise.resolve();
			requestedActionFocus.focus();
		});
		await details.click();
		const sheetRelationshipOpen = page.getByRole("button", {
			name: "Open relationship note with Bob, friend, colleague, People/Relationships/Alice - Bob.md",
		});
		const sheetRelationshipOpenElement = sheetRelationshipOpen.element() as HTMLButtonElement;
		await sheetRelationshipOpen.click();
		expect(dialogElement.open).toBe(false);
		await expect.element(requestedActionFocus).toHaveFocus();
		expect(callbacks.onOpenRelationship).toHaveBeenCalledWith(edges[0], sheetRelationshipOpenElement);

		callbacks.onOpenNode.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Open note" }).click();
		expect(callbacks.onOpenNode).toHaveBeenCalledOnce();
		callbacks.onCenterNode.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Use as center" }).click();
		expect(callbacks.onCenterNode).toHaveBeenCalledOnce();
		callbacks.onEditPerson.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Edit person" }).click();
		expect(callbacks.onEditPerson).toHaveBeenCalledOnce();
		expect(callbacks.onEditPerson).toHaveBeenCalledWith(
			expect.objectContaining({ id: alice.id, label: "Alice updated" }),
		);
		callbacks.onCreateRelationship.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Create relationship" }).click();
		expect(dialogElement.open).toBe(false);
		expect(callbacks.onCreateRelationship).toHaveBeenCalledOnce();
		expect(callbacks.onCreateRelationship).toHaveBeenCalledWith(
			expect.objectContaining({ id: alice.id, label: "Alice updated" }),
		);
		callbacks.onLogContact.mockImplementation(() => expect(dialogElement.open).toBe(false));
		await details.click();
		await page.getByRole("button", { name: "Log contact" }).click();
		expect(dialogElement.open).toBe(false);
		expect(callbacks.onLogContact).toHaveBeenCalledOnce();
		expect(callbacks.onLogContact).toHaveBeenCalledWith(
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
		expect(dialogElement.querySelector("button[aria-label='Edit person']")).toBeNull();
		expect(dialogElement.querySelector("button[aria-label='Create relationship']")).toBeNull();
		expect(dialogElement.querySelector("button[aria-label='Log contact']")).toBeNull();
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

	it("keeps the exact relationship action focus after a touch-opened sheet", async () => {
		await page.viewport(800, 600);
		const mentorRelationship = edges[1];
		if (!mentorRelationship) throw new Error("Expected the mentor relationship fixture.");
		const { callbacks } = mount(snapshot([alice, charlie], [mentorRelationship]));
		const canvas = document.querySelector<HTMLCanvasElement>(".people-atlas-canvas");
		expect(canvas).not.toBeNull();
		const box = (canvas as HTMLCanvasElement).getBoundingClientRect();
		const center = { x: box.width / 2, y: box.height / 2 };
		const previousFocus = document.createElement("button");
		previousFocus.textContent = "Previous unrelated focus";
		const requestedActionFocus = document.createElement("button");
		requestedActionFocus.textContent = "Requested touch relationship action focus";
		document.body.append(previousFocus, requestedActionFocus);
		previousFocus.focus();

		await commands.dispatchTouch(".people-atlas-canvas", [
			{ type: "touchStart", points: [{ id: 41, ...center }], delayAfterMs: 550 },
			{ type: "touchEnd", points: [] },
		]);
		const dialog = document.querySelector<HTMLDialogElement>(".people-atlas-details-sheet");
		expect(dialog?.open).toBe(true);
		await expect.element(page.getByRole("button", { name: "Close" })).toHaveFocus();

		callbacks.onEditRelationship.mockImplementation((_edge: AtlasEdge, invoker: HTMLButtonElement) => {
			expect(dialog?.open).toBe(false);
			expect(document.activeElement).toBe(invoker);
			requestedActionFocus.focus();
		});
		const relationshipEdit = page.getByRole("button", {
			name: "Edit relationship with Charlie, mentor, People/Relationships/Charlie - Alice mentor.md",
		});
		const relationshipEditElement = relationshipEdit.element() as HTMLButtonElement;
		await relationshipEdit.click();

		await expect.element(requestedActionFocus).toHaveFocus();
		expect(callbacks.onEditRelationship).toHaveBeenCalledWith(mentorRelationship, relationshipEditElement);
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
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
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

	it("renders bounded selected history and the public grouped Follow-ups mode from snapshot summaries", async () => {
		const moments: ContactMomentSummary[] = [
			{
				id: "moment-overdue",
				filePath: "People/Contact moments/Overdue.md",
				personIds: [alice.id],
				relationshipId: "relationship-friends",
				occurredOn: "2026-07-25",
				channel: "Call",
				summary: "Planned a museum visit",
				followUpOn: localDay(-2),
				followUpStatus: "open",
			},
			{
				id: "moment-today",
				filePath: "People/Contact moments/Today.md",
				personIds: [alice.id, bob.id],
				occurredOn: "2026-07-24",
				summary: "Shared project notes",
				followUpOn: localDay(0),
			},
			{
				id: "moment-upcoming",
				filePath: "People/Contact moments/Upcoming.md",
				personIds: [bob.id],
				occurredOn: "2026-07-23",
				followUpOn: localDay(2),
				followUpStatus: "open",
			},
			{
				id: "moment-terminal",
				filePath: "People/Contact moments/Done.md",
				personIds: [alice.id],
				occurredOn: "2026-07-22",
				followUpOn: localDay(-4),
				followUpStatus: "done",
			},
			{
				id: "moment-history",
				filePath: "People/Contact moments/History.md",
				personIds: [alice.id],
				occurredOn: "2026-07-21",
				channel: "Message",
			},
		];
		const onOpenContactMoment = vi.fn();
		const onEditContactMoment = vi.fn();
		const { renderer } = mount(snapshot([alice, bob], [edges[0] as AtlasEdge], moments, 2), DEFAULT_SETTINGS, {
			canOpenContactMoment: () => true,
			onOpenContactMoment,
			canEditContactMoment: () => true,
			onEditContactMoment,
			canUpdateFollowUp: () => true,
			onUpdateFollowUp: () => true,
		});

		await page.getByRole("button", { name: "List" }).click();
		await page.getByRole("button", { name: "Alice, Example Org", exact: true }).click();
		const recentRows = document.querySelectorAll(
			".people-atlas-semantic-details .people-atlas-contact-moment-recent li",
		);
		expect(recentRows).toHaveLength(3);
		expect(Array.from(recentRows).map((row) => row.getAttribute("data-contact-moment-id"))).toEqual([
			"moment-overdue",
			"moment-today",
			"moment-terminal",
		]);
		expect(document.querySelector(".people-atlas-next-follow-up")?.textContent).toContain(
			createTranslator("en").formatDateOnly(localDay(-2)),
		);
		expect(document.querySelector(".people-atlas-next-follow-up")?.textContent).toContain("museum visit");
		expect(document.querySelector(".people-atlas-semantic-summary")?.textContent).toContain("2 contact moments hidden");

		await page.getByRole("button", { name: "View all contact moments" }).click();
		expect(
			document.querySelectorAll(".people-atlas-semantic-details .people-atlas-contact-moment-recent li"),
		).toHaveLength(4);
		await expect
			.element(page.getByRole("button", { name: "Show recent contact moments" }))
			.toHaveAttribute("aria-expanded", "true");

		const historyOpen = document.querySelector<HTMLButtonElement>(
			'.people-atlas-semantic-details .people-atlas-contact-moment-recent li[data-contact-moment-id="moment-overdue"] button[data-contact-moment-action="open"]',
		);
		expect(historyOpen?.getAttribute("aria-label")).toBe(
			"Open contact moment for Alice, July 25, 2026, Planned a museum visit",
		);
		await userEvent.click(historyOpen as HTMLButtonElement);
		expect(onOpenContactMoment).toHaveBeenCalledWith(moments[0], historyOpen);

		renderer.showFollowUps();
		await expect.element(page.getByRole("button", { name: "Follow-ups" })).toHaveAttribute("aria-pressed", "true");
		expect(document.querySelector<HTMLElement>(".people-atlas-follow-ups-panel")?.hidden).toBe(false);
		expect(document.querySelector<HTMLElement>(".people-atlas-semantic-panel")?.hidden).toBe(true);
		expect(document.querySelector(".people-atlas-follow-ups-summary")?.textContent).toContain(
			"2 contact moments hidden",
		);
		expect(
			Array.from(
				document.querySelectorAll<HTMLLIElement>('[data-follow-up-group="overdue"] [data-contact-moment-row]'),
			).map((row) => row.dataset.contactMomentId),
		).toEqual(["moment-overdue"]);
		expect(
			Array.from(
				document.querySelectorAll<HTMLLIElement>('[data-follow-up-group="due-today"] [data-contact-moment-row]'),
			).map((row) => row.dataset.contactMomentId),
		).toEqual(["moment-today"]);
		expect(
			Array.from(
				document.querySelectorAll<HTMLLIElement>('[data-follow-up-group="upcoming"] [data-contact-moment-row]'),
			).map((row) => row.dataset.contactMomentId),
		).toEqual(["moment-upcoming"]);
		expect(
			document.querySelector('.people-atlas-follow-ups-panel [data-contact-moment-id="moment-terminal"]'),
		).toBeNull();
		const overdueText =
			document.querySelector('.people-atlas-follow-ups-panel [data-contact-moment-id="moment-overdue"]')?.textContent ??
			"";
		expect(overdueText).toContain("Alice");
		expect(overdueText).toContain("July 25, 2026");
		expect(overdueText).toContain("Call");
		expect(overdueText).toContain("Alice and Bob · friend, colleague");
		expect(
			document
				.querySelector<HTMLButtonElement>(
					'[data-contact-moment-id="moment-overdue"] button[data-contact-moment-action="done"]',
				)
				?.getAttribute("aria-label"),
		).toContain(`for Alice, due ${createTranslator("en").formatDateOnly(localDay(-2))}`);
	});

	it("rechecks stale capabilities and restores logical focus after a follow-up row is removed", async () => {
		const overdue: ContactMomentSummary = {
			id: "moment-a",
			filePath: "People/Contact moments/A.md",
			personIds: [alice.id],
			occurredOn: "2026-07-20",
			followUpOn: localDay(-2),
			followUpStatus: "open",
		};
		const today: ContactMomentSummary = {
			id: "moment-b",
			filePath: "People/Contact moments/B.md",
			personIds: [bob.id],
			occurredOn: "2026-07-21",
			followUpOn: localDay(0),
			followUpStatus: "open",
		};
		let canOpen = true;
		let renderer: AtlasRenderer;
		const onOpenContactMoment = vi.fn();
		const unavailableInvokerStates: boolean[] = [];
		const onContactMomentActionUnavailable = vi.fn(
			(_moment: ContactMomentSummary, _action: "open" | "edit" | "done" | "dismiss", invoker: HTMLButtonElement) => {
				unavailableInvokerStates.push(invoker.isConnected);
			},
		);
		const onUpdateFollowUp = vi.fn(
			(moment: ContactMomentSummary, status: "done" | "dismissed", invoker: HTMLButtonElement) => {
				void invoker;
				renderer.setGraph(snapshot([alice, bob], [], [{ ...moment, followUpStatus: status }, today]));
				return true;
			},
		);
		({ renderer } = mount(snapshot([alice, bob], [], [overdue, today]), DEFAULT_SETTINGS, {
			canOpenContactMoment: () => canOpen,
			onOpenContactMoment,
			onContactMomentActionUnavailable,
			canEditContactMoment: () => true,
			onEditContactMoment: vi.fn(),
			canUpdateFollowUp: () => true,
			onUpdateFollowUp,
		}));
		renderer.showFollowUps();

		const done = document.querySelector<HTMLButtonElement>(
			'[data-contact-moment-id="moment-a"] button[data-contact-moment-action="done"]',
		);
		expect(done).not.toBeNull();
		await userEvent.click(done as HTMLButtonElement);
		expect(onUpdateFollowUp).toHaveBeenCalledWith(overdue, "done", done);
		expect(document.querySelector('[data-contact-moment-id="moment-a"]')).toBeNull();
		expect(document.activeElement?.getAttribute("data-contact-moment-id")).toBe("moment-b");

		const open = document.querySelector<HTMLButtonElement>(
			'[data-contact-moment-id="moment-b"] button[data-contact-moment-action="open"]',
		);
		expect(open).not.toBeNull();
		canOpen = false;
		await userEvent.click(open as HTMLButtonElement);
		expect(onOpenContactMoment).not.toHaveBeenCalled();
		expect(onContactMomentActionUnavailable).toHaveBeenCalledWith(today, "open", open);
		expect(unavailableInvokerStates).toEqual([true]);
		expect(
			document.querySelector('[data-contact-moment-id="moment-b"] button[data-contact-moment-action="open"]'),
		).toBeNull();
		expect(document.activeElement?.getAttribute("data-contact-moment-row")).toBe("moment-b");
	});

	it("settles busy state on the current identity after a deferred follow-up update and graph refresh", async () => {
		const moment: ContactMomentSummary = {
			id: "moment-deferred",
			filePath: "People/Contact moments/Deferred.md",
			personIds: [alice.id],
			occurredOn: "2026-07-29",
			followUpOn: localDay(0),
			followUpStatus: "open",
		};
		let settleUpdate: ((accepted: boolean) => void) | undefined;
		const onUpdateFollowUp = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					settleUpdate = resolve;
				}),
		);
		const { renderer } = mount(snapshot([alice], [], [moment]), DEFAULT_SETTINGS, {
			canOpenContactMoment: () => true,
			onOpenContactMoment: vi.fn(),
			canEditContactMoment: () => true,
			onEditContactMoment: vi.fn(),
			canUpdateFollowUp: () => true,
			onUpdateFollowUp,
		});
		renderer.showFollowUps();

		const initialDone = document.querySelector<HTMLButtonElement>(
			'[data-contact-moment-id="moment-deferred"] button[data-contact-moment-action="done"]',
		);
		expect(initialDone).not.toBeNull();
		await userEvent.click(initialDone as HTMLButtonElement);
		await vi.waitFor(() => expect(onUpdateFollowUp).toHaveBeenCalledOnce());
		expect(document.querySelector('[data-contact-moment-id="moment-deferred"]')?.getAttribute("aria-busy")).toBe(
			"true",
		);

		renderer.setGraph(snapshot([alice], [], [{ ...moment, summary: "Refreshed while pending" }]));
		const currentRow = document.querySelector<HTMLLIElement>('[data-contact-moment-id="moment-deferred"]');
		const currentDone = currentRow?.querySelector<HTMLButtonElement>('button[data-contact-moment-action="done"]');
		const currentDismiss = currentRow?.querySelector<HTMLButtonElement>('button[data-contact-moment-action="dismiss"]');
		expect(currentDone).not.toBe(initialDone);
		expect(currentRow?.getAttribute("aria-busy")).toBe("true");
		expect(currentDone?.getAttribute("aria-disabled")).toBe("true");
		expect(currentDismiss?.getAttribute("aria-disabled")).toBe("true");
		expect(document.activeElement).toBe(currentDone);

		if (!settleUpdate) throw new Error("Deferred follow-up callback did not expose its resolver");
		settleUpdate(false);
		await vi.waitFor(() => expect(currentRow?.getAttribute("aria-busy")).toBeNull());
		expect(currentDone?.getAttribute("aria-disabled")).toBeNull();
		expect(currentDismiss?.getAttribute("aria-disabled")).toBeNull();
		expect(document.activeElement).toBe(currentDone);
	});

	it("gives duplicate contact actions unique visible-context names without path or ID labels", () => {
		const duplicateMoments: ContactMomentSummary[] = [
			{
				id: "private-moment-a",
				filePath: "People/Contact moments/Private A.md",
				personIds: [alice.id],
				occurredOn: "2026-07-28",
				channel: "Call",
				summary: "Same visible summary",
				followUpOn: localDay(0),
				followUpStatus: "open",
			},
			{
				id: "private-moment-b",
				filePath: "People/Contact moments/Private B.md",
				personIds: [alice.id],
				occurredOn: "2026-07-28",
				channel: "Call",
				summary: "Same visible summary",
				followUpOn: localDay(0),
				followUpStatus: "open",
			},
		];
		const { renderer } = mount(snapshot([alice], [], duplicateMoments), DEFAULT_SETTINGS, {
			canOpenContactMoment: () => true,
			onOpenContactMoment: vi.fn(),
			canEditContactMoment: () => true,
			onEditContactMoment: vi.fn(),
			canUpdateFollowUp: () => true,
			onUpdateFollowUp: vi.fn(() => true),
		});
		renderer.showFollowUps();

		for (const action of ["open", "edit", "done", "dismiss"]) {
			const labels = Array.from(
				document.querySelectorAll<HTMLButtonElement>(`button[data-contact-moment-action="${action}"]`),
				(button) => button.getAttribute("aria-label") ?? "",
			);
			expect(labels).toHaveLength(2);
			expect(new Set(labels).size).toBe(2);
			expect(labels).toEqual(
				expect.arrayContaining([
					expect.stringContaining("Same visible summary, contact 1 of 2"),
					expect.stringContaining("Same visible summary, contact 2 of 2"),
				]),
			);
			for (const privateValue of [
				"private-moment-a",
				"private-moment-b",
				"People/Contact moments/Private A.md",
				"People/Contact moments/Private B.md",
			]) {
				expect(labels.every((label) => !label.includes(privateValue))).toBe(true);
			}
		}
	});

	it("refreshes follow-up day groups on the owning Window timer and cancels it on mode change and destroy", () => {
		const frame = document.createElement("iframe");
		document.body.append(frame);
		const frameWindow = frame.contentWindow as Window & typeof globalThis;
		const frameDocument = frame.contentDocument as Document;
		const NativeDate = frameWindow.Date;
		let now = new NativeDate(2026, 6, 31, 23, 59, 50).getTime();
		const ControlledDate = new Proxy(NativeDate, {
			construct(target, argumentsList) {
				return argumentsList.length === 0 ? Reflect.construct(target, [now]) : Reflect.construct(target, argumentsList);
			},
		});
		Object.defineProperty(frameWindow, "Date", { configurable: true, value: ControlledDate });
		Object.defineProperty(frameWindow, "requestAnimationFrame", {
			configurable: true,
			value: vi.fn(() => 1),
		});
		Object.defineProperty(frameWindow, "cancelAnimationFrame", { configurable: true, value: vi.fn() });
		class FrameResizeObserver {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
		Object.defineProperty(frameWindow, "ResizeObserver", {
			configurable: true,
			value: FrameResizeObserver,
		});
		let nextTimer = 40;
		const timers = new Map<number, () => void>();
		const setTimeout = vi.fn((handler: TimerHandler) => {
			const timer = ++nextTimer;
			if (typeof handler === "function") timers.set(timer, () => handler());
			return timer;
		});
		const clearTimeout = vi.fn((timer: number) => {
			timers.delete(timer);
		});
		Object.defineProperty(frameWindow, "setTimeout", { configurable: true, value: setTimeout });
		Object.defineProperty(frameWindow, "clearTimeout", { configurable: true, value: clearTimeout });

		const container = frameDocument.createElement("div");
		frameDocument.body.append(container);
		const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, {
			onOpenNode: vi.fn(),
			onCenterNode: vi.fn(),
			onSelectNode: vi.fn(),
		});
		renderer.setGraph(
			snapshot(
				[alice],
				[],
				[
					{
						id: "midnight-moment",
						filePath: "People/Contact moments/Midnight.md",
						personIds: [alice.id],
						occurredOn: "2026-07-20",
						followUpOn: "2026-08-01",
						followUpStatus: "open",
					},
				],
			),
		);
		renderer.showFollowUps();
		expect(frameDocument.querySelector('[data-follow-up-group="upcoming"]')).not.toBeNull();
		expect(setTimeout).toHaveBeenCalledOnce();
		const firstTimer = nextTimer;
		const firstRefresh = timers.get(firstTimer);
		expect(firstRefresh).toBeTypeOf("function");

		now = new NativeDate(2026, 7, 1, 0, 0, 1).getTime();
		timers.delete(firstTimer);
		firstRefresh?.();
		expect(frameDocument.querySelector('[data-follow-up-group="upcoming"]')).toBeNull();
		expect(frameDocument.querySelector('[data-follow-up-group="due-today"]')).not.toBeNull();
		expect(setTimeout).toHaveBeenCalledTimes(2);
		const secondTimer = nextTimer;

		frameDocument.querySelector<HTMLButtonElement>(".people-atlas-list-mode")?.click();
		expect(clearTimeout).toHaveBeenCalledWith(secondTimer);
		expect(timers.size).toBe(0);
		renderer.showFollowUps();
		const destroyTimer = nextTimer;
		renderer.destroy();
		expect(clearTimeout).toHaveBeenCalledWith(destroyTimer);
		expect(timers.size).toBe(0);
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
			constructor(callback: ResizeObserverCallback) {
				void callback;
			}
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
		frameRenderer.setGraph(snapshot([profileAlice]));
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
		expect(frameSheet?.querySelector(".people-atlas-profile")?.ownerDocument).toBe(frameDocument);
		expect(frameSheet?.querySelector("a[href='mailto:alice@example.com']")?.ownerDocument).toBe(frameDocument);

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
