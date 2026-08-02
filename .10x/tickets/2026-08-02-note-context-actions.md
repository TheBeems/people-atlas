Status: done
Created: 2026-08-02
Updated: 2026-08-02

# Note-contextacties in leesweergave

## Scope

Implementeer `.10x/specs/note-context-actions.md` als één begrensde
leesweergave-integratie:

- registreer een lifecycle-veilige Markdown-postprocessor;
- render één automatische native editknop voor een exact canonieke persoons-
  of relatienotitie;
- routeer elke klik naar de bestaande path-gebaseerde editor-entrypoint;
- breid uitsluitend het gecontroleerde Obsidian-testharnas en relevante tests
  uit om de hostintegratie, lifecycle en stale veiligheid te bewijzen.

## Non-goals

- Live Preview, brontekst of CodeMirror.
- Een extra atlasview, graphselectie, relationeel overzicht in een
  persoonsnotitie of een nieuwe modal/mutation-service.
- Contactmomentacties, inline-editing, verwijderen, hernoemen, bulkbewerkingen
  of een dataschemaverandering.
- Commit, push, release, publicatie of live-vaultwrites buiten testharnas.

## Acceptance criteria

- [x] De plugin registreert precies één Markdown-postprocessor en dat wordt
      gecontroleerd door het hostharnas.
- [x] Een actuele, unieke canonieke persoonsnotitie krijgt eenmaal `Edit
      person`; een unieke canonieke relatienotitie eenmaal `Edit relationship`.
- [x] Gewone, inferred, stale of dubbelzinnige notities krijgen geen paneel.
- [x] De knoppen zijn native, toegankelijk en gebruiken het document van hun
      gerenderde sectie; hun listeners worden via `MarkdownRenderChild`
      opgeruimd.
- [x] Elke klik hergebruikt exact de bestaande path-gebaseerde editroute;
      een stale klik opent geen fout record en schrijft niets.
- [x] Nieuwe tests volgen aantoonbare RED→GREEN-cycli en bewaken
      registratie, eenmaligheid, canonicaliteit, actie, stale gedrag en
      lifecycle.
- [x] `npm run test`, `npm run build` en `git diff --check` slagen met
      `/home/nms/.local/node24` vóór onafhankelijk review.
- [x] Een onafhankelijke review beoordeelt de finale scoped diff tegen de
      actieve spec; reviewfindings blokkeren closure totdat zij met een
      regressietest zijn gerepareerd en opnieuw onafhankelijk beoordeeld.
      **Review: pass.**

## References

- `.10x/specs/note-context-actions.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/specs/controlled-obsidian-integration-harness.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/main.ts`
- `test/obsidian-stub.ts`
- `test/integration/people-atlas-plugin.integration.test.ts`

## Assumptions

- User-ratified: automatische `Edit person`/`Edit relationship`-knoppen
  bestaan alleen in leesweergave.
- User-ratified: de knop opent rechtstreeks de bestaande People Atlas-editor;
  een aparte atlasweergave hoeft niet te openen.
- Record-backed: `ctx.sourcePath`, `ctx.docId`, `ctx.addChild()` en
  `MarkdownRenderChild` zijn publieke Obsidian-API's; de lokale
  `obsidian`-declaraties en officiële docs zijn op 2026-08-02 geraadpleegd.
- Record-backed: `openEditPerson(path)` en `openEditRelationship(path)`
  revalideren canonieke, actuele Markdown-identity vóór een editor opent.

## Blockers

None. De gebruiker ratificeerde de leesweergavevariant en autoriseerde de
implementatie in deze chat. De finale executor-gates en een nieuwe,
onafhankelijke read-only review zijn geslaagd.
## Journal

- 2026-08-02: Onderzoek in shaping bevestigde dat de huidige plugin al
  path-gebaseerde editors voor de actieve persoons- en relatienotitie heeft,
  maar geen in-note actiebalk. De officiële Obsidian API en lokale
  `obsidian.d.ts` bevestigen `registerMarkdownPostProcessor`, `sourcePath`,
  `docId` en lifecycle-owned `MarkdownRenderChild`.
