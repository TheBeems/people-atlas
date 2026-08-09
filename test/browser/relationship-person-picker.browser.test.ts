import { afterEach, describe, expect, it, vi } from "vitest";
import { appendRelationshipPersonPicker } from "../../src/editor/relationship-person-picker";
import type { PersonRecord } from "../../src/domain/types";

const people: PersonRecord[] = [
	{
		id: "person-b",
		filePath: "People/Bob.md",
		name: "Bob",
		aliases: [],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	},
	{
		id: "person-a",
		filePath: "People/Alice.md",
		name: "Alice",
		aliases: ["Al"],
		organisations: [],
		emails: [],
		phones: [],
		contacts: [],
	},
];

afterEach(() => {
	document.body.replaceChildren();
});

describe("relationship person picker", () => {
	it("owns combobox semantics, keyboard selection and close lifecycle", () => {
		const container = document.createElement("div");
		const onInput = vi.fn();
		const activate = vi.fn();
		document.body.append(container);

		const picker = appendRelationshipPersonPicker(container, {
			label: "First person",
			description: "Choose a person",
			value: "",
			people,
			onInput,
			activate,
		});

		expect(picker.control.getAttribute("role")).toBe("combobox");
		expect(picker.control.getAttribute("aria-controls")).toBeTruthy();
		picker.control.focus();
		expect(activate).toHaveBeenCalledOnce();
		expect(picker.control.getAttribute("aria-expanded")).toBe("true");

		picker.control.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		expect(picker.control.getAttribute("aria-activedescendant")).toContain("option-0");
		picker.control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(onInput).toHaveBeenCalledWith("People/Alice.md");
		expect(picker.control.getAttribute("aria-expanded")).toBe("false");

		picker.control.focus();
		picker.close();
		expect(picker.control.getAttribute("aria-expanded")).toBe("false");
	});
});
