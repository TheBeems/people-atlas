Status: done
Created: 2026-08-10
Updated: 2026-08-10
Parent: None
Owner: People Atlas implementation workstream — identity/resolution safety
Depends-On: `.10x/specs/person-reference-resolution.md`, `.10x/decisions/person-reference-resolution-precedence.md`

# Veilige resolutie van wikilinks, IDs en paden

## Scope

Implementeer de contractcorrectie uit
`.10x/specs/person-reference-resolution.md` als één dependency-ready TDD-ticket.
De uitkomst is één gedeelde typed resolver voor persisted person- en
relationship-references in de parser, canonieke index, full graph, graph-delta
en contactmomentprojectie.

De ticket omvat:

1. `PersonReference` en de analoge relatieverwijzing uitbreiden met het
   expliciete soort `wikilink`, `path` of `id`.
2. `parsePersonReference` en de parsergrens zo aanpassen dat de classificatie
   behouden blijft en iedere beschikbare Obsidian-linkresolutie als
   `resolvedPath` wordt opgeslagen, inclusief gewone `person.contacts`.
3. Eén pure, Obsidian-onafhankelijke resolver met typed uitkomsten
   `resolved`/`unresolved`/`ambiguous` maken. De resolver verzamelt ID- en
   pad-evidence, dedupliceert op canoniek bestandspad en weigert conflicten.
4. De bestaande first-match-resolvers in `src/graph/build-snapshot.ts`,
   `src/graph/graph-delta.ts` en `src/index/index-state.ts` vervangen door die
   gedeelde grens. De contactmomentprojectie en relatie-endpoints blijven
   dezelfde uitkomst gebruiken.
5. De volledige graph-build en incremental graph-delta voor gewone contacten en
   rijke relaties dezelfde ambiguity-, unresolved- en filtered-uitkomst laten
   produceren.
6. De bestaande contextspecifieke contactmomentdiagnostiek behouden, maar haar
   persoons- en relatiekandidaten via dezelfde resolver laten lopen.
7. De exacte regressie toevoegen waarin `person_id: Bob` concurreert met
   `[[Bob]] -> People/Bob.md`; geen verkeerde edge mag ontstaan.

De uitvoerder moet vóór de eerste productiepatch alle referentie-resolver-call
sites in de genoemde parser/index/graph-context inventariseren. Een helper die
alleen nieuwe code gebruikt maar een bestaande first-match-branch laat bestaan,
is geen geldige afronding.

## Niet doen

- Geen wijziging aan Markdown-frontmatter, propertynamen, opgeslagen IDs of
  bestaande notitie-body's.
- Geen vaultmigratie, automatische rename, merge, importreparatie of rewrite van
  inbound wikilinks.
- Geen displaynaam-, alias- of labelresolutie.
- Geen nieuwe diagnostics-panel-UI, picker-UX, editorworkflow of
  mutation-writebeleid.
- Geen wijziging aan bestaande filtered-endpoint-, ghost-, duplicate-ID- of
  contextspecifieke contactmomentsemantiek behalve de vereiste ambiguity-correctie.
- Geen tweede resolver voor full-build, delta-build of contactmomenten.
- Geen commit, push, tag, release, externe write of live-vaultwrite als onderdeel
  van dit ticket.

## Acceptatiecriteria

- [x] De parserclassificatie is exact: `[[...]]` → `wikilink`, een niet-gewrapte
      target met `/` of `.md` → `path`, overige tekst → `id`.
- [x] Iedere parser-geproduceerde persoonreferentie, inclusief gewone
      `person.contacts`, bewaart Obsidian's `resolvedPath` wanneer beschikbaar;
      een ontbrekend pad wordt niet als ID-fallback verzonnen.
- [x] De gedeelde resolver geeft één unieke same-person-uitkomst wanneer ID- en
      pad-evidence naar hetzelfde canonieke bestand wijzen.
- [x] De gedeelde resolver geeft `ambiguous` wanneer ID- en pad-evidence naar
      verschillende personen wijzen, bij duplicate IDs of bij niet-unieke
      canonieke identiteit; de eerste match wordt nooit gebruikt.
- [x] Een wikilink met alleen een unieke ID-match maar zonder canoniek resolved
      pad valt niet terug naar die ID.
