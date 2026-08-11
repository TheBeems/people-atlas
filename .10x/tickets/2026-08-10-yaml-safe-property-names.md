Status: done
Created: 2026-08-10
Updated: 2026-08-11
Parent: None
Owner: People Atlas implementation workstream — YAML/property safety
Depends-On: `.10x/specs/yaml-safe-property-names.md`, `.10x/specs/contact-moments-follow-up.md`, `.10x/specs/safe-mutations-and-versioned-data.md`

# YAML-veilige configureerbare property-namen

## Scope

Implementeer `.10x/specs/yaml-safe-property-names.md` als één
**dependency-ready TDD-ticket**. De bounded uitkomst is de bescherming van alle
configureerbare YAML-property-namen die nieuwe persoons-, relatie- of
contactmomentnotities kunnen genereren:

1. centraliseer de Unicode-property-name grammar
   `^[\p{L}_][\p{L}\p{Nd}_-]*$` met Unicode (`u`-semantiek);
2. laat de bestaande property-name UI-, settings-update- en settings-loadpaden
   dezelfde grammar fail-closed toepassen;
3. neem relatie-property settings op in de stored-settingsvalidatie, zonder de
   bestaande distinctnessregels voor persoon of contactmoment te veranderen;
4. behoud bestaande trim-, foutmelding-, write-disabled- en
   no-migrationsemantiek waar de nieuwe grammar geen expliciete wijziging vraagt;
5. voeg roundtriptests toe voor nieuwe persoons-, relatie- en
   contactmomentnotities met unieke toegestane Unicode-keys en alle optionele
   velden die de bestaande create-serializers kunnen emitten (de bestaande
   niet-lege `photo`-create-afwijzing blijft actief), waarbij de gegenereerde YAML
   opnieuw wordt geparseerd en iedere ingestelde key en waarde exact wordt gecontroleerd;
6. breid uitsluitend de testharness/parsergrens uit als de huidige
   ASCII-keyherkenning Unicode-roundtripbewijs onmogelijk maakt.

De uitvoerder mag de bestaande ongequote keyserialisatie behouden. Een brede
YAML-writer, quotinglaag, vaultmigratie of wijziging van de property-naamsemantiek
buiten deze spec is niet nodig.

## Niet doen

- Geen wijziging aan typewaarden, `personTag`, foldernamen, IDs,
  `relationshipRoleFormat` of willekeurige door gebruikers beheerde
  frontmatterkeys.
- Geen nieuwe cross-domain collisionregels; bestaande persoons- en
  contactmoment-distinctness blijft onveranderd.
- Geen automatische quoting/escaping als vervanging voor de afgesproken
  grammar, geen silent rename en geen normalisatie van bestaande vaultnotes.
- Geen settingsschema-migratie, fresh-vaultlayoutwijziging, brede serializer-
  refactor of nieuwe runtime dependency tenzij een concreet testharnessprobleem
  dit noodzakelijk maakt en het expliciet wordt vastgelegd.
- Geen wijziging aan identity-, parser-, index-, mutation-, body-preservation-,
  relationship- of contactmomentsemantiek buiten de pre-write settingsguard.
- Geen commit, push, tag, release, externe write of vaultwrite in deze
  record-/implementatiefase zonder aparte expliciete autorisatie.

## Acceptatiecriteria

- [x] Eén gedeelde validator accepteert exact Unicode-letters,
      Unicode-decimale cijfers, `_` en `-`, met Unicode-letter of `_` als eerste
      code point en zonder maximumlengte.
- [x] De validator weigert lege waarden, whitespace, control characters,
      YAML-significante leestekens, leading indicators, leading cijfers en
      overige tekens buiten de grammar.
- [x] Elke property-name setting uit de specscope wordt bij opgeslagen
      settings-load gevalideerd vóór `writeEnabled` true wordt; een ongeldige
      relatie-property kan niet buiten de loaderguard vallen.
