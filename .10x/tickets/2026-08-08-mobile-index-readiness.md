Status: done
Created: 2026-08-08
Updated: 2026-08-08
Parent: `.10x/tickets/2026-08-08-final-review-remediation.md`
Owner: People Atlas implementation workstream — index lifecycle
Depends-On: `.10x/specs/my-person-note-picker.md`

# People-index: structurele mobile readiness

## Doel

Los de mobiele vault/index-timing structureel op. Een vroege lege scan mag niet
als blijvende geldige toestand worden gepubliceerd wanneer Obsidian de vault of
metadata nog aan het mounten is.

De handmatige `rebuild-index`-command blijft een expliciete fallback, maar is
niet langer de primaire oplossing voor een normale mobiele start.

## Gewenst gedrag

- De index heeft een expliciete lifecycle/readiness-state.
- Event-listeners worden lifecycle-owned geregistreerd vóór de eerste relevante
  scan/publicatie.
- De initiële scan vindt plaats na de beschikbare publieke Obsidian
  readiness-/metadata-resolutiegrens.
- Als een gecontroleerde runtime toch een lege snapshot oplevert vóór
  readiness, volgt één idempotente herbouw zodra de readinessgrens is bereikt.
- Er is geen onbeperkte polling, interval of vaultwrite.
- Een latere rebuild publiceert één actuele snapshot en werkt de open Settings-
  picker bij.
- Unload vóór layout/readiness kan geen late `addChild`, scan of state-publicatie
  veroorzaken.

De executor kiest de kleinste publieke Obsidian lifecyclemechaniek die deze
observabele contracten bewijst; de voorkeursroute is de bestaande
metadata-cache-resolutiegrens gecombineerd met de layoutgrens, niet een
willekeurige timer.

## Scope

- `src/index/person-index.ts` initialisatie, readiness en idempotente rebuild;
- `src/main.ts` layout/unload-guard en commandgedrag indien nodig;
- controlled runtime/integratietests voor empty-to-populated transitions;
- eventueel de technische i18n-tekst van de bestaande command, zonder nieuwe
  UX-scope.

## Niet doen

- Geen scan of rebuild vanuit Settings openen/renderen;
- geen onbeperkte retry/polling;
- geen wijziging aan person parsing, duplicate-ID-semantiek of relationship
  creation;
- geen migratie of vaultwrite;
- geen live Desktop/Mobile-claim zonder hostbewijs;
- geen commit, push, tag, release of remote write.

## Verticale TDD

### Slice 1 — readiness lifecycle

- RED: controlled runtime start met een lege `getMarkdownFiles()`-uitkomst en
  levert daarna files/metadata; assert dat de index zonder handmatige command
  eindigt met de latere personen.
- GREEN: voeg de minimale readiness-state en één idempotente late rebuild toe.
- Test ook unload vóór het readiness/layout-signaal.

### Slice 2 — command en publication

- RED: assert dat de command alleen de lifecycle-veilige rebuild-route gebruikt
  en dat een actuele rebuild naar subscribers/public open Settings publiceert.
- GREEN: behoud de command als fallback, zonder dubbele scans of late state na
  unload.

### Review en gates

- onafhankelijke read-only review met nadruk op event cleanup, race/error
  handling en Android/iOS timingbeperkingen;
- actuele Node-24 `npm run check`, build en `git diff --check`;
- rapporteer live mobiele validatie afzonderlijk als niet uitgevoerd wanneer
  geen Obsidian-host beschikbaar is.

## Acceptatiecriteria

- [x] Een vroege lege vault-scan blijft niet permanent leeg wanneer de vault
      later gereed komt.
- [x] De controlled empty-to-populated test slaagt zonder handmatige command.
- [x] De index publiceert geen onnodige dubbele rebuilds en behoudt dezelfde
      snapshot/equality-semantiek.
- [x] `rebuild-index` blijft werken als expliciete post-readiness fallback.
- [x] Alle listeners en late callbacks zijn unload-safe, inclusief unload vóór
      layout/readiness.
- [x] Geen Settings-open/renderpad initieert scan, rebuild, plugin-datawrite of
      vaultwrite.
- [x] Onafhankelijke review en Node-24 full gate zijn groen.

## Blokkers