- [x] `buildAtlasSnapshot` en `applyGraphDelta` gebruiken dezelfde resolver voor
      gewone contactedges en rich relationship-endpoints.
- [x] Het exacte scenario met A=`person_id: Bob`, B=`People/Bob.md` en
      `to: [[Bob]]` publiceert geen edge naar A of B en publiceert
      `ambiguous-person-reference` met beide kandidaatpaden.
- [x] Een ambiguous gewone contactreferentie maakt geen ghost-edge en geen
      generieke unresolved-contact-uitkomst; een unresolved referentie behoudt
      wel de bestaande ghost/unresolved-uitkomst.
- [x] Een ambiguous rich relationship-endpoint publiceert geen relationship-edge
      en geen misleidende first-match of enkelvoudige unresolved-uitkomst.
- [x] Contactmomentindexering en -projectie gebruiken dezelfde resolver;
      ambiguous persoons- of relatieverwijzingen maken het moment niet-actionable
      en behouden de bestaande contextspecifieke diagnostic code.
- [x] Unieke relaties/contactedges, filtered endpoints, duplicate-ID-diagnostiek,
      contactmoment-actionability en full/delta-pariteit blijven correct.
- [x] Gerichte tests dekken parserclassificatie, opgeslagen resolvedPath,
      same-person evidence, ID-versus-wikilink-conflict, unresolved wikilink
      zonder ID-fallback, duplicate ID, path-normalisatie, gewone contacten,
      rich relationships, contactmomenten, full/delta-pariteit en
      record-order-onafhankelijkheid.
- [x] De ticketuitvoerder legt per verticale slice RED → GREEN vast met exact
      commando, exitcode en relevante testscope.
- [x] Na de laatste code/testwijziging volgt één onafhankelijke read-only review;
      findings zijn opgelost of als duurzame residual risk belegd voordat de
      volledige Node-24-gate kan starten.
- [x] Voor ticketclosure zijn minstens format, lint, typecheck, volledige test,
      productiebuild en `git diff --check` actuele groene evidence; historische
      journalclaims tellen niet als vervanging.

## References

- `.10x/specs/person-reference-resolution.md`
- `.10x/decisions/person-reference-resolution-precedence.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/generated-graph-index-invariants.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/knowledge/generated-invariant-testing.md`
- `AGENTS.md`
- `src/domain/types.ts`
- `src/domain/wikilink.ts`
- `src/index/frontmatter.ts`
- `src/index/index-state.ts`
- `src/graph/build-snapshot.ts`
- `src/graph/graph-delta.ts`
- `src/graph/graph-source.ts`
- `test/wikilink.test.ts`
- `test/build-snapshot.test.ts`
- `test/index-state.test.ts`
- `test/graph-delta.test.ts`
- `test/generated/snapshot-invariants.generated.test.ts`
- `test/generated/contact-moment-index-invariants.generated.test.ts`

## Aannames en provenance

- **User-ratified 2026-08-10:** één ticket voor parser, gedeelde resolver,
  graph/index/contactmomenten en de regressietest.
- **User-ratified 2026-08-10:** `[[...]]` is `wikilink`; slash- of `.md`-targets
  zijn `path`; overige niet-gewrapte targets zijn `id`.
- **User-ratified 2026-08-10:** voor wikilinks is het resolved pad primair; een
  ID-match is alleen conflict-evidence; verschillende personen zijn ambiguous
  en publiceren geen edge.
- **Record-backed:** `.10x/specs/canonical-graph-source.md` verbiedt
  first-match-resolutie van duplicate IDs en vereist resolved ID/path-identiteit.
- **Record-backed:** de actieve contactmoment-spec vereist dat unresolved of
  ambiguous person references niet-actionable blijven.
- **Mechanical:** de exacte bestandsnaam van de nieuwe pure resolver mag door de
  uitvoerder worden gekozen zolang zij Obsidian-onafhankelijk, uniek en door alle
  genoemde consumenten gebruikt is.

## Verticale TDD-slices

### Slice 1 — type en parser-evidence (RED → GREEN)

- **RED:** voeg parserasserties toe voor de drie referentiesoorten en voor een
  gewone contactwikilink die `resolvedPath` moet bewaren; voer de gerichte
  wikilink/frontmattertests uit en leg de huidige mismatch vast.
