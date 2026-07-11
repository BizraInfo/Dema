# Receipt: DEMA-SKILLOPT-EDIT-LEDGER-PREVIEW-1A

Truth label: `DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_ONLY`

## Slice

PREVIEW_ONLY ledger recording SkillOpt-style skill-document edit-optimization attempts; fail-closed on authority expansion.

```text
plan → build → verify → tamper-reject
```

Motivation only: arXiv:2605.23904 *SkillOpt: Executive Strategy for Self-Evolving
Agent Skills* (a text-space optimizer — bounded add/delete/replace edits to one
skill document, accepted only on strict held-out improvement). This slice runs **no**
optimizer; it only records an edit *attempt* as a content-addressed receipt. It is
distinct from `agent-skill-ledger.js` (AGENT-SKILL-1A = agent XP progression).

Core law: **skills may improve; authority may not self-expand.**

## Proof Contract

The default gate passes only while every one holds (17 tests + review gate):

- the exact GO phrase matches byte-for-byte;
- the entry positively validates (skill id/version, `sha256:`-form base/candidate
  hashes, `edit_type ∈ {add,delete,replace}`, non-negative `edit_budget`, string-array
  refs, finite scores, boolean `accepted`);
- **fail-closed constitutional invariants:** rejects `authority_delta != 0`, a changed
  `boundary_unchanged` / `consent_unchanged` / `current_limits_unchanged`, an `accepted`
  edit with no cited held-out validation refs, or a rejected edit with no reason;
- the canonical payload is content-addressed (`content_hash` == `receipt_hash`, derived,
  never caller-supplied);
- `verify` re-derives the hash over the body minus its hash fields **and** re-runs the
  entry invariants, so a self-consistent-but-illegal receipt (e.g. `authority_delta > 0`
  with a recomputed hash) still fails; `run()` self-probes a forged `authority_delta`;
- the boundary stays all-false (no execution authority).

## Does NOT prove

- Does not run the SkillOpt optimizer, invoke a model, generate or apply a skill edit,
  or promote any skill.
- Does **not** enforce strict held-out score improvement (`score_after > score_before`).
  It records `score_before`/`score_after` as evidence; enforcing the acceptance rule
  needs an **independent** held-out anchor (a signature or externally measured state
  hash) — a documented future invariant.
- Not launder-proof against a forge-that-stays-legal-and-recomputes-the-hash of a
  *benign* field; internal consistency alone cannot catch that (same limit the test
  notes). It only guarantees rejection when the forged field breaks an invariant.
- No execution, daemon, network, token, wallet, or federation; boundary all-false,
  `authority_delta` 0.

`npm run check` runs `dema-skillopt-edit-ledger-preview-check.mjs`.

## Commands

```bash
node --test tests/dema-skillopt-edit-ledger-preview.test.js
node scripts/review/dema-skillopt-edit-ledger-preview-check.mjs --json
npm run check
```
