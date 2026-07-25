import { describe, expect, it } from "vitest";
import { PLUGIN_DATA_SCHEMA_VERSION } from "../src/constants";
import { loadPluginSettings } from "../src/settings/migrations";

describe("plugin settings migrations", () => {
	it("migrates schema v1 to the current shape", () => {
		const result = loadPluginSettings({ schemaVersion: 1, showLabels: false });

		expect(result.writeEnabled).toBe(true);
		expect(result.migrated).toBe(true);
		expect(result.settings.schemaVersion).toBe(PLUGIN_DATA_SCHEMA_VERSION);
		expect(result.settings.peopleFolder).toBe("People");
		expect(result.settings.showLabels).toBe(false);
	});

	it("keeps future-version data read-only and uses safe defaults", () => {
		const raw = { schemaVersion: PLUGIN_DATA_SCHEMA_VERSION + 1, peopleFolder: "Private" };
		const result = loadPluginSettings(raw);

		expect(result.writeEnabled).toBe(false);
		expect(result.migrated).toBe(false);
		expect(result.error).toContain("unsupported schema version");
		expect(result.settings.peopleFolder).toBe("People");
		expect(raw).toEqual({ schemaVersion: PLUGIN_DATA_SCHEMA_VERSION + 1, peopleFolder: "Private" });
	});

	it("rejects malformed stored fields without enabling writes", () => {
		const result = loadPluginSettings({ schemaVersion: 2, showLabels: "yes" });

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("showLabels");
	});

	it("migrates schema v2 with an empty view-state collection", () => {
		const result = loadPluginSettings({ schemaVersion: 2, peopleFolder: "People" });

		expect(result.writeEnabled).toBe(true);
		expect(result.migrated).toBe(true);
		expect(result.settings.viewStates).toEqual({});
	});

	it("rejects malformed view state without enabling writes", () => {
		const result = loadPluginSettings({ schemaVersion: PLUGIN_DATA_SCHEMA_VERSION, viewStates: "invalid" });

		expect(result.writeEnabled).toBe(false);
		expect(result.error).toContain("viewStates");
	});
});
