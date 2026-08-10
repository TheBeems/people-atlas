Status: active
Created: 2026-08-10
Updated: 2026-08-10
Parent: None
Owner: People Atlas implementation workstream — supply-chain hardening
Depends-On: `.10x/specs/supply-chain-hardening.md`, `.10x/specs/reproducible-obsidian-release.md`

# Supply-chain hardening — least privilege, artifactgrens en Node-24-tooling

## Scope

Implementeer `.10x/specs/supply-chain-hardening.md` als één
**dependency-ready TDD-ticket**. De uitkomst is een hardening van uitsluitend
CI/release/toolingconfiguratie:

1. voeg aan `.github/workflows/ci.yml` expliciete
   `permissions: contents: read` toe;
2. splits `.github/workflows/release.yml` in een read-only buildjob en een
   afzonderlijke publicatiejob;
3. laat de buildjob met Node 24, `npm ci`, audit, bestaande quality/test/build-
   gates, releasecontract/channelvalidatie en reproducibility exact drie
   gecontroleerde artifacts (`main.js`, `manifest.json`, `styles.css`) uploaden;
4. laat de publicatiejob alleen het gecontroleerde artifact downloaden,
   attesteren en na de bestaande remote-tag/SHA-guards publiceren, zonder npm-
   installatie, tests of build;
5. geef alleen de publicatiejob `contents: write`, `id-token: write` en
   `attestations: write`, en gebruik `persist-credentials: false` op iedere
   checkout;
6. zet alle gebruikte actions — inclusief artifact-upload/download — vast op
   volledige commit-SHA's;
7. lijn `@types/node` in `package.json` en `package-lock.json` uit op major 24,
   gelijk aan de Node 24-runner;
8. voeg regression/contracttests toe die de permissions, jobgrens, artifactset,
   credentialgrens, SHA-pinning, publicatievolgorde en Node-type-major
   fail-closed bewaken.

Dit ticket verandert geen pluginruntime en is geen aanwijzing dat een huidige
release gecompromitteerd is.

## Niet doen

- Geen wijziging aan production source, vaultwrites, resource-resolver,
  community-readinesslogica of pluginfeatures.
- Geen nieuwe reguliere runtime dependency, releaseframework, SBOM, installer,
  deploymentomgeving, signinglaag of secretrotatie.
- Geen wijziging aan releaseversies, releasecopy, channelsemantiek, strict
  `x.y.z`, artifactnamen, remote-tag/SHA-verificatie of `--verify-tag`.
- Geen `npm install` in de publicatiejob als workaround; de buildjob blijft de
  enige plek voor dependency-installatie en productverificatie.
- Geen echte GitHub Actions-run, OIDC-uitgifte, attestationverificatie, tag,
  push, GitHub-release, Obsidian Community-submission of andere externe write.
- Geen commit of push in deze record-/implementatiefase zonder een aparte,
  expliciete autorisatie na review en actuele gate.

## Acceptatiecriteria

- [x] `ci.yml` declareert expliciet `permissions: contents: read`.
- [x] `release.yml` heeft een read-only buildjob met `contents: read` en een
      aparte publicatiejob die via `needs` van de buildjob afhangt.
- [x] Alleen de publicatiejob heeft `contents: write`, `id-token: write` en
      `attestations: write`; de buildjob heeft geen OIDC- of attestationwrite.
- [x] Alle checkoutstappen gebruiken `persist-credentials: false`.
- [x] Alle `uses:`-verwijzingen in beide workflows gebruiken volledige
      lowercase 40-tekens commit-SHA's; action-majoren zijn alleen commentaar-
      metadata en geen mutable runtime-referentie.
- [x] De buildjob voert `npm ci`, dependency-audit, de bestaande
      format/lint/typecheck/test/build/releasecontract/community-gates en
      `npm run verify:reproducible` uit voordat artifacts worden geüpload.
