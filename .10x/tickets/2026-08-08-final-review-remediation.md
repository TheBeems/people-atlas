Status: done
Created: 2026-08-08
Updated: 2026-08-08
Parent: None
Owner: People Atlas implementation workstream

# Eindbeoordeling-remediatie — release, identiteit en lifecycle

## Type

Parent-plan; dit record is niet uitvoerbaar. De bounded child tickets zijn de
eenheden van implementatie, review en closure.

## User authorization

Op 2026-08-08 autoriseerde de gebruiker ticketing en noodzakelijke
contractcorrecties naar aanleiding van de onafhankelijke eindbeoordeling.
Geratificeerde uitgangspunten:

1. de vaste production-bundlelimiet mag verdwijnen;
2. My Person moet dezelfde zichtbare persoonsselectie gebruiken als
   relationship creation, maar ambigue/duplicate-ID-selecties mogen nooit vóór
   de settings-write-boundary worden opgeslagen;
3. de mobiele index moet structureel readiness-aware worden opgelost, niet alleen
   met een handmatige rebuild-workaround;
4. eerdere specs en contracten mogen worden aangepast wanneer de review aantoont
   dat een historische keuze niet langer de beste onderbouwde keuze is.

De decision record voor punt 1 en de bijgewerkte actieve specs zijn voorafgaand
aan deze tickets vastgelegd.

## Doel

Alle materiële findings uit de eindbeoordeling krijgen één duurzame eigenaar,
zonder brede refactor of nieuwe productscope. De implementatie blijft per
bounded context gescheiden.

## Child tickets en volgorde

### Paralleliseerbaar na record-review

- `.10x/tickets/2026-08-08-release-contract-simplification.md`
  - vaste bundlelimiet verwijderen;
  - contracttests en artifactchecks uitlijnen.
- `.10x/tickets/2026-08-08-release-channel-runtime-safety.md`
  - uitvoerbare alpha/beta/rc/stable-matrix;
  - duplicate-marker-fail-closed gedrag.
- `.10x/tickets/2026-08-08-my-person-selection-safety.md`
  - zichtbaarheid gelijk aan relationship creation;
  - pre-write canonical uniqueness-gate.
- `.10x/tickets/2026-08-08-mobile-index-readiness.md`
  - structurele readiness/rebuild-lifecycle;
  - controlled empty-to-populated regressietest.
- `.10x/tickets/2026-08-08-relationship-modal-contract-hardening.md`
  - missing-template-contract;
  - pending-close race;
  - disclosure-aware validation contract.

### Na de child tickets

- `.10x/tickets/2026-08-08-10x-release-record-coherence.md`
  - statuses, governing references, evidence, tagprovenance en releasecopy
    synchroniseren.

De i18n-diagnostics/locale-scope is afgerond in
`.10x/tickets/2026-08-04-i18n-diagnostics-formatting-nl-en.md`; dat done-ticket
blijft de enige historische owner/provenancebron en er wordt geen parallel
duplicaat-ticket aangemaakt. Native Desktop/Mobile-validatie is een expliciete
durable no-action-limiet, geen open productfinding.

## Integratiepunten

- My Person en mobile-index changes delen `AtlasSnapshot`/Settings-refresh;
  beide moeten tegen dezelfde live snapshot-semantiek worden gereviewd.
- Releasecontract en release-channel changes delen `.github/workflows/release.yml`
  en de actieve reproduceerbare-releasespec.
- Relationship-modal hardening mag geen wijziging brengen in de bestaande
  mutation- of persistencecontracten.
- Geen child ticket mag commit, push, tag, GitHub-release of vaultwrite doen
  zonder afzonderlijke expliciete autorisatie.

## Definition of Done voor het parent-plan

- Elk child ticket heeft actuele RED/GREEN-evidence, onafhankelijke review en
  een actuele volledige gate binnen de gedeclareerde Node-24-runtime.
- De actieve specs, tests en implementatie spreken elkaar niet tegen.
- Geen finding uit de eindbeoordeling blijft zonder owner of durable no-action
  rationale.
- Status, dependencies, evidence, review en retrospective van alle child
  records zijn coherent.
- Live Desktop/Mobile en remote GitHub-publicatie blijven expliciet als niet
  lokaal bewezen onderscheiden.

## Acceptance Criteria

- [x] Elk bounded child ticket heeft actuele RED/GREEN-evidence, onafhankelijke
      review en de actuele Node-24 full gate binnen de gedeclareerde runtime.
- [x] Actieve specs, tests, source en releasecopy spreken elkaar niet tegen.
- [x] Elke finding heeft een owner of een expliciete durable no-action rationale.
- [x] Status, dependencies, acceptance, evidence, review en retrospective van
      de child- en closure-records zijn coherent.
- [x] Native Desktop/Mobile, remote GitHub, attestation en publicatie zijn
      expliciet als niet lokaal bewezen begrensd.

## Blockers

Geen product- of recordblocker bevestigd. De childtickets zijn formeel gesloten na
actuele onafhankelijke review, record-audit en Node-24 final gate. Het bestaande
i18n-ticket blijft de enige owner voor diagnostics/locale-presentatie. Het oude
`0.12.0`-releaseplan is cancelled/superseded; de actuele lokale `0.12.1`-
provenance staat in het evidence-record.
## Status addendum — 2026-08-08

Recordcoherentie is bijgewerkt: één actieve owner per huidige child-scope,
historische release-drafts zijn expliciet cancelled/superseded en de actuele
releasecandidate heeft een lokaal provenance-record. Geen remote release,
commit, push, tag of live Obsidian-validatie is geclaimd.

## Evidence

De bounded child tickets bevatten de actuele RED/GREEN-journalen, closure-
evidence en retrospectives. Node v24.18.1 final gate exit 0: node 53/964,
browser 10/158, integration 9/38, DPR 1/1.5/2 elk 2/2; format/lint/typecheck/
build/community/audit/releasecontract/reproducibility/diff-check groen. De
releasecontract-run rapporteerde `main.js 426082 bytes`, exacte assets, audit
0 vulnerabilities en reproduceerbare SHA-256
`486cd5ac2929dcb8119ba41323436b4c75648c040e3e40dcbbbb23fbf30b81f4`.

## Review

2026-08-08 onafhankelijke repair-review: **PASS** na herstel van release-
ordering, runner fail-closed gedrag, My Person integration-readiness en
PersonIndex null-cache/readiness-races. De afzonderlijke owner-reviews zijn in
de childtickets vastgelegd. Residueel: geen native Desktop/Mobile-host,
GitHub Actions-run, remote tag/release, attestation of Community Plugins-
publicatie.

## Retrospective

De closurekwaliteit kwam vooral uit het scheiden van drie bewijsgrenzen:
productgedrag, uitvoerbare lokale gate en niet-uitgevoerde native/remote
validatie. De belangrijkste herbruikbare les is dat een non-empty vault niet
automatisch readiness betekent: ontbrekende metadata-cache moet vóór de eerste
`resolved` de canonical indexpublicatie blokkeren.

## Referenties

- `.agents/skills/10x/SKILL.md`
- `AGENTS.md`
- `.10x/decisions/release-bundle-limit-removal.md`
- `.10x/specs/reproducible-obsidian-release.md`
- `.10x/specs/my-person-note-picker.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/relationship-form-disclosure.md`
