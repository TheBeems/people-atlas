import type { AtlasSnapshot } from "../../src/domain/types";
import type { HeapObservation } from "./performance-model";
import {
	PHOTO_AVATAR_COUNT,
	PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION,
	PHOTO_AVATAR_MAX_DIMENSION,
	PHOTO_AVATAR_READY_LIMIT,
	type PhotoAvatarFixtureCounts,
	type PhotoAvatarPerformanceFixture,
} from "./photo-avatar-fixture";

export const PHOTO_AVATAR_CHARACTERIZATION_RUNNER_VERSION = "ux5-photo-avatar-characterization-v1";

export type PhotoAvatarEvidenceClassification = "deterministic-scaffold" | "controlled-chromium";

export interface PhotoCacheStats {
	ready: number;
	pending: number;
	failed: number;
	total: number;
	maxReady: number;
	maxPending: number;
	maxFailed: number;
	maxDimension: number;
	retainedPixels: number;
	destroyed: boolean;
}

export interface PhotoAvatarFrameObservation {
	stage: "initial-paint" | "settled-redraw";
	elapsedMs: number;
	cache: PhotoCacheStats;
}

export interface PhotoAvatarRetainedCacheObservation {
	stage: "retained-cache";
	cache: PhotoCacheStats;
	heap: HeapObservation;
}

export interface PhotoAvatarCharacterizationRecord {
	runnerVersion: typeof PHOTO_AVATAR_CHARACTERIZATION_RUNNER_VERSION;
	fixtureContractVersion: typeof PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION;
	counts: PhotoAvatarFixtureCounts;
	initialPaint: PhotoAvatarFrameObservation;
	settledRedraw: PhotoAvatarFrameObservation;
	retainedCache: PhotoAvatarRetainedCacheObservation;
	afterDestroy: PhotoCacheStats;
	evidenceBoundary: {
		classification: PhotoAvatarEvidenceClassification;
		thresholdsApplied: false;
		workerClaim: false;
		liveObsidianProof: false;
	};
}

export interface PhotoAvatarCharacterizationDriver {
	readonly evidenceClassification?: PhotoAvatarEvidenceClassification;
	paintInitial(snapshot: AtlasSnapshot): Promise<number>;
	settleDecodesAndRedraw(): Promise<number>;
	getPhotoCacheStats(): PhotoCacheStats;
	captureRetainedHeap?(): Promise<HeapObservation>;
	destroy(): void;
}

function copyStats(stats: PhotoCacheStats): PhotoCacheStats {
	return { ...stats };
}

function validateElapsed(value: number, label: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(`${label} must be a finite, non-negative observation.`);
	}
}

export function validatePhotoCacheStats(stats: PhotoCacheStats, label: string): void {
	for (const field of [
		"ready",
		"pending",
		"failed",
		"total",
		"maxReady",
		"maxPending",
		"maxFailed",
		"maxDimension",
		"retainedPixels",
	] as const) {
		const value = stats[field];
		if (!Number.isInteger(value) || value < 0) {
			throw new Error(`${label}.${field} must be a non-negative integer.`);
		}
	}
	if (stats.total !== stats.ready + stats.pending + stats.failed) {
		throw new Error(`${label}.total must equal ready + pending + failed.`);
	}
	if (stats.maxReady !== PHOTO_AVATAR_READY_LIMIT) {
		throw new Error(`${label}.maxReady must expose the fixed UX5 ${PHOTO_AVATAR_READY_LIMIT}-entry bound.`);
	}
	if (stats.maxPending !== PHOTO_AVATAR_READY_LIMIT || stats.maxFailed !== PHOTO_AVATAR_READY_LIMIT) {
		throw new Error(`${label} must expose the fixed UX5 pending and failure bounds.`);
	}
	if (stats.ready > stats.maxReady) {
		throw new Error(`${label}.ready exceeds the configured ready-entry bound.`);
	}
	if (stats.maxDimension <= 0 || stats.maxDimension > PHOTO_AVATAR_MAX_DIMENSION) {
		throw new Error(`${label}.maxDimension exceeds the fixed UX5 thumbnail dimension.`);
	}
}

function validateInitialPaint(observation: PhotoAvatarFrameObservation): void {
	if (observation.stage !== "initial-paint") throw new Error("Initial observation has the wrong stage.");
	validateElapsed(observation.elapsedMs, "initialPaint.elapsedMs");
	validatePhotoCacheStats(observation.cache, "initialPaint.cache");
	if (
		observation.cache.ready !== 0 ||
		observation.cache.pending !== PHOTO_AVATAR_COUNT ||
		observation.cache.failed !== 0 ||
		observation.cache.total !== PHOTO_AVATAR_COUNT ||
		observation.cache.retainedPixels !== 0 ||
		observation.cache.destroyed
	) {
		throw new Error("Initial paint must complete with every controlled decode pending and no ready image.");
	}
}

function validateSettledRedraw(observation: PhotoAvatarFrameObservation): void {
	if (observation.stage !== "settled-redraw") throw new Error("Settled observation has the wrong stage.");
	validateElapsed(observation.elapsedMs, "settledRedraw.elapsedMs");
	validatePhotoCacheStats(observation.cache, "settledRedraw.cache");
	if (
		observation.cache.ready !== PHOTO_AVATAR_COUNT ||
		observation.cache.pending !== 0 ||
		observation.cache.failed !== 0 ||
		observation.cache.total !== PHOTO_AVATAR_COUNT ||
		observation.cache.retainedPixels <= 0 ||
		observation.cache.retainedPixels > PHOTO_AVATAR_COUNT * PHOTO_AVATAR_MAX_DIMENSION * PHOTO_AVATAR_MAX_DIMENSION ||
		observation.cache.destroyed
	) {
		throw new Error("Settled redraw must retain every successful fixture thumbnail and no pending decode.");
	}
}

