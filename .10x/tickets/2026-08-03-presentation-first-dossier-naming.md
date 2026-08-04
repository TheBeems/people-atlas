Status: done
Created: 2026-08-03
Updated: 2026-08-04
Depends-On: None

# Presentation-first persoonsdossiernamen implementeren

## Outcome

Implementeer het fresh-vault naming- en ownershipcontract waardoor een nieuwe
persoon standaard een dossier met alleen de veilige weergavenaam krijgt en pas
bij een aantoonbare canonieke naamcollision een adaptieve, UUID-afgeleide
Crockford Base32-suffix vanaf twee tekens gebruikt.

## Scope

1. Vervang de altijd-zichtbare acht-hexsuffix door één gedeelde pure
   candidateplanner voor plain en collision-only dossiers.
2. Codeer de 16 UUID-bytes met de geratificeerde Crockford-alphabet
   byte-streamcodering en maak een herberekenbare, adaptieve prefix vanaf twee
   tekens.
3. Laat create-preview en mutation boundary dezelfde planningregels gebruiken;
   herbereken tegen actuele index/vaultstate en behoud de bestaande
   reviewed-path/TOCTOU-, transaction-ownership- en cleanupgrenzen.
4. Verplaats dossier-/fotoauthority van verplichte pathsuffixidentiteit naar
   unieke volledige `person_id` plus exact canoniek profielpad en veilige parent;
   behoud prefixvalidatie voor suffixed nieuwe-grammardossiers.
5. Behoud dossierpad bij profielrename en deletion; implementeer geen migration
   of compatibiliteit voor bestaande 0.8-mapnamen.
6. Werk uitsluitend direct getroffen source, tests, deze ticket-evidence en de
   noodzakelijke actieve contractverwijzingen bij.

## Implementation plan — vertical TDD

### Slice 1 — Pure naming and Base32 contract

- Voeg eerst assertion-grade RED-tests toe voor:
  - veilige presentation label en canonical collision key;
  - bekende UUID-byte→Crockford Base32-vectors;
  - suffixloze eerste candidate;
  - twee-teken collisioncandidate;
  - adaptieve uitbreiding bij bezette prefixes;
  - ongeldige naam/UUID en legacy `--<acht-hex>` grammar.
- Implementeer daarna de minimale pure candidate-API in de bestaande
  path/domainboundary. Voeg geen dependency toe.
- Run de volledige direct getroffen pure testfiles GREEN.

### Slice 2 — Reviewable create and mutation TOCTOU

- Schrijf RED-tests waarin preview een plain bestemming toont, een tweede
  canonieke naam de ` · XX`-bestemming toont en een collision na review nul
  writes plus de bestaande reviewed-path-fout geeft.
- Voeg regressies toe voor een ambigue/user-owned plain folder, een bezette
  korte prefix, een create-time race en transaction-owned empty-folder cleanup.
- Hergebruik één planner in modal/form en mutationservice; geen onafhankelijke
  pathregels of silent fallback.
- Run de volledige person-form-, modal-/browser- en mutationservicefiles GREEN.

### Slice 3 — Full-ID dossier/photo ownership

- Schrijf RED-tests voor plain en suffixed dossiers met dezelfde volledige-ID-
  authority, plus sibling, prefix-lookalike, legacy 0.8, missing, ambiguous,
  unsafe root/path en callback-time identity/path drift.
- Implementeer minimale fail-closed authority op uniek geïndexeerd profielpad +
  volledige `person_id`; leid photo-locality uitsluitend uit de geverifieerde
  parent af.
- Bewijs dat profielrename alleen het bestand binnen exact dezelfde parent
  hernoemt en dat bestaande suffixen nooit veranderen.
- Run alle direct getroffen node-, browser- en gecontroleerde integratieprojecten
  GREEN.

### Review and final gate

- Journaliseer per slice het exacte RED, minimale GREEN, testbestand/count en
  verificatielimiet.
- Laat daarna één onafhankelijke read-only adversariële review uitvoeren tegen
  spec, decision, diff en tests. Iedere echte finding blokkeert.
- Herstel findings uitsluitend met een nieuwe gerichte RED→GREEN en korte
  rereview.
- Run na semantische stabiliteit precies één volledige Node-24 gate:
  `npm run check`, `npm run build`, `npm run verify:reproducible` en
  `git diff --check`; herhaal alleen na een latere code-/testwijziging.
- Sluit dit ticket uitsluitend na review-PASS, groene actuele gate, scope- en
  securityhygiene. Commit/push/release blijven buiten scope.

## Non-goals

- Bestaande 0.8-dossiers herkennen, migreren, verplaatsen of hernoemen.
- Een centrale registry, teller, hidden metadata, Base58/Base85 of dependency.
- Automatische dossierrename, suffixverwijdering/-inkorting of promotie.
- Relatie-, contactmoment-, settings-, indexschema- of binary-lifecyclewijziging.
- Versiebump, changelog/releasenotes, commit, push, tag of release.
- Het bredere open `.10x/tickets/2026-07-24-people-atlas-v2-plan.md` uitvoeren.

## Acceptance criteria

- [x] Een unieke nieuwe naam plant exact
      `<root>/Profiles/<veilige-weergavenaam>/<veilige-weergavenaam>.md` zonder
      zichtbare ID-suffix.
- [x] Een aantoonbare canonieke naamcollision plant ` · <Base32-prefix>`, start
      met exact twee tekens en verlengt alleen de nieuwe kandidaat per bezette
      prefix.
- [x] UUID-bytecodering, alphabet, case, paddingloos resultaat en invalid-input-
      gedrag zijn pure, deterministische contracttests zonder dependency.
- [x] Preview en final mutation gebruiken dezelfde planner; actuele root-,
      identity-, ownership- of occupancydrift na review schrijft niets.
- [x] Ambigue/user-owned folders worden niet geadopteerd of stil omzeild;
      races en failures behouden externe/niet-lege inhoud en ruimen alleen een
      transaction-owned lege dossiermap op.
- [x] Plain en suffixed nieuwe-grammardossiers bewijzen ownership via exact één
      canoniek profielpad en volledige `person_id`; suffixed paden valideren ook
      de herberekende Base32-prefix.
- [x] Photo picker en mutation boundary accepteren alleen ondersteunde assets
      onder exact de geverifieerde dossierparent en falen gesloten voor sibling,
      lookalike, missing, stale, unsafe, ambiguous en legacy paden.
- [x] Rename/delete wijzigen geen dossierpad of bestaande suffix; relatie-,
      contactmoment- en binary-lifecycle blijven ongewijzigd.
- [x] Geen compatibility/migration/dual parser voor 0.8 `--<acht-hex>`-dossiers.
- [x] Iedere behaviorwijziging heeft assertion-grade RED→GREEN-evidence; alle
      getroffen suites, onafhankelijke review en één semantisch actuele volledige
      Node-24 gate zijn groen.
- [x] Diff bevat geen dependency-, lockfile-, workflow-, versie-, release- of
      andere productwijzigingen buiten de benoemde naming/ownershipseams.

## References

- `.10x/decisions/presentation-first-person-dossier-naming.md`
- `.10x/specs/presentation-first-person-dossier-naming.md`
- `.10x/specs/person-dossier-storage.md`
- `.10x/decisions/person-dossier-storage-layout.md`
- `.10x/tickets/2026-08-03-person-dossier-layout.md`
- `.10x/tickets/2026-08-03-dossier-local-photo-picker.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/domain/people-paths.ts`
- `src/editor/person-form.ts`
- `src/editor/person-modal.ts`
- `src/mutations/atlas-mutation-service.ts`
- `test/person-form.test.ts`
- `test/mutation-service.test.ts`

## Assumptions and provenance

- User-ratified 2026-08-03: suffixloos standaard; Base32 alleen bij collisions;
  prefix begint met twee tekens en groeit; fresh-vault-only zonder 0.8-support.
- Record-backed: volledige `person_id`, nooit displaynaam, blijft identiteit;
  vaultwrites zijn expliciet en ambiguity faalt gesloten.
- Mechanical: de Base32-specificatie gebruikt een byte-stream zodat de eerste
  twee tekens twee volledige 5-bitgroepen dragen; dit behoudt de bedoelde korte,
  gelijkmatig verdeelde prefix voor de huidige willekeurige UUID’s.
