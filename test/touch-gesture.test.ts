import { describe, expect, it } from "vitest";
import { calculatePinchCamera, TouchGestureController } from "../src/render/touch-gesture";

const camera = { x: 100, y: 80, scale: 1 };

describe("TouchGestureController", () => {
	it("defers a tap until release and honors time and movement thresholds", () => {
		const controller = new TouchGestureController(0.2, 4);
		expect(controller.begin({ pointerId: 1, x: 10, y: 10, time: 0, targetId: "alice" }, camera)).toEqual({
			cancelLongPress: false,
			persistLayout: false,
		});
		expect(controller.move(1, { x: 16, y: 15 }).camera).toBeUndefined();
		expect(controller.end(1, { x: 16, y: 15 }, 499)).toMatchObject({
			tapTargetId: "alice",
			persistLayout: false,
		});

		controller.begin({ pointerId: 2, x: 0, y: 0, time: 0 }, camera);
		expect(controller.end(2, { x: 0, y: 0 }, 499).tapTargetId).toBeNull();

		controller.begin({ pointerId: 3, x: 0, y: 0, time: 0 }, camera);
		expect(controller.end(3, { x: 0, y: 0 }, 501).tapTargetId).toBeUndefined();
	});

	it("turns a greater-than-eight-pixel move into one camera persistence decision", () => {
		const controller = new TouchGestureController(0.2, 4);
		controller.begin({ pointerId: 1, x: 20, y: 20, time: 0, targetId: "alice" }, camera);
		expect(controller.move(1, { x: 28, y: 20 }).camera).toBeUndefined();
		expect(controller.move(1, { x: 29, y: 20 })).toMatchObject({
			camera: { x: 109, y: 80, scale: 1 },
			cancelLongPress: true,
		});
		expect(controller.end(1, { x: 40, y: 25 }, 100)).toMatchObject({
			camera: { x: 120, y: 85, scale: 1 },
			persistLayout: true,
		});
	});

	it("computes pinch from a fixed baseline independent of update order and clamps scale", () => {
		const firstOrder = new TouchGestureController(0.5, 2);
		firstOrder.begin({ pointerId: 1, x: 0, y: 0, time: 0 }, camera);
		firstOrder.begin({ pointerId: 2, x: 100, y: 0, time: 0 }, camera);
		firstOrder.move(1, { x: -50, y: 20 });
		const firstFinal = firstOrder.move(2, { x: 250, y: 20 }).camera;

		const secondOrder = new TouchGestureController(0.5, 2);
		secondOrder.begin({ pointerId: 1, x: 0, y: 0, time: 0 }, camera);
		secondOrder.begin({ pointerId: 2, x: 100, y: 0, time: 0 }, camera);
		secondOrder.move(2, { x: 250, y: 20 });
		const secondFinal = secondOrder.move(1, { x: -50, y: 20 }).camera;

		expect(firstFinal).toEqual(secondFinal);
		expect(firstFinal).toEqual({ x: 200, y: 180, scale: 2 });
		expect(calculatePinchCamera(camera, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 49, y: 0 }, { x: 51, y: 0 }, 0.5, 2).scale).toBe(0.5);
	});

	it("re-baselines a remaining touch after pinch and persists only after the final lift", () => {
		const controller = new TouchGestureController(0.2, 4);
		controller.begin({ pointerId: 1, x: 0, y: 0, time: 0, targetId: "alice" }, camera);
		controller.begin({ pointerId: 2, x: 100, y: 0, time: 0 }, camera);
		controller.move(1, { x: -10, y: 10 });
		controller.move(2, { x: 120, y: 10 });
		const beforeLift = controller.end(2, { x: 120, y: 10 }, 100);
		expect(beforeLift.persistLayout).toBe(false);
		const noJump = controller.move(1, { x: -10, y: 10 });
		expect(noJump.persistLayout).toBe(false);
		expect(noJump.camera).toEqual(beforeLift.camera);
		const continued = controller.move(1, { x: 10, y: 25 });
		expect(continued.persistLayout).toBe(false);
		expect(continued.camera?.x).toBe((beforeLift.camera?.x ?? 0) + 20);
		expect(continued.camera?.y).toBe((beforeLift.camera?.y ?? 0) + 15);
		expect(controller.end(1, { x: 10, y: 25 }, 200)).toMatchObject({
			tapTargetId: undefined,
			persistLayout: true,
		});
	});

	it("consumes a stationary node hold and cancels without persistence", () => {
		const controller = new TouchGestureController(0.2, 4);
		controller.begin({ pointerId: 7, x: 10, y: 10, time: 0, targetId: "alice" }, camera);
		expect(controller.consumeLongPress(7)).toBe("alice");
		expect(controller.end(7, { x: 10, y: 10 }, 500)).toMatchObject({
			tapTargetId: undefined,
			persistLayout: false,
		});

		controller.begin({ pointerId: 8, x: 0, y: 0, time: 0, targetId: "alice" }, camera);
		expect(controller.cancel()).toEqual([8]);
		expect(controller.activePointerIds).toEqual([]);
	});

	it("cancels long press eligibility on movement and a second touch", () => {
		const moved = new TouchGestureController(0.2, 4);
		moved.begin({ pointerId: 1, x: 0, y: 0, time: 0, targetId: "alice" }, camera);
		moved.move(1, { x: 9, y: 0 });
		expect(moved.consumeLongPress(1)).toBeUndefined();

		const multi = new TouchGestureController(0.2, 4);
		multi.begin({ pointerId: 1, x: 0, y: 0, time: 0, targetId: "alice" }, camera);
		multi.begin({ pointerId: 2, x: 100, y: 0, time: 10 }, camera);
		expect(multi.consumeLongPress(1)).toBeUndefined();
	});
});
