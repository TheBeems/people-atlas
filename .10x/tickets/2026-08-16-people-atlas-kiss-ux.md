Status: complete
Created: 2026-08-16
Updated: 2026-08-17
Owner: People Atlas UX simplification workstream — parent coordination

# People Atlas KISS UX — parent ticket

## Record type and intent

Dit is een parent/meta-ticket voor de geratificeerde UX-vereenvoudiging. Het
is geen uitvoerbaar ticket. Het coördineert vier bounded child tickets en
behoudt de bestaande Markdown-, identity-, snapshot-, renderer- en mutation-
grenzen.

## Scope

Coördineer:

1. `.10x/tickets/2026-08-16-people-atlas-kiss-ux-phase-1-navigation-search.md`
2. `.10x/tickets/2026-08-16-people-atlas-kiss-ux-phase-2-graph-relations.md`
3. `.10x/tickets/2026-08-16-people-atlas-kiss-ux-phase-3-person-details.md`
4. `.10x/tickets/2026-08-16-people-atlas-kiss-ux-phase-4-polish-regression.md`

De uitvoeringsvolgorde is fase 1, daarna fase 2, daarna fase 3 en tenslotte
fase 4. Pure testvoorbereiding mag parallel lopen wanneer de contracten uit de
governing spec niet wijzigen.

## Non-goals

- Geen externe contact-, agenda-, task- of notificatie-integratie.
- Geen force-directed graph, graph-edge-selection of complexe legenda.
- Geen wijziging van stabiele person-, relationship- of contactmomentidentity.
- Geen automatische relatie-, status- of follow-up-inferentie.
- Geen nieuw design system of rendererframework.
- Geen verborgen vault-writes, bulk-migratie, commit, push of release.
- Geen interne architecture-refactor buiten wat een child nodig heeft om de
  bestaande UX-contracten te realiseren.

## Acceptance Criteria

- [x] Alle vier child tickets blijven naar deze parent en de KISS-spec
      verwijzen.
- [x] Elk child ticket heeft een bounded scope, non-goals, acceptance
      criteria, references, assumptions, journal, blockers, evidence, review
      en retrospective.
- [x] Centerresolutie blijft stabiel-ID-gebaseerd en ambiguity-safe.
- [x] Standalone en Bases blijven dezelfde snapshot- en relationshipsemantiek
      gebruiken.
- [x] Iedere productwijziging heeft passende pure/browser/integratietests.
- [x] Iedere child wordt afzonderlijk reviewed voordat de parent sluit.
- [x] De volledige gate wordt na fase 4 uitgevoerd: `npm run test`,
      `npm run build` en `git diff --check`.
- [x] Residual risk en live Obsidian/Desktop/Mobile-beperkingen zijn expliciet
      vastgelegd.

## References

- `.10x/decisions/people-atlas-kiss-ux-direction.md`
- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/tickets/2026-08-09-architecture-decomposition.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified on 2026-08-16: de voorgestelde KISS-richting is akkoord en
  resterende implementatiedetails mogen volgens de kleinste veilige oplossing
  worden gekozen.
- Record-backed: graph-transformatie, identity, contactmomenten, focus en
  lifecycle hebben al actieve contractspecificaties.
- User-ratified via de bovenstaande akkoordverklaring: `Directe relaties`
  betekent één hop; de primaire counts verdwijnen; één detailcompositie wordt
  leidend; UX-werk krijgt een eigen scope naast de behavior-preserving
  architecture-refactor.

## Journal

- 2026-08-16: Read-only source review identified duplicated controls,
  technical vocabulary, missing person search, standalone/shared detail drift,
  unlabeled graph edges and conceptually unclear global counts.
- 2026-08-16: User approved the prior plan and delegated remaining choices to
  the agent. Decision, spec and four bounded child tickets were created before
  implementation, per the 10x execution boundary.
- 2026-08-17: Alle vier fasen uitgevoerd en afzonderlijk gereviewd. De UX-
  implementatie bleef binnen bestaande snapshot-, identity-, renderer- en
  Markdowngrenzen; de release-contracttestfixture kreeg alleen de minimale
  platformnormalisatie die nodig was om de volledige gate op Windows groen te
  maken.

## Blockers

Geen blockers. Er zijn geen nieuwe storage-semantics, identity-inferentie of
publieke contracten toegevoegd.

## Evidence

- Source-backed findings are recorded in the preceding research response and
  linked to the owning source files in the KISS spec.
- `npm run test` exit 0: node 58 files/1062 tests, browser 12/176,
  integration 9 files/39 tests and DPR 1/1.5/2 each 2/2 passed.
- `npm run build`, `npm run typecheck`, targeted Biome lint and `git diff --check`
  passed. `npm run format:check` remains red only on pre-existing newline-/
  formatbaseline in untouched repository files.

## Review

Independent adversarial self-review completed on 2026-08-17 for all four
children. Residual risk is limited to unexecuted native Obsidian
Mobile/Electron/assistive-technology validation; the browser matrix covers
the validated Chromium DPR scope.

## Retrospective

De vier bounded fasen bleken voldoende om de KISS-doelen te bereiken zonder
een nieuwe design-systemlaag of datastructuurrefactor. De belangrijkste
operationele les is dat cross-platform release-contractfixtures hun workflow-
tekst en Bash-uitvoering niet aan de lokale newline- of WSL-envsemantiek mogen
ontlenen.
