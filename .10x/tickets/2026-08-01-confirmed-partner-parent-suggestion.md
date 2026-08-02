Status: done
Created: 2026-08-01
Updated: 2026-08-02

# PPA2 — Bevestigde partner-oudervraag

Parent: `.10x/tickets/2026-08-01-partner-parent-confirmation-plan.md`
Depends-On: `.10x/tickets/2026-08-01-partner-simple-relationship.md`

## Scope

Na een succesvolle nieuwe expliciete parent-child-create bepaalt People Atlas
puur of de parent precies één canonieke, niet-beëindigde partner met exact
`partner`/`partner` heeft. Alleen dan verschijnt één toegankelijke vraag of die
partner ook ouder van het kind is. De positieve actie opent de bestaande
relatie-editor vooraf ingevuld voor de partner en het kind; uitsluitend diens
tweede Save mag de tweede relatienotitie schrijven.

### Reparatiebeperking (2026-08-02)

Deze hersteluitvoering completeert uitsluitend twee reeds aangeroepen,
ontbrekende lokale pure guards in `src/domain/partner-parent-confirmation.ts`:
Markdown-notitiepaden volgens het lokale patroon en de exact toegestane runtime
relationship-statussen `undefined`, `active`, `dormant` en `ended`. De enige
andere wijziging is een door de formatter vereiste, semantiekvrije
regeleindewijziging in dezelfde PPA2-bron. Er zijn geen imports, I/O,
plannerverbreding, PPA1-records, parent-plan, dependencies, lockfiles of
ongerelateerde productcode gewijzigd.

### Aanvullende reviewreparatie (2026-08-02)

Deze opvolging wijzigt uitsluitend de lokale PPA2-planner zodat één getrimde
relationship-ID zowel de niet-lege validatie als de duplicate-suppressie stuurt.
Zij voegt alleen gerichte PPA2-testdekking toe voor whitespace-gedupliceerde
relationship-IDs, een werkelijk ambigu endpoint, geïsoleerde exact-duplicate
IDs met verschillende Markdown-notitiepaden en een zichtbare mislukte tweede
Save. Geen path- of plannersemantiek, imports, I/O, writes, index, renderer,
graph, schema, settings, PPA1-records, parent-plan, dependencies of lockfiles
zijn gewijzigd.

## Non-goals

- Een partner-ouderrelatie automatisch schrijven, wijzigen of verwijderen.
- Kandidaten opslaan, als graph-edge renderen, als diagnostic tonen of na een
  reload/herhaalde selectie opnieuw afspelen.
- Partnerherkenning via vrije types, template-IDs/-namen, displaynamen,
  `wife`/`husband`, gender, pronouns, My person, center, gedeelde ouders of
  grafbuurt.
- Een partnerkiezer voor meerdere partners, generalized kinship, sibling- of
  andere familie-inferentie, score/ML/LLM of netwerktoegang.
- Nieuwe settings, frontmattervelden, migraties, bulkupdates, commit, push,
  release of live-hostcertificering.

## Acceptance criteria

- [x] Een pure helper/planner zonder Obsidian-import of I/O bepaalt alleen
      geldige partner-ouderkandidaten uit canonieke people/relationshipdata.
- [x] Kandidaatbepaling accepteert uitsluitend nieuwe parent-child-creaties,
      exact één unieke partnerpersoon via `partner`/`partner`, status niet
      `ended`, en geen bestaand partner-child-parentpaar.
- [x] Ambigue, ghost, filtered, self, unresolved, ended, nul- of
      multi-partnergevallen, vrije metadata en bestaande tweede
      ouderrelaties geven geen voorstel en geen write.
- [x] Na één geldige eerste create opent precies één owning-document-modal met
      partner/ouder-taal, aanleiding, `Review relationship` en `Not now`.
- [x] Review relationship opent de bestaande create RelationshipModal met
      partner eerst, kind tweede en exact `parent`/`child`; alle reguliere
      velden blijven door de gebruiker wijzigbaar.
