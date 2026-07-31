import type { AtlasSnapshot, PersonRecord, RawIndexSnapshot } from "../../src/domain/types";
import { isSupportedPersonPhotoPath } from "../../src/domain/person-photo";
import {
	buildPerformanceSnapshot,
	generatePerformanceFixture,
	validatePerformanceFixture,
	validateSnapshotCounts,
} from "./fixture";
import { FIXTURE_CONTRACT_VERSION, type FixtureCounts } from "./performance-model";

export const PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION = "ux5-photo-avatar-characterization-v1";
export const PHOTO_AVATAR_FIXTURE_SIZE = 100;
export const PHOTO_AVATAR_FIXTURE_PROFILE = "sparse";
export const PHOTO_AVATAR_COUNT = 64;
export const PHOTO_AVATAR_READY_LIMIT = 64;
export const PHOTO_AVATAR_MAX_DIMENSION = 256;

export interface PhotoAvatarAssetFixture {
	personId: string;
	path: string;
	modifiedTime: number;
	sourceSizeBytes: number;
	sourceWidth: number;
	sourceHeight: number;
	paintSeed: number;
	revision: string;
}

export interface PhotoAvatarFixtureCounts extends FixtureCounts {
	photos: number;
}

export interface PhotoAvatarPerformanceFixture {
	contractVersion: typeof PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION;
	baseContractVersion: typeof FIXTURE_CONTRACT_VERSION;
	size: typeof PHOTO_AVATAR_FIXTURE_SIZE;
	profile: typeof PHOTO_AVATAR_FIXTURE_PROFILE;
	assets: PhotoAvatarAssetFixture[];
	raw: RawIndexSnapshot;
	snapshot: AtlasSnapshot;
	counts: PhotoAvatarFixtureCounts;
}

function ordinal(value: number): string {
	return value.toString().padStart(6, "0");
}

function createAsset(personId: string, index: number): PhotoAvatarAssetFixture {
	const suffix = ordinal(index);
	const modifiedTime = 1_700_000_000_000 + index;
	const sourceSizeBytes = 4_096 + index;
	const landscape = index % 2 === 0;
	return {
		personId,
		path: `Assets/People Atlas Performance/photo-${suffix}.png`,
		modifiedTime,
		sourceSizeBytes,
		sourceWidth: landscape ? 320 : 240,
		sourceHeight: landscape ? 240 : 320,
		paintSeed: index,
		revision: `${modifiedTime}:${sourceSizeBytes}`,
	};
}

export function generatePhotoAvatarPerformanceFixture(): PhotoAvatarPerformanceFixture {
	const base = generatePerformanceFixture(PHOTO_AVATAR_FIXTURE_SIZE, PHOTO_AVATAR_FIXTURE_PROFILE);
	validatePerformanceFixture(base);
	const assets = base.people.slice(0, PHOTO_AVATAR_COUNT).map((person, index) => createAsset(person.id, index));
	const photoPathByPersonId = new Map(assets.map((asset) => [asset.personId, asset.path]));
	const people: PersonRecord[] = base.people.map((person) => {
		const photoPath = photoPathByPersonId.get(person.id);
		return photoPath ? { ...person, photoPath } : { ...person };
	});
	const raw: RawIndexSnapshot = {
		people,
		relationships: base.relationships,
		diagnostics: [],
	};
	const snapshot = buildPerformanceSnapshot(raw);
	const baseCounts = validateSnapshotCounts(base, snapshot);
	const fixture: PhotoAvatarPerformanceFixture = {
		contractVersion: PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION,
		baseContractVersion: FIXTURE_CONTRACT_VERSION,
		size: PHOTO_AVATAR_FIXTURE_SIZE,
		profile: PHOTO_AVATAR_FIXTURE_PROFILE,
		assets,
		raw,
		snapshot,
		counts: {
			...baseCounts,
			photos: assets.length,
		},
	};
	validatePhotoAvatarPerformanceFixture(fixture);
	return fixture;
}