- **GREEN:** voeg `ReferenceKind` toe, classificeer parserwaarden en routeer alle
  parser-geproduceerde persoonreferenties door de Obsidian-resolutiegrens.
- **Bewijs:** `test/wikilink.test.ts` plus de bestaande frontmatter/index-scope;
  geen brede producttest als vervanging voor de parserassertie.

### Slice 2 — pure kandidaat-resolver (RED → GREEN)

- **RED:** voeg een matrix toe voor unieke ID, uniek path, wikilink met dezelfde
  ID/path-persoon, wikilink met verschillende ID/path-personen, unresolved
  wikilink met toevallig gelijk ID en duplicate ID.
- **GREEN:** implementeer de typed resolver zonder `obsidian`-import en zonder
  first-match-mapgedrag; maak kandidaatpaden stabiel en sorteerbaar.
- **Bewijs:** pure unit-testresultaten en typecheck vóór integratie in graph/index.

### Slice 3 — full graph en graph-delta (RED → GREEN)

- **RED:** voeg het exacte A=`Bob`, B=`People/Bob.md`,
  `to: [[Bob]]`-scenario toe voor zowel rich relationship als gewone contactedge;
  de bestaande code moet aantonen dat zij A kiest of geen gedeelde uitkomst heeft.
  Voeg delta-equivalentieasserties toe.
- **GREEN:** routeer `buildAtlasSnapshot` en `applyGraphDelta` door dezelfde
  resolver; publiceer bij ambiguity alleen `ambiguous-person-reference`, geen
  edge en geen ghost-edge.
- **Bewijs:** `test/build-snapshot.test.ts`, `test/graph-delta.test.ts` en de
  relevante generated graph-invarianttest.

### Slice 4 — contactmomenten en indexpariteit (RED → GREEN)

- **RED:** voeg een contactmomentconflict toe dat dezelfde wikilink/pad/ID-
  kandidaten gebruikt; verwacht non-actionable gedrag en de bestaande
  contextspecifieke ambiguity-diagnostic. Bewijs ook dat een unieke same-person
  wikilink geldig blijft.
- **GREEN:** vervang de lokale kandidaat-unie in `IndexState` en de
  contactmomentprojectie door de gedeelde resolver; behoud
  `ambiguous-contact-moment-person`/`ambiguous-contact-moment-relationship` waar
  de context dat vereist.
- **Bewijs:** `test/index-state.test.ts`,
  `test/generated/contact-moment-index-invariants.generated.test.ts` en de
  contactmomentprojectieasserties in `test/build-snapshot.test.ts`.

### Slice 5 — integrale regressie en kwaliteitsrails (RED → GREEN)

- **RED:** laat de volledige gerichte identity/graph/indexset draaien op de
  laatste code en herstel alleen contractdrift die door de nieuwe typed
  referentievelden wordt veroorzaakt; bescherm iedere bestaande
  unresolved/filtered/duplicate assertion.
- **GREEN:** voer de volledige gerichte set, typecheck, format/lint en daarna de
  repository-gate uit. Start onafhankelijke review pas op de definitieve
  source/testsnapshot; iedere reparatie maakt review- en gate-evidence stale.
- **Bewijs:** actuele command-output in dit ticket, niet alleen een samenvatting
  van de uitvoerder.

## Journal

- 2026-08-10: User report and source inspection confirmed a high-priority,
  medium-risk identity collision: `src/graph/build-snapshot.ts` and
  `src/graph/graph-delta.ts` resolve an exact ID before a resolved link path.
- 2026-08-10: Source inspection confirmed that `src/index/index-state.ts` already
  collects ID/path candidates for contact moments, but this logic is not the
  shared resolver used by graph full/delta paths.
- 2026-08-10: Source inspection confirmed that relationship/contact-moment
  references receive `resolvedPath` at the parser boundary, while ordinary
  `person.contacts` currently retain only `parsePersonReference()` output.
- 2026-08-10: Existing `test/index-state.test.ts` covers a path/ID conflict for
  contact moments, but no focused graph regression models the exact
  `person_id: Bob` versus `[[Bob]] -> People/Bob.md` scenario.
