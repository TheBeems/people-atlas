Status: recorded
Created: 2026-08-09
Updated: 2026-08-09
Owner: `.10x/tickets/2026-08-08-native-relationship-person-picker.md`

# Native relationship-person picker — closure evidence

## Observation

De lokale People Atlas-kandidaat bevat de plugin-owned relationship-person
picker. De zichtbare input- en optiontekst gebruikt persoonsnamen; canonicale
bestands- en identitywaarden blijven intern en gaan via de bestaande Save-
resolver naar de mutation-boundary.

Dit record beschrijft de dirty local worktree-kandidaat op 2026-08-09. Het is
geen provenancebewijs voor de bestaande `0.12.2`-tag, een remote branch of een
gepubliceerde release.

## Procedure en actuele resultaten

Runtime voor de gate: Node `v24.18.1`, npm `11.16.0`.

- Gerichte commands onder Node v24.18.1, elk exit 0:
  `npx vitest run --project browser test/browser/relationship-modal.browser.test.ts
  --no-file-parallelism --maxWorkers=1`,
  `npx vitest run --project browser --no-file-parallelism
  test/browser/partner-parent-relationship-modal.browser.test.ts`, en
  `npx vitest run --project integration
  test/integration/partner-parent-confirmation.integration.test.ts
  --no-file-parallelism --maxWorkers=1`. Samen: 33 browser-tests en 5
  integration-tests.
- Exact `npm run test` is drie keer sequentieel uitgevoerd; elke run exit 0:
  node 53 bestanden/965 tests, browser 10 bestanden/166 tests, integration 9
  bestanden/39 tests, DPR-matrix 6/6.
- `npm run format:check`: exit 0; 172 bestanden gecontroleerd.
- `npm run lint`: exit 0; alleen bestaande informatie/warnings.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0.
- `npm run release:contract`: exit 0; package `0.12.2`, exacte assets
  `main.js`, `manifest.json`, `styles.css`, lokale `main.js` 429105 bytes.
- `npm run verify:reproducible`: exit 0; beide builds hadden SHA-256
  `ba1f0b9c159be985042c930fd71a41a1fb659a7e64d07d9701179d31c52f3858`.
- `npm run dependency:audit`: exit 0; `found 0 vulnerabilities`.
- `npm run community:check`: exit 0.
- `git diff --check HEAD`: exit 0.

De aggregate integration-runner print tijdens de opzettelijke negatieve
child-process-test een `MODULE_NOT_FOUND`-stacktrace. De parent-runner en de
bijbehorende test slagen; de volledige opdracht eindigt met exit 0. Dit is
vastgelegd als runnerdiagnostiek, niet als productfailure.

De read-only record-audit observeerde voor de huidige lokale `main.js` 429105
bytes en dezelfde SHA-256-digest als hierboven. Deze observatie is uitsluitend
voor de dirty kandidaat.

## Wat dit ondersteunt

- De endpointvelden gebruiken geen `input[list]` of native `<datalist>` meer.
- De actieve listbox wordt in het owning document onder het actieve veld
  geankerd; sibling-listboxen worden gesloten.
- Visible presentation en canonical selection state zijn gescheiden.
- Duplicate display names behouden afzonderlijke canonicale selecties.
- Pointer/touch, filtering, Escape, Tab, blur, modal close en lifecycle cleanup
  zijn in de gecontroleerde browserflows afgedekt.
- Canonicale Save-payloads en no-write-before-Save blijven behouden.
- De volledige lokale Node-24-productgate is groen.

## Onafhankelijke review

- `deleg_b9ae6245`, 2026-08-09: **PASS** voor de implementatie; geen
  critical/significant productfinding.
- `deleg_25ea394d`, 2026-08-09: **CONCERNS** op lage severity voor aanvullende
  real-browser keyboard coverage, de listbox-UI-route voor duplicate explicit
  IDs en detached owner-document/host probes. Geen runtime-defect vastgesteld.

De low-severity coverage-/hostgrenzen zijn als residual risk geaccepteerd voor
het bounded implementation-ticket. Het aanvullende werk heeft een eigen open
owner-ticket:
`.10x/tickets/2026-08-09-relationship-picker-browser-coverage.md`.

## Grenzen

Deze evidence bewijst geen native Obsidian Desktop/Mobile/WebView/IME-gedrag,
assistive-technology-output, remote CI, GitHub Actions, remote tag-resolution,
attestation, Community Plugins-publicatie of releasepublicatie. Er is geen
commit, push, tag of vaultwrite uitgevoerd.
