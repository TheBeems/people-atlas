Status: done
Created: 2026-08-01
Updated: 2026-08-01

# PPA1 — Partner als Simple relationship

Parent: `.10x/tickets/2026-08-01-partner-parent-confirmation-plan.md`
Depends-On: None

## Scope

Breid uitsluitend de bestaande Simple relationship-flow uit met de expliciete
Partner-keuze. De keuze moet in de gedeelde create- en edit-relatieformulieren
exact `partner`/`partner` invullen, uitsluitend uit die rollen worden afgeleid
en bestaande custom, type- en templatesemantiek ongemoeid laten.

Dit ticket levert de canonieke opgeslagen partnersemantiek waarop PPA2 later
veilig kan matchen. Het opent zelf geen partner-oudermodal en bepaalt geen
kandidaten.

## Non-goals

- Een partner-oudervoorstel, modal, graph- of indexverandering.
- Wijziging van relationship types, template-ID/provenance, settings of
  frontmattereigenschappen.
- Genderafgeleide partnertermen, wife/husband-normalisatie of lokalisatie.
- Interpretatie of herschrijving van bestaande vrije rolparen.
- Migratie, bulkupdate, commit, push, release of live-hostcertificering.

## Acceptance criteria

- [x] Het native Simple relationship-select bevat `Partner of the second
      person` naast Custom, Parent, Child en Sibling, met een gekoppeld label
      en bestaande beschrijving/focus/lifecycle-eigenschappen.
- [x] Partner vult alleen de onopgeslagen rollen exact als
      `partner`/`partner`; mensen, types, template-ID, pad, ID, status,
      closeness, datums, scroll, focus en Advanced-status blijven gelijk.
- [x] De actuele keuze is Partner uitsluitend bij het getrimde exacte paar
      `partner`/`partner`; casevarianten, vertalingen, incomplete of andere
      custom paren blijven Custom zonder herschrijving.
- [x] Handmatige roledits en template-apply/reapply verversen de keuze in
      place en behouden de bestaande formstate.
- [x] De bestaande renderer presenteert het canonieke Partner-rolwoord
      letterlijk en verandert geen gender- of family-termcontract.
- [x] Bestaande Parent/Child/Sibling/Custom-mapping, templategedrag,
      role-pairvalidatie, standalone/Bases-pariteit en mutationveiligheid
      blijven groen.
- [x] README.md en README.nl.md beschrijven Partner als expliciete,
      neutrale rolsnelkeuze zonder type- of automatische oudersemantiek.
- [x] Gerichte pure-, form- en browserregressies zijn RED vóór productcode en
      bewijzen de mapping, unchanged fields, custom fallback, templates,
      owning-document, focus en narrow reflow.
- [x] `npm run test`, `npm run build` en `git diff --check` slagen.

## References

- `.10x/specs/partner-parent-confirmation.md`
- `.10x/decisions/partner-parent-confirmation.md`
- `.10x/specs/simple-relationship-automation.md`
- `.10x/tickets/2026-07-31-simple-relationship-automation.md`
- `src/domain/simple-relationships.ts`
- `src/editor/relationship-form.ts`
- `src/editor/relationship-modal.ts`
- `src/render/relationship-rows.ts`
- `test/simple-relationships.test.ts`
- `test/relationship-form.test.ts`
- `test/browser/relationship-modal.browser.test.ts`
- `test/relationship-rows.test.ts`
- `README.md`
- `README.nl.md`
- `AGENTS.md`

## Assumptions

- User-ratified: de expliciete Partner-snelkeuze bewaart uitsluitend
  `partner`/`partner`; geen extra ouderassociatie of nieuw relatieveld.
- Record-backed: de huidige Simple relationship-keuze bezit alleen twee
  rolvelden en de pure helper plus formuliermodal zijn de bestaande seams.
- Record-backed: bestaande relationship writes eisen beide rollen of geen en
  slaan geen selectorprovenance op.

## Blockers

None. PPA1 is op 2026-08-01 na onafhankelijke review gesloten. Commit, push en
release blijven buiten de gebruikersautorisatie.