- 2026-08-10: User ratified the one-ticket shape and the three reference
  precedence/classification decisions before this ticket was opened.
- 2026-08-10: This turn authors only 10x records. Product source, tests and build
  were not changed or executed; implementation requires a separately authorized
  execution turn.
- 2026-08-10: In the authorized execution turn, the four vertical TDD slices
  were implemented. The shared pure resolver now serves parser/frontmatter,
  full graph, graph delta, IndexState and contact-moment projection; no vault
  notes or persistent identities were migrated or rewritten.
- 2026-08-10: Focused RED → GREEN evidence included resolver/path/ID tests,
  collision and no-ID-rescue regressions, generated invariant fixtures,
  duplicate ordinary-contact parity tests, hidden-source unresolved parity, and
  relative `.md` plus `resolvedPath` integration coverage.
- 2026-08-10: Independent read-only review findings were resolved on the final
  source/test snapshot. The final review verdict was PASS; earlier BLOCKED
  findings remain recorded as superseded implementation history.
- 2026-08-10: The first aggregate gate attempt exposed a contract-inconsistent
  integration fixture using a path-syntactic wikilink while expecting callback-
  only resolution. The fixture was corrected to use `[[Carol|Shared person]]`
  for the unresolved phase and `Carol` for the explicit runtime resolution;
  no production assertion was removed or weakened.
- 2026-08-10: The final pinned Node-24 gate, strict release contract and
  reproducibility checks passed; current evidence is recorded below and the
  ticket is closed.

## Blockers

Geen technische blocker binnen de gekozen scope. De implementatie, onafhankelijke
review en actuele lokale Node-24-gate zijn groen.

Niet gecertificeerd door deze lokale gate: native Obsidian Desktop/Mobile,
remote CI/release, live vaultgedrag en externe publicatie. De lokale
editor/mutation-resolver in `src/domain/partner-parent-confirmation.ts` valt
buiten de expliciete exclusions van de actieve spec (§218-228).

De record-authoring-only blocker uit de historische journalentry hierboven is
superseded door de geautoriseerde uitvoering en de actuele evidence hieronder.

## Evidence

### Historical record-authoring evidence

- **Source observation, 2026-08-10:** `src/domain/types.ts` bevatte nog geen
  referentiesoort; `src/domain/wikilink.ts` retourneerde alleen `raw`, `target`
  en optioneel `label`.
- **Source observation, 2026-08-10:** `src/index/frontmatter.ts` gebruikte de
  Obsidian-linkresolutie voor relatie- en contactmomentreferenties, maar
  `person.contacts` mapte direct vanaf `parsePersonReference`.
- **Source observation, 2026-08-10:** `src/graph/build-snapshot.ts` en
  `src/graph/graph-delta.ts` hadden ID-first branches; `src/index/index-state.ts`
  verzamelde wel meerdere contactmomentkandidaten maar buiten een gedeelde pure
  resolver.
- **Source observation, 2026-08-10:** bestaande tests bewezen duplicate-ID-
  bescherming en contactmomentconflicten, maar niet de gevraagde graph-
  wikilinkcollision.
- **Environment observation, record-authoring phase:** de repository was vóór
  de productwijzigingen clean op `main` en volgde `origin/main`; dit was geen
  productgate-evidence.
- **Historical validation limit:** in de oorspronkelijke recordsfase waren geen
  producttests, build, lint, typecheck, onafhankelijke review of Node-24-gate
  uitgevoerd. Deze beperking is door de actuele evidence hieronder opgeheven.

### Current implementation and review evidence — 2026-08-10

- Runtime voor alle actuele gatecommando's: **Node v24.19.0**, **npm 11.16.0**.
- Focused consumer set:
  `npx vitest run --project node test/person-reference-resolver.test.ts
  test/build-snapshot.test.ts test/index-state.test.ts test/graph-delta.test.ts
  test/generated/contact-moment-index-invariants.generated.test.ts
  test/generated/snapshot-invariants.generated.test.ts
  test/generated/graph-delta-invariants.generated.test.ts
  --no-file-parallelism --maxWorkers=1` → **7 files / 235 tests passed**.
- Final integration rerun:
  `node scripts/run-integration-tests.mjs` → **9 files / 39 tests passed**.
