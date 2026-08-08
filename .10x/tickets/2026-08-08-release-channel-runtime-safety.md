Status: done
Created: 2026-08-08
Updated: 2026-08-08
Parent: `.10x/tickets/2026-08-08-final-review-remediation.md`
Owner: People Atlas implementation workstream — release channel
Depends-On: `.10x/specs/reproducible-obsidian-release.md`

# Releasechannels: uitvoerbare marker- en branchveiligheid

## Doel

Maak de alpha/beta/rc/stable-channelkeuze reproduceerbaar en testbaar op
runtimegedrag, niet alleen op aanwezigheid van shelltekst.

## Scope

- implementeer de actieve markerregel: exact één erkende marker als eerste
  niet-lege regel;
- laat meerdere erkende markers fail-closed falen;
- laat ontbrekende of onbekende channelwaarden expliciet stable betekenen;
- voorkom dat een marker in prose/codevoorbeeld later in release notes als
  kanaal wordt geïnterpreteerd;
- voeg een uitvoerbare testmatrix toe voor alpha, beta, rc, stable, ontbrekende
  notes, onbekende marker en duplicate markers;
- behoud strict `x.y.z`, remote-tag/SHA-guards, attestatie en de drie exacte
  release-assets.

De executor mag de resolver in het bestaande shellblok houden wanneer het
werkelijk uitvoerbaar wordt getest. Als shelltestbaarheid dat niet toelaat, mag
alleen de marker-resolver naar één kleine getypeerde/pure helper worden
verplaatst; geen algemene releaseframeworklaag.

## Niet doen

- Geen daadwerkelijke `gh release create`, tag, push of remote write;
- geen wijziging aan historische publieke tags/releases;
- geen wijziging aan de prereleasebranding of strict-semverregel;
- geen brede YAML-refactor.

## Verticale TDD

### Slice 1 — markerresolver

- RED: voeg fixtures toe voor de volledige channelmatrix; de huidige
  `grep|head -1`-semantiek moet op duplicate markers aantoonbaar niet voldoen.
- GREEN: implementeer exact-first-line en duplicate-marker-fail-closed gedrag.

### Slice 2 — publish-branchgedrag

- RED: voer het werkelijke publish-branchpad uit met een gemockte, niet-schrijf-
  ende `gh` en bewijs dat statische guards onvoldoende zijn.
- GREEN: assert de uiteindelijke flags/titels voor alle vier kanalen zonder
  externe publicatie.

### Review en gates

- onafhankelijke read-only review van workflow, resolver, fixtures en actieve
  release-spec;
- daarna releasecontracttest, volledige Node-24 gate en `git diff --check`;
- noteer expliciet dat remote GitHub-publicatie niet lokaal bewezen is.

## Acceptatiecriteria

- [x] Alpha, beta en rc leveren ieder `--prerelease` plus de juiste titel.
- [x] Stable levert geen `--prerelease` en gebruikt de stabiele titel.
- [x] Een ontbrekende of onbekende marker wordt stable volgens de spec.
- [x] Een marker in prose of een latere regel activeert geen prerelease.
- [x] Meerdere erkende markers falen vóór attestatie/publicatie.
- [x] De tests voeren het resolver-/publishgedrag uit en controleren niet alleen
      `toContain()` op YAML- of shelltekst.
- [x] Existing remote-tag, `--verify-tag`, SHA-, asset- en attestatieguards
      blijven aanwezig.
- [x] Onafhankelijke review en actuele Node-24 full gate zijn groen.

## Blokkers

None bevestigd. De gewenste markersemantiek is door de bijgewerkte actieve
release-spec vastgelegd.

## Journal

- 2026-08-08 RED: `npx vitest run --project node test/release-channel.test.ts`
  faalde vóór testuitvoering omdat de nog niet bestaande resolver niet kon worden
  geïmporteerd.
- 2026-08-08 GREEN: de pure resolver en workflow-integratie zijn toegevoegd.
  `test/release-channel.test.ts` en `test/release-contract.test.ts` samen:
  28/28 tests groen.
- 2026-08-08: CLI-smoke tests bewezen `Channel: alpha` →
  `alpha / People Atlas 0.12.1 (Alpha) / true`, ontbrekende notes → stable,
  duplicate markers → exit 1 en late marker → exit 1.
- 2026-08-08: `npm run format:check` groen, `npm run lint` exit 0 met alleen
  bestaande info/warning-meldingen, `npm run typecheck` groen.
- 2026-08-08 repair RED→GREEN: de onafhankelijke review vond dat channel-
  resolutie nog uitsluitend in het publishblok plaatsvond, ná attestatie.
  `test/release-contract.test.ts` is eerst RED gemaakt voor een expliciete
  pre-attestation `release-channel`-step en hergebruik van zijn outputs.
  Daarna is `.github/workflows/release.yml` gerepareerd: de resolver draait
  vóór reproducibility/attestation, schrijft channel/title/prerelease naar
  `GITHUB_OUTPUT`, en publish roept de resolver niet meer opnieuw aan.
  Release-channel plus release-contract: 28/28 groen onder Node v24.18.1.
- 2026-08-08: uitvoerbare publish-branchtest toegevoegd. De actuele YAML-
  shell is vier keer uitgevoerd vanuit een tijdelijke notesfixture met een
  niet-publicerende gemockte `gh`: alpha, beta, rc en stable controleerden
  titel, `--prerelease`, `--verify-tag`, `--generate-notes`, notes en exact de
  drie assets. De vier cases plus bestaande contracttests: 32/32 groen.

## Evidence

De resolvermatrix test daadwerkelijk channel, titel en prereleaseflag. De
workflow valideert de channel vóór reproducibility/attestatie/publicatie,
hergebruikt de gevalideerde outputs en stopt bij een malformed marker. Een
echte GitHub Actions-run en publicatie zijn lokaal niet bewezen en blijven
buiten scope. De publishbranch is wel uitvoerbaar lokaal met gemockte `gh`
doorlopen voor alle vier kanalen zonder externe write. De Node-24 final gate is
exit 0; releasecontract `--tag 0.12.1` en reproducibility zijn groen.

## Review

2026-08-08 onafhankelijke actuele release-review: **PASS** voor resolver,
workflow-ordering, output-hergebruik en gemockte publishbranches. Residueel:
geen echte GitHub Actions-run, remote tag-resolutie, attestatie of publicatie.

## Retrospective

De veilige grens is een pure fail-closed resolver plus een aparte vroege
workflowstep die gevalideerde outputs doorgeeft; het publishblok moet die
outputs consumeren en niet opnieuw interpreteren.

## Referenties

- `.10x/specs/reproducible-obsidian-release.md`
- `.github/workflows/release.yml`
- `test/release-contract.test.ts`
- `.10x/tickets/2026-08-06-alpha-release-channel-workflow.md`
- `.10x/tickets/2026-08-07-beta-rc-release-channels.md`
