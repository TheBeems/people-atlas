Status: done
Created: 2026-08-03
Updated: 2026-08-03

# Persoonsdossier-layout en centrale collectiepaden

Parent: `.10x/tickets/2026-08-03-person-dossier-storage-plan.md`
Depends-On: None

## Scope

Implementeer de kern van de brekende fresh-vault opslagarchitectuur:

- vervang losse person-/contactmoment-foldersemantiek door één veilige,
  configureerbare `People root folder` met default `People`;
- leid `Profiles`, `Relationships` en `Contact moments` via één pure
  path-module af;
- plan een expliciete stabiele `person_id` vóór person-create;
- creëer na één expliciete Save één collision-safe,
  leesbare `<naam-slug>--<korte-stabiele-id>` dossiermap en één canonieke
  profielnotitie daarin;
- behoud die dossiermap bij profielrename; hernoem alleen de profielnotitie na
  de bestaande expliciete confirmation;
- laat relationship- en contactmoment-create de centrale afgeleide paths
  gebruiken;
- reset naar de nieuwe fresh-vault settingsvorm zonder settings- of
  vaultmigratie.

## Non-goals

- Foto-pickerfiltering of selectie van een eerste foto; die hoort bij
  `2026-08-03-dossier-local-photo-picker.md`.
- Asset-import, upload, kopie, move, rename, delete, crop of afgeleide media.
- Migreren, verplaatsen, hernoemen of interpreteren van bestaande vaultdata of
  opgeslagen folderinstellingen.
- Nieuwe relatie-, contactmoment-, index-, follow-up-, renderer- of
  cross-vaultsemantiek.
- Commit, push, release of live hostcertificering.

## Acceptance criteria

- [x] `PeopleAtlasSettings`, defaults, validation, loadgrens en Settings UI
      hebben exact één veilige `peopleRootFolder`; de oude onafhankelijke
      `peopleFolder`- en `contactMomentsFolder`-semantiek bestaat niet meer.
- [x] Eén pure path-module produceert vanuit de root de vaste Profiles-,
      Relationships- en Contact moments-paden, een normalized dossierfolder en
      het profielbestandpad; UI, form en mutationservice hergebruiken haar.
- [x] Person-create plant vóór de eerste write één expliciete `person_id`,
      gebruikt de eerste acht lower-case hextekens van de UUID die die ID voedt
      als suffix en maakt exact
      `<root>/Profiles/<naam-slug>--<suffix>/<weergavenaam>.md`.
- [x] Ongeldige naam, pad/ID-botsing of voorafgaande validatiefout maakt geen
      dossier of profielnotitie. Een failure na het aanmaken van een nieuw
      dossier laat geen door People Atlas aangemaakt gedeeltelijk dossier
      achter.
- [x] Eén geslaagde Save maakt uitsluitend de noodzakelijke dossiermap en
      profielnotitie, opent die note en schrijft geen foto of ondersteunende
      inhoud.
- [x] Een profielrename blijft binnen het dossier, bewaart `person_id` en
      wijzigt nooit dossiermap, lokale assets of vrije dossiernotities.
- [x] Nieuwe relaties en contactmomenten komen uit dezelfde path-module in de
      centrale collecties; hun bestaande validation, canonicaliteit en
      follow-upsemantiek veranderen niet.
- [x] Indexering blijft Markdown/type-gebaseerd en incrementieel; de
      implementatie introduceert geen tweede store, volledige indexscan per
      create of path-gebaseerde afleiding van vrije dossiernotities.
- [x] Het nieuwe settingscontract migreert, verplaatst of wist geen bestaande
      plugininstellingen, notes of assets.
- [x] RED→GREEN-tests dekken pure padgeneratie, slug/suffix, volledige
      create-path, botsing/cleanup, cancel/failure, same-dossier-rename,
      centrale relationship/contact paths, settingsvalidation en de relevante
      gecontroleerde Obsidian-integratie.
- [x] `npm run check`, `npm run build`, `npm run verify:reproducible` en
      `git diff --check` slagen met Node 24.

## References

- `.10x/specs/person-dossier-storage.md`
- `.10x/decisions/person-dossier-storage-layout.md`
- `.10x/research/2026-08-03-person-dossier-storage-discovery.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/settings-information-architecture.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified 2026-08-03: één vault met `People/Profiles`,
  `People/Relationships` en `People/Contact moments` als afgeleide default
  structuur.
- User-ratified 2026-08-03: een dossier heeft de vorm
  `<naam-slug>--<korte-stabiele-id>` en verandert niet automatisch bij
  profielrename.
- User-ratified 2026-08-03: bestaande data/settings behoeven geen migration of
  backwards compatibility.
- Record-backed: de huidige form hernoemt alleen binnen de parentfolder en
  werkt `person_id` niet bij; de nieuwe layout kan die safetyrail hergebruiken.

## Blockers

None. De afzonderlijke implementatieautorisatie is gejournaliseerd, de
uitvoering is compleet en de vierde onafhankelijke rereview is PASS; dit ticket
is gesloten als `done`.

## Journal

- 2026-08-03: ticket tijdens shaping geopend. Geen implementatie, test, build,
  vaultwrite buiten `.10x/`, commit, push of release uitgevoerd.
- 2026-08-03: de gebruiker autoriseerde implementatie van de People Atlas
  10x-tickets inclusief records, gevolgd door commit en push. Dit eerste
  dependency-klare childticket is geactiveerd voor afzonderlijke TDD-uitvoering;
  commit en push volgen pas na beide childtickets, onafhankelijke reviews en de
  canonieke eindgate.
- 2026-08-03: runtime-handshake vóór de eerste npm-run uitgevoerd met
  `export PATH=/home/nms/.local/node24/bin:$PATH` en achtereenvolgens
  `command -v node`, `node --version`, `npm --version`; alle volgende
  Node/npm-commando's gebruiken dezelfde expliciete PATH.
- 2026-08-03: RED 1 legde de pure person-pathinvariant vast. Exact commando:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm test -- --run test/person-form.test.ts -t "derives a configured dossier and profile path from a stable UUID-backed person ID"`.
  Door de bestaande samengestelde `test`-scriptvorm draaide dit de node-suite;
  resultaat: exit 1, 1 failed + 695 passed (696 tests). Assertion-grade failure:
  verwacht `Second Brain/People/Profiles/alice-admin--7d9f4a12/Alice - Admin.md`,
  ontvangen `Second Brain/People/Alice - Admin.md`.
- 2026-08-03: hervattingsreparatie van de bewezen verouderde createfixture. RED:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/person-form.test.ts -t "builds a configured create payload from reviewable fields"`
  => exit 1, 1 failed + 25 skipped; verwacht oud `People/Carol.md`, ontvangen
  dossierplaceholder `People/Profiles/<name>--<id>/<name>.md`. De fixture kreeg
  minimaal een expliciet vooraf gepland UUID-backed `personId` en verwacht nu
  zowel `People/Profiles/carol--c0ffee00/Carol.md` als dat ID in het payload.
  Hetzelfde gerichte commando werd GREEN: exit 0, 1 passed + 25 skipped; daarna
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/person-form.test.ts`
  => exit 0, 26 passed.
- 2026-08-03: settings RED→GREEN 3 legde de brekende loadgrens vast. RED exact:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/settings-load.test.ts -t "loads and trims exactly one current People root without legacy folder compatibility"`
  => exit 1, 1 failed + 8 skipped; `peopleRootFolder` was `undefined` in plaats
  van `Second Brain/People`. Na vervanging van beide folderkeys door precies één
  root in type/default/normalisatie/load werd hetzelfde commando GREEN: exit 0,
  1 passed + 8 skipped. Extra legacy velden worden niet gemigreerd of teruggegeven.
- 2026-08-03: settings RED→GREEN 4 dekte veilige vault-relatieve roots. RED exact:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/settings-load.test.ts -t "keeps unsafe People root folders read-only"`
  => exit 1, 1 failed + 8 skipped; `/People` liet writes ten onrechte toe.
  Minimale rootvalidatie verwerpt absolute/scheme-, dotsegment- en lege-segmentpaden;
  hetzelfde commando werd GREEN: exit 0, 1 passed + 8 skipped, gevolgd door de
  hele loadfile GREEN met 9 passed.
