import { Modal, type App } from "obsidian";
import type { AtlasDiagnostic, DiagnosticSeverity } from "../domain/types";
import { diagnosticsInContext, filterDiagnostics, type DiagnosticFilters } from "../graph/filter-diagnostics";
import type { Translator } from "../i18n";

export class DiagnosticsModal extends Modal {
	private readonly cleanup: Array<() => void> = [];
	private readonly rowCleanup: Array<() => void> = [];
	constructor(
		app: App,
		private readonly diagnostics: readonly AtlasDiagnostic[],
		private readonly openSource: (path: string) => void,
		private readonly repair: (diagnostic: AtlasDiagnostic, path: string) => void,
		private readonly t: Translator,
		private readonly allowedPaths?: ReadonlySet<string>,
	) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.textContent = this.t.recovery.diagnosticsTitle;
		this.contentEl.replaceChildren();
		this.contentEl.classList.add("people-atlas-recovery");
		const document = this.contentEl.ownerDocument;
		const visible = diagnosticsInContext(this.diagnostics, this.allowedPaths);
		const filters: DiagnosticFilters = { text: "", severity: "all", code: "all" };
		const controls = document.createElement("div");
		controls.className = "people-atlas-recovery-filters";
		const search = document.createElement("input");
		search.type = "search";
		search.setAttribute("aria-label", this.t.recovery.searchDiagnostics);
		search.placeholder = this.t.recovery.searchDiagnostics;
		const severity = document.createElement("select");
		severity.setAttribute("aria-label", this.t.recovery.severity);
		for (const value of ["all", "error", "warning", "info"] as const) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = this.t.recovery.severities[value];
			severity.append(option);
		}
		const code = document.createElement("select");
		code.setAttribute("aria-label", this.t.recovery.code);
		for (const value of ["all", ...new Set(visible.map((diagnostic) => diagnostic.code))]) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = value === "all" ? this.t.recovery.allCodes : value;
			code.append(option);
		}
		const count = document.createElement("p");
		count.setAttribute("role", "status");
		const list = document.createElement("ul");
		list.className = "people-atlas-recovery-diagnostics";
		const render = (): void => {
			for (const clean of this.rowCleanup.splice(0)) clean();
			list.replaceChildren();
			const matches = filterDiagnostics(visible, filters);
			count.textContent = this.t.recovery.diagnosticsCount({ visible: matches.length, total: visible.length });
			for (const diagnostic of matches) {
				const row = document.createElement("li");
				const description = document.createElement("p");
				description.textContent = `${this.t.recovery.severities[diagnostic.severity]} · ${diagnostic.code}: ${diagnostic.message}`;
				row.append(description);
				for (const path of diagnostic.filePaths) {
					const source = document.createElement("button");
					source.type = "button";
					source.textContent = path;
					source.setAttribute("aria-label", this.t.recovery.openSource({ path }));
					this.listen(source, "click", () => this.openSource(path), this.rowCleanup);
					row.append(source);
					if (
						diagnostic.code === "missing-person-id" ||
						diagnostic.code === "duplicate-person-id" ||
						diagnostic.code === "unresolved-relationship-endpoint" ||
						diagnostic.code === "ambiguous-person-reference"
					) {
						const repair = document.createElement("button");
						repair.type = "button";
						repair.textContent = this.t.recovery.reviewRepair;
						repair.setAttribute("aria-label", this.t.recovery.repairSource({ path }));
						this.listen(repair, "click", () => this.repair(diagnostic, path), this.rowCleanup);
						row.append(repair);
					}
				}
				list.append(row);
			}
		};
		this.listen(search, "input", () => {
			filters.text = search.value;
			render();
		});
		this.listen(severity, "change", () => {
			filters.severity = severity.value as DiagnosticSeverity | "all";
			render();
		});
		this.listen(code, "change", () => {
			filters.code = code.value as AtlasDiagnostic["code"] | "all";
			render();
		});
		this.listen(this.contentEl, "keydown", (event) => {
			if ((event as KeyboardEvent).key === "Escape") this.close();
		});
		controls.append(search, severity, code);
		this.contentEl.append(controls, count, list);
		render();
		search.focus();
	}
	private listen(element: HTMLElement, type: string, handler: EventListener, cleanup = this.cleanup): void {
		element.addEventListener(type, handler);
		cleanup.push(() => element.removeEventListener(type, handler));
	}
	override onClose(): void {
		for (const clean of [...this.cleanup.splice(0), ...this.rowCleanup.splice(0)]) clean();
		this.contentEl.replaceChildren();
		this.contentEl.classList.remove("people-atlas-recovery");
	}
}
