import type { App, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import { ContactMomentModal } from "../../src/editor/contact-moment-modal";
import PeopleAtlasPlugin from "../../src/main";
import {
	type Component,
	ControlledObsidianRuntime,
	notices,
	type ControlledBasesEntry,
	type TFile,
} from "../obsidian-stub";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.2.0",
	minAppVersion: "1.13.0",
	description: "Controlled follow-up view integration manifest",
	author: "People Atlas",
} as PluginManifest;

function buttonWithText(container: ParentNode, text: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!button) throw new Error(`No ${text} button exists in the production surface.`);
	return button;
}

function fullSnapshot(view: unknown): AtlasSnapshot {
	const snapshot = (view as { fullSnapshot?: AtlasSnapshot }).fullSnapshot;
	if (!snapshot) throw new Error("The production view has not published a full snapshot.");
	return snapshot;
}

function basesPerson(runtime: ControlledObsidianRuntime, file: TFile, id: string, name: string): ControlledBasesEntry {
	return runtime.createBasesEntry(file, {
		"note.person_id": id,
		"note.name": name,
		"note.organisations": [],
		"note.contacts": [],
	});
}

async function waitForObservation(observation: () => boolean, message: string, timeoutMs = 1_000): Promise<void> {
	const deadline = performance.now() + timeoutMs;
	while (!observation()) {
		if (performance.now() >= deadline) throw new Error(message);
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
	}
}

afterEach(() => {
	document.body.replaceChildren();
	notices.length = 0;
	vi.restoreAllMocks();
});