- [x] Elke interactieve property-name wijziging wordt vóór `saveData()` en
      vóór index/vaultside-effects geweigerd wanneer de resulterende settings
      ongeldig zijn; de oude in-memorywaarde blijft behouden.
- [x] Bestaande standaardsettings, trimgedrag, distinctnesschecks,
      write-disabled-fallback en no-migration/no-note-rewritecontracten blijven
      groen.
- [x] Een persoonsnotitie met alle optionele velden en unieke toegestane
      Unicode-property-keys wordt gegenereerd, opnieuw geparseerd en bewijst
      exacte key- en waarderoundtrip.
- [x] Een relatienotitie met alle optionele velden en unieke toegestane
      Unicode-property-keys wordt gegenereerd, opnieuw geparseerd en bewijst
      exacte key- en waarderoundtrip.
- [x] Een contactmomentnotitie met relatie, channel, summary en follow-upvelden
      en unieke toegestane Unicode-property-keys wordt gegenereerd, opnieuw
      geparseerd en bewijst exacte key- en waarderoundtrip.
- [x] De roundtripasserties falen bij key-splitsing, nesting, truncatie,
      ASCII-only parsergedrag of waarde-aan-een-verkeerde-key, en worden niet
      verzwakt om de testharness te accommoderen.
- [x] Per verticale slice staat actuele RED→GREEN-evidence in dit ticket met
      exact commando, exitcode, scope, runtime en limieten.
- [x] Na de laatste source/testwijziging geeft een onafhankelijke read-only
      review `PASS`, of ieder niet-kritiek residueel risico heeft een expliciete
      duurzame owner en acceptatie.
- [x] De actuele volledige Node-24-gate is groen: format, lint, typecheck,
      volledige test, production build, community check, dependency audit,
      release contract, reproducibility en `git diff --check`.
- [x] Dit ticket bleef open/active totdat onafhankelijke review en actuele
      gate groen waren; recordclaims of historische testoutput waren geen
      closurebewijs.

## References

- `.10x/specs/yaml-safe-property-names.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `src/settings/validate.ts`
- `src/settings/load.ts`
- `src/settings/settings-tab.ts`
- `src/main.ts`
- `src/mutations/validation.ts`
- `src/mutations/atlas-mutation-service.ts`
- `test/settings-load.test.ts`
- `test/settings-tab.test.ts`
- `test/view-state-write-coordination.test.ts`
- `test/contact-moment-mutation.test.ts`
- `test/mutation-service.test.ts`
- `test/obsidian-stub.ts`

## Aannames en provenance

- **User-ratified 2026-08-10:** één bounded scope voor alle configureerbare
  YAML-property-namen van persoon-, relatie- en contactmomentnotities.
- **User-ratified 2026-08-10:** Unicode-letter/Unicode-decimaal-cijfer plus
  `_`/`-`, met Unicode-letter of `_` als eerste teken en geen maximumlengte.
- **Record-backed:** `.10x/specs/contact-moments-follow-up.md` behoudt de
  bestaande non-empty/distinct- en contactmomentcontracten; deze spec vernauwt
  alleen de lexicale keygrammar.
- **Source-backed 2026-08-10:** `src/settings/validate.ts` weigert nu alleen
  lege property-namen en whitespace; `src/settings/load.ts` valideert persoon-
  en contactmomentmappings maar heeft geen aparte volledige relatie-property-
  mappingcheck.
- **Source-backed 2026-08-10:**
  `src/mutations/atlas-mutation-service.ts` bouwt persoons-, relatie- en
  contactmomentfrontmatter met ongequote interpolatie van configured property
  names; `src/mutations/validation.ts` quote waarden maar niet keys.
- **Source-backed 2026-08-10:** `test/obsidian-stub.ts` matcht momenteel alleen
  `[A-Za-z0-9_-]+` voor YAML-keys; de Unicode-roundtriptest moet deze
  testharnessbeperking oplossen of een production-compatible parser gebruiken.
- **Geen implementatieautorisatie in deze recordturn:** de gebruiker vroeg om
  spec/ticketvorming; production source, tests, dependencies en vaultdata worden
  pas in een aparte uitvoeringsbeurt gewijzigd.

## Verticale TDD-slices

### Slice 1 — Gedeelde grammar en settings trust boundary (RED → GREEN)

- **RED:** voeg tests toe die `bad:key`, `name#comment`, `{nested}`,
  `[list]`, `-name`, `9lives`, whitespace en control characters aanbieden aan
  de property-name/settingsload/updatepaden. Laat ook een onveilige
  `relationshipIdProperty` door de stored-settingsroute lopen. De huidige
  validator/loader moet minstens deze nieuwe grammargevallen ten onrechte
  accepteren; de RED moet vóór productiecodewijziging vastliggen.