- Recent baseline: releasecommit en closure-CI voor 0.8.0 waren groen met
  1019/1019 tests; vóór implementatie wordt geen redundante volledige baseline
  herhaald zolang source/tests sinds die SHA schoon en ongewijzigd zijn.

## Journal

- 2026-08-03: source en actuele records geïnspecteerd. Huidig contract vereist
  altijd `<naam-slug>--<acht-hex>` en valideert photo-locality via die suffix.
- 2026-08-03: gebruiker koos expliciet fresh-vault-only; bestaande 0.8-dossiers
  worden niet ondersteund of gemigreerd.
- 2026-08-03: implementatieplan gevormd; uitvoering wacht op de door 10x vereiste
  verse continuation nadat spec, decision en eerste executable ticket duurzaam
  zijn vastgelegd.
- 2026-08-03: gebruiker activeerde de verse execution continuation. Ticket is
  naar `active` gepromoveerd voor verticale TDD-uitvoering; commit, push,
  versiebump en release blijven niet geautoriseerd.
- 2026-08-04: Slice 1 pure naming/planner begon test-first in nieuw
  `test/people-paths.test.ts`. Exact RED-commando onder de verplichte runtime:
  `export PATH=/home/nms/.local/node24/bin:$PATH; command -v node; node --version;
  npm --version; npm exec -- vitest run --project node test/people-paths.test.ts`
  toonde `/home/nms/.local/node24/bin/node`, Node `v24.18.1`, npm `11.16.0` en
  eindigde assertion-grade met exit 1: 1 testfile, 6 failed. De eerste diff was
  exact `expected "Zoë - Admin", received undefined`; drie onafhankelijke
  128-bit-vectoren ontvingen eveneens `undefined`; plain/adaptieve kandidaat en
  invalid/legacy-fail-closed waren nog afwezig. Na uitsluitend de pure
  `people-paths`-implementatie gaf exact hetzelfde commando exit 0: 1 testfile,
  6/6 passed. Bewezen zijn de bestaande safe-nameweergave, conservatieve
  case/Unicode/diakritische/separator-collisionkey, paddingloze MSB-first
  Crockford-byte-stream (`00`, `ZZ`, `FP`), plain eerste kandidaat, `FP`→`FPF`
  newcomer-extensie bij bezetting en fail-closed invalid/legacy grammar. Er is in
  deze slice geen mutation-, UI-, index-, registry- of migratiecode gewijzigd.
- 2026-08-04: Slice 2 sloot de planner aan op de centrale createboundary met
  actuele index- en vaultfacts. Exact gericht RED-commando met dezelfde vierdelige
  Node-24-handshake:
  `npm exec -- vitest run --project node test/mutation-service.test.ts -t
  "shared presentation-first|user-owned ordinary"` => exit 1, 2 failed + 89
  skipped. De canonical-collisioncall rejectte met het oude stale-pad plus
  `A dossier already exists`; de user-owned gewone map gaf de oude generieke
  dossierfout in plaats van de vereiste ownershipblocker. De minimale GREEN laat
  create door dezelfde pure planner lopen, gebruikt `PersonIndex.getSnapshot()`
  plus `Vault.getAllLoadedFiles()`, slaat een bezette suffixcandidate alleen over,
  en herhaalt planner + identity direct vóór profielcreate waarbij uitsluitend de
  transaction-owned lege doelmap wordt genegeerd. Exact hetzelfde commando werd
  exit 0: 2 passed + 89 skipped. Unique plain, canonical collision `FP`, bezette
  `FP`→`FPF` en user-owned plain namespace zonder writes zijn assertion-gedekt;
  bestaande transaction-owned dossiercheck en cleanupcatch bleven behouden.
- 2026-08-04: Slice 3 maakte dossierownership afhankelijk van volledige ID én
  exact het actuele canonieke indexpad aan de form/photo-grens. RED exact met
  handshake: `npm exec -- vitest run --project node test/person-form.test.ts -t
  "requires full identity and exact current index ownership"` => exit 1, 1 failed
  + 61 skipped; received was de concrete `Cannot read properties of undefined
  (reading 'length')` in plaats van de fail-closed canonical-dossiermelding. De
  minimale GREEN geeft de helper de actuele, op volledige `person_id` gefilterde
  indexpaden. Hetzelfde commando werd exit 0: 1 passed + 61 skipped. De test
  bewijst dat een verdwenen indexowner write-free blokkeert en exact dezelfde
  plain profile + lokale descendant wel de bestaande updategrens bereikt.
- 2026-08-04: Tweede-executor-evidence die nog niet duurzaam was vastgelegd is
  gereconcilieerd. `test/people-paths.test.ts` ging voor de conservatieve planner-
  uitbreiding van 2 failed + 6 passed naar 8/8 passed. De gerichte modalcollision
  ging van 1 failed + 60 skipped naar 1 passed + 60 skipped; de mentionplanner van
  1 failed + 4 skipped naar 1 passed + 4 skipped; modal full-ID photoauthority van
  1 failed + 61 skipped naar 1 passed + 61 skipped; mutation full-ID
  photoauthority van 1 failed + 91 skipped naar 1 passed + 91 skipped. De vijf
  GREENs gebruikten respectievelijk de volledige plannerfile en de bestaande
  `-t`-selecties `previews the shared collision plan`, `uses current index
  ownership and vault occupancy`, `shows no dossier assets when current index
  ownership` en `rejects a local photo without one exact current canonical index
  owner`, steeds onder dezelfde Node-24-handshake.
- 2026-08-04: De orchestrator-diagnostiek vóór deze continuation bevestigde dat de
  resterende RED fixturegedreven was: de exacte vijf-file node-run gaf 3 failed +
  2 passed files en 21 failed + 159 passed tests (mutation 15, person-form 5,
  mention 1; people-paths 8/8 en person-photo 13/13 groen); de exacte browserfile
  gaf 3 failed + 59 passed door uitsluitend oude reviewed-pathverwachtingen; de
  integratiefile gaf 1 failed + 2 passed doordat het legacy profiel terecht niet
  als full-ID-dossierauthority gold. `npm run typecheck` was daarbij groen.
- 2026-08-04: De resterende semantisch actuele create-, photo-, rename-,
  TOCTOU-, concurrency-, modal-, mention- en integratiefixtures zijn per testdoel
  naar plain new grammar gemigreerd. Collisionfixtures behouden canonieke ` ·
  FP`/` · FPF`-candidates en unieke volledige-ID/indexownership; uitsluitend de
  expliciete legacy-rejecttests in `test/people-paths.test.ts` en
  `test/person-form.test.ts` behouden `--<acht-hex>`. De vijf nodefiles werden
  direct 5/5 files en 180/180 tests groen, de browserfile 1/1 en 62/62 groen, en
  de integratiefile 1/1 en 3/3 groen. Daarmee reproduceerde geen echte
  productregressie en was geen aanvullende productiepatch nodig.
- 2026-08-04: Gerichte formattering noemde alle 16 scopepaden expliciet; Biome
  verwerkte 11 ondersteunde files, wijzigde 5 files semantiekvrij en gaf daarna
  `Checked 11 files ... No fixes applied`. Daarom zijn de exacte drie affected
  runs opnieuw uitgevoerd: node 5/5 files, 180/180; browser 1/1, 62/62;
  integration 1/1, 3/3. De actuele Node-24-typecheck was eveneens exit 0. De
  twee exacte fail-run-screenshotdirectories zijn daarna beperkt opgeschoond: 39
  browser-PNGs en 1 integration-PNG; beide bevatten daarna geen bestand meer.