function validateRetainedCache(observation: PhotoAvatarRetainedCacheObservation): void {
	if (observation.stage !== "retained-cache") throw new Error("Retained-cache observation has the wrong stage.");
	validatePhotoCacheStats(observation.cache, "retainedCache.cache");
	if (
		observation.cache.ready !== PHOTO_AVATAR_COUNT ||
		observation.cache.pending !== 0 ||
		observation.cache.failed !== 0 ||
		observation.cache.total !== PHOTO_AVATAR_COUNT ||
		observation.cache.retainedPixels <= 0 ||
		observation.cache.destroyed
	) {
		throw new Error("Retained-cache observation must preserve the settled bounded cache state.");
	}
	if (!observation.heap.stage || !observation.heap.kind) {
		throw new Error("Retained-cache heap evidence must state its stage and observation kind.");
	}
}

export function validatePhotoAvatarCharacterizationRecord(record: PhotoAvatarCharacterizationRecord): void {
	if (record.runnerVersion !== PHOTO_AVATAR_CHARACTERIZATION_RUNNER_VERSION) {
		throw new Error("Photo-avatar characterization runner version is incompatible.");
	}
	if (record.fixtureContractVersion !== PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION) {
		throw new Error("Photo-avatar characterization fixture version is incompatible.");
	}
	if (record.counts.photos !== PHOTO_AVATAR_COUNT) {
		throw new Error("Photo-avatar characterization did not retain the exact fixture photo count.");
	}
	validateInitialPaint(record.initialPaint);
	validateSettledRedraw(record.settledRedraw);
	validateRetainedCache(record.retainedCache);
	if (record.retainedCache.cache.retainedPixels !== record.settledRedraw.cache.retainedPixels) {
		throw new Error("Retained-cache pixels must match the settled redraw observation.");
	}
	validatePhotoCacheStats(record.afterDestroy, "afterDestroy");
	if (
		!record.afterDestroy.destroyed ||
		record.afterDestroy.ready !== 0 ||
		record.afterDestroy.pending !== 0 ||
		record.afterDestroy.failed !== 0 ||
		record.afterDestroy.total !== 0 ||
		record.afterDestroy.retainedPixels !== 0
	) {
		throw new Error("Destroyed photo cache must expose no retained entries.");
	}
	if (
		!["deterministic-scaffold", "controlled-chromium"].includes(record.evidenceBoundary.classification) ||
		record.evidenceBoundary.thresholdsApplied !== false ||
		record.evidenceBoundary.workerClaim !== false ||
		record.evidenceBoundary.liveObsidianProof !== false
	) {
		throw new Error("Photo-avatar characterization overstates its evidence boundary.");
	}
}

function missingHeapObservation(classification: PhotoAvatarEvidenceClassification): HeapObservation {
	return {
		stage: "photo-avatar-retained-cache",
		explicitGcAvailable: false,
		kind: "missing",
		missingReason:
			classification === "controlled-chromium"
				? "No CDP retained-heap provider was configured for this controlled Chromium observation."
				: "No retained-heap provider was configured for this deterministic characterization scaffold.",
	};
}

export async function recordPhotoAvatarCharacterization(
	fixture: PhotoAvatarPerformanceFixture,
	driver: PhotoAvatarCharacterizationDriver,
): Promise<PhotoAvatarCharacterizationRecord> {
	const evidenceClassification = driver.evidenceClassification ?? "deterministic-scaffold";
	let destroyAttempted = false;
	try {
		const initialPaint: PhotoAvatarFrameObservation = {
			stage: "initial-paint",
			elapsedMs: await driver.paintInitial(fixture.snapshot),
			cache: copyStats(driver.getPhotoCacheStats()),
		};
		validateInitialPaint(initialPaint);

		const settledRedraw: PhotoAvatarFrameObservation = {
			stage: "settled-redraw",
			elapsedMs: await driver.settleDecodesAndRedraw(),
			cache: copyStats(driver.getPhotoCacheStats()),
		};
		validateSettledRedraw(settledRedraw);

		const retainedCache: PhotoAvatarRetainedCacheObservation = {
			stage: "retained-cache",
			cache: copyStats(driver.getPhotoCacheStats()),
			heap: driver.captureRetainedHeap
				? await driver.captureRetainedHeap()
				: missingHeapObservation(evidenceClassification),
		};
		validateRetainedCache(retainedCache);

		destroyAttempted = true;
		driver.destroy();
		const record: PhotoAvatarCharacterizationRecord = {
			runnerVersion: PHOTO_AVATAR_CHARACTERIZATION_RUNNER_VERSION,
			fixtureContractVersion: PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION,
			counts: { ...fixture.counts },
			initialPaint,
			settledRedraw,
			retainedCache,
			afterDestroy: copyStats(driver.getPhotoCacheStats()),
			evidenceBoundary: {
				classification: evidenceClassification,
				thresholdsApplied: false,
				workerClaim: false,
				liveObsidianProof: false,
			},
		};
		validatePhotoAvatarCharacterizationRecord(record);
		return record;
	} finally {
		if (!destroyAttempted) driver.destroy();
	}
}
