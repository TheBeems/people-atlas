import { describe, expect, it } from "vitest";
import {
	buildLayoutKey,
	DEFAULT_VIEW_STATE,
	normalizeViewStates,
	validateStoredViewStates,
} from "../src/settings/view-state";
import { buildBasesOptions, BASES_OPTION_KEYS } from "../src/bases/options";
import { createTranslator } from "../src/i18n";

describe("network presentation state and native Bases options", () => {
	it("accepts old schema-1 states and retains explicit family/date state", () => {
		const old = structuredClone(DEFAULT_VIEW_STATE);
		expect(validateStoredViewStates({ old })).toBeUndefined();
		expect(normalizeViewStates({ old }).old).toEqual(old);
		const configured = { ...old, layoutMode: "family" as const, relationshipDate: "2024-02-29" };
		expect(normalizeViewStates({ configured }).configured).toEqual(configured);
		for (const invalid of [
			{ ...old, layoutMode: "force" },
			{ ...old, relationshipDate: "2024-02-30" },
		]) {
			expect(validateStoredViewStates({ invalid })).toBeDefined();
		}
	});
	it("isolates family/date layouts while preserving the old radial layout key", () => {
		const old = buildLayoutKey("view", DEFAULT_VIEW_STATE, "a");
		expect(buildLayoutKey("view", { ...DEFAULT_VIEW_STATE, layoutMode: "radial", relationshipDate: null }, "a")).toBe(
			old,
		);
		expect(buildLayoutKey("view", { ...DEFAULT_VIEW_STATE, layoutMode: "family" }, "a")).not.toBe(old);
		expect(buildLayoutKey("view", { ...DEFAULT_VIEW_STATE, relationshipDate: "2026-10-03" }, "a")).not.toBe(old);
	});
	it("uses translated native dropdowns without changing persisted option keys", () => {
		const options = buildBasesOptions(createTranslator("nl"));
		expect(options.map((option) => option.key).sort()).toEqual(Object.values(BASES_OPTION_KEYS).sort());
		expect(options.find((option) => option.key === "centerMode")).toMatchObject({
			type: "dropdown",
			options: { "selected-node": createTranslator("nl").peopleAtlasView.selectedNode },
		});
		expect(options.find((option) => option.key === "projectionMode")).toMatchObject({ type: "dropdown" });
		expect(options.find((option) => option.key === "layoutMode")).toMatchObject({
			type: "dropdown",
			options: { radial: "Radiaal netwerk", family: "Familie (expliciete ouder/kindrollen)" },
		});
		expect(options.find((option) => option.key === "hops")?.displayName).toBe("Netwerkafstand (hele stappen)");
	});
});
