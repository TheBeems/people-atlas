Status: done
Created: 2026-08-05
Updated: 2026-08-05
Depends-On: `.10x/specs/multilingual-user-interface.md`; `.10x/tickets/2026-08-04-i18n-interaction-accessibility-nl-en.md` (done)
Blocks: `.10x/tickets/2026-08-04-i18n-diagnostics-formatting-nl-en.md`

# Modulaire EN/NL-locale-catalogi

## Doel

Verplaats de bestaande getypeerde EN/NL-catalogi uit `src/i18n.ts` naar kleine
statische locale-modules zonder wijziging van de publieke i18n-API,
hostlocale-route, opslag, UI-gedrag of locale-inhoud.

## Scope

- `src/i18n/en.ts` bevat de Engelse catalogus en definieert het structurele
  `Translator`-contract.
- `src/i18n/nl.ts` implementeert dat contract compilerbaar en behoudt alle
  bestaande Nederlandse teksten en parameterfuncties byte-inhoudelijk.
- `src/i18n/index.ts` blijft de enige publieke facade voor `SupportedLocale`,
  `messageCatalogs`, `resolveLocale()` en `createTranslator()`.
- Verwijder `src/i18n.ts` zodra de directoryfacade bestaat; alle bestaande
  consumenten moeten hun huidige `../i18n`-importvorm behouden.
- Leg het bestaande publieke contract eerst met een gedragsbaseline vast en
  test daarna extractie, fallback, parameterwaarden, typepariteit en build.

## Niet doen

- Geen nieuwe taal, catalogusnamespace, JSON-loader, dynamische import,
  externe dependency, netwerk, telemetry, locale-setting of hot switch.
- Geen verandering aan teksten, keys, pluralisatie, datum-/nummerformattering,
  diagnostics, IDs, paden, frontmatter, settingspayloads, templates, vrije
  rollen of user-authored waarden.
- Geen i18n-import in pure domain-, graph-, index- of parserlagen.
- Geen fase-3-diagnostic- of formatteringswerk binnen dit ticket.

## Uitvoering en gate

- Gebruik per codewijziging verticale TDD: eerst assertion-grade RED, daarna
  minimale GREEN en gerichte regressies.
- Vraag vóór afsluiting een onafhankelijke strikt read-only review aan.
- Draai na PASS één actuele volledige Node-24-gate: `npm run test`,
  `npm run build`, `npm run format:check` en `git diff --check`.
- Na formele closure zijn commit en push naar de geconfigureerde `main`-remote
  expliciet door de gebruiker geautoriseerd.

## Acceptatiecriteria

- [x] De bestaande `src/i18n` public-imports en runtime-interface werken
      ongewijzigd.
- [x] Engels definieert compilerbaar de volledige message- en
      parametercontracten; Nederlands voldoet daaraan.
- [x] `nl`/`nl-*`, `en`/`en-*` en onbekende locales behouden exact de huidige
      selectie/fallback.
- [x] De plugin blijft `getLanguage()` uitsluitend tijdens constructie gebruiken.
- [x] Er zijn geen gedrags-, opslag-, identiteit-, data- of UI-copywijzigingen.
- [x] Gerichte regressies, onafhankelijke review en de actuele Node-24-gate
      zijn groen.

## Blokkers

None.

## Journal

- 2026-08-05: Aangemaakt na formele fase-2-closure als smalle
  gedragsneutrale infrastructuurrefactor. De gebruiker autoriseerde lokale
  uitvoering, review/gate, commit en push; fase 3 blijft geblokkeerd tot dit
  ticket formeel `done` is.
- 2026-08-05: Het publieke contract is eerst gekarakteriseerd via
  `test/i18n.test.ts`, waarna de EN- en NL-catalogus zonder inhoudelijke
  wijziging naar `src/i18n/en.ts` en `src/i18n/nl.ts` zijn geëxtraheerd en
  `src/i18n/index.ts` de bestaande facade behield. Een lokale exact-vergelijking
  bevestigde identieke EN/NL-cataloguslichamen, afgezien van export/type-annotaties.
  Onafhankelijke strikt read-only review (`deleg_7c185171`): PASS zonder
  concrete findings. Actuele Node 24.18.1-gate: `npm run test` groen (940 node,
  147 browser, 34 integratie, 6 browser-matrix); `npm run build` groen;
  `npm run lint` exit 0 met één bestaande, niet-gewijzigde waarschuwing in
  `test/obsidian-stub.ts:207`; `npm run format:check` en `git diff --check`
  groen. Live Desktop/Mobile-validatie is niet uitgevoerd of geclaimd.
