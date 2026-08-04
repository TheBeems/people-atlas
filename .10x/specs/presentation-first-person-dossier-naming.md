Status: active
Created: 2026-08-03
Updated: 2026-08-03
Supersedes-Part-Of: `.10x/specs/person-dossier-storage.md` dossiernaam-, collision-, ownership- en fresh-vaultclauses

# Presentation-first persoonsdossiernamen

## Purpose

Nieuwe People Atlas-dossiers tonen standaard alleen een veilige menselijke naam.
Een korte UUID-afgeleide suffix verschijnt uitsluitend wanneer de gewone
naamnamespace al door een andere canonieke persoon wordt bezet. De volledige
`person_id` blijft altijd de enige identiteit en iedere vaultwrite blijft
expliciet, reviewbaar en fail-closed.

## Ratified contract

### Canonical identity and folder label

- Iedere person-create MUST vóór enige write één geldige volledige UUID-backed
  `person_id` reserveren en in het canonieke profiel-frontmatter schrijven.
- Een dossiermap of korte suffix MUST NOT als persoonsidentiteit worden gebruikt.
- De gewone dossierlabel MUST de getrimde displaynaam via dezelfde veilige
  karakter- en whitespacegrens als een canonieke profielnotitienaam behouden,
  inclusief veilige Unicode, case en interne spaties.
- Een aparte canonical collision key MUST Unicode/diakritische equivalentie,
  separators, whitespace en case conservatief normaliseren. Twee labels die op
  een ondersteund case-insensitive filesystem kunnen botsen MUST dezelfde
  namespace delen.

### Unsuffixed first destination

Voor een geldige naam en ID MUST de eerste vrije, ondubbelzinnige bestemming zijn:

```text
<root>/Profiles/<veilige-weergavenaam>/<veilige-weergavenaam>.md
```

De create-preview MUST dit exacte pad tonen. De mutation boundary MUST dezelfde
planner opnieuw gebruiken tegen actuele index- en vaultstate. Als de actuele
bestemming afwijkt van `reviewedPath`, MUST de create vóór iedere write stoppen
en herbeoordeling vragen.

### Collision-only adaptive suffix

Wanneer en alleen wanneer de gewone naamnamespace aantoonbaar door precies één
andere canonieke persoon wordt bezet, MUST de nieuwe dossierlabel worden:

```text
<veilige-weergavenaam> · <Base32-prefix>
```

- De prefix MUST afkomstig zijn uit de 16 geparseerde UUID-bytes, MSB-first als
  een paddingloze byte-stream met alphabet
  `0123456789ABCDEFGHJKMNPQRSTVWXYZ`.
- De eerste poging MUST exact de eerste twee tekens gebruiken.
- Als die exacte kandidaat bezet is, MUST de planner één volgend teken toevoegen
  en opnieuw controleren totdat een vrije bestemming bestaat.
- Een bestaande persoon of map MUST nooit worden hernoemd, uitgebreid, ingekort,
  overgenomen of verwijderd om ruimte voor de nieuwe kandidaat te maken.
- Bij een uitgeputte of ongeldige ID/candidate-reeks MUST create zichtbaar en
  zonder writes falen.

### Ambiguity and races

- Een gewone bestemming met vrije gebruikersinhoud, geen canoniek profiel,
  meerdere canonieke profielen, een ongeldige/ambigue `person_id`, of een
  portability-onveilige representatie MUST de create blokkeren; dit is geen
  geautoriseerde persoonscollision.
- Een bezette suffixed candidate MUST worden overgeslagen door prefixuitbreiding,
  maar nooit worden geadopteerd.
- Een tussen preview/preflight en foldercreate gewijzigde destination, identity,
  People-root of ownership MUST fail-closed stoppen.
- Alleen een door de lopende transactie aangemaakte, nog lege dossiermap MAY na
  een profielwritefailure worden opgeruimd. Externe of niet-lege inhoud MUST
  blijven bestaan.

### Rename, deletion and stable paths

- Een profielrename MUST alleen de profielnotitie binnen haar bestaande parent
  hernoemen na de bestaande expliciete confirmation.
- Een dossiermap MUST niet automatisch met de displaynaam meeverhuizen.
- Het verdwijnen van een naamgenoot MUST geen suffix verwijderen of een ander
  dossier promoveren.
- Een later toegevoegde collision MUST bestaande suffixlengtes en paden niet
  veranderen.

### Dossier and photo ownership

- Een bestaand dossier MUST alleen als current-person boundary gelden wanneer de
  actuele canonieke index de volledige verwachte `person_id` uniek naar exact de
  profielnotitie in dat dossier resolveert.
- De dossierboundary MUST uit de veilige parent van dat geverifieerde profielpad
  worden afgeleid; basename- of displaynaamguessing is verboden.
- Voor een suffixed nieuwe-grammarfolder MUST de suffix exact een prefix van de
  canonieke Base32-code van de volledige verwachte UUID zijn, met minimaal twee
  tekens.
- Een plain folder heeft geen path-ID; haar ownership MUST uitsluitend door het
  unieke canonieke profiel en de volledige ID worden bewezen.
