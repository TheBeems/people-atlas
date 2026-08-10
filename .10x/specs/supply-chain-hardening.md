Status: active
Created: 2026-08-10
Updated: 2026-08-10

# Supply-chain hardening for CI and releases

Deze spec is een gerichte uitbreiding van
`.10x/specs/reproducible-obsidian-release.md`. Zij voegt alleen de
least-privilege-, provenance- en toolchain-uitlijning toe die hieronder staat.
De bestaande releasecontracten voor Node 24, `npm ci`, audit, tests, build,
reproducibility, exacte metadata, channelkeuze, remote-tagcontrole, attestatie
en de drie release-assets blijven volledig actief en worden niet versoepeld.

## Doel en scope

People Atlas heeft geen reguliere runtimepackages; externe packages blijven
ontwikkel- en buildtools. Deze spec verhardt de trust boundary van de twee
GitHub Actions-workflows zonder productruntime, vaultgedrag of releasecopy te
wijzigen:

- de gewone CI-workflow krijgt expliciete read-only repositoryrechten;
- de releaseworkflow splitst build/verificatie van publicatie;
- alleen de publicatiejob krijgt de irreversibele schrijf-, OIDC- en
  attestationrechten;
- artifacts gaan uitsluitend na alle gecontroleerde buildgates van de buildjob
  naar de publicatiejob;
- iedere gebruikte GitHub Action wordt op een volledige commit-SHA vastgezet;
- checkout laat geen persistente credentials in de runner achter;
- `@types/node` gebruikt dezelfde majorversie als de gedeclareerde Node 24
  runtime.

Dit is hardening en geen incidentmelding: de huidige release wordt hiermee niet
als gecompromitteerd aangemerkt.

## Normatieve contracten

### Toolchain en typegrens

1. `package.json` en `package-lock.json` MUST Node major 24 als project- en
   CI/release-runtime blijven declareren.
2. De directe `devDependency` `@types/node` MUST in zijn semver-declaratie
   major 24 hebben. De lockfile MUST een resolved `@types/node`-versie met
   major 24 bevatten. Een major 26-resolutie is ongeldig, ook wanneer
   TypeScript daardoor toevallig compileert.
3. De wijziging MUST geen production dependency, runtime-import of productcode
   toevoegen.
4. De exacte minor- en patchversie binnen major 24 is een mechanische
   lockfilekeuze; `package-lock.json` blijft de autoritatieve resolved tree en
   `npm ci` blijft de enige CI/release-installatie.

### Gewone CI-workflow

5. `.github/workflows/ci.yml` MUST expliciet `permissions: contents: read`
   instellen. De workflow mag niet op impliciete repositoryrechten vertrouwen.
6. Iedere checkoutstap in CI en release MUST `persist-credentials: false`
   instellen.
7. Alle `uses:`-verwijzingen in beide workflows MUST een volledige, 40 tekens
   lange lowercase commit-SHA gebruiken. Een major-, minor- of branchtag zoals
   `@v7` of `@v4` is ongeldig. Een commentaar mag de bedoelde action-major
   documenteren, maar vervangt de SHA niet.

### Releaseworkflow: buildjob

8. De releaseworkflow MUST een read-only buildjob hebben met exact de nodige
   `contents: read`-toegang. Deze job mag geen `id-token: write` of
   `attestations: write` krijgen.
9. De buildjob MUST checkout, Node 24 configureren, `npm ci` uitvoeren en de
   bestaande dependency-audit-, format/lint/typecheck-, test-, production-
   build-, releasecontract- en reproducibilitygates uitvoeren volgens de
   actieve release-spec. Tag- en channelvalidatie MUST vóór artifact-upload,
   attestatie en publicatie plaatsvinden.
10. De buildjob MUST na succesvolle verificatie precies deze drie gecontroleerde
    releasebestanden uploaden als één release-candidate-artifact:
    `main.js`, `manifest.json` en `styles.css`. Source, tests, sourcemaps,
    `node_modules`, lockfiles en `.10x`-records mogen niet in het artifact
    terechtkomen.
11. Het artifact-uploadmechanisme MUST bij ontbrekende bestanden falen en mag
    geen gedeeltelijke candidate publiceren. De publicatiejob mag alleen het
    benoemde candidate-artifact downloaden.

### Releaseworkflow: publicatiejob

12. De publicatiejob MUST afhankelijk zijn van een geslaagde buildjob en mag
    geen `npm ci`, `npm install`, `npm update`, `npx`, tests, build of andere
    dependency-installatie uitvoeren.
13. Alleen de publicatiejob mag deze drie rechten krijgen:
    `contents: write`, `id-token: write` en `attestations: write`. De workflow
    moet op workflow- of jobniveau overige standaardrechten beperken.
14. De publicatiejob MUST de gecontroleerde drie bestanden downloaden, precies
    die bestanden met `actions/attest` attesteren en uitsluitend die drie
    bestanden publiceren.
15. De publicatiejob MUST de door de buildjob gevalideerde channel/title/
    prerelease-output consumeren en de channel niet opnieuw na attestatie
    interpreteren. De bestaande remote-tag/SHA-guard en `--verify-tag` moeten
    vóór `gh release create` blijven staan.
16. Een mislukte installatie, audit, quality gate, tag/channelvalidatie,
    reproducibility, artifact-upload of artifact-download MUST de
    publicatiejob blokkeren; er mag geen partial release ontstaan.

### Given/When/Then-scenario's

#### Build failure blocks publication

Given `npm ci`, audit, tests, build, releasecontract of reproducibility in de
buildjob faalt

