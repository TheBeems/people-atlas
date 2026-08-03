Status: done
Created: 2026-08-03
Updated: 2026-08-03

# Dossierlokale profielfotoselectie

Parent: `.10x/tickets/2026-08-03-person-dossier-storage-plan.md`
Depends-On: `.10x/tickets/2026-08-03-person-dossier-layout.md`

## Scope

Pas de bestaande veilige foto-picker aan op de nieuwe persoonsdossiers:

- filter de ondersteunde vaultafbeeldingen voor een bestaande canonieke persoon
  tot zijn eigen dossier en afgeleide submappen;
- accepteer/selecteer alleen dossierlokale ondersteunde assets voor een nieuwe
  fotoverwijzing;
- maak de tweestapsflow voor een eerste foto begrijpelijk: eerst dossier
  opslaan, afbeeldingsbestand zelf in dossier plaatsen, daarna via Edit kiezen;
- behoud de bestaande preview, stale-selectie, missing/decode fallback,
  owner-document en expliciete Save-grenzen.

## Non-goals

- Afbeelding aanmaken, uploaden, kopiëren, verplaatsen, hernoemen, verwijderen,
  croppen of importeren.
- Een foto selecteren tijdens eerste person-create voordat het dossier bestaat.
- Verplaatsen of repareren van een bestaande externe/oude fotoverwijzing.
- Wijzigen van dossier-, relatie-, contactmoment-, graph-avatar- of
  cross-vaultsemantiek buiten de benodigde lokale fotofilter.
- Commit, push, release of live hostcertificering.

## Acceptance criteria

- [x] De foto-assetquery krijgt de actuele canonieke dossiergrens en retourneert
      uitsluitend ondersteunde vault-relative assets binnen die folder of zijn
      descendants; basenamegissingen blijven verboden.
- [x] Een nieuwe geselecteerde foto buiten het dossier of een stale/missing/
      unsupported asset blokkeert Save zonder note- of assetwrite.
- [x] Een bestaande dossierlokale foto behoudt picker, canonical wikilink,
      preview, initials fallback en asset-lifecycle-invalidation.
- [x] Person-create met een lege foto geeft een korte, toegankelijke uitleg dat
      de gebruiker eerst het dossier moet opslaan en daarna een lokale asset kan
      kiezen; Cancel/Escape blijft write-free.
- [x] De plugin voert nooit een binary assetoperatie uit; alleen een expliciete
      Edit-Save mag de geconfigureerde foto-frontmatter bijwerken.
- [x] Pure-, browser- en gecontroleerde integratietests bewijzen
      dossierfiltering, descendants, vreemde gelijknamige assets, keyboard
      selectie, stale asset, create-hint, Save/Cancel, missing/decode fallback
      en pop-out owner-documentgedrag.
- [x] `npm run check`, `npm run build`, `npm run verify:reproducible` en
      `git diff --check` slagen met Node 24.

## References

- `.10x/specs/person-dossier-storage.md`
- `.10x/decisions/person-dossier-storage-layout.md`
- `.10x/tickets/2026-08-03-person-dossier-layout.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/tickets/2026-07-30-person-photo-picker-profile.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified 2026-08-03: foto's leven desgewenst in het persoonsdossier en
  de eerste foto is bewust een handmatige tweede stap.
- User-ratified 2026-08-03: People Atlas voert geen asset-copy/move/import uit.
- Record-backed: de huidige fotoflow gebruikt alleen ondersteunde lokale
  vaultassets, een explicit-Save-grens en stale-selectievalidatie.

## Blockers

None. De dependency `2026-08-03-person-dossier-layout` is `done`; de finale
onafhankelijke rereview is PASS, alle drie historische photo-findings zijn
resolved en er zijn geen nieuwe bevindingen.

## Journal

- 2026-08-03: ticket tijdens shaping geopend. Geen implementatie, test, build,
  vaultwrite buiten `.10x/`, commit, push of release uitgevoerd.
- 2026-08-03: geactiveerd nadat het layoutticket onafhankelijk PASS kreeg en als
  `done` is gesloten; de reeds gegeven expliciete implementatieautorisatie is
  hiermee uitvoerbaar voor precies dit childticket. Uitvoering moet de bestaande
  dirty baseline behouden zonder clean, revert of staging en vóór ieder
  Node/npm-commando de Node-24-handshake gebruiken met
  `export PATH=/home/nms/.local/node24/bin:$PATH`, `command -v node`,
  `node --version` en `npm --version`. Acceptancecriteria blijven unchecked en
  onafhankelijke Review blijft pending tot na TDD-uitvoering en de vereiste
  gates. Geen live-vaultwrite of binary assetoperatie; commit en push blijven
  uitgesteld tot beide childtickets, reviews en de canonieke eindgate compleet
  zijn.
- 2026-08-03: query-slice bootstrapcommando
  `export PATH=/home/nms/.local/node24/bin:$PATH && npm run test:node -- --run test/person-photo.test.ts -t "queries supported photos only from the exact dossier boundary and its descendants"`
  eindigde vóór testuitvoering met exit 1 (`Missing script: "test:node"`) en telt
  daarom niet als RED-bewijs. Assertion-grade RED daarna met
  `export PATH=/home/nms/.local/node24/bin:$PATH && npx vitest run --project node test/person-photo.test.ts -t "queries supported photos only from the exact dossier boundary and its descendants"`:
  1 test failed, 5 skipped, 1 testbestand failed; de verwachte twee lokale
  full-path-identiteiten werden vergeleken met `undefined` omdat de pure
  dossierquery nog ontbrak.
- 2026-08-03: de eerste query-GREEN-poging met hetzelfde gerichte commando
  bereikte wel beide juiste lokale paden, maar faalde 1 test (5 skipped) alleen
  op een niet-vereiste inputvolgorde. De test is gecorrigeerd naar een
  volgorde-onafhankelijke full-path-set zonder het gedragscontract te verzwakken.
  Het gerichte GREEN-commando
  `export PATH=/home/nms/.local/node24/bin:$PATH && npx vitest run --project node test/person-photo.test.ts -t "queries supported photos only from the exact dossier boundary and its descendants"`
  gaf daarna 1 passed, 5 skipped, 1 testbestand passed. De verplichte volledige
  betrokken-file-run
  `export PATH=/home/nms/.local/node24/bin:$PATH && npx vitest run --project node test/person-photo.test.ts`
  gaf 6 passed, 1 testbestand passed. De pure query filtert op de expliciete
  `<dossier>/`-prefix en hercontroleert ondersteunde canonieke assetpaden; de
  twee lokale duplicate basenames blijven distincte full-path-identiteiten.
- 2026-08-03: canonieke-dossiergrens assertion-grade RED met
  `export PATH=/home/nms/.local/node24/bin:$PATH && npx vitest run --project node test/person-form.test.ts -t "derives one stable dossier only from a canonical current profile-note boundary"`:
  1 failed, 32 skipped, 1 testbestand failed. Beide canonieke profielnoten
  leverden `undefined` in plaats van hetzelfde verwachte UUID-suffixdossier;
  flat, nested, root-vreemd en suffix-vreemd bleven fail-closed.
- 2026-08-03: canonieke-dossiergrens GREEN met hetzelfde gerichte commando:
  1 passed, 32 skipped, 1 testbestand passed. De volledige betrokken-file-run
  `export PATH=/home/nms/.local/node24/bin:$PATH && npx vitest run --project node test/person-form.test.ts`
  gaf 33 passed, 1 testbestand passed. `personDossierPathFromProfile` gebruikt
  de actuele People-root, de exacte `Profiles/<slug>--<UUID8>/<note>.md`-vorm en
  de ID-suffix; zowel de oude als hernoemde profielbestandsnaam leidt naar
  hetzelfde bestaande dossier zonder naamafleiding van de folder.

- 2026-08-03: continuation Slice A begon vanuit de door de parent onder Node 24
  assertion-grade vastgelegde open form-RED: `npm run typecheck` had exact vier
  `TS2554`-fouten op de gewenste zesde constructordependency en
  `npm exec -- vitest run --project node test/person-form.test.ts` had 5 failures
  (outside dossier, sibling dossier, prefix-lookalike, ontbrekende canonieke
  dossiergrens en create-injectie) naast 34 passes. De minimale GREEN voegde een
  backwards-compatible, fail-closed People-rootgetter toe; de echte modal geeft
  steeds `getSettings().peopleRootFolder` door. Create-pending-selectie faalt nu
  met de verplichte tweede-stapuitleg. Edit leidt de grens af met
  `personDossierPathFromProfile(...)`, valideert de bestaande canonical/stale/
  unique-regel en filtert daarna exact via `dossierPersonPhotoAssets(...)`.
  Buiten-, sibling- en prefix-lookalikepaden bereiken de mutationport niet; een
  lokale descendant blijft geldig en rename blijft binnen hetzelfde dossier.
- 2026-08-03: gerichte Slice-A-GREEN onder runtime
  `/home/nms/.local/node24/bin/node`, Node `v24.18.1`, npm `11.16.0`:
  `npm exec -- vitest run --project node test/person-form.test.ts -t "rejects a
  selected photo|accepts one exact local descendant|rejects a selected photo
  when|rejects a photo selection on create"` => exit 0, 6 passed + 33 skipped.
  De eerste volledige file-run maakte eerlijk één verwachte contractverschuiving
  zichtbaar: de oude stale-selectietest gebruikte create en verwachtte daardoor
  nog de stale-melding, terwijl iedere create-pending-selectie nu bewust eerst de
  dossier-tweestap meldt. Dezelfde bestaande stale/no-write-asserties zijn zonder
  verzwakking op een canonieke editfixture gezet. Daarna gaf
  `npm exec -- vitest run --project node test/person-form.test.ts` exit 0, 39/39;
  `npm run typecheck` gaf exit 0 zonder diagnostiek. Alle npm-commando's bevatten
  vooraf de vereiste PATH plus `command -v node`, `node --version` en
  `npm --version`-handshake.

