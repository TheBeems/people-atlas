import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import type { AtlasSnapshot } from "../../src/domain/types";
import { projectGraph } from "../../src/graph/project-graph";
import { AtlasRenderer, type AtlasRendererCallbacks } from "../../src/render/atlas-renderer";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import "../../styles.css";
import {
	applyPerformanceIncrementalScenario,
	buildPerformanceSnapshot,
	createIncrementalFixtureScenario,
	generatePerformanceFixture,
	validatePerformanceFixture,
	validateSnapshotCounts,
} from "./fixture";
import {
	BROWSER_SAMPLE_COUNT,
	BROWSER_WARMUP_COUNT,
	FIXTURE_CONTRACT_VERSION,
	INTERACTION_FRAME_COUNT,
	PERFORMANCE_PROFILES,
	PERFORMANCE_RUNNER_VERSION,
	PERFORMANCE_SIZES,
	timingSamples,
	type FixtureCounts,
	type HeapObservation,
	type PerformanceProfile,
	type PerformanceSize,
	type TimingSamples,
} from "./performance-model";

type BrowserStage =
	| "snapshot-and-semantic-dom"
	| "canvas-first-paint"
	| "list-mode-transition"
	| "graph-mode-transition"
	| "incremental-replacement"
	| "incremental-canvas-paint"
	| "lifecycle-cleanup";

interface BrowserIteration {
	durations: Record<BrowserStage, number>;
	cleanupValid: boolean;
}

interface BrowserCaseResult {
	size: PerformanceSize;
	profile: PerformanceProfile;
	counts: FixtureCounts;
	warmups: number;
	recordedSamples: number;
	timings: Record<BrowserStage, TimingSamples>;
	interaction: {
		recordedFrames: number;
		timing: TimingSamples;
		redrawTriggers: number;
		requestedAnimationFrames: number;
		executedAnimationFrames: number;
		coalescedTriggers: number;
	};
	memory: HeapObservation[];
	cleanupVerified: boolean;
}

interface BrowserCharacterizationResult {
	runnerVersion: typeof PERFORMANCE_RUNNER_VERSION;
	fixtureContractVersion: typeof FIXTURE_CONTRACT_VERSION;
	browser: Awaited<ReturnType<typeof commands.getPerformanceBrowserVersion>>;
	viewport: {
		width: number;
		height: number;
		devicePixelRatio: number;
	};
	cases: BrowserCaseResult[];
	missingData: string[];
}

const callbacks: AtlasRendererCallbacks = {
	onOpenNode: () => undefined,
	onCenterNode: () => undefined,
	onSelectNode: () => undefined,
	onLayoutChanged: () => undefined,
};

class AnimationFrameProbe {
	private readonly originalRequest: typeof window.requestAnimationFrame;
	private readonly listeners = new Set<() => void>();
	readonly durations: number[] = [];
	requested = 0;
	executed = 0;

	constructor(private readonly win: Window & typeof globalThis) {
		this.originalRequest = win.requestAnimationFrame;
		win.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
			this.requested += 1;
			return this.originalRequest.call(win, (timestamp) => {
				const startedAt = win.performance.now();
				try {
					callback(timestamp);
				} finally {
					this.durations.push(win.performance.now() - startedAt);
					this.executed += 1;
					for (const listener of this.listeners) listener();
				}
			});
		}) as typeof window.requestAnimationFrame;
	}

	async waitForNext(executedBefore: number): Promise<number> {
		if (this.executed <= executedBefore) {
			await new Promise<void>((resolve, reject) => {
				const timeout = this.win.setTimeout(() => {
					this.listeners.delete(listener);
					reject(new Error("Timed out waiting for an AtlasRenderer animation frame."));
				}, 10_000);
				const listener = (): void => {
					if (this.executed <= executedBefore) return;
					this.win.clearTimeout(timeout);
					this.listeners.delete(listener);
					resolve();
				};
				this.listeners.add(listener);
			});
		}
		const duration = this.durations[this.durations.length - 1];
		if (duration === undefined) throw new Error("Animation frame completed without a duration.");
		return duration;
	}

	async settleWindow(): Promise<void> {
		await new Promise<void>((resolve) => {
			this.originalRequest.call(this.win, () => {
				this.originalRequest.call(this.win, () => resolve());
			});
		});
	}

	restore(): void {
		this.win.requestAnimationFrame = this.originalRequest;
	}
}

function createContainer(): HTMLDivElement {
	const container = document.createElement("div");
	container.className = "people-atlas-performance-container";
	container.style.width = "960px";
	container.style.height = "640px";
	document.body.append(container);
	return container;
}

function projectComplete(snapshot: AtlasSnapshot, size: PerformanceSize): AtlasSnapshot {
	return projectGraph(snapshot, {
		centerMode: "none",
		projectionMode: "free-network",
		maxNodes: size,
	});
}

