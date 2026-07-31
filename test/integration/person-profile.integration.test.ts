import type { App, PluginManifest } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASES_OPTION_KEYS } from "../../src/bases/options";
import { BASES_VIEW_TYPE_PEOPLE_ATLAS, VIEW_TYPE_PEOPLE_ATLAS } from "../../src/constants";
import type { AtlasSnapshot } from "../../src/domain/types";
import PeopleAtlasPlugin from "../../src/main";
import { type Component, ControlledObsidianRuntime, ListValue, StringValue } from "../obsidian-stub";

const manifest = {
	id: "people-atlas",
	name: "People Atlas",
	version: "0.1.0",
	minAppVersion: "1.13.0",
	description: "Controlled person-profile integration manifest",
	author: "People Atlas",
} as PluginManifest;

function fullSnapshot(view: unknown): AtlasSnapshot {
	const snapshot = (view as { fullSnapshot?: AtlasSnapshot }).fullSnapshot;
	if (!snapshot) throw new Error("The production view has not published a full snapshot.");
	return snapshot;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("person profile data integration", () => {
	it("keeps standalone and Bases profile mappings identical while retaining people with invalid values", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const aliceFile = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "alice",
			name: "Alice",
			birth_date: "--02-29",
			pronouns: "she/her",
			gender: "woman",
			emails: ["alice@example.test"],
			phones: ["+31 6 1234"],
			job_title: "Engineer",
		});
		const bobFile = runtime.seedFile("People/Bob.md", {
			type: "person",
			person_id: "bob",
			name: "Bob",
			birth_date: "2025-02-29",
			emails: ["invalid"],
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		await (plugin as unknown as Component).load();
		runtime.triggerLayoutReady();

		try {
			const standalone = await runtime.openStandaloneView(VIEW_TYPE_PEOPLE_ATLAS);
			const bases = await runtime.openBasesView(
				BASES_VIEW_TYPE_PEOPLE_ATLAS,
				[
					runtime.createBasesEntry(aliceFile, {
						"note.person_id": "alice",
						"note.name": "Alice",
						"note.organisations": [],
						"note.birth_date": "--02-29",
						"note.pronouns": "she/her",
						"note.gender": "woman",
						"note.emails": ["alice@example.test"],
						"note.phones": ["+31 6 1234"],
						"note.job_title": "Engineer",
						"note.contacts": [],
					}),
					runtime.createBasesEntry(bobFile, {
						"note.person_id": "bob",
						"note.name": "Bob",
						"note.organisations": [],
						"note.birth_date": "2025-02-29",
						"note.emails": ["invalid"],
						"note.phones": [],
						"note.contacts": [],
					}),
				],
				"Profile people",
			);

			for (const snapshot of [fullSnapshot(standalone.view), fullSnapshot(bases.view)]) {
				expect(snapshot.nodes.find((node) => node.id === "alice")).toMatchObject({
					birthDate: "--02-29",
					pronouns: "she/her",
					gender: "woman",
					emails: ["alice@example.test"],
					phones: ["+31 6 1234"],
					jobTitle: "Engineer",
				});
				expect(snapshot.nodes.find((node) => node.id === "bob")).toMatchObject({
					birthDate: undefined,
					emails: [],
					phones: [],
				});
				expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
					expect.arrayContaining(["invalid-person-birth-date", "invalid-person-email"]),
				);
			}
		} finally {
			await (plugin as unknown as Component).unload();
		}
	});

	it("preserves custom Bases profile selectors and diagnostics when a canonical person delta arrives", async () => {
		const runtime = new ControlledObsidianRuntime(document);
		const file = runtime.seedFile("People/Alice.md", {
			type: "person",
			person_id: "alice",
			name: "Canonical Alice",
			birth_date: "1990-01-02",
			emails: ["canonical@example.test"],
			phones: ["+1 555 0100"],
		});
		const entry = runtime.createBasesEntry(file, {
			"note.person_id": "alice",
			"note.name": "Mapped Alice",
			"note.organisations": [],
			"note.profile_birth": "--02-29",
			"note.profile_emails": ["mapped@example.test"],
			"note.profile_phones": ["+31 6 1234"],
			"note.contacts": [],
		});
		const plugin = new PeopleAtlasPlugin(runtime.app as unknown as App, manifest);
		await (plugin as unknown as Component).load();
		runtime.triggerLayoutReady();

		try {
			const bases = await runtime.openBasesView(BASES_VIEW_TYPE_PEOPLE_ATLAS, [entry], "Custom profile");
			bases.controller.config.set(BASES_OPTION_KEYS.birthDateProperty, "note.profile_birth");
			bases.controller.config.set(BASES_OPTION_KEYS.emailsProperty, "note.profile_emails");
			bases.controller.config.set(BASES_OPTION_KEYS.phonesProperty, "note.profile_phones");
			bases.view.onDataUpdated();
			expect(fullSnapshot(bases.view).nodes.find((node) => node.id === "alice")).toMatchObject({
				label: "Mapped Alice",
				birthDate: "--02-29",
				emails: ["mapped@example.test"],
				phones: ["+31 6 1234"],
			});

			entry.values.set("note.profile_birth", new StringValue("2025-02-29"));
			entry.values.set("note.profile_emails", new ListValue(["mapped-after@example.test", "invalid"]));
			entry.values.set("note.profile_phones", new ListValue(["+31 6 9999"]));
			runtime.changeMetadata("People/Alice.md", {
				type: "person",
				person_id: "alice",
				name: "Canonical after",
				birth_date: "2001-03-04",
				emails: ["canonical-after@example.test"],
				phones: ["+1 555 0199"],
			});

			await vi.waitFor(() =>
				expect(fullSnapshot(bases.view).nodes.find((node) => node.id === "alice")).toMatchObject({
					label: "Mapped Alice",
					birthDate: undefined,
					emails: ["mapped-after@example.test"],
					phones: ["+31 6 9999"],
				}),
			);
			const deltaResult = {
				node: fullSnapshot(bases.view).nodes.find((node) => node.id === "alice"),
				diagnostics: fullSnapshot(bases.view).diagnostics.map((diagnostic) => ({
					code: diagnostic.code,
					message: diagnostic.message,
					filePaths: diagnostic.filePaths,
				})),
			};
			expect(deltaResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
				"invalid-person-birth-date",
				"invalid-person-email",
			]);
			expect(deltaResult.diagnostics.every((diagnostic) => diagnostic.message.includes("note.profile_"))).toBe(true);

			bases.view.onDataUpdated();
			expect({
				node: fullSnapshot(bases.view).nodes.find((node) => node.id === "alice"),
				diagnostics: fullSnapshot(bases.view).diagnostics.map((diagnostic) => ({
					code: diagnostic.code,
					message: diagnostic.message,
					filePaths: diagnostic.filePaths,
				})),
			}).toEqual(deltaResult);
		} finally {
			await (plugin as unknown as Component).unload();
		}
	});
});