- 2026-08-03: Slice B centrale mutationboundary begon strikt test-first. De
  mutationharness telt nu iedere `processFrontMatter`-aanroep en iedere
  renamepoging apart van een geslaagde hostcommit en gebruikt voor assets echte
  gecontroleerde `TFile`-instanties. Exact RED-commando onder dezelfde verplichte
  Node-24-handshake: `npm exec -- vitest run --project node
  test/mutation-service.test.ts -t "central photo boundary|allows explicit photo
  clear|preserves an unrelated authored photo"` => exit 1, 8 failed + 3 passed +
  54 skipped. Alle acht negatieve rijen resolve-den aantoonbaar ten onrechte na
  `processFrontMatter` én rename naar `Alice Admin.md`: bestaand supported asset
  buiten dossier, sibling, prefix-lookalike, missing lokaal, unsupported lokaal,
  raw noncanonical path, alias-wikilink en embed-wikilink. De drie al bestaande
  veilige gedragingen waren eerlijk direct GREEN: exacte lokale descendant,
  expliciete `null`-clear en afwezige photo-update met byte-exact behoud van een
  oude externe/aliased waarde.
- 2026-08-03: minimale Slice-B-GREEN valideert alleen een expliciete niet-null
  `writeUpdates.photo`. De boundary vereist byte-exact `[[<supported path>]]`,
  haalt exact dat bestaande object op en eist een echte `TFile`, leidt daarna de
  huidige dossiergrens af uit de actuele settingsroot, het huidige profielpad en
  de live gelezen huidige `person_id` via `personDossierPathFromProfile(...)`, en
  hergebruikt `dossierPersonPhotoAssets(...)` voor exact-descendantcontrole.
  Geen basename- of resolutiegissing en geen binary API is toegevoegd. Validatie
  staat vóór `processFrontMatter` en rename; `null` blijft clear en afwezigheid
  blijft preserve. Hetzelfde gerichte commando werd exit 0, 11 passed + 54
  skipped. De volledige `npm exec -- vitest run --project node
  test/mutation-service.test.ts` werd daarna exit 0, 65/65. Negatieve assertions
  bewijzen nul frontmatter-aanroepen, nul commits, nul renamepogingen,
  ongewijzigde personnote en object-identiek/ongewijzigd assetobject.

- 2026-08-03: Slice C voegde zonder productiecode een pure fail-closedmatrix toe
  voor lege, whitespace/absolute, backslash-, dubbele-separator-, dotsegment- en
  trailing-slash-dossiergrenzen. De eerste observatie was eerlijk direct GREEN:
  `npm exec -- vitest run --project node test/person-photo.test.ts -t
  "malformed dossier boundary"` => exit 0, 7 passed + 6 skipped. Dit bevestigt
  uitsluitend dat de bestaande exacte prefixquery zulke malformed grenzen niet
  normaliseert of verruimt; de eerdere boundarytest blijft de canonieke
  descendant- en prefix-lookalike-invariant dragen.
- 2026-08-03: finale continuation-verificatie na de semantische changes gaf
  aanvankelijk een uitsluitend formatter-RED: `npm run format:check` stopte met
  5 layoutvoorstellen in de al gewijzigde photo/form/mutation source en tests;
  geen test/typecheck/build draaide in dit formatcommando. Exact die vijf
  semantics-vrije layouts zijn toegepast. Daarna waren onder iedere afzonderlijk
  herhaalde Node-24-handshake GREEN: `npm exec -- vitest run --project node
  test/mutation-service.test.ts test/person-form.test.ts test/person-photo.test.ts`
  => 3 files/117 tests (65 + 39 + 13); `npm run typecheck` exit 0 zonder
  diagnostiek; `npm run format:check` exit 0 over 157 files. Tracked
  `git diff --check` was leeg/exit 0 en de add-only no-indexcheck van dit
  untracked ticket had de verwachte exit 1 met nul outputbytes. De dirty baseline
  bleef behouden; niets is gecleand, gerevert, gestaged, gecommit of gepusht en
  er is geen live-vault- of binary assetoperatie uitgevoerd.
- 2026-08-03: deze continuation stopt bewust vóór modal/browser/integration en
  vóór de brede `check`/build/reproducibility-gates. Volgende continuation moet de
  pickerquery/create-hint en publieke Save/Cancel/keyboard/owner-documentflow in
  browser en gecontroleerde integratie aansluiten en daarna de volledige
  ticketgates uitvoeren. Daarom blijven alle ticketcriteria unchecked, status
  `active` en onafhankelijke Review `Pending`.
- 2026-08-03: modal Slice D begon met het canoniseren van de echte browserpicker-
  fixture naar persoon `person-11112222-3333-4444-aaaa-bbbbbbbbbbbb`, profiel
  `People/Profiles/alex-example--11112222/Alex Example.md`, twee ondersteunde
  lokale full-path-assets en expliciete vreemde duplicate basenames buiten het
  dossier, in een siblingdossier en in een prefix-lookalike. Assertion-grade RED
  onder `/home/nms/.local/node24/bin/node` (`v24.18.1`, npm `11.16.0`) met
  `npm exec -- vitest run --project browser test/browser/person-modal.browser.test.ts -t
  "selects duplicate-named vault images by exact path during edit and writes only on Save"`
  gaf exit 1, 1 failed + 13 skipped. De verwachte placeholder plus twee lokale
  opties kreeg aantoonbaar ook `Assets/Alex.jpg`, het siblingpad en het
  prefix-lookalikepad terug van de nog globale pickerquery. De failure zat dus in
  de bedoelde dossierfilterassertie, niet in fixturebootstrap of compilerload.
