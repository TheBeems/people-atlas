import { ListValue, StringValue, type App, type BasesEntry, type BasesPropertyId } from "obsidian";
import { parsePersonBirthDate, validatePersonEmails, validatePersonPhones } from "../domain/person-profile";
import { parsePersonReference } from "../domain/wikilink";
import type { AtlasDiagnostic, PersonRecord, RawIndexSnapshot } from "../domain/types";

export interface BasesFieldMapping {
	name: BasesPropertyId | null;
	id: BasesPropertyId | null;
	photo: BasesPropertyId | null;
	organisations: BasesPropertyId | null;
	contacts: BasesPropertyId | null;
	birthDate: BasesPropertyId | null;
	pronouns: BasesPropertyId | null;
	gender: BasesPropertyId | null;
	emails: BasesPropertyId | null;
	phones: BasesPropertyId | null;
	jobTitle: BasesPropertyId | null;
}

function readString(entry: BasesEntry, property: BasesPropertyId | null): string | undefined {
	if (!property) return undefined;
	const value = entry.getValue(property);
	if (!value?.isTruthy()) return undefined;
	const stringValue = value.toString().trim();
	return stringValue || undefined;
}

function readList(entry: BasesEntry, property: BasesPropertyId | null): string[] {
	if (!property) return [];
	const value = entry.getValue(property);
	if (!value?.isTruthy()) return [];
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

function readBirthDate(
	entry: BasesEntry,
	property: BasesPropertyId | null,
	diagnostics: AtlasDiagnostic[],
): string | undefined {
	if (!property) return undefined;
	const value = entry.getValue(property);
	if (!value) return undefined;
	if (!(value instanceof StringValue)) {
		diagnostics.push({
			id: `invalid-person-birth-date:${entry.file.path}:${String(property)}`,
			severity: "error",
			code: "invalid-person-birth-date",
			message: `Person “${entry.file.path}” has an invalid ${String(property)} value; expected text in YYYY-MM-DD or --MM-DD form.`,
			filePaths: [entry.file.path],
		});
		return undefined;
	}
	const raw = value.toString();
	if (!raw) return undefined;
	const parsed = parsePersonBirthDate(raw);
	if (parsed.valid) return parsed.value;
	diagnostics.push({
		id: `invalid-person-birth-date:${entry.file.path}:${String(property)}`,
		severity: "error",
		code: "invalid-person-birth-date",
		message: `Person “${entry.file.path}” has an invalid ${String(property)} value “${raw}”. ${parsed.error}`,
		filePaths: [entry.file.path],
	});
	return undefined;
}

function readEmails(entry: BasesEntry, property: BasesPropertyId | null, diagnostics: AtlasDiagnostic[]): string[] {
	const entries = readProfileList(entry, property, "invalid-person-email", diagnostics);
	const validated = validatePersonEmails(entries.map((item) => item.value));
	for (const issue of validated.issues) {
		const originalIndex = entries[issue.index]?.index ?? issue.index;
		diagnostics.push({
			id: `invalid-person-email:${entry.file.path}:${String(property)}:${originalIndex}`,
			severity: "error",
			code: "invalid-person-email",
			message: `Person “${entry.file.path}” has an invalid ${String(property)} entry ${originalIndex + 1}: ${issue.message}`,
			filePaths: [entry.file.path],
		});
	}
	return validated.values;
}

function readPhones(entry: BasesEntry, property: BasesPropertyId | null, diagnostics: AtlasDiagnostic[]): string[] {
	const entries = readProfileList(entry, property, "invalid-person-phone", diagnostics);
	const validated = validatePersonPhones(entries.map((item) => item.value));
	for (const issue of validated.issues) {
		const originalIndex = entries[issue.index]?.index ?? issue.index;
		diagnostics.push({
			id: `invalid-person-phone:${entry.file.path}:${String(property)}:${originalIndex}`,
			severity: "error",
			code: "invalid-person-phone",
			message: `Person “${entry.file.path}” has an invalid ${String(property)} entry ${originalIndex + 1}: ${issue.message}`,
			filePaths: [entry.file.path],
		});
	}
	return validated.values;
}

function readProfileList(
	entry: BasesEntry,
	property: BasesPropertyId | null,
	code: "invalid-person-email" | "invalid-person-phone",
	diagnostics: AtlasDiagnostic[],
): Array<{ index: number; value: string }> {
	if (!property) return [];
	const value = entry.getValue(property);
	if (!value) return [];
	if (!(value instanceof ListValue)) {
		diagnostics.push({
			id: `${code}:${entry.file.path}:${String(property)}:list`,
			severity: "error",
			code,
			message: `Person “${entry.file.path}” has an invalid ${String(property)} value; expected a list of text entries.`,
			filePaths: [entry.file.path],
		});
		return [];
	}
	const result: Array<{ index: number; value: string }> = [];
	for (let index = 0; index < value.length(); index++) {
		const item = value.get(index);
		if (!(item instanceof StringValue)) {
			diagnostics.push({
				id: `${code}:${entry.file.path}:${String(property)}:${index}`,
				severity: "error",
				code,
				message: `Person “${entry.file.path}” has an invalid ${String(property)} entry ${index + 1}; expected text.`,
				filePaths: [entry.file.path],
			});
			continue;
		}
		result.push({ index, value: item.toString() });
	}
	return result;
}

export function adaptBasesEntries(app: App, entries: BasesEntry[], mapping: BasesFieldMapping): RawIndexSnapshot {
	const diagnostics: AtlasDiagnostic[] = [];
	const people: PersonRecord[] = entries
		.filter((entry) => entry.file.extension === "md")
		.flatMap((entry) => {
			const id = readString(entry, mapping.id);
			if (!id) {
				diagnostics.push({
					id: `missing-person-id:${entry.file.path}:${String(mapping.id)}`,
					severity: "error",
					code: "missing-person-id",
					message: `Person “${entry.file.path}” must define a non-empty ${String(mapping.id)}.`,
					filePaths: [entry.file.path],
				});
				return [];
			}
			const rawPhoto = readString(entry, mapping.photo);
			const photoTarget = rawPhoto ? (parsePersonReference(rawPhoto)?.target ?? rawPhoto) : undefined;
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
			return [
				{
					id,
					filePath: entry.file.path,
					name: readString(entry, mapping.name) ?? entry.file.basename,
					aliases: [],
					organisations: readList(entry, mapping.organisations),
					photoPath: resolvedPhoto ?? photoTarget,
					birthDate: readBirthDate(entry, mapping.birthDate, diagnostics),
					pronouns: readString(entry, mapping.pronouns),
					gender: readString(entry, mapping.gender),
					emails: readEmails(entry, mapping.emails, diagnostics),
					phones: readPhones(entry, mapping.phones, diagnostics),
					jobTitle: readString(entry, mapping.jobTitle),
					contacts: readList(entry, mapping.contacts)
						.map(parsePersonReference)
						.filter((reference): reference is NonNullable<typeof reference> => reference !== undefined),
				},
			];
		});
	return { people, relationships: [], diagnostics };
}
