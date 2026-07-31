# Changelog

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