- 2026-08-03: minimale modal Slice-D-GREEN laat `currentPhotoAssets()` bij iedere
  aanroep de actuele settingsroot, het actuele editprofielpad en de UUID-backed
  person-ID door `personDossierPathFromProfile(...)` halen; zonder grens is de
  lijst leeg, anders filtert dezelfde callback de actuele ondersteunde vaultfiles
  via `dossierPersonPhotoAssets(...)`. Picker en form-session delen die callback.
  Zichtbare copy is compact dossierlokaal gemaakt zonder accessibility-ID's of
  full-path-identiteit te wijzigen. Een afzonderlijke label-RED gaf 1 failed + 13
  skipped met de assertiondiff `Search dossier images`/`Dossier image` versus de
  oude vaultlabels; na GREEN gaf de gecombineerde gerichte run 2 passed + 12
  skipped. De volledige browserfile gaf 14/14. Daarna bleven ook de ongewijzigde
  integratiefile 2/2, de Node-scope 117/117 (65 + 39 + 13), typecheck en
  `format:check` (157 files) GREEN. Alle npm-runs gebruikten opnieuw de expliciet
  getoonde Node-24-handshake. Preview-, Save-, keyboard-, lifecycle-, narrow- en
  ownerDocumentasserties bleven in die volledige browserrun behouden.
- 2026-08-03: create-hint Slice E begon assertion-grade met
  `npm exec -- vitest run --project browser test/browser/person-modal.browser.test.ts -t
  "explains the create photo steps accessibly and keeps Cancel and host close mutation-free"`
  onder de vereiste Node-24-handshake. Resultaat: exit 1, 1 failed + 14 skipped;
  de publieke create-DOM-query naar `[role="note"]` kreeg exact `null`. De test
  legt daarnaast vooraf vast dat create geen Photo/search/select/listeners heeft,
  en gebruikt twee verse modalinstanties voor respectievelijk Cancel en de
  publieke host-close/onClose-seam die Escape/backdrop representeert.
- 2026-08-03: minimale create-hint-GREEN voegde uitsluitend in create, direct na
  Name, één zichtbare paragraaf met `role="note"` toe: eerst Save voor
  person+dossier, daarna zelf een image in het eigen dossier plaatsen, vervolgens
  via Edit kiezen. De copy claimt geen upload of import en er is geen eigen
  Escape-handler toegevoegd. Gerichte GREEN: 1 passed + 14 skipped. Volledige
  betrokken browserfile: 15/15; integratiefile: 2/2; Node-scope: 117/117;
  typecheck en `format:check` (157 files) GREEN. De twee publieke exitpaden
  bewezen afzonderlijk nul create/update, nul fotolisteners en host-close cleanup.
- 2026-08-03: controlled integration Slice F is test-first toegevoegd tegen één
  echte `PeopleAtlasPlugin`, zijn echte `AtlasMutationService` en
  `ControlledObsidianRuntime`. De eerste gerichte observatie met
  `npm exec -- vitest run --project integration test/integration/person-photo.integration.test.ts -t
  "rejects an outside photo before frontmatter write and changes only photo for a local Edit-Save"`
  was eerlijk direct GREEN: 1 passed + 2 skipped. Er is geen kunstmatige RED
  gefabriceerd en geen productiecode voor deze slice gewijzigd, omdat de eerdere
  centrale mutationboundary de geteste reject/write-semantiek al leverde. De test
  seedt het UUID-profiel, een lokale descendant en gelijknamige globale plus
  siblingassets; een expliciete globale update reject vóór `processFrontMatter`,
  de lokale update doet exact één frontmattercall en voegt alleen `photo` toe.
  Objectidentiteit, alle paden, mtimes, sizes, assetfrontmatter, filevolgorde en
  fileaantal blijven gelijk. Na aanscherping dat exact het globale outsidepad de
  negatieve call voert, gaf de volledige integratiefile 3/3.
- 2026-08-03: een aanvullende test-only driftassertie was bij eerste observatie
  direct GREEN (1 passed + 15 skipped): na een pending lokale selectie verandert
  de actuele People-root, waarna dezelfde modal de picker bij het volgende
  assetevent leeg maakt en Save zonder mutation op de ontbrekende actuele
  canonieke dossiergrens faalt. Dit bevestigt de gedeelde actuele callback zonder
  extra productiecode of testhook.
- 2026-08-03: finale scoped verificatie van deze continuation onder iedere keer
  opnieuw getoonde `/home/nms/.local/node24/bin`-handshake (Node `v24.18.1`, npm
  `11.16.0`) was GREEN: browser `person-modal` 16/16; controlled integration
  `person-photo` 3/3; Node mutation/form/photo 117/117 (65 + 39 + 13);
  `npm run typecheck` exit 0; `npm run format:check` 157 files zonder fixes;
  tracked `git diff --check` exit 0; add-only ticket-no-indexcheck de verwachte
  exit 1 met nul outputbytes. Geen failure-screenshot bleef achter. De brede
  eindgates `npm run check`, `npm run build` en `npm run verify:reproducible`
  blijven bewust voor de afzonderlijke continuation. Status blijft `active`,
  criteria blijven unchecked en onafhankelijke Review blijft `Pending`; niets
  is gecleand, gerevert, gestaged, gecommit of gepusht.
- 2026-08-03: de volledige canonieke eindgate begon na herlezing van de lokale
  10x-skill, `AGENTS.md`, `ARCHITECTURE.md`, dit ticket en zijn references, de
  volledige actuele diff en de package-/gatescripts. Vóór ieder npm-commando is
  opnieuw exact de vereiste handshake getoond en afgedwongen:
  `/home/nms/.local/node24/bin/node`, Node `v24.18.1`, npm `11.16.0`.
  `npm run check` was bij de eerste en enige run exit 0: formatter 157 files
  zonder fixes; lint zonder errors met alleen de reeds bestaande
  `test/obsidian-stub.ts`-waarschuwing `noConfusingVoidType`; typecheck GREEN;
  node 808/808 in 48 files, browser 83/83 in 10 files, integration 27/27 in 8
  files en browser-matrix 6/6 in 3 files, samen 924/924 tests in 69 files. Er
  waren geen retries, timeouts, skips, formatteredits of assertion-/
  timeoutverzwakkingen. Dezelfde check leverde een production build,
  releasecontract GREEN voor `main.js` 355283/409600 bytes en community
  readiness GREEN over 58 sourcefiles.
- 2026-08-03: de expliciete vervolgcommando's onder opnieuw getoonde en
  afgedwongen Node-24/npm-11-handshake waren eveneens GREEN. `npm run build`
  was exit 0 en omvatte `tsc --noEmit` plus production esbuild.
  `npm run verify:reproducible` was exit 0 met twee bytegelijke `main.js`-builds:
  eerste SHA-256
  `bb59590839669a63718c8b25fa641562db3a7908ba18a8b3a85bdfaee57f69b3`
  en tweede SHA-256
  `bb59590839669a63718c8b25fa641562db3a7908ba18a8b3a85bdfaee57f69b3`;
  de tweede build bleef als artifact staan en was 355283 bytes.
- 2026-08-03: actuele statusinventarisatie vóór de whitespacechecks bevatte de
  behouden dirty baseline van 30 tracked modified en precies 7 bedoelde
  untracked files. `git diff --check` was exit 0 met nul outputbytes. De zeven
  afzonderlijke `git diff --no-index --check /dev/null <pad>`-checks voor de zes
  untracked dossierrecords en `src/domain/people-paths.ts` hadden ieder de
  verwachte add-only diff-exit 1 met nul outputbytes; er is dus geen echte
  whitespacefout. Branch bleef `main`, HEAD bleef
  `ff2459a55c239ea366a821041a41d231ca966da7`, de staged diff was leeg en
  `package.json`/`package-lock.json` hadden geen diff. Hun SHA-256 bleef
  respectievelijk
  `ce8f6d7809e9fa551b6b025dded417c9f27cc5225627fe36f118de2f349bc9fb`
  en `313fcd37b3e17f17d88c0e987c6f66ccc734eb326d5f1cae27cf179b11c80538`.