- **GREEN:** implementeer de gedeelde Unicode-grammar en gebruik die voor alle
  property-name settings uit de specscope. Voeg de relatie-propertygroep toe
  aan dezelfde loader/updateguard, behoud bestaande distinctness en laat
  ongeldige settings vóór `saveData()`, indexrebuild of vaultmutatie afbreken.
- **Bewijs:** focused settings/validationtests bewijzen de grammatica en
  fail-closed writes; ze bewijzen niet dat reeds bestaande vaultnotes worden
  hersteld of gemigreerd.

### Slice 2 — Persoons-, relatie- en contactmoment-YAML-roundtrip (RED → GREEN)

- **RED:** maak een dedicated serializerfixture met voor iedere scoped property
  een unieke toegestane Unicode-key, vul alle optionele velden in, genereer elk
  van de drie notitietypen en parseer de volledige frontmatter opnieuw. Tegen de
  huidige ASCII-only testparser of onbeschermde keygrens moet de assertion-level
  keyroundtrip aantoonbaar falen.
- **GREEN:** maak alleen de noodzakelijke productie-/testharnesswijzigingen:
  laat de gevalideerde keys door de bestaande serializers lopen en maak de
  parserfixture Unicode-correct. Controleer per notitietype de exacte verwachte
  keyset, één-op-één keywaarde en afwezigheid van onverwachte keys.
- **Bewijs:** drie echte create-and-parseflows bewijzen platte, exact behouden
  YAML-properties. De test bewijst niet live Obsidian Desktop/Mobile-parser-
  verschillen buiten de gebruikte production-compatible parsergrens.

### Slice 3 — Regressies, review en actuele gate (RED → GREEN)

- **RED:** draai de bestaande settings-, mutation- en frontmattertests samen met
  de nieuwe regressies tegen de complete wijziging; classificeer iedere fout als
  contractdrift, fixture/parserprobleem of productdefect vóór reparatie.
- **GREEN:** herstel alleen concrete bounded findings, voer typecheck en focused
  tests uit, en commissioneer daarna één onafhankelijke read-only review op de
  definitieve worktree. Na een eventuele source/testreparatie zijn eerdere
  review- en gateclaims stale.
- **Bewijs:** leg Node-version, exacte commando's, exitcodes, testcounts en
  limieten vast; voer pas na review-PASS de volledige Node-24-gate uit.

## Journal

- 2026-08-10: De gebruiker rapporteerde dat de bestaande validator lege
  property-namen en whitespace afwijst maar YAML-significante tekens en leading
  indicators toelaat, terwijl nieuwe notities property-namen ongequote in YAML
  interpoleren.
- 2026-08-10: Read-only source inspection vond drie nieuwe-note serializers in
  `src/mutations/atlas-mutation-service.ts` voor persoon, relatie en
  contactmoment. `yamlValue()` quote waarden; property-names blijven ongequote.
- 2026-08-10: Read-only source inspection bevestigde dat de loader
  persoons- en contactmomentmappings controleert, maar relatie-property settings
  niet als volledige mappinggroep valideert.
