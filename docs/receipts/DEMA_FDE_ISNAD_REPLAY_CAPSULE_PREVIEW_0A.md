# Receipt: DEMA-FDE-ISNAD-REPLAY-CAPSULE-PREVIEW-0A

Truth label: `DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_ONLY`

## Slice

PREVIEW_ONLY content-addressed capsule that preserves WHY a mission stopped and
WHERE each claim came from — not only WHAT happened — and replays that verdict from
the capsule ALONE, without the model. It composes four already-shipped pieces:

- **(a) evidence references** — hashes only, never raw text;
- **(b) an Isnād lineage** for each claim (`origin → first_appearance →
  author_or_model → transformation → evidence → counterevidence → verifier → status`);
- **(c) an FDE failure diagnosis** — the `dema-fde-dual-diagnostic.js` vocabulary,
  mirrored, not reinvented;
- **(d) a routing decision** ("Doxology route") DERIVED from the diagnosis,

all under **authority-monotonicity**: a failure may never increase authority.

```text
build (content-addressed capsule) → verify (fail-closed) → replay (model-free) → forged-route self-check
```

Core law: **the routing is a pure function of the diagnosis + evidence, and the
verdict replays from the capsule alone — the mission survives the model.**

## Routing map (pure, DERIVED from the diagnosis)

```text
boundary_violation                                   → stop   (HIGHEST precedence — wins over any other class)
(no lineage evidence step)                           → insufficient_evidence_stop
implementation_defect | test_drift                   → patch_proposal
proof_gap | doc_drift                                → proof_repair_proposal
environment_gap | dependency_gap | permission_gap    → operator_or_environment_repair  (outward — NEVER a code patch)
github_actions_billing_lock                          → operator_or_environment_repair  (outward vendor failure)
unknown | any unmapped class                         → insufficient_evidence_stop      (fail closed)
```

## Proof Contract

The default gate passes only while every one holds (20 kernel tests + review gate):

- `buildCapsule` emits a content-addressed capsule over the whitelisted body fields;
  `source_lineage_hash`, `diagnosis_hash`, `route_hash`, and `capsule_hash` are
  DERIVED; the `route` is DERIVED from the diagnosis + evidence (a caller-supplied
  route is ignored); identical input yields a deep-equal capsule and identical hash;
- **fail-closed** `verifyCapsule({capsule})` returns `accepted:false` / verdict
  `BLOCK` for each of: a changed source `ref_hash` (`source_lineage_hash` no longer
  re-derives); no lineage step with `role="evidence"` (`missing_evidence`) — which
  also forces the route to `insufficient_evidence_stop`; an `implementation_defect`
  with no evidence step (a code defect needs code evidence → `missing_evidence`,
  route `insufficient_evidence_stop`, never `patch_proposal`); a forged route (`route
  != deriveCapsuleRoute(diagnosis, hasEvidence)`) even with recomputed sub-hashes; any
  body field mutated after the `capsule_hash` was sealed (`capsule_hash_mismatch`); an
  `authority_delta != 0`; and any `execution_allowed`/`mint_allowed` set true;
- **outward** classes (`environment_gap` / `dependency_gap` / `permission_gap`) route
  to `operator_or_environment_repair` and NEVER to `patch_proposal`;
- `boundary_violation` has HIGHEST precedence → `route == stop`, winning over any
  other class;
- `buildCapsule` REJECTS at construction (throws) an input `authority_delta > 0`, or
  an input `execution_allowed:true` / `mint_allowed:true` — a failure may never
  increase authority or unlock execution/mint;
- **`replayCapsule(capsule)`** re-derives the route + verdict from the capsule body
  ALONE (no model, no external input) and sets `replay_exact = (re-derived ==
  stored)`; a well-formed capsule replays `replay_exact:true`, a forged/tampered
  capsule replays `replay_exact:false`;
- the capsule carries only hashes + enum labels — no raw evidence text, no private
  key — and smuggled input fields (`private_key`, `raw_text`, extra step keys) are
  dropped by the field whitelist;
- every verify verdict carries `authority_delta: 0` and the canonical all-false
  boundary (deep-equal against `buildPreviewBoundary()`, not a vacuous `.every`).

## Does NOT prove

- Does not prove a **live FDE runtime**, a **live mission**, or **live governance**:
  the capsule is a preview record, not an executor.
- Does not prove **verified impact**, **autopatch**, or **live remediation** — no
  code is patched, committed, pushed, merged, or executed.
- Does not run an optimizer, invoke a model, open a network, mint a token, start a
  daemon, or bind identity; boundary all-false, `authority_delta` 0,
  `execution_allowed` and `mint_allowed` false.
- The capsule is **content-addressed, not Ed25519-signed** — signing is a separate,
  already-shipped surface (`NODE0-RECEIPT-SIGNING-ED25519-1A`).

`npm run check` runs `fde-isnad-replay-capsule-preview-check.mjs`.

## Commands

```bash
node --test tests/fde-isnad-replay-capsule-preview.test.js
node scripts/review/fde-isnad-replay-capsule-preview-check.mjs --json
npm run check
```