- 2026-08-03: de contextbewuste finale scan omvatte exact alle 257 toegevoegde
  productieregels in `src/`, inclusief alle 87 regels van de untracked pure
  `people-paths.ts`. Zij vond 0 networkcalls/URL's, 0 externe filesystemwrites,
  0 dynamic HTML-sinks, 0 `eval`/`Function`, 0 subprocess-/shell-executie, 0
  secret-like assignments, 0 binary asset-API's, 0 directe adaptermutaties en 0
  directe `Vault.delete`/trash. De drie expliciete interne vaultwrites zijn de
  reeds onafhankelijk gereviewde layoutwrites: `vault.create(path, profile)`
  voor de canonieke profielnote, `vault.createFolder(current)` voor
  dossier/ancestors en de veilige best-effort
  `FileManager.trashFile(createdDossier)` uitsluitend voor een door dezelfde
  transactie gemaakte, live-identieke, nog lege dossiermap na een mislukte
  profielwrite. Geen daarvan target een foto of ander asset. Er is geen nieuwe
  `processFrontMatter`- of `renameFile`-call toegevoegd; de bestaande expliciete
  Edit-Save-frontmatterseam en same-dossier profielnoterename blijven
  ongewijzigd.
- 2026-08-03: de fotoscopecontrole vond 0 upload/copy/move/rename/delete/import/
  crop-call voor assets en geen wijziging onder `src/render/`, `src/index/`,
  `src/bases/`, `src/person-photo-resource.ts` of `styles.css`. De gewijzigde
  relationship-/contactmomentfiles bevatten uitsluitend de reeds gereviewde
  parent-layoutdelegatie naar één root en centrale collecties; de fotoslice is
  beperkt tot person-photo/form/modal plus de centrale person-mutationvalidator
  en hergebruikt de parent-owned dossierseam. Vitest aliast `obsidian` voor alle
  vier projecten naar `test/obsidian-stub.ts`; integration gebruikt de
  gecontroleerde runtime. De uitgevoerde commands raakten dus geen live
  Obsidian-vault. Er is geen dependency-/lockfile-/binary-assetoperatie,
  live-vaultwrite, clean, revert, stage, commit, push, tag of release uitgevoerd.
- 2026-08-03: vóór de enige toegestane recordupdate waren parentplan en gesloten
  layoutticket byte-exact op SHA-256
  `6b8e053b4e37d2e65f6a96d4bdcf1002e8e7f68189173863a654aefd2734c071`
  respectievelijk
  `d9c2b0d64ab69c55c9b44b44d495257e4414ec5bfa197eead3939bbd686e271c`;
  dit fototicket was
  `398c8e7eeb3418da96b0da8a09033412317212340aea3055390123673a9dfa62`.
  De deterministische fingerprint van alle 36 dirty files buiten dit ticket was
  `dd11a4c5a488084b5a5a1098a627c4adc184ac73a0ae25a586dd40e6217754e3`.
  Met bovenstaande actuele behavior-, gate-, whitespace-, scan- en
  hygiene-evidence zijn alle zeven criteria afgevinkt. Status blijft bewust
  `active`; alleen een verse onafhankelijke review mag closure beoordelen.
- 2026-08-03: de eerste onafhankelijke photo-review
  (`/home/nms/.hermes/cache/delegation/subagent-summary-0-20260803_181907_713145.txt`)
  gaf exact **FAIL** met twee open blockers. **HIGH — stale photo-asset TOCTOU:**
  de directe productie-`AtlasMutationService.updatePerson()` accepteerde tijdens
  preflight één bestaande, ondersteunde, exact dossierlokale `TFile`, waarna de
  gecontroleerde `processFrontMatter`-seam het asset vóór de callback verwijderde.
  De call fulfilled desondanks, de callback was betreden en schreef
  `[[People/Profiles/alice--11112222/Portrait.jpg]]` terwijl het asset niet meer
  bestond; `custom` bleef `keep`. Een rename/path-objectwijziging in hetzelfde
  venster heeft dezelfde stale uitkomst en een bevestigde profielrename kan na de
  frontmatterwrite doorgaan. Impact: criterium 2 en de centrale stale/no-writeclaim
  falen. Advies: hercontroleer voor iedere expliciete non-null photo ín de
  `processFrontMatter`-callback en vóór `apply`: actuele settings/root en
  `file.path`, live `person_id` uit callbackfrontmatter, opnieuw afgeleide
  dossiergrens, exacte `vault.getAbstractFileByPath(photoPath)`, echte `TFile`
  met byte-exact objectpad, ondersteunde canonieke grammar en exacte descendant;
  werp bij iedere mismatch een `MutationError` zodat callback/hostcommit en
  profielrename stoppen. Alleen het onvermijdelijke post-callback/pre-hostcommit-
  venster blijft zonder unsupported note+assettransactie bestaan.
  **MEDIUM — trailing-slash People-root:** exacte schema-8-settings met `People/`
  bleven write-enabled en byte-exact als `People/` opgeslagen, terwijl de
  layouthelpers naar `People` normaliseerden en
  `personDossierPathFromProfile()` daarom geen dossier kon afleiden; de modal
  toonde geen lokale opties en een directe update met een bestaande lokale
  `TFile` rejectte vóór frontmatter. Dezelfde foutklasse geldt voor
  `Second Brain/People/` en meerdere trailing separators. Impact: criteria 1 en
  3 zijn niet volledig gehaald en de loader/UI laten een write-enabled root toe
  die photo-consumers fail-closed onbruikbaar maakt. Advies volgens schema-8/
  no-migration: verwerp iedere na trim op `/` eindigende People-root centraal in
  `validatePeopleRootFolder`, laat loader en Settings UI exact die validator
  delen, reset in-memory naar defaults/read-only en wijzig of normaliseer de raw
  stored input niet. Conform het reviewresultaat zijn criteria 1, 2, 3, 6 en 7
  teruggezet naar `[ ]`; criteria 4 en 5 blijven `[x]`, status blijft `active`.
- 2026-08-03: HIGH-remediation begon strikt assertion-grade tegen de directe
  productie-`AtlasMutationService`. De mutationharness voert de externe
  asset-lifecycle nu deterministisch uit nadat preflight is geslaagd en
  `processFrontMatter` is aangeroepen, maar vóór de callback. De gerichte RED-run
  `npm exec -- vitest run --project node test/mutation-service.test.ts -t
  "atomically rejects a local photo"` onder getoonde Node-24-handshake gaf exit
  1: 2 failed + 65 skipped. Zowel delete als live `TFile.path`-rename/pathobject-
  aanpassing fulfilled ten onrechte; iedere case had 1 callbackaanroep, 1
  hostcommit en de bevestigde profielrename naar `Alice Admin.md`. De stale
  canonical wikilink plus gewijzigde naam stonden in de commit, terwijl de oude
  byte-exacte `photo`, identiteit en `custom: keep` niet behouden bleven.
- 2026-08-03: minimale HIGH-GREEN centraliseert preflight en callback in één
  private, mutationvrije validatieseam. Een expliciete non-null photo wordt in de
  callback vóór iedere `apply` opnieuw gevalideerd met actuele `getSettings()`,
  actuele People-root/person-ID-property, actuele `file.path`, live person-ID uit
  callbackfrontmatter, exacte `getAbstractFileByPath`, echte `TFile` plus
  byte-exact objectpad, canonical supported `[[path]]` en exact dossierdescendant.
  Mismatch werpt primair `MutationError` met missing-photo-uitleg; null-clear en
  afwezige preserve blijven buiten deze hercontrole. Gerichte GREEN: 2 passed +
  65 skipped. De toen volledige betrokken mutationfile was 67/67. Beide races
  bewijzen nu 1 callbackaanroep maar 0 hostcommits, 0 plugin-renamepogingen, geen
  profielrename en byte-exact behoud van identiteit/photo/custom; alleen de
  expliciet door de harness gesimuleerde externe asset-delete respectievelijk
  assetrename vindt plaats. Een broncomment documenteert uitsluitend het
  onvermijdelijke residual window na callbackreturn en vóór hostcommit; er is
  geen unsupported note+assettransactie of binary API toegevoegd.
- 2026-08-03: MEDIUM-remediation begon afzonderlijk test-first. Exact schema 8
  `People/` en `Second Brain/People/` kregen loaderasserties voor read-only
  defaults, duidelijke invalid-rootmelding en byte-exact ongewijzigde raw input;
  dezelfde waarden kregen Settings-UI-asserties tegen exact de gedeelde centrale
  validator. Gerichte RED over `settings-load` en `settings-tab`: exit 1, 4
  failed + 44 skipped in 2 files. Beide loadercases waren aantoonbaar nog
  `writeEnabled: true` met de trailing root in settings en `error: undefined`;
  beide UI-validatorcases retourneerden `undefined`.
