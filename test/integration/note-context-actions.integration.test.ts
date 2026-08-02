import type { App, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelationshipModal } from "../../src/editor/relationship-modal";
import PeopleAtlasPlugin from "../../src/main";
import "../../styles.css";
import { type Component, ControlledObsidianRuntime, notices } from "../obsidian-stub";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.6.0",
	minAppVersion: "1.13.0",
	description: "Controlled note-context-actions integration manifest",
	author: "People Atlas",
} as PluginManifest;

async function waitForObservation(observation: () => boolean, message: string): Promise<void> {
	const deadline = performance.now() + 1_000;
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

describe("controlled note-context actions integration", () => {
	it("registers exactly one Reading View Markdown post processor", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;

		await component.load();

		expect(runtime.markdownPostProcessors.size).toBe(1);

		await component.unload();
		expect(runtime.markdownPostProcessors.size).toBe(0);
	});

	it("adds one native person action for one current canonical Reading View document", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => plugin.index.getSnapshot().people.some((person) => person.filePath === alice.path),
			"The current canonical person was not indexed.",
		);

		const first = await runtime.renderMarkdown(alice.path, "person-doc");
		const second = await runtime.renderMarkdown(alice.path, "person-doc");
		try {
			const panels = document.querySelectorAll<HTMLElement>(".people-atlas-note-actions");
			expect(panels).toHaveLength(1);
			expect(first.childCount).toBe(1);
			expect(second.childCount).toBe(0);
			const button = first.section.querySelector<HTMLButtonElement>("button");
			expect(button).not.toBeNull();
			expect(button?.tagName).toBe("BUTTON");
			expect(button?.textContent).toBe("Edit person");
			expect(button?.getAttribute("aria-label")).toBe("Edit person");
			expect(button?.ownerDocument).toBe(document);
		} finally {
			await second.unload();
			await first.unload();
			await component.unload();
		}
	});

	it("styles native note actions as a wrapped, touch-sized action row", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		document.documentElement.style.setProperty("--size-4-2", "8px");
		document.documentElement.style.setProperty("--size-4-3", "12px");
		document.documentElement.style.setProperty("--size-4-6", "24px");
		document.documentElement.style.setProperty("--size-4-11", "44px");
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => plugin.index.getSnapshot().people.some((person) => person.filePath === alice.path),
			"The current canonical person was not indexed.",
		);
		const rendered = await runtime.renderMarkdown(alice.path, "styled-person-action-doc");
		try {
			const panel = rendered.section.querySelector<HTMLElement>(".people-atlas-note-actions");
			const button = panel?.querySelector<HTMLButtonElement>("button");
			if (!panel || !button) throw new Error("The production person action was not rendered.");

			const panelStyle = getComputedStyle(panel);
			const buttonStyle = getComputedStyle(button);
			expect(panelStyle.display).toBe("flex");
			expect(panelStyle.flexWrap).toBe("wrap");
			expect(panelStyle.gap).toBe("8px");
			expect(panelStyle.marginBlockStart).toBe("12px");
			expect(buttonStyle.minWidth).toBe("44px");
			expect(buttonStyle.minHeight).toBe("44px");
		} finally {
			await rendered.unload();
			await component.unload();
			document.documentElement.style.removeProperty("--size-4-2");
			document.documentElement.style.removeProperty("--size-4-3");
			document.documentElement.style.removeProperty("--size-4-6");
			document.documentElement.style.removeProperty("--size-4-11");
		}
	});

	it("routes a person action to the existing path editor without a write", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => plugin.index.getSnapshot().people.some((person) => person.filePath === alice.path),
			"The current canonical person was not indexed.",
		);
		const openPersonEditor = vi.spyOn(plugin, "openEditPerson").mockResolvedValue(undefined);
		const openRelationshipEditor = vi.spyOn(plugin, "openEditRelationship");
		const rendered = await runtime.renderMarkdown(alice.path, "person-action-doc");
		try {
			const button = rendered.section.querySelector<HTMLButtonElement>("button");
			if (!button) throw new Error("The production person action was not rendered.");

			button.click();

			expect(openPersonEditor).toHaveBeenCalledOnce();
			expect(openPersonEditor).toHaveBeenCalledWith(alice.path);
			expect(openRelationshipEditor).not.toHaveBeenCalled();
			expect(runtime.savedPluginData).toEqual([]);
		} finally {
			await rendered.unload();
			await component.unload();
		}
	});

	it("routes a relationship action to the existing path editor without a write", async () => {
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
		const relationship = runtime.seedFile("Relationships/Alice-Bob.md", {
			type: "relationship",
			relationship_id: "relationship-alice-bob",
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
			relationship_types: ["friend"],
		});
		runtime.resolveLink(relationship.path, "People/Alice", alice.path);
		runtime.resolveLink(relationship.path, "People/Bob", bob.path);
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => plugin.index.getSnapshot().relationships.some((record) => record.filePath === relationship.path),
			"The current canonical relationship was not indexed.",
		);
		const openPersonEditor = vi.spyOn(plugin, "openEditPerson");
		const openRelationshipEditor = vi.spyOn(plugin, "openEditRelationship").mockReturnValue(true);
		const rendered = await runtime.renderMarkdown(relationship.path, "relationship-action-doc");
		try {
			const button = rendered.section.querySelector<HTMLButtonElement>("button");
			if (!button) throw new Error("The production relationship action was not rendered.");
			expect(button.textContent).toBe("Edit relationship");

			button.click();

			expect(openRelationshipEditor).toHaveBeenCalledOnce();
			expect(openRelationshipEditor).toHaveBeenCalledWith(relationship.path);
			expect(openPersonEditor).not.toHaveBeenCalled();
			expect(runtime.savedPluginData).toEqual([]);
		} finally {
			await rendered.unload();
			await component.unload();
		}
	});

	it("keeps a stale relationship click inside the existing safe path guard", async () => {
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
		const relationship = runtime.seedFile("Relationships/Alice-Bob.md", {
			type: "relationship",
			relationship_id: "relationship-alice-bob",
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
			relationship_types: ["friend"],
		});
		runtime.resolveLink(relationship.path, "People/Alice", alice.path);
		runtime.resolveLink(relationship.path, "People/Bob", bob.path);
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => plugin.index.getSnapshot().relationships.some((record) => record.filePath === relationship.path),
			"The current canonical relationship was not indexed.",
		);
		const open = vi.spyOn(RelationshipModal.prototype, "open");
		const rendered = await runtime.renderMarkdown(relationship.path, "stale-relationship-doc");
		try {
			const button = rendered.section.querySelector<HTMLButtonElement>("button");
			if (!button) throw new Error("The production relationship action was not rendered.");

			runtime.deleteFile(relationship.path);
			button.click();

			expect(open).not.toHaveBeenCalled();
			expect(runtime.savedPluginData).toEqual([]);
			expect(notices.at(-1)).toContain("no longer available");
		} finally {
			await rendered.unload();
			await component.unload();
		}
	});

	it("withholds actions from ordinary, non-Markdown, invalid and ambiguous source paths", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const ordinary = runtime.seedFile("Notes/Ordinary.md", { title: "Ordinary note" });
		const asset = runtime.seedFile("Attachments/alice.png", {});
		const invalidRelationship = runtime.seedFile("Relationships/No stable ID.md", {
			type: "relationship",
			from: "[[People/Alice]]",
			to: "[[People/Bob]]",
		});
		const ambiguous = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-shared",
			name: "Alice",
		});
		runtime.seedFile("People/Alice duplicate.md", {
			type: "person",
			person_id: "person-shared",
			name: "Alice duplicate",
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => plugin.index.getSnapshot().people.filter((person) => person.id === "person-shared").length === 2,
			"The duplicate canonical identity was not indexed.",
		);
		const renders = await Promise.all([
			runtime.renderMarkdown(ordinary.path, "ordinary-doc"),
			runtime.renderMarkdown(asset.path, "asset-doc"),
			runtime.renderMarkdown(invalidRelationship.path, "invalid-relationship-doc"),
			runtime.renderMarkdown(ambiguous.path, "ambiguous-person-doc"),
		]);
		try {
			for (const rendered of renders) {
				expect(rendered.childCount).toBe(0);
				expect(rendered.section.querySelector(".people-atlas-note-actions")).toBeNull();
			}
		} finally {
			for (const rendered of renders) await rendered.unload();
			await component.unload();
		}
	});

	it("uses the rendered document and releases its action listener and docId with the render child", async () => {
		const popoutDocument = document.implementation.createHTMLDocument("People Atlas pop-out");
		const runtime = new ControlledObsidianRuntime(popoutDocument);
		const alice = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "person-alice",
			name: "Alice",
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		const component = plugin as unknown as Component;
		await component.load();
		runtime.triggerLayoutReady();
		await waitForObservation(
			() => plugin.index.getSnapshot().people.some((person) => person.filePath === alice.path),
			"The current canonical person was not indexed.",
		);
		const openPersonEditor = vi.spyOn(plugin, "openEditPerson").mockResolvedValue(undefined);
		const rendered = await runtime.renderMarkdown(alice.path, "popout-person-doc");
		const button = rendered.section.querySelector<HTMLButtonElement>("button");
		if (!button) throw new Error("The production person action was not rendered.");
		try {
			expect(button.ownerDocument).toBe(popoutDocument);
			expect(rendered.childCount).toBe(1);

			await rendered.unload();
			button.click();

			expect(openPersonEditor).not.toHaveBeenCalled();
			const replacement = await runtime.renderMarkdown(alice.path, "popout-person-doc");
			try {
				expect(replacement.childCount).toBe(1);
			} finally {
				await replacement.unload();
			}
		} finally {
			await component.unload();
		}
	});
});