## Journal

- 2026-08-01: Ticket geopend in shaping als eerste begrensde child van de
  partner-ouderbevestigingsketen. Broninspectie bevestigde dat de huidige
  Simple relationship-helper en modal alleen Parent, Child en Sibling kennen,
  en dat de selector al uitsluitend de in-memory rollen verandert.
- 2026-08-01: Geen productcode, test, build, vaultdata, commit, push of
  externe status gewijzigd. PPA2 blijft geblokkeerd totdat dit ticket inclusief
  onafhankelijke review gesloten is.
- 2026-08-01 (autorisatie en baseline): de gebruiker autoriseerde “implementeer
  alles”; PPA1 is actief gemaakt. Onder `/home/nms/.local/node24/bin` bevestigt
  de baseline Node v24.18.1 en npm 11.16.0. `npm run check` slaagde met 47/669
  Node-, 8/75 browser-, 6/14 integration- en 3/6 browser-matrix-tests, gevolgd
  door production build, release contract en community check. De worktree had
  uitsluitend de vooraf bestaande `.10x/` shaping-records; geen productdiff.
- 2026-08-01 (PPA1-executie, TDD-cyclus 1): vóór productcode zijn gerichte
  pure- en formulierasserties toegevoegd voor de getrimde exacte
  `partner`/`partner`-mapping, Custom-fallbacks en behoud van alle overige
  formulierwaarden. RED:
  `export PATH=/home/nms/.local/node24/bin:$PATH && npm exec vitest -- run --project node test/simple-relationships.test.ts test/relationship-form.test.ts`
  gaf exit 1: 2 bestanden faalden, 3/58 tests rood en 55 groen. De verwachte
  oorzaken waren `partner` → `custom`, geen partnerrolpaar en ongewijzigde
  `mentor`/`mentee`-rollen. Daarna is uitsluitend de domein-keuze/map uitgebreid
  met exact `partner`/`partner`; dezelfde opdracht was GREEN met 2/2 bestanden
  en 58/58 tests groen.
- 2026-08-01 (PPA1-executie, TDD-cyclus 2): vóór de modalwijziging zijn de
  browserassertie voor de native Partner-optie en de rendererregressie
  toegevoegd. RED:
  `export PATH=/home/nms/.local/node24/bin:$PATH && npm exec vitest -- run --project browser test/browser/relationship-modal.browser.test.ts`
  gaf exit 1: 1/14 browsertests rood omdat de optie `partner` / `Partner of the
  second person` ontbrak; de overige 13 bleven groen. De afzonderlijke
  renderercheck draaide vóór de modalwijziging groen (1 bestand, 8/8 tests): de
  bestaande neutrale fallback presenteerde `partner` al letterlijk. Daarna zijn
  uitsluitend de native modaloptie en haar waardevalidatie uitgebreid. Dezelfde
  browseropdracht was GREEN met 1/1 bestand en 14/14 tests groen.
- 2026-08-01 (scope): PPA1 wijzigde uitsluitend de Simple relationship-map en
  -select, gerichte tests en beide README's. Er is geen planner, post-save hook,
  bevestigingsmodal, graph/index/settings/migratie, endpoint/type/template-
  provenance of writepad voor PPA2 toegevoegd.
- 2026-08-01 (gerichte regressies):
  `npm exec vitest -- run --project node test/simple-relationships.test.ts test/relationship-form.test.ts test/relationship-rows.test.ts`
  was groen met 3/3 bestanden en 66/66 tests;
  `npm exec vitest -- run --project browser test/browser/relationship-modal.browser.test.ts`
  was groen met 1/1 bestand en 14/14 tests. De browserfile dekt de gekoppelde
  native select/beschrijving, selectie zonder write, focus, gelijkblijvende
  Advanced-/scroll-/template-/veldstate, owning-document en narrow reflow;
  de bestaande template apply/reapply-regressie bleef in die file groen.