- 2026-08-03: minimale MEDIUM-GREEN wijzigt uitsluitend
  `validatePeopleRootFolder`: na trim is iedere afsluitende `/` (dus ook meerdere)
  ongeldig en de segmentcontrole normaliseert hem niet meer weg. Loader en UI
  delen dezelfde validator; schema blijft 8 en veilige Unicode, spaties en `&`
  blijven door de bestaande validatiematrix toegestaan. Gerichte GREEN: 4 passed
  + 44 skipped in 2 files; volledige settingsfiles: 48/48 (29 loader + 19 tab).
  Raw stored input wordt niet gesanitized of gemigreerd en een reject gebruikt
  in-memory defaults met writes disabled.
- 2026-08-03: twee gerichte defense-in-depth-tests zijn test-only toegevoegd en
  waren bij eerste observatie eerlijk direct GREEN, dus hiervoor kwam geen
  productiecode. Centrale update met rechtstreeks geïnjecteerd `People/` gaf 1
  passed + 67 skipped en bewees 0 frontmattercalls, 0 hostcommits, 0 rename en
  ongewijzigde person/assetobjecten. De browsermodal met een pending lokale
  selectie en daarna rechtstreeks geïnjecteerd `People/` gaf 1 passed + 16
  skipped: geen pickeroptie, zichtbare fail-closed Save-fout, geen update en geen
  close.
- 2026-08-03: na de semantische GREEN-runs was de eerste scoped
  `format:check` eerlijk exit 1 met uitsluitend layoutvoorstellen in 4 gewijzigde
  files. Een gerichte Biome-write over de 6 remediationfiles fixte precies die 4
  layouts; geen ander bestand werd geformatteerd. Een poging tot
  `npm run check:diff-safety` was een command mismatch (`Missing script`) en geen
  product- of gatefailure; `package.json` definieert geen diffscript, zodat de
  vereiste diff-check vervolgens als `git diff --check` is uitgevoerd.
- 2026-08-03: finale scoped verificatie na formatting was volledig GREEN onder
  telkens getoonde `/home/nms/.local/node-v24.18.1-linux-x64/bin/node`, Node
  `v24.18.1`, npm `11.16.0`: Node 168/168 in 5 files (`mutation-service` 68,
  `settings-load` 29, `settings-tab` 19, `person-photo` 13, `person-form` 39);
  Chromium `person-modal` 17/17; controlled Chromium `person-photo` integration
  3/3; `npm run typecheck` exit 0; `npm run format:check` 157 files zonder fixes;
  `git diff --check` leeg/exit 0. De dirty baseline bleef aanwezig, staged diff
  bleef leeg en er was geen dependency-/lockfile-/live-vault-/binary-asset-
  operatie, clean, revert, commit of push.
- 2026-08-03: remediation stopt bewust met status `active`. Alleen criteria 1,
  2, 3 en 6 zijn opnieuw `[x]`; criterium 7 blijft `[ ]`. De brede canonieke
  gates zijn na deze codewijziging niet herhaald en een verse onafhankelijke
  rereview is niet uitgevoerd. Daarom blijft Review FAIL tot die afzonderlijke
  stappen zijn afgerond.
- 2026-08-03: de na-remediation eindgate is uitgevoerd na herlezing van de
  lokale 10x-skill, `AGENTS.md`, `ARCHITECTURE.md`, dit ticket, beide
  review-/remediationhandoffs, de actuele source-/testdiff en de package- en
  gatescripts. Vóór ieder npm-commando wees de verplichte handshake naar
  `/home/nms/.local/node24/bin/node`, Node `v24.18.1` en npm `11.16.0`.
  De eerste en enige actuele `npm run check` was exit 0: formatter 157 files
  zonder fixes; lint zonder errors met uitsluitend de reeds bestaande
  `test/obsidian-stub.ts`-waarschuwing `noConfusingVoidType`; typecheck GREEN;
  node 815/815 in 48 files, browser 84/84 in 10 files, integration 27/27 in 8
  files en browser-matrix 6/6 in 3 files, samen 932/932 tests in 69 files. Er
  waren geen retries, timeouts, skips, formatteredits of assertion-/
  timeoutverzwakkingen. Dezelfde check leverde een production build,
  releasecontract GREEN voor `main.js` 355591/409600 bytes en community
  readiness GREEN over 58 sourcefiles.
- 2026-08-03: de expliciete `npm run build` was onder een nieuwe handshake exit
  0 en omvatte `tsc --noEmit` plus production esbuild. De daaropvolgende
  `npm run verify:reproducible` was onder opnieuw een nieuwe handshake exit 0:
  de eerste en tweede `main.js` hadden beide exact SHA-256
  `b9a0ed3858688f7700e05dc0b3ef4db2a496d06abbf0411694b6992734e21446`.
  De tweede build bleef als artifact staan en was exact 355591 bytes.
- 2026-08-03: de huidige dirty baseline bleef 30 tracked modified plus precies
  7 bedoelde untracked files. `git diff --check` was exit 0 met nul
  outputbytes. Alle zeven afzonderlijke
  `git diff --no-index --check /dev/null <pad>`-checks voor de zes untracked
  dossierrecords en `src/domain/people-paths.ts` hadden de verwachte add-only
  exit 1 met nul outputbytes. Branch bleef `main`, HEAD bleef
  `ff2459a55c239ea366a821041a41d231ca966da7`, de staged naam- en contentdiff
  waren beide leeg en `package.json`/`package-lock.json` hadden exit 0/geen
  diff. Hun SHA-256 bleef respectievelijk
  `ce8f6d7809e9fa551b6b025dded417c9f27cc5225627fe36f118de2f349bc9fb`
  en `313fcd37b3e17f17d88c0e987c6f66ccc734eb326d5f1cae27cf179b11c80538`.
  Parentplan en gesloten layoutticket bleven vóór deze recordupdate byte-exact
  op `6b8e053b4e37d2e65f6a96d4bdcf1002e8e7f68189173863a654aefd2734c071`
  respectievelijk
  `d9c2b0d64ab69c55c9b44b44d495257e4414ec5bfa197eead3939bbd686e271c`;
  de deterministische fingerprint van de 36 dirty files buiten dit ticket was
  `8587eab89a2f0863c876ed440ad2f99a3ca1a6e38632f989a49f8365542ab042`.
- 2026-08-03: de contextbewuste scan omvatte alle 369 toegevoegde
  productieregels in `src/`: 282 tracked diffregels plus alle 87 regels van de
  untracked pure `people-paths.ts`. Zij vond 0 network-/URL-calls, 0 externe
  filesystem-API's, 0 dynamic HTML-sinks, 0 `eval`/`Function`, 0 subprocess-/
  shell-executie, 0 secret-like assignments en 0 binary asset-API's. De enige
  lexicale member-`exec` is `PERSON_UUID_PATTERN.exec(...)`, een lokale
  `RegExp.exec` zonder procesuitvoering. De exact drie toegevoegde write-API-
  kandidaten zijn uitsluitend de reeds onafhankelijk gereviewde parent-layout-
  writes: `vault.create(path, generated profile Markdown)` voor de canonieke
  profielnote, `vault.createFolder(current)` voor dossier/ancestors en veilige
  `FileManager.trashFile(createdDossier)` alleen voor de transaction-created,
  live-identieke, nog lege dossiermap na een mislukte profielwrite. Geen target
  is een foto of asset; er waren 0 photo-/asset-mutationcallkandidaten.
