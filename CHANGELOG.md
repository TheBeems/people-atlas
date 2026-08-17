# Changelog

## 0.12.4 (Alpha)

- Simplified the primary People Atlas navigation to **Network**, **People**,
  and **Follow-up**.
- Added clearer network scopes and a more accessible people search.
- Reduced permanent graph controls and moved zoom actions behind progressive
  disclosure.
- Made relationship meaning easier to discover through contextual details,
  while keeping the graph visually calm.
- Unified person details across views, prioritized **Log contact**, and made
  latest contact and follow-up information easier to scan.

## 0.12.3 (Alpha)

- Replaced the native relationship picker with an in-plugin picker and hid
  filesystem paths from person mentions.
- Rejected conflicting person references before resolving a canonical person.
- Kept YAML settings property names Unicode-safe and hardened the release
  supply chain.

## 0.12.2 (Alpha)

- Fixed PersonIndex readiness races on mobile and incomplete metadata-cache
  startup, without publishing a partial canonical snapshot.
- Kept My Person candidates discoverable while rejecting duplicate-ID, stale,
  and ordinary-note selections before the settings write.
- Hardened relationship-modal close-generation guards and late async callback
  handling.
- Stabilized the integration/browser test runners and fail-closed release
  channel validation for alpha, beta, RC, and stable channels.
- Improved Dutch/English diagnostics presentation and release-contract
  observability without a fixed bundle-byte limit.

## 0.12.0 (Alpha)

