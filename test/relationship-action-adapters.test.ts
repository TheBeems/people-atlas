import { describe, expect, it, vi } from "vitest";
import { PeopleAtlasBasesView } from "../src/bases/people-atlas-bases-view";
import type { AtlasEdge } from "../src/domain/types";
import { PeopleAtlasView } from "../src/view/people-atlas-view";

const relationshipEdge: AtlasEdge = {
	id: "relationship-1",
	sourceId: "alice",
	targetId: "bob",
	types: ["friend"],
	filePath: "People/Relationships/Alice - Bob.md",
	inferred: false,
};

interface RelationshipAdapterHarness {
	plugin: {
		canOpenRelationship: ReturnType<typeof vi.fn>;
		openRelationship: ReturnType<typeof vi.fn>;
		openEditRelationship: ReturnType<typeof vi.fn>;
	};
	renderer: {
		restoreRelationshipActionFocus: ReturnType<typeof vi.fn>;
	};
	canOpenRelationship(edge: AtlasEdge): boolean;
	canEditRelationship(edge: AtlasEdge): boolean;
	openRelationship(edge: AtlasEdge): void;
	editRelationship(edge: AtlasEdge, invoker: HTMLButtonElement): void;
}

function createHarness(prototype: object): RelationshipAdapterHarness {
	const harness = Object.create(prototype) as RelationshipAdapterHarness;
	Object.assign(harness, {
		plugin: {
			canOpenRelationship: vi.fn((path: string) => path === relationshipEdge.filePath),
			openRelationship: vi.fn(async () => true),
			openEditRelationship: vi.fn(() => true),
		},
		renderer: {
			restoreRelationshipActionFocus: vi.fn(),
		},
	});
	return harness;
}

describe("relationship action view adapters", () => {
	it("grants standalone and Bases capabilities only to current note-backed edges", () => {
		const inferred: AtlasEdge = { ...relationshipEdge, id: "linked", filePath: undefined, inferred: true };
		const stale: AtlasEdge = { ...relationshipEdge, id: "stale", filePath: "People/Relationships/Stale.md" };

		for (const view of [createHarness(PeopleAtlasView.prototype), createHarness(PeopleAtlasBasesView.prototype)]) {
			expect(view.canOpenRelationship(relationshipEdge)).toBe(true);
			expect(view.canEditRelationship(relationshipEdge)).toBe(true);
			expect(view.canOpenRelationship(inferred)).toBe(false);
			expect(view.canEditRelationship(inferred)).toBe(false);
			expect(view.canOpenRelationship(stale)).toBe(false);
			expect(view.canEditRelationship(stale)).toBe(false);
			expect(view.plugin.canOpenRelationship).toHaveBeenCalledWith(relationshipEdge.filePath);
		}
	});

	it("routes exact paths identically and restores the originating edit button after modal close", () => {
		const invoker = {} as HTMLButtonElement;

		for (const view of [createHarness(PeopleAtlasView.prototype), createHarness(PeopleAtlasBasesView.prototype)]) {
			view.openRelationship(relationshipEdge);
			expect(view.plugin.openRelationship).toHaveBeenCalledWith(relationshipEdge.filePath);

			view.editRelationship(relationshipEdge, invoker);
			expect(view.plugin.openEditRelationship).toHaveBeenCalledWith(relationshipEdge.filePath, expect.any(Function));
			const afterClose = view.plugin.openEditRelationship.mock.calls[0]?.[1] as (() => void) | undefined;
			expect(afterClose).toBeTypeOf("function");
			afterClose?.();
			expect(view.renderer.restoreRelationshipActionFocus).toHaveBeenCalledWith(invoker);
		}
	});

	it("never routes inferred linked-person edges", () => {
		const inferred: AtlasEdge = { ...relationshipEdge, filePath: undefined, inferred: true };
		const invoker = {} as HTMLButtonElement;

		for (const view of [createHarness(PeopleAtlasView.prototype), createHarness(PeopleAtlasBasesView.prototype)]) {
			view.openRelationship(inferred);
			view.editRelationship(inferred, invoker);
			expect(view.plugin.openRelationship).not.toHaveBeenCalled();
			expect(view.plugin.openEditRelationship).not.toHaveBeenCalled();
		}
	});
});