When GitHub Actions de afhankelijkheid tussen de jobs evalueert

Then de publicatiejob wordt niet uitgevoerd en attestatie/publicatie vindt niet
plaats.

#### Only verified release artifacts cross the job boundary

Given de buildjob alle gates succesvol heeft uitgevoerd

When het candidate-artifact wordt geüpload en door de publicatiejob gedownload

Then bevat het artifact exact `main.js`, `manifest.json` en `styles.css`, en
worden geen source-, test-, map- of dependencybestanden geattesteerd of
gepubliceerd.

#### Publication is the only privileged job

Given de workflow wordt op een release-tag gestart

When permissions vóór jobuitvoering worden vastgesteld

Then de buildjob alleen `contents: read` heeft en de publicatiejob als enige
`contents: write`, `id-token: write` en `attestations: write` heeft.

#### Mutable action tags are rejected

Given een workflow een `uses:`-verwijzing met `@v7`, `@v4` of een andere tag
bevat

When de workflow-contracttest draait

Then faalt de test vóór acceptatie van de workflow; alleen volledige commit-
SHA's zijn geldig.

#### Node typings do not outrun the runner

Given `package.json` Node `24.x` declareert

When de package- en lockfile-contracttest de ontwikkeltypes inspecteert

Then is zowel de gedeclareerde als resolved `@types/node` major 24 en wordt
major 26 afgewezen.

## Foutgedrag

- Ontbrekende of bredere permissions mogen niet stilzwijgend worden
  geaccepteerd; de workflow-contracttests en GitHub Actions moeten fail-closed
  reageren.
- Een checkout zonder `persist-credentials: false`, een action-tag zonder
  volledige SHA of een publishjob met npm-installatie is een contractfout.
- De publicatiejob mag niet zelfstandig opnieuw bouwen of dependencies
  installeren om een mislukte buildjob te omzeilen.
- Lokale tests kunnen YAML-structuur en shellbranching controleren, maar vormen
  geen bewijs van een echte GitHub Actions-run, OIDC-uitgifte, attestation,
  remote-tag of GitHub-publicatie. Die grens moet in evidence expliciet blijven.

## Acceptatiecriteria

- [ ] `ci.yml` heeft expliciet `permissions: contents: read`.
- [ ] `release.yml` heeft een read-only buildjob en een afzonderlijke
      publicatiejob; de publicatiejob is afhankelijk van de buildjob.
- [ ] Alleen de publicatiejob heeft `contents: write`, `id-token: write` en
      `attestations: write`; de buildjob heeft geen van die schrijf-/OIDC-
      rechten.
- [ ] Iedere checkout gebruikt `persist-credentials: false`.
- [ ] Iedere `uses:`-verwijzing in CI en release gebruikt een volledige
      40-tekens commit-SHA; de bedoelde action-major staat desgewenst in een
      commentaar.
- [ ] De buildjob voert `npm ci`, dependency-audit, de bestaande tests/build-
      gates en `npm run verify:reproducible` uit vóór upload.
- [ ] Het artifact bevat exact `main.js`, `manifest.json` en `styles.css`;
      upload/download falen bij ontbrekende bestanden en publiceren geen
      aanvullende bestanden.
- [ ] De publicatiejob voert geen `npm ci`, `npm install`, `npm update`, `npx`,
      tests of build uit en attesteert/publiceert uitsluitend de drie
      gedownloade bestanden.
- [ ] `package.json` en `package-lock.json` declareren/resolveren
      `@types/node` op major 24, in lijn met Node `24.x`.
- [ ] Gerichte contracttests falen vóór de reparatie op minstens de huidige
      action-tags, ontbrekende permissions, de monolithische releasejob,
      ontbrekende credentialgrens en de huidige `@types/node` major 26, en zijn
      daarna groen zonder assertions te verzwakken.
- [ ] Een actuele onafhankelijke read-only review geeft `PASS` of documenteert
      uitsluitend expliciet geaccepteerd niet-kritiek residueel risico.
- [ ] De actuele Node-24-gate is groen: format, lint, typecheck, volledige test,
      production build, community check, dependency audit, release contract,
      reproducibility en `git diff --check`.
- [ ] Er zijn geen vaultwrites, externe GitHub-writes, tag/release-publicaties,
      production dependencies of wijzigingen aan productruntime uitgevoerd als
      onderdeel van dit ticket.

## Exclusions

- Geen wijziging aan pluginfeatures, vaultmodel, resource-resolver,
  community-readinessregels of lokale-fotoselectie.
- Geen nieuwe runtime dependency, SBOM-platform, signing-infrastructuur,
  deploymentomgeving, secretrotatie of algemene releaseframeworklaag.
- Geen wijziging aan releaseversies, channelsemantiek, releasecopy, tagbeleid,
  artifactnamen of de bestaande remote-tag/SHA- en `--verify-tag`-rails.
- Geen echte GitHub Actions-run, OIDC-tokenuitgifte, attestationverificatie,
  remote release, tag, push of Obsidian Community-publicatie.
- Geen automatische dependency-upgrades buiten de noodzakelijke major-24
  `@types/node`-uitlijning en de volledige-SHA-pin van reeds gebruikte of voor
  artifacttransport noodzakelijke actions.

## References

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
- `https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication`
- `https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions`
- `https://github.com/actions/checkout`
- `https://github.com/actions/setup-node`
- `https://github.com/actions/upload-artifact`
- `https://github.com/actions/download-artifact`
- `https://github.com/actions/attest`