- [x] De buildjob uploadt exact `main.js`, `manifest.json` en `styles.css`;
      ontbrekende bestanden laten de upload falen en source/tests/sourcemaps/
      dependencies/`.10x` worden niet geüpload.
- [x] De publicatiejob installeert niets en voert geen npm-, npx-, test- of
      buildcommando uit; hij downloadt het benoemde artifact, attesteert exact
      de drie bestanden en publiceert uitsluitend die drie.
- [x] Channel/title/prerelease-output wordt één keer vóór attestatie bepaald,
      via joboutputs doorgegeven en in de publicatiejob hergebruikt; de
      bestaande remote-tag/SHA-guard blijft direct vóór publicatie staan.
- [x] `package.json` declareert `@types/node` op major 24 en
      `package-lock.json` resolveert geen major 26 meer.
- [x] De contracttests worden eerst RED gemaakt tegen de huidige tags,
      monolithische releasejob, ontbrekende permissions/credentialgrens en
      `@types/node` major 26; daarna worden ze GREEN zonder beschermende
      assertions te verwijderen of te verzwakken.
- [x] Per verticale slice is in dit ticket actuele RED→GREEN-evidence
      vastgelegd met exact commando, exitcode, scope en limieten.
- [x] Na de laatste source/testwijziging geeft een onafhankelijke read-only
      review `PASS`, of elk niet-kritiek residueel risico heeft een duurzame
      owner en expliciete acceptatie.
- [x] De volledige actuele Node-24-gate is groen: format, lint, typecheck,
      volledige test, production build, community check, dependency audit,
      release contract, reproducibility en `git diff --check`.
- [x] De ticketstatus blijft open/active totdat review en actuele gate groen
      zijn; geen closure op basis van historische journalclaims.

## References

- `.10x/specs/supply-chain-hardening.md`
- `.10x/specs/reproducible-obsidian-release.md`
- `.10x/research/2026-07-27-p8-release-hardening-gap-analysis.md`
- `AGENTS.md`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `package.json`
- `package-lock.json`
- `scripts/release-contract.mjs`
- `scripts/release-channel.mjs`
- `scripts/verify-reproducible-build.mjs`
- `test/release-contract.test.ts`

## Aannames en provenance

- **User-ratified 2026-08-10:** één dependency-ready ticket voor alle supply-
  chain-hardening; er komt geen parent/child-splitsing.
- **User-ratified 2026-08-10:** de gewenste architectuur is een read-only
  buildjob met installatie/audit/tests/build/digest en artifact-upload, plus
  een aparte publicatiejob zonder npm-installatie met uitsluitend de benodigde
  schrijf-, OIDC- en attestationrechten.
- **Record-backed:** `.10x/specs/reproducible-obsidian-release.md` blijft de
  autoriteit voor Node 24, `npm ci`, audit, releasecontract, reproducibility,
  channelvolgorde, remote-tag/SHA-guard, attestatie en exact drie assets.
- **Record-backed:** de huidige plugin heeft geen reguliere runtimepackages;
  `package.json` bevat alleen ontwikkel-/buildtools in `devDependencies`.
- **Source-backed pre-implementation:** de toenmalige `release.yml` had één job
  met `contents: write`, `id-token: write`, `attestations: write`, `npm ci` en
  major-tagged actions; de toenmalige `ci.yml` had geen expliciete permissions.
- **Source-backed pre-implementation:** `package.json` en `package-lock.json`
  declareerden toen `@types/node` op `^26.1.1`, terwijl de workflows en
  `engines` Node `24.x` gebruikten.
- **Mechanical:** de exacte minor/patch binnen `@types/node` major 24 en de
  exacte action-commit-SHA mogen opnieuw worden opgelost tegen de bedoelde
  bestaande major; de uitvoerder moet de gekozen resolved waarden in Journal en
  Evidence vastleggen en mag geen mutable tag achterlaten.

## Verticale TDD-slices

### Slice 1 — Node-runtime/typecontract (RED → GREEN)

