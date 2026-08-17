Status: complete
Created: 2026-08-16
Updated: 2026-08-17
Parent: `.10x/tickets/2026-08-16-people-atlas-kiss-ux.md`
Depends-On: `.10x/tickets/2026-08-16-people-atlas-kiss-ux-phase-2-graph-relations.md`

# Fase 3 — persoonsdetailpaneel

## Scope

Maak één gedeelde kerncompositie voor persoonsdetails in standalone,
renderer-details, graph-sheet en Bases. Prioriteer naam, functie/context,
organisatie, relevante relaties, laatste expliciete contactdatum en opvolging.
Maak `Contact vastleggen` primair en beheeracties secundair zonder bestaande
functionaliteit te verwijderen.

De laatste contactdatum wordt afgeleid uit beschikbare expliciete
contactmomenten binnen de huidige snapshotcontext. Er komt geen nieuw
person-level opslagveld.

## Non-goals

- Geen wijziging van contactmomentopslag of follow-upstatussemantiek.
- Geen automatische last-contact-, relationship- of statusinferentie.
- Geen verwijderen van edit-, open-note-, center- of relationship-create-
  acties.
- Geen technische identity/pathvelden in de primaire profielkaart.

## Acceptance Criteria

- [x] Standalone, renderer en Bases tonen dezelfde kerninformatie en
      actiehiërarchie.
- [x] De kernvolgorde is naam, functie/context, organisatie, relaties, laatste
      expliciete contactdatum en opvolging.
- [x] Alleen aanwezige waarden worden getoond.
- [x] `Contact vastleggen` is de primaire actie.
- [x] Beheeracties zijn secundair maar keyboard- en pointerbereikbaar.
- [x] Relationship groups zijn direct zichtbaar in standalone-details.
- [x] De nieuwste expliciete contactmomentdatum wordt correct en scoped
      getoond zonder statusinferentie.
- [x] Open follow-ups zijn zichtbaar zonder de volledige contactgeschiedenis
      te moeten openen.
- [x] Person-profile, contact-history, follow-up, Bases-parity en browserfocus
      regressions zijn getest.

## References

