Status: open
Created: 2026-08-09
Updated: 2026-08-09
Parent: None
Owner: People Atlas verification workstream — browser/host coverage
Depends-On: `.10x/tickets/2026-08-08-native-relationship-person-picker.md`

# Relationship picker: browser- en host-coverage hardening

## Doel

Verklein de resterende low-severity coverage- en lifecycle-onzekerheid rond de
plugin-owned relationship-person picker zonder de bestaande identity-, form-,
mutation- of mobile-hostcontracten te verbreden.

Dit is een open backlogticket. Het is niet gestart en bevat geen claim dat de
huidige pickerimplementatie defect is.

## Scope

- echte browser keyboard-helperflows voor ArrowUp, ArrowDown, Enter en Escape;
- een echte listbox-flow met twee verschillende Markdown-paden met hetzelfde
  expliciete `person_id`, gevolgd door Save en een expliciete zero-write-assertie;
- waar de bestaande fixture dit contract ondersteunt: ordinary-note en stale
  selection via de picker-/formgrens met dezelfde zero-write-assertie;
- detached owning-document en modal close/unload cleanup in een gecontroleerde
  browserfixture.

## Niet doen

- Geen wijziging aan canonical identity, display-name-presentatie,
  relationship persistence of Save-boundary zonder een aparte gerichte TDD-
  reparatie.
- Geen claim van native Obsidian Mobile/WebView/IME-geometrie uit Chromium-
  tests.
- Geen commit, push, tag, release, externe write of vaultwrite.

## Acceptatiecriteria

- [ ] De echte browser keyboard-helperflow bewijst ArrowUp/ArrowDown/Enter/
      Escape naast de bestaande synthetische event-coverage.
- [ ] De listbox-flow met duplicate explicit IDs selecteert via de echte UI,
      weigert bij Save en roept de mutation mock nul keer aan.
- [ ] Ordinary-note/stale-selection-afwijzing is via de relevante UI-route
      bewezen wanneer de bestaande fixture zulke kandidaten kan modelleren;
      anders is een expliciete no-action rationale vastgelegd.
- [ ] Detached owner-document en modal close/unload cleanup hebben een
      assertion-grade gecontroleerde probe.
- [ ] Een nieuwe onafhankelijke review en de gerichte Node-24 checks zijn groen;
      live native Obsidian-validatie blijft afzonderlijk begrensd.

## References

- `.10x/tickets/2026-08-08-native-relationship-person-picker.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `src/editor/relationship-modal.ts`
- `src/editor/relationship-form.ts`
- `test/browser/relationship-modal.browser.test.ts`
- `test/browser/partner-parent-relationship-modal.browser.test.ts`
- `test/integration/partner-parent-confirmation.integration.test.ts`

## Assumptions

- Record-backed: the existing identity, relationship-editor and safe-mutation
  specs remain authoritative; this ticket does not change canonical identity,
  display labels, persistence or Save-boundary behavior.
- User-ratified scope: this is an open verification/coverage follow-up, not a
  claim that the current relationship picker is defective.
- Native Obsidian Desktop/Mobile/WebView/IME behavior is outside Chromium
  evidence and requires separate host validation.
- No implementation, source/test change, vault write or external publication is
  authorized by this open record.

## Journal

- 2026-08-09 opened from the independent post-repair review findings. The
  current implementation review is PASS with no critical/significant defect;
  this ticket owns only the explicitly identified coverage/host boundaries.
- 2026-08-09 record provenance: post-parent follow-up; this ticket is not an
  original child of the closed remediation parent and intentionally has
  `Parent: None`.

## Blockers

None confirmed. Execution is intentionally not started in this closure turn.

## Evidence

No execution evidence yet. The current picker closure evidence remains in
`.10x/evidence/2026-08-09-native-relationship-person-picker-closure.md`.

## Review

Not applicable until this open ticket is executed; no implementation change is
claimed here.

## Retrospective

Not applicable before execution.
