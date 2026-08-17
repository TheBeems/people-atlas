import type { App, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import { ContactMomentModal } from "../../src/editor/contact-moment-modal";
import PeopleAtlasPlugin from "../../src/main";
import { type Component, ControlledObsidianRuntime } from "../obsidian-stub";
import "../../styles.css";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.2.0",
	minAppVersion: "1.13.0",
	description: "Controlled contact-moment integration manifest",
	author: "People Atlas",
} as PluginManifest;

function buttonWithText(container: ParentNode, text: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!button) throw new Error(`No ${text} button exists in the production surface.`);
	return button;
}

function selectPersonInList(container: ParentNode, nodeId: string): void {
	buttonWithText(container, "People").click();
	const person = container.querySelector<HTMLButtonElement>(`button[data-node-id="${nodeId}"]`);
	if (!person) throw new Error(`No semantic person button exists for ${nodeId}.`);
	person.click();
}

async function waitForObservation(observation: () => boolean, message: string): Promise<void> {
	const deadline = performance.now() + 1_000;
	while (!observation()) {
		if (performance.now() >= deadline) throw new Error(message);
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
	}
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("controlled contact-moment entrypoint integration", () => {
	it("shares one form across global, active, selected, Bases and current-moment entrypoints", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
		});
		const moment = runtime.seedFile("People/Contact moments/2026-07-30 - Alice - 12345678.md", {
			type: "contact_moment",
			contact_moment_id: "contact-moment-12345678",
			people: ["[[People/Alice]]"],
			occurred_on: "2026-07-30",
			channel: "call",
			summary: "Caught up",
		});
		runtime.resolveLink(moment.path, "People/Alice", alice.path);
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		const open = vi.spyOn(ContactMomentModal.prototype, "open");

		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => (plugin.index.getSnapshot().contactMoments?.length ?? 0) === 1,
			"Contact moment was not indexed.",
		);

		runtime.workspace.setActiveFile(null);
		runtime.commands.get("log-contact")?.callback?.();
		let modal = open.mock.instances.at(-1) as unknown as {
			mode: { kind: string };
			values: { peoplePaths: string[]; advanceRelationshipLastContact: boolean };
		};
		expect(modal.mode.kind).toBe("create");
		expect(modal.values.peoplePaths).toEqual([]);
		expect(modal.values.advanceRelationshipLastContact).toBe(false);

		runtime.workspace.setActiveFile(alice);
		runtime.commands.get("log-contact")?.callback?.();
		modal = open.mock.instances.at(-1) as unknown as typeof modal;
		expect(modal.values.peoplePaths).toEqual([alice.path]);

		const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
		selectPersonInList(standalone.leaf.contentEl, "person-alice");
		buttonWithText(
			standalone.leaf.contentEl.querySelector(".people-atlas-selected-details") ?? standalone.leaf.contentEl,
			"Log contact",
		).click();
		modal = open.mock.instances.at(-1) as unknown as typeof modal;
		expect(modal.values.peoplePaths).toEqual([alice.path]);

		const basesEntry = runtime.createBasesEntry(alice, {
			"note.person_id": "person-alice",
			"note.name": "Alice",
			"note.organisations": [],
			"note.contacts": [],
		});
		const bases = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [basesEntry], "People");
		selectPersonInList(bases.parent, "person-alice");
		buttonWithText(bases.parent, "Log contact").click();
		modal = open.mock.instances.at(-1) as unknown as typeof modal;
		expect(modal.values.peoplePaths).toEqual([alice.path]);

		runtime.workspace.setActiveFile(moment);
		runtime.commands.get("edit-current-contact-moment")?.callback?.();
		const editModal = open.mock.instances.at(-1) as unknown as {
			mode: { kind: string };
			values: { path: string; contactMomentId: string; advanceRelationshipLastContact: boolean };
		};
		expect(editModal.mode).toMatchObject({ kind: "edit" });
		expect(editModal.values).toMatchObject({
			path: moment.path,
			contactMomentId: "contact-moment-12345678",
			advanceRelationshipLastContact: false,
		});

		await standalone.view.unload();
		await bases.view.unload();
		await component.unload();
	});
});