- 2026-08-04: Reviewblokker 1 — uitsluitend de pure plannerauthority in
  `src/domain/people-paths.ts` en de regressie in `test/people-paths.test.ts`.
  RED onder `/home/nms/.local/node24/bin/node` (`v24.18.1`, npm `11.16.0`):
  `export PATH=/home/nms/.local/node24/bin:$PATH; command -v node; node --version; npm --version; npm exec -- vitest run --project node test/people-paths.test.ts -t "never grants a collision suffix"`
  => exit 1, 1 file, 3 failed + 8 skipped; iedere assertion ontving `status:
  "ready"` waar `blocked` vereist was voor ongeldige UUID-owner, nested
  profielpad en ontbrekend actueel vaultpad. GREEN met exact hetzelfde commando
  => exit 0, 1 file, 3 passed + 8 skipped. De planner vereist nu voor een
  ordinary collisionowner een UUID-backed volledige ID, één direct profielpad,
  unieke index-ID/-path en exacte aanwezigheid van dat pad in de actuele
  `vaultPaths`; geen testcase kreeg ` · FP`. Deze slice wijzigde geen UI,
  mutation, snapshot-API, suffixgrammar of vaultwritegedrag.
- 2026-08-04: Reviewblokker 4a — alleen de portable pure collisionkey en
  `test/people-paths.test.ts`. RED met de verplichte Node-24-handshake en
  `npm exec -- vitest run --project node test/people-paths.test.ts -t "Greek final-sigma"`
  => exit 1, 1 file, 1 failed + 11 skipped: `personDossierCollisionKey("ΟΣ")`
  ontving `"ος"` waar `"οσ"` verwacht was. GREEN met exact hetzelfde commando
  => exit 0, 1 file, 1 passed + 11 skipped. De gedeelde key canonicaliseert nu
  Unicode caseless via upper→lower en normaliseert final sigma naar sigma; de
  planner plant daarom `ΟΣ · FP` tegen een actuele `Οσ`-owner. Geen name
  validation, ownership-helper of write-callsite is in deze slice gewijzigd.
- 2026-08-04: Reviewblokker 4b — alleen plannerlabelvalidatie in
  `src/domain/people-paths.ts` en `test/people-paths.test.ts`. RED met
  Node-24-handshake en `npm exec -- vitest run --project node
  test/people-paths.test.ts -t "blocks portability-unsafe"` => exit 1, 1 file,
  4 failed + 12 skipped: `CON`, `CON.txt`, U+200B en een 253-byte label gaven
  allen een `ready` plan. GREEN met hetzelfde commando => exit 0, 1 file,
  4 passed + 12 skipped. Voor planning blokkeren nu default-ignorables en bidi,
  lege collisionkeys, Windows-device-stems (ook met extensie) en dossier- of
  profielsegmenten boven 255 UTF-8 bytes vóór elke write. NFC/NFD/case-equivalentie
  blijft door de bestaande gedeelde collisionkey-test gedekt. Geen ownership- of
  mutationcallsite wijzigde in deze slice.
- 2026-08-04: Reviewblokker 2 (pure grammar) — alleen
  `src/domain/people-paths.ts` en `test/people-paths.test.ts`. Assertion-grade
  RED met Node-24-handshake en `npm exec -- vitest run --project node
  test/people-paths.test.ts -t "never falls back to plain ownership"` => exit
  1, 1 file, 5 failed + 16 skipped: lowercase ` · fp`, ` · II`, herhaalde
  middle-dot, `CON` en basename `.md` werden als dossierowner teruggegeven.
  De minimale GREEN met `npm exec -- vitest run --project node
  test/people-paths.test.ts -t "never falls back|blocks portability-unsafe"`
  => exit 0, 1 file, 10 passed + 12 skipped. Eén classifier staat uitsluitend
  `plain` of exact uppercase Crockford ` · ` + 2..26 toe; legacy, elke andere
  middle-dotvorm, unsafe segment en lege `.md`-basename zijn nu invalid en
  `Alice · fp` kan ook niet als nieuwe gewone label worden gepland. Callsite-
  snapshotauthority volgt in de volgende slice.
- 2026-08-04: Derde, bewust smalle continuation sloot uitsluitend de resterende
  legacy-negatieve en multi-owner UI/mutationregressies. De positieve
  `test/person-photo.test.ts`-dossierfixture is van legacy
  `People/Profiles/alice--11112222` naar plain
  `People/Profiles/Alice` gemigreerd; de malformed-boundary-tabel behoudt legacy
  uitsluitend negatief. Het eerste gerichte runnen van die gecorrigeerde
  fixture was al groen: 1 passed + 12 skipped.
- 2026-08-04: Per ontbrekende regressie is eerst de concrete test geschreven en
  alleen die Vitest-selectie gestart onder de verplichte Node-24-handshake. De
  code had de contracten al: daarom waren de eerste executies groen en is geen
  kunstmatige RED of productiepatch vervaardigd. `person-form` bewees twee
  verschillende actuele UUID-records met directe `Alice.md`/`Bob.md`-profielen
  onder één parent: 1 passed + 62 skipped, zonder form-mutation. De publieke
  Chromium-modal bewees dezelfde parent met geen assets, afgewezen directe
  selectie en geen Save-mutation: 1 passed + 62 skipped. De centrale mutation
  bewees een legacy `alice--11112222`-profiel met lokale foto, 0
  `processFrontMatter`-calls, 0 commits en geen rename: 1 passed + 94 skipped.
  De callback-time variant startte met één eigenaar en injecteerde vóór de
  frontmattercallback een tweede directe actuele eigenaar; zij bereikte één
  callback-entry maar 0 commits/renames en ongewijzigde frontmatter: 1 passed +
  95 skipped.
- 2026-08-04: De daarna verplichte volledige directe browserfile was eerst RED:
  27 failed + 36 passed. De nieuwe strict fresh-vaultauthoriteit was correct;
  de browser-harness gaf profielrecords wel aan `getCurrentPeople()` maar zette
  de corresponderende actuele profielbestanden niet in
  `getAllLoadedFiles()`. De minimale test-fixturecorrectie laat `mountModal`
  voor haar huidige mensen één unieke profiel-TFile inventariseren naast de
  expliciete photo-files. Exact dezelfde browserfile werd daarna 63/63 groen.
  Dit wijzigt geen productcode of vaultsemantiek.
- 2026-08-04: De directe integratiefile was vervolgens eerst RED (1 failed + 2
  passed) omdat de controlled Vault de productiegebruikte
  `getAllLoadedFiles()`-hostsurface niet implementeerde. Alleen
  `test/obsidian-stub.ts` kreeg die bestaande-inventorymethode; de exact
  herhaalde integratiefile werd 3/3 groen. `npm run typecheck` ontdekte daarna
  een bestaande test-harness-typefout (`Parameters<typeof
  AtlasMutationService>` op een constructor); de minimale
  `ConstructorParameters`-correctie maakte typecheck groen. De formatter op de
  expliciete vijf testfiles corrigeerde eerst twee layoutfiles; na alle
  reruns rapporteerde hij `No fixes applied`.
- 2026-08-04: Finale directe Node-24-evidence na de laatste test-harnessedit:
  `test/people-paths.test.ts`, `test/person-photo.test.ts`,
  `test/person-form.test.ts`, `test/mention.test.ts` en
  `test/mutation-service.test.ts` => 5/5 files, 200/200 tests. Browser
  `test/browser/person-modal.browser.test.ts` => 1/1, 63/63; integration
  `test/integration/person-photo.integration.test.ts` => 1/1, 3/3;
  `npm run typecheck` => exit 0. De tijdelijke exact-run failure-artifacts zijn
  na file-inventarisatie beperkt verwijderd: 27 browser-PNGs en 1 integration-
  PNG; de groene reruns maakten geen nieuwe failure-screenshots.

## Blockers

None. De finale onafhankelijke rereview is PASS; de actuele Node-24
`npm run check`, afzonderlijke build en reproduceerbaarheidsgate zijn groen.
Dit ticket is volledig geleverd in commit `6df234c4aea6ab8192f9bd5fa73c2b1f25d69f03`.
Commit, push en release liggen buiten deze recordsluiting.

## Evidence

- Repository bij shaping: `main` en `origin/main` op
  `9710541ac2e7ae11b3d28f337e60cd3d245e4ac4`; werkboom schoon.
- Runtime-handshake: `/home/nms/.local/node24/bin/node`, Node `v24.18.1`, npm
  `11.16.0`.
- Authority: `AGENTS.md` verbiedt displaynaamidentiteit; `ARCHITECTURE.md`
  vereist stabiele expliciete IDs; huidige path/form/mutation/photo-seams en
  betrokken regressietests zijn geïnventariseerd.