- 2026-08-10: De gebruiker ratificeerde de scope voor alle configureerbare
  YAML-property-namen en de Unicode grammar met Unicode-letter/underscore als
  eerste teken, Unicode-decimale cijfers/underscore/koppelteken daarna, zonder
  maximumlengte.
- 2026-08-10: Deze recordturn schrijft uitsluitend de nieuwe `.10x`-spec en
  `.10x`-ticketrecords. Productcode, tests, dependencies, buildartefacts,
  vaultdata, commit en push zijn niet gewijzigd of uitgevoerd.
- 2026-08-11: TDD-slice 1 RED→GREEN: de nieuwe grammar-, stored-load-,
  interactieve-update- en no-write-regressies zijn eerst rood gemaakt en daarna
  groen hersteld. De gedeelde validator gebruikt exact
  `^[\\p{L}_][\\p{L}\\p{Nd}_-]*$` met Unicode `u`-semantiek; alle 32 scoped
  YAML-property settings worden gezamenlijk gevalideerd.
- 2026-08-11: TDD-slice 2 RED→GREEN: de roundtrip-probe faalde met drie
  verwachte failures tegen de oude ASCII-keyparser; na de Unicode-veilige
  harnessuitbreiding slaagden de persoon-, relatie- en contactmomentflows
  gezamenlijk met 145/145 tests. De parserdecode controleert platte keys,
  JSON scalar/arraywaarden en numerieke waarden.
- 2026-08-11: TDD-slice 3 GREEN: focused suite
  `npx vitest run test/mutation-service.test.ts test/contact-moment-mutation.test.ts test/settings-load.test.ts test/view-state-write-coordination.test.ts test/contact-moment-entrypoints.test.ts --no-file-parallelism --maxWorkers=1`
  slaagde met 249/249 tests onder Node 24.19.0. Typecheck, format-check, lint
  (exit 0; één bestaande warning en één bestaande info) en diff-check slaagden.
- 2026-08-11: De review ontdekte een settings-TOCTOU-risico rond async
  mutationwrites. `assertWritable()` retourneert nu een `structuredClone` van
  settings na dezelfde property-validator; alle serializers gebruiken de
  operation-scoped snapshot, inclusief retry/template-sync en de tweede
  `createPerson`-guard na async folder-creatie. De adversarial regressies zijn
  daarna groen gemaakt.
- 2026-08-11: Onafhankelijke final read-only review op de definitieve worktree:
  formeel `PASS`, zonder material findings. Native Obsidian Desktop/Mobile,
  live parsergedrag en live vaultinteractie blijven expliciete limieten; de
  review behandelt die niet als implementatieblocker.
- 2026-08-11: Actuele volledige Node-24-gate onder Node 24.19.0/npm 10.9.8:
  format, lint, typecheck, `npm run test` (57 Node-bestanden/1059 tests, 12
  browser-bestanden/171 tests, integratie en drie DPR-runs), `npm run build`,
  production build, community check, dependency audit (0 vulnerabilities),
  release contract, reproducibility met gelijke SHA-256 en `git diff --check`
  slaagden allemaal met exitcode 0. De bekende fake-vitest stacktrace is een
  verwachte negatieve child-process-regressie; de parenttest en het script
  slaagden.

## Blokkers

Geen inhoudelijke blocker voor de bounded implementatie. Native Obsidian
Desktop/Mobile/live-parsergedrag en live vaultinteractie zijn niet door deze
harness bewezen en blijven expliciete limieten. Record-coherentie-audit is de
resterende closurestap; daarom blijft dit ticket voorlopig `active`.

## Evidence

- **C1–C4 — grammar en trust boundaries:** `src/settings/validate.ts` bevat de
  gedeelde Unicode-grammar en enumerable 32-key scope. Stored settings worden
  fail-closed geladen in `src/settings/load.ts`; interactieve updates worden
  vóór `saveData()`, index rebuild en vaultside-effects gevalideerd in
  `src/main.ts`. De settings-, tab- en no-write-regressies zijn groen.
