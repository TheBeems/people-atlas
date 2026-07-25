import { describe, expect, it } from "vitest";
import { buildLayoutKey, DEFAULT_VIEW_STATE, MAX_CENTER_HISTORY, rememberCenter, normalizeViewStates } from "../src/settings/view-state";

describe("view state", () => {
	it("keeps center history recent-first and bounded", () => {
		let state = DEFAULT_VIEW_STATE;
		for (let index = 0; index < MAX_CENTER_HISTORY + 3; index += 1) state = rememberCenter(state, `person-${index}`);

		expect(state.centerHistory).toHaveLength(MAX_CENTER_HISTORY);
		expect(state.centerHistory[0]).toBe(`person-${MAX_CENTER_HISTORY + 2}`);
		expect(rememberCenter(state, state.centerHistory[5]!).centerHistory[0]).toBe(state.centerHistory[5]);
	});

	it("isolates layout keys by view and projection inputs", () => {
		const first = buildLayoutKey("standalone", DEFAULT_VIEW_STATE, "alice");
		const second = buildLayoutKey("bases:friends", DEFAULT_VIEW_STATE, "alice");
		const third = buildLayoutKey("standalone", { ...DEFAULT_VIEW_STATE, projectionMode: "free-network" }, "alice");

		expect(new Set([first, second, third]).size).toBe(3);
	});

	it("drops invalid view-state entries during safe normalization", () => {
		const result = normalizeViewStates({
			valid: { ...DEFAULT_VIEW_STATE },
			invalid: { ...DEFAULT_VIEW_STATE, hops: -1 },
		});

		expect(Object.keys(result)).toEqual(["valid"]);
	});
});
