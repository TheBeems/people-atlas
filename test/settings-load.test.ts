import { describe, expect, it } from "vitest";
import { PLUGIN_DATA_SCHEMA_VERSION } from "../src/constants";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { loadPluginSettings } from "../src/settings/load";

describe("plugin settings loading", () => {
	it("uses current defaults for a fresh installation", () => {
		expect(loadPluginSettings(undefined)).toEqual({
			settings: DEFAULT_SETTINGS,
			writeEnabled: true,
		});
	});

	it("rejects every non-current schema without migrating or overwriting it", () => {
		for (const schemaVersion of [undefined, 1, PLUGIN_DATA_SCHEMA_VERSION - 1, PLUGIN_DATA_SCHEMA_VERSION + 1]) {
			const raw = { schemaVersion, peopleFolder: "Private" };
			const original = structuredClone(raw);
			const result = loadPluginSettings(raw);

			expect(result.writeEnabled, String(schemaVersion)).toBe(false);
			expect(result.error, String(schemaVersion)).toContain("unsupported schema version");
			expect(result.settings).toEqual(DEFAULT_SETTINGS);
			expect(raw).toEqual(original);
		}
	});

	it("loads and trims the current settings shape", () => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			peopleFolder: "  Contacts  ",
			myPersonId: "  me-123  ",
		});

		expect(result.writeEnabled).toBe(true);
		expect(result.settings.peopleFolder).toBe("Contacts");
		expect(result.settings.myPersonId).toBe("me-123");
	});

	it("rejects malformed stored fields without enabling writes", () => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			showLabels: "yes",
		});

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("showLabels");
	});

	it("keeps empty or colliding person-owned property mappings read-only", () => {
		const empty = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			emailsProperty: "",
		});
		const collision = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			emailsProperty: "name",
		});

		expect(empty.writeEnabled).toBe(false);
		expect(empty.error).toContain("emailsProperty is invalid");
		expect(collision.writeEnabled).toBe(false);
		expect(collision.error).toContain("nameProperty and emailsProperty");
	});

	it("keeps unsafe contact-moment folders read-only", () => {
		for (const contactMomentsFolder of [
			"/People/Contact moments",
			"C:\\People\\Contact moments",
			"People/../Contact moments",
			"People//Contact moments",
			"https://example.com/contact-moments",
		]) {
			const result = loadPluginSettings({
				...structuredClone(DEFAULT_SETTINGS),
				contactMomentsFolder,
			});

			expect(result.writeEnabled, contactMomentsFolder).toBe(false);
			expect(result.error, contactMomentsFolder).toContain("contactMomentsFolder is invalid");
		}
	});

	it("keeps colliding contact-moment properties and note types read-only", () => {
		const propertyCollision = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			contactMomentSummaryProperty: DEFAULT_SETTINGS.contactMomentChannelProperty,
		});
		const typeCollision = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			personTypeValue: "Same",
			contactMomentTypeValue: "same",
		});

		expect(propertyCollision.writeEnabled).toBe(false);
		expect(propertyCollision.error).toContain("contactMomentChannelProperty and contactMomentSummaryProperty");
		expect(typeCollision.writeEnabled).toBe(false);
		expect(typeCollision.error).toContain("type values must be distinct");
	});

	it("rejects removed direction fields and malformed presets", () => {
		const withDirection = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			relationshipPresets: [
				{
					id: "friends",
					name: "Friends",
					types: ["friend"],
					direction: "undirected",
					fromRole: "Friend",
					toRole: "Friend",
				},
			],
		});
		const malformed = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			relationshipPresets: [{ id: "Bad ID" }],
		});

		expect(withDirection.writeEnabled).toBe(false);
		expect(withDirection.error).toContain("Template direction is not supported");
		expect(malformed.writeEnabled).toBe(false);
		expect(malformed.error).toContain("relationshipPresets[0]");
	});

	it("rejects malformed view state without enabling writes", () => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			viewStates: "invalid",
		});

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("viewStates");
	});
});