- The **Relationship** section of the relationship editor is now grouped into
  three clear sub-sections: an always-visible **Core** (relationship types,
  both people's roles, and the natural-language role preview) plus two native,
  collapsed-by-default disclosures for the **Simple relationship** shortcut and
  the **Relationship template** machinery. When you edit a relationship whose
  note already carries a template, that template disclosure opens automatically
  so you can see it immediately. All template copy-not-live semantics, the
  write-free-until-Save behavior, focus/scroll/disclosure state and
  accessibility guarantees are unchanged.
- **Breaking:** 0.12.0 continues the fresh-vault-only presentation-first
  dossier boundary without migration or backward compatibility for older
  folder layouts.

## 0.11.0 (Alpha)

- Added a multilingual user interface with **English** and **Dutch (Nederlands)**
  copy. The plugin follows the language Obsidian runs in and presents user-facing
  notices, validations and labels through a typed message catalog.
- Added locale-aware formatting for the visible UI: date, number and plural
  forms follow the active locale without changing the stored canonical values.
- Internal release-contract (0.11.0): the production `main.js` bundle was
  observed at ~417 KB and, at that time, stayed within the then-current
  500,000-byte limit. The current release contract reports observed size
  without enforcing a fixed byte budget.
- **Breaking:** 0.11.0 continues the fresh-vault-only presentation-first dossier
  boundary without migration or backward compatibility for older folder layouts.

## 0.10.0 (Alpha)

- Replaces the assetless 0.9.0 Alpha prerelease; install 0.10.0 instead.
- Added **Add relationship** next to **Edit person** for canonical people in
  Reading View. It revalidates on activation and remains write-free until an
  explicit editor/modal Save.
- The current canonical graph detail sheet continues to provide **Open note**
  for its linked local Markdown note.
- Simplified regular Settings to **People root folder**, **My person**,
  **Relationship templates**, and **Show labels**. Stored technical schema
  settings remain readable but are no longer ordinary editable controls.
- **Breaking:** 0.10.0 continues the fresh-vault-only presentation-first dossier
  boundary without migration or backward compatibility for older folder
  layouts.

## 0.9.0 (Alpha)

- Added presentation-first person dossier folders: a safe readable name by
  default, with a shortest UUID-derived suffix only for canonical-name
  collisions; stable `person_id` values remain canonical.
- **Breaking:** 0.9.0 introduced the fresh-vault-only presentation-first dossier
  boundary without migration or backward compatibility for older folder
  layouts.

## 0.8.0

- Added one configurable People root with derived `Profiles`, `Relationships`,
  and `Contact moments` collections, plus readable person dossiers backed by
  stable UUID identities.
- A person's first Save creates only the dossier and canonical profile note;
  later confirmed profile renames stay inside the same dossier.
- Restricted the Edit-only photo picker to supported images in the current
  canonical dossier and its descendants. Missing, stale, outside, or unsafe
  selections fail closed, and People Atlas does not manage binary assets.
- **Breaking:** plugin data schema 8 intentionally targets fresh configurations
  and vault organization, without migration or backward compatibility for older
  settings or data.

## 0.7.0

- Added native **Edit person** and **Edit relationship** buttons to current,
  unique canonical People Atlas notes in Reading View only.
- Each action reuses the existing path-based editor and revalidates on click, so
  stale, missing, or ambiguous notes cannot open the wrong record or write data.
- Kept the new contextual actions read-only until an explicit Save in an editor,
  and documented this release as alpha software whose fundamental behavior may
  change.

## 0.6.0

- Added the explicit **Partner** simple relationship shortcut, stored as the
  neutral `partner`/`partner` role pair without changing other relationship
  metadata.
- After a successful new parent-child relationship, asks once whether one
  unique active partner is also a parent of the child; review opens the regular
  relationship editor and only its explicit second Save writes anything.
- Kept ambiguous, ended, multiple, stale, and already-existing candidates
  write-free and documented this release as alpha software whose fundamental
  behavior may change.

## 0.5.0

- Reorganized the declarative Settings tab into General, People schema,
  Relationships, Contact moments, and View & Bases without changing saved
  setting keys, defaults, validation, or relationship-template semantics.
- Added an Obsidian-native confirmation dialog before deleting a relationship
  template referenced by relationship notes; copied types and roles remain on
  those notes when deletion is confirmed.
- Made declarative Settings updates await the existing persistence boundary and
  stabilized the canonical multi-project test runner without weakening tests.

## 0.4.0

- Added an explicit Simple relationship selector for Parent, Child and Sibling
  that fills reciprocal neutral endpoint roles without creating or inferring
  graph relationships.
- Added presentation-only mother/father, daughter/son and sister/brother terms
  from each resolved role holder's optional `woman` or `man` gender, with
  neutral fallback for missing, unsupported, ghost or ambiguous people.
- Preserved custom roles, copied relationship-template behavior and explicit
  Save as the only relationship-note write boundary.
- Updated the published plugin author metadata to `TheBeems`.

## 0.3.1

- Raised the development, CI, and release build baseline from Node.js 22 to
  Node.js 24 LTS and upgraded checkout/setup-node workflows to v7.

## 0.3.0

- Replaced directional relationship semantics with stable first/second
  endpoint slots, an optional canonical My person perspective, and explicit
  paired endpoint roles.
- Added direct relationship actions, clearer relationship templates, and
  restructured relationship and person editors.
- Added optional person profile fields, vault image selection, selected-person
  profile photos, and bounded graph avatars with initials fallback.
- Added first-class contact-moment Markdown notes, explicit monotonic
  `last_contact` advancement, selected-person contact history, and a
  privacy-safe Follow-ups view for standalone and Bases.
- Removed settings migrations, path-derived identities, and editor branches
  for historical data shapes; 0.3.0 intentionally targets fresh test vaults.
- Raised the verified uncompressed production-bundle ceiling to 400 KiB after
  the compatibility cleanup reduced `main.js` to about 334 KiB.
- Continued to require Obsidian 1.13.0 or newer.

## 0.2.0

- Added curated person creation and editing for names, aliases, organisations, photos, and validated contact links while preserving unrelated frontmatter.
- Added preflighted, separately confirmed same-folder file renames when a person's name changes.
- Added configurable relationship presets, optional endpoint roles, and explicit role-based relationship labels without inferring identity or kinship.
- Continued to require Obsidian 1.13.0 or newer.

## 0.1.1

- Prepared product documentation, privacy disclosures, metadata, and automated policy checks for Community Plugins review.
- Aligned command labels and production source with Obsidian's plugin guidelines.
- Continued to require Obsidian 1.13.0 or newer.

## 0.1.0

- Requires Obsidian 1.13.0 or newer; Obsidian 1.13 was a Catalyst early-access (beta) release when People Atlas 0.1.0 was published.
- Initial People Atlas architecture scaffold.
- Standalone and Bases graph views.
- Declarative Obsidian 1.13 settings.
- Incremental person and relationship index.
- Deterministic canvas layout and diagnostics.