- 2026-08-03: de fotoscope bleef zonder upload/copy/move/rename/delete/import/
  crop en zonder wijziging onder `src/render/`, `src/index/`, `src/bases/`,
  `src/person-photo-resource.ts` of `styles.css`. De vijf gewijzigde
  relationship-/contactmomentproductiepaden bevatten uitsluitend de reeds
  gereviewde parent-layoutdelegatie naar centrale, uit één root afgeleide
  collecties; geen toegevoegde regel daar bevat photo-/assetgedrag. De nieuwe
  callbackhercontrole in `updatePerson()` is voor assets plugin-mutationvrij:
  zij leest actuele settings en callbackfrontmatter, leidt de actuele
  dossiergrens af en doet alleen een exacte `getAbstractFileByPath`-/`TFile`-
  validatie vóór `apply`; bij delete of live path-object-rename werpt zij vóór
  hostcommit en vóór de bestaande profielrename. Zij uploadt, kopieert,
  verplaatst, hernoemt, verwijdert, importeert of cropt geen asset. Alleen het
  gedocumenteerde host-API-venster na callbackreturn en vóór de interne
  frontmattercommit blijft zonder unsupported note-plus-assettransactie bestaan.
- 2026-08-03: met deze actuele na-remediation behavior-, gate-, build-,
  reproducibility-, whitespace-, hygiene-, security- en scope-evidence zijn alle
  zeven criteria opnieuw `[x]`. Status blijft bewust `active`; de eerste FAIL
  blijft van kracht tot een verse onafhankelijke rereview de huidige worktree
  probeert te falsifiëren. Er is geen live-vault-, dependency-, lockfile- of
  binary assetoperatie, clean, revert, stage, commit, push, tag of release
  uitgevoerd.
- 2026-08-03: de tweede onafhankelijke rereview
  (`/home/nms/.hermes/cache/delegation/subagent-summary-0-20260803_190500_697022.txt`)
  gaf opnieuw **FAIL**. De eerdere HIGH callback-TOCTOU en MEDIUM trailing-root
  bevindingen zijn expliciet `RESOLVED`, maar één nieuwe **MEDIUM** blijft open:
  een rechtstreeks geïnjecteerde People-root die de centrale
  `validatePeopleRootFolder()` terecht afwijst, wordt door
  `personDossierPathFromProfile()`, de modalquery en de centrale
  mutationboundary toch geaccepteerd. De productie-repro gebruikte
  `Second Brain/People[Archive` met een bestaand canoniek profiel en een echte
  lokale ondersteunde `TFile`; de helper leidde een dossier af, de modal kon de
  asset tonen en `AtlasMutationService.updatePerson()` fulfilled met 1
  `processFrontMatter`-callback en 1 hostcommit van de niet-policy-canonieke
  photo-wikilink. Hetzelfde bypassgedrag is gereproduceerd met een enkele `]`,
  `<` en `*`. Impact: de expliciete defense-in-depth voor direct geïnjecteerde
  settings faalt en kan een niet-policy-conforme of ambigu parseerbare
  photo-frontmatterwaarde committen, hoewel de normale loader/UI deze roots wel
  blokkeert. Advies: maak de volledige huidige People-rootgrammar één pure
  authority, laat settingsvalidatie haar publieke API behouden via re-export en
  eis exact dezelfde authority in `personDossierPathFromProfile()` vóór
  normalisatie; dek de volledige unsafe-characterpolicy tabelgedreven op helper,
  modal en mutationboundary, met reject vóór callback/hostcommit/rename en
  update-/closevrije Save. Daarom zijn criteria 1, 2, 3, 6 en 7 teruggezet naar
  `[ ]`; criteria 4 en 5 blijven `[x]`, status blijft `active`.
- 2026-08-03: tweede-remediation begon strikt test-first onder de expliciete
  Node-24-runtime `v24.18.1` en npm `11.16.0`. Eén gedeelde fixturetabel dekt
  leeg/whitespace, backslash en alle `\\<>:\"|?*[]#^`, U+0000/U+001F/U+007F,
  absolute/URL-, dot-, dubbele-separator- en trailing-slashroots. De pure
  helper-RED (`person-form`, filter `canonical dossier authority`) gaf 14 failed,
  8 passed en 39 skipped: onder meer de enkele `<`, `*`, `[` en `]` leverden nog
  een dossierpad; leeg/whitespace/backslash en de vijf reeds door structurele
  padchecks geblokkeerde absolute/URL/dot/dubbele/trailinggevallen waren eerlijk
  direct GREEN. De directe modalquery-RED (`shows no dossier option`) gaf 11
  failed, 11 passed en 38 skipped: `<`, `*`, `[` en `]` toonden ten onrechte de
  lokale asset. De 11 reeds door photo-/padrepresentatie afgevangen gevallen
  waren eerlijk direct GREEN. Een al pending gemaakte veilige selectie gevolgd
  door elk van de 22 geïnjecteerde onveilige roots was eveneens eerlijk direct
  GREEN: 22 passed en 38 skipped, met nul update en nul close op Save.
- 2026-08-03: de eerste mutationmatrixversie bevatte ook een rename-target en was
  daardoor ontoereikend gemaskeerd door de bestaande note-pathvalidator: 22
  direct GREEN zonder de photo-commitbypass te bereiken. Vóór productiecode is
  die test aangescherpt tot uitsluitend een expliciete photo-update onder een
  echt lokaal ondersteund `TFile` en een canoniek gevormd profiel onder de direct
  geïnjecteerde root. De volledige matrix gaf daarna 11 failed, 11 passed en 67
  skipped. De specifieke gerichte repro voor `<`, `*`, `[` en `]` gaf exact 4
  failed en 85 skipped: alle vier fulfilled, riepen `processFrontMatter` eenmaal
  aan, deden één hostcommit en vervingen de oude photo-frontmatter; rename bleef
  nul en het assetobject bleef ongemuteerd. Hiermee is de reviewimpact
  assertion-grade bevestigd. De 11 separator/parsergevallen die al vóór de
  gedeelde authority faalden bleven honest direct GREEN. Door Chromium tijdens
  RED gegenereerde failure-screenshots zijn direct gericht verwijderd; zij zijn
  geen onderdeel van de dirty baseline.
- 2026-08-03: minimale tweede-remediation-GREEN verplaatste de bestaande
  `validatePeopleRootFolder()` byte-exact en zonder policy- of message-drift naar
  de nieuwe pure `src/domain/people-root.ts`. De validator gebruikt één `Set`
  voor exact `\\<>:"|?*[]#^` en een codepointcheck voor U+0000..U+001F plus
  U+007F, zonder control-regex. `src/settings/validate.ts` importeert en
  re-exporteert exact diezelfde functie-identiteit; de lokale unsafe-set en
  duplicaatfunctie zijn verwijderd. Loaderinput met veilige buitenste whitespace
  blijft valide en wordt door `validateSettings()` getrimd; veilige Unicode,
  spaties en `&` blijven toegestaan.
- 2026-08-03: `personDossierPathFromProfile()` roept dezelfde pure authority nu
  direct vóór normalisatie aan en retourneert bij iedere validation error
  `undefined`. De bestaande byte-exacte representatiecheck, UUID-suffix,
  canonieke `Profiles/<slug>--<UUID8>/<note>.md`-structuur en stabiele
  same-dossierrename blijven daarna intact. `peopleCollectionPaths()`,
  `personDossierPath()` en `personProfilePath()` zijn niet gewijzigd; de normale
  write-enable authority blijft de settingsloader en alleen de direct-injected
  photo-consumer defense is gesloten.
- 2026-08-03: de eerste volledige gerichte GREEN-runs onder de getoonde
  `/home/nms/.local/node24/bin/node`-handshake, Node `v24.18.1` en npm `11.16.0`,
  gaven `person-form` 61/61 inclusief alle 22 helpercases,
  `mutation-service` 89/89 inclusief alle 22 reject-vóór-callback/hostcommit/
  renamecases, en Chromium `person-modal` 60/60 inclusief 22 lege-query- en 22
  pending-Savecases. De volledige aanvullende Node-files gaven 61/61 in 3 files
  (`settings-load` 29, `settings-tab` 19, `person-photo` 13); de controlled
  Chromium `person-photo`-integratie gaf 3/3. `npm run typecheck` was exit 0.
