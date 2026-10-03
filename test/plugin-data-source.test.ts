import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { readOriginalPluginDataText } from "../src/settings/plugin-data-source";

describe("bounded original plugin-data reader", () => {
	it.each([
		".obsidian",
		".custom-settings",
		"Configuration with spaces",
	])("reads only its own data.json under host configDir %s and preserves exact text", async (configDir) => {
		const original = ' {\r\n\t"schemaVersion":7,"unknown":"é"\r\n}\r\n';
		const read = vi.fn(async (_path: string) => original);
		const write = vi.fn();
		const list = vi.fn();
		const remove = vi.fn();
		const app = { vault: { configDir, adapter: { read, write, list, remove } } } as unknown as App;
		expect(await readOriginalPluginDataText(app)).toBe(original);
		expect(read).toHaveBeenCalledExactlyOnceWith(`${configDir}/plugins/people-atlas/data.json`);
		expect(write).not.toHaveBeenCalled();
		expect(list).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});
	it("surfaces a read failure without fallback serialization or adapter mutations", async () => {
		const read = vi.fn(async () => {
			throw new Error("Unavailable original plugin data");
		});
		const write = vi.fn();
		const app = { vault: { configDir: ".obsidian", adapter: { read, write } } } as unknown as App;
		await expect(readOriginalPluginDataText(app)).rejects.toThrow("Unavailable original plugin data");
		expect(read).toHaveBeenCalledExactlyOnceWith(".obsidian/plugins/people-atlas/data.json");
		expect(write).not.toHaveBeenCalled();
	});
});