- 2026-08-02: De gebruiker koos expliciet voor de lichte, automatische
  leesweergavevariant en autoriseerde implementatie. De actieve spec en dit
  uitvoerbare ticket zijn aangemaakt. Nog geen productcode, tests, build,
  vaultdata, commit, push of release gewijzigd.
- 2026-08-02: Ongepatchte baseline onder `/home/nms/.local/node24/bin/node`
  (`v24.18.1`, npm `11.16.0`): `npm run check` slaagde (exit 0). Formatter en
  lint controleerden 155 bestanden zonder fixes; typecheck slaagde; test sloot
  af met Node 48 bestanden/695 tests, browser 10/80, integratie 7/18 en
  browser-matrix 3/6, allemaal groen; productiebuild, releasecontract en
  community-check slaagden. De tree bevatte alleen de twee al aanwezige,
  ongetrackte 10x-records voor dit ticket.
- 2026-08-02: RED-1 na uitsluitend de minimale publieke
  Markdown-postprocessorgrens in het gecontroleerde hostharnas en een nieuwe
  integratie-assertie: `npm run test:integration --
  test/integration/note-context-actions.integration.test.ts` faalde met exit
  1, 1 bestand/1 test. De werkelijke assertie was `expected +0 to be 1` voor
  `runtime.markdownPostProcessors.size`, dus de plugin registreerde nog geen
  postprocessor; geen import- of typefout.
- 2026-08-02: GREEN-1: hetzelfde gerichte integratiecommando slaagde (exit 0,
  1 bestand/1 test) nadat uitsluitend één lifecycle-geregistreerde
  leesweergave-postprocessor was toegevoegd. De unload-assertie bevestigde dat
  de registratie uit het gecontroleerde hostharnas verdween.
- 2026-08-02: RED-2: na uitbreiding van alleen het harnas met een gecontroleerde
  postprocessorrender/lifecycle en een volgende verticale integratie-assertie,
  faalde hetzelfde gerichte commando met exit 1 (1 bestand; 2 tests: 1 groen,
  1 rood). Een geïndexeerde canonieke persoon leverde `expected ... length of
  1 but got +0` voor `.people-atlas-note-actions`; de bestaande registratie
  deed nog geen contextuele render.
- 2026-08-02: GREEN-2: hetzelfde gerichte integratiecommando slaagde (exit 0,
  1 bestand/2 tests) nadat de postprocessor een actuele unieke canonieke
  persoonsnotitie als één native, gelabelde `Edit person`-knop in het
  sectie-eigendocument rendert, met één `MarkdownRenderChild` en docId-dedupe.
- 2026-08-02: RED-3: de volgende gerichte verticale actie-assertie faalde met
  exit 1 (1 bestand; 3 tests: 2 groen, 1 rood): na native klik was
  `openEditPerson` 0 keer aangeroepen in plaats van eenmaal. Dit bewees dat de
  knop nog geen path-gebaseerde editorroute activeerde; de renderende slice
  bleef groen.
- 2026-08-02: GREEN-3: hetzelfde gerichte commando slaagde (exit 0, 1
  bestand/3 tests) nadat de lifecycle-owned listener uitsluitend
  `openEditPerson(sourcePath)` aanroept. De integratie-assertie zag geen
  relatieroute en geen opgeslagen plugindata vóór Save.
- 2026-08-02: RED-4: de daaropvolgende relatie-actieassertie faalde met exit 1
  (1 bestand; 4 tests: 3 groen, 1 rood): native activering riep
  `openEditRelationship` 0 keer aan in plaats van eenmaal. De exacte
  relatieknop bestond al, maar de bestaande relatie-editorroute was nog niet
  gekoppeld.
- 2026-08-02: GREEN-4: hetzelfde gerichte commando slaagde (exit 0, 1
  bestand/4 tests) nadat de reeds lifecycle-owned listener voor
  relatiecontext uitsluitend `openEditRelationship(sourcePath)` aanroept; de
  test zag geen persoonsroute en geen write vóór Save.