- 2026-08-03: settings-UI RED→GREEN 5. RED exact:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/settings-tab.test.ts -t "exposes one People root control and no independent person or contact-moment folder controls"`
  => exit 1, 1 failed + 15 skipped; er waren nog 2 foldercontrols in plaats van
  1. De declaratieve UI bevat nu uitsluitend `People root folder` met key
  `peopleRootFolder`; hetzelfde commando werd GREEN: exit 0, 1 passed + 15 skipped.
  Gerichte settingsregressie
  `npm exec -- vitest run --project node test/settings-load.test.ts test/settings-tab.test.ts test/view-state-write-coordination.test.ts`
  onder dezelfde PATH => exit 0, 3 files en 34 tests passed.
- 2026-08-03: de gecontroleerde create-modaltest `plans one stable person ID at
  open and reuses its dossier path through the first Save` was eerst RED met
  1 failed + 13 skipped: de reviewable Person ID bevatte nog `Assigned
  automatically on save` in plaats van de vooraf geplande UUID-backed ID. Na
  het aansluiten van modal-open op één geplande ID, dossierpreview en exact
  create-payload werd `test/browser/person-modal.browser.test.ts` uiteindelijk
  volledig GREEN: 14/14. De test observeert vóór Save geen mutationcall; na
  Save exact één create met dezelfde ID, het verwachte dossierpad, openen van de
  gecreëerde note en geen `photo`-property.
- 2026-08-03: de mutationboundary kreeg assertion-grade create-dekking. De
  gerichte tests `creates one dossier and canonical profile note from the
  explicit preplanned person ID`, `rejects person create without an explicit
  UUID-backed person ID before writing` en `rejects an existing dossier
  collision before creating any parent or profile note` waren ieder eerst RED
  tegen de oude vlakke/genererende boundary en werden na minimale aansluiting
  op `personDossierPath`/`personProfilePath` GREEN. Geobserveerd: het expliciete
  ID blijft byte-exact in frontmatter, het suffix normaliseert naar de eerste
  acht lower-case UUID-hextekens, ontbreken van die UUID-ID schrijft niets en
  een bestaand dossier blokkeert vóór parent- of profielcreate.
- 2026-08-03: dossiercleanup is in drie opeenvolgende gerichte, op exacte
  testtitel geselecteerde `npm exec -- vitest run --project node
  test/mutation-service.test.ts -t "..."`-loops vastgelegd. `removes only the
  transaction-created empty dossier when profile-note creation fails` was RED
  omdat de nieuw gemaakte lege dossiermap na de oorspronkelijke
  `profile write failed` bleef bestaan; na best-effort cleanup GREEN: 1 passed
  + 29 skipped. `retains a transaction-created dossier that gained user
  content before profile-note failure` maakte vervolgens RED zichtbaar dat een
  dossier met tussentijds toegevoegde `Interview notes.md` niet mocht worden
  verwijderd; na live object- en `children.length === 0`-controle waren beide
  cleanupcases GREEN: 2 passed + 29 skipped. `preserves the profile-write error
  when empty-dossier cleanup also fails` was RED toen `cleanup failed` de
  oorspronkelijke writefout kon maskeren; na foutisolatie waren alle drie
  cleanupcases GREEN: 3 passed + 29 skipped. De safetyrail verwijdert dus alleen
  de binnen dezelfde transactie gemaakte, nog lege dossiermap, behoudt gevulde
  dossiers/vrije inhoud en werpt steeds de oorspronkelijke createfout terug.
- 2026-08-03: de same-dossier-regressie `renames only the profile note inside
  its dossier without moving identity, assets or free notes` is test-first aan
  de mutationservice toegevoegd en was bij de eerste gerichte observatie al
  GREEN: 1 passed + 35 skipped. Dat is eerlijk geen nieuwe RED: de bestaande
  bevestigde rename-seam voldeed al. De assertions bewijzen dat alleen
  `Alice.md` naar `Alice Admin.md` binnen dezelfde dossiermap verhuist, terwijl
  dossierobject, `person_id`, `portrait.jpg`, `Interview notes.md` en de
  afwezigheid van een hernoemde dossiermap behouden blijven.
- 2026-08-03: centrale collectionpaths zijn verticaal afgedekt. De
  relationship-formtest was RED (verwacht custom-root
  `Second Brain/People/Relationships/...`, ontving het oude vaste
  `People/Relationships/...`) en werd na delegatie aan `peopleCollectionPaths`
  GREEN: 1 passed + 31 skipped. Mutationtests voor relationship- en
  contactmoment-create buiten respectievelijk de afgeleide
  `People/Relationships`- en `People/Contact moments`-collectie waren eerst RED
  omdat de write-boundary zulke paden nog accepteerde; na centrale
  boundaryvalidatie GREEN. De custom-rootcase schrijft beide typen uitsluitend
  onder `Second Brain/People/{Relationships,Contact moments}`, maakt geen
  default-rootcollectie en observeert voor het contactmoment
  `relationship.status === "not-requested"`, zodat de bestaande
  follow-upsemantiek ongewijzigd blijft. De uiteindelijke mutationservicefile
  was 35/35 GREEN vóór toevoeging van de renamecase en die renamecase daarna
  afzonderlijk GREEN; de finale volledige run bevestigde 36/36.
- 2026-08-03: code-audit vond buiten de modalseam nog één person-createpad: de
  `@`-mention create-action gaf alleen `name` door. De assertion-grade test
  `plans one explicit UUID-backed person ID before an @ create action writes`
  was RED doordat het verwachte create-payload met geplande ID niet werd
  ontvangen. De minimale fix plant vóór de mutation één
  `person-${crypto.randomUUID()}` en hergebruikt het resulterende dossierpad in
  de ingevoegde wikilink. Dezelfde gerichte test werd GREEN: 1 passed +
  3 skipped; aansluitend waren `mention`, `person-entrypoints` en
  `mutation-service` samen 51/51 GREEN.
- 2026-08-03: na vier semantics-vrije Biome-formattercorrecties wees de
  community-readinessfase van `npm run check` een directe `Vault.delete` in de
  lege-dossiercleanup af. Eerst zijn mutationfixture en cleanupassertie op de
  Obsidian-safe `FileManager.trashFile`-route gezet; de gerichte cleanupcase was
  daarmee assertion-grade RED tegen de nog directe productiecall. De minimale
  productiefix gebruikt nu `this.app.fileManager.trashFile(createdDossier)`.
  Daarna waren de gerichte cleanupregressie, de volledige mutationservice
  36/36 en community-readiness GREEN.
- 2026-08-03: finale Node-24-verificatie door de laatste executor, zonder
  staging of release: runtime `/home/nms/.local/node24/bin/node`, Node
  `v24.18.1`, npm `11.16.0`; direct betrokken nodebestanden 150/150,
  person-modal browser 14/14 en integrationproject 26/26 GREEN. Het finale
  `npm run check` was exit 0 met node 708/708, browser 81/81, integration 26/26
  en browser-matrix 6/6: totaal 821 tests in 69 testfiles. Alleen de reeds
  bestaande, niet-blokkerende Biome-waarschuwing in `test/obsidian-stub.ts`
  bleef zichtbaar.
- 2026-08-03: overige finale gates onder dezelfde Node-24-PATH waren GREEN:
  `npm run build` exit 0; `npm run verify:reproducible` exit 0 met voor beide
  builds SHA-256
  `1baf11ea490dfd2492d9dea691cc2b32ee22f2c54eb78847f83ce7e206ce9326`;
  `git diff --check` exit 0 met lege output. De zeven afzonderlijke
  `git diff --no-index --check /dev/null <untracked-pad>`-checks voor de zes
  in-scope 10x-records en `src/domain/people-paths.ts` gaven de verwachte
  diff-exit 1 met telkens lege checkoutput: geen whitespacefouten.
- 2026-08-03: contextbewuste scope-/securityscan van 118 toegevoegde
  productieregels vond 0 secret-like assignments, 0 `eval`/`new Function`,
  0 child-process/exec/spawn/shell en 0 unsafe HTML/DOM. De diff introduceert
  geen tweede store, indexscan-per-create, pathclassificatie van vrije
  dossiernotities, settings-/vaultmigratie of binary assetwrite. Geen live
  Obsidian-/vaultcertificering, staging, commit, push, tag, release of wijziging
  aan het fototicket is uitgevoerd.
- 2026-08-03: onafhankelijke read-only review gaf **FAIL** en blokkeerde
  closure met vier reproduceerbare bevindingen. (1, HIGH) create-mode liet via
  de vaultbrede fotokiezer, `buildPersonCreateInput()` en de centrale
  create-boundary nog een niet-lege `photo` door naar de eerste profielwrite,
  in strijd met de verplichte tweestapsflow. (2, HIGH) de incompatibele nieuwe
  settingsvorm bleef schema 7; exact oude raw schema-7-data met
  `peopleFolder: "Private/People"` en
  `contactMomentsFolder: "Private/Moments"` werd daardoor write-enabled als
  default root `People` herinterpreteerd. (3, MEDIUM) het door create UI/form
  getoonde pad werd niet meegestuurd; een rootwijziging tussen review en Save
  kon stil naar een ander canoniek herafgeleid pad schrijven. (4, MEDIUM) de
  dossierprecheck had een async TOCTOU-venster: een extern dossier met usernote
  kon tijdens ancestorcreatie ontstaan en daarna een profielwrite ontvangen,
  omdat transaction ownership van juist de dossiermap niet vereist werd.
  De hierdoor niet langer bewezen settings-, path/create-, collision/cleanup-,
  no-photo-, non-migratie-, regressie- en finale-gatecriteria zijn hierboven
  teruggezet naar `[ ]`. Remediation moet per bevinding assertion-grade
  RED→GREEN leveren; ticket blijft `active` en vereist daarna een nieuwe
  onafhankelijke review.
- 2026-08-03: remediation bevinding 1, mapper RED→GREEN. Vóór productcode werd
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/person-form.test.ts -t "builds a configured create payload from reviewable fields"`
  assertion-grade RED: exit 1, 1 failed + 25 skipped; received bevatte nog
  `photo: "[[Assets/carol.png]]"` terwijl exact dezelfde volledige payload
  zonder `photo` werd verwacht. De minimale GREEN verwijderde uitsluitend de
  foto-overdracht uit `buildPersonCreateInput()`; hetzelfde commando gaf exit 0,
  1 passed + 25 skipped. De overige veldasserties zijn behouden en een
  expliciete negatieve `photo`-assertie is toegevoegd.
