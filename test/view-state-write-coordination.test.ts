import { afterEach, describe, expect, it, vi } from "vitest";
import PeopleAtlasPlugin from "../src/main";
import { DEFAULT_VIEW_STATE, type AtlasViewState } from "../src/settings/view-state";
import { notices } from "./obsidian-stub";

interface Deferred {
	resolve(): void;
	reject(error: Error): void;
}

function createPlugin(): PeopleAtlasPlugin {
	return new (PeopleAtlasPlugin as unknown as new () => PeopleAtlasPlugin)();
}

function state(centerMode: AtlasViewState["centerMode"]): AtlasViewState {
	return { ...structuredClone(DEFAULT_VIEW_STATE), centerMode };
}

afterEach(() => {
	vi.useRealTimers();
	notices.length = 0;
});

describe("view-state write coordination", () => {
	it("does not let an older failed save roll back newer view state", async () => {
		vi.useFakeTimers();
		const plugin = createPlugin();
		const saves: Deferred[] = [];
		plugin.saveData = vi.fn(
			async () =>
				new Promise<void>((resolve, reject) =>
					saves.push({
						resolve: () => resolve(),
						reject: (error) => reject(error),
					}),
				),
		);

		const first = plugin.saveViewState("standalone", state("none"));
		const second = plugin.saveViewState("bases:team", state("active-note"));
		await vi.runAllTimersAsync();
		expect(saves).toHaveLength(1);

		saves[0]?.reject(new Error("disk full"));
		await first;
		expect(saves).toHaveLength(2);
		saves[1]?.resolve();
		await second;

		expect(plugin.getViewState("standalone").centerMode).toBe("none");
		expect(plugin.getViewState("bases:team").centerMode).toBe("active-note");
		expect(notices.at(-1)).toContain("People Atlas view state could not be saved: disk full");
	});

	it("coalesces rapid updates instead of persisting every event", async () => {
		vi.useFakeTimers();
		const plugin = createPlugin();
		plugin.saveData = vi.fn(async () => undefined);

		const writes = [
			plugin.saveViewState("standalone", state("configured")),
			plugin.saveViewState("standalone", state("active-note")),
			plugin.saveViewState("standalone", state("none")),
		];
		await vi.runAllTimersAsync();
		await Promise.all(writes);

		expect(plugin.saveData).toHaveBeenCalledTimes(1);
		expect(plugin.getViewState("standalone").centerMode).toBe("none");
	});

	it("flushes the latest coalesced state without waiting for the timer", async () => {
		vi.useFakeTimers();
		const plugin = createPlugin();
		plugin.saveData = vi.fn(async () => undefined);
		const pending = plugin.saveViewState("standalone", state("none"));

		expect(plugin.saveData).not.toHaveBeenCalled();
		await plugin.flushViewState("standalone");
		await pending;

		expect(plugin.saveData).toHaveBeenCalledTimes(1);
		expect(plugin.getViewState("standalone").centerMode).toBe("none");
	});

	it("preserves distinct view keys across concurrent schedules", async () => {
		vi.useFakeTimers();
		const plugin = createPlugin();
		const persisted: Array<Record<string, AtlasViewState>> = [];
		plugin.saveData = vi.fn(async (settings: unknown) => {
			const viewStates = (settings as { viewStates: Record<string, AtlasViewState> }).viewStates;
			persisted.push(structuredClone(viewStates));
		});

		const writes = [
			plugin.saveViewState("standalone", state("none")),
			plugin.saveViewState("bases:team", state("active-note")),
		];
		await vi.runAllTimersAsync();
		await Promise.all(writes);

		expect(persisted).toHaveLength(2);
		expect(persisted.at(-1)?.standalone?.centerMode).toBe("none");
		expect(persisted.at(-1)?.["bases:team"]?.centerMode).toBe("active-note");
	});

	it("shares ordering with ordinary plugin-settings writes", async () => {
		vi.useFakeTimers();
		const plugin = createPlugin();
		Object.defineProperty(plugin, "app", {
			value: { workspace: { getLeavesOfType: () => [] } },
		});
		const saves: Array<Deferred & { snapshot: unknown }> = [];
		plugin.saveData = vi.fn(
			async (snapshot: unknown) =>
				new Promise<void>((resolve, reject) =>
					saves.push({
						snapshot: structuredClone(snapshot),
						resolve: () => resolve(),
						reject: (error) => reject(error),
					}),
				),
		);

		const settingWrite = plugin.updateSetting("showLabels", false);
		const viewWrite = plugin.saveViewState("standalone", state("none"));
		await vi.runAllTimersAsync();
		expect(saves).toHaveLength(1);

		saves[0]?.resolve();
		await settingWrite;
		expect(saves).toHaveLength(2);
		saves[1]?.resolve();
		await viewWrite;

		const last = saves.at(-1)?.snapshot as {
			showLabels: boolean;
			viewStates: Record<string, AtlasViewState>;
		};
		expect(last.showLabels).toBe(false);
		expect(last.viewStates.standalone?.centerMode).toBe("none");
	});
});
