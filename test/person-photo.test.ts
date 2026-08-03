import { describe, expect, it } from "vitest";
import {
	canonicalPersonPhotoWikilink,
	dossierPersonPhotoAssets,
	filterPersonPhotoAssets,
	getPendingPersonPhotoSelectionError,
	isExternalPhotoReference,
	isSupportedPersonPhotoPath,
	personPhotoInitials,
	supportedPersonPhotoAssets,
} from "../src/domain/person-photo";

describe("person photo contract", () => {
	it("filters the supported raster extensions without treating URLs as vault assets", () => {
		expect(
			["Photos/a.png", "Photos/b.JPG", "Photos/c.jpeg", "Photos/d.webp", "Photos/e.gif", "Photos/f.avif"].every(
				isSupportedPersonPhotoPath,
			),
		).toBe(true);
		expect(isSupportedPersonPhotoPath("Photos/vector.svg")).toBe(false);
		expect(isSupportedPersonPhotoPath("https://example.com/photo.jpg")).toBe(false);
		expect(isExternalPhotoReference("//example.com/photo.png")).toBe(true);
	});

	it("keeps duplicate basenames as distinct path identities and searches by path", () => {
		const assets = supportedPersonPhotoAssets(["Team/Alex/photo.jpg", "Friends/Alex/photo.jpg", "Archive/vector.svg"]);

		expect(assets.map((asset) => asset.path)).toEqual(["Team/Alex/photo.jpg", "Friends/Alex/photo.jpg"]);
		expect(filterPersonPhotoAssets(assets, "friends")).toEqual([
			expect.objectContaining({ path: "Friends/Alex/photo.jpg" }),
		]);
		expect(filterPersonPhotoAssets(assets, "photo").map((asset) => asset.path)).toEqual([
			"Friends/Alex/photo.jpg",
			"Team/Alex/photo.jpg",
		]);
	});

	it("queries supported photos only from the exact dossier boundary and its descendants", () => {
		const dossierPath = "People/Profiles/alice--11112222";
		const assets = supportedPersonPhotoAssets([
			`${dossierPath}/Portrait.jpg`,
			`${dossierPath}/Events/Portrait.jpg`,
			`${dossierPath}-archive/Portrait.jpg`,
			"People/Profiles/bob--99999999/Portrait.jpg",
			"Archive/Portrait.jpg",
			`${dossierPath}/vector.svg`,
		]);
		expect(
			dossierPersonPhotoAssets(assets, dossierPath)
				.map((asset) => asset.path)
				.sort(),
		).toEqual([`${dossierPath}/Events/Portrait.jpg`, `${dossierPath}/Portrait.jpg`]);
	});

	it.each([
		"",
		" People/Profiles/alice--11112222",
		"/People/Profiles/alice--11112222",
		"People\\Profiles\\alice--11112222",
		"People//Profiles/alice--11112222",
		"People/Profiles/../alice--11112222",
		"People/Profiles/alice--11112222/",
	])("fails closed for the malformed dossier boundary %j", (dossierPath) => {
		const assets = supportedPersonPhotoAssets([
			"People/Profiles/alice--11112222/Portrait.jpg",
			"People/Profiles/alice--11112222/Events/Portrait.jpg",
		]);

		expect(dossierPersonPhotoAssets(assets, dossierPath)).toEqual([]);
	});

	it("creates a canonical wikilink only for a supported vault-relative path", () => {
		expect(canonicalPersonPhotoWikilink("Attachments/Alice Portrait.JPEG")).toBe("[[Attachments/Alice Portrait.JPEG]]");
		expect(canonicalPersonPhotoWikilink("Attachments/Alice [1].jpg")).toBe("[[Attachments/Alice [1].jpg]]");
		expect(() => canonicalPersonPhotoWikilink("Attachments/Alice.svg")).toThrow("supported image");
		expect(() => canonicalPersonPhotoWikilink("https://example.com/Alice.jpg")).toThrow("supported image");
		for (const path of [
			"/Attachments/Alice.jpg",
			"Attachments\\Alice.jpg",
			"Attachments//Alice.jpg",
			"Attachments/../Alice.jpg",
			"Attachments/./Alice.jpg",
			"Attachments/Alice.jpg?raw=true",
			"Attachments/Alice.jpg#crop",
			"Attachments/Alice|Portrait.jpg",
			"Attachments/Alice[[1.jpg",
			"Attachments/Alice]]1.jpg",
		]) {
			expect(() => canonicalPersonPhotoWikilink(path)).toThrow("supported image");
		}
	});

	it("keeps the deterministic initials fallback independent of asset readiness", () => {
		expect(personPhotoInitials("Alice Example")).toBe("AE");
		expect(personPhotoInitials("")).toBe("?");
	});

	it("fails a pending selection closed when its exact path is stale or ambiguous", () => {
		const selectedPath = "Attachments/Alice.jpg";
		const rawPhoto = canonicalPersonPhotoWikilink(selectedPath);
		const asset = supportedPersonPhotoAssets([selectedPath])[0];
		if (!asset) throw new Error("Expected a supported asset.");

		expect(getPendingPersonPhotoSelectionError(rawPhoto, selectedPath, [asset])).toBeUndefined();
		expect(getPendingPersonPhotoSelectionError(rawPhoto, selectedPath, [])).toContain("no longer uniquely available");
		expect(getPendingPersonPhotoSelectionError(rawPhoto, selectedPath, [asset, asset])).toContain(
			"no longer uniquely available",
		);
		expect(getPendingPersonPhotoSelectionError("[[Attachments/Other.jpg]]", selectedPath, [asset])).toContain(
			"changed unexpectedly",
		);
		expect(getPendingPersonPhotoSelectionError("unchanged manual value", undefined, [])).toBeUndefined();
	});
});
