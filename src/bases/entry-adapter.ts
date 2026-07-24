import { ListValue, type App, type BasesEntry, type BasesPropertyId } from "obsidian";
import { resolvePersonId } from "../domain/identity";
import { parsePersonReference } from "../domain/wikilink";
import type { AtlasDiagnostic, PersonRecord, RawIndexSnapshot } from "../domain/types";

export interface BasesFieldMapping {
	name: BasesPropertyId | null;
	id: BasesPropertyId | null;
	photo: BasesPropertyId | null;
	organisations: BasesPropertyId | null;
	contacts: BasesPropertyId | null;
}

function readString(entry: BasesEntry, property: BasesPropertyId | null): string | undefined {
	if (!property) return undefined;
	const value = entry.getValue(property);
	if (!value || !value.isTruthy()) return undefined;
	const stringValue = value.toString().trim();
	return stringValue || undefined;
}

function readList(entry: BasesEntry, property: BasesPropertyId | null): string[] {
	if (!property) return [];
	const value = entry.getValue(property);
	if (!value || !value.isTruthy()) return [];
	if (value instanceof ListValue) {
		const result: string[] = [];
		for (let index = 0; index < value.length(); index++) {
			const item = value.get(index).toString().trim();
			if (item) result.push(item);
		}
		return result;
	}
	const single = value.toString().trim();
	return single ? [single] : [];
}

export function adaptBasesEntries(app: App, entries: BasesEntry[], mapping: BasesFieldMapping): RawIndexSnapshot {
	const diagnostics: AtlasDiagnostic[] = [];
	const people: PersonRecord[] = entries
		.filter((entry) => entry.file.extension === "md")
		.map((entry) => {
			const rawPhoto = readString(entry, mapping.photo);
			const photoTarget = rawPhoto ? parsePersonReference(rawPhoto)?.target ?? rawPhoto : undefined;
			const resolvedPhoto = photoTarget
				? app.metadataCache.getFirstLinkpathDest(photoTarget, entry.file.path)?.path
				: undefined;
			if (photoTarget && !resolvedPhoto) {
				diagnostics.push({
					id: `missing-asset:${entry.file.path}:${photoTarget}`,
					severity: "warning",
					code: "missing-asset",
					message: `The photo asset “${photoTarget}” referenced by “${entry.file.path}” could not be found.`,
					filePaths: [entry.file.path],
					targetPath: photoTarget,
				});
			}
			return {
				id: resolvePersonId(readString(entry, mapping.id), entry.file.path),
				filePath: entry.file.path,
				name: readString(entry, mapping.name) ?? entry.file.basename,
				aliases: [],
				organisations: readList(entry, mapping.organisations),
				photoPath: resolvedPhoto ?? photoTarget,
				contacts: readList(entry, mapping.contacts)
					.map(parsePersonReference)
					.filter((reference): reference is NonNullable<typeof reference> => reference !== undefined),
			};
		});
	return { people, relationships: [], diagnostics };
}