- 2026-08-02: Aanvullende stale-regressie werd test-eerst toegevoegd en sloeg
  direct groen aan (exit 0, 1 bestand/5 tests), omdat de al bestaande
  path-gebaseerde relatie-entrypoint de verwijderde relatie opnieuw valideert.
  De test bewijst: geen `RelationshipModal`, geen write en herstelbare
  unavailable-feedback; er is geen kunstmatige RED gecreëerd.
- 2026-08-02: De negatieve classificatieregressie werd daarna test-eerst
  toegevoegd en sloeg direct groen aan (exit 0, 1 bestand/6 tests): gewone,
  niet-Markdown, ongeldige relatie- en dubbelzinnige persoonsbronpaden kregen
  ieder 0 render-children en geen actiepanel. Dit is het bestaande fail-closed
  effect van de actuele canonieke resolvers; geen kunstmatige RED.
- 2026-08-02: De pop-out/lifecycle-regressie werd test-eerst toegevoegd en sloeg
  direct groen aan (exit 0, 1 bestand/7 tests): elementcreatie bleef in het
  secundaire rendered document; na `MarkdownRenderChild`-unload deed de
  oude knop niets en kon hetzelfde docId opnieuw één child registreren. Dit
  bevestigt de reeds in de render/action-cycli gebruikte owner-document- en
  lifecyclegrens zonder een kunstmatige RED.
- 2026-08-02: CSS-RED (geen productie-CSS gewijzigd): na de nieuwe gerichte
  Chromium-integratieassertie voor de gerenderde native actie draaide
  `./node_modules/.bin/vitest run --project integration
  test/integration/note-context-actions.integration.test.ts` onder Node
  `v24.18.1` rood met exit 1, 1 bestand/8 tests (7 groen, 1 rood). De echte
  assertie was `expected 'block' to be 'flex'`; dus de CSS-assertie faalde
  inhoudelijk en niet wegens import- of typefout.
- 2026-08-02: CSS-GREEN: minimale `.people-atlas-note-actions`-styling voegt
  een wrapped flex-rij, Obsidian-size-variabelen, bestaande focus-visible
  accentstijl en een `--size-4-11` touch-doel toe. Dezelfde gerichte test
  slaagde met exit 0, 1 bestand/8 tests. Een eerste GREEN-run faalde alleen
  door een onvolledig harnas-token voor de actieve smalle/coarse mediaquery
  (`--size-4-11`, `auto` in plaats van `24px`); uitsluitend de testfixture
  kreeg dat bestaande Obsidian-token, waarna de productie-CSS groen was.
- 2026-08-02: `npm run check` stopte eerst bij formatter met uitsluitend twee
  semantiekvrije correcties: een ontbrekende CSS-inspringing en het door
  Biome vereiste meerregelige stub-signature. Na exact die correcties zijn
  de gerichte test, `npm run test`, `npm run build` en `npm run check` onder
  Node 24 opnieuw gedraaid en alle exits waren 0. Geen commit, push,
  release, dependency- of CodeMirror-wijziging gedaan.
- 2026-08-02: Een nieuwe onafhankelijke, read-only adversarial review
  inspecteerde de scoped diff, de actieve spec, dit ticket en de ongetrackte
  integratietest. Verdict: `pass`, zonder critical, significant of minor
  findings. Daarmee zijn alle acceptatiecriteria tegen hun vastgelegde
  executor-evidence en review gedekt; ticket gesloten. Geen commit, push of
  release geautoriseerd of uitgevoerd.

## Evidence

- Runtime: alle executorcommando's gebruikten expliciet
  `export PATH=/home/nms/.local/node24/bin:$PATH`; waargenomen
  `node=/home/nms/.local/node24/bin/node`, Node `v24.18.1` en npm `11.16.0`.
- Finale scoped diff gelezen: productie beperkt tot `src/main.ts` (één
  lifecycle-owned postprocessor, actuele canonieke resolutie, native
  owner-document DOM en bestaande path-entrypoints) en `styles.css`
  (note-action rij, focus en touchdoel); harnas beperkt tot
  `test/obsidian-stub.ts`; de nieuwe
  `test/integration/note-context-actions.integration.test.ts` telt 8
  scenario's. Geen dependency-, package-, CodeMirror- of out-of-scope
  productlogica in de diff.
