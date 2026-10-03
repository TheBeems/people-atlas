Status: active
Created: 2026-10-03
Updated: 2026-10-03

# Reviewable diagnostics, note adoption and settings upgrades

## Authority

User-authorized implementation of the preceding analysis. This extends the
alpha-only no-upgrade boundary solely with explicit reviewed settings recovery;
it never authorizes automatic migrations, note moves or real-vault operations.

## Diagnostic and adoption behavior

- Provide an accessible complete diagnostic list with text/severity/code filters,
  source opening and explicit repair entrypoints. Remove the unexpandable 20-item
  boundary. Bases may expose only diagnostics permitted by its filtered context.
- Missing person IDs on otherwise eligible classified person notes MAY be repaired
  through a preview showing exact note paths and proposed new unique IDs.
- An adoption/start dialog MUST let users explicitly choose existing Markdown
  person notes and review classification, IDs and configured property mappings.
  Adoption changes only the reviewed classification and ID at the exact existing
  path: classified people are already indexed vault-wide, so a loose existing
  Markdown note MUST NOT require a dossier or a move merely to adopt it. Preserve
  a valid unique authored ID; generate a UUID-backed ID only when an ID is needed.
  Keep the People root/dossier contract for new dossier creation and operations
  that require dossier ownership, such as photos or renames. Explain unsupported
  operations and conflicting classifications before writing. Never identify or
  merge people by display name.
- The preview MUST show each property change and preserve body/unrelated fields.
  Opening, filtering, selecting, cancelling and index inspection write nothing.
  Confirmation MUST apply the immutable reviewed changes; mutated or substituted
  preview fields require a new review and cannot be written.
- Before confirmation and inside processFrontMatter, revalidate exact current
  path/classification/owned data baseline, mapping and ID uniqueness. A drifted or
  ambiguous source is skipped with an actionable error, never overwritten.
- Duplicate ID repair is an explicit choice of exactly one note to receive a new
  ID with a preview. MUST disclose that ID-based references are not automatically
  retargeted. Do not silently merge, delete or bulk rewrite references.
- Unresolved relationships reuse the existing ambiguity-safe editor. A missing
  ID must not prevent a targeted reviewed ID repair from becoming available.
- Sequential batch application MUST report success/skips/failure per exact path;
  partial success must not be labelled atomic. Retrying completed rows does not
  generate a new identity or rewrite notes again. No binary assets are managed.

## Settings upgrade behavior

- Current configurations remain valid and new optional settings get defaults.
- Offer a reviewed recovery path for known older schemas, preserving supported
  common values and keeping an exact local original backup. Use the smallest safe
  supported schema set from inspected historical contracts; unsupported future or
  malformed data remains read-only and byte-preserved.
- The preview MUST show retained/reset/unsupported setting keys, the target root,
  and explain that settings recovery does not migrate historical note layouts.
  Removed folder keys cannot silently choose a different root. If root semantics
  are ambiguous, require an explicit valid root choice within the UI.
- Save only after explicit confirmation using existing plugin data persistence.
  Failed saves leave original data/settings usable for recovery. Backup and
  recovery status must survive later ordinary settings saves. No startup writes.
- Exact original text cannot be reconstructed from parsed loadData() output.
  Permit one narrowly scoped public DataAdapter.read call in
  src/settings/plugin-data-source.ts for the host's configDir plus the fixed
  plugins/people-atlas/data.json path, invoked only by explicit recovery preview
  and confirmed-source revalidation. No caller-controlled path or plugin ID is
  accepted, and no adapter writes/list/delete/other methods are permitted. Normal
  startup and all settings persistence continue using loadData()/saveData().
  This supersedes scripts/community-readiness.mjs's blanket direct-adapter ban
  only for that exact read expression in that exact helper. The scanner MUST
  continue rejecting all other paths/methods/files, with negative regressions;
  aliases or disguised access are not an acceptable policy workaround.
- Tests MUST cover current/known-old/future/malformed schemas, preserved values,
  cancel/save errors and no note mutations during settings upgrade.

## Exclusions

CSV/vCard import was explicitly a possible later addition, not this slice.
No automatic renames/moves/deletes, inferred people, real-vault writes, telemetry,
new dependencies, publication or installation.

## References

- .10x/specs/person-dossier-storage.md
- .10x/specs/presentation-first-person-dossier-naming.md
- .10x/specs/safe-mutations-and-versioned-data.md
- .10x/specs/person-reference-resolution.md
- .10x/specs/relationship-edit-source-safety.md