- **RED:** voeg aan `test/release-contract.test.ts` of een gelijkwaardige
  bestaande contracttest een assertion toe die de Node-engine-major vergelijkt
  met de gedeclareerde en gelockte `@types/node`-major. De huidige `26` versus
  `24` moet falen.
- **GREEN:** wijzig alleen de ontwikkeltype-declaratie en lockfile-resolutie
  naar major 24; voer `npm ci` uit en bewijs dat de lockfile niet buiten deze
  dependencygrens reserialiseert.
- **Bewijs:** package/lock-contract, `npm ci`, typecheck; de test bewijst alleen
  major-uitlijning en niet dat iedere Node API op runtime bestaat.

### Slice 2 — Permissions, credentials en immutable action provenance (RED → GREEN)

- **RED:** voeg workflow-contractassertions toe voor expliciete CI-read,
  job-level releasepermissions, `persist-credentials: false` en volledige
  40-tekens SHA's. De huidige CI en release-YAML moeten aantoonbaar falen.
- **GREEN:** pin checkout/setup-node/attest en de noodzakelijke
  upload/download-actions op volledige commit-SHA's en stel least-privilege
  permissions plus credentialpersistencygrens in.
- **Bewijs:** actuele YAML-contracttest en diff-inspectie; dit is geen echte
  GitHub Actions-executie.

### Slice 3 — Build/publicatiegrens en artifactcontract (RED → GREEN)

- **RED:** voeg assertions toe dat de release een afhankelijke buildjob en
  publicatiejob heeft, dat build vóór upload alle gates en digestverificatie
  uitvoert, dat upload/download exact de drie release-assets noemt, en dat de
  publicatiejob geen npm/install/test/build-pad bevat.
- **GREEN:** splits de workflow, geeft channel/title/prerelease als joboutputs
  door, uploadt/downloadt alleen de candidate-assets en laat alleen de
  publicatiejob attestatie, remote-tagguard en `gh release create` uitvoeren.
- **Bewijs:** YAML-contracttest, eventuele bestaande uitvoerbare publishbranch-
  tests en inspectie dat bestaande releasecontract-/channelguards niet zijn
  verzwakt.

### Slice 4 — Integrale hardeninggate (RED → GREEN)

- **RED:** draai de nieuwe contracttests tegen de definitieve workflow/package-
  wijzigingen samen met de bestaande release/channeltests; herstel alleen
  concrete contractdrift.
- **GREEN:** draai daarna de volledige Node-24-gate en leg actuele output vast.
  Iedere source- of testpatch na review maakt review- en gate-evidence stale en
  vereist een nieuwe review en de relevante gate.
- **Bewijs:** exact commando, runtime, exitcode, test-/filecounts en limieten in
  dit ticket; geen externe publication claim.

## Journal

- 2026-08-10: De gebruiker rapporteerde een middel-lage supply-chain-hardening-
  verbetering: huidige community-readiness- en lokale-foto/resolvergrenzen zijn
  sterk, maar de releaseworkflow combineert build en publicatieprivileges; CI
  mist expliciete read-permissions; actions gebruiken major-tags; checkout
  persistente credentials; `@types/node` loopt voor op Node 24.
- 2026-08-10: Read-only source inspection bevestigde in
  `.github/workflows/release.yml` één job met `contents: write`,
  `id-token: write`, `attestations: write`, `npm ci` en
  `actions/checkout@v7`, `actions/setup-node@v7`, `actions/attest@v4`.
- 2026-08-10: Read-only source inspection bevestigde in `.github/workflows/ci.yml`
  geen expliciete `permissions:` en dezelfde mutable checkout/setup-node-major-
  tags.
- 2026-08-10: `package.json` en `package-lock.json` declareren
  `@types/node: ^26.1.1`, terwijl `engines.node` en beide workflows Node `24.x`
  gebruiken.