- Fotoqueries en fotosaves MUST alleen ondersteunde assets onder exact die
  geverifieerde parent of descendants accepteren. Sibling-, prefix-lookalike-,
  missing-, stale-, legacy-, ambiguous- en unsafe paden MUST niets schrijven.

### Fresh-vault boundary

- Het contract MUST geen migratie, rename, dual parser of compatibiliteitsfallback
  voor 0.8-dossiers als `<naam-slug>--<acht-hextekens>` toevoegen.
- Legacy-dossiers MUST niet door de nieuwe dossierauthority als geldige nieuwe
  grammar worden geïnterpreteerd.
- Relatie-, contactmoment-, settings-, binary-lifecycle- en algemene
  persoonsidentiteitssemantiek buiten deze naming/ownershipgrens blijven
  ongewijzigd.

## Scenarios

### First person with a name

Given `People/Profiles/Jan Jansen` is vrij en ondubbelzinnig
When de gebruiker één nieuwe Jan Jansen reviewt en expliciet opslaat
Then ontstaat alleen `People/Profiles/Jan Jansen/Jan Jansen.md`
And bevat het profiel de volledige gereserveerde `person_id`
And is geen suffix zichtbaar.

### Second person with the same canonical name

Given de gewone Jan Jansen-bestemming behoort aan een andere canonieke persoon
When een nieuwe Jan Jansen met Base32-code `7K3…` wordt gereviewd en opgeslagen
Then ontstaat alleen `People/Profiles/Jan Jansen · 7K/Jan Jansen.md`
And blijft het eerste dossier byte- en path-exact ongewijzigd.

### Prefix collision extends only the newcomer

Given zowel de gewone bestemming als `Jan Jansen · 7K` bezet zijn
When de nieuwe UUID-code met `7K3…` begint
Then gebruikt de preview `Jan Jansen · 7K3`
And verandert geen bestaande map.

### Ambiguous ordinary folder fails closed

Given de gewone bestemming bevat vrije inhoud maar geen unieke canonieke persoon
When een nieuwe persoon met die naam wordt opgeslagen
Then meldt People Atlas de ambigue destination
And maakt, adopteert, hernoemt of verwijdert het geen map of note.

### Collision appears after review

Given de gebruiker een suffixloos profielpad heeft gereviewd
And een andere canonieke persoon bezet die namespace vóór Save
When Save de actuele bestemming herberekent
Then faalt de create als reviewed-path-change zonder writes
And moet de gebruiker de nieuwe suffixed bestemming eerst zien.

### Rename and deletion never rewrite the folder

Given een persoon in een plain of suffixed dossier
When haar profielnaam verandert of een eerdere naamgenoot verdwijnt
Then verandert alleen de bevestigde profielnotitienaam
And blijft de dossiermap exact gelijk.

### Photo ownership uses full identity

Given een plain dossier, een suffixed dossier, een sibling en een legacy 0.8-map
When de photo picker of mutation boundary assets voor één persoon beoordeelt
Then accepteert zij alleen assets onder de parent van het uniek door volledige ID
geverifieerde canonieke profiel
And falen sibling-, legacy-, stale- en geïnjecteerde paden gesloten.

## Acceptance criteria

- [ ] Eén pure path/candidate-module bewaakt veilige displaylabels,
      collisionkeys, UUID-byte parsing, canonieke Base32 en adaptieve prefixes.
- [ ] Preview en mutation boundary gebruiken dezelfde planner en een actuele
      ownership/occupancybron; een TOCTOU-wijziging veroorzaakt nul writes.
- [ ] Nieuwe unieke namen krijgen geen suffix; canonieke naamcollisions beginnen
      met twee Base32-tekens en verlengen alleen de nieuwe kandidaat.
- [ ] Ambigue/user-owned folders blokkeren; transaction-owned cleanup behoudt
      bestaande externe en niet-lege inhoud.
- [ ] Rename/delete veranderen nooit een dossiernaam of bestaande suffix.
- [ ] Dossier- en fotoauthority verifiëren volledige canonieke identiteit en
      exacte parentlocaliteit voor plain en suffixed nieuwe-grammarfolders.
- [ ] 0.8-dossiers krijgen geen migration, compatibility of dual-parserpad.
- [ ] Pure, mutation-, form-, browser- en gecontroleerde integratietests bewijzen
      de ratified scenarios en de bestaande veiligheidsgrenzen.
- [ ] Gerichte RED→GREEN-evidence, onafhankelijke review, één volledige Node-24
      gate, build, reproduceerbaarheid en whitespace/scopechecks zijn groen.

## Non-goals

- Migratie of ondersteuning van bestaande 0.8-dossiers.
- Een centrale UUID-padregistry, oplopende teller of hidden metadatafile.
- Automatische folderrename, suffixpromotion of cleanup na verwijderen.
- Verandering van relationship-, contactmoment-, settings- of binary lifecycle.
- Commit, push, versiebump, tag of release.

## References

- `.10x/decisions/presentation-first-person-dossier-naming.md`
- `.10x/specs/person-dossier-storage.md`
- `.10x/tickets/2026-08-03-presentation-first-dossier-naming.md`
- `src/domain/people-paths.ts`
- `src/editor/person-form.ts`
- `src/editor/person-modal.ts`
- `src/mutations/atlas-mutation-service.ts`
