import { TFile, type App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { PersonRecord } from "../src/domain/types";
import { parseRecoverySource } from "../src/index/recovery-source";
import { PersonRecoveryService } from "../src/mutations/person-recovery";
import { DEFAULT_SETTINGS } from "../src/settings/defaults";
import { required } from "./recovery-test-helpers";

const generatedId = "person-01234567-89ab-4cde-8123-456789abcdef";
function harness(
	initial: Array<{ path: string; frontmatter: Record<string, unknown>; body?: string }>,
	indexIsStale = false,
) {
	const settings = structuredClone(DEFAULT_SETTINGS);
	const files = new Map<string, { file: TFile; frontmatter: Record<string, unknown>; body: string }>();
	const source = (entry: { frontmatter: Record<string, unknown>; body: string }) =>
		`---\n${Object.entries(entry.frontmatter)
			.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
			.join("\n")}\n---\n${entry.body}`;
	for (const note of initial) {
		const file = new TFile();
		file.path = note.path;
		const entry = { file, frontmatter: structuredClone(note.frontmatter), body: note.body ?? "Original **body**.\n" };
		file.stat.size = source(entry).length;
		files.set(note.path, entry);
	}
	const getPeople = (): PersonRecord[] =>
		[...files.values()].flatMap((entry) => {
			const parsed = parseRecoverySource(source(entry), settings);
			if (parsed.classification === "unclassified") return [];
			return [
				{
					filePath: entry.file.path,
					id: String(entry.frontmatter[settings.personIdProperty] ?? `path:${entry.file.path}`),
					name: "Same display name",
					aliases: [],
					organisations: [],
					emails: [],
					phones: [],
					contacts: [],
				},
			];
		});
	const snapshot = getPeople();
	const reservations = new Map<string, string>();
	let writable = true;
	let beforeCallback: (() => void) | undefined;
	let afterCallback: (() => void) | undefined;
	let failure: Error | undefined;
	const process = vi.fn(async (file: TFile, callback: (frontmatter: Record<string, unknown>) => void) => {
		beforeCallback?.();
		if (failure) throw failure;
		const entry = files.get(file.path);
		if (!entry) throw new Error("Missing");
		const draft = structuredClone(entry.frontmatter);
		callback(draft);
		entry.frontmatter = draft;
		entry.file.stat.mtime += 1;
		entry.file.stat.size = source(entry).length;
		afterCallback?.();
	});
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path)?.file,
			getMarkdownFiles: () => [...files.values()].map((entry) => entry.file),
			getAllLoadedFiles: () => [...files.values()].map((entry) => entry.file),
			read: vi.fn(async (file: TFile) => {
				const entry = files.get(file.path);
				if (!entry) throw new Error("Missing");
				return source(entry);
			}),
		},
		fileManager: { processFrontMatter: process },
	} as unknown as App;
	const service = new PersonRecoveryService(
		app,
		() => settings,
		() => writable,
		() => (indexIsStale ? snapshot : getPeople()),
		async (operation) => operation(),
		(id, path) =>
			!(indexIsStale ? snapshot : getPeople()).some((person) => person.id === id && person.filePath !== path) &&
			(!reservations.has(id) || reservations.get(id) === path),
		(id, path) => reservations.set(id, path),
		() => generatedId,
	);
	return {
		service,
		settings,
		files,
		process,
		app,
		reservations,
		setWritable: (value: boolean) => {
			writable = value;
		},
		setBeforeCallback: (value: () => void) => {
			beforeCallback = value;
		},
		setAfterCallback: (value: () => void) => {
			afterCallback = value;
		},
		setFailure: (value?: Error) => {
			failure = value;
		},
	};
}