describe("controlled contact-history and follow-up view integration", () => {
	it("keeps standalone and fully visible Bases rows in parity while hiding partial multi-person context", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
		});
		const bob = runtime.seedFile("People/Bob.md", {
			type: "person",
			person_id: "person-bob",
			name: "Bob",
		});
		const relationship = runtime.seedFile("Relationships/Alice and Bob.md", {
			type: "relationship",
			relationship_id: "relationship-alice-bob",
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
			relationship_types: ["friend"],
		});
		const moment = runtime.seedFile("People/Contact moments/2026-07-30 - Alice and Bob.md", {
			type: "contact_moment",
			contact_moment_id: "contact-alice-bob",
			people: ["[[People/Alice]]", "[[People/Bob]]"],
			relationship: "[[Relationships/Alice and Bob]]",
			occurred_on: "2026-07-30",
			channel: "call",
			summary: "Private shared conversation",
			follow_up_on: "2999-01-01",
			follow_up_status: "open",
		});
		runtime.resolveLink(relationship.path, "People/Alice", alice.path);
		runtime.resolveLink(relationship.path, "People/Bob", bob.path);
		runtime.resolveLink(moment.path, "People/Alice", alice.path);
		runtime.resolveLink(moment.path, "People/Bob", bob.path);
		runtime.resolveLink(moment.path, "Relationships/Alice and Bob", relationship.path);

		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => (plugin.index.getSnapshot().contactMoments?.length ?? 0) === 1,
			"Contact moment was not indexed.",
		);

		const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		const aliceEntry = basesPerson(runtime, alice, "person-alice", "Alice");
		const bobEntry = basesPerson(runtime, bob, "person-bob", "Bob");
		const partialBases = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [aliceEntry], "Alice only");
		const fullBases = await runtime.openBasesView(
			BASES_VIEW_TYPE_PEOPLE_ATLAS,
			[aliceEntry, bobEntry],
			"Alice and Bob",
		);

		buttonWithText(standalone.leaf.contentEl, "Follow-up").click();
		buttonWithText(partialBases.parent, "Follow-up").click();
		buttonWithText(fullBases.parent, "Follow-up").click();

		expect(standalone.leaf.contentEl.textContent).toContain("Private shared conversation");
		expect(fullBases.parent.textContent).toContain("Private shared conversation");
		expect(partialBases.parent.textContent).not.toContain("Private shared conversation");
		expect(partialBases.parent.textContent).not.toContain("Bob");
		expect(fullSnapshot(partialBases.view).contactMoments).toEqual([]);
		expect(fullSnapshot(partialBases.view).hiddenContactMomentCount).toBe(1);
		expect(fullSnapshot(fullBases.view).contactMoments).toHaveLength(1);

		buttonWithText(standalone.leaf.contentEl, "Network").click();
		runtime.commands.get("open-follow-ups")?.callback?.();
		await waitForObservation(
			() => buttonWithText(standalone.leaf.contentEl, "Follow-up").getAttribute("aria-pressed") === "true",
			"Open follow-ups did not activate the existing standalone view.",
		);

		buttonWithText(standalone.leaf.contentEl, "People").click();
		const aliceButton = standalone.leaf.contentEl.querySelector<HTMLButtonElement>(
			'button[data-node-id="person-alice"]',
		);
		if (!aliceButton) throw new Error("Alice is unavailable in the semantic person list.");
		aliceButton.click();
		const selectedDetails = standalone.leaf.contentEl.querySelector(".people-atlas-selected-details");
		expect(selectedDetails?.textContent).toContain("Private shared conversation");
		expect(selectedDetails?.textContent).toContain("Relationship: Alice and Bob · friend");
		const selectedEditNames = Array.from(
			selectedDetails?.querySelectorAll<HTMLButtonElement>('button[data-contact-moment-action="edit"]') ?? [],
		).map((button) => button.getAttribute("aria-label"));
		expect(new Set(selectedEditNames).size).toBe(selectedEditNames.length);

		const openContactMomentModal = vi.spyOn(ContactMomentModal.prototype, "open");
		const originalEdit = Array.from(selectedDetails?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
			(candidate) =>
				candidate.textContent === "Edit contact moment" && candidate.dataset.contactMomentPlacement === "history",
		);
		if (!originalEdit) throw new Error("The selected contact moment history has no Edit action.");
		originalEdit.click();
		const modal = openContactMomentModal.mock.instances.at(-1) as unknown as {
			afterClose?: () => void;
		};
		const updatedMoment = {
			...(runtime.metadataCache.getFileCache(moment)?.frontmatter ?? {}),
			summary: "Updated shared conversation",
		};
		runtime.changeMetadata(moment.path, updatedMoment);
		await waitForObservation(
			() => !originalEdit.isConnected,
			"The selected history row was not replaced after its index refresh.",
		);
		modal.afterClose?.();
		const replacementEdit = Array.from(
			standalone.leaf.contentEl.querySelectorAll<HTMLButtonElement>(
				'.people-atlas-selected-details button[data-contact-moment-action="edit"]',
			),
		).find(
			(candidate) =>
				candidate.dataset.contactMomentId === "contact-alice-bob" &&
				candidate.dataset.contactMomentPath === moment.path &&
				candidate.dataset.contactMomentPlacement === "history",
		);
		expect(document.activeElement).toBe(replacementEdit);

		replacementEdit?.click();
		const closeBeforeRefreshModal = openContactMomentModal.mock.instances.at(-1) as unknown as {
			afterClose?: () => void;
		};
		closeBeforeRefreshModal.afterClose?.();
		expect(document.activeElement).toBe(replacementEdit);
		runtime.changeMetadata(moment.path, {
			...updatedMoment,
			summary: "Updated after editor close",
		});
		await waitForObservation(
			() => !replacementEdit?.isConnected,
			"The selected history row was not replaced after the post-close index refresh.",
		);
		const postCloseRefreshEdit = Array.from(
			standalone.leaf.contentEl.querySelectorAll<HTMLButtonElement>(
				'.people-atlas-selected-details button[data-contact-moment-action="edit"]',
			),
		).find(
			(candidate) =>
				candidate.dataset.contactMomentId === "contact-alice-bob" &&
				candidate.dataset.contactMomentPath === moment.path &&
				candidate.dataset.contactMomentPlacement === "history",
		);
		expect(document.activeElement).toBe(postCloseRefreshEdit);

		await standalone.view.unload();
		await partialBases.view.unload();
		await fullBases.view.unload();
		await component.unload();
	});

	it("writes only status for accepted actions and makes a stale row a visible no-write", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
		});
		const accepted = runtime.seedFile("People/Contact moments/Accepted.md", {
			type: "contact_moment",
			contact_moment_id: "contact-accepted",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-01",
			channel: "meeting",
			summary: "Accepted follow-up",
			follow_up_on: "2000-01-01",
			follow_up_status: "open",
			unrelated: "preserve me",
		});
		const stale = runtime.seedFile("People/Contact moments/Stale.md", {
			type: "contact_moment",
			contact_moment_id: "contact-stale",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-02",
			summary: "Stale follow-up",
			follow_up_on: "2000-01-02",
			follow_up_status: "open",
			unrelated: "also preserve me",
		});
		const unavailable = runtime.seedFile("People/Contact moments/Unavailable.md", {
			type: "contact_moment",
			contact_moment_id: "contact-unavailable",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-03",
			summary: "Unavailable follow-up",
			follow_up_on: "2000-01-03",
			follow_up_status: "open",
		});
		runtime.resolveLink(accepted.path, "People/Alice", alice.path);
		runtime.resolveLink(stale.path, "People/Alice", alice.path);
		runtime.resolveLink(unavailable.path, "People/Alice", alice.path);

		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => (plugin.index.getSnapshot().contactMoments?.length ?? 0) === 3,
			"Follow-up moments were not indexed.",
		);
		const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		buttonWithText(standalone.leaf.contentEl, "Follow-up").click();
		const processFrontMatter = vi.spyOn(runtime.app.fileManager, "processFrontMatter");

		const unavailableBefore = structuredClone(runtime.metadataCache.getFileCache(unavailable)?.frontmatter ?? {});
		runtime.metadataCache.caches.set(unavailable.path, {
			frontmatter: { ...unavailableBefore, contact_moment_id: "contact-replaced" },
		});
		const unavailableDone = standalone.leaf.contentEl.querySelector<HTMLButtonElement>(
			'button[data-contact-moment-id="contact-unavailable"][data-contact-moment-action="done"]',
		);
		if (!unavailableDone) throw new Error("The activation-stale follow-up action was not rendered.");
		unavailableDone.click();
		await waitForObservation(
			() => notices.some((notice) => notice.includes("changed or is no longer available")),
			"The activation-time unavailable action was not reported.",
		);
		expect(processFrontMatter).not.toHaveBeenCalled();
		expect(runtime.metadataCache.getFileCache(unavailable)?.frontmatter).toEqual({
			...unavailableBefore,
			contact_moment_id: "contact-replaced",
		});

		const staleBefore = structuredClone(runtime.metadataCache.getFileCache(stale)?.frontmatter ?? {});
		runtime.metadataCache.caches.set(stale.path, {
			frontmatter: { ...staleBefore, follow_up_on: "2000-02-02" },
		});
		const staleDone = standalone.leaf.contentEl.querySelector<HTMLButtonElement>(
			'button[data-contact-moment-id="contact-stale"][data-contact-moment-action="done"]',
		);
		if (!staleDone) throw new Error("The stale follow-up action was not rendered.");
		staleDone.click();
		await waitForObservation(
			() => notices.some((notice) => notice.includes("follow-up was not changed")),
			"The stale follow-up failure was not reported.",
		);
		expect(processFrontMatter).not.toHaveBeenCalled();
		expect(runtime.metadataCache.getFileCache(stale)?.frontmatter).toEqual({
			...staleBefore,
			follow_up_on: "2000-02-02",
		});

		const acceptedBefore = structuredClone(runtime.metadataCache.getFileCache(accepted)?.frontmatter ?? {});
		const acceptedDone = standalone.leaf.contentEl.querySelector<HTMLButtonElement>(
			'button[data-contact-moment-id="contact-accepted"][data-contact-moment-action="done"]',
		);
		if (!acceptedDone) throw new Error("The accepted follow-up action was not rendered.");
		acceptedDone.click();
		await waitForObservation(
			() => runtime.metadataCache.getFileCache(accepted)?.frontmatter?.follow_up_status === "done",
			"The accepted follow-up status was not saved.",
		);
		expect(processFrontMatter).toHaveBeenCalledTimes(1);
		expect(runtime.metadataCache.getFileCache(accepted)?.frontmatter).toEqual({
			...acceptedBefore,
			follow_up_status: "done",
		});
		const acceptedAfter = structuredClone(runtime.metadataCache.getFileCache(accepted)?.frontmatter ?? {});
		runtime.changeMetadata(accepted.path, acceptedAfter);
		await waitForObservation(
			() =>
				!standalone.leaf.contentEl.querySelector(
					'[data-contact-moment-id="contact-accepted"][data-contact-moment-action="done"]',
				),
			"The terminal follow-up row did not leave the default due list after index refresh.",
		);
		expect(runtime.vault.getAbstractFileByPath(accepted.path)).toBe(accepted);

		await standalone.view.unload();
		await component.unload();
	});
});