- 2026-08-10: De bedoelde bestaande action-tags resolveerden bij recordauthoring
  via `git ls-remote` als checkout `v7` →
  `3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node `v7` →
  `820762786026740c76f36085b0efc47a31fe5020`, attest `v4` →
  `1e69f48acb82d1966a394da916b4c1698aa569d6`. Voor de nieuwe artifactgrens
  resolveerden upload-artifact `v4` →
  `ea165f8d65b6e75b540449e92b4886f43607fa02` en download-artifact `v4` →
  `d3f86a106a0bac45b974a628896c90dbdf5c8093`. Deze observatie is een
  implementatiestartpunt; de uitvoerder valideert de bedoelde major opnieuw.
- 2026-08-10: De gebruiker ratificeerde de vorm van één dependency-ready ticket
  vóór het openen van dit uitvoerbare record.
- 2026-08-10: Deze beurt schrijft alleen `.10x`-records. Productcode,
  workflows, package/lockfile en tests zijn niet gewijzigd of uitgevoerd.
- 2026-08-10: Eerste RED-slice tegen de pre-hardening worktree faalde met
  `npm run test:release-contract -- --no-file-parallelism --maxWorkers=1`
  (exit 1). Na Node-24-type-uitlijning en workflowhardening werd dezelfde
  focused contracttest GREEN: 30/30 tests, exit 0.
- 2026-08-10: `npm ci --no-audit --no-fund` was GREEN (exit 0). De
  `@types/node`-declaratie en lockfile-resolutie zijn `^24.13.3`/`24.13.3`;
  er is geen production dependency toegevoegd.
- 2026-08-10: De eerste post-review reparatie-RED had 29/30 tests groen en
  faalde uitsluitend op de ontbrekende directe candidate-file guard. Na de
  guard en assertion-versterking werd de focused suite opnieuw 30/30 GREEN.
  De reparatie dekte H-1 en M-1–M-4 uit het eerste reviewrapport; de gemelde
  trailing-whitespacefinding is byte-wise niet reproduceerbaar.
- 2026-08-10: De onafhankelijke post-repair read-only review op de actuele
  snapshot gaf formeel `PASS`, zonder critical/significant/minor/nit-findings.
  De reviewer bevestigde 8/8 SHA-pins, exacte permissions, gatevolgorde,
  candidate-file guard, outputwiring en package/lockfile-coherentie.
- 2026-08-10: De actuele Node-24 full gate draaide met Node `v24.19.0` en
  npm `10.9.8`: `npm ci`, Playwright-prerequisite, `npm run check`, audit,
  tagged release contract, reproducibility, `git diff --check` en record-
  whitespacecheck waren allemaal exit 0. `npm run check` omvatte format,
  lint, typecheck, volledige node/browser/integration/DPR-testmatrix,
  production build, releasecontract en community check. De node-suite gaf
  57 testfiles/997 tests; de browser-suite 12 testfiles/171 tests.
- 2026-08-10: De tagged releasecontractcheck voor `0.12.2` bevestigde
  `main.js` (441878 bytes), `manifest.json` en `styles.css`. De
  dependency-audit vond 0 vulnerabilities. De twee reproducibility-digests
  waren gelijk:
  `227dd2cbb30237686254d9e83732f382ff81dabb291923adceca39f2aa429e06`.
- 2026-08-10: Er zijn geen GitHub Actions-runs, OIDC-tokens, attestation-
  verificaties, tags, pushes, GitHub-releases, Obsidian-publicaties of
  commits uitgevoerd. De worktree blijft bewust on-gecommit totdat daarvoor
  afzonderlijke expliciete autorisatie is gegeven.

## Blokkers

Geen blocker voor de afgeronde implementatie-, review- en gate-scope. De echte
GitHub Actions-run, OIDC/attestation, remote-tag, GitHub-release en
Obsidian-publicatie blijven buiten lokale evidence en buiten de scope van dit
ticket.

## Evidence

### Record-authoring evidence

- Voor het schrijven van deze records was de worktree `main...origin/main`,
  zonder staged, unstaged of untracked productwijzigingen.
- De actuele workflow-, package-, lockfile- en bestaande releasecontracttest-
  inhoud is read-only geïnspecteerd; de bovenstaande observations zijn de
  huidige uitgangssituatie.
- `git ls-remote` leverde de in het Journal genoemde action-tagresoluties op.
- Geen producttest, build, audit, GitHub Actions-run, attestation of externe
  write is in deze recordsfase uitgevoerd. Deze records vormen dus geen
  implementatie- of gate-evidence.

### Implementation- en gate-evidence

- Focused releasecontract: `npm run test:release-contract --
  --no-file-parallelism --maxWorkers=1` — exit 0, 30/30 tests.
- Reviewhervalidatie: `npm run typecheck`, `npm run format:check`, `npm run lint`
  en YAML-/shellparse — allemaal exit 0; lint meldt alleen de twee bestaande
  waarschuwing/info-items in ongewijzigde test/stubbestanden.
- Node-24 full gate: Node `v24.19.0`, npm `10.9.8`, `npm ci`, Playwright-
  prerequisite, `npm run check`, dependency-audit, tagged releasecontract,
  reproducibility en diff/record-whitespacechecks — allemaal exit 0.
- Full gate-samenvatting: node 57 testfiles/997 tests, browser 12
  testfiles/171 tests, production build, community-readiness voor 75
  sourcefiles, release assets exact en 0 dependency vulnerabilities.
- Reproducibility: beide `main.js`-SHA's zijn
  `227dd2cbb30237686254d9e83732f382ff81dabb291923adceca39f2aa429e06`.

### Evidence boundary

Lokale contracttests, YAML-/shellparse, de onafhankelijke review en de Node-24
full gate bewijzen de repositorycontracten en lokale uitvoerbaarheid. Zij
bewijzen geen echte GitHub Actions-run, jobskip bij build failure, GitHub
permission enforcement, OIDC-token, attestationverificatie, remote tag/release,
Obsidian Community-publicatie of native Desktop/Mobile-runtime. Er zijn geen
externe writes, tags, pushes, releases, commits of vaultwrites uitgevoerd.

## Review

**PASS — 2026-08-10, onafhankelijke post-repair read-only review.** De reviewer
las de volledige spec-, ticket-, source-, test- en worktree-snapshot opnieuw en
vond geen critical, significant, minor of nit-findings. H-1 en M-1–M-4 uit de
vorige CONCERNS-review zijn aantoonbaar opgelost; de eerdere L-1-finding is niet
reproduceerbaar. De review bevestigde 8/8 volledige action-SHA's, exacte
permissions, `needs: build`, ontbrekende `always()`, gatevolgorde, file guard,
channel-outputwiring en Node-24/type-lockcoherentie.

De review bewijst lokaal geen echte GitHub Actions-jobskip, permission
handhaving, OIDC-token, attestation, remote release/publicatie of native
Obsidian Desktop/Mobile-runtime. Deze grenzen zijn residuele evidence-limieten,
geen open implementatiefindings.

## Retrospective

De meest foutgevoelige grens was niet de YAML-splitsing zelf, maar het
assertion-grade houden van de trust boundary: named-step `uses:`-regels werden
niet door de eerste pin-test gezien, een uploadoptie faalde niet bij een
partiële filelijst, en joboutput-/gatevolgorde-/permissiontests waren aanvankelijk
te tekstueel. De duurzame les is daarom: parseer alle actionvormen, assert gates
tegen de uploadindex, controleer candidate-bestanden direct vóór upload en
assert exacte jobmaps en outputwiring. De workflow behoudt daarnaast bewust de
statische-evidencegrens: lokale contracttests vervangen geen echte Actions-,
OIDC-, attestation- of release-run.

## Closure boundary

Implementatie, onafhankelijke review en actuele Node-24-gate zijn groen. De
status blijft `active` en er is niets gecommit of gepusht, conform de ticket-
non-goal en de expliciete grens dat een commit/push pas na afzonderlijke
autorisatie wordt uitgevoerd.