- 2026-08-03: remediation bevinding 1, centrale boundary RED→GREEN. Vóór de
  boundarywijziging gaf
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/mutation-service.test.ts -t "rejects a non-empty create photo at the central boundary before any write"`
  exit 1, 1 failed + 36 skipped: de promise resolve-de naar
  `People/Profiles/alice--11112222/Alice.md` en ontvangen content bevatte de
  verboden `photo`-property. De minimale GREEN voegde vóór `ensureFolder()` en
  iedere write een expliciete fout voor niet-lege create-`photo` toe; hetzelfde
  commando gaf exit 0, 1 passed + 36 skipped en de harness bewijst `files.size
  === 0`.
- 2026-08-03: remediation bevinding 1, create-UI RED→GREEN. Vóór productcode
  werd
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project browser test/browser/person-modal.browser.test.ts -t "plans one stable person ID at open and reuses its dossier path through the first Save"`
  RED: exit 1, 1 failed + 13 skipped; create-mode exposeerde aantoonbaar nog
  label `Photo`. De minimale GREEN rendert en beluistert foto-assets alleen in
  edit-mode; hetzelfde commando gaf exit 0, 1 passed + 13 skipped en assert nu
  geen Photo/Search/select, nul fotolisteners en een create-payload zonder
  `photo`. De bestaande exacte-path/keyboard/preview/Save-, event- en
  owner-document-fototests zijn naar echte edit-modefixtures verplaatst zonder
  hun beschermende assertions te verwijderen. Gerichte regressie na deze drie
  slices: node `person-form` + `mutation-service` exit 0, 2 files/63 tests; hele
  browser `person-modal` exit 0, 1 file/14 tests. Daarmee is eerste Save
  no-photo op mapper, publieke UI en centrale no-write-boundary bewezen, terwijl
  edit-photo behouden blijft; er is geen dossierlokale filtering of assetimport
  uit het afhankelijke fototicket geïmplementeerd.
- 2026-08-03: remediation bevinding 2 RED→GREEN. Vóór productiecode werd exact
  oude raw data zonder defaults-spread toegevoegd:
  `{ schemaVersion: 7, peopleFolder: "Private/People", contactMomentsFolder:
  "Private/Moments" }`. Exact commando:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/settings-load.test.ts -t "keeps exact legacy schema 7 folder data read-only without reinterpreting its root"`.
  RED was exit 1, 1 failed + 9 skipped op de assertion `writeEnabled === false`:
  received was `true`, waarmee de gereviewde stille default-rootherinterpretatie
  direct reproduceerde. De minimale GREEN verhoogde uitsluitend
  `PLUGIN_DATA_SCHEMA_VERSION` van 7 naar 8; er is geen migration,
  backwards-compatibility of persistencepad toegevoegd. Hetzelfde commando was
  exit 0, 1 passed + 9 skipped; daarna was de hele `settings-load`-file exit 0,
  10/10. De regressie bewijst schema-7 fail-closed/read-only via de bestaande
  loadgrens, in-memory defaults alleen en ongewijzigde raw input.
- 2026-08-03: remediation bevinding 3 droeg de exact beoordeelde bestemming
  over iedere creategrens. De bestaande mapper-RED onder
  `test/person-form.test.ts -t "builds a configured create payload from
  reviewable fields"` verwachtte naast de no-photo-invariant ook
  `reviewedPath: "People/Profiles/carol--c0ffee00/Carol.md"`; na de minimale
  mapperwijziging droeg de GREEN-payload naam, vooraf geplande ID, reviewed path
  en alle overige profielvelden exact over. De centrale stale-rootregressie
  draaide met
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run
  --project node test/mutation-service.test.ts -t "rejects a stale reviewed
  create path after the People root changes before writing"`: RED exit 1,
  1 failed + 37 skipped, omdat de promise nog fulfilled naar
  `Changed Root/Profiles/alice--11112222/Alice.md` in plaats van vóór writes te
  rejecten; na recompute + vergelijking op de mutationboundary hetzelfde
  commando GREEN, exit 0, 1 passed + 37 skipped. De boundary blijft optioneel
  getypeerd voor bestaande editcalls, maar person-create verwerpt een ontbrekend,
  onveilig of stale reviewed path vóór folder- of profielwrite.
- 2026-08-03: de alternatieve `@`-entrypoint van bevinding 3 kreeg dezelfde
  reviewed-destinationgrens. Exact gericht commando:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run
  --project node test/mention.test.ts -t "plans one explicit UUID-backed person
  ID before an @ create action writes"`. RED was exit 1, 1 failed + 3 skipped:
  de exact verwachte createcall bevatte het canonieke
  `People/Profiles/zoe-example--12345678/Zoë Example.md`, maar received miste
  `reviewedPath`. Na afleiding uit dezelfde rootsnapshot en geplande ID werd
  hetzelfde commando GREEN: exit 0, 1 passed + 3 skipped. Er is geen
  name-based identiteit of tweede pathregel toegevoegd.
- 2026-08-03: de onderbroken bevinding-3-integratie is mechanisch voltooid
  zonder productiecode of assertions te verzwakken. Vier bestaande
  mutationfixtures (`retains a transaction-created dossier...`, `preserves the
  profile-write error...`, `rejects overlapping person...`, `keeps a created
  identity reserved...`) kregen voor iedere createcall hun exacte canonieke
  `reviewedPath`; drie browserpayloadverwachtingen kregen exact het reeds
  getoonde pad voor Alice/Admin, retry-Carol en ordered-contacts-Carol.
  Aansluitend waren de volledige files onder Node 24 GREEN:
  `npm exec -- vitest run --project node test/mutation-service.test.ts` =>
  38/38 en `npm exec -- vitest run --project browser
  test/browser/person-modal.browser.test.ts` => 14/14.
- 2026-08-03: remediation bevinding 4 kreeg vóór productiecode een
  deterministische interleavingregressie. De gecontroleerde vaultfixture laat
  tijdens de await van ancestor-`createFolder("People")`, dus na de initiële
  dossierprecheck maar vóór de dossieriteratie, extern precies het beoogde
  dossier plus `Interview notes.md` ontstaan. Exact RED-commando:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run
  --project node test/mutation-service.test.ts -t "rejects a foreign dossier
  created while an ancestor folder is being created"` => exit 1, 1 failed +
  38 skipped. De assertion verwachtte `{ status: "rejected",
  profileWritten: false }`, maar received was `{ status: "fulfilled", path:
  "People/Profiles/alice--11112222/Alice.md", profileWritten: true }`; daarmee
  reproduceerde zij exact de dossier-TOCTOU en niet een fixture- of importfout.
- 2026-08-03: minimale GREEN voor bevinding 4 controleert direct na
  `ensureFolder(dossierPath)` en vóór frontmatter/profile-create dat de
  `createdFolders`-map het exacte live dossierobject van deze transactie bevat.
  Een ontbrekend of vervangen object faalt vóór de profielwrite met
  `not created by this transaction`; het foreign dossier en de foreign usernote
  blijven object-identiek behouden. Hetzelfde gerichte commando werd exit 0,
  1 passed + 38 skipped; de volledige mutationservicefile werd aansluitend
  39/39 GREEN. De bestaande cleanupcatch bleef ongewijzigd en verwijdert nog
  steeds alleen een transaction-created, live identiek en leeg dossier, terwijl
  een oorspronkelijke profielwritefout primair blijft.
