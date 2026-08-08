Status: done
Created: 2026-08-08
Updated: 2026-08-08
Parent: `.10x/tickets/2026-08-08-final-review-remediation.md`
Owner: People Atlas implementation workstream — release records
Depends-On: `.10x/tickets/2026-08-08-release-contract-simplification.md`, `.10x/tickets/2026-08-08-release-channel-runtime-safety.md`

# 10x records: release- en closurecoherentie

## Doel

Maak de release- en reviewrecords opnieuw cold-start-auditbaar nadat meerdere
AI-workflows wijzigingen hebben aangebracht. Dit ticket wijzigt geen
productcode en publiceert niets.

## Scope

- wijs per recente release/channelwijziging één owner-ticket aan;
- reconcile `Status`, `Governed-By`, `Depends-On`, acceptance, evidence, review
  en retrospective van de alpha- en beta/rc-records;
- markeer het draft My Person-ticket expliciet als superseded door het nieuwe
  veiligheidsticket, zonder historische journaltekst te herschrijven;
- maak een expliciet release-record voor de huidige `0.12.1`-releasecopy en
  link de channel-/contractevidence;
- leg vast of annotated tags verplicht zijn of lightweight tags toegestaan zijn;
  laat workflow, spec en tickets dezelfde policy gebruiken;
- documenteer de beperking dat lokale gates geen live Desktop/Mobile of remote
  GitHub-publicatie bewijzen;
- behoud de bestaande i18n-diagnostics-ticket als enige owner/provenancebron
  voor de afgeronde Engelse diagnostics en locale-formattering; resterende
  native-hostvalidatie is durable no-action, geen open productwerk.

## Niet doen

- Geen historische beslissing of journalbewijs herschrijven; gebruik
  supersession/addenda;
- geen tag-, release-, GitHub-, remote- of vaultwrite;
- geen productcode of tests wijzigen;
- geen ticket sluiten zonder actuele evidence en onafhankelijke review.

## Verticale uitvoering

### Slice 1 — authority map

- maak een matrix van actieve spec → owning ticket → source/test/evidence;
- identificeer stale/draft records en leg per record een concrete actie vast.

### Slice 2 — record repair

- voeg alleen noodzakelijke cross-references, statusupdates, supersession-notes
  en evidence pointers toe;
- behoud append-only journalhistorie;
- voer geen cosmetische bulk-herformattering uit.

### Review en gate

- onafhankelijke read-only record-audit;
- controleer dat geen actieve spec, ticketstatus of releasepolicy elkaar nog
  tegenspreekt;
- `git diff --check` en repositorystatus; geen productgate claimen voor
  record-only edits.

## Acceptatiecriteria

- [x] Elke finding uit de eindbeoordeling heeft één owner-record.
- [x] Draft/active/done-statussen, acceptance en journalclaims zijn coherent.
- [x] De huidige releasecopy, channelmarker en tagprovenance hebben één
      auditbare recordketen.
- [x] Annotated/lightweight tagbeleid is expliciet en overal gelijk.
- [x] De bestaande i18n-ticket is als owner voor diagnostics/locale-formattering
      gekoppeld; geen duplicaat-ticket bestaat.
- [x] Live-host- en remote-publicatielimieten staan expliciet bij evidence.
- [x] Onafhankelijke record-review is PASS; geen closure op basis van alleen
      historische journalclaims.

## Blokkers

Afhankelijk van de twee release-child tickets. Geen externe autorisatie is nodig
voor record-only wijzigingen; externe releaseacties blijven buiten scope.

## Journal

- 2026-08-08: Authority map vastgelegd: `.10x/specs/reproducible-obsidian-release.md`
  is de release- en channelautoriteit; `release-contract-simplification.md`
  bezit de size-onafhankelijke contractwijziging en
  `release-channel-runtime-safety.md` bezit de uitvoerbare markerbranches.
  `.10x/specs/my-person-note-picker.md` en
  `.10x/specs/perspective-relationship-foundation.md` worden bezeten door
  `my-person-selection-safety.md`; readiness door
  `mobile-index-readiness.md`; disclosure door
  `relationship-modal-contract-hardening.md`.
- 2026-08-08: Het bestaande fase-3 i18n-ticket is expliciet owner voor de
  resterende diagnostics/locale-presentatie; er is geen duplicaat-ticket
  geopend. Het draft My Person-ticket en de draft/oudere alpha- en beta/rc-
  channelrecords zijn met append-only supersession-addenda naar hun nieuwe
  owners verwezen.
- 2026-08-08: `.10x/evidence/2026-08-08-release-0.12.1-provenance.md` legt de
  actuele `0.12.1` releasecopy, eerste-regel `Channel: alpha`, size-besluit,
  drie assets en annotated-prefer/lightweight-fallback tagprovenance vast.
  Geen remote releaseactie is uitgevoerd.

## Evidence

De authority map, supersession-addenda en release-0.12.1-provenance-evidence
zijn lokaal leesbaar en verwijzen ieder naar één actieve owner. De workflow,
spec en historical release-hardening evidence beschrijven dezelfde remote-tag-
resolutie: annotated `^{}` wordt geprefereerd, een exact lightweight-ref is de
veilige fallback, en beide moeten naar de oorspronkelijke `github.sha` wijzen.
De actieve release-spec beschrijft deze fallback nu eveneens expliciet. De
Node-24 final gate exit 0 en de actuele provenance zijn in de owner-records
vastgelegd; live hostvalidatie, remote GitHub-publicatie en attestation zijn
expliciet niet bewezen.

## Review

2026-08-08 onafhankelijke read-only record-audit: **PASS na record-repair**.
De audit bevestigde owner/dependency-graaf, actuele acceptance/evidence/review-
velden, supersession, tagpolicy en expliciete native/remote-limieten.

## Retrospective

Record-only repairs moeten append-only historische claims behouden, maar actuele
gateaantallen en observaties mogen niet onder een stale “current evidence”-kop
blijven staan. Een aparte provenance-observatie voorkomt dat releasegrootte,
digest en channelstatus uit verschillende tijdstippen worden vermengd.

## Referenties

- `.agents/skills/10x/SKILL.md`
- `AGENTS.md`
- `.10x/specs/reproducible-obsidian-release.md`
- `.10x/tickets/2026-08-07-my-person-dropdown-mobile-fix.md`
- `.10x/tickets/2026-08-07-beta-rc-release-channels.md`
- `.10x/tickets/2026-08-06-alpha-release-channel-workflow.md`
- `.10x/tickets/2026-08-04-i18n-diagnostics-formatting-nl-en.md`
