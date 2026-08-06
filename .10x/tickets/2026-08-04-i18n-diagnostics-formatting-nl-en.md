Status: active
Created: 2026-08-04
Updated: 2026-08-05
Depends-On: `.10x/specs/multilingual-user-interface.md`; `.10x/tickets/2026-08-04-i18n-interaction-accessibility-nl-en.md` must be `done`

# i18n-diagnostics en locale-formattering (Nederlands/Engels)

## Doel

Voer uitsluitend fase 3 van de geratificeerde meertaligheidsspecificatie uit:
stabiele diagnostic-/validation-codes aan de pure grens, locale-presentatie aan
de UI-grens en locale-bewuste datum-, nummer- en pluralisatieformattering.

## Scope

- Definieer stabiele pure codes met getypeerde parameters waar een pure fout aan
  een gebruiker wordt getoond; de UI catalogus kiest de uiteindelijke taal.
- Vervang Engelse gebruikersgerichte diagnostics en validation-presentatie via
  de bestaande catalogusgrens.
- Gebruik uitsluitend ingebouwde `Intl` of getypeerde messagefuncties voor
  locale-afhankelijke formattering/pluralisatie.
- Test per code en formattering Nederlandse/Engelse presentatie, Engelse fallback
  en ongewijzigde pure domeinsemantiek/persistentie.

## Niet doen

- Geen locale-setting, externe dependency, remote service, telemetry of
  automatische vertaling.
- Geen vertaling/mutatie van IDs, paden, frontmatter, templates of
  user-authored gegevens.
- Geen Obsidian- of i18n-import in pure domein-/graph-/parsinglagen.
- Geen commit, push, tag, release of live-vaultmutatie.

## Uitvoering en gate

- Eerst verticale TDD met assertion-grade RED/GREEN voor code→UI-presentatie en
  formattering; contractwijzigingen in pure lagen krijgen aparte regressies.
- Onafhankelijke read-only review vóór één actuele Node-24 full gate:
  `npm run test`, `npm run build`, `git diff --check`.
- Sluit alleen na PASS-review en actuele groene gate.

## Acceptatiecriteria

- [ ] Pure lagen leveren stabiele codes/parameters zonder i18n- of
      Obsidian-import; de UI presenteert deze in Nederlands/Engels met fallback.
- [ ] Diagnostic-, validation-, datum-, nummer- en pluralisatiepresentatie is
      locale-correct zonder opslag- of identiteitseffect.
- [ ] Gerichte node/controlled-browsertests, review en actuele Node-24-gate zijn
      groen; live Desktop/Mobile blijft afzonderlijk gevalideerd.

## Blokkers

None.

## Journal

- 2026-08-04: Als afzonderlijke vervolgscope voorbereid conform fase 1; geen
  productcode, test, build, plugindata, vaultinhoud, staging, commit, push, tag
  of release gewijzigd.
- 2026-08-05: Fase 2 en de verplichte modulaire-catalogusrefactor zijn formeel
  `done`, onafhankelijk gereviewd, gegated, gecommit en gepusht. De gebruiker
  autoriseerde nu expliciet de lokale fase-3-uitvoering, review/gate, commit en
  push. De uitvoering start met een read-only inventaris van bereikbare
  diagnostics, validation-presentatie en datum/getal/plural-formattering.
- 2026-08-05: Inventaris bevestigde dat frontmatterdiagnostics al code+params
  gebruiken; resterende fase-3-schuld betreft met name form-/mutationfouten en
  directe pluginnotices. Verticaal gemigreerd en getest: profiel-lijstvalidatie,
  geboortedatum-, gekoppelde-persoon- en relatie-endpointvalidatie, plus de
  unavailable-person-notice. Pure lagen geven hierbij stabiele codes/parameters
  door; EN/NL-catalogi projecteren uitsluitend aan de UI-grens.
- 2026-08-05: HERIJKING (gebruiker-geratificeerd). De gebruiker maakte bezwaar
  tegen de omvang en doorlooptijd van de brede typed-foutcontractmigratie en
  koos: behoud uitsluitend directe zichtbare presentatietekst/locale-formattering
  (datum/getal/meervoud) en minimale translator-doorvoer; verwijder de typed
  error-unions, mutation-resultcontracten, format*Issue/*Failure-facades en
  regex/focuscontractwijzigingen selectief. De werkboom is daarmee teruggebracht
  naar de fase-2-basis (c1e68bf) plus de fase-3-presentatie/formatteerhunks.
  Contractroots en -tests zijn teruggezet; render/formatteer-KEEP en directe
  notice-keys blijven. Statische UI-inventaris leverde aanvullend geen noodzaak
  voor verdere errorcontracten op. Verificatie beperkt tot typecheck, gerichte
  UI-smoketests en één volledige gate.
- 2026-08-06: Onafhankelijke read-only review → verdict `concerns`: core-keep
  correct en bewezen (geen rest-contractmachinerie, byte-veilige ruwe waarden,
  structurele EN/NL-pariteit); significante bevinding = ~20 niet-gewirede
  cataloguskeys (dode keys) + niet-omgezette Engelse notices/validatie in
  `main.ts`/person-modal. Opgelost: alle bevestigd-dode keys (0 referenties)
  zijn uit `en.ts`/`nl.ts` verwijderd zodat elke cataloguskey gelezen wordt; de
  Engelse oppervlakken blijven identiek aan base (geen contract heringevoerd).
  Typecheck + i18n-parity-test en volledige testsuite zijn groen.
  BLOKKER: `release:contract`-bundelmaat — main.js 417.348 bytes > limiet
  409.600. Base c1e68bf zelf is al 411.418 (ook > limiet); 0.10.0 is daaronder
  toch gereleased, dus de maatcheck was kennelijk geen harde releasegate, maar
  `npm run check` is rood. Beslissing nodig (limiet verhogen / lokalisatie
  inkrimpen / acceptatie). Commit/push/tag/release in afwachting daarvan niet
  uitgevoerd.
- 2026-08-06: BESLISSING (gebruiker). Bundel-limiet verhoogd van 409.600 naar
  500.000 bytes in `scripts/release-contract.mjs` (`BUNDLE_LIMIT_BYTES`) als
  bewuste contractaanpassing. Gecontroleerd: main.js = 417.348 bytes (binnen
  de nieuwe limiet); `release-contract.test.ts` 19/19 groen (test leest de
  limiet uit de export, geen hardcoded waarde). Blokker hiermee opgeheven.