- 2026-08-03: actuele direct betrokken regressies onder de vastgelegde
  Node-24-PATH waren GREEN. De negen nodefiles (`mutation-service`,
  `person-form`, `mention`, `person-entrypoints`, `settings-load`,
  `settings-tab`, `view-state-write-coordination`, `relationship-form` en
  `contact-moment-form`) gaven 9 files/154 tests; de volledige person-modal
  browserfile gaf 1 file/14 tests; het volledige integrationproject gaf
  8 files/26 tests.
- 2026-08-03: de eerste actuele `npm run check` stopte eerlijk bij
  `format:check` voordat lint/typecheck/tests/build/release/community konden
  draaien: Biome vroeg uitsluitend de bestaande multi-line `toThrow` in de
  bijgewerkte reserved-identityfixture op één regel te zetten. Na precies die
  semantics-vrije formattercorrectie is het volledige commando opnieuw vanaf
  het begin gedraaid en GREEN geëindigd: format 157 files, lint zonder errors
  met alleen de reeds bestaande `test/obsidian-stub.ts`-waarschuwing,
  typecheck GREEN, node 712/712 (48 files), browser 81/81 (10 files),
  integration 26/26 (8 files) en browser-matrix 6/6 (3 files), totaal 825 tests
  in 69 files; production build GREEN; releasecontract GREEN met
  `main.js` 352550/409600 bytes; community readiness GREEN over 58 sourcefiles.
- 2026-08-03: expliciete resterende Node-24-gates waren GREEN:
  `npm run build` exit 0 inclusief `tsc --noEmit` en production esbuild;
  `npm run verify:reproducible` exit 0 met twee gelijke SHA-256-digests
  `bfaa6b44a5297a4f04a8a1e83473240e513c85fb048e81ee610cbf64cb039b48`;
  `git diff --check` exit 0 met lege output. Alle zeven afzonderlijke
  `git diff --no-index --check /dev/null <pad>`-checks voor de zes untracked
  10x-records en `src/domain/people-paths.ts` gaven de verwachte add-only
  diff-exit 1 met lege checkoutput, dus geen whitespacefouten.
- 2026-08-03: contextbewuste scan van 194 toegevoegde productieregels in
  `src/`, inclusief het volledige untracked `people-paths.ts`, vond 0
  secret-like assignments, 0 `eval`/`new Function`, 0 child-process/
  shell-execution en 0 unsafe DOM/HTML. De ene lexicale `exec`-candidate was
  `PERSON_UUID_PATTERN.exec(...)`, aantoonbaar een lokale RegExp-match en geen
  process-executie. Scope-inspectie vond geen dependency-/lockfilewijziging,
  migratie, tweede store, full indexscan per create, binary/live-vaultwrite of
  gegenereerde failurescreenshot in `git status`. Het fototicket is niet
  gewijzigd; niets is gecleand, gerevert, gestaged, gecommit, gepusht, getagd of
  gereleased.
- 2026-08-03: remediation is lokaal compleet maar niet onafhankelijk
  herbeoordeeld. De gecontroleerde tests bewijzen hun stale-root- en exacte
  interleavingsasserties, niet een echte Obsidian-/filesystem-/Sync-adapter,
  Desktop/Mobile-, screenreader- of live-vaultcertificering. Alle elf criteria
  zijn op actuele evidence opnieuw afgevinkt; ticketstatus blijft `active` en
  de eerdere FAIL blijft van kracht tot een nieuwe onafhankelijke read-only
  review de huidige worktree expliciet PASS geeft.
- 2026-08-03: de tweede onafhankelijke read-only rereview gaf opnieuw **FAIL**.
  De eerdere bevindingen 2 (exact schema 7 fail-closed onder schema 8) en 4
  (foreign-dossier-TOCTOU, owned cleanup en primaire fout) zijn expliciet
  `resolved`, maar drie echte blockers blijven open: (1, MEDIUM) een
  whitespace-only create-`photo` passeert de non-empty guard en wordt door de
  create-frontmatterserializer alsnog als `photo:` geschreven; (2, MEDIUM) de
  mutationboundary normaliseert raw `reviewedPath` vóór intentievergelijking,
  zodat onder meer een leading slash stil wordt geaccepteerd en schrijft; (3,
  HIGH) schema-8-root `Second Brain/People|Archive` wordt write-enabled, waarna
  een zogenaamd canonieke relationship/contact-wikilink door de parser als
  target `Second Brain/People` plus alias wordt gelezen. Daarom zijn uitsluitend
  de betrokken settings/root-, createpad/no-write-, no-photo-, centrale
  canonicaliteits-, TDD- en actuele-gatecriteria hierboven teruggezet naar
  `[ ]`. Tweede remediation moet ieder blocker afzonderlijk assertion-grade
  RED→GREEN herstellen; ticket blijft `active` en vereist daarna een derde,
  onafhankelijke read-only rereview.
- 2026-08-03: tweede-remediation bevinding 1 (whitespace-createfoto) is strikt
  RED→GREEN hersteld. Vóór productiecode is een centrale create-regressie voor
  zowel `photo: ""` als `photo: "   "` toegevoegd. Exact RED-commando:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run
  --project node test/mutation-service.test.ts -t "never serializes an empty
  create photo"` => exit 1, 1 failed + 1 passed + 39 skipped. De whitespacecase
  ontving in de eerste profielwrite aantoonbaar `photo: "   "`; de empty-case
  was al correct. De minimale productiefix verwijderde uitsluitend de
  `photo`-regel uit de create-only `personFrontmatter()`-serializer, zodat deze
  structureel geen photo-property meer kan produceren; de expliciete non-empty
  boundaryfout en de afzonderlijke edit-updatecode bleven intact. Hetzelfde
  commando werd GREEN: exit 0, 2 passed + 39 skipped. Aanvullend gaf
  `npm exec -- vitest run --project node test/mutation-service.test.ts -t
  "create photo"` onder dezelfde PATH exit 0, 3 passed + 38 skipped: empty en
  whitespace schrijven zonder photo-property, non-empty reject vóór enige write.
- 2026-08-03: tweede-remediation bevinding 2 (exact raw reviewed path) is strikt
  RED→GREEN hersteld. Vóór productiecode is één tabelregressie toegevoegd voor
  leading slash, backslashes, dubbele separator, ontbrekende waarde en stale
  naam, steeds met een no-write-assertie. Exact RED-commando:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run
  --project node test/mutation-service.test.ts -t "raw reviewed create path"`
  => exit 1, 3 failed + 2 passed + 41 skipped. Leading slash, backslashes en
  dubbele separator resolve-den elk ten onrechte naar de canonieke Alice-note
  inclusief profielwrite; ontbrekend en stale naam faalden al veilig. De
  minimale GREEN trimt de raw `reviewedPath`, valideert die vóór enige
  normalisatie en vergelijkt haar byte-exact met het canoniek afgeleide pad;
  intentievergelijking normaliseert niet meer. Hetzelfde commando werd GREEN:
  exit 0, 5 passed + 41 skipped. Stale root bleef afzonderlijk GREEN (1 passed +
  45 skipped), net als de exacte alternatieve entrypoints: `mention` 1 passed +
  3 skipped en de publieke person-modalbrowserflow 1 passed + 13 skipped. Alle
  ongeldige intenties falen vóór folders of profielwrite.
- 2026-08-03: tweede-remediation bevinding 3 (onveilige People-root en
  canonieke wikilinks) is strikt RED→GREEN hersteld. Vóór productiecode zijn de
  exacte schema-8-root `Second Brain/People|Archive`, alle vereiste
  segmenttekens en de inline Settings-control assertion-grade gemaakt. Exact
  RED-commando: `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec --
  vitest run --project node test/settings-load.test.ts test/settings-tab.test.ts
  -t "unsafe People root"` => exit 1, 2 files failed, 18 failed + 1 passed +
  25 skipped. Het exacte object toonde `writeEnabled: true`, canoniek target
  `Second Brain/People|Archive/Profiles/alice--11112222/Alice`, maar parsed target
  `Second Brain/People`. Alle 16 tabelwaarden (backslash, `|`, `[`, `]`, `#`,
  `^`, `?`, NUL/US/DEL/trailing newline en `<>:\"*`) waren eveneens ten onrechte
  write-enabled; de inline validator gaf voor `|` geen fout.