export function validatePhotoAvatarPerformanceFixture(fixture: PhotoAvatarPerformanceFixture): void {
	if (fixture.contractVersion !== PHOTO_AVATAR_FIXTURE_CONTRACT_VERSION) {
		throw new Error("Photo-avatar fixture contract version is incompatible.");
	}
	if (fixture.baseContractVersion !== FIXTURE_CONTRACT_VERSION) {
		throw new Error("Photo-avatar base fixture contract version is incompatible.");
	}
	if (fixture.size !== PHOTO_AVATAR_FIXTURE_SIZE || fixture.profile !== PHOTO_AVATAR_FIXTURE_PROFILE) {
		throw new Error("Photo-avatar fixture must retain the deterministic 100-node sparse workload.");
	}
	if (
		fixture.counts.people !== PHOTO_AVATAR_FIXTURE_SIZE ||
		fixture.counts.relationships !== PHOTO_AVATAR_FIXTURE_SIZE * 2 ||
		fixture.counts.nodes !== PHOTO_AVATAR_FIXTURE_SIZE ||
		fixture.counts.edges !== PHOTO_AVATAR_FIXTURE_SIZE * 2 ||
		fixture.counts.photos !== PHOTO_AVATAR_COUNT
	) {
		throw new Error("Photo-avatar fixture counts do not match the declared characterization workload.");
	}
	if (fixture.assets.length !== PHOTO_AVATAR_COUNT) {
		throw new Error(`Photo-avatar fixture must contain exactly ${PHOTO_AVATAR_COUNT} assets.`);
	}

	const assetPaths = new Set<string>();
	const assetPeople = new Set<string>();
	const assetRevisions = new Set<string>();
	for (const asset of fixture.assets) {
		if (!isSupportedPersonPhotoPath(asset.path)) {
			throw new Error(`Photo-avatar fixture asset is not a supported vault image: ${asset.path}`);
		}
		if (assetPaths.has(asset.path) || assetPeople.has(asset.personId) || assetRevisions.has(asset.revision)) {
			throw new Error("Photo-avatar fixture assets must have unique paths, people and revision states.");
		}
		if (
			!Number.isInteger(asset.modifiedTime) ||
			!Number.isInteger(asset.sourceSizeBytes) ||
			!Number.isInteger(asset.sourceWidth) ||
			!Number.isInteger(asset.sourceHeight) ||
			asset.modifiedTime < 0 ||
			asset.sourceSizeBytes <= 0 ||
			asset.sourceWidth <= 0 ||
			asset.sourceHeight <= 0
		) {
			throw new Error("Photo-avatar fixture asset metadata must be deterministic positive integers.");
		}
		assetPaths.add(asset.path);
		assetPeople.add(asset.personId);
		assetRevisions.add(asset.revision);
	}

	const peopleWithPhotos = fixture.raw.people.filter((person) => person.photoPath);
	if (peopleWithPhotos.length !== PHOTO_AVATAR_COUNT) {
		throw new Error("Photo-avatar raw fixture does not map every asset to exactly one person.");
	}
	for (const person of peopleWithPhotos) {
		const asset = fixture.assets.find((candidate) => candidate.personId === person.id);
		if (!asset || person.photoPath !== asset.path) {
			throw new Error(`Photo-avatar person ${person.id} does not retain its deterministic asset path.`);
		}
	}

	const snapshotPhotos = fixture.snapshot.nodes.filter((node) => node.photoPath);
	if (
		snapshotPhotos.length !== PHOTO_AVATAR_COUNT ||
		fixture.snapshot.nodes.some((node) => node.kind !== "person" || node.id.startsWith("ambiguous:")) ||
		fixture.snapshot.diagnostics.length !== 0 ||
		fixture.snapshot.hiddenNodeCount !== 0 ||
		fixture.snapshot.hiddenEdgeCount !== 0
	) {
		throw new Error("Photo-avatar snapshot introduced missing, ambiguous, hidden or diagnostic graph state.");
	}
	for (const node of snapshotPhotos) {
		const asset = fixture.assets.find((candidate) => candidate.personId === node.id);
		if (!asset || node.photoPath !== asset.path) {
			throw new Error(`Photo-avatar snapshot node ${node.id} does not retain its deterministic asset path.`);
		}
	}
}