describe("reviewed person recovery", () => {
	it("previews missing IDs at exact classified paths without writes, then preserves unrelated fields/body", async () => {
		const h = harness([{ path: "Existing/Loose.md", frontmatter: { type: "person", name: "Same", custom: ["keep"] } }]);
		const preview = await h.service.preview("Existing/Loose.md", "missing-id");
		expect(preview.eligible).toBe(true);
		expect(preview.changes).toEqual([{ property: "person_id", before: undefined, after: generatedId }]);
		expect(h.process).not.toHaveBeenCalled();
		required(h.files.get(preview.filePath)).frontmatter.extra = "preserve after preview";
		required(h.files.get(preview.filePath)).body = "Changed unrelated body";
		expect(await h.service.apply(preview)).toEqual({ filePath: preview.filePath, status: "saved" });
		expect(h.files.get(preview.filePath)?.frontmatter).toMatchObject({
			type: "person",
			person_id: generatedId,
			custom: ["keep"],
			extra: "preserve after preview",
		});
		expect(h.files.get(preview.filePath)?.body).toBe("Changed unrelated body");
	});
	it("adopts explicitly selected loose untyped notes without moving them", async () => {
		const h = harness([{ path: "Notes/Unclassified.md", frontmatter: { name: "Alice", other: "keep" } }]);
		const preview = await h.service.preview("Notes/Unclassified.md", "adopt");
		expect(preview.eligible).toBe(true);
		expect(preview.classification).toBe("unclassified");
		expect(preview.changes.map((entry) => entry.property)).toEqual(["person_id", "type"]);
		await h.service.apply(preview);
		expect([...h.files.keys()]).toEqual(["Notes/Unclassified.md"]);
		expect(h.files.get(preview.filePath)?.frontmatter).toEqual({
			name: "Alice",
			other: "keep",
			person_id: generatedId,
			type: "person",
		});
	});
	it("preserves a valid unique authored non-UUID ID and supports tag classification/custom mappings", async () => {
		const h = harness([
			{ path: "Notes/A.md", frontmatter: { identity: "authored-id", title: "Alice", tags: ["friend-person"] } },
		]);
		h.settings.personIdProperty = "identity";
		h.settings.nameProperty = "title";
		h.settings.personTag = "friend-person";
		const preview = await h.service.preview("Notes/A.md", "adopt");
		expect(preview.eligible).toBe(true);
		expect(preview.classification).toBe("tag");
		expect(preview.personId).toBe("authored-id");
		expect(preview.changes).toEqual([]);
		await h.service.apply(preview);
		expect(h.process).not.toHaveBeenCalled();
		expect(h.files.get(preview.filePath)?.frontmatter.identity).toBe("authored-id");
	});
	it("repairs exactly one duplicate note and never rewrites any references", async () => {
		const h = harness([
			{ path: "A.md", frontmatter: { type: "person", person_id: "duplicate" } },
			{ path: "B.md", frontmatter: { type: "person", person_id: "duplicate", contacts: ["duplicate"] } },
			{ path: "R.md", frontmatter: { type: "relationship", from: "duplicate", to: "[[B]]" } },
		]);
		const other = structuredClone(h.files.get("B.md")?.frontmatter);
		const relationship = structuredClone(h.files.get("R.md")?.frontmatter);
		const preview = await h.service.preview("A.md", "duplicate-id");
		expect(preview.eligible).toBe(true);
		await h.service.apply(preview);
		expect(h.process).toHaveBeenCalledTimes(1);
		expect(h.files.get("A.md")?.frontmatter.person_id).toBe(generatedId);
		expect(h.files.get("B.md")?.frontmatter).toEqual(other);
		expect(h.files.get("R.md")?.frontmatter).toEqual(relationship);
	});
	it("refuses an ID repair that would invalidate an existing suffixed dossier", async () => {
		const h = harness([
			{ path: "People/Profiles/Alice · ZZ/Alice.md", frontmatter: { type: "person", person_id: "duplicate" } },
			{ path: "B.md", frontmatter: { type: "person", person_id: "duplicate" } },
		]);
		const preview = await h.service.preview("People/Profiles/Alice · ZZ/Alice.md", "duplicate-id");
		expect(preview.eligible).toBe(false);
		expect(preview.error).toContain("dossier");
		expect(h.process).not.toHaveBeenCalled();
	});
	it.each(["person_id", "type", "name"])("rejects stale owned %s changes before any host write", async (key) => {
		const h = harness([{ path: "A.md", frontmatter: { type: "person", name: "Alice" } }]);
		const preview = await h.service.preview("A.md", "missing-id");
		required(h.files.get("A.md")).frontmatter[key] = "changed";
		expect((await h.service.apply(preview)).status).toBe("failed");
		expect(h.process).not.toHaveBeenCalled();
		expect(h.files.get("A.md")?.frontmatter[key]).toBe("changed");
	});
	it("rejects mapping drift, replaced files and read-only state without writes", async () => {
		for (const drift of ["mapping", "file", "write"] as const) {
			const h = harness([{ path: "A.md", frontmatter: { type: "person" } }]);
			const preview = await h.service.preview("A.md", "missing-id");
			if (drift === "mapping") h.settings.personIdProperty = "identity";
			if (drift === "file") {
				required(h.files.get("A.md")).file = new TFile();
				required(h.files.get("A.md")).file.path = "A.md";
			}
			if (drift === "write") h.setWritable(false);
			expect((await h.service.apply(preview)).status, drift).toBe("failed");
			expect(h.process).not.toHaveBeenCalled();
		}
	});
	it("rejects atomic callback drift with zero committed properties", async () => {
		const h = harness([{ path: "A.md", frontmatter: { type: "person" } }]);
		const preview = await h.service.preview("A.md", "missing-id");
		h.setBeforeCallback(() => {
			required(h.files.get("A.md")).frontmatter.name = "external edit";
		});
		expect((await h.service.apply(preview)).status).toBe("failed");
		expect(h.files.get("A.md")?.frontmatter.person_id).toBeUndefined();
		expect(h.files.get("A.md")?.frontmatter.name).toBe("external edit");
	});
	it("detects real-source ID collisions despite a stale index", async () => {
		const h = harness(
			[
				{ path: "A.md", frontmatter: { type: "person" } },
				{ path: "B.md", frontmatter: { type: "person", person_id: "other" } },
			],
			true,
		);
		const preview = await h.service.preview("A.md", "missing-id");
		required(h.files.get("B.md")).frontmatter.person_id = generatedId;
		expect((await h.service.apply(preview)).message).toContain("another note");
		expect(h.process).not.toHaveBeenCalled();
	});
	it("rejects preview tampering both before apply and while preflight is awaiting", async () => {
		const h = harness([{ path: "A.md", frontmatter: { type: "person" } }]);
		const preview = await h.service.preview("A.md", "missing-id");
		required(preview.changes[0]).after = "injected";
		expect((await h.service.apply(preview)).status).toBe("skipped");
		expect(h.process).not.toHaveBeenCalled();
		const fresh = await h.service.preview("A.md", "missing-id");
		h.setBeforeCallback(() => {
			required(fresh.changes[0]).after = "injected";
		});
		expect((await h.service.apply(fresh)).status).toBe("failed");
		expect(h.files.get("A.md")?.frontmatter.person_id).toBeUndefined();
	});
	it("identifies the exact unrelated Markdown source blocking fail-closed ID validation", async () => {
		const h = harness([
			{ path: "A.md", frontmatter: { type: "person" } },
			{ path: "Unrelated/Broken.md", frontmatter: {} },
		]);
		const preview = await h.service.preview("A.md", "missing-id");
		const read = vi.spyOn(h.app.vault, "read");
		const originalRead = read.getMockImplementation();
		read.mockImplementation(async (file) =>
			file.path === "Unrelated/Broken.md" ? "---\ninvalid unclosed" : required(originalRead)(file),
		);
		const result = await h.service.apply(preview);
		expect(result.status).toBe("failed");
		expect(result.message).toContain("Unrelated/Broken.md");
		expect(result.blockedSourcePath).toBe("Unrelated/Broken.md");
		expect(h.process).not.toHaveBeenCalled();
	});
	it("reports and reserves only the approved identity when a preview changes after the atomic write", async () => {
		const h = harness([{ path: "A.md", frontmatter: { type: "person" } }]);
		const preview = await h.service.preview("A.md", "missing-id");
		h.setAfterCallback(() => {
			preview.filePath = "Injected.md";
			preview.personId = "injected-id";
			required(preview.changes[0]).after = "injected-id";
		});
		expect(await h.service.apply(preview)).toEqual({ filePath: "A.md", status: "saved" });
		expect(h.files.get("A.md")?.frontmatter.person_id).toBe(generatedId);
		expect([...h.reservations]).toEqual([[generatedId, "A.md"]]);
		expect((await h.service.apply(preview)).filePath).toBe("A.md");
		expect(h.process).toHaveBeenCalledOnce();
	});
	it("uses a detached approved mapping when a transient live change would hide a source collision", async () => {
		const h = harness(
			[
				{ path: "A.md", frontmatter: { type: "person" } },
				{ path: "B.md", frontmatter: { type: "person", person_id: "stale-id" } },
				{ path: "C.md", frontmatter: {} },
			],
			true,
		);
		const preview = await h.service.preview("A.md", "missing-id");
		required(h.files.get("B.md")).frontmatter.person_id = generatedId;
		const read = vi.spyOn(h.app.vault, "read");
		const originalRead = required(read.getMockImplementation());
		read.mockImplementation(async (file) => {
			if (file.path === "B.md") h.settings.typeProperty = "other_kind";
			if (file.path === "C.md") h.settings.typeProperty = "type";
			return originalRead(file);
		});
		const result = await h.service.apply(preview);
		expect(result.status).toBe("failed");
		expect(result.message).toContain("already present in another note");
		expect(result.blockedSourcePath).toBe("B.md");
		expect(h.files.get("A.md")?.frontmatter.person_id).toBeUndefined();
		expect(h.process).not.toHaveBeenCalled();
	});
	it("reports save failures, supports retry and never rewrites a completed row", async () => {
		const h = harness([{ path: "A.md", frontmatter: { type: "person" } }]);
		const preview = await h.service.preview("A.md", "missing-id");
		h.setFailure(new Error("Disk full"));
		expect(await h.service.apply(preview)).toEqual({ filePath: "A.md", status: "failed", message: "Disk full" });
		expect(h.files.get("A.md")?.frontmatter.person_id).toBeUndefined();
		h.setFailure();
		expect((await h.service.apply(preview)).status).toBe("saved");
		const calls = h.process.mock.calls.length;
		expect((await h.service.apply(preview)).status).toBe("skipped");
		expect(h.process).toHaveBeenCalledTimes(calls);
		expect(h.files.get("A.md")?.frontmatter.person_id).toBe(generatedId);
	});
	it("rejects another classification and numeric or ambiguous authored IDs", async () => {
		for (const frontmatter of [{ type: "relationship" }, { person_id: 7 }, { person_id: "taken" }]) {
			const h = harness([
				{ path: "A.md", frontmatter },
				{ path: "B.md", frontmatter: { type: "person", person_id: "taken" } },
			]);
			const preview = await h.service.preview("A.md", "adopt");
			expect(preview.eligible).toBe(false);
			expect(h.process).not.toHaveBeenCalled();
		}
	});
});