- 2026-08-03: de minimale root-GREEN houdt één centrale pure
  `validatePeopleRootFolder()` als authority voor inline UI en loadgrens. Zij
  wijst raw controls, backslash en Obsidian-/wikilink-/cross-platform onveilige
  segmenttekens fail-closed af zonder ze te sanitiseren; de loader gebruikt
  dezelfde validator ook op de raw opgeslagen string vóór settingsnormalisatie,
  zodat trailing controls niet door trim verdwijnen. Hetzelfde gerichte
  commando werd GREEN: exit 0, 2 files, 19 passed + 25 skipped. Trailing
  dot/space- en Windows-device-namen zijn bewust niet toegevoegd: geen bestaande
  projectpolicy/record draagt die extra scope.
- 2026-08-03: de gevraagde veilige roundtriptest is na de validator-GREEN
  toegevoegd en was bij eerste observatie eerlijk direct GREEN: `npm exec --
  vitest run --project node test/relationship-form.test.ts -t "round-trips safe
  Unicode and spaces"` => exit 0, 1 passed + 32 skipped (ook na expliciete
  validatorassertie opnieuw dezelfde uitkomst). Een goedgekeurde root met
  Unicode, spaties en `&` doorloopt person-profilepath naar zowel de echte
  relationship-formwikilink als contactmomentwikilink; `parsePersonReference()`
  levert voor beide exact hetzelfde volledige target zonder `.md`.
- 2026-08-03: finale second-remediation-hervatting begon met de vereiste
  runtime-handshake: `/home/nms/.local/node24/bin/node`, Node `v24.18.1`, npm
  `11.16.0`. De volledige actuele ticket/references, handoff, dirty diff en
  gewijzigde source/tests zijn vóór gates herlezen; de bestaande dirty baseline
  bleef staan en niets werd gecleand, gerevert of gestaged.
- 2026-08-03: de eerste actuele `npm run check` stopte bij `format:check` en
  draaide dus geen latere gate. Biome vroeg uitsluitend twee bestaande
  multi-line `personProfilePath(...)`-calls in `test/relationship-form.test.ts`
  en `test/settings-load.test.ts` op één regel te zetten. Na precies die
  semantics-vrije formattercorrecties is `npm run check` vanaf het begin
  herstart.
- 2026-08-03: de herstart kwam tot lint en vond één concrete nieuwe
  policyfailure: de functioneel gedekte control-range in
  `UNSAFE_PEOPLE_ROOT_SEGMENT_CHARACTERS` schond Biome
  `noControlCharactersInRegex`; latere gates draaiden niet. De bestaande
  NUL/US/DEL/newline- en delimiterregressies zijn behouden. De minimale fix
  veranderde alleen de representatie naar dezelfde expliciete tekenset plus
  exacte `U+0000..U+001F`/`U+007F`-codepointcontrole. `npm run lint` werd GREEN
  met alleen de reeds bestaande `test/obsidian-stub.ts`-waarschuwing; de
  gerichte unsafe-rootfiles waren 19 passed + 25 skipped en de veilige
  Unicode/spaties-roundtrip 1 passed + 32 skipped. Geen geaccepteerde of
  geweigerde rootklasse is voor de gate verbreed of verzwakt.
- 2026-08-03: de volgende volledige `npm run check` kreeg na 738/738 node en
  81/81 browser één bestaande integration-timeout in
  `contact-moment-entrypoints.integration.test.ts`: integration 25 passed + 1
  failed, zonder assertionfailure, op de ongewijzigde 15s-testtimeout. Exact
  dezelfde test was geïsoleerd 1/1 GREEN in 51 ms; daarna was het volledige
  integrationproject 8 files/26 tests GREEN. Er is geen retry-, timeout-, skip-
  of assertionwijziging gedaan. Alleen de door de mislukte run gegenereerde
  failure-screenshot is verwijderd; productcode is voor deze
  orchestration-/importcontensie niet gewijzigd.
- 2026-08-03: de finale ongewijzigde Node-24-herstart van `npm run check` was
  exit 0: format 157 files, lint zonder errors met alleen de bestaande
  `test/obsidian-stub.ts`-waarschuwing, typecheck GREEN, node 738/738 (48 files),
  browser 81/81 (10 files), integration 26/26 (8 files) en browser-matrix 6/6
  (3 files), totaal 851 tests in 69 files. Production build, releasecontract
  (`main.js` 352790/409600 bytes) en community readiness over 58 sourcefiles
  waren in dezelfde canonieke gate GREEN.
- 2026-08-03: de expliciete resterende gates waren eveneens GREEN onder dezelfde
  PATH: `npm run build` exit 0 inclusief `tsc --noEmit` en production esbuild;
  `npm run verify:reproducible` exit 0 met twee gelijke SHA-256-digests
  `17f4fa1b81f9df493de7d2a8e9ca796dced9b3aac6aece9fe144105ef8a90ee1`;
  `git diff --check` exit 0 met lege output. De zeven afzonderlijke no-index-
  checks voor de zes untracked 10x-records en `src/domain/people-paths.ts`
  gaven ieder de verwachte add-only exit 1 met lege checkoutput.
- 2026-08-03: de finale contextbewuste scan omvatte alle 206 toegevoegde
  productieregels in `src/` (149 tracked en alle 57 regels van de untracked
  pathmodule). Zij vond 0 secret-like assignments, 0 `eval`/`new Function`, 0
  child-process-/shell-executie en 0 unsafe DOM/HTML. De enige lexicale
  executiecandidate was `PERSON_UUID_PATTERN.exec(...)`, aantoonbaar lokale
  `RegExp.exec` en geen procesexecutie. Status-/scope-inspectie vond geen
  dependency- of lockfilewijziging, geen generated failure-screenshot en geen
  staged bestand. Het fototicket behield exact SHA-256
  `fc8bb2fba9ae8ea9bc4da4a701f8ba94715966e20f400496f6b8febaaaf080e2`;
  er was geen live vaultwrite, migration, binary assetflow, commit, push, tag of
  release.
- 2026-08-03: alle elf acceptancecriteria zijn uitsluitend op grond van de
  actuele RED→GREEN-regressies, finale worktree-inspectie en bovenstaande
  Node-24-gates afgevinkt. Dit bewijst de gecontroleerde code-/testgrenzen, niet
  live Obsidian, een echte vault/filesystem-/Sync-adapter, Desktop/Mobile,
  screenreader of assistive technology. Het ticket blijft `active`; de tweede
  remediation wacht op een nieuwe onafhankelijke read-only rereview.
- 2026-08-03: de derde onafhankelijke read-only rereview gaf **FAIL**. Alle zeven
  historische bevindingen zijn expliciet `resolved`, maar twee nieuwe blockers
  falsificeren closure: (1, HIGH) een extern geïndexeerde, object-identieke
  foreign personnote kan tijdens de await van ancestor-`createFolder("People")`
  dezelfde `person_id` innemen; de huidige post-foldercontrole herhaalt alleen
  dossierownership, waarna create nog fulfilled en de profielnote geschreven
  wordt; (2, MEDIUM) een displaynaam met control- of wikilinkgrammartekens kan
  via `personProfilePath()` een onveilig canoniek eindpad vormen dat de centrale
  note-pathvalidatie accepteert, zodat folders en note al geschreven worden.
  Daarom zijn uitsluitend expliciete identity/collision, invalid name/path
  no-write, TDD-dekking en actuele gates hierboven teruggezet naar `[ ]`.
  Iedere bevinding vereist afzonderlijk assertion-grade RED→GREEN; ticket blijft
  `active` en vereist een vierde onafhankelijke read-only rereview.
- 2026-08-03: derde-remediation bevinding 1 (async externe `person_id`-drift)
  is strikt RED→GREEN hersteld. Vóór productiecode injecteerde een
  deterministische mutationtest tijdens de await van ancestor-
  `createFolder("People")` een object-identieke foreign personnote op
  `Elsewhere/Foreign Alice.md` en liet de indexgetter voor de eerder vrije ID
  vanaf dat moment dat foreign pad teruggeven. Exact RED-commando:
  `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run
  --project node test/mutation-service.test.ts -t "rejects an externally indexed
  person ID that appears during ancestor folder creation"` => exit 1, 1 failed
  + 46 skipped; verwacht `{ status: "rejected", profileWritten: false }`,
  ontvangen `{ status: "fulfilled", path:
  "People/Profiles/alice--11112222/Alice.md", profileWritten: true }`.
- 2026-08-03: de minimale GREEN herhaalt na alle folder-awaits en de exacte
  dossierownershipcheck, onmiddellijk vóór `vault.create`, dezelfde
  index-/identity-/reservationcheck binnen de bestaande create-catch. Daardoor
  blijft de conflict-MutationError primair, wordt geen profiel geschreven,
  blijven foreign note/object en indexpad behouden en ruimt uitsluitend
  `FileManager.trashFile` het transaction-created lege dossier op; de gemaakte
  ancestors blijven conform de bestaande semantiek staan. Hetzelfde gerichte
  commando werd exit 0, 1 passed + 46 skipped. Mutationqueue, reservations en
  historische dossier-TOCTOU-/cleanupregels zijn niet verzwakt.