- De actuele onafhankelijke read-only review na de laatste testfixturepatch gaf
  **PASS**. De eerdere BLOCKED-findings betroffen `resolvedPath`-path evidence,
  duplicate ordinary contacts, hidden unresolved diagnostics en full/delta-
  cardinaliteitspariteit; alle findings zijn met tests en sourcepatches opgelost.

### Current formal gate evidence — 2026-08-10

- `npm run format:check` → exit 0; **191 files**, no fixes.
- `npm run lint` → exit 0; één bestaande warning en één bestaande info op
  `test/browser/relationship-modal.browser.test.ts:254` en
  `test/obsidian-stub.ts:207`, buiten de gewijzigde hunks.
- `npm run typecheck` → exit 0.
- `npm run test` → exit 0:
  - Node: **57 files / 991 tests passed**;
  - browser Chromium: **12 files / 171 tests passed**;
  - integration Chromium: **9 files / 39 tests passed**;
  - Chromium DPR matrix: **DPR 1: 2/2, DPR 1.5: 2/2, DPR 2: 2/2**.
  - De bekende `fake-vitest.mjs` `MODULE_NOT_FOUND`-stacktrace is de
    opzettelijke child-processcase in `test/integration-runner.test.ts`; de
    parent rapporteert 5 geslaagde tests en het aggregatecommando eindigde met
    exit 0.
- `npm run build` → exit 0; officiële production build geslaagd.
- `npm run community:check` → exit 0; community readiness passed, **75 source
  files** geïnspecteerd.
- `npm run dependency:audit` → exit 0; **0 vulnerabilities**.
- `npm run release:contract -- --tag 0.12.2` → exit 0; strict contract passed,
  `main.js` **441878 bytes**, assets `main.js`, `manifest.json`, `styles.css`.
- `npm run verify:reproducible` → exit 0; beide builds leverden SHA-256
  `227dd2cbb30237686254d9e83732f382ff81dabb291923adceca39f2aa429e06`.
- `git diff --check HEAD` → exit 0 na de volledige productgate. De build liet
  alleen de volgens `.gitignore` genegeerde `main.js` en `main.js.map` achter.

De eerste aggregate-testpoging vóór de laatste fixturecorrectie faalde op één
contract-inconsistente integrationassertion; die historische failure is niet
als groen evidence gebruikt. Na correctie van de fixture naar een niet-path-
syntactische unresolved wikilink en aangepaste callbacktarget zijn de volledige
integration-runner en de volledige aggregate-gate opnieuw groen uitgevoerd.

## Review

**PASS — onafhankelijke read-only implementation review, 2026-08-10.** De
review draaide op de definitieve source/testsnapshot na de laatste
integration-fixturecorrectie en controleerde parser/frontmatter, de pure shared
resolver, ordinary contacts, full snapshot, graph delta, IndexState,
contactmomenten, rich relationship endpoints, generated invariants en de
ID/path-collisionsemantiek.

De review bevestigde dat de fixturecorrectie geen productassertie verwijderde
of verzwakte. De resterende grenzen zijn expliciet: geen native Obsidian
Desktop/Mobile-validatie, geen remote CI/release/publicatie en geen validatie
van de uitgesloten editor/mutation-resolver.

## Retrospective

- De juiste grens is één Obsidian-onafhankelijke resolver die path- en
  ID-evidence verzamelt, op canoniek bestandspad dedupliceert en conflicten
  fail-closed maakt. Alle graph-, delta-, index- en contactmomentconsumers
  gebruiken die grens nu.
- Full/delta-pariteit vereist niet alleen dezelfde resolverstatus, maar ook
  dezelfde ID-cardinaliteit. De full builder gebruikt daarom een edge-map en
  dedupliceert ordinary-contact diagnostics op ID, gelijk aan delta.
- Generated fixtures moeten hun semantische referentietype modelleren; een
  universele wikilinkfixture produceerde ongeldige `resolvedPath`-aannames.
- De aggregate gate vond aanvullende contractdrift in een bestaande
  integrationfixture. De fixture is aangepast aan de normatieve literal-path-
  regel, zonder productiegedrag of assertions te verzwakken.
- Er zijn geen vaultwrites, migraties, automatische renames, nieuwe
  persistente IDs of externe releasewrites uitgevoerd.
