import type { ProjectionCenterMode, ProjectionMode } from "../domain/types";
import type { LayoutSnapshot } from "../render/layout-state";

export const VIEW_STATE_SCHEMA_VERSION = 1;
export const MAX_CENTER_HISTORY = 20;

export interface AtlasViewState {
	schemaVersion: number;
	centerMode: ProjectionCenterMode;
	projectionMode: ProjectionMode;
	hops: number;
	maxNodes: number;
	centerHistory: string[];
	layouts: Record<string, LayoutSnapshot>;
}

export const DEFAULT_VIEW_STATE: AtlasViewState = {
	schemaVersion: VIEW_STATE_SCHEMA_VERSION,
	centerMode: "configured",
	projectionMode: "ego",
	hops: 2,
	maxNodes: 500,
	centerHistory: [],
	layouts: {},
};

export function cloneViewState(value: AtlasViewState = DEFAULT_VIEW_STATE): AtlasViewState {
	return structuredClone(value);
}

export function normalizeViewStates(raw: unknown): Record<string, AtlasViewState> {
	if (!isRecord(raw)) return {};
	const result: Record<string, AtlasViewState> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (!isValidViewState(value)) continue;
		result[key] = normalizeViewState(value as AtlasViewState);
	}
	return result;
}

export function validateStoredViewStates(raw: unknown): string | undefined {
	if (raw === undefined) return undefined;
	if (!isRecord(raw)) return "viewStates must be an object.";
	for (const [key, value] of Object.entries(raw)) {
		if (!key.trim()) return "viewStates keys must not be empty.";
		if (!isValidViewState(value)) return `viewStates.${key} is invalid.`;
	}
	return undefined;
}

export function normalizeViewState(value: AtlasViewState): AtlasViewState {
	const history = [...new Set(value.centerHistory.filter((id) => typeof id === "string" && id.trim()))].slice(0, MAX_CENTER_HISTORY);
	const layouts: Record<string, LayoutSnapshot> = {};
	for (const [key, layout] of Object.entries(value.layouts)) {
		if (isValidLayoutSnapshot(layout)) layouts[key] = structuredClone(layout);
	}
	return {
		schemaVersion: VIEW_STATE_SCHEMA_VERSION,
		centerMode: value.centerMode,
		projectionMode: value.projectionMode,
		hops: value.hops,
		maxNodes: value.maxNodes,
		centerHistory: history,
		layouts,
	};
}

export function rememberCenter(state: AtlasViewState, personId: string): AtlasViewState {
	return {
		...state,
		centerHistory: [personId, ...state.centerHistory.filter((id) => id !== personId)].slice(0, MAX_CENTER_HISTORY),
	};
}

export function buildLayoutKey(viewConfigurationKey: string, state: Pick<AtlasViewState, "centerMode" | "projectionMode" | "hops" | "maxNodes">, centerId?: string, centerPath?: string): string {
	return JSON.stringify({
		viewConfigurationKey,
		centerMode: state.centerMode,
		projectionMode: state.projectionMode,
		hops: state.hops,
		maxNodes: state.maxNodes,
		centerId: centerId ?? "",
		centerPath: centerPath ?? "",
	});
}

function isValidViewState(value: unknown): value is AtlasViewState {
	if (!isRecord(value)) return false;
	if (value.schemaVersion !== VIEW_STATE_SCHEMA_VERSION) return false;
	if (value.centerMode !== "configured" && value.centerMode !== "active-note" && value.centerMode !== "selected-node" && value.centerMode !== "none") return false;
	if (value.projectionMode !== "ego" && value.projectionMode !== "free-network" && value.projectionMode !== "contact-health") return false;
	if (!Number.isInteger(value.hops) || (value.hops as number) < 0) return false;
	if (!Number.isInteger(value.maxNodes) || (value.maxNodes as number) <= 0) return false;
	if (!Array.isArray(value.centerHistory) || value.centerHistory.some((id) => typeof id !== "string")) return false;
	if (!isRecord(value.layouts)) return false;
	return Object.values(value.layouts).every(isValidLayoutSnapshot);
}

function isValidLayoutSnapshot(value: unknown): value is LayoutSnapshot {
	if (!isRecord(value) || !isRecord(value.positions) || !isRecord(value.camera)) return false;
	const camera = value.camera as Record<string, unknown>;
	if (!["x", "y", "scale"].every((key) => typeof camera[key] === "number" && Number.isFinite(camera[key] as number))) return false;
	return Object.values(value.positions).every((point) => isRecord(point) && typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y));
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
