import type { PersonRecord } from "../domain/types";

export interface RelationshipPersonPickerOptions {
	label: string;
	description: string;
	value: string;
	people: readonly PersonRecord[];
	onInput(value: string): void;
	activate(close: () => void): void;
}

export interface RelationshipPersonPickerResult {
	control: HTMLInputElement;
	label: HTMLLabelElement;
	close(): void;
}

let pickerSequence = 0;

/** Owns the accessible person combobox used by relationship editors. */
export function appendRelationshipPersonPicker(
	container: HTMLElement,
	options: RelationshipPersonPickerOptions,
): RelationshipPersonPickerResult {
	const document = container.ownerDocument;
	const row = document.createElement("div");
	row.className = "people-atlas-form-field people-atlas-person-picker";
	const id = `people-atlas-field-${++pickerSequence}`;
	const descriptionId = `people-atlas-description-${++pickerSequence}`;
	const listId = `people-atlas-person-suggestions-${++pickerSequence}`;
	const label = document.createElement("label");
	label.htmlFor = id;
	label.textContent = options.label;
	const description = document.createElement("small");
	description.id = descriptionId;
	description.textContent = options.description;
	const input = document.createElement("input");
	input.id = id;
	input.type = "search";
	const initiallySelectedPerson = options.people.find((person) => person.filePath === options.value);
	let selectedPath = options.value;
	input.value = initiallySelectedPerson?.name ?? "";
	input.autocomplete = "off";
	input.setAttribute("aria-describedby", descriptionId);
	input.setAttribute("role", "combobox");
	input.setAttribute("aria-autocomplete", "list");
	input.setAttribute("aria-haspopup", "listbox");
	input.setAttribute("aria-controls", listId);
	input.setAttribute("aria-expanded", "false");

	const list = document.createElement("div");
	list.id = listId;
	list.className = "people-atlas-person-suggestions";
	list.setAttribute("role", "listbox");
	list.setAttribute("aria-label", options.label);
	list.hidden = true;

	const people = [...options.people].sort(comparePeople);
	let matches: PersonRecord[] = [];
	let activeIndex = -1;
	let isOpen = false;
	let candidateElements: HTMLElement[] = [];
	let blurTimeout: number | undefined;

	const updateActive = (): void => {
		candidateElements.forEach((candidate, index) => {
			candidate.setAttribute("aria-selected", String(index === activeIndex));
		});
		const active = activeIndex >= 0 ? candidateElements[activeIndex] : undefined;
		if (active) input.setAttribute("aria-activedescendant", active.id);
		else input.removeAttribute("aria-activedescendant");
	};

	const close = (): void => {
		if (blurTimeout !== undefined) {
			document.defaultView?.clearTimeout(blurTimeout);
			blurTimeout = undefined;
		}
		isOpen = false;
		activeIndex = -1;
		list.hidden = true;
		input.setAttribute("aria-expanded", "false");
		updateActive();
	};

	const selectPerson = (person: PersonRecord): void => {
		selectedPath = person.filePath;
		input.value = person.name;
		options.onInput(person.filePath);
		close();
	};

	const render = (query: string): void => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		matches = people.filter((person) =>
			[person.name, ...person.aliases, person.filePath].some((candidate) =>
				candidate.toLocaleLowerCase().includes(normalizedQuery),
			),
		);
		activeIndex = -1;
		list.replaceChildren(
			...matches.map((person, index) => {
				const candidate = document.createElement("div");
				candidate.id = `${listId}-option-${index}`;
				candidate.className = "people-atlas-person-suggestion";
				candidate.setAttribute("role", "option");
				candidate.setAttribute("aria-selected", "false");
				candidate.tabIndex = -1;
				candidate.dataset.personPath = person.filePath;
				candidate.textContent = person.name;
				candidate.addEventListener("pointerdown", (event) => {
					event.preventDefault();
					selectPerson(person);
				});
				candidate.addEventListener("click", () => {
					if (isOpen) selectPerson(person);
				});
				return candidate;
			}),
		);
		candidateElements = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
		isOpen = matches.length > 0;
		list.hidden = !isOpen;
		input.setAttribute("aria-expanded", String(isOpen));
		updateActive();
	};

	const queryForInput = (): string => (selectedPath ? "" : input.value);
	const open = (): void => {
		options.activate(close);
		render(queryForInput());
	};

	input.addEventListener("focus", open);
	input.addEventListener("click", open);
	input.addEventListener("input", () => {
		const matchingPerson = people.find((person) => person.filePath === input.value);
		if (matchingPerson) {
			selectedPath = matchingPerson.filePath;
			input.value = matchingPerson.name;
			options.onInput(matchingPerson.filePath);
		} else {
			selectedPath = "";
			options.onInput(input.value);
		}
		open();
	});
	input.addEventListener("blur", () => {
		const view = document.defaultView;
		if (!view) {
			close();
			return;
		}
		if (blurTimeout !== undefined) view.clearTimeout(blurTimeout);
		blurTimeout = view.setTimeout(() => {
			blurTimeout = undefined;
			const activeElement = document.activeElement;
			if (activeElement !== input && !list.contains(activeElement)) close();
		}, 0);
	});
	input.addEventListener("keydown", (event) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!isOpen) open();
			if (matches.length === 0) return;
			activeIndex =
				event.key === "ArrowDown"
					? activeIndex < matches.length - 1
						? activeIndex + 1
						: 0
					: activeIndex > 0
						? activeIndex - 1
						: matches.length - 1;
			updateActive();
			return;
		}
		if (event.key === "Enter" && isOpen && activeIndex >= 0) {
			event.preventDefault();
			const activePerson = matches[activeIndex];
			if (activePerson) selectPerson(activePerson);
			return;
		}
		if (event.key === "Escape" && isOpen) {
			event.preventDefault();
			close();
			return;
		}
		if (event.key === "Tab") close();
	});

	row.append(label, description, input, list);
	container.append(row);
	return { control: input, label, close };
}

function comparePeople(left: PersonRecord, right: PersonRecord): number {
	return left.name.localeCompare(right.name) || left.filePath.localeCompare(right.filePath);
}
