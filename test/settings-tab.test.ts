import { describe, expect, it, vi } from "vitest";
import type PeopleAtlasPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { PeopleAtlasSettingTab } from "../src/settings/settings-tab";

function createTab(myPersonId = "", writesEnabled = true): PeopleAtlasSettingTab {
	const plugin = {
		app: {},
		settings: {
			...structuredClone(DEFAULT_SETTINGS),
			myPersonId,
			relationshipPresets: [
				{
					id: "friend-colleague",
					name: "Friend and colleague",
					types: ["friend", "colleague"],
					fromRole: "Friend",
					toRole: "Colleague",
				},
			],
		},
		getMyPersonCandidates: vi.fn(() => [
			{ id: "alice-id", name: "Alice", filePath: "People/Alice.md" },
			{ id: "bob-id", name: "Bob", filePath: "Archive/Bob.md" },
		]),
		getMyPersonWarning: vi.fn(() =>
			myPersonId === "missing-id" ? "The stored person_id is missing or ambiguous." : undefined,
		),
		canWritePeopleAtlasData: vi.fn(() => writesEnabled),
	} as unknown as PeopleAtlasPlugin;
	return new PeopleAtlasSettingTab(plugin);
}

describe("People Atlas settings definitions", () => {
	it("exposes exactly the ten contact-moment settings with safe inline guidance", () => {
		type TextDefinition = {
			name?: string;
			desc?: string;
			control?: {
				key?: string;
				placeholder?: string;
				validate?: (value: string) => string | undefined;
			};
		};
		const definitions = createTab().getSettingDefinitions() as unknown as TextDefinition[];
		const contactMomentDefinitions = definitions.filter((definition) =>
			definition.control?.key?.startsWith("contactMoment"),
		);
		const typeProperty = definitions.find((definition) => definition.control?.key === "typeProperty");

		expect(contactMomentDefinitions.map((definition) => definition.control?.key).sort()).toEqual(
			[
				"contactMomentsFolder",
				"contactMomentTypeValue",
				"contactMomentIdProperty",
				"contactMomentPeopleProperty",
				"contactMomentRelationshipProperty",
				"contactMomentOccurredOnProperty",
				"contactMomentChannelProperty",
				"contactMomentSummaryProperty",
				"contactMomentFollowUpOnProperty",
				"contactMomentFollowUpStatusProperty",
			].sort(),
		);

		const byKey = (key: string) => contactMomentDefinitions.find((definition) => definition.control?.key === key);
		expect(byKey("contactMomentsFolder")).toMatchObject({
			name: "Contact moments folder",
			desc: "Default vault-relative folder for contact-moment notes created by People Atlas.",
			control: { placeholder: "People/Contact moments" },
		});
		expect(byKey("contactMomentTypeValue")?.desc).toContain("person and relationship type values");
		expect(byKey("contactMomentPeopleProperty")?.desc).toContain("Canonical person-note wikilinks");
		expect(byKey("contactMomentRelationshipProperty")?.desc).toContain("Optional canonical relationship-note wikilink");
		expect(byKey("contactMomentOccurredOnProperty")?.desc).toContain("YYYY-MM-DD");
		expect(byKey("contactMomentFollowUpOnProperty")?.desc).toContain("YYYY-MM-DD");
		expect(byKey("contactMomentFollowUpStatusProperty")?.desc).toContain("open, done or dismissed");

		expect(byKey("contactMomentsFolder")?.control?.validate?.("/People/Contact moments")).toContain(
			"relative to the vault",
		);
		expect(byKey("contactMomentTypeValue")?.control?.validate?.("PERSON")).toContain("must be distinct");
		expect(byKey("contactMomentSummaryProperty")?.control?.validate?.("channel")).toContain("must be distinct");
		expect(byKey("contactMomentSummaryProperty")?.control?.validate?.("moment_summary")).toBeUndefined();
		expect(typeProperty?.control?.validate?.("contact_moment_id")).toContain("must be distinct");
	});

	it("offers None and canonical explicit My person candidates without direction or Person A/B settings", () => {
		const definitions = createTab().getSettingDefinitions() as unknown as Array<Record<string, unknown>>;
		const myPerson = definitions.find((definition) => definition.name === "My person");
		const direction = definitions.find((definition) => definition.name === "Relationship direction property");
		const legacyPreset = definitions.find((definition) => definition.name === "Relationship preset property");
		const legacyFirstRole = definitions.find((definition) => definition.name === "Person A role property");
		const legacySecondRole = definitions.find((definition) => definition.name === "Person B role property");

		expect(direction).toBeUndefined();
		expect(legacyPreset).toBeUndefined();
		expect(legacyFirstRole).toBeUndefined();
		expect(legacySecondRole).toBeUndefined();
		expect(myPerson).toMatchObject({
			name: "My person",
			control: {
				type: "dropdown",
				key: "myPersonId",
				options: {
					"": "None",
					"alice-id": "Alice — People/Alice.md",
					"bob-id": "Bob — Archive/Bob.md",
				},
			},
		});
	});

	it("uses relationship template copy semantics and explicit endpoint-slot role labels", () => {
		const definitions = createTab().getSettingDefinitions() as unknown as Array<Record<string, unknown>>;
		const templateProperty = definitions.find((definition) => definition.name === "Relationship template property");
		const firstRole = definitions.find((definition) => definition.name === "First-person role property");
		const secondRole = definitions.find((definition) => definition.name === "Second-person role property");
		const templates = definitions.find((definition) => definition.type === "list") as
			| {
					heading?: string;
					emptyState?: string;
					items?: Array<{ desc?: string }>;
					addItem?: { name?: string };
			  }
			| undefined;

		expect(templateProperty?.desc).toBe("Optional stable template ID copied onto a relationship note as provenance.");
		expect(firstRole?.desc).toBe("Optional role of the first endpoint relative to the second endpoint.");
		expect(secondRole?.desc).toBe("Optional role of the second endpoint relative to the first endpoint.");
		expect(templates).toMatchObject({
			heading: "Relationship templates",
			addItem: { name: "Add relationship template" },
		});
		expect(templates?.emptyState).toContain("they are not live links");
		expect(templates?.items?.[0]?.desc).toBe(
			"friend-colleague · types: friend, colleague · first-person role: Friend · second-person role: Colleague",
		);
	});

	it("keeps an unavailable stored My person visible and reports the recoverable warning", () => {
		const definitions = createTab("missing-id").getSettingDefinitions() as unknown as Array<Record<string, unknown>>;
		const myPerson = definitions.find((definition) => definition.name === "My person");

		expect(myPerson?.desc).toContain("Warning: The stored person_id is missing or ambiguous.");
		expect(myPerson).toMatchObject({
			control: {
				options: {
					"missing-id": "Unavailable: missing-id",
				},
			},
		});
	});

	it("exposes relationship templates as read-only while plugin data writes are disabled", () => {
		const definitions = createTab("", false).getSettingDefinitions() as unknown as Array<Record<string, unknown>>;
		const templates = definitions.find((definition) => definition.type === "list") as
			| {
					emptyState?: string;
					onReorder?: unknown;
					onDelete?: unknown;
					addItem?: unknown;
			  }
			| undefined;

		expect(templates?.emptyState).toContain("Template settings are read-only");
		expect(templates?.onReorder).toBeUndefined();
		expect(templates?.onDelete).toBeUndefined();
		expect(templates?.addItem).toBeUndefined();
	});
});