- 2026-08-01 (volledige gates): `npm run test` was exit 0 met 47/675 Node-,
  8/75 browser-, 6/14 integration- en 3/6 browser-matrix-tests. `npm run build`
  was exit 0 (`tsc --noEmit` gevolgd door production build). `git diff --check`
  was exit 0 zonder whitespace-output. Dit is lokale geautomatiseerde evidence;
  er is geen live Obsidian Desktop/Mobile-claim.
- 2026-08-01 (onafhankelijke review): een afzonderlijke read-only reviewer
  beoordeelde uitsluitend de PPA1-diff na Node v24.18.1/npm 11.16.0-runtime-
  verificatie. Verdict: `passed: true`, zonder security concerns, logic errors,
  suggestions of findings. De added-line-scan van 81 regels vond 0 secrets,
  shell-injection, eval/exec, onveilige deserialisatie of SQL-interpolatie. De
  reviewer bevestigde scope, exacte selectorvalidatie, letterlijke rendering,
  toegankelijkheidsdekking en documentatie; brede gates en live-hostvalidatie
  zijn bewust niet dubbel uitgevoerd.

## Evidence

- **AC native keuze, stategrens en toegankelijkheid:** de browserregressie
  verifieert de exacte vijf optieteksten, gekoppelde beschrijving, selectie van
  Partner, focusbehoud, stabiele form node/scroll/Advanced/template en geen
  create/update-call vóór Save; GREEN 14/14. Begrenzing: gemodelleerde
  browser-host, geen live host.
- **AC exacte opslagsemantiek en Custom-fallback:** pure- en formtests
  verifiëren getrimd exact `partner`/`partner`, `partner`/`partner`, case- en
  incompleet-custom-fallbacks plus een volledige objectvergelijking van alle
  niet-rolvelden; GREEN 58/58 in de eerste cyclus en 66/66 in de laatste
  node-selectie.
- **AC renderer en bestaande contracten:** de rijrenderer test presenteert
  beide perspectieven letterlijk als `partner`; de volledige suite bewaart
  Parent/Child/Sibling/Custom-, template-, mutation-, standalone/Bases- en
  integrationregressies groen. Begrenzing: dit bewijst de geautomatiseerde
  contracten, niet een handmatige live-vaultsessie.
- **AC documentatie:** `README.md` en `README.nl.md` noemen Partner als
  expliciete neutrale `partner`/`partner`-snelkeuze, geen relatietype en zonder
  automatische oudersemantiek; zij beschrijven ook de letterlijke presentatie.
- **AC gates:** `npm run test`, `npm run build` en `git diff --check` zijn
  hierboven met exacte lokale resultaten vastgelegd.

## Review

Status: passed.

Een afzonderlijke read-only red-teamreview kreeg alleen de PPA1-diff, de
contractgrenzen en de statische scan. Het JSON-verdict was `passed: true` met
lege security-, logic-, suggestion- en finding-lijsten. De review bevestigde
dat de 81 toegevoegde regels binnen de Simple relationship-scope blijven,
exact `partner`/`partner` behandelen zonder extra writes of statewijzigingen,
de letterlijke partnerpresentatie en toegankelijkheid behouden en de README's
correct begrenzen. Restrisico: alleen de reeds vastgelegde grens van lokale
geautomatiseerde evidence versus geen live Obsidian-hostsessie. Op basis van
deze review is PPA1 gesloten; PPA2 mag zijn dependency gebruiken.

## Retrospective

- De bestaande pure rolkeuze was de kleinste veilige seam: één nieuwe canonieke
  mapregel plus één derive-regel liet de gedeelde create/edit-formlogica alle
  overige waarden intact houden.
- De browser-RED maakte concreet dat een uitgebreid domeincontract niet genoeg
  is: de native optie én de runtimewaardevalidatie moesten beide expliciet mee.
- De bestaande renderer had al een veilige letterlijke fallback voor onbekende
  rollen; een gerichte regressie borgt die eigenschap zonder nieuwe
  genderafleiding te introduceren.
- Scopebewaking werkte: geen PPA2-planner of post-savegedrag is nodig om PPA1
  compleet te maken. Een review moet vooral de exacte selectorwaarden,
  state-ongewijzigdheid en die grens opnieuw toetsen.