- 2026-08-03: de eerste `npm run format:check` na GREEN was eerlijk exit 1 met
  uitsluitend layoutvoorstellen in de drie reeds gewijzigde unsafe-root-
  testfiles. Een gerichte Biome-write formatteerde exact
  `test/person-form.test.ts`, `test/mutation-service.test.ts` en
  `test/browser/person-modal.browser.test.ts`; geen productiecode of ander pad
  werd door de formatter gewijzigd. Daarna zijn alle scoped suites volledig
  herhaald en bleven exact GREEN: form 61/61, mutation 89/89, browsermodal 60/60,
  settings/photo Node 61/61 (29 + 19 + 13), integration 3/3 en typecheck exit 0.
  De herhaalde `format:check` was exit 0 over 159 files zonder fixes.
- 2026-08-03: tracked `git diff --check` was leeg/exit 0. De actuele inventaris
  bevat exact 9 bedoelde untracked add-only files: de eerdere 7 plus
  `src/domain/people-root.ts` en `test/people-root-fixtures.ts`; alle 9
  afzonderlijke `git diff --no-index --check /dev/null <pad>`-checks hadden de
  verwachte add-only exit 1 met nul outputbytes. Branch/HEAD en de dirty baseline
  bleven behouden en staged namen/content bleven leeg; er is niet gecleand,
  gerevert, gestaged, gecommit of gepusht en er was geen dependency-, live-vault-
  of binary assetoperatie.
- 2026-08-03: criteria 1, 2, 3 en 6 zijn na deze tweede remediation opnieuw
  `[x]`; criteria 4 en 5 bleven `[x]` en criterium 7 blijft `[ ]`. Status blijft
  `active`. Conform de evidence-efficiënte volgorde zijn geen brede `check`,
  build- of reproduceerbaarheidsrun en geen review/closure uitgevoerd. Alleen
  één volledige canonieke gate en de finale onafhankelijke rereview blijven open.
- 2026-08-03: daarna is precies één volledige canonieke gate na de tweede
  remediation uitgevoerd; dit is de enige brede run op deze semantisch actuele
  worktree. Vóór ieder van de drie npm-commando's wees de afzonderlijk getoonde
  handshake naar `/home/nms/.local/node24/bin/node`, Node `v24.18.1` en npm
  `11.16.0`. De eerste en enige `npm run check` in deze fase was exit 0:
  formatter 159 files zonder fixes; lint zonder errors met uitsluitend de reeds
  bestaande `test/obsidian-stub.ts`-waarschuwing `noConfusingVoidType`;
  typecheck GREEN; node 858/858 in 48 files, Chromium browser 127/127 in 10
  files, controlled Chromium integration 27/27 in 8 files en browser-matrix 6/6
  in 3 files, samen 1018/1018 tests in 69 files. Er waren geen retries,
  timeouts, skips, formatteredits of assertion-/timeoutwijzigingen. Dezelfde
  check leverde een production build, releasecontract GREEN voor `main.js`
  355611/409600 bytes en community readiness GREEN over 59 sourcefiles.
- 2026-08-03: de expliciete `npm run build` was onder een nieuwe handshake exit
  0 en omvatte `tsc --noEmit` plus production esbuild. De daaropvolgende enige
  `npm run verify:reproducible` was onder opnieuw een nieuwe handshake exit 0:
  eerste en tweede `main.js` hadden beide exact SHA-256
  `e86a5a6715868e4450f8038aa29bbf96a6ffcd71290000040f9aecd81393c3d0`.
  De tweede build bleef als ignored, untracked artifact staan en was exact
  355611 bytes.
- 2026-08-03: de actuele dirty baseline bleef 30 tracked modified plus 9
  bedoelde untracked files. `git diff --check` was exit 0 met nul outputbytes.
  De negen afzonderlijke `git diff --no-index --check /dev/null <pad>`-checks
  voor decision, research, spec, dit ticket, layoutticket, parentplan,
  `src/domain/people-paths.ts`, `src/domain/people-root.ts` en
  `test/people-root-fixtures.ts` hadden ieder de verwachte add-only exit 1 met
  nul outputbytes. Branch bleef `main`, HEAD bleef
  `ff2459a55c239ea366a821041a41d231ca966da7`, staged namen/content bleven leeg en
  `package.json`/`package-lock.json` hadden geen diff. Hun SHA-256 bleef
  respectievelijk
  `ce8f6d7809e9fa551b6b025dded417c9f27cc5225627fe36f118de2f349bc9fb`
  en `313fcd37b3e17f17d88c0e987c6f66ccc734eb326d5f1cae27cf179b11c80538`.
  Vóór deze enige recordupdate bleven parentplan en gesloten layoutticket
  byte-exact op `6b8e053b4e37d2e65f6a96d4bdcf1002e8e7f68189173863a654aefd2734c071`
  respectievelijk
  `d9c2b0d64ab69c55c9b44b44d495257e4414ec5bfa197eead3939bbd686e271c`;
  de deterministische fingerprint van alle 38 dirty files buiten dit ticket was
  `8c04f0957a1ae85821f43f55ce25f88efab1191c41e4f91d3acccc3acb95e8bb`.
- 2026-08-03: de contextbewuste scan omvatte exact alle 378 toegevoegde
  productieregels in `src/`: 269 tracked diffregels plus alle 109 regels van de
  twee untracked pure productiemodules `people-paths.ts` (89) en
  `people-root.ts` (20). Ook de derde nieuwe untracked TypeScript-module,
  `test/people-root-fixtures.ts` (24 testregels), is afzonderlijk gescand; zijn
  enige URL-hit is de bewuste onveilige URL-inputfixture en geen productiecall.
  In productie waren er 0 network-/URL-calls, 0 externe filesystem-API's, 0
  dynamic HTML-sinks, 0 `eval`/`Function`, 0 subprocess-/shell-executie, 0
  secret-like assignments en 0 binary asset-API's. De ene lexicale
  subprocessmatch is `PERSON_UUID_PATTERN.exec(...)`, uitsluitend lokale
  `RegExp.exec`.
- 2026-08-03: de exact drie toegevoegde write-API-kandidaten zijn alleen de
  reeds onafhankelijk gereviewde parent-layoutwrites: `vault.create(path,
  generated profile Markdown)`, `vault.createFolder(current)` voor de
  dossier/ancestors en `FileManager.trashFile(createdDossier)` uitsluitend voor
  de door dezelfde transactie gemaakte, live-identieke, nog lege dossiermap na
  een mislukte profielwrite. Geen target is een foto of ander asset. De 20 regels
  van `people-root.ts` zijn mutationvrij en vormen de enige pure policy;
  `settings/validate.ts` importeert en re-exporteert dezelfde functie-identiteit
  en `personDossierPathFromProfile()` valideert haar vóór normalisatie. Er zijn 0
  photo-/asset-upload/copy/move/rename/delete/import/crop-calls en geen wijziging
  onder `src/render/`, `src/index/`, `src/bases/`,
  `src/person-photo-resource.ts` of `styles.css`. De 13 toegevoegde regels in de
  vijf relationship-/contactmomentproductiepaden zijn uitsluitend de
  parent-layoutdelegatie naar centrale root-afgeleide collecties en bevatten 0
  photo-/assetgedrag; de photoslice verbreedt die scope niet.
- 2026-08-03: alle zeven criteria zijn met deze actuele gate-, build-,
  reproducibility-, whitespace-, security-, scope- en hygiene-evidence `[x]`.
  Status blijft `active`. Er is geen dependency-/lockfile-/live-vault-/binary-
  assetoperatie, clean, revert, stage, commit, push, tag, release, review of
  closure uitgevoerd. Alleen de korte finale onafhankelijke rereview blijft
  open; de automatisering bewijst geen live Obsidian Desktop/Mobile-vault,
  echte filesystem-/Sync-adapter, screenreader of assistive technology, en het
  gedocumenteerde post-callback/pre-hostcommit-hostvenster blijft een restrisico.