- CSS-TDD: exact `./node_modules/.bin/vitest run --project integration
  test/integration/note-context-actions.integration.test.ts` leverde RED
  exit 1, 1 bestand/8 tests (7 groen, 1 rood) op de echte
  `block`→`flex` computed-style-assertie. Dezelfde lokale vitest-bin-aanroep
  leverde GREEN exit 0, 1 bestand/8 tests; de formatter-correctie is ook met
  dezelfde aanroep herbevestigd (exit 0, 1/8).
- Finale gates ná de semantiekvrije formatter-correcties:
  - `npm run test`: exit 0 — Node 48 bestanden/695 tests, browser 10/80,
    integratie 8/26 (waarvan note-context 1/8), browser-matrix 3/6.
  - `npm run build`: exit 0 — `tsc --noEmit` en productie-esbuild groen.
  - `npm run check`: exit 0 — formatter 156 bestanden zonder fixes, lint,
    typecheck, dezelfde vier testprojecten, productiebuild,
    releasecontract en community-check groen. Biome meldde één niet-blokkerende
    `lint/suspicious/noConfusingVoidType`-waarschuwing voor de nauwkeurige
    host-stub-returntype `Promise<unknown> | void`; de command-exit bleef 0.
  - `git diff --check`: exit 0.
  - `git status --short --branch`: alleen in-scope gewijzigd/ongetrackt:
    `src/main.ts`, `styles.css`, `test/obsidian-stub.ts`, de twee 10x-records
    en `test/integration/note-context-actions.integration.test.ts`.
  - `git diff --no-index --check /dev/null <path>` voor ieder van de spec,
    dit ticket en de nieuwe integratietest: ieder exit 1 als verwachte
    add-only-diff, zonder whitespace-uitvoer.
- Statische added-production-scan over 64 toegevoegde regels in `src/main.ts`
  en `styles.css`: 0 secret-like assignments, 0 `eval`/`new Function`, 0
  `exec`/`spawn`/`child_process`, 0 `shell: true` en 0
  `innerHTML`/`outerHTML`/`insertAdjacentHTML`.
- Automatische Chromium/harnas-evidence dekt de hostcontracten; live
  Obsidian-desktop/mobiel en echte assistive-technology-smoke blijven buiten
  deze gecontroleerde testomgeving.
- Onafhankelijke review: verdict `pass`; geen findings. De reviewer bevestigde
  Reading View-only API-gebruik, `docId`/`MarkdownRenderChild`-cleanup,
  actuele canonieke path/ID/TFile-resolutie, owner-document/native buttons,
  bestaande editor-entrypoints en de testdekking. Restrisico blijft beperkt
  tot niet-uitgevoerde live Desktop/Mobile/assistive-technology-smoke en de
  noodzakelijke afhankelijkheid van actuele index/metadata; de entrypoints
  herbevestigen bij activatie en falen gesloten.

## Review

**Pass.** Een nieuwe onafhankelijke, read-only reviewer inspecteerde de
finale scoped diff en de drie ongetrackte artefacten tegen de actieve spec.
Er zijn geen critical, significant of minor findings. De niet-blokkerende
Biome-waarschuwing voor het nauwkeurige host-stub-returntype is meegewogen;
geen product-, test- of recordwijziging volgde op dit verdict.
## Retrospective

- Een browserstijlassertie moet de gebruikte Obsidian-size-tokens expliciet in
  het gecontroleerde document zetten; de smalle/coarse testmediaquery gebruikte
  `--size-4-11`, niet alleen het reguliere `--size-4-6`.
- De bestaande `MarkdownRenderChild`-grens en path-gebaseerde entrypoints
  maakten deze integratie klein en stale-safe. Houd vervolgwerk bij de
  leesweergave-/hostgrens en breid niet uit naar Live Preview of CodeMirror.
- Geen nieuw zelfstandig knowledge- of skill-record toegevoegd: deze
  ticket-specifieke hostgrens is volledig vastgelegd in de actieve spec,
  uitvoeringstests en dit ticket, terwijl `AGENTS.md` en de bestaande
  controlled-integration-kennis de algemene lifecycle- en hostharnasregels
  al bevatten.