- 2026-08-03: derde-remediation bevinding 2 (onveilige displaynaam/profielpad)
  is strikt RED→GREEN hersteld met één gedeelde representatiematrix. Vóór
  productcode dekte zij minimaal U+001F, U+007F, `[`, `]`, `#` en `^`, plus
  behoud van alle platformtekens `\\/:*?"<>|` als veilige filenamegrens en raw
  note-pathafwijzing per segment. Exact RED-commando: `export
  PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node
  test/person-form.test.ts test/mutation-validation.test.ts
  test/mutation-service.test.ts -t "generated canonical profile filename|raw .*
  profile endpath|safely generated profile path|generated note
  filenames|remains raw inside a note-path segment|safe Unicode"` => exit 1,
  3 files failed, 33 failed + 10 passed + 79 skipped. Voor elk van de zes
  nieuwe reviewed-endpaths ontving de no-write-assertie `{ status: "fulfilled",
  profileWritten: true }`; `personProfilePath()` hield het onveilige teken in de
  profielbestandsnaam en de centrale validator accepteerde alle raw
  segmentgevallen.
- 2026-08-03: de minimale GREEN breidt uitsluitend de centrale
  `sanitizeNoteName()`/`validateNotePath()`-grens uit met één expliciete Set en
  U+0000..U+001F/U+007F-codepointcheck, zonder een control-characterregex.
  Gegenereerde filenames vervangen controls, wikilinkgrammar en bestaande
  platformonveilige tekens door `-`; raw onveilige pathsegmenten falen vóór
  folders en notecreate. Dezelfde exacte selectie werd exit 0, 3 files, 43
  passed + 79 skipped. Een via `personProfilePath()` veilig gegenereerde
  U+001F-bestemming schrijft normaal en JSON/YAML-roundtrip bewijst de
  displaynaam code-unit-exact in frontmatter; veilige Unicode, interne spaties
  en `&` blijven onveranderd geldig. Stored root/settings worden niet stil
  gesanitiseerd en same-dossier-rename blijft op dezelfde centrale filenamegrens.
- 2026-08-03: de actuele direct betrokken regressies onder de vastgelegde
  Node-24-PATH waren GREEN: tien nodefiles inclusief de nieuwe centrale
  mutationvalidation gaven 10 files/230 tests; de volledige person-modal
  browserfile 1 file/14 tests; het volledige integrationproject 8 files/26
  tests. Daarmee bleven ook historical TOCTOU, queue/reservations,
  dossiercleanup, same-dossier rename, veilige Unicode/spaties/`&` en de
  alternatieve create-entrypoints actueel gedekt.
- 2026-08-03: de eerste actuele `npm run check` stopte eerlijk uitsluitend bij
  `format:check`; geen latere gate draaide. Biome vroeg één chain-layout in de
  nieuwe identity-drifttest en één `it.each`-layout in de pathmatrix te wijzigen.
  Na exact die twee semantics-vrije formattercorrecties is de volledige check
  vanaf het begin herstart en exit 0 geworden: format 157 files; lint zonder
  errors met alleen de bestaande `test/obsidian-stub.ts`-waarschuwing;
  typecheck GREEN; node 782/782 (48 files), browser 81/81 (10 files),
  integration 26/26 (8 files) en browser-matrix 6/6 (3 files), totaal 895 tests
  in 69 files; production build GREEN; releasecontract GREEN met `main.js`
  353089/409600 bytes; community readiness GREEN over 58 sourcefiles.
- 2026-08-03: de expliciete resterende Node-24-gates waren eveneens GREEN:
  `npm run build` exit 0 inclusief `tsc --noEmit` en production esbuild;
  `npm run verify:reproducible` exit 0 met tweemaal SHA-256
  `15a8354a5a108a4b47c3489dbf97e897e37e2625fa56ac212275e9ec3ed5b093`;
  `git diff --check` exit 0 met nul outputbytes. De zeven afzonderlijke
  add-only no-indexchecks voor de zes untracked 10x-records en
  `src/domain/people-paths.ts` gaven ieder de verwachte exit 1 met nul
  outputbytes.
- 2026-08-03: de contextbewuste finale scan omvatte 224 toegevoegde
  productieregels: 167 tracked diffregels plus alle 57 regels van de untracked
  pathmodule. Zij vond 0 secret-like assignments, 0 dynamic execution, 0
  child-process/shell-executie en 0 unsafe DOM/HTML. De enige lexicale
  executiecandidate in de untracked module is `PERSON_UUID_PATTERN.exec(...)`,
  aantoonbaar een lokale RegExp-match. De drie store-achtige kandidaten zijn
  uitsluitend de transaction-lokale created-folder-Map en twee pure
  validatie-Sets, geen tweede store. Scope-inspectie vond geen full indexscan,
  adapter-/binarywrite, migration/legacypad, directe `Vault.delete`, dependency-
  of lockfilewijziging, staged bestand of generated failurescreenshot. Het
  fototicket behield exact SHA-256
  `fc8bb2fba9ae8ea9bc4da4a701f8ba94715966e20f400496f6b8febaaaf080e2`;
  niets is gecleand, gerevert, gestaged, gecommit, gepusht, getagd of gereleased
  en geen live-vaultwrite is uitgevoerd.
- 2026-08-03: alle elf acceptancecriteria zijn uitsluitend op grond van de
  actuele assertion-grade RED→GREEN-regressies, volledige betrokken suites,
  finale current-worktree-gates en scope-inspectie opnieuw afgevinkt. De
  gecontroleerde adapter bewijst de exacte interleavings/no-write-asserties,
  niet een echte Obsidian-/filesystem-/Sync-adapter, Desktop/Mobile,
  screenreader, assistive technology of live vault. Ticketstatus blijft
  `active`; de derde remediation is klaar voor een vierde onafhankelijke
  read-only rereview.
- 2026-08-03: de vierde onafhankelijke read-only rereview gaf **PASS**. Alle
  negen historische bevindingen zijn expliciet `resolved`; er zijn geen nieuwe
  bevindingen. De gerichte falsificatie was GREEN met 85 + 6 node-tests en 4
  browsertests; typecheck was GREEN. Het bestaande buildartifact was 353089
  bytes met SHA-256
  `15a8354a5a108a4b47c3489dbf97e897e37e2625fa56ac212275e9ec3ed5b093`.
  De review bevestigde daarnaast schone tracked/no-index-whitespacecontroles,
  geen staged bestanden en een ongewijzigde worktree van 27 tracked modified +
  7 untracked bestanden. De eerdere actuele canonieke gate blijft afzonderlijk
  vastgelegd als 895 tests plus GREEN build, reproducibility, diff- en
  security/scopecontrole. De rereview herhaalde die brede suite, het volledige
  integrationproject en de build bewust niet; zij certificeert evenmin een live
  Obsidian-vault, echte filesystem-/Sync-adapter, Desktop/Mobile of assistive
  technology. Geen echte vaultwrite, binary assetflow, staging, commit, push,
  tag of release is uitgevoerd. Met alle acceptancecriteria afgevinkt, Review
  PASS en geen open blocker is dit ticket conform de lokale 10x-lifecycle
  gesloten als `done`.

## Evidence

- RED 1: assertion en exact received/expected-pad hierboven; geen productiecode
  voor deze invariant was vóór deze RED gewijzigd.
- GREEN 1: `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/person-form.test.ts -t "derives a configured dossier and profile path from a stable UUID-backed person ID"`
  => exit 0, 1 passed + 24 skipped. Minimale productiecode: nieuwe pure
  `src/domain/people-paths.ts` plus delegatie vanuit de bestaande
  `proposeCreatePersonPath`-formseam; dit bewijst custom root, Profiles,
  normalized slug, UUID-afgeleide lower-case suffix en profielbestandpad.
- RED 2: `export PATH=/home/nms/.local/node24/bin:$PATH; npm exec -- vitest run --project node test/person-form.test.ts -t "plans one explicit UUID-backed person ID before mapping a create mutation"`
  => exit 1, 1 failed + 25 skipped; assertion verwachtte
  `person-11112222-3333-4444-aaaa-bbbbbbbbbbbb`, ontvangen lege `personId`.
- GREEN 2: hetzelfde gerichte commando => exit 0, 1 passed + 25 skipped.
  `createPersonFormValues` draagt nu de reeds geplande ID en
  `buildPersonCreateInput` geeft haar expliciet aan de mutationboundary door.