None bevestigd voor shaping. De executor moet de concrete publieke Obsidian
readiness-eventsemantiek in het journal vastleggen; een willekeurige timeout is
geen acceptabele substituut.

## Journal

- 2026-08-08 RED: `npx vitest run --project node
  test/person-index-lifecycle.test.ts` → 7/8 groen. De nieuwe overgangstest
  bleef leeg na `metadataCache.resolved`, omdat de index alleen de eerste scan
  deed.
- 2026-08-08 GREEN: `PersonIndex` registreert het publieke `resolved`-event vóór
  de eerste scan en voert precies één readiness-rebuild uit. De lifecycle-suite
  → 8/8 groen; `npm run typecheck` → exit 0.
- 2026-08-08: De eventcallback controleert `started` en een one-shot pending-vlag;
  `onunload()` annuleert resterende readinessactie. Er is geen timer of polling
  toegevoegd.
- 2026-08-08 repair: Een gevulde eerste scan wist `initialResolutionPending`,
  zodat een later terugkerend `resolved`-event geen tweede rebuild/publicatie
  veroorzaakt. Een lege readiness-scan laat de vlag staan totdat een scan
  werkelijk Markdownbestanden ziet.
- 2026-08-08 repair: `workspace.onLayoutReady()` is lifecycle-generation-guarded;
  unload vóór layout kan de index niet alsnog attachen of starten. RED→GREEN:
  `npx vitest run --project integration
  `test/integration/people-atlas-plugin.integration.test.ts` faalde eerst op
  `childCount 1`, daarna groen; lifecycle-suite inclusief premature-resolved
  case → groen; de integration- en nodegerichte suites zijn daarna opnieuw
  groen uitgevoerd.
- 2026-08-08 fresh-review repair RED→GREEN: een create-event vóór het eerste
  `metadataCache.resolved` publiceerde eerst een incrementele snapshot en
  veroorzaakte daarna een dubbele readiness-rebuild. De nieuwe lifecycletest
  faalde eerst (9/10) en is daarna opgelost met een observed-readiness-vlag:
  Markdown-updates vóór de eerste resolved worden uitgesteld; één latere
  rebuild publiceert de actuele snapshot. Asset-lifecyclegedrag blijft direct
  behouden. Lifecycle-suite: 10/10; typecheck en diff-check groen.

## Evidence

De controlled lifecycle-tests bewijzen `empty initial scan → populated vault →
automatic index snapshot`, behoud van pending bij een premature leeg
`resolved`-event, geen dubbele rebuild na een gevulde startsnapshot en
create vóór de eerste `resolved` wordt uitgesteld tot één readiness-rebuild en
unload vóór layout via de controlled component-runtime. Een echte mobiele
Obsidian-host is niet lokaal gesimuleerd. De uiteindelijke lifecycle-suite is
12/12 groen, inclusief files-present/metadata-cache-missing, create vóór de
eerste resolved en premature empty-resolved → create zonder dubbele rebuild.
De Node-24 final gate is exit 0: node 53 bestanden/964 tests, browser 10/158,
integration 9 bestanden/38 tests, DPR 1/1.5/2 elk 2/2, format/lint/typecheck/
build/community/audit/releasecontract/reproducibility/diff-check groen.
## Review

2026-08-08 onafhankelijke actuele readiness-review: **PASS**. De reviewer
bevestigde de null-cache guard, alle readiness-races, asset-lifecycle en
unload-bescherming. Residueel: controlled runtime, geen echte Desktop/Mobile-
hostvalidatie.

## Retrospective

De combinatie van lifecycle-state, expliciete metadata-resolutie en een bounded
defer/rebuild is betrouwbaarder dan polling: de belangrijke foutmodus was niet
een lege scan op zichzelf, maar het te vroeg als compleet behandelen van een
non-empty vault met nog ontbrekende metadata-cache.

## Referenties

- `.10x/specs/my-person-note-picker.md`
- `.10x/tickets/2026-08-07-my-person-dropdown-mobile-fix.md`
- `src/index/person-index.ts`
- `src/main.ts`
- `test/integration/my-person.integration.test.ts`
- `test/integration/people-atlas-plugin.integration.test.ts`
- `.agents/skills/10x/SKILL.md` (mobile-index timing pitfall)
