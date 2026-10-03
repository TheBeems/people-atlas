import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import type { AtlasEdge, AtlasNode, AtlasSnapshot, ContactMomentSummary } from "../../src/domain/types";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import { AttentionPanel } from "../../src/render/attention-panel";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { createTranslator } from "../../src/i18n";
import "../../styles.css";

const cleanups: Array<() => void> = [];
const t = createTranslator("en");
function person(id: string, birthDate?: string): AtlasNode {
	return {
		id,
		personId: id,
		kind: "person",
		label: id,
		filePath: `People/${id}.md`,
		organisations: [],
		emails: [],
		phones: [],
		isCenter: false,
		...(birthDate ? { birthDate } : {}),
	};
}
function moment(id: string, followUpStatus?: ContactMomentSummary["followUpStatus"]): ContactMomentSummary {
	return {
		id,
		filePath: `Moments/${id}.md`,
		personIds: ["alice"],
		occurredOn: "2026-09-30",
		followUpOn: "2999-01-01",
		summary: id,
		...(followUpStatus ? { followUpStatus } : {}),
	};
}
function snapshot(
	nodes: AtlasNode[],
	contactMoments: ContactMomentSummary[] = [],
	edges: AtlasEdge[] = [],
): AtlasSnapshot {
	return {
		nodes,
		edges,
		contactMoments,
		diagnostics: [],
		hiddenNodeCount: 0,
		hiddenEdgeCount: 0,
		hiddenContactMomentCount: 0,
		generatedAt: 1,
	};
}
function mount(graph: AtlasSnapshot, permitted = graph, overrides: Partial<AtlasRendererCallbacks> = {}) {
	const container = document.createElement("div");
	container.className = "people-atlas-graph";
	container.style.width = "350px";
	container.style.height = "620px";
	container.style.fontFamily = "system-ui";
	container.style.fontSize = "14px";
	container.style.lineHeight = "1.4";
	for (const [property, value] of Object.entries({
		"--background-primary": "Canvas",
		"--text-normal": "CanvasText",
		"--text-muted": "GrayText",
		"--background-modifier-border": "GrayText",
		"--interactive-accent": "Highlight",
		"--text-on-accent": "HighlightText",
		"--size-4-1": "4px",
		"--size-4-2": "8px",
		"--size-4-3": "12px",
		"--size-4-4": "16px",
		"--font-semibold": "600",
	}))
		container.style.setProperty(property, value);
	const hostStyle = document.createElement("style");
	hostStyle.textContent =
		".people-atlas-graph button, .people-atlas-graph select, .people-atlas-graph input { font: inherit; }";
	container.append(hostStyle);
	document.body.append(container);
	const callbacks: AtlasRendererCallbacks = {
		onOpenNode: vi.fn(),
		onCenterNode: vi.fn(),
		onSelectNode: vi.fn(),
		canOpenContactMoment: () => true,
		onOpenContactMoment: vi.fn(),
		canUpdateFollowUp: () => true,
		onUpdateFollowUp: vi.fn(() => true),
		canChangeFollowUp: () => true,
		onChangeFollowUp: vi.fn(() => true),
		canLogContact: () => true,
		onLogContact: vi.fn(),
		onContactMomentActionUnavailable: vi.fn(),
		...overrides,
	};
	const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks, t);
	renderer.setGraph(graph, undefined, permitted);
	renderer.showFollowUps();
	cleanups.push(() => renderer.destroy());
	return { container, renderer, callbacks };
}
function required<T extends Element>(container: ParentNode, selector: string): T {
	const element = container.querySelector<T>(selector);
	if (!element) throw new Error(`Missing required attention element ${selector}`);
	return element;
}
function status(container: HTMLElement, value: string): void {
	const select = required<HTMLSelectElement>(container, `select[aria-label="${t.followUpAttention.filter}"]`);
	select.value = value;
	select.dispatchEvent(new Event("change", { bubbles: true }));
}
function action(container: HTMLElement, id: string, type: string): HTMLButtonElement {
	const button = container.querySelector<HTMLButtonElement>(
		`button[data-contact-moment-id="${id}"][data-contact-moment-action="${type}"]`,
	);
	if (!button) throw new Error(`Missing ${type} action for ${id}`);
	return button;
}
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("explicit follow-up attention", () => {
	it("defaults to open and shows completed/dismissed groups without urgent terminal rows", async () => {
		const rows = [
			moment("open"),
			{ ...moment("done", "done"), followUpOn: "2000-01-01" },
			{ ...moment("dismissed", "dismissed"), followUpOn: "2000-01-02" },
		];
		const { container, callbacks } = mount(snapshot([person("alice")], rows));
		expect(container.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(1);
		const postpone = action(container, "open", "postpone");
		expect(postpone.textContent).toBe(t.followUpAttention.postpone({ date: t.formatDateOnly("2999-01-08") }));
		expect(postpone.getAttribute("aria-label")).toContain(t.formatDateOnly("2999-01-08"));
		expect(container.querySelector<HTMLElement>(".people-atlas-network-insight")?.hidden).toBe(true);
		const panel = required<HTMLElement>(container, ".people-atlas-follow-ups-panel");
		expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(container.getBoundingClientRect().bottom + 1);
		expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
		expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
		expect(postpone.getBoundingClientRect().width).toBeGreaterThan(200);
		await page.screenshot({ element: container, path: "../../.10x/evidence/2026-10-03-attention-narrow.png" });
		panel.scrollTop +=
			postpone.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientHeight / 2;
		await page.screenshot({ element: container, path: "../../.10x/evidence/2026-10-03-attention-actions-narrow.png" });
		status(container, "done");
		expect(container.querySelector('[data-follow-up-group="done"]')).not.toBeNull();
		expect(container.querySelector('[data-follow-up-group="overdue"]')).toBeNull();
		expect(
			container.querySelectorAll('[data-contact-moment-action="done"], [data-contact-moment-action="postpone"]'),
		).toHaveLength(0);
		action(container, "done", "reopen").click();
		expect(callbacks.onChangeFollowUp).toHaveBeenCalledWith(
			rows[1],
			"reopen",
			undefined,
			expect.any(HTMLButtonElement),
		);
		status(container, "dismissed");
		expect(container.querySelector('[data-follow-up-group="dismissed"]')).not.toBeNull();
		expect(container.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(1);
		status(container, "all");
		expect(container.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(3);
		expect(container.querySelector('[data-follow-up-group="overdue"]')).toBeNull();
		expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
		required<HTMLButtonElement>(container, ".people-atlas-list-mode").click();
		expect(container.querySelector<HTMLElement>(".people-atlas-network-insight")?.hidden).toBe(false);
		required<HTMLButtonElement>(container, ".people-atlas-follow-ups-mode").click();
		expect(container.querySelector<HTMLElement>(".people-atlas-network-insight")?.hidden).toBe(true);
	});

	it("keeps one pending postponed write, then recovers focus after failure and after reopen removal", async () => {
		let finish: ((accepted: boolean) => void) | undefined;
		const onChangeFollowUp = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					finish = resolve;
				}),
		);
		const rows: [ContactMomentSummary, ContactMomentSummary, ContactMomentSummary] = [
			moment("open"),
			moment("done", "done"),
			moment("later-done", "done"),
		];
		const full = snapshot([person("alice")], rows);
		const { container, renderer } = mount(full, full, { onChangeFollowUp });
		const postpone = action(container, "open", "postpone");
		postpone.focus();
		postpone.click();
		postpone.click();
		expect(onChangeFollowUp).toHaveBeenCalledOnce();
		expect(onChangeFollowUp).toHaveBeenCalledWith(rows[0], "postpone", "2999-01-08", postpone);
		expect(postpone.getAttribute("aria-disabled")).toBe("true");
		expect(postpone.closest("li")?.getAttribute("aria-busy")).toBe("true");
		finish?.(false);
		await vi.waitFor(() => expect(postpone.hasAttribute("aria-disabled")).toBe(false));
		expect(document.activeElement).toBe(postpone);
		status(container, "done");
		const reopen = action(container, "done", "reopen");
		reopen.focus();
		renderer.setGraph({ ...full, contactMoments: [rows[0], { ...rows[1], followUpStatus: "open" }, rows[2]] });
		expect(document.activeElement?.getAttribute("data-contact-moment-id")).toBe("later-done");
	});

	it("rejects changed reviewed fields even when a cached button retains the same moment ID/path", () => {
		const reviewed = moment("open");
		const full = snapshot([person("alice")], [reviewed]);
		const { container, callbacks } = mount(full);
		const postpone = action(container, "open", "postpone");
		full.contactMoments = [{ ...reviewed, summary: "Changed after review", followUpOn: "2999-01-02" }];
		postpone.click();
		expect(callbacks.onChangeFollowUp).not.toHaveBeenCalled();
		expect(callbacks.onContactMomentActionUnavailable).toHaveBeenCalledOnce();
	});

	it("binds the review to copied fields when the cached snapshot is mutated in place", () => {
		const reviewed = { ...moment("open"), followUpOn: "2000-01-01" };
		const full = snapshot([person("alice")], [reviewed]);
		const { container, callbacks } = mount(full);
		const postpone = action(container, "open", "postpone");
		reviewed.summary = "Changed in place";
		reviewed.followUpOn = "2000-01-02";
		reviewed.personIds.push("bob");
		postpone.click();
		expect(callbacks.onChangeFollowUp).not.toHaveBeenCalled();
		expect(callbacks.onContactMomentActionUnavailable).toHaveBeenCalledOnce();
	});

	it("uses only the independently chosen permitted attention population", () => {
		const today = new Date();
		const birthday = `--${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
		const alice = person("alice", birthday);
		const bob = person("bob", birthday);
		const edge: AtlasEdge = {
			id: "friend",
			sourceId: alice.id,
			targetId: bob.id,
			filePath: "Relationships/Friend.md",
			types: ["friend"],
			inferred: false,
			lastContact: "2000-01-01",
			contactIntervalDays: 7,
		};
		const full = snapshot([alice, bob], [], [edge]);
		const { container, callbacks } = mount(snapshot([alice]), full);
		expect(container.querySelectorAll("[data-birthday-person-id]")).toHaveLength(1);
		expect(container.querySelectorAll("[data-cadence-relationship-id]")).toHaveLength(0);
		const scope = required<HTMLSelectElement>(container, 'select[data-population-surface="follow-ups"]');
		scope.value = "all";
		scope.dispatchEvent(new Event("change", { bubbles: true }));
		expect(container.querySelectorAll("[data-birthday-person-id]")).toHaveLength(2);
		container.querySelector<HTMLButtonElement>('[data-cadence-relationship-id="friend"] button')?.click();
		expect(callbacks.onLogContact).toHaveBeenCalledWith(alice, edge);
		expect(callbacks.onCenterNode).not.toHaveBeenCalled();
		expect(callbacks.onChangeFollowUp).not.toHaveBeenCalled();
	});

	it("rejects a stale cadence endpoint before the old attention row is rerendered", () => {
		const alice = person("alice");
		const bob = person("bob");
		const charlie = person("charlie");
		const reviewed: AtlasEdge = {
			id: "friend",
			sourceId: alice.id,
			targetId: bob.id,
			filePath: "Relationships/Friend.md",
			types: ["friend"],
			inferred: false,
			lastContact: "2026-09-01",
			contactIntervalDays: 7,
		};
		let permitted = snapshot([alice, bob, charlie], [], [reviewed]);
		const onLogContact = vi.fn();
		const panel = new AttentionPanel(document, {
			translator: t,
			getSnapshot: () => permitted,
			getLocalCalendarDay: () => "2026-10-03",
			canLogContact: () => true,
			onLogContact,
		});
		document.body.append(panel.element);
		panel.render();
		cleanups.push(() => panel.destroy());
		const oldButton = required<HTMLButtonElement>(panel.element, '[data-cadence-relationship-id="friend"] button');
		permitted = { ...permitted, edges: [{ ...reviewed, targetId: charlie.id }] };
		oldButton.click();
		expect(onLogContact).not.toHaveBeenCalled();
		expect(oldButton.isConnected).toBe(false);
		expect(panel.element.textContent).toContain("charlie");
		panel.element.querySelector<HTMLButtonElement>('[data-cadence-relationship-id="friend"] button')?.click();
		expect(onLogContact).toHaveBeenCalledWith(alice, permitted.edges[0]);
	});
});