- 2026-08-03: finale onafhankelijke read-only rereview **PASS**, zonder nieuwe
  bevindingen. Reviewerprobes waren GREEN: pure dossierauthority 22/22,
  productiemutationmatrix plus delete/rename-races 24/24, Chromium-modal 44/44,
  loader/UI 22/22 en controlled productie-integratie 1/1. De drie historische
  photo-findings zijn `RESOLVED`: callback-TOCTOU, trailing-slash People-root en
  direct geïnjecteerde unsafe-rootbypass.
- 2026-08-03: de enige semantisch actuele canonieke gate blijft 1018/1018 tests
  in 69 files (858 node, 127 browser, 27 integration, 6 browser-matrix), met
  `main.js` 355611/409600 bytes, 59 sourcefiles en tweemaal SHA-256
  `e86a5a6715868e4450f8038aa29bbf96a6ffcd71290000040f9aecd81393c3d0`.
  Sinds die gate zijn alleen journal- en read-only reviewhandelingen uitgevoerd;
  geen code of tests zijn gewijzigd. De review wijzigde geen repositorybestand
  en herhaalde geen brede gate. Live Obsidian Desktop/Mobile, echte vault/
  filesystem/Sync en assistive technology blijven buiten het bewijs; het
  gedocumenteerde post-callback/pre-hostcommit-hostvenster blijft de hostlimiet.

## Evidence

- Slice A formboundary: assertion-grade handoff-RED 5 failed + 34 passed en vier
  `TS2554`; gerichte GREEN 6 passed + 33 skipped; volledige file 39/39 en
  typecheck GREEN.
- Slice B centrale mutationboundary: assertion-grade RED 8 failed + 3 passed +
  54 skipped; gerichte GREEN 11 passed + 54 skipped; volledige mutationfile
  65/65. De rejectmatrix observeert vóór writes nul `processFrontMatter`, nul
  hostcommit, nul rename en geen person-/assetmutatie.
- Slice C helperboundary: eerste run direct GREEN, 7 passed + 6 skipped; geen
  productiechange nodig.
- Slice D modalquery: assertion-grade globale-picker-RED 1 failed + 13 skipped;
  gerichte picker/label-GREEN en volledige browserdekking voor dossierroot,
  descendant, outside/sibling/prefix-lookalike duplicate basenames, full-path
  identity, keyboard, Save, preview/lifecycle/narrow en ownerDocument.
- Slice E create: assertion-grade ontbrekende-note-RED 1 failed + 14 skipped;
  zichtbare `role="note"`-GREEN plus afzonderlijke write-free Cancel/host-close.
- Slice F controlled integratie: eerste observatie direct GREEN doordat Slice B
  het gedrag al leverde; echte plugin/service bewijzen reject vóór frontmatter en
  één lokale photo-only write zonder TFile/path/mtime/size/vaultfilemutatie.
- Finale actuele remediation-scope: browser 17/17, integration 3/3,
  mutation-service 68/68, settings-load 29/29, settings-tab 19/19,
  person-form 39/39 en person-photo 13/13; typecheck, formatter en tracked plus
  add-only ticket-diffchecks GREEN binnen hun beschreven grenzen.
- Finale canonieke na-remediation current-worktree-evidence: `npm run check`
  exit 0 met 815 node + 84 browser + 27 integration + 6 browser-matrix = 932
  tests/69 files; production build, releasecontract 355591/409600 bytes en
  community readiness over 58 sourcefiles GREEN. `npm run build` exit 0;
  reproduceerbaarheid exit 0 met tweemaal
  `b9a0ed3858688f7700e05dc0b3ef4db2a496d06abbf0411694b6992734e21446`;
  tracked whitespace exit 0 en zeven add-only no-indexchecks ieder verwachte
  exit 1 zonder output.
- Finale scan/scope-evidence: 369 toegevoegde productieregels (282 tracked + 87
  untracked), 0 echte finding voor network, externe filesystem-API's, dynamic
  HTML/execution, subprocess, secrets of binary/assetmutatie-API's. Alleen de
  drie expliciet hierboven geclassificeerde parent-layoutwrites bestaan; de
  callbackhercontrole leest en valideert assets zonder pluginmutatie. Photo
  scope voegt uitsluitend de veilige lokale selectie-/validatiegrens toe en
  verbreedt renderer, index, Bases, relaties of contactmomentgedrag niet.
- Tweede unsafe-root-remediation current-worktree-evidence: scoped `person-form`
  61/61, `mutation-service` 89/89, Chromium `person-modal` 60/60,
  settings/photo Node 61/61 en controlled Chromium integration 3/3 bleven vóór
  deze gate GREEN. De precies ene volledige canonieke gate daarna gaf formatter
  159 files, typecheck, production build, release/communitychecks en 1018/1018
  tests in 69 files GREEN (`858 + 127 + 27 + 6`); expliciete build exit 0;
  reproduceerbaarheid tweemaal
  `e86a5a6715868e4450f8038aa29bbf96a6ffcd71290000040f9aecd81393c3d0`;
  `main.js` 355611/409600 bytes; tracked whitespace exit 0 en alle 9 add-only
  no-indexchecks ieder verwachte exit 1 met nul output.
- Finale tweede-remediation scan/scope-evidence: 378 toegevoegde
  productieregels (`269 tracked + 109` uit twee untracked productiemodules) plus
  de derde untracked testmodule afzonderlijk gescand; 0 echte finding voor
  network, externe filesystem-API's, dynamic HTML/execution, subprocess,
  secrets of binary/assetmutatie-API's. Alleen de drie parent-layoutwrites zijn
  aanwezig. De gedeelde rootauthority is puur en mutationvrij; de photoslice
  voegt geen renderer-, index-, Bases-, relatie- of contactmomentgedrag toe.
- Limiet: deze geautomatiseerde Node-/Chromium-/controlled-runtimegate,
  releasecontract en geïnspecteerde current-worktree-diff bewijzen geen live
  Obsidian Desktop/Mobile-vault, echte filesystem-/Sync-adapter, screenreader of
  assistive technology. De finale onafhankelijke rereview is nog niet uitgevoerd.
- Finale closure-evidence: de onafhankelijke read-only rereview gaf PASS zonder
  findings; 22/22 pure, 24/24 mutation-, 44/44 Chromium-modal-, 22/22 loader/UI-
  en 1/1 controlled-integratieprobes waren GREEN. Alle drie historische
  photo-findings zijn resolved. Dit bevestigt de zeven criteria tegen de ene
  actuele 1018/1018-gate, het artifact van 355611/409600 bytes, 59 sourcefiles
  en de tweemaal gelijke SHA-256
  `e86a5a6715868e4450f8038aa29bbf96a6ffcd71290000040f9aecd81393c3d0`, binnen
  de hierboven vastgelegde live-host/vault/filesystem/Sync/assistive-technology-
  en post-callback/pre-hostcommit-limieten. De rereview was repository-read-only.

## Review

PASS — final independent read-only rereview; no findings.

## Retrospective

De veiligste verticale seam was één actuele dossierquery die zowel de zichtbare
picker als de bestaande form-session voedt; daardoor hoefden preview-, lifecycle-
en mutationgrenzen niet te worden gedupliceerd. De controlled integratietest werd
terecht direct GREEN na de eerdere centrale slice: het expliciet vastleggen van
die observatie is betrouwbaarder dan een kunstmatige RED. Failure-screenshots van
de browserrunner moeten na vastgelegde RED-evidence gericht worden verwijderd om
de dirty baseline zonder gegenereerde binaries te behouden.

De eindgate bevestigde daarnaast dat één ongewijzigde canonieke run de nuttigste
bewijsgrens is: de gescheiden Vitest-projectprocessen bleven zonder retry of
timeoutwijziging groen en gaven rechtstreeks de reviewbare projectcounts. Een
contextbewuste API-scan voorkwam false positives uit woorden als `import` en
maakte het onderscheid expliciet tussen verboden assetmutaties en de drie
parent-owned Markdown/dossierwrites. Voor toekomstige finalisering blijft de
praktische volgorde: eerst volledige gates, dan scan/fingerprints, daarna het
owning ticket, en tot slot een verse onafhankelijke review zonder de dirty
baseline te herschrijven.