- **C5 — bestaande contracten:** distinctness, trim-/write-disabled-gedrag,
  fresh-vault-only/no-migration en no-note-rewritegedrag blijven door de
  bestaande regressies gedekt.
- **C6–C8 — roundtrips:** persoon-, relatie- en contactmoment-serializers zijn
  met unieke toegestane Unicode-keys en optionele waarden getest; de
  parserharness decodeert Unicode keys, JSON scalar/arraywaarden en nummers.
  Roundtrip slice: 145/145; focused mutation/settings suite: 249/249.
- **C9 — RED→GREEN:** de oude ASCII-parser gaf drie assertion-level failures;
  na de minimale harnessuitbreiding is de roundtripset groen. De adversarial
  settings-TOCTOU-tests waren eerst rood en zijn groen na de immutable snapshot-
  repair.
- **C10 — actuele verticale-slice-evidence:** de Journal legt per slice de
  RED→GREEN-observatie vast met het exacte focused commando, exitcode, runtime,
  testscope en expliciete limieten; de actuele focused suite is 249/249.
- **C11 — onafhankelijke review:** final read-only review op de actuele
  definitieve worktree gaf formeel `PASS`, zonder material findings
  (2026-08-11).
- **C12 — actuele Node-24-gate:** Node 24.19.0/npm 10.9.8; format, lint,
  typecheck, volledige `npm run test`, `npm run build`, production build,
  community check, dependency audit (0 vulnerabilities), release contract,
  reproducibility en `git diff --check` slaagden allemaal met exitcode 0.
  De volledige test omvatte 57 Node-bestanden/1059 tests, 12
  browser-bestanden/171 tests, integratie en drie DPR-runs. Reproducibility
  rapporteerde gelijke SHA-256-digests.
- **C13 — statussequencing:** het ticket bleef `active` totdat de onafhankelijke
  review en actuele Node-24-gate groen waren; de record-coherentie-audit draait
  afzonderlijk vóór de terminale statusovergang naar `done`.

**Limieten:** de gebruikte parserharness is geen live Obsidian Desktop/Mobile-
validatie; native hostinteractie, live vaultgedrag en externe publicatie zijn
niet bewezen. De worktree blijft oncommitted en ongepusht.

## Review

2026-08-11 — onafhankelijke read-only final implementation review op de
exacte definitieve worktree: **PASS**. Geen critical, significant of material
minor findings. De review bevestigde de 32-key scope, exacte Unicode-grammar,
load/update guards, immutable settings-snapshots over alle mutation serializers,
roundtrips, distinctness/no-migration en i18n. Native Desktop/Mobile/live parser
werd expliciet als niet-bewezen limiet onderscheiden, niet als blocker.

## Retrospective

- **Wat brak:** de bestaande ASCII-only YAML-keyherkenning kon Unicode-
  roundtrips niet assertion-grade bewijzen; de eerste TOCTOU-review vond daarna
  een mutable settingsreferentie rond async mutationwrites.
- **Wat werkte:** eerst RED-probes voor grammar/roundtrip/races, daarna één
  gedeelde validator en één snapshot-returning write boundary; de onafhankelijke
  review werd pas na de laatste bronpatch opnieuw uitgevoerd.
- **Duurzame les:** een tweede validatie op een live settingsobject is onvoldoende
  na `await`; de post-await serializer moet de clone-returning boundary aanroepen
  en de teruggegeven snapshot gebruiken. Een testharness moet dezelfde key- en
  waardesemantiek als de production-compatible parser modelleren.
- **Volgende actie:** geen vervolgcode-ticket nodig voor de bounded scope. Native
  Obsidian Desktop/Mobile-validatie blijft een aparte, expliciet te autoriseren
  hostvalidatie als die ooit vereist wordt.