- Geen productcode, test, dependency, lockfile, workflow, versie of externe
  state gewijzigd tijdens shaping.
- Actuele directe verificatie onder `/home/nms/.local/node24/bin/node`, Node
  `v24.18.1`, npm `11.16.0`: node 200/200, browser 63/63, integration 3/3 en
  `tsc --noEmit` groen.
- Exacte huidige scope (18 paden):
  `.10x/decisions/person-dossier-storage-layout.md`,
  `.10x/decisions/presentation-first-person-dossier-naming.md`,
  `.10x/specs/person-dossier-storage.md`,
  `.10x/specs/presentation-first-person-dossier-naming.md`,
  `.10x/tickets/2026-08-03-presentation-first-dossier-naming.md`,
  `src/domain/people-paths.ts`, `src/editor/person-form.ts`,
  `src/editor/person-mention-suggest.ts`, `src/editor/person-modal.ts`,
  `src/mutations/atlas-mutation-service.ts`,
  `test/browser/person-modal.browser.test.ts`,
  `test/integration/person-photo.integration.test.ts`, `test/mention.test.ts`,
  `test/mutation-service.test.ts`, `test/obsidian-stub.ts`,
  `test/people-paths.test.ts`, `test/person-form.test.ts` en
  `test/person-photo.test.ts`.
- Finale hygiëne na deze recordedit: `git diff --check` en vier afzonderlijke
  add-only `git diff --no-index --check`-controles waren groen. De scoped
  added-line scan omvatte 2.043 regels in 18 paden (14 tracked, 4 add-only): 0
  secrets, 0 control/bidi/Unicode-issues en 0 uitvoerbare unsafe patronen; twee
  hits zijn geclassificeerd als de veilige `RegExp.exec`-aanroepen in
  `src/domain/people-paths.ts`. De twee exact-run screenshotdirectories zijn
  leeg; ze voegden geen statuspad toe.
- Verificatielimieten: geen onafhankelijke review, brede `npm run check`, build,
  reproduceerbaarheid, commit, staging, push, tag, release of live
  Obsidian-desktop/mobile/assistive-technologyvalidatie uitgevoerd. De volledige
  gate en review blijven bewust gereserveerd en open.

## Review

Pending independent review

## Retrospective

De nieuwe grammar was al coherent in de gedeelde planner en volledige-ID-
authority; de resterende brede RED kwam van positieve fixtures die nog bewust het
oude 0.8-pad modelleerden. Eerst per testintentie classificeren en pas daarna
plain/collisionfixtures migreren hield de expliciete legacy-rejectgrens intact en
maakte zichtbaar dat geen aanvullende productiecorrectie nodig was.

## Remediation journal

- 2026-08-04: De onafhankelijke rereview is **FAIL**. Drie blocker-level
  countervoorbeelden in de gedeelde pure presentation-first boundary blijven
  open: een directe owner met non-`.md`-profiel of U+001F-dossier kon een
  newcomer-suffix autoriseren; de classifier/fotoauthority accepteerde U+001F
  of letterlijke backslash in een direct profielpad; en een collision-suffix kon
  de 255-byte segmentgrens overschrijden. Herstel blijft beperkt tot
  `src/domain/people-paths.ts` en `test/people-paths.test.ts`, test-first en
  zonder migratie, compatibility, UI/mutationrefactor of vaultwrite. Ticket
  blijft `active`; onafhankelijke rereview blijft pending en de brede Node-24
  gate (`npm run check`, build, reproduceerbaarheid) blijft bewust open.
- 2026-08-04: Assertion-grade RED voor uitsluitend de drie huidige
  reviewblockers onder `/home/nms/.local/node24/bin/node` (`v24.18.1`, npm
  `11.16.0`): `npm exec -- vitest run --project node
  test/people-paths.test.ts -t "never grants a collision suffix|blocks a
  250-byte plain label|rejects unsafe or overlong direct profile authority"`
  => exit 1, 1 testfile, **6 failed / 3 passed / 20 skipped** (29 totaal).
  Verwacht `blocked` maar ontvangen `ready` voor de 250-byte collision-suffix,
  de non-`.md` owner en de U+001F-owner; verwacht `undefined` maar ontvangen
  dossierauthority voor U+001F, een letterlijke backslash en een 253-byte
  basename plus `.md`. Productiesource bleef tijdens RED onaangeroerd.
- 2026-08-04: Minimale pure GREEN met exact hetzelfde Node-24-commando => exit
  0, 1 testfile, **9 passed / 20 skipped** (29 totaal). De strict direct-owner
  parser eist nu een plain, portable dossier en een niet-lege portable `.md`
  bestandsnaam inclusief de extensie; unsafe/non-`.md` owners blokkeren de
  ordinary namespace. `isPortablePathSegment()` hergebruikt de canonieke
  note-path validator en weigert aanvullend C1-controls; de classifier en
  profielauthority valideren dossier- én volledige bestandssegmenten. Iedere
  kandidaat wordt vóór `ready` gevalideerd; een te lange suffix stopt gesloten
  in plaats van een langere unsafe kandidaat te proberen. Geen legacyrepresentatie
  wordt als owner genormaliseerd of geautoriseerd.
- 2026-08-04: Expliciete format-scope onder dezelfde Node-24-runtime:
  `npm exec -- biome format --write src/domain/people-paths.ts
  test/people-paths.test.ts` => exit 0, 2 files geformatteerd. Daarna actuele
  directe regressie: `npm exec -- vitest run --project node
  test/people-paths.test.ts test/person-photo.test.ts` => exit 0, **2/2
  testfiles en 42/42 tests** (29 path-boundary, 13 directe photo-dependent).
  `npm run typecheck` => exit 0 (`tsc --noEmit`). Geen brede `npm run check`,
  build of reproduceerbaarheidsrun uitgevoerd: die criteria blijven open; ticket
  blijft `active` en onafhankelijke rereview blijft pending.
- 2026-08-04: Aanvullende C1-portability RED vóór de C1-guard onder Node
  `v24.18.1`/npm `11.16.0`: `npm exec -- vitest run --project node
  test/people-paths.test.ts -t "rejects unsafe or overlong direct profile
  authority"` => exit 1, 1 testfile, **1 failed / 3 passed / 26 skipped**
  (30 totaal). U+009F gaf nog dossierauthority waar `undefined` vereist is;
  de C0/backslash/overlong rows bleven groen. Productiesource had op dit punt
  uitsluitend de tijdelijke ontbrekende C1-guard; de nieuwe assertion was eerst
  red voordat die guard terugkomt.
- 2026-08-04: C1-GREEN met exact hetzelfde Node-24-commando => exit 0, 1
  testfile, **4 passed / 26 skipped** (30 totaal). De gedeelde portable-segment
  boundary weigert nu ook ieder C1-codepoint U+0080..U+009F vóór classifier of
  photoauthority; U+001F, backslash en de 256-byte volledige bestandsnaam
  blijven in dezelfde direct-authority matrix gedekt.
- 2026-08-04: Finale scoped Node-24-verificatie na C1-GREEN: `npm exec -- biome
  format --write src/domain/people-paths.ts test/people-paths.test.ts` => exit
  0, 2 files, `No fixes applied`; `npm exec -- vitest run --project node
  test/people-paths.test.ts test/person-photo.test.ts` => exit 0, **2/2
  testfiles en 43/43 tests** (30 pure path, 13 directe photo-dependent); en
  `npm run typecheck` => exit 0 (`tsc --noEmit`). Geen `npm run check`, build
  of reproduceerbaarheid uitgevoerd. Het ticket blijft `active`; Review is
  pending onafhankelijke rereview en de brede gate blijft open.
- 2026-08-04: Scopehygiëne vóór deze laatste recordregel: tracked `git diff
  --check` => exit 0; alle vier huidige untracked scopepaden (presentation-first
  decision, spec, ticket en `test/people-paths.test.ts`) hadden ieder de
  verwachte add-only `git diff --no-index --check` exit 1 zonder output. Geen
  files gestaged, gecommit, gepusht, getagd of gepubliceerd. Deze checks bewijzen
  alleen whitespace/scopehygiëne van de dirty worktree, niet de gereserveerde
  brede gate of een onafhankelijke review-PASS.