- [x] Alleen de expliciete tweede Save gebruikt de bestaande mutation boundary
      en hercontroleert actuele canonical endpoints/identiteit/path. Een stale
      kandidaat kan geen tweede note opleveren.
- [x] Not now, Cancel, Escape, backdrop, directe close, failed second Save en
      second-editor close zijn extra-write-free; de succesvolle eerste relatie
      blijft behouden zonder retry of compensatie.
- [x] Geen settings-, migration-, index-, renderer- of graphcontractwijziging
      voegt een persistent voorstel of synthetische edge toe.
- [x] Pure tests bewijzen elke kandidaatvoorwaarde en duplicate-suppressie;
      browsertests bewijzen modalcopy, controls, bevestiging, dismiss/directe
      close, focus/lifecycle en narrow reflow; integratietests bewijzen de
      entrypoint- en bestaande mutationgrens.
- [x] `npm run test`, `npm run build` en `git diff --check` slagen.

## Likely implementation boundaries

- een kleine pure kandidaatplanner onder `src/domain/` of `src/graph/`;
- het bestaande create-successresultaat/callback-seam van
  `src/editor/relationship-form.ts` en `src/editor/relationship-modal.ts`;
- de modal- en action-orchestratie in `src/main.ts` of een smalle editor-modal
  die uitsluitend de publieke hostgrens gebruikt;
- gerichte tests naast de bestaande simple relationship-, relationship modal-,
  entrypoint- en integratietests.

De planner mag niet in de renderer of index terechtkomen. Als uitvoering toch
nieuwe settings, parsers, graphrecords, een tweede mutation store of een
algemene modalabstractie nodig maakt, stopt de executor en keert terug naar
shaping.

## References

