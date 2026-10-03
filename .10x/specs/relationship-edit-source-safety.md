Status: active
Created: 2026-10-03
Updated: 2026-10-03

# Relationship editor identity and source safety

## Authority and scope

User-approved audit remediation on 2026-10-03 extends the existing safe mutation
and person-reference contracts to relationship editing. This specifically
extends the editor/mutation exclusion of `person-reference-resolution.md`;
its graph/index outcomes and stored schema remain unchanged.

## Contract

- Opening a relationship editor MUST retain its expected source identity,
  classification and relevant owned frontmatter baseline.
- Saving MUST reject a changed source identity, changed classification or
  conflicting source edit before applying any frontmatter change. This MUST be
  checked inside the atomic `processFrontMatter` callback, not only against
  cached metadata. Unrelated frontmatter/body changes MUST remain preserved.
- Direct supported relationship mutation callers MUST also guard the source
  identity/classification observed for the operation against changes at write.
- Errors MUST remain visible and recoverable; reopening the current note is
  a valid recovery. Failed validation MUST produce zero writes.
- Relationship endpoint prefill MUST use the shared reference resolver.
  An ambiguous reference MUST leave the selection empty and require explicit
  canonical person selection before Save. A merely unresolved historical
  reference MUST remain visibly unavailable with its raw reference retained;
  unchanged-endpoint metadata edits remain allowed. Neither case may select a
  competing ID or path candidate through a raw-text fallback. Changing an
  endpoint still requires an explicit canonical person selection.
- Display labels/aliases MUST NOT identify people. Custom property mappings,
  stable IDs, explicit Save, mutation serialization and unrelated field
  preservation MUST remain supported.

## Acceptance scenarios

1. Open R; change relationship ID or type before Save: reject without a write,
   even when the metadata cache already contains the new values.
2. Change source after preflight but before atomic callback: reject unchanged.
3. Change an owned field while editor open: report conflict; do not overwrite.
4. Change only unrelated frontmatter/body: requested edit succeeds preserving it.
5. A.id=Bob, B.path=People/Bob.md, endpoint=[[Bob]] resolved to B: show unresolved
   selection, never prefill A; explicit unambiguous selection allows repair.
6. Unique ID, path and same-person wikilink evidence remain editable.
   Merely unresolved legacy references remain untouched during other metadata
   edits; this remediation does not require migration or repair of those notes.

## Side effects and limits

Only an explicit successful Save updates the reviewed relationship fields.
There are no migrations, automatic repairs, notifications or cross-note writes.
Tests use synthetic notes only.

## References

- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/person-reference-resolution.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
