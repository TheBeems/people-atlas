import { describe, expect, it, vi } from "vitest";
import type { HeapObservation } from "./performance-model";
import {
	recordPhotoAvatarCharacterization,
	type PhotoAvatarCharacterizationDriver,
	type PhotoCacheStats,
	validatePhotoAvatarCharacterizationRecord,
} from "./photo-avatar-characterization";
import {
	generatePhotoAvatarPerformanceFixture,
	PHOTO_AVATAR_COUNT,
	PHOTO_AVATAR_FIXTURE_SIZE,
	PHOTO_AVATAR_MAX_DIMENSION,
	PHOTO_AVATAR_READY_LIMIT,
	validatePhotoAvatarPerformanceFixture,
} from "./photo-avatar-fixture";

type DriverPhase = "before" | "initial" | "settled" | "destroyed";

function stats(phase: DriverPhase): PhotoCacheStats {
	return {
		ready: phase === "settled" ? PHOTO_AVATAR_COUNT : 0,
		pending: phase === "initial" ? PHOTO_AVATAR_COUNT : 0,
		failed: 0,
		total: phase === "initial" || phase === "settled" ? PHOTO_AVATAR_COUNT : 0,
		maxReady: PHOTO_AVATAR_READY_LIMIT,
		maxPending: PHOTO_AVATAR_READY_LIMIT,
		maxFailed: PHOTO_AVATAR_READY_LIMIT,
		maxDimension: PHOTO_AVATAR_MAX_DIMENSION,
		retainedPixels: phase === "settled" ? PHOTO_AVATAR_COUNT * 240 * 240 : 0,
		destroyed: phase === "destroyed",
	};
}

function controlledDriver(options: { initialMs?: number; settledMs?: number } = {}): {
	driver: PhotoAvatarCharacterizationDriver;
	events: string[];
	destroy: ReturnType<typeof vi.fn>;
} {
	let phase: DriverPhase = "before";
	const events: string[] = [];
	const destroy = vi.fn(() => {
		events.push("destroy");
		phase = "destroyed";
	});
	const retainedHeap: HeapObservation = {
		stage: "photo-avatar-retained-cache",
		heapUsedBytes: 12_345,
		totalHeapBytes: 67_890,
		explicitGcAvailable: false,
		kind: "retained-heap-observation",
	};
	return {
		events,
		destroy,
		driver: {
			async paintInitial(snapshot) {
				events.push("initial-paint");
				expect(snapshot.nodes.filter((node) => node.photoPath)).toHaveLength(PHOTO_AVATAR_COUNT);
				expect(phase).toBe("before");
				phase = "initial";
				return options.initialMs ?? 2.5;
			},
			async settleDecodesAndRedraw() {
				events.push("settle-decodes-and-redraw");
				expect(phase).toBe("initial");
				phase = "settled";
				return options.settledMs ?? 7.75;
			},
			getPhotoCacheStats() {
				events.push(`stats:${phase}`);
				return stats(phase);
			},
			async captureRetainedHeap() {
				events.push("retained-heap");
				expect(phase).toBe("settled");
				return retainedHeap;
			},
			destroy,
		},
	};
}

describe("UX5 photo-avatar performance fixture", () => {
	it("generates the same bounded photo-populated graph without wall-clock or random input", () => {
		const first = generatePhotoAvatarPerformanceFixture();
		const second = generatePhotoAvatarPerformanceFixture();

		expect(first).toEqual(second);
		expect(first.counts).toEqual({
			people: PHOTO_AVATAR_FIXTURE_SIZE,
			relationships: PHOTO_AVATAR_FIXTURE_SIZE * 2,
			nodes: PHOTO_AVATAR_FIXTURE_SIZE,
			edges: PHOTO_AVATAR_FIXTURE_SIZE * 2,
			photos: PHOTO_AVATAR_COUNT,
		});
		expect(first.assets).toHaveLength(PHOTO_AVATAR_READY_LIMIT);
		expect(new Set(first.assets.map((asset) => asset.path)).size).toBe(PHOTO_AVATAR_COUNT);
		expect(new Set(first.assets.map((asset) => asset.revision)).size).toBe(PHOTO_AVATAR_COUNT);
		expect(first.assets[0]).toMatchObject({
			personId: "person-000000",
			path: "Assets/People Atlas Performance/photo-000000.png",
			sourceWidth: 320,
			sourceHeight: 240,
			paintSeed: 0,
		});
		expect(first.assets[1]).toMatchObject({
			personId: "person-000001",
			path: "Assets/People Atlas Performance/photo-000001.png",
			sourceWidth: 240,
			sourceHeight: 320,
			paintSeed: 1,
		});
		expect(first.raw.people.slice(0, PHOTO_AVATAR_COUNT).every((person) => person.photoPath)).toBe(true);
		expect(first.raw.people.slice(PHOTO_AVATAR_COUNT).every((person) => person.photoPath === undefined)).toBe(true);
		expect(() => validatePhotoAvatarPerformanceFixture(first)).not.toThrow();
	});

	it("records pending initial paint, deterministic settlement, retained cache, and cleanup without a threshold", async () => {
		const fixture = generatePhotoAvatarPerformanceFixture();
		const { driver, events, destroy } = controlledDriver({
			initialMs: 1_000_000,
			settledMs: 2_000_000,
		});

		const record = await recordPhotoAvatarCharacterization(fixture, driver);

		expect(record.initialPaint).toMatchObject({
			stage: "initial-paint",
			elapsedMs: 1_000_000,
			cache: { ready: 0, pending: PHOTO_AVATAR_COUNT, total: PHOTO_AVATAR_COUNT },
		});
		expect(record.settledRedraw).toMatchObject({
			stage: "settled-redraw",
			elapsedMs: 2_000_000,
			cache: { ready: PHOTO_AVATAR_COUNT, pending: 0, total: PHOTO_AVATAR_COUNT },
		});
		expect(record.retainedCache).toMatchObject({
			stage: "retained-cache",
			cache: { ready: PHOTO_AVATAR_COUNT, total: PHOTO_AVATAR_COUNT },
			heap: { kind: "retained-heap-observation", explicitGcAvailable: false },
		});
		expect(record.afterDestroy).toEqual(stats("destroyed"));
		expect(record.evidenceBoundary).toEqual({
			classification: "deterministic-scaffold",
			thresholdsApplied: false,
			workerClaim: false,
			liveObsidianProof: false,
		});
		expect(events).toEqual([
			"initial-paint",
			"stats:initial",
			"settle-decodes-and-redraw",
			"stats:settled",
			"stats:settled",
			"retained-heap",
			"destroy",
			"stats:destroyed",
		]);
		expect(destroy).toHaveBeenCalledOnce();
		expect(() => validatePhotoAvatarCharacterizationRecord(record)).not.toThrow();
	});

	it("rejects a ready image before controlled settlement and still destroys the driver", async () => {
		const fixture = generatePhotoAvatarPerformanceFixture();
		const destroy = vi.fn();
		const driver: PhotoAvatarCharacterizationDriver = {
			paintInitial: async () => 1,
			settleDecodesAndRedraw: async () => 1,
			getPhotoCacheStats: () => ({
				...stats("initial"),
				ready: 1,
				pending: PHOTO_AVATAR_COUNT - 1,
			}),
			destroy,
		};

		await expect(recordPhotoAvatarCharacterization(fixture, driver)).rejects.toThrow(
			"Initial paint must complete with every controlled decode pending and no ready image.",
		);
		expect(destroy).toHaveBeenCalledOnce();
	});
});
