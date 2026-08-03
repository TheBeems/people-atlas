Status: done
Created: 2026-08-03
Updated: 2026-08-03

# Plan — persoonsdossiers als Second Brain-opslag

## Objective

Lever de geratificeerde brekende fresh-vault-structuur voor People Atlas:
leesbare persoonsdossiers onder één People-root, centrale relaties en
contactmomenten, en dossierlokale fotoselectie zonder binary assetmanagement.

Dit is een parent plan, geen uitvoerbaar ticket.

## Delivery order

```text
1. person-dossier-layout
   └─> 2. dossier-local-photo-picker
```

1. **`2026-08-03-person-dossier-layout.md`** introduceert de enkele People-root
   instelling, centrale afgeleide paths, dossiercreatie, renamebehoud en de
   brekende fresh-settingsgrens.
2. **`2026-08-03-dossier-local-photo-picker.md`** beperkt de bestaande
   vault-picker tot het bestaande persoonsdossier en houdt de eerste-foto
   tweestapsflow expliciet.

De volgorde voorkomt dat de fotokiezer een dossier moet raden of een binary
moet verplaatsen voordat de dossieridentiteit bestaat.

## Parent acceptance criteria

- [x] Elk child-ticket heeft actuele uitvoerdersevidence, een onafhankelijke
      review en een pass-verdict.
- [x] Het eindresultaat voldoet aan
      `.10x/specs/person-dossier-storage.md` zonder migration,
      backward-compatibilitypad of asset-copy/move.
- [x] Relaties en contactmomenten blijven één canonieke centrale note per
      entiteit.
- [x] Geen child verandert buiten zijn vastgelegde scope zonder afzonderlijke
      autorisatie.

## References

- `.10x/specs/person-dossier-storage.md`
- `.10x/decisions/person-dossier-storage-layout.md`
- `.10x/research/2026-08-03-person-dossier-storage-discovery.md`

## Assumptions

- User-ratified 2026-08-03: één vault, dossiers, centrale relaties/contact-
  momenten, geen backward compatibility/migratie en KISS/DRY.
- User-ratified 2026-08-03: leesbare `<naam-slug>--<korte-id>` dossiernaam;
  eerste foto handmatig na dossier-Save; geen asset-copy/move.

## Blockers

None. Both child tickets are done with independent PASS verdicts.

## Journal

- 2026-08-03: alleen shaping. Geen productcode, test/build, vaultcontent,
  commit, push of release uitgevoerd.
- 2026-08-03: `person-dossier-layout` is `done` na de vierde onafhankelijke
  read-only rereview PASS; `dossier-local-photo-picker` is `done` na de finale
  onafhankelijke read-only rereview PASS zonder findings, met alle drie
  historische photo-findings resolved.
- 2026-08-03: de ene actuele canonieke eindgate is 1018/1018 tests in 69 files
  (858 node, 127 browser, 27 integration, 6 browser-matrix), `main.js`
  355611/409600 bytes, 59 sourcefiles en tweemaal SHA-256
  `e86a5a6715868e4450f8038aa29bbf96a6ffcd71290000040f9aecd81393c3d0`.
  Beide children behouden de geratificeerde fresh-vaultgrens zonder migration of
  backward-compatibilitypad; de photoslice voegt geen asset-copy/move of andere
  binary assetmutatie toe. Alle vier parentcriteria zijn vervuld en dit
  niet-uitvoerbare parentplan is gesloten als `done`.