- 2026-08-04: De finale onafhankelijke review is **FAIL** met vijf geldige,
  onafhankelijke blockers bij raw collision-authority, volledige snapshots,
  photo-authority, create-time folder-race en rename-portability. De oorzaken
  waren respectievelijk normaliseren vóór raw-validatie; malformed peers uit de
  uniqueness-set filteren; dezelfde filter in dossier/photoauthority; geen nieuwe
  full snapshot ná de laatste awaited `ensureFolder`; en geen volledige portable
  profielbestandsnaamguard vóór frontmatter. Er is geen migration/fallback of
  buiten-scope productwijziging toegevoegd.
- 2026-08-04: **A, raw collision-authority, strict TDD.** Eerst is de regressie
  `blocks a raw backslash-coded existing owner before it can authorize a
  collision suffix` toegevoegd. Het exacte Node-24-selectorcommando
  `export PATH=/home/nms/.local/node24/bin:$PATH && command -v node && node
  --version && command -v npm && npm --version && npm exec -- vitest run
  --project node test/people-paths.test.ts -t "blocks a raw backslash-coded
  existing owner"` was RED met exit 1; de bewaarde oorspronkelijke toolstream
  bevatte alleen die exitstatus. Daarna maakte de minimale pure reparatie
  `collisionPathParts()` raw `\\` fail-closed vóór iedere normalisatie. Hetzelfde
  commando was GREEN met exit 0. Daardoor kan
  `People\\Profiles\\Jan Jansen\\Owner.md` nooit een canonieke owner of
  suffixautoriteit zijn.
- 2026-08-04: **B, volledige planner-snapshot, strict TDD.** De tabelregressie
  voor nested, C1, non-Markdown, reserved en raw peers onder één ordinary
  collisionnamespace was eerst RED met `npm exec -- vitest run --project node
  test/people-paths.test.ts -t "blocks a second current PersonRecord"`: exit 1,
  1 file, **4 failed / 1 passed / 31 skipped**; nested/C1/non-`.md`/reserved
  gaven ten onrechte `ready`. De minimale GREEN verzamelt nu vóór strict-owner
  filtering alle raw namespace-relevante `PersonRecord`s en eist exact één
  daarna strict/direct/current/UUID/uniek/live owner. Exact dezelfde selector:
  exit 0, 1 file, **5 passed / 31 skipped**.
- 2026-08-04: **C, volledige dossier/photo-snapshot, strict TDD.** De pure
  `Alice.md` + `Bob\\u009f.md`/nested-peer regressie was RED met `npm exec --
  vitest run --project node test/people-paths.test.ts -t "unsafe current
  PersonRecord"`: exit 1, 1 file, **2 failed / 36 skipped**, omdat
  `personDossierPathFromProfile()` nog `People/Profiles/Alice` teruggaf. De
  concrete centrale photo-mutationregressie was afzonderlijk RED met `npm exec
  -- vitest run --project node test/mutation-service.test.ts -t "unsafe second
  current PersonRecord"`: exit 1, 1 file, **1 failed / 96 skipped**; de promise
  resolveerde en schreef. GREEN gebruikt dezelfde raw parent-membershipsnapshot
  als unieke authority en blokkeert vóór hostwrite. De gecombineerde selector
  `npm exec -- vitest run --project node test/people-paths.test.ts
  test/mutation-service.test.ts -t "unsafe.*current PersonRecord"` was exit 0:
  **3 passed / 132 skipped**; de centrale regressie assert 0
  `processFrontMatter`-calls, 0 commits en 0 renames.
- 2026-08-04: **D, post-folder creation race, strict TDD.** De deterministische
  harness injecteerde een externe canonieke `Existing.md` exact in de
  post-final-folder/pre-return hook. De selector `npm exec -- vitest run
  --project node test/mutation-service.test.ts -t "canonical owner injected
  after its transaction-owned dossier"` was RED met exit 1, 1 file, **1 failed
  / 97 skipped**: de profile-create resolveerde. De minimale GREEN leest
  settings, People-snapshot en vaultpaths opnieuw ná `ensureFolder`, replandt
  exact vóór `vault.create` en negeert uitsluitend de nog lege
  transaction-owned folder zelf. Dezelfde selector is exit 0, **1 passed / 97
  skipped**. De test bewijst 0 profielwrites en dat de door externe content niet
  lege dossiermap niet wordt verwijderd (`trashedPaths: []`).
- 2026-08-04: **E, rename-portability, strict TDD.** De test die
  `People/Profiles/Alice/Alice.md` naar `.../CON.md` hernoemt was RED met
  `npm exec -- vitest run --project node test/mutation-service.test.ts -t
  "portability-unsafe full profile filename"`: exit 1, 1 file, **1 failed / 98
  skipped**; de promise resolveerde met rename. GREEN exporteert uitsluitend de
  gedeelde strikte `isPortableProfileFilename()`-boundary uit
  `people-paths.ts` en gebruikt die vóór `processFrontMatter`/rename. Exact
  dezelfde selector is exit 0, **1 passed / 98 skipped**, met 0 frontmattercalls,
  0 commits en 0 renamecalls.
- 2026-08-04: Finale directe, actuele Node-24-evidence na de semantische patch
  en de formatter-rerun: `npm exec -- vitest run --project node
  test/people-paths.test.ts test/person-photo.test.ts test/person-form.test.ts
  test/mention.test.ts test/mutation-service.test.ts` => exit 0, **5/5 files,
  218/218 tests**. Browser: `npm exec -- vitest run --project browser
  --no-file-parallelism test/browser/person-modal.browser.test.ts` => exit 0,
  **1/1, 63/63**. Integration: `npm exec -- vitest run --project integration
  test/integration/person-photo.integration.test.ts` => exit 0, **1/1, 3/3**.
  `npm run typecheck` => exit 0 (`tsc --noEmit`). Biome kreeg expliciet 13
  in-scope TypeScriptpaden; de laatste controle was `Checked 13 files ... No
  fixes applied`.
- 2026-08-04: Laatste hygiëne vóór deze recordedit: tracked `git diff --check`
  => exit 0; een tekstcontrole over **alle 4** untracked paden gaf geen trailing
  whitespace; de scoped added-line scan over de vier gewijzigde remediation
  source/testpaden gaf **0** focused-test, TS-suppression, debug-output of lege
  catch-patronen. De worktree blijft bewust dirty met uitsluitend de bestaande
  18 scopepaden; niets is gestaged/gecommit/gepusht/getagd/geubliceerd.
- 2026-08-04: Resterende limieten: de gereserveerde brede `npm run check`, build
  en reproduceerbaarheid zijn niet uitgevoerd; geen live Obsidian
  desktop/mobile/assistive-technologyvalidatie is gedaan. Status blijft
  `active`, Review blijft `Pending independent review`, en de volledige gate en
  verse onafhankelijke rereview blijven open.
- 2026-08-04: Post-journal hygiëne is opnieuw gecontroleerd: tracked `git diff
  --check` en de trailing-whitespacecontrole over alle vier untracked paden zijn
  schoon. Deze record-only regel veranderde geen source/test- of gate-evidence.
- 2026-08-04: De onafhankelijke read-only review uit
  `/home/nms/.hermes/cache/delegation/subagent-summary-0-20260804_124047_296759.txt`
  was **FAIL**: de globale raw-backslashscans in planner en fotoauthority lieten
  één ongerelateerde corrupte `PersonRecord` iedere gewone collisionnamespace en
  dossierauthority blokkeren. De remedie blijft beperkt tot
  `src/domain/people-paths.ts` en `test/people-paths.test.ts`: raw
  backslashrepresentaties worden uitsluitend voor scope-membership naar `/`
  bekeken, nooit als strict direct owner/profile-authority geparseerd.
- 2026-08-04: Assertion-grade RED vóór productiecode onder
  `/home/nms/.local/node24/bin/node` (Node `v24.18.1`, npm `11.16.0`):
  `export PATH=/home/nms/.local/node24/bin:$PATH && command -v node && node
  --version && command -v npm && npm --version && npm exec -- vitest run
  --project node test/people-paths.test.ts -t "does not let an unrelated raw
  backslash record|keeps Alice dossier authority"` => exit 1, 1 testfile,
  **2 failed / 38 skipped** (40 totaal). Met een veilige huidige Alice-owner gaf
  `Elsewhere\\Corrupt.md` ten onrechte `blocked` in plaats van exact
  `People/Profiles/Alice · FP/Alice.md`; dezelfde ongerelateerde raw record gaf
  voor `personDossierPathFromProfile()` ten onrechte `undefined` in plaats van
  `People/Profiles/Alice`.