- `.10x/specs/partner-parent-confirmation.md`
- `.10x/decisions/partner-parent-confirmation.md`
- `.10x/tickets/2026-08-01-partner-simple-relationship.md`
- `.10x/specs/simple-relationship-automation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `src/domain/types.ts`
- `src/editor/relationship-form.ts`
- `src/editor/relationship-modal.ts`
- `src/main.ts`
- `src/mutations/atlas-mutation-service.ts`
- `test/relationship-entrypoints.test.ts`
- `test/browser/relationship-modal.browser.test.ts`
- `test/integration/people-atlas-plugin.integration.test.ts`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: alleen de expliciete canonieke Partner-semantiek telt;
  bestaande vrije metadata wordt niet als partner gegokt.
- User-ratified: één niet-beëindigde partnerpersoon geeft één voorstel; bij
  meer dan één partner wordt niets geselecteerd of getoond.
- User-ratified: de positieve actie opent de gewone vooraf ingevulde editor en
  vereist een eigen tweede Save.
- Record-backed: de bestaande mutation service valideert elke create opnieuw,
  en renderer/index mogen geen vaultdata lezen of eigen relatieopslag krijgen.

## Blockers

None. PPA1 is volledig groen en onafhankelijk gereviewd gesloten; de gebruiker
autoriseerde op 2026-08-01 PPA1 én PPA2. Commit, push en release blijven buiten
die autorisatie.

## Journal

- 2026-08-01: Ticket geopend in shaping en onmiddellijk geblokkeerd op PPA1.
  De gebruiker ratificeerde één exacte Partner-semantiek, onderdrukking bij
  meerdere/eindigde partners en een tweede expliciete Save.
- 2026-08-01: Broninspectie bevestigde dat de huidige create-modal na success
  sluit en de relatienotitie opent, en dat de bestaande mutation service al
  de valide creategrens bezit. De nieuwe hulp krijgt daarom alleen een
  post-success UI-orchestratieseam en geen tweede store of graphwijziging.
- 2026-08-01: Geen productcode, test, build, vaultdata, commit, push of
  externe status gewijzigd.
- 2026-08-01 (dependency): PPA1 sloot na een onafhankelijke read-only review
  met verdict `passed: true` en zonder security- of logic-findings. Dit ticket
  is daardoor actief; de canonieke `partner`/`partner`-semantiek is beschikbaar
  als enige toegestane partnerbron.
- 2026-08-02 (systematische root-cause): herhaalde eerst de strakke node-loop.
  Alle 18 planner-tests faalden vóór hun assertions met dezelfde
  `ReferenceError: isMarkdownPath is not defined` vanuit
  `canonicalPeople()` op regel 97. De rode build bevestigde precies drie
  `TS2304`-fouten: `isMarkdownPath` op regels 97 en 133 en
  `isKnownRelationshipStatus` op regel 134. De eerder ingevoegde fail-closed
  callsites bestonden dus, maar hun twee lokale definities ontbraken; dit was
  een incomplete guard-toevoeging, geen nieuw plannerontwerp.
- 2026-08-02 (TDD/herstel): de bestaande 18 planner-tests waren de rode
  regressietest, waaronder corrupt-status en niet-Markdown-notitiepaden. Voeg
  uitsluitend `isMarkdownPath()` volgens het lokale indexpatroon en
  `isKnownRelationshipStatus()` met de exacte vier toegestane waarden toe.
  Geen testassertion is verzwakt of gewijzigd.
- 2026-08-02 (format): een gerichte Biome-check meldde alleen een verplichte
  regeleindewijziging voor `samePartnerParentCandidate()` in dezelfde
  PPA2-bron. Die semantiekvrije formattering is toegepast en daarna zijn de
  gerichte en volledige gates opnieuw uitgevoerd.
- 2026-08-02 (grenzen): geen PPA1-record, parent-plan, dependency, lockfile of
  ongerelateerde code gewijzigd; geen commit, push, release, externe write of
  live Obsidian/vaultactie uitgevoerd.
- 2026-08-02 (onafhankelijke review): de read-only PPA2-review stelde vast dat
  `canonicalRelationships()` `record.id.trim()` wel op niet-leeg controleerde,
  maar ongetrimde IDs in de duplicate-set opsloeg. Daardoor bleven
  `relationship-1` en ` relationship-1 ` met verschillende geldige
  Markdown-notitiepaden verschillend en kon corrupt input alsnog een kandidaat
  opleveren. De review wees daarnaast op ontbrekende directe dekking voor een
  werkelijk ambigu endpoint en voor een mislukte tweede expliciete Save.
- 2026-08-02 (TDD RED): voegde eerst drie pure plannerasserties toe. De
  gerichte node-loop faalde uitsluitend op de whitespace-duplicatecase:
  1 failed, 19 passed van 20; de planner gaf de Alex/Sam/Robin-kandidaat terug
  waar `undefined` contractueel vereist is. De werkelijk ambigue endpointcase
  en de geïsoleerde exact-duplicate-ID-case met verschillende paden waren groen
  en sluiten respectievelijk de ambigue- en path-guard uit als verklaring.
- 2026-08-02 (minimale GREEN): één lokale `const id = record.id.trim()` voedt
  nu zowel de niet-lege check als `ids.has()` en `ids.add()`. Dezelfde node-loop
  werd groen: 1 bestand, 20 tests. Er is geen path- of plannerverbreding gedaan.
- 2026-08-02 (mislukte tweede Save): de integratieharnas registreert nu alleen
  werkelijk geslaagde mutation-resultaten en confirmation-openingen. Na de
  eerste create en `Review relationship` laat een tweede Save regulier falen;
  de fout blijft zichtbaar in de tweede editor, alleen de eerste create is
  geslaagd, en er volgen geen derde mutation-call, nieuw voorstel of retry. Die
  nieuwe integratietest was bij de eerste uitvoering groen, omdat dit bestaande
  failuregedrag al aan het contract voldeed; de ontbrekende dekking vergde geen
  productreparatie.
- 2026-08-02 (formatter en gates): Biome meldde alleen semantiekvrije
  regeleindewijzigingen in de twee gewijzigde PPA2-testbestanden. Na die
  correctie zijn formatter, alle gerichte PPA2-tests, de canonieke test- en
  buildgates opnieuw uitgevoerd. De reviewstatus blijft `pending` voor een
  nieuwe onafhankelijke read-only beoordeling; dit ticket blijft actief.

## Evidence

### RED — reproduceerbare root cause

- `export PATH=/home/nms/.local/node24/bin:$PATH && npm exec vitest -- run --project node test/partner-parent-confirmation.test.ts`
  (Node `v24.18.1`, npm `11.16.0`): `node test/partner-parent-confirmation.test.ts`
  — **1 failed bestand / 18 failed tests**; de stacktrace eindigt bij
  `ReferenceError: isMarkdownPath is not defined` op
  `src/domain/partner-parent-confirmation.ts:97`.
- `export PATH=/home/nms/.local/node24/bin:$PATH && npm run build`:
  typecheck rood met exact drie fouten: `TS2304 Cannot find name
  'isMarkdownPath'` op `97,24` en `133,5`, plus `TS2304 Cannot find name
  'isKnownRelationshipStatus'` op `134,5`.

### GREEN — minimale guardreparatie

- Dezelfde node-command na de twee pure lokale helpers: `node
  test/partner-parent-confirmation.test.ts` — **1 passed bestand / 18 passed
  tests**.
- `npm run build` na de reparatie: `npm run typecheck` en
  `npm run build:production` voltooid met exit 0.

### Gerichte PPA2-evidence na de formatterherhaling

Alle commands gebruikten opnieuw `PATH=/home/nms/.local/node24/bin:$PATH`.

- `npm exec vitest -- run --project node test/partner-parent-confirmation.test.ts`
  — project `node`, bestand `test/partner-parent-confirmation.test.ts`:
  **1 passed / 18 passed**.
- `npm exec vitest -- run --project browser
  test/browser/partner-parent-confirmation.browser.test.ts
  test/browser/partner-parent-relationship-modal.browser.test.ts` — project
  `browser (chromium)`, **2 passed bestanden / 5 passed tests**.
- `npm exec vitest -- run --project integration
  test/integration/partner-parent-confirmation.integration.test.ts` — project
  `integration (chromium)`, **1 passed bestand / 3 passed tests**.

Deze bestanden dekken de pure kandidaatvoorwaarden, duplicate-suppressie,
modalcopy/controls/focus/closepaden, de vooraf ingevulde tweede editor en de
create-success/mutation-boundary. Ze zijn test-evidence; zij zijn geen claim
van live Obsidian- of vaultcertificering.

### Volledige canonieke lokale gates na de formatterherhaling

- `npm run test` exit 0:
  - `node`: **48 passed bestanden / 693 passed tests**;
  - `browser (chromium)`: **10 passed bestanden / 80 passed tests**;
  - `integration (chromium)`: **7 passed bestanden / 17 passed tests**;
  - `browser-matrix`: **3 passed bestanden / 6 passed tests**.
- `npm run build` exit 0: `tsc --noEmit` en
  `node esbuild.config.mjs production` geslaagd.
- `git diff --check` exit 0 zonder uitvoer. Limiet: de PPA2-bron en dit ticket
  waren op het moment van de gate nog untracked en vallen daarom niet onder
  Git's tracked diff; de gerichte formattercheck hieronder dekt de bron wel.
- `npm exec biome -- check --formatter-enabled=true --linter-enabled=false
  --assist-enabled=false src/domain/partner-parent-confirmation.ts` exit 0:
  `Checked 1 file ... No fixes applied.`

### Aanvullend reviewherstel — runtime, RED en GREEN

Alle npm-opdrachten in deze opvolging gebruikten
`PATH=/home/nms/.local/node24/bin:$PATH`, met Node `v24.18.1` en npm `11.16.0`.

- RED — `npm exec vitest -- run --project node
  test/partner-parent-confirmation.test.ts` exit 1: **1 failed bestand; 1
  failed, 19 passed van 20 tests**. Alleen
  `relationship-IDs alleen in voor- of naloopspaties verschillen` faalde; de
  ontvangen planneruitkomst was de Alex/Sam/Robin-kandidaat in plaats van
  `undefined`. De twee andere nieuwe pure cases passeerden: de exact-duplicate
  ID met verschillende Markdown-paden en een werkelijk ambigu partnerendpoint.
- GREEN — dezelfde node-opdracht na de ene getrimde lokale ID-variabele: **1
  passed bestand / 20 passed tests**, exit 0.
- De nieuwe integratietest voor de mislukte tweede Save draaide meteen groen,
  omdat de bestaande editor/mutation-boundary de fout al regulier retourneerde:
  **1 passed bestand / 4 passed tests**, exit 0. De test bewijst de zichtbare
  fout, één geslaagde eerste relatie, precies twee mutation-pogingen en geen
  extra confirmation, retry of automatische write.

### Gerichte PPA2-evidence na formatterherhaling

- `npm exec biome -- check --formatter-enabled=true --linter-enabled=false
  --assist-enabled=false src/domain/partner-parent-confirmation.ts
  test/partner-parent-confirmation.test.ts
  test/integration/partner-parent-confirmation.integration.test.ts` exit 0:
  **3 bestanden gecontroleerd, geen fixes**. Vooraf meldde Biome uitsluitend
  twee semantiekvrije formatfouten in de twee gewijzigde testbestanden; die zijn
  gecorrigeerd en de gerichte loops zijn herhaald.
- Node — `npm exec vitest -- run --project node
  test/partner-parent-confirmation.test.ts`: **1 passed bestand / 20 passed
  tests**, exit 0.
- Browser — `npm exec vitest -- run --project browser
  test/browser/partner-parent-confirmation.browser.test.ts
  test/browser/partner-parent-relationship-modal.browser.test.ts`: **2 passed
  bestanden / 5 passed tests**, exit 0.
- Integratie — `npm exec vitest -- run --project integration
  test/integration/partner-parent-confirmation.integration.test.ts`: **1 passed
  bestand / 4 passed tests**, exit 0.

### Volledige lokale gates na formatterherhaling

- `npm run test` exit 0:
  - node: **48 passed bestanden / 695 passed tests**;
  - browser (chromium): **10 passed bestanden / 80 passed tests**;
  - integratie (chromium): **7 passed bestanden / 18 passed tests**;
  - browser-matrix: **3 passed bestanden / 6 passed tests**.
- `npm run build` exit 0: `tsc --noEmit` en
  `node esbuild.config.mjs production` geslaagd.
- `git diff --check` exit 0 zonder uitvoer.
- Voor elk untracked PPA2-source-, test- en ticketbestand leverde
  `git diff --no-index --check /dev/null <bestand>` uitsluitend de verwachte
  add-only exitcode 1 en geen whitespace-uitvoer op: deze PPA2-ticket, de
  plannerbron, de confirmation-modalbron, de pure planner-test, beide
  browsertests en de integratietest.

Deze geautomatiseerde node/browser/integratie-evidence is geen claim over een
live Obsidian- of vaultomgeving.

### Format-only eindherhaling — 2026-08-02

Alle npm-opdrachten hieronder gebruikten
`PATH=/home/nms/.local/node24/bin:$PATH`; de feitelijk gebruikte runtime was
Node `v24.18.1` met npm `11.16.0`.

- RED — `npm run format:check` exit 1: Biome controleerde 155 bestanden en
  meldde precies één fout, uitsluitend `src/main.ts`. De enige voorgestelde
  wijziging was de import van `RelationshipModal`,
  `RelationshipCreateSuccess` en `RelationshipTemplateCreation` van één regel
  naar de projectstandaard multi-line vorm; `No fixes applied.`
- GREEN — uitsluitend `npm exec -- biome format --write src/main.ts` draaide:
  `Formatted 1 file ... Fixed 1 file.` De herhaalde `npm run format:check`
  eindigde met exit 0: `Checked 155 files ... No fixes applied.`
- Scopelimiet — de pre/post formatter-output bevestigt dat deze executor alleen
  die ene import-layout in `src/main.ts` veranderde. De actuele diff tegen
  `HEAD` bevat daarnaast reeds aanwezige PPA2-lifecyclewijzigingen; die zijn
  niet door deze formatteruitvoering gemaakt of gewijzigd.
- Volledige canonieke gate — `npm run check` exit 0: formatter (155 bestanden),
  linter (155 bestanden), `tsc --noEmit`, alle testprojecten, production build,
  release-contract en community-readiness zijn geslaagd. Testaantallen:
  `node` **48 bestanden / 695 tests**, `browser (chromium)` **10 / 80**,
  `integration (chromium)` **7 / 18** en `browser-matrix` **3 / 6**. Het
  release-contract bevestigde `0.5.0`, `main.js` 350158/409600 bytes en de
  vereiste assets; community-readiness inspecteerde 57 sourcebestanden.
- Whitespace gates — `git diff --check` exit 0 zonder uitvoer. Voor elk
  huidig untracked PPA2-source-, test- en ticketbestand hieronder gaf
  `git diff --no-index --check /dev/null <bestand>` de verwachte add-only
  exitcode 1 zonder whitespace-uitvoer: deze ticket, de plannerbron, de
  confirmation-modalbron, de pure planner-test, beide browsertests en de
  integratietest.

Deze format- en gate-evidence is lokale geautomatiseerde evidence; zij doet
geen live Obsidian- of vaultclaim.

## Review

De eerste onafhankelijke read-only PPA2-review wees terecht de
whitespace-duplicate-ID-guard en twee ontbrekende contracttests af. De
opvolgende onafhankelijke re-review op 2026-08-02 retourneerde `passed: true`:
geen security concerns of logic errors; de getrimde relationship-ID stuurt nu
consistent de duplicatecontrole en de actuele scoped diff bleef binnen de
planner-, modal- en mutationgrenzen. De re-review suggereerde alleen extra
toekomstige regressiedekking voor whitespacevarianten van duplicate
`person_id`; de bestaande planner canonicaliseert die waarden al consequent en
de exacte duplicate-person-ID-case blijft gedekt. Dit is geen open defect of
blocker. De latere Biome-correctie veranderde uitsluitend importopmaak in
`src/main.ts` en heropende de semantische beoordeling niet.

Status `done`: onafhankelijke review, gerichte tests en de canonieke lokale
eindgate zijn positief. Resterende beperking: de evidence is geautomatiseerd
en lokaal; er is geen live Obsidian- of vaultcertificering geclaimd.

## Retrospective

De guard-callsite was al terecht fail-closed, maar een onvoltooide lokale
helperdefinitie maakte de hele planner onuitvoerbaar. De specifieke
node-test leverde een snelle, deterministische RED-loop; de build legde de
volledige set van drie ontbrekende identifiers vast. Vergelijken met de
bestaande Markdown- en statuspatronen voorkwam nieuwe semantiek. Een gerichte
formattercheck vond één pre-existente regeleindeconventie; na de
semantiekvrije correctie zijn alle relevante PPA2- en lokale gates herhaald.
Resterende beperking: alleen geautomatiseerde lokale node/browser/integratie-
evidence is verzameld; er is geen live Obsidian/vaultclaim gedaan.

De reviewopvolging liet zien dat normaliseren in slechts één deel van een
invariant onvoldoende is: de geaccepteerde relatie-ID moet dezelfde getrimde
waarde zijn voor niet-leegvalidatie én duplicate-suppressie. Een exact-duplicate
test moet verschillende geldige paden gebruiken; anders kan de path-guard de
ID-guard ongemerkt maskeren. Voor contractuele ambiguititeit moet de fixture
werkelijk twee canonieke kandidaten opleveren, niet alleen een ontbrekend pad.
De mislukte tweede-Savecase vereiste geen tweede productiecorrectie, maar de
integratietest legt nu de zichtbare reguliere fout en het uitblijven van retry,
nieuw voorstel en extra write vast. Resterende beperking blijft uitsluitend
automatische lokale node/browser/integratie-evidence; live Obsidian/vault is
niet beoordeeld.
