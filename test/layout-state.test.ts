import { describe, expect, it } from "vitest";
import { captureLayoutSnapshot, restoreLayoutSnapshot } from "../src/render/layout-state";

describe("layout state", () => {
	it("restores known positions and ignores unknown nodes", () => {
		const fallback = new Map([["alice", { x: 1, y: 2 }], ["bob", { x: 3, y: 4 }]]);
		const restored = restoreLayoutSnapshot({
			positions: { alice: { x: 10, y: 20 }, unknown: { x: 99, y: 99 } },
			camera: { x: 5, y: 6, scale: 2 },
		}, [
			{ id: "alice", kind: "person", label: "Alice", organisations: [], isCenter: false },
			{ id: "bob", kind: "person", label: "Bob", organisations: [], isCenter: false },
		], fallback, { x: 0, y: 0, scale: 1 }, 0.2, 4);

		expect(restored.positions.get("alice")).toEqual({ x: 10, y: 20 });
		expect(restored.positions.get("bob")).toEqual({ x: 3, y: 4 });
		expect(restored.camera).toEqual({ x: 5, y: 6, scale: 2 });
	});

	it("falls back when the saved camera is invalid", () => {
		const restored = restoreLayoutSnapshot({ positions: {}, camera: { x: 1, y: 2, scale: 9 } }, [], new Map(), { x: 10, y: 20, scale: 1 }, 0.2, 4);
		expect(restored.camera).toEqual({ x: 10, y: 20, scale: 1 });
	});

	it("captures finite positions and camera values", () => {
		const captured = captureLayoutSnapshot(new Map([["alice", { x: 1, y: 2 }], ["bad", { x: Number.NaN, y: 3 }]]), { x: 4, y: 5, scale: 1 });
		expect(captured).toEqual({ positions: { alice: { x: 1, y: 2 } }, camera: { x: 4, y: 5, scale: 1 } });
	});
});