- 2026-08-04: Minimale GREEN: de planner inspecteert de gefilterde gecombineerde
  vault-/PersonRecord-occupancy alleen op unsafe raw-paths die na uitsluitend
  backslash→slash scopevergelijking tot de actuele ordinary namespace horen. De
  dossier/photoauthority doet hetzelfde uitsluitend voor de kandidaatparent en
  omvat ook `vaultPaths`; strict direct-owner en full-snapshotchecks blijven
  ongewijzigd gezaghebbend. Exact dezelfde Node-24-selector, uitgebreid met
  bestaande raw-in-scope regressies (`-t "does not let an unrelated raw
  backslash record|keeps Alice dossier authority|raw backslash-coded"`), was
  exit 0: 1 testfile, **4 passed / 36 skipped**. Dus raw
  `People\\Profiles\\Jan Jansen\\Owner.md` en de bestaande raw peer in
  dezelfde Jan-namespace blijven blokkers, maar de ongerelateerde Alice-cases
  krijgen geen canonical authority en veroorzaken geen globale denial-of-service.
- 2026-08-04: Expliciete formatscope onder dezelfde runtime:
  `npm exec -- biome format --write src/domain/people-paths.ts
  test/people-paths.test.ts` => exit 0, **Formatted 2 files; No fixes applied**.
  Daarna zijn de actuele directe gates groen: node
  `test/people-paths.test.ts test/person-photo.test.ts test/person-form.test.ts
  test/mention.test.ts test/mutation-service.test.ts` => **5/5 files,
  220/220 tests**; browser `test/browser/person-modal.browser.test.ts` met
  `--no-file-parallelism` => **1/1, 63/63**; integration
  `test/integration/person-photo.integration.test.ts` => **1/1, 3/3**; en
  `npm run typecheck` => exit 0 (`tsc --noEmit`).
- 2026-08-04: Status en limieten: de werkboom blijft bewust dirty met dezelfde
  18 scopepaden (14 tracked gewijzigd, 4 untracked), staged set leeg; niets is
  gecommit, gepusht, getagd of gepubliceerd. Dit ticket blijft `active`, Review
  blijft `Pending independent review`, en de gereserveerde brede `npm run check`,
  build en reproduceerbaarheid plus live Obsidian-desktop/mobile/AT-validatie
  blijven expliciet open. Na deze recordedit volgen tracked en alle untracked
  scopebestanden nogmaals door whitespacecontrole.
- 2026-08-04: Finale whitespace/scope-hygiëne: tracked `git diff --check` =>
  exit 0. Voor elk van de vier untracked scopepaden (decision, spec, ticket en
  `test/people-paths.test.ts`) gaf `git diff --no-index --check /dev/null <pad>`
  de verwachte add-only exit 1 zonder output. De status bevat exact 14 gewijzigde
  tracked en 4 untracked scopepaden; de staged set blijft leeg.
- 2026-08-04: De aanvullende onafhankelijke review in
  `/home/nms/.hermes/cache/delegation/subagent-summary-0-20260804_130028_017818.txt`
  is **FAIL**: `isPortablePathSegment()` trimde afsluitende `.` alleen voor de
  Windows-devicecheck en liet daardoor `Alice.` als direct collision-/dossierowner
  en `Alice..md` als portable profielnaam toe. Dit is één gedeelde pure
  authority-blocker; geen migratie, fallback, UI- of mutation-refactor is
  toegestaan.
- 2026-08-04: **Trailing-aliasremediatie, strict TDD.** Vóór productiecode was
  de Node-24-selector `export PATH=/home/nms/.local/node24/bin:$PATH && command
  -v node && node --version && command -v npm && npm --version && npm exec --
  vitest run --project node test/people-paths.test.ts test/mutation-service.test.ts
  -t "Windows trailing|trailing-dot full profile filename"` RED met exit 1:
  **2 testfiles, 5 failed / 139 skipped (144 totaal)**. De relevante assertions
  ontvingen ten onrechte `ready` voor de `Alice.`-candidate/directe owner,
  `People/Profiles/Alice.` als dossierauthority en alleen de naam-padfout in
  plaats van de portable-fout voor rename naar `Alice..md`; de rename-harness
  bleef write-free. Eén aanvankelijk outer-whitespace-inputrow is verwijderd
  omdat de geratificeerde displaynaamgrens expliciet outer inputwhitespace trimt;
  een trailing ASCII-spatie in een werkelijk segment bleef al fail-closed via de
  bestaande `segment !== segment.trim()`-guard.
- 2026-08-04: Minimale GREEN: één NFC-gebaseerde
  `hasWindowsTrailingPathAlias()` weigert nu punt/spatie-aliasen vóór de
  deviceclassificatie in de gedeelde segmentguard; de devicecheck adopteert of
  trimt de component niet meer. De candidate-inputguard beoordeelt de getrimde
  display-input zodat alleen een semantisch afsluitend punt wordt afgewezen,
  zonder de bestaande outer-whitespace UX te wijzigen. Daardoor gelden
  plain/canonical-suffixed classifier, strict owner, fotoauthority, candidate en
  rename via `isPortableProfileFilename()` allemaal fail-closed. Exact de
  gerichte selector was GREEN met exit 0: **2/2 testfiles, 4 passed / 139 skipped
  (143 totaal)**. De directe actuele gates waren groen: node `people-paths`,
  `person-photo`, `person-form`, `mention`, `mutation-service` **5/5, 224/224**;
  browser modal **1/1, 63/63**; integration photo **1/1, 3/3**; `npm run
  typecheck` exit 0. Expliciete Biome-format op `src/domain/people-paths.ts`,
  `test/people-paths.test.ts` en `test/mutation-service.test.ts` rapporteerde
  `No fixes applied`. De gereserveerde brede `npm run check`, build en
  reproduceerbaarheid zijn niet uitgevoerd; status blijft `active`, Review blijft
  `Pending independent review`, en de volledige gate blijft open.
- 2026-08-04: **Derived-candidate follow-up, strict TDD.** Na de eerste GREEN
  bleek de publieke afleidingslaag `personDossierPath()`/`personProfilePath()` de
  raw `Alice.`-input nog via sanitizing tot `Alice` te adopteren. Nieuwe RED vóór
  productiecode onder Node `v24.18.1`/npm `11.16.0`: `npm exec -- vitest run
  --project node test/people-paths.test.ts -t "derived candidate paths"` => exit
  1, **1 testfile, 1 failed / 43 skipped (44 totaal)**; verwachtte lege dossier-
  en profielpaden maar ontving `People/Profiles/Alice` en
  `People/Profiles/Alice/Alice.md`. De minimale GREEN past dezelfde NFC-trailing-
  aliaspredicate toe vóór beide afgeleide candidates; exact dezelfde selector =>
  exit 0, **1 passed / 43 skipped**. Dit bewaart geldige outer form-whitespace en
  voegt geen nieuwe parser of fallback toe.
- 2026-08-04: Finale actuele directe verificatie na deze semantische follow-up:
  expliciete Biome-format op `src/domain/people-paths.ts`,
  `test/people-paths.test.ts` en `test/mutation-service.test.ts` => **No fixes
  applied**; node **5/5 testfiles, 225/225**; browser modal **1/1, 63/63**;
  integration photo **1/1, 3/3**; `npm run typecheck` exit 0. De brede
  `npm run check`, build en reproduceerbaarheid blijven bewust niet uitgevoerd.
  Ticketstatus blijft `active`, Review blijft `Pending independent review` en de
  volledige gate blijft open.
- 2026-08-04: De onafhankelijke finale review in
  `/home/nms/.hermes/cache/delegation/subagent-summary-0-20260804_132213_757028.txt`
  is **FAIL**: `rawPathPartsForScope()` verving raw `\\` met `/`, waardoor de
  dubbele raw separator in `People\\Profiles\\Alice\\\\Bob.md` een lege
  component opleverde en uit zowel de ordinary-namespace- als dossierparent-scan
  verdween. Die corrupte peer kreeg geen canonieke parsing, maar de veilige
  Alice-owner kon daardoor alsnog suffix- en dossierauthority krijgen.