- AC settingscontract: de RED→GREEN-runs in het Journal en de finale betrokken
  node-suite bewijzen precies één getrimde, veilige `peopleRootFolder` in type,
  defaults, load, validatie en UI; legacy `peopleFolder` en
  `contactMomentsFolder` worden niet teruggegeven of gemigreerd. Unsafe absolute,
  scheme-, dotsegment- en lege-segmentroots houden writes read-only.
- AC pure paths/create: `src/domain/people-paths.ts` is de ene pure seam voor
  rootcollecties, slug, UUID-suffix, dossier en profielpad. Formulier-, modal-,
  mention- en mutationasserties bewijzen custom root, lower-case suffix,
  volledige `<root>/Profiles/<slug>--<suffix>/<naam>.md`-create, dezelfde vooraf
  geplande ID tot en met frontmatter en openen van uitsluitend de profielnote.
- AC no-write/cleanup: de mutationtests bewijzen ontbrekende/ongeldige ID en
  vooraf bestaande dossiercollision vóór writes; de drie cleanupasserties
  bewijzen respectievelijk lege transaction-created dossiertrash, behoud van een
  gevuld dossier met vrije inhoud en behoud van de oorspronkelijke createfout
  als cleanup zelf faalt. De finale community-safe route is
  `FileManager.trashFile`, niet directe `Vault.delete`.
- AC Save/rename: de browsertest bewijst geen create vóór expliciete Save, exact
  één create daarna, note-open en geen foto-output. De same-dossiertest bewijst
  een ongewijzigde dossiermap, `person_id`, lokale asset en vrije note terwijl
  uitsluitend het profielbestand binnen dat dossier wordt hernoemd.
- AC centrale collecties: formtests bewijzen uit de root afgeleide voorstellen;
  mutationtests weigeren paden buiten de afgeleide centrale collecties en
  schrijven onder een custom root naar exact `Relationships` en
  `Contact moments`. De gerichte contactmomenttest behoudt
  `advanceRelationshipLastContact === false`/`relationship.status ===
  "not-requested"`; de volledige regressies dekken bestaande validation,
  canonicaliteit en follow-up.
- AC index/migratie/non-goals: inspectie van de actuele productiediff vond geen
  wijziging aan de Markdown/type-gebaseerde indexseams, geen tweede store of
  full scan per create en geen pathclassificatie van vrije dossierinhoud. Load
  dropt legacy folderkeys zonder persistentie- of vaultmigratie; de diff bevat
  geen assetoperatie of ondersteunende dossierinhoud.
- Historische pre-reviewregressies onder de vastgelegde Node-24-PATH:
  - `npm exec -- vitest run --project node test/mutation-service.test.ts` =>
    1 file, 36/36 GREEN;
  - `npm exec -- vitest run --project node test/mutation-service.test.ts test/person-form.test.ts test/mention.test.ts test/person-entrypoints.test.ts test/settings-load.test.ts test/settings-tab.test.ts test/view-state-write-coordination.test.ts test/relationship-form.test.ts test/contact-moment-form.test.ts`
    => 9 files, 150/150 GREEN;
  - `npm exec -- vitest run --project browser test/browser/person-modal.browser.test.ts`
    => 1 file, 14/14 GREEN;
  - `npm exec -- vitest run --project integration` => 8 files, 26/26 GREEN.
- Historische pre-reviewgate-evidence onder Node `v24.18.1`/npm `11.16.0`:
  - `npm run check` => exit 0; 708 node + 81 browser + 26 integration +
    6 browser-matrix = 821 tests/69 files; alleen de bestaande
    `test/obsidian-stub.ts`-Biomewaarschuwing;
  - `npm run build` => exit 0 (`tsc --noEmit` en production esbuild);
  - `npm run verify:reproducible` => exit 0; beide `main.js`-builds SHA-256
    `1baf11ea490dfd2492d9dea691cc2b32ee22f2c54eb78847f83ce7e206ce9326`;
  - `git diff --check` => exit 0, lege output; zeven no-index checks => alleen
    verwachte diff-exit 1, lege checkoutput;
  - contextbewuste scan van 118 toegevoegde productieregels => vier categorieën
    elk 0 bevindingen: secrets, dynamic execution, child process/shell en unsafe
    HTML/DOM.
- De bovenstaande historische evidence certificeerde de toenmalige pre-review-
  worktree. De daaropvolgende onafhankelijke review is uitgevoerd en gaf de
  gejournaliseerde FAIL; onderstaande actuele remediation-evidence vervangt de
  counts/hash voor de huidige worktree.
- Remediation AC reviewed destination: mapper-, stale-root-, mention-, modal- en
  mutationasserties bewijzen dat exact het zichtbare createpad wordt meegedragen,
  bij Save opnieuw canoniek wordt afgeleid en vóór iedere write stale faalt.
  Alle bestaande createfixtures verwachten nu een exact canoniek `reviewedPath`;
  geen assertion of alternate entrypoint omzeilt de grens.
- Remediation AC collision/cleanup: de assertion-grade interleavingtest bewijst
  dat een na de precheck extern ontstaan dossier inclusief vrije usernote geen
  profielwrite ontvangt. Post-`ensureFolder`-eigendom vereist zowel de eigen
  created-mapentry als hetzelfde live object; de bestaande writefailuretests
  bewijzen daarnaast lege owned cleanup, behoud van later toegevoegde inhoud en
  de primaire writefout.
- Actuele regressie-evidence onder Node `v24.18.1`/npm `11.16.0`: 9 direct
  betrokken nodefiles 154/154, person-modal browser 14/14, integration 26/26 en
  mutationservice 39/39 GREEN. `npm run check` is na de gejournaliseerde
  format-only correctie volledig GREEN met 712 node + 81 browser + 26
  integration + 6 browser-matrix = 825 tests/69 files; releasecontract en
  community-readiness zijn eveneens GREEN.
- Actuele overige gate-evidence: `npm run build` exit 0;
  `npm run verify:reproducible` exit 0 met tweemaal
  `bfaa6b44a5297a4f04a8a1e83473240e513c85fb048e81ee610cbf64cb039b48`;
  tracked whitespace exit 0; zeven add-only no-indexchecks ieder verwachte exit
  1 zonder checkoutput; contextbewuste scan van 194 toegevoegde
  productieregels 0 echte bevindingen in alle vier categorieën.
- Actuele limits: deze evidence certificeert geautomatiseerde assertions en de
  geïnspecteerde dirty diff, niet gedrag in een echte Obsidian-host/vault,
  filesystem-/Sync-adapter, Desktop/Mobile of assistive technology. Geen live
  host-/vaultcertificering, migratieproef, binary assetflow, staging, commit,
  push, tag of release is uitgevoerd. Ticketstatus blijft `active`; een nieuwe
  onafhankelijke review is nog pending.
- Finale second-remediation-evidence vervangt de hierboven historisch genoemde
  actuele counts/hash voor de huidige worktree. De create-serializer kan geen
  `photo`-property meer voortbrengen; empty/whitespace schrijven haar niet en
  non-empty faalt vóór writes. De mutationboundary valideert de raw getrimde
  `reviewedPath` vóór normalisatie en vereist daarna exacte gelijkheid met de
  canonieke bestemming; slash, backslash, dubbele separator, missing, stale
  naam en stale root zijn write-free gedekt. Eén centrale
  `validatePeopleRootFolder()` weigert raw control-/delimitertekens in loader en
  inline UI, terwijl de echte relationship- en contactmomentwikilinks met veilige
  Unicode, spaties en `&` exact door `parsePersonReference()` roundtrippen.
- Finale gate-evidence onder Node `v24.18.1`/npm `11.16.0`: `npm run check`
  exit 0 met 738 node + 81 browser + 26 integration + 6 browser-matrix = 851
  tests/69 files, production build, releasecontract 352790/409600 bytes en
  community readiness GREEN; `npm run build` exit 0;
  `npm run verify:reproducible` exit 0 met tweemaal
  `17f4fa1b81f9df493de7d2a8e9ca796dced9b3aac6aece9fe144105ef8a90ee1`;
  tracked whitespace exit 0 en zeven add-only no-indexchecks ieder exit 1 met
  lege output. De scan van 206 toegevoegde productieregels had 0 echte
  bevindingen in secrets, dynamic execution, child process/shell en unsafe
  DOM/HTML; `PERSON_UUID_PATTERN.exec(...)` is een lokale RegExp-match.
- Finale evidencegrens: de eenmalige aggregate integration-timeout is zonder
  gatewaiver vastgelegd en exact geïsoleerd plus als volledig project GREEN
  onderscheiden; de finale canonieke run zelf is GREEN. Geen timeout, retry,
  skip of assertion is aangepast. De huidige status bewijst geen onafhankelijke
  review en geen live-host-/vaultcertificering; lifecycle blijft `active`.
