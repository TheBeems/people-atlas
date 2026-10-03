import type { App, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import { ContactMomentModal } from "../../src/editor/contact-moment-modal";
import PeopleAtlasPlugin from "../../src/main";
import { DEFAULT_VIEW_STATE } from "../../src/settings/view-state";
import { ControlledObsidianRuntime, notices } from "../obsidian-stub";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.12.4",
	minAppVersion: "1.13.0",
	description: "Synthetic attention integration",
	author: "People Atlas",
} as PluginManifest;
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	document.body.replaceChildren();
	notices.length = 0;
	vi.restoreAllMocks();
});
async function load(runtime: ControlledObsidianRuntime): Promise<PeopleAtlasPlugin> {
	const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
	await plugin.load();
	runtime.triggerLayoutReady();
	runtime.emitMetadata("resolved");
	cleanups.push(async () => plugin.unload());
	return plugin;
}
function required<T extends Element>(container: ParentNode, selector: string): T {
	const element = container.querySelector<T>(selector);
	if (!element) throw new Error(`Missing required attention element ${selector}`);
	return element;
}
function select(container: ParentNode, label: string, value: string): void {
	const element = required<HTMLSelectElement>(container, `select[aria-label="${label}"]`);
	element.value = value;
	element.dispatchEvent(new Event("change", { bubbles: true }));
}
function button(container: ParentNode, text: string): HTMLButtonElement {
	const candidate = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
		(item) => item.textContent === text,
	);
	if (!candidate) throw new Error(`Missing button ${text}`);
	return candidate;
}
function momentAction(container: ParentNode, action: string): HTMLButtonElement {
	const candidate = container.querySelector<HTMLButtonElement>(
		`[data-contact-moment-id="moment"][data-contact-moment-action="${action}"]`,
	);
	if (!candidate) throw new Error(`Missing moment ${action} action`);
	return candidate;
}