- 2026-08-04: **Double raw scope-membershipremediatie, strict TDD.** Vóór enige
  productiecode was de Node-24-selector `export
  PATH=/home/nms/.local/node24/bin:$PATH && command -v node && node --version &&
  command -v npm && npm --version && npm exec -- vitest run --project node
  test/people-paths.test.ts -t "double raw alternate-separator"` RED met exit 1:
  **1 testfile, 2 failed / 44 skipped (46 totaal)**. Een veilige directe
  Alice-owner plus de dubbele raw peer gaf ten onrechte `ready`; dezelfde veilige
  exacte Alice-owner gaf ten onrechte `People/Profiles/Alice` in plaats van
  `undefined` voor dossierauthority.
- 2026-08-04: Minimale GREEN wijzigt uitsluitend de scope-only tokenizer
  `rawPathPartsForScope()`: die splitst raw `/`- en `\\`-runs, maar weigert lege,
  getrimde, absolute en `.`/`..`-representaties. De strict canonical
  `collisionPathParts()` blijft ongewijzigd en alle scope-callers vereisen nog
  steeds een strict ongeldige raw path; geen raw of herhaalde-separatorpad kan
  daardoor owner-, parser-, candidate- of write-authority krijgen. De GREEN-
  selector `npm exec -- vitest run --project node test/people-paths.test.ts -t
  "double raw alternate-separator|raw backslash-coded|unrelated raw"` was exit 0:
  **1 testfile, 5 passed / 41 skipped (46 totaal)**. Daarmee blokkeren dubbele en
  bestaande enkelvoudige raw peers in hun eigen scope, terwijl ongerelateerde raw
  peers de bestaande ready-plan en Alice-authority behouden.
- 2026-08-04: Actuele directe Node-24-verificatie na de GREEN: expliciete
  formatscope `npm exec -- biome format --write src/domain/people-paths.ts
  test/people-paths.test.ts` => **Formatted 2 files; No fixes applied**; node
  `people-paths`, `person-photo`, `person-form`, `mention`, `mutation-service`
  => **5/5 testfiles, 227/227**; browser modal => **1/1, 63/63**; integration
  photo => **1/1, 3/3**; `npm run typecheck` => exit 0. De brede `npm run check`,
  build en reproduceerbaarheid zijn niet uitgevoerd. Ticketstatus blijft
  `active`, Review blijft `Pending independent review`, en de volledige gate plus
  verse onafhankelijke rereview blijven open.
- 2026-08-04: De onafhankelijke rereview in
  `/home/nms/.hermes/cache/delegation/subagent-summary-0-20260804_133949_106520.txt`
  is **FAIL** met één resterende blocker: de post-folder create-replan gaf
  `ignoredVaultPaths: [dossierPath]` zowel door aan de vault-occupancy als aan
  de volledige actuele `PersonRecord`-snapshot. Daardoor kon een malformed
  current record met exact de transactionele dossiermap als `filePath` uit de
  verplichte namespace-/owner-authority verdwijnen.
- 2026-08-04: **ignoredVaultPaths/full-current-PersonRecord-remediatie, strict
  TDD.** Vóór productiecode zijn twee regressies toegevoegd. De pure selector
  `export PATH=/home/nms/.local/node24/bin:$PATH; command -v node; node --version;
  command -v npm; npm --version; npm exec -- vitest run --project node
  test/people-paths.test.ts -t "never lets ignored vault paths remove a current
  malformed PersonRecord"` was RED met exit 1: **1 failed / 46 skipped (47)**;
  de gewone plan-call blokkeerde, maar dezelfde actuele malformed peer met exact
  `ignoredVaultPaths: ["People/Profiles/Alice"]` gaf onterecht `ready`. De
  afzonderlijke centrale selector voor `test/mutation-service.test.ts -t
  "rejects a malformed current peer injected after its transaction-owned dossier
  folder"` was eveneens RED met exit 1: **1 failed / 100 skipped (101)**; de
  harness injecteerde de peer pas in de post-`ensureFolder`-hook, met de actuele
  vaultfolder zichtbaar, en de profile-create resolveerde onterecht.
- 2026-08-04: Minimale GREEN uitsluitend in
  `src/domain/people-paths.ts`: `ignoredVaultPaths` filtert uitsluitend
  `vaultPaths`; iedere actuele `PersonRecord.filePath` blijft in de complete
  occupancy-/namespace-snapshot. De twee exacte selectors werden GREEN met exit
  0: respectievelijk **1 passed / 46 skipped (47)** en **1 passed / 100 skipped
  (101)**. De post-folder regression bewijst daardoor vóór `vault.create` nul
  profielwrites en ruimt alleen de nog lege, transaction-owned dossiermap op
  (`trashedPaths: ["People/Profiles/Alice"]`).
- 2026-08-04: Actuele gerichte Node-24-gates na GREEN: de vijf files
  `test/people-paths.test.ts`, `test/person-photo.test.ts`,
  `test/person-form.test.ts`, `test/mention.test.ts` en
  `test/mutation-service.test.ts` zijn **5/5 passed, 229/229 tests**; browser
  modal **1/1, 63/63**; gecontroleerde integration photo **1/1, 3/3**; en
  `npm run typecheck` exit 0. Expliciete Biome-format op alle 13 huidige
  TypeScript-scopepaden gaf `Formatted 13 files ... No fixes applied`.
  De brede `npm run check`, build en reproduceerbaarheid zijn bewust niet
  uitgevoerd. Ticketstatus blijft `active`, Review blijft `Pending independent
  review`, en de gereserveerde volledige gate plus verse onafhankelijke rereview
  blijven open.
- 2026-08-04: Finale scopehygiëne voor deze remediation: `git diff --check` was
  exit 0. Elk van de vier untracked scopepaden
  `.10x/decisions/presentation-first-person-dossier-naming.md`,
  `.10x/specs/presentation-first-person-dossier-naming.md`,
  `.10x/tickets/2026-08-03-presentation-first-dossier-naming.md` en
  `test/people-paths.test.ts` gaf met `git diff --no-index --check /dev/null`
  de verwachte add-only exit 1 zonder output. `git status --short` bevat exact
  de bestaande 18 scopepaden (14 tracked gewijzigd, 4 untracked), de staged set
  is leeg; geen commit, push, tag of release is uitgevoerd.
- 2026-08-04: De finale onafhankelijke review uit
  `/home/nms/.hermes/cache/delegation/subagent-summary-0-20260804_135522_893476.txt`
  is **FAIL** met twee resterende exact-membershipblockers: unsafe raw peers in
  een exact `Alice · FP`-candidatefolder werden vóór `ready` niet in de
  suffix-loop bekeken, en een malformed veilige of raw `PersonRecord` exact op
  een dossierparent viel buiten de dossier/photo-snapshot. De herstelgrens
  blijft de gedeelde pure pathboundary, haar directe planner/mutationregressies
  en deze actieve ticket-entry; geen migration, fallback, permissieve
  normalisatie, commit, push, release of brede gate is toegevoegd.
- 2026-08-04: **Exact-membershipremediatie, assertion-grade RED.** Vóór
  productiecode zijn in `test/people-paths.test.ts` drie suffixed-candidate
  gevallen toegevoegd: single raw descendant uit vault,
  `People\\Profiles\\Alice · FP\\Peer.md`; double raw descendant uit een
  current `PersonRecord`, `People\\Profiles\\Alice · FP\\\\Peer.md`; en raw
  exact candidateparent `People\\Profiles\\Alice · FP`. Dezelfde pure file
  kreeg de dossierauthoritygevallen voor zowel een veilige malformed current
  record exact op `People/Profiles/Alice` als raw exact parent
  `People\\Profiles\\Alice`. Onder `/home/nms/.local/node24/bin/node`, Node
  `v24.18.1`, npm `11.16.0`, gaf
  `npm exec -- vitest run --project node test/people-paths.test.ts -t "blocks the current suffixed candidate|fails closed when dossier authority has"`
  exit 1: **1 file, 5 failed / 47 skipped (52)**. Alle suffixgevallen ontvingen
  onterecht `ready` voor `Alice · FP`; beide authoritygevallen ontvingen
  onterecht `People/Profiles/Alice`.