- `.10x/decisions/people-atlas-kiss-ux-direction.md`
- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/relationship-context-actions.md`
- `src/view/people-atlas-view.ts`
- `src/render/person-details-panel.ts`
- `src/render/relationship-details-panel.ts`
- `src/render/follow-up-panel.ts`
- `src/bases/people-atlas-bases-view.ts`
- `test/person-profile-presentation.test.ts`
- `test/contact-moment-presentation.test.ts`
- `test/browser/atlas-renderer.browser.test.ts`

## Assumptions

- User-ratified: één gedeelde detailcompositie is leidend.
- Agent-selected smallest safe solution: `last_contact` blijft een afgeleide
  presentatie van expliciete contactmomenten, niet een nieuw veld.
- Record-backed: contact moments never infer relationship status.

## Journal

- 2026-08-16: Ticket geopend; standalone detaildrift en actiehiërarchie zijn
  source-backed findings.
- 2026-08-17: `PersonDetailsPanel` uitgebreid tot de gedeelde compositie voor
  standalone, renderer-details, graph-sheet en Bases. De bestaande standalone
  relatiegroepen zijn daarop aangesloten; `Contact vastleggen` staat vooraan
  en krijgt de accentstijl.
- 2026-08-17: Laatste expliciete contactdatum afgeleid met een pure helper uit
  de huidige `AtlasSnapshot`; lege contactgeschiedenis wordt niet als lege
  permanente sectie weergegeven. De aparte Bases-actiebalk is verwijderd om
  dubbele acties te voorkomen.
- 2026-08-17: Eerste browsercontrole vond een ongeldige `dataset`-property voor
  het gereserveerde attribuut `sheet-action`; dit is hersteld met expliciete
  `setAttribute` en afgedekt door de sheet-focusregressietest.
- 2026-08-17: Semantic detailacties kregen op kleine schermen dezelfde
  44-pixel minimum-touchtarget als de overige primaire bediening; de sheet-
  override staat na de algemene selector zodat de gerichte lintcontrole schoon
  blijft.

## Blockers

Geen blockers. De inhoudelijke Fase 3-verificatie en de volledige
repository-gate zijn groen. De zichtbare `fake-vitest.mjs`-melding is de
opzettelijke negatieve spawn-case in `test/integration-runner.test.ts`.

## Evidence

- `src/render/person-details-panel.ts` is de gedeelde semantische compositie.
  De profielkaart, relatiegroepen, laatste contactdatum, contactgeschiedenis,
  opvolging en actiehiërarchie worden daar in dezelfde volgorde opgebouwd.
- `src/render/atlas-renderer.ts` gebruikt dezelfde compositie voor de lijst-
  details en het graph-details-sheet; sheet- en sidebar-acties blijven via
  de bestaande eventdelegatie en capability checks werken.
- `src/view/people-atlas-view.ts` gebruikt dezelfde compositie voor de
  standalone-zijbalk en sluit de bestaande relationship-action registry en
  focusherstel daarop aan.
- `src/bases/people-atlas-bases-view.ts` heeft de aparte overlay met
  bewerk-/relatie-/contactknoppen verwijderd; Bases gebruikt nu de gedeelde
  rendereracties en heeft daardoor geen dubbele actiebron.
- `src/render/contact-moment-presentation.ts` bevat
  `getLatestSelectedPersonContactMoment`; de helper filtert op persoon en
  valideert/sorteert expliciete contactmomenten zonder statusinferentie.
- `test/contact-moment-presentation.test.ts` dekt nieuwste contactdatum,
  persoonsscope en ongeldige datums. `test/browser/atlas-renderer.browser.test.ts`
  dekt actievolgorde, primary stylingsemantiek, laatste contactdatum,
  relatiegroepen, sheet-focus en contact-/follow-upgedrag.
- `npm run typecheck`: geslaagd.
- `npm run build`: geslaagd.
- `npm run test:browser`: 12 bestanden, 175 tests geslaagd.
- Gerichte renderer-browsercontrole: 44/44 geslaagd.
- `npm run test:integration`: 39 integratietests geslaagd.
- `npm run test:browser-matrix`: DPR 1, 1.5 en 2 geslaagd (2 tests per
  matrixproject).
- `git diff --check`: geslaagd. Gerichte Biome-lintcontrole op gewijzigde
  bron- en testbestanden: geslaagd.
- `npm run test`: exit 0; node 58 testbestanden/1062 tests, browser 12/176,
  integration 9 bestanden/39 tests en Chromium DPR 1/1.5/2 elk 2/2 groen.
- `npm run format:check` blijft rood op bestaande newline-/formatverschillen
  in onaangeraakte repositorybestanden; de gewijzigde bestanden zijn gericht
  geformatteerd.

## Review

Adversarial self-review: pass voor deze scope. De shared panel gebruikt de
bestaande capability checks, stable node/edge IDs en lifecycle cleanup; er is
geen nieuw opslagveld of identity-heuristiek toegevoegd. De resterende risico's
zijn (1) de laatste contactdatum is bewust beperkt tot expliciete
contactmomenten die in de huidige snapshot aanwezig zijn. De volledige
repository-gate is groen; de zichtbare `fake-vitest.mjs`-regel is alleen de
verwachte negatieve spawn-case.

Reviewpunten zijn gecontroleerd met de volledige browser-suite, de DPR-matrix,
de integratiesuite, de volledige node-suite, typecheck, build en gerichte
lint/diff-controles.

## Retrospective

De kleinste veilige seam was een uitbreiding van de bestaande
`PersonDetailsPanel`, niet een tweede detail-API per surface. Het sheet had
eerst een eigen actie-/profielcompositie; die duplicatie maakte actievolgorde
en focusgedrag kwetsbaar. De browserregressie rond `data-sheet-action` liet
zien dat `dataset` niet geschikt is voor attribuutnamen met een koppelteken;
expliciete DOM-attributen plus focus-tests voorkomen herhaling. De eindgate
bevestigde bovendien dat release-contractfixtures newline- en Windows
Bash/WSL-onafhankelijk moeten zijn; die testharnessgrens is in Fase 4
afgehandeld. De persoonsdetailsemantiek blijft per surface gedeeld.