describe("follow-up attention in the controlled host", () => {
	it("saves only the exact reviewed date/status and rejects stale live sources with retained focus", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		runtime.seedFile("People/Alice.md", { type: "person", person_id: "alice", name: "Alice" });
		const moment = runtime.seedFile("People/Contact moments/Moment.md", {
			type: "contact_moment",
			contact_moment_id: "moment",
			people: ["alice"],
			occurred_on: "2026-09-30",
			follow_up_on: "2999-01-01",
			summary: "Reviewed moment",
			channel: "call",
			custom: "preserve",
		});
		const plugin = await load(runtime);
		const opened = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		cleanups.push(async () => opened.view.unload());
		button(opened.leaf.contentEl, "Follow-up").click();
		const writes = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
		const before = structuredClone(runtime.metadataCache.getFileCache(moment)?.frontmatter ?? {});
		const postpone = momentAction(opened.leaf.contentEl, "postpone");
		expect(postpone.textContent).toBe(
			plugin.t.followUpAttention.postpone({ date: plugin.t.formatDateOnly("2999-01-08") }),
		);
		postpone.focus();
		postpone.click();
		postpone.click();
		await vi.waitFor(() =>
			expect(runtime.metadataCache.getFileCache(moment)?.frontmatter?.follow_up_on).toBe("2999-01-08"),
		);
		expect(writes).toHaveBeenCalledTimes(1);
		expect(runtime.metadataCache.getFileCache(moment)?.frontmatter).toEqual({ ...before, follow_up_on: "2999-01-08" });
		const postponed = structuredClone(runtime.metadataCache.getFileCache(moment)?.frontmatter ?? {});
		runtime.changeMetadata(moment.path, postponed);
		await vi.waitFor(() => expect(postpone.isConnected).toBe(false));
		expect(document.activeElement?.getAttribute("data-contact-moment-action")).toBe("postpone");

		const stalePostpone = momentAction(opened.leaf.contentEl, "postpone");
		runtime.metadataCache.caches.set(moment.path, { frontmatter: { ...postponed, summary: "Unreviewed source" } });
		stalePostpone.click();
		await vi.waitFor(() =>
			expect(notices.some((notice) => notice.includes("changed or is no longer available"))).toBe(true),
		);
		expect(writes).toHaveBeenCalledTimes(1);
		expect(runtime.metadataCache.getFileCache(moment)?.frontmatter?.follow_up_on).toBe("2999-01-08");
		runtime.changeMetadata(moment.path, { ...postponed, follow_up_status: "done" });
		await vi.waitFor(() =>
			expect(opened.leaf.contentEl.querySelectorAll(".people-atlas-follow-up-row")).toHaveLength(0),
		);
		select(opened.leaf.contentEl, "Follow-up status", "done");
		const terminal = structuredClone(runtime.metadataCache.getFileCache(moment)?.frontmatter ?? {});
		const reopen = momentAction(opened.leaf.contentEl, "reopen");
		reopen.focus();
		reopen.click();
		await vi.waitFor(() =>
			expect(runtime.metadataCache.getFileCache(moment)?.frontmatter?.follow_up_status).toBe("open"),
		);
		expect(runtime.metadataCache.getFileCache(moment)?.frontmatter).toEqual({ ...terminal, follow_up_status: "open" });
		expect(writes).toHaveBeenCalledTimes(2);
		runtime.changeMetadata(moment.path, runtime.metadataCache.getFileCache(moment)?.frontmatter ?? {});
		await vi.waitFor(() => expect(reopen.isConnected).toBe(false));
		expect(document.activeElement?.getAttribute("data-follow-ups-heading")).toBe("true");
	});

	it("keeps All attention independent of the historical network and limited to Base-admitted people", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const today = new Date();
		const birthday = `--${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "alice",
			name: "Alice",
			birth_date: birthday,
		});
		const bob = runtime.seedFile("People/Bob.md", {
			type: "person",
			person_id: "bob",
			name: "Bob",
			birth_date: birthday,
		});
		const relationship = runtime.seedFile("People/Relationships/Friend.md", {
			type: "relationship",
			relationship_id: "friend",
			from: "alice",
			to: "bob",
			since: "2024-01-01",
			last_contact: "2024-02-01",
			contact_interval_days: 30,
		});
		const plugin = await load(runtime);
		await plugin.saveViewState("standalone", {
			...structuredClone(DEFAULT_VIEW_STATE),
			centerMode: "none",
			projectionMode: "free-network",
			relationshipDate: "2020-01-01",
		});
		const opened = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		cleanups.push(async () => opened.view.unload());
		const writes = vi.spyOn(runtime.app.fileManager, "processFrontMatter");
		const creates = vi.spyOn(plugin.mutations, "createContactMoment");
		button(opened.leaf.contentEl, "Follow-up").click();
		expect(opened.leaf.contentEl.querySelectorAll("[data-cadence-relationship-id]")).toHaveLength(0);
		select(opened.leaf.contentEl, "Follow-ups for", "all");
		expect(opened.leaf.contentEl.querySelectorAll("[data-cadence-relationship-id]")).toHaveLength(1);
		expect((opened.view as unknown as { projectedSnapshot: AtlasSnapshot }).projectedSnapshot.edges).toEqual([]);
		button(opened.leaf.contentEl, "People").click();
		select(opened.leaf.contentEl, "People to search", "all");
		required<HTMLButtonElement>(opened.leaf.contentEl, '[data-node-id="alice"]').click();
		select(opened.leaf.contentEl, "Compare selected person with", "bob");
		expect(opened.leaf.contentEl.querySelector("[data-network-results]")?.textContent).toContain(
			"No connection path exists",
		);

		const entry = (file: typeof alice, id: string, name: string) =>
			runtime.createBasesEntry(file, { "note.person_id": id, "note.name": name, "note.birth_date": birthday });
		const partial = await runtime.openBasesView(
			BASES_VIEW_TYPE_PEOPLE_ATLAS,
			[entry(alice, "alice", "Alice")],
			"Alice only",
		);
		cleanups.push(async () => partial.view.unload());
		const full = await runtime.openBasesView(
			BASES_VIEW_TYPE_PEOPLE_ATLAS,
			[entry(alice, "alice", "Alice"), entry(bob, "bob", "Bob")],
			"Both admitted",
		);
		cleanups.push(async () => full.view.unload());
		for (const base of [partial, full]) {
			base.controller.config.set("relationshipDate", "2020-01-01");
			(base.view as unknown as { onDataUpdated(): void }).onDataUpdated();
			button(base.parent, "Follow-up").click();
			select(base.parent, "Follow-ups for", "all");
			expect(
				base.parent.querySelector<HTMLSelectElement>('select[data-population-surface="follow-ups"]')?.selectedOptions[0]
					?.textContent,
			).toBe("All people in this Base");
		}
		expect(partial.parent.querySelectorAll("[data-birthday-person-id]")).toHaveLength(1);
		expect(partial.parent.querySelectorAll("[data-cadence-relationship-id]")).toHaveLength(0);
		expect(partial.parent.textContent).not.toContain("Bob");
		expect(full.parent.querySelectorAll("[data-birthday-person-id]")).toHaveLength(2);
		expect(full.parent.querySelectorAll("[data-cadence-relationship-id]")).toHaveLength(1);
		const openModal = vi.spyOn(ContactMomentModal.prototype, "open");
		required<HTMLButtonElement>(full.parent, '[data-cadence-relationship-id="friend"] button').click();
		expect(openModal).toHaveBeenCalledOnce();
		expect(openModal.mock.instances[0]).toMatchObject({
			mode: { kind: "create", prefilledPersonPath: alice.path, prefilledRelationshipPath: relationship.path },
		});
		expect(writes).not.toHaveBeenCalled();
		expect(creates).not.toHaveBeenCalled();
	});
});