function modeButton(container: HTMLElement, label: "Graph" | "List"): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll<HTMLButtonElement>(".people-atlas-view-modes button"))
		.find((candidate) => candidate.textContent === label);
	if (!button) throw new Error(`Unable to find ${label} mode button.`);
	return button;
}

function graphAction(container: HTMLElement, label: "Zoom out" | "Zoom in"): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll<HTMLButtonElement>(".people-atlas-graph-actions button"))
		.find((candidate) => candidate.textContent === label);
	if (!button) throw new Error(`Unable to find ${label} graph action.`);
	return button;
}

async function settleConstruction(probe: AnimationFrameProbe): Promise<void> {
	const before = probe.executed;
	await probe.waitForNext(before);
	await probe.settleWindow();
}

async function runRendererIteration(
	initial: AtlasSnapshot,
	incremental: AtlasSnapshot,
): Promise<BrowserIteration> {
	const container = createContainer();
	const win = window as Window & typeof globalThis;
	const probe = new AnimationFrameProbe(win);
	const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks);
	try {
		await settleConstruction(probe);
		const durations = {} as Record<BrowserStage, number>;

		let executedBefore = probe.executed;
		let startedAt = win.performance.now();
		renderer.setGraph(initial);
		durations["snapshot-and-semantic-dom"] = win.performance.now() - startedAt;
		durations["canvas-first-paint"] = await probe.waitForNext(executedBefore);

		startedAt = win.performance.now();
		modeButton(container, "List").click();
		durations["list-mode-transition"] = win.performance.now() - startedAt;

		executedBefore = probe.executed;
		startedAt = win.performance.now();
		modeButton(container, "Graph").click();
		durations["graph-mode-transition"] = win.performance.now() - startedAt;
		await probe.waitForNext(executedBefore);

		executedBefore = probe.executed;
		startedAt = win.performance.now();
		renderer.setGraph(incremental);
		durations["incremental-replacement"] = win.performance.now() - startedAt;
		durations["incremental-canvas-paint"] = await probe.waitForNext(executedBefore);

		const executedBeforeDestroy = probe.executed;
		startedAt = win.performance.now();
		renderer.destroy();
		durations["lifecycle-cleanup"] = win.performance.now() - startedAt;
		await probe.settleWindow();
		const cleanupValid = container.childElementCount === 0 && probe.executed === executedBeforeDestroy;
		return { durations, cleanupValid };
	} finally {
		renderer.destroy();
		probe.restore();
		container.remove();
	}
}

async function collectInteractionAndMemory(
	initial: AtlasSnapshot,
	incremental: AtlasSnapshot,
): Promise<{
	interaction: BrowserCaseResult["interaction"];
	memory: HeapObservation[];
	cleanupValid: boolean;
}> {
	const container = createContainer();
	const win = window as Window & typeof globalThis;
	const probe = new AnimationFrameProbe(win);
	const memory: HeapObservation[] = [await commands.capturePerformanceHeap("before-renderer")];
	const renderer = new AtlasRenderer(container, () => DEFAULT_SETTINGS, callbacks);
	try {
		await settleConstruction(probe);
		let executedBefore = probe.executed;
		renderer.setGraph(initial);
		await probe.waitForNext(executedBefore);
		memory.push(await commands.capturePerformanceHeap("after-initial-render"));

		const interactionSamples: number[] = [];
		const requestedBefore = probe.requested;
		const executedStart = probe.executed;
		const redrawTriggers = INTERACTION_FRAME_COUNT * 2;
		for (let frame = 0; frame < INTERACTION_FRAME_COUNT; frame += 1) {
			executedBefore = probe.executed;
			graphAction(container, "Zoom in").click();
			graphAction(container, "Zoom out").click();
			interactionSamples.push(await probe.waitForNext(executedBefore));
		}
		const requestedAnimationFrames = probe.requested - requestedBefore;
		const executedAnimationFrames = probe.executed - executedStart;

		executedBefore = probe.executed;
		renderer.setGraph(incremental);
		await probe.waitForNext(executedBefore);
		memory.push(await commands.capturePerformanceHeap("after-incremental-replacement"));

		const executedBeforeDestroy = probe.executed;
		renderer.destroy();
		await probe.settleWindow();
		memory.push(await commands.capturePerformanceHeap("after-destroy"));
		const cleanupValid = container.childElementCount === 0 && probe.executed === executedBeforeDestroy;
		return {
			interaction: {
				recordedFrames: INTERACTION_FRAME_COUNT,
				timing: timingSamples(interactionSamples),
				redrawTriggers,
				requestedAnimationFrames,
				executedAnimationFrames,
				coalescedTriggers: redrawTriggers - requestedAnimationFrames,
			},
			memory,
			cleanupValid,
		};
	} finally {
		renderer.destroy();
		probe.restore();
		container.remove();
	}
}