- Derde-remediation AC identity/collision: de nieuwe ancestor-awaittest begint
  met een lege indexgetter, injecteert daarna één object-identieke foreign
  personnote met dezelfde expliciete ID en laat de getter dat pad retourneren.
  RED bewees fulfilled + profileWritten; GREEN bewijst conflict vóór create,
  behoud van foreign note/object/index, cleanup van uitsluitend het eigen lege
  dossier via `FileManager.trashFile` en behoud van de ancestors. De volledige
  mutationservicefile binnen de betrokken run bewijst daarnaast de bestaande
  queue-, reservation-, foreign-dossier-, cleanup- en primary-errorasserties.
- Derde-remediation AC veilige displaynaam/eindpad: pure helper-, centrale
  validator- en mutationtests dekken U+001F, U+007F, `[`, `]`, `#`, `^`, alle
  platformtekens `\\/:*?"<>|`, raw no-write en een veilig gesanitiseerde
  profielwrite. De filename wijzigt alleen de pathrepresentatie; de
  frontmatterdisplaynaam roundtript code-unit-exact. Unicode, spaties en `&`
  blijven geldig en de bestaande same-dossier rename is GREEN.
- Derde-remediation finale evidence vervangt voor de huidige worktree de
  eerdere counts/hash: direct node 230, person-modal browser 14 en integration
  26; canonieke check 782 node + 81 browser + 26 integration + 6 matrix = 895;
  build GREEN; reproducibility tweemaal
  `15a8354a5a108a4b47c3489dbf97e897e37e2625fa56ac212275e9ec3ed5b093`;
  tracked/no-index whitespace GREEN binnen de gedocumenteerde add-only exits;
  224 toegevoegde productieregels met 0 echte security- of scopebevindingen.
- Derde-remediation limit: geen timeout, retry, skip of assertion is gewijzigd;
  de formatterwijzigingen waren exact layout-only. Geen live-host/vault,
  filesystem/Sync, Desktop/Mobile of assistive-technologybewijs; geen commit,
  push of publicatie. Een vierde onafhankelijke rereview blijft closureblokker.

## Review

PASS — fourth independent read-only rereview; all nine historical findings are
resolved and no new findings were found. Closure is supported within the
targeted automated/static limits journaled above; live-host, real-vault,
filesystem/Sync, Desktop/Mobile and assistive-technology certification remain
outside this verdict.

## Retrospective

- **Wat brak en kostte tijd:** de uitvoering liep meerdere keren tegen de
  tool-calllimiet en moest koud worden overgedragen. Productcode en tests waren
  daardoor eerder verder dan het ticketjournal, terwijl iedere opvolger de
  dirty baseline, references, source en eerdere RED/GREEN-output opnieuw moest
  reconstrueren. Ook liet het eerste `npm test -- --run ...` door het
  samengestelde npm-script onverwacht de hele nodesuite lopen. Volgende
  vergelijkbare uitvoering moet evidence direct na iedere observatie append-en
  en bij handoff exact commando, exitcode, count, assertion en resterende scope
  als één auditbaar blok meenemen.
- **Wat verraste:** de bestaande same-dossier rename-seam bleek de nieuwe
  invariant al correct te dragen; de test werd direct GREEN en vergde geen
  productie-abstraction. Daartegenover stonden verspreide relatie- en
  contactmomentpaden plus de `@`-mention-entrypoint, die aantoonden dat een
  correcte hoofdmodal niet bewijst dat alle createpaden dezelfde identiteit en
  root gebruiken.
- **Wat werkte:** één kleine pure `people-paths`-seam plus onafhankelijke
  write-boundaryvalidatie hield UI-preview, forms, mentions en mutations DRY
  zonder tweede store of migratielaag. Assertion-grade tests op concrete
  no-write-, collision-, cleanup- en custom-rootgevallen maakten minimale fixes
  mogelijk en beschermden vrije dossierinhoud expliciet.
- **Vijf-waaroms-les:** paddrift bestond omdat eerdere losse foldersettings raw
  paden tot diep in forms en mutations lieten doorlopen; daardoor konden nieuwe
  callsites een vaste map of oude key blijven gebruiken; code-audit vond precies
  zo de mentionseam. De duurzame safetyrail is daarom niet alleen centrale
  afleiding, maar ook afwijzing van elk createpad buiten de afgeleide collectie
  op de mutationboundary.
- **Community-gate-les:** de directe `Vault.delete` leek lokaal de kleinste
  rollback, maar omzeilde Obsidian's verwachte FileManager-prullenbakroute. De
  community gate functioneerde als noodzakelijke safetyrail en dwong de
  cleanupfixture én productiecode naar `FileManager.trashFile`, zonder de
  invarianten te verzwakken: alleen transaction-created + live hetzelfde + leeg,
  en nooit de oorspronkelijke writefout maskeren.
- **Resterend risico:** alle gecontroleerde suites en gates zijn groen, maar er
  is bewust geen echte Obsidian-/vaultcertificering. Onafhankelijke review moet
  nog proberen de diff, assertions, mutationgrenzen en deze evidence te
  falsifiëren voordat closure kan worden overwogen.
- **Review-remediationles:** een getoond pad is onderdeel van de reviewbare
  write-intentie, niet alleen presentatie. Het moet dezelfde async grens passeren
  als identiteit en direct vóór de mutation opnieuw canoniek worden vergeleken;
  anders maakt live settingsdrift een correcte preview betekenisloos.
- **TOCTOU-les:** een precheck vóór meerdere awaits bewijst geen eigendom op het
  write-moment. De kleinste duurzame safetyrail is post-await provenance van het
  exacte doelobject plus live objectidentiteit vóór de eerste inhoudswrite, met
  een deterministische interleavingfixture die zowel de foreign usernote als de
  verboden profielwrite observeert.
- **Hervattingsles:** een nieuw verplicht payloadveld heeft een mechanische
  fixtureblast-radius naast zijn gerichte gedragstest. Inventariseer na de
  verticale GREEN alle createcalls en exacte browserpayloads, herstel die zonder
  matchers te verbreden en draai daarna altijd de volledige betrokken files.
- **Gate-les:** een formatter-RED bewijst uitsluitend dat latere samengestelde
  gates niet draaiden. Pas alleen de getoonde semantics-vrije layout toe en
  herstart het volledige canonieke commando; rapporteer pas daarna de werkelijke
  testcounts, build, release- en community-uitkomst.
- **Tweede-rereviewles:** een niet-lege boundaryguard is geen structureel verbod
  wanneer een latere serializer empty/whitespace alsnog kan schrijven; een
  genormaliseerd reviewed path is niet dezelfde intentie als raw byte-exacte
  approval; en een veilig vaultpad is nog geen veilig wikilinktarget. De
  duurzame grenzen zitten daarom respectievelijk in de create-only serializer,
  vóór pathnormalisatie en in één gedeelde grammar-aware rootvalidator met echte
  parserroundtrip.
- **Gate-representatieles:** functioneel juiste control-characterdekking kan de
  static-policygate nog schenden wanneer de tekens als regexrange zijn
  uitgedrukt. De exacte Set + codepointvariant behield de reeds rode/groene
  regressiematrix en maakte de policy expliciet zonder nieuwe pathsemantiek te
  introduceren.
- **Runnerdiagnoseles:** een aggregate browsertimeout zonder assertion is geen
  productrootcause. De exacte test en daarna het project afzonderlijk GREEN
  draaien onderscheidde import-/runnercontensie van gedrag; timeouts, retries,
  skips en assertions bleven onaangeraakt en alleen een echte finale canonieke
  GREEN telde als gatebewijs.
- **Finaliseringsles:** reserveer bij meerdere rereviews expliciet budget voor
  volledige gates, scope-/securityscan, recordpatch, volledige readback en
  post-record-whitespace. Anders kan correcte implementatie opnieuw zonder
  actuele auditbare counts, hash en reviewstatus achterblijven.
- **Derde-rereview identity-les:** de pluginqueue serialiseert alleen eigen
  calls; zij is geen lock tegen indexevents van externe writers. Iedere
  app-gecontroleerde await vóór een identitywrite vereist daarom een laatste
  live index-/reservationcheck op het write-moment, binnen dezelfde
  transaction-owned cleanupcatch die de primaire conflictreden bewaart.
- **Derde-rereview path-les:** displaytekst en pathgrammar zijn verschillende
  representaties. Sanitiseer uitsluitend de gegenereerde filename, behoud de
  frontmatterwaarde exact en weiger raw onveilige endpaths centraal vóór I/O;
  stored roots/settings stil opschonen zou daarentegen reviewbare intentie en de
  bestaande fail-closed loadgrens verzwakken.
