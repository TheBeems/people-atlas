import { describe, expect, it } from "vitest";
import { PLUGIN_DATA_SCHEMA_VERSION } from "../src/constants";
import { personProfilePath } from "../src/domain/people-paths";
import { parsePersonReference } from "../src/domain/wikilink";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { loadPluginSettings } from "../src/settings/load";
import { validatePropertyName } from "../src/settings/validate";

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

	it("keeps exact legacy schema 7 folder data read-only without reinterpreting its root", () => {
		const raw = {
			schemaVersion: 7,
			peopleFolder: "Private/People",
			contactMomentsFolder: "Private/Moments",
		};
		const original = structuredClone(raw);

		const result = loadPluginSettings(raw);

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("unsupported schema version 7");
		expect(result.settings).toEqual(DEFAULT_SETTINGS);
		expect(result.settings.peopleRootFolder).toBe("People");
		expect(raw).toEqual(original);
	});

	it("loads and trims exactly one current People root without legacy folder compatibility", () => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			peopleRootFolder: "  Second Brain/People  ",
			peopleFolder: "Legacy People",
			contactMomentsFolder: "Legacy Moments",
			myPersonId: "  me-123  ",
		});

		expect(result.writeEnabled).toBe(true);
		expect(result.settings.peopleRootFolder).toBe("Second Brain/People");
		expect(result.settings).not.toHaveProperty("peopleFolder");
		expect(result.settings).not.toHaveProperty("contactMomentsFolder");
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

	it("keeps unsafe People root folders read-only", () => {
		for (const peopleRootFolder of [
			"/People",
			"C:\\People",
			"Second Brain/../People",
			"Second Brain//People",
			"https://example.com/people",
		]) {
			const result = loadPluginSettings({
				...structuredClone(DEFAULT_SETTINGS),
				peopleRootFolder,
			});

			expect(result.writeEnabled, peopleRootFolder).toBe(false);
			expect(result.error, peopleRootFolder).toContain("peopleRootFolder is invalid");
		}
	});

	it.each([
		"People/",
		"Second Brain/People/",
	])("keeps the exact schema 8 trailing-slash People root %j read-only without sanitizing stored input", (peopleRootFolder) => {
		const raw = {
			...structuredClone(DEFAULT_SETTINGS),
			peopleRootFolder,
		};
		const original = structuredClone(raw);

		const result = loadPluginSettings(raw);

		expect({
			writeEnabled: result.writeEnabled,
			settings: result.settings,
			error: result.error,
		}).toEqual({
			writeEnabled: false,
			settings: DEFAULT_SETTINGS,
			error: expect.stringMatching(/peopleRootFolder is invalid:.*(?:trailing slash|must not end)/i),
		});
		expect(raw).toEqual(original);
	});

	it("keeps the exact schema 8 unsafe People root read-only before its broken wikilink can persist", () => {
		const peopleRootFolder = "Second Brain/People|Archive";
		const profilePath = personProfilePath(peopleRootFolder, "Alice", "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb");
		const canonicalTarget = profilePath.replace(/\.md$/i, "");
		const parsed = parsePersonReference(`[[${canonicalTarget}]]`);
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			peopleRootFolder,
		});

		expect({
			writeEnabled: result.writeEnabled,
			parsedTarget: parsed?.target,
			canonicalTarget,
		}).toEqual({
			writeEnabled: false,
			parsedTarget: "Second Brain/People",
			canonicalTarget: "Second Brain/People|Archive/Profiles/Alice/Alice",
		});
		expect(result.error).toContain("peopleRootFolder is invalid");
	});

	it.each([
		["backslash separator", "Second Brain\\People"],
		["wikilink alias delimiter", "Second Brain/People|Archive"],
		["opening wikilink bracket", "Second Brain/People[Archive"],
		["closing wikilink bracket", "Second Brain/People]Archive"],
		["heading delimiter", "Second Brain/People#Archive"],
		["block delimiter", "Second Brain/People^Archive"],
		["query delimiter", "Second Brain/People?Archive"],
		["NUL control", "Second Brain/People\u0000Archive"],
		["unit-separator control", "Second Brain/People\u001fArchive"],
		["DEL control", "Second Brain/People\u007fArchive"],
		["trailing newline control", "Second Brain/People\n"],
		["less-than", "Second Brain/People<Archive"],
		["greater-than", "Second Brain/People>Archive"],
		["colon", "Second Brain/People:Archive"],
		["quote", 'Second Brain/People"Archive'],
		["asterisk", "Second Brain/People*Archive"],
	] as const)("rejects the unsafe People root segment character $0", (_label, peopleRootFolder) => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			peopleRootFolder,
		});

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("peopleRootFolder is invalid");
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

	it.each([
		"naïve_关系-2",
		"_private-2",
		"Ångström9-β",
		"𐐀name",
	])("accepts Unicode property names with the configured grammar: %s", (propertyName) => {
		expect(validatePropertyName(propertyName)).toBeUndefined();
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			nameProperty: propertyName,
		});
		expect(result.writeEnabled).toBe(true);
		expect(result.settings.nameProperty).toBe(propertyName);
	});

	it("accepts a Unicode decimal digit after the first code point and has no length cap", () => {
		const propertyName = `a${"x".repeat(1024)}\u0661`;
		expect(validatePropertyName(propertyName)).toBeUndefined();
		expect(loadPluginSettings({ ...structuredClone(DEFAULT_SETTINGS), nameProperty: propertyName }).writeEnabled).toBe(
			true,
		);
	});

	it.each([
		"bad:key",
		"name#comment",
		"{nested}",
		"[list]",
		"-name",
		"9lives",
		"?name",
		":name",
		"e\u0301",
		"name value",
		"nul\u0000key",
	])("rejects unsafe property name %j", (propertyName) => {
		expect(validatePropertyName(propertyName)).toContain("Property names");
	});

	it.each([
		"typeProperty",
		"personIdProperty",
		"nameProperty",
		"aliasesProperty",
		"organisationsProperty",
		"photoProperty",
		"contactsProperty",
		"birthDateProperty",
		"pronounsProperty",
		"genderProperty",
		"emailsProperty",
		"phonesProperty",
		"jobTitleProperty",
		"relationshipIdProperty",
		"relationshipFromProperty",
		"relationshipToProperty",
		"relationshipTypesProperty",
		"relationshipPresetProperty",
		"relationshipFromRoleProperty",
		"relationshipToRoleProperty",
		"closenessProperty",
		"sinceProperty",
		"lastContactProperty",
		"statusProperty",
		"contactMomentIdProperty",
		"contactMomentPeopleProperty",
		"contactMomentRelationshipProperty",
		"contactMomentOccurredOnProperty",
		"contactMomentChannelProperty",
		"contactMomentSummaryProperty",
		"contactMomentFollowUpOnProperty",
		"contactMomentFollowUpStatusProperty",
	] as const)("keeps unsafe persisted property %s read-only", (key) => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			[key]: "bad:key",
		});

		expect(result.writeEnabled, key).toBe(false);
		expect(result.error, key).toContain(`${key} is invalid`);
	});

	it("rejects a Unicode-safe property name only when its existing mapping collides", () => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			nameProperty: "naïve_关系-2",
			aliasesProperty: "naïve_关系-2",
		});

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("nameProperty and aliasesProperty");
	});

	it("rejects unsafe relationship properties before enabling stored writes", () => {
		const result = loadPluginSettings({
			...structuredClone(DEFAULT_SETTINGS),
			relationshipIdProperty: "[relationship]",
		});

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("relationshipIdProperty is invalid");
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
