Status: done
Created: 2026-08-03
Updated: 2026-08-03

# Persoonsdossier-opslag — source discovery

## Question

Kan People Atlas een Second Brain-vriendelijke opslagstructuur ondersteunen met
één dossiermap per persoon, centrale relaties en contactmomenten, en lokale
profielfoto's zonder een tweede vault, migratie of onnodige opslaglaag?

## Sources and methods

Read-only inspectie op 2026-08-03 van:

- `src/index/person-index.ts`;
- `src/editor/person-form.ts` en `src/editor/person-modal.ts`;
- `src/editor/relationship-form.ts`;
- `src/mutations/atlas-mutation-service.ts` en `src/mutations/validation.ts`;
- `src/domain/person-photo.ts`;
- `src/settings/{types,defaults,validate,settings-tab}.ts`;
- `.10x/specs/{person-profile-experience,contact-moments-follow-up,settings-information-architecture,safe-mutations-and-versioned-data}.md`;
- de afgeronde ticket `.10x/tickets/2026-07-30-person-photo-picker-profile.md`.

## Findings

1. `PersonIndex` loopt momenteel over alle Markdown-bestanden in de actieve
   vault (`app.vault.getMarkdownFiles()`) en classificeert op note-data. Een
   geneste dossiermap is daarom indexeerbaar; een specifieke mapdiepte heeft
   geen index-prestatievoordeel of -nadeel.
2. Nieuwe personen worden nu plat aangemaakt als
   `<peopleFolder>/<naam>.md`. De zichtbare create-path is alleen een
   read-only preview; `AtlasMutationService` bepaalt de daadwerkelijke
   bestemming uit `settings.peopleFolder` en de gesaniteerde naam.
3. De person-editor hernoemt bij een naamswijziging uitsluitend het
   Markdown-bestand binnen zijn huidige oudermap. De bestaande update-flow
   verandert `person_id` niet. Een stabiele dossiermap kan dus behouden blijven
   terwijl een zichtbare profielbestandsnaam wijzigt.
4. Relatiecreatie gebruikt momenteel een los hard-coded pad
   `People/Relationships/<eerste> - <tweede>.md`. Contactmomenten hebben een
   configureerbaar pad met huidige default `People/Contact moments`.
5. De huidige fotokiezer zoekt ondersteunde afbeeldingen vaultbreed en schrijft
   alleen na expliciete Save een vault-relative wikilink. De afgeronde
   fotospecificatie verbiedt kopiëren, verplaatsen, hernoemen en verwijderen
   van assets door de plugin.
6. Huidige actieve records beperken settings- en migratiesemantiek:
   - `settings-information-architecture.md` beperkt zichzelf expliciet tot
     bestaande settings en verbiedt nieuwe/verwijderde keys;
   - `safe-mutations-and-versioned-data.md` definieert een versiegebonden
     settingsmigratiepad.
   De gebruiker vroeg op 2026-08-03 juist om een brekende structuur zonder
   backwards compatibility of migraties. Een geratificeerde opvolgspecificatie
   moet deze twee begrensde clauses expliciet supersederen, niet stil negeren.

## Conclusion

Eén vault blijft de aanbevolen grens. De kleinste coherente structuur is:

```text
People/
  Profiles/<persoon-dossier>/
    <zichtbare persoonsnaam>.md
    <lokale foto's en ondersteunende bestanden>
  Relationships/
    <relatienotities>.md
  Contact moments/
    <contactmomentnotities>.md
```

Een persoonsdossier kan gewone ondersteunende Markdown en assets bevatten;
alleen de ene canonieke profielnotitie krijgt het People Atlas `person`-type.
Relaties en contactmomenten blijven centrale zelfstandige entiteiten omdat zij
meerdere personen kunnen betreffen.

De architectuur kan zonder asset-manager blijven werken: de gebruiker plaatst
foto's in het dossier; People Atlas verplaatst of dupliceert nooit binaries.
De resterende productbeslissingen staan expliciet in de draftspec
`person-dossier-storage.md`.

## Limits

- Geen live Obsidian Desktop/Mobile-dossierflow uitgevoerd.
- Geen implementatie, test, build, vaultwrite buiten deze `.10x/`-records,
  commit of externe write uitgevoerd.
- De keuze voor een leesbare maar collision-safe dossiernaam en de exacte
  create-time fotoflow is nog niet door de gebruiker geratificeerd.