- 2026-08-04: De concrete REDs in `test/mutation-service.test.ts` injecteerden
  na creatie van de transaction-owned `Alice · FP`-folder een raw exact current
  peer en, afzonderlijk, injecteerden tijdens de frontmattercallback een
  malformed current peer exact op de veilige dossierparent. Het exacte
  Node-24-commando
  `npm exec -- vitest run --project node test/mutation-service.test.ts -t "raw exact suffixed candidate peer|malformed current peer appears on the exact dossier path"`
  gaf exit 1: **1 file, 2 failed / 101 skipped (103)**. De create schreef
  onterecht `People/Profiles/Alice · FP/Alice.md`; de callback-time photo-update
  resolveerde onterecht.
- 2026-08-04: Minimale GREEN uitsluitend in `src/domain/people-paths.ts`:
  scope-only raw membership gebruikt nu at-or-descendant matching voor elke
  concrete suffixed candidate vóór `ready`, zonder raw path als owner of
  authority te parseren. De bestaande strict snapshotmembership verzamelt nu
  ook een veilige current record exact op de dossierparent; raw exact-parent
  detectie gebruikt alleen dezelfde scope-tokenisatie. De pure GREEN herhaalde
  het exacte RED-commando met exit 0: **1 file, 5 passed / 47 skipped (52)**;
  de mutation GREEN herhaalde haar exacte RED-commando met exit 0: **1 file, 2
  passed / 101 skipped (103)**. De create harness bewijst nul profile creates,
  een lege transaction-owned `Alice · FP`-folder en uitsluitend die veilige
  cleanup; de callback-time photo harness bewijst 1 callback-entry maar 0 host
  commits en 0 renames.
- 2026-08-04: Na expliciete
  `npm exec -- biome format --write src/domain/people-paths.ts test/people-paths.test.ts test/mutation-service.test.ts`
  (exit 0; 3 files, 2 fixed) zijn de directe actuele Node-24-suites groen:
  `people-paths`, `person-photo`, `person-form`, `mention` en
  `mutation-service` **5/5 files, 236/236 tests**; browser modal **1/1,
  63/63**; gecontroleerde photo integration **1/1, 3/3**; en `npm run
  typecheck` exit 0. De gereserveerde brede `npm run check`, build en
  reproduceerbaarheid zijn bewust niet uitgevoerd. Ticketstatus blijft
  `active`; Review blijft `Pending independent review`; de volledige gate en
  verse onafhankelijke rereview blijven open.
- 2026-08-04: **Trailing-dot/spatie dossierparent-membershipremediatie, strict
  TDD.** Vóór productiecode zijn vijf regressies toegevoegd voor een veilige
  `People/Profiles/Alice/Alice.md`-owner plus unsafe Windows-aliaspeer: direct
  dossierauthority blokkeert nu een current `Alice./Peer.md` en een vault
  `Alice /Peer.md`; de planner blokkeert de huidige `Alice · FP`-candidate voor
  respectievelijk trailing-dot vault- en trailing-spatie current peers in plaats
  van stil naar `FPF` te groeien; en de centrale photo-update injecteert
  `Alice./Peer.md` pas in de frontmattercallback. Het exacte Node-24 RED-commando
  `npm exec -- vitest run --project node test/people-paths.test.ts
  test/mutation-service.test.ts -t "fails closed when dossier authority has a
  trailing|blocks the current suffixed candidate for a trailing|trailing-dot
  Windows alias peer"` gaf exit 1: **2 files, 5 failed / 155 skipped (160)**.
  De pure authority ontving ten onrechte `People/Profiles/Alice`, beide planner
  rows ontvingen onterecht `ready` voor `Alice · FPF`, en de callback-mutation
  resolveerde met een commit. De source bleef tijdens RED onaangeroerd.
- 2026-08-04: Minimale shared GREEN in `src/domain/people-paths.ts`: een
  scope-only parent-membershipcheck herkent uitsluitend componenten die in NFC
  op `.` of ASCII-spatie eindigen en na uitsluitend die Windows-aliassuffix te
  verwijderen met een veilige candidateparent overeenkomen. De alias wordt nooit
  als canoniek pad teruggegeven of als owner geparseerd; strict direct-owner en
  normale segmentvergelijking blijven ongewijzigd. De check geldt voor de
  gecombineerde vault/current-record occupancy, de plain/collisioncandidate en
  dossier/photoauthority; raw-separator scopecontrole blijft afzonderlijk. Een
  positieve `Alice-archive`-peer behoudt dossierauthority en bewijst dat normale
  namen niet worden geconflateerd. Het GREEN-commando, uitgebreid met die
  positieve regression, gaf exit 0: **2 files, 6 passed / 155 skipped (161)**.
  De callback-regressie bewijst 1 callback-entry en `processFrontMatter`-call,
  maar **0 commits en geen renames**.
- 2026-08-04: Finale huidige Node-24-verificatie na een formatter-run (eerst 1
  layoutfix; herhaald: `Formatted 3 files ... No fixes applied`): gerichte node
  `people-paths`, `person-photo`, `person-form`, `mention`, `mutation-service`
  **5/5 files, 242/242 tests**; browser modal **1/1, 63/63**; gecontroleerde
  photo integration **1/1, 3/3**; en `npm run typecheck` exit 0. De gereserveerde
  brede `npm run check`, build en reproduceerbaarheid zijn niet uitgevoerd.
  Ticketstatus blijft `active`; Review blijft `Pending independent review`; de
  volledige gate en verse onafhankelijke rereview blijven open.
- 2026-08-04: De eerstvolgende brede Node-24-gate vond precies één stale
  settings-fixtureverwachting. Vóór een edit gaf
  `npm exec -- vitest run --project node test/settings-load.test.ts` exit 1:
  **1/1 file, 28/29 tests passed**. Alleen
  `keeps the exact schema 8 unsafe People root read-only before its broken
  wikilink can persist` faalde: de legacyverwachting
  `Second Brain/People|Archive/Profiles/alice--11112222/Alice` botste met de
  actuele plain fresh-vault afleiding
  `Second Brain/People|Archive/Profiles/Alice/Alice`. `personProfilePath()`
  bevestigt die plain vorm; schema-8-validatie blijft read-only en er is geen
  productcompatibiliteit, parser of fallback toegevoegd. Alleen deze assertion
  is naar de actuele canonical target aangepast. Exact dezelfde Node-24-run was
  daarna GREEN met exit 0: **1/1 file, 29/29 tests passed**.
- 2026-08-04: Nieuwe canonieke Node-24 `npm run check` onder
  `/home/nms/.local/node24/bin/node` (`v24.18.1`, npm `11.16.0`) is exit 0.
  Biome format was schoon; Biome lint gaf uitsluitend de bestaande niet-blokkerende
  `test/obsidian-stub.ts:197` `noConfusingVoidType`-warning; typecheck was groen.
  Testprojecten: node **50/50 files, 934/934 tests**; browser **10/10, 130/130**;
  integration **8/8, 27/27**; browser-matrix **3/3, 6/6**. `build:production`,
  `release:contract` (main.js **363469/409600** bytes) en `community:check`
  passeerden.
- 2026-08-04: Onafhankelijke finale rereview was **PASS**. De afzonderlijke
  `npm run build`-gate is groen. `npm run verify:reproducible` is groen met twee
  identieke `main.js` SHA-256-hashes:
  `47c5d5de74292a51b4720cd97ab680eba9b441b174a4cbe9e596e52e97d88cdc`.
  Alle implementatie-, review- en kwaliteitscriteria zijn gesloten; release-
  publicatie volgt via de geautoriseerde 0.9.0 Alpha-flow.
- 2026-08-04: Record-only sluiting: de finale criteria stonden al onderbouwd
  als groen, maar status en één checkbox waren niet gesynchroniseerd. De huidige
  bron/testimplementatie is de ongewijzigde `6df234c`-commit; deze edit wijzigt
  uitsluitend dit ticket en draait geen gate opnieuw. Status is daarom `done`.
