export const englishRecovery = {
	diagnosticsTitle: "All diagnostics",
	searchDiagnostics: "Search diagnostics and note paths",
	severity: "Severity",
	code: "Diagnostic code",
	allCodes: "All codes",
	severities: { all: "All severities", error: "Error", warning: "Warning", info: "Information" },
	diagnosticsCount: ({ visible, total }: { visible: number; total: number }) => `${visible} of ${total} diagnostics`,
	openSource: ({ path }: { path: string }) => `Open source: ${path}`,
	repairSource: ({ path }: { path: string }) => `Review repair: ${path}`,
	reviewRepair: "Review repair",
	adoptionTitle: "Adopt existing person notes",
	repairTitle: "Review person ID repair",
	adoptionExplanation:
		"Choose exact Markdown notes and review every property change and configured mapping. Bodies, unrelated properties and unique authored IDs are preserved. Notes and folders are not moved; dossier-only photos and renames remain subject to their existing ownership checks.",
	duplicateWarning:
		"Choose exactly one duplicate note to receive a new ID. ID-based references are not automatically retargeted; review those separately. No people are merged or deleted.",
	sequentialWarning:
		"Selected notes are applied sequentially. Partial success is reported separately for each exact path; the batch is not atomic.",
	searchNotes: "Search Markdown note paths",
	applyReviewed: "Apply reviewed changes",
	cancel: "Close without applying",
	missingValue: "(missing)",
	classification: "Classification",
	personId: "Person ID",
	configuredMappings: "Configured property mappings",
	alreadyCurrent: "Already configured; no property changes are needed.",
	resultStatus: { saved: "Saved", skipped: "Skipped", failed: "Failed" },
	outsideContextError:
		"Identity validation was blocked by a note outside this Base. Open the full Atlas diagnostics to inspect that source.",
	commandDiagnostics: "Open all diagnostics",
	commandAdopt: "Adopt existing person notes",
	commandSettings: "Review older settings recovery",
	settingsTitle: "Review settings recovery",
	settingsExplanation:
		"Only known schema 7 settings can be recovered. Choose the new People root explicitly. Common valid settings are retained; old folder layouts and notes are not migrated. The exact original plugin data remains locally backed up after recovery and later saves.",
	chooseRoot: "Explicit target People root",
	reviewSettings: "Review settings",
	confirmSettings: "Confirm settings recovery",
	retained: "Retained",
	changed: "Adjusted by current validation",
	reset: "Defaulted",
	unsupported: "Unsupported; kept in original backup",
	settingsUnavailable:
		"No supported older settings are available for recovery. Current, future and malformed data are not replaced.",
	settingsSaved:
		"Settings recovered. Notes and folders were not changed. The original backup remains in the local plugin data. Reload the plugin if the Bases registration setting changed.",
};

export const dutchRecovery: typeof englishRecovery = {
	diagnosticsTitle: "Alle meldingen",
	searchDiagnostics: "Zoek meldingen en notitiepaden",
	severity: "Ernst",
	code: "Meldingscode",
	allCodes: "Alle codes",
	severities: { all: "Alle niveaus", error: "Fout", warning: "Waarschuwing", info: "Informatie" },
	diagnosticsCount: ({ visible, total }) => `${visible} van ${total} meldingen`,
	openSource: ({ path }) => `Open bron: ${path}`,
	repairSource: ({ path }) => `Bekijk herstel: ${path}`,
	reviewRepair: "Bekijk herstel",
	adoptionTitle: "Bestaande persoonsnotities opnemen",
	repairTitle: "Herstel van persoons-ID bekijken",
	adoptionExplanation:
		"Kies exacte Markdown-notities en bekijk iedere gewijzigde property en ingestelde veldkoppeling. Inhoud, overige properties en unieke bestaande ID's blijven behouden. Notities en mappen worden niet verplaatst; foto's en hernoemen houden de bestaande controles op dossier-eigenaarschap.",
	duplicateWarning:
		"Kies precies één dubbele notitie die een nieuw ID krijgt. Verwijzingen op basis van ID worden niet automatisch omgezet; controleer die afzonderlijk. Personen worden niet samengevoegd of verwijderd.",
	sequentialWarning:
		"Geselecteerde notities worden één voor één verwerkt. Gedeeltelijk succes verschijnt per exact pad; de hele reeks is niet atomair.",
	searchNotes: "Zoek Markdown-notitiepaden",
	applyReviewed: "Bekeken wijzigingen toepassen",
	cancel: "Sluiten zonder toepassen",
	missingValue: "(ontbreekt)",
	classification: "Classificatie",
	personId: "Persoons-ID",
	configuredMappings: "Ingestelde veldkoppelingen",
	alreadyCurrent: "Al ingesteld; er zijn geen wijzigingen aan properties nodig.",
	resultStatus: { saved: "Opgeslagen", skipped: "Overgeslagen", failed: "Mislukt" },
	outsideContextError:
		"De ID-controle is geblokkeerd door een notitie buiten deze Base. Open de volledige Atlas-meldingen om die bron te bekijken.",
	commandDiagnostics: "Alle meldingen openen",
	commandAdopt: "Bestaande persoonsnotities opnemen",
	commandSettings: "Herstel van oudere instellingen bekijken",
	settingsTitle: "Herstel van instellingen bekijken",
	settingsExplanation:
		"Alleen bekende instellingen met schema 7 kunnen worden hersteld. Kies de nieuwe People-hoofdmap expliciet. Gemeenschappelijke geldige instellingen blijven behouden; oude mappen en notities worden niet gemigreerd. De exacte oorspronkelijke plugindata blijft lokaal bewaard na herstel en latere wijzigingen.",
	chooseRoot: "Expliciete People-hoofdmap als bestemming",
	reviewSettings: "Instellingen bekijken",
	confirmSettings: "Herstel van instellingen bevestigen",
	retained: "Behouden",
	changed: "Aangepast door huidige validatie",
	reset: "Standaard ingesteld",
	unsupported: "Niet ondersteund; bewaard in oorspronkelijke back-up",
	settingsUnavailable:
		"Er zijn geen ondersteunde oudere instellingen beschikbaar voor herstel. Huidige, nieuwere en ongeldige gegevens worden niet vervangen.",
	settingsSaved:
		"Instellingen hersteld. Notities en mappen zijn niet gewijzigd. De oorspronkelijke back-up blijft in de lokale plugindata. Herlaad de plugin als de Bases-instelling is gewijzigd.",
};
