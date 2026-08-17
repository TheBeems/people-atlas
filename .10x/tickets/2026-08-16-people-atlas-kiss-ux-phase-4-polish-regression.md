Status: complete
Created: 2026-08-16
Updated: 2026-08-17
Parent: `.10x/tickets/2026-08-16-people-atlas-kiss-ux.md`
Depends-On: `.10x/tickets/2026-08-16-people-atlas-kiss-ux-phase-3-person-details.md`

# Fase 4 — integrale UX-polish en regressiecontrole

## Scope

Voer de integrale visuele, toegankelijkheids- en regressiecontrole uit nadat
de drie UX-fases afzonderlijk zijn afgerond. Controleer Obsidian-native CSS,
responsive gedrag, touch targets, reduced motion, i18n, focus/lifecycle,
standalone/Bases-parity en stale-actionveiligheid.

## Non-goals

- Geen nieuwe productfunctionaliteit.
- Geen nieuw design system of algemene stylinglaag.
- Geen claims over live Mobile, Electron pop-out of assistive technology die
  niet werkelijk zijn gevalideerd.
- Geen verzwakken of verwijderen van beschermende tests.

## Acceptance Criteria

- [x] De vereenvoudigde UI gebruikt Obsidian CSS-variabelen en blijft coherent
      bij smalle vensters, touch en reduced motion.
- [x] Nederlandse en Engelse primary labels, aria-labels en empty states zijn
      consistent.
- [x] Keyboard, focusherstel, Escape, Enter, list navigation en search blijven
      werken over modewissels en dialogs.
- [x] Standalone en Bases hebben geen relevante UX-semantieksdrift.
- [x] Ghost, ambiguous, filtered, parallel, stale en ontbrekende-dataflows
      zijn gecontroleerd.
- [x] `npm run test` slaagt.
- [x] `npm run build` slaagt.
- [x] `git diff --check` slaagt.
- [x] Browsermatrix en resterende manual-validation-limieten zijn eerlijk in
      evidence en review vastgelegd.

## References

- `.10x/decisions/people-atlas-kiss-ux-direction.md`
- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/specs/high-dpi-popup-browser-matrix.md`
- `styles.css`
- `test/browser/atlas-renderer.browser.test.ts`
- `test/browser-matrix/atlas-renderer.browser-matrix.test.ts`
- `test/integration/i18n-primary-ui.integration.test.ts`

## Assumptions

- User-ratified: de drie voorafgaande fasen zijn de volledige productscope
  voor deze UX-slice.
- Record-backed: de repositorykwaliteitspoort vereist test en build vóór
  completion.

## Journal

- 2026-08-16: Ticket geopend als finale integratie- en regressiegrens.
- 2026-08-17: Audit van de drie voorafgaande fasen bevestigde dat de
  bestaande reduced-motion-, lifecycle-, focus- en stale-actionrails intact
  waren. De concrete resterende UI-ruis zat in permanente zoom-in/zoom-out-
  knoppen en een niet-wrappende standalone-toolbar.
- 2026-08-17: Zoom-in/zoom-out naar een native `<details>`-disclosure verplaatst;
  `Passend maken` en `Details` blijven direct bereikbaar. De standalone-toolbar
  wrapt op smalle vensters; er is geen state- of vaultgedrag gewijzigd.
- 2026-08-17: Nederlandse zoeklabels/empty state, de zoomlabel en touchtarget-
  regressies toegevoegd aan de browser-/i18n-tests.
- 2026-08-17: De resterende release-contractgate hersteld voor deze Windows-
  checkout: workflowtekst wordt newline-onafhankelijk gelezen, de publish-
  branch wordt via Bash stdin uitgevoerd en tijdelijke WSL-fixtures ruimen op
  met retry. De release-contractsuite is 30/30 groen.

## Blockers

Geen blockers. De inhoudelijke Fase 4-controles en de volledige repository-gate
zijn groen. `npm run format:check` blijft een afzonderlijke baselinekwestie in
onaangeraakte repositorybestanden en is geen blocker voor de AGENTS-kwaliteitspoort
(`npm run test`, `npm run build`).

## Evidence

- `src/render/graph-canvas-surface.ts` gebruikt een native zoom-disclosure;
  de bestaande zoomknoppen, eventdelegatie en layoutcallbacks blijven intact.
- `styles.css` gebruikt bestaande Obsidian CSS-variabelen, geeft de disclosure
  een zichtbare focusstaat, maakt zoombediening op coarse pointers 44 pixels
  groot en laat de standalone-toolbar op smalle vensters wrappen.
- `src/i18n/en.ts` en `src/i18n/nl.ts` houden primaire labels, zoomlabel,
  zoeklabel, placeholder en empty state in hetzelfde cataloguscontract.
- `test/browser/atlas-renderer.browser.test.ts` dekt de native zoomdisclosure,
  NL/EN primary labels, NL search empty state, 44-pixel touch targets, focus,
  Escape/Enter/list navigation, ghost/ambiguous/parallel/stale flows en
  sheet-/contactmomentgedrag.
- `npm run test:browser`: 12 bestanden, 176 tests geslaagd.
- `npm run test:browser-matrix`: DPR 1, 1.5 en 2 geslaagd (2 tests per
  matrixproject).
- `npm run test:integration`: 39 integratietests geslaagd.
- Gerichte nodecontrole voor i18n/contact/relationship/search: 11 tests
  geslaagd.
- `npm run typecheck` en `npm run build`: geslaagd.
- Gerichte Biome-lintcontrole op gewijzigde bron- en testbestanden:
  geslaagd. `git diff --check`: geslaagd.
- `npm run test`: exit 0; node 58 testbestanden/1062 tests, browser 12
  testbestanden/176 tests, 9 integrationbestanden/39 tests en Chromium DPR
  1/1.5/2 elk 2/2 tests groen. De zichtbare `fake-vitest.mjs`-melding is de
  opzettelijke negatieve spawn-errorcase in `test/integration-runner.test.ts`;
  de parent test rapporteert die als geslaagde failure-handling.
- De volledige `npm run format:check` blijft rood door bestaande
  newline-/formatverschillen in onaangeraakte repositorybestanden; de
  gewijzigde bestanden zijn gericht geformatteerd.

## Review

Adversarial self-review: pass voor de Fase 4-scope en de resterende testharness-
reparatie. De zoomdisclosure is een
native browsercontrol en introduceert geen tweede zoomstate. De bestaande
knoppen blijven in de DOM, behouden hun handlers en blijven via pointer,
keyboard en touch bereikbaar zodra de disclosure geopend is. Er zijn geen
vaultwrites, identitywijzigingen, nieuwe productvelden of beschermende tests
verwijderd.

Residual risk: er is geen echte Obsidian Mobile-, Electron-pop-out- of
assistive-technologyvalidatie uitgevoerd. Dat valt expliciet buiten deze
ticketacceptatie; de browsermatrix bewijst alleen de geteste Chromium-DPR-
varianten.

## Retrospective

De native `<details>`-control was de kleinste veilige oplossing voor
progressive disclosure: geen custom popup, geen extra state en geen nieuwe
design-systemlaag. De eerste verbetering kwam uit het vergelijken van de
zichtbare controls met de KISS-beslissing; testdekking alleen zou de permanente
zoomruis niet hebben aangewezen. De volledige gate liet daarnaast zien dat
release-contracttests platformneutraal moeten omgaan met CRLF en Windows
Bash/WSL. Newline-normalisatie, stdin-uitvoering en cleanup-retry losten dat
op zonder production- of workflowlogica te wijzigen.