async function characterizeCase(
	size: PerformanceSize,
	profile: PerformanceProfile,
): Promise<BrowserCaseResult> {
	const fixture = generatePerformanceFixture(size, profile);
	validatePerformanceFixture(fixture);
	const initial = projectComplete(buildPerformanceSnapshot(fixture.raw), size);
	const counts = validateSnapshotCounts(fixture, initial);
	const scenario = createIncrementalFixtureScenario(fixture);
	const incremental = projectComplete(applyPerformanceIncrementalScenario(initial, scenario), size);
	validateSnapshotCounts(fixture, incremental);

	for (let warmup = 0; warmup < BROWSER_WARMUP_COUNT; warmup += 1) {
		const result = await runRendererIteration(initial, incremental);
		if (!result.cleanupValid) throw new Error("Renderer warm-up cleanup failed.");
	}

	const samples: Record<BrowserStage, number[]> = {
		"snapshot-and-semantic-dom": [],
		"canvas-first-paint": [],
		"list-mode-transition": [],
		"graph-mode-transition": [],
		"incremental-replacement": [],
		"incremental-canvas-paint": [],
		"lifecycle-cleanup": [],
	};
	let cleanupVerified = true;
	for (let sample = 0; sample < BROWSER_SAMPLE_COUNT; sample += 1) {
		const result = await runRendererIteration(initial, incremental);
		cleanupVerified = cleanupVerified && result.cleanupValid;
		for (const stage of Object.keys(samples) as BrowserStage[]) {
			samples[stage].push(result.durations[stage]);
		}
	}
	if (!cleanupVerified) throw new Error("Renderer lifecycle cleanup validation failed.");
	const retained = await collectInteractionAndMemory(initial, incremental);
	if (!retained.cleanupValid) throw new Error("Retained renderer lifecycle cleanup validation failed.");
	return {
		size,
		profile,
		counts,
		warmups: BROWSER_WARMUP_COUNT,
		recordedSamples: BROWSER_SAMPLE_COUNT,
		timings: {
			"snapshot-and-semantic-dom": timingSamples(samples["snapshot-and-semantic-dom"]),
			"canvas-first-paint": timingSamples(samples["canvas-first-paint"]),
			"list-mode-transition": timingSamples(samples["list-mode-transition"]),
			"graph-mode-transition": timingSamples(samples["graph-mode-transition"]),
			"incremental-replacement": timingSamples(samples["incremental-replacement"]),
			"incremental-canvas-paint": timingSamples(samples["incremental-canvas-paint"]),
			"lifecycle-cleanup": timingSamples(samples["lifecycle-cleanup"]),
		},
		interaction: retained.interaction,
		memory: retained.memory,
		cleanupVerified: true,
	};
}

beforeAll(() => {
	const style = document.createElement("style");
	style.id = "people-atlas-performance-style";
	style.textContent = [
		".people-atlas-performance-container .people-atlas-graph-surface { width: 960px; height: 640px; }",
		".people-atlas-performance-container .people-atlas-canvas { display: block; }",
	].join("\n");
	document.head.append(style);
});

afterAll(() => {
	document.getElementById("people-atlas-performance-style")?.remove();
});

describe("P6a Chromium performance characterization", () => {
	it("records every ratified renderer case", async () => {
		const cases: BrowserCaseResult[] = [];
		for (const size of PERFORMANCE_SIZES) {
			for (const profile of PERFORMANCE_PROFILES) {
				cases.push(await characterizeCase(size, profile));
			}
		}
		const missingData = cases.flatMap((result) => result.memory.flatMap((observation) => {
			if (observation.kind === "missing") {
				return [`${result.profile}/${result.size}/${observation.stage}: ${observation.missingReason ?? "unknown reason"}`];
			}
			if (!observation.explicitGcAvailable && observation.missingReason) {
				return [`${result.profile}/${result.size}/${observation.stage}: ${observation.missingReason}`];
			}
			return [];
		}));
		const result: BrowserCharacterizationResult = {
			runnerVersion: PERFORMANCE_RUNNER_VERSION,
			fixtureContractVersion: FIXTURE_CONTRACT_VERSION,
			browser: await commands.getPerformanceBrowserVersion(),
			viewport: {
				width: window.innerWidth,
				height: window.innerHeight,
				devicePixelRatio: window.devicePixelRatio,
			},
			cases,
			missingData,
		};
		await commands.writePerformanceBrowserResult(result);
		expect(cases).toHaveLength(PERFORMANCE_SIZES.length * PERFORMANCE_PROFILES.length);
	}, 1_200_000);
});
