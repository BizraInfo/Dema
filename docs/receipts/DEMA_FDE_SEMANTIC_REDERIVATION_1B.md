# Receipt: DEMA-FDE-SEMANTIC-REDERIVATION-1B

Truth label: `PREVIEW_ONLY` (security hardening of DEMA-FDE-DUAL-DIAGNOSTIC-1A)

## Defect (reproduced before fix, on main @ 725f919)

`verifyDemaFdeDualDiagnostic` validated schema, field domains, boundary, and
the body's own `diagnostic_hash` — i.e. **internal consistency**. It did not
re-derive the classification from the report's carried input. So a forger
could flip `failure_class` to `github_actions_billing_lock`, adjust the
rule-consistent dependent fields, **recompute** the hash, and the report
verified `ok: true`. The `node0-ci-vendor-availability` consumer (which
correctly routes through `verify`) then honored it and set
`local_proof_lane: true` — promoting L0 content-addressed evidence to
authority. Independently: generic "billing issue" prose with no GitHub context
also classified as `github_actions_billing_lock`, a second way to manufacture
the lane. Both reproduced by direct probe.

## Fix

Two changes, both reusing existing code (no new logic):

1. **`verify` re-derives from input.** After the internal-hash check,
   re-run `buildDemaFdeDualDiagnosticInternal(report.input)` and require its
   `diagnostic_hash` to equal the report's. Because the whole diagnosis is a
   pure function of the normalized input (round-trip verified, `normalizeInput`
   idempotent), any body that diverges from its own input's derivation is
   rejected: `semantic_rederivation_mismatch`. A report with no input to
   re-derive from fails closed: `input_missing_for_rederivation`.
   *"verify must be input-bound"* — the layer above body-bound.
2. **`github_actions_billing_lock` requires GitHub context.** Deleted the
   context-free fallback so billing markers alone no longer assert the
   provider-specific class; genuine GitHub context (`ci_provider` or a
   `gh`/GitHub-Actions command) is required, matching the doctrine that the
   local proof lane opens only when *remote GitHub CI* is billing-locked.

## Proof

```bash
node --test tests/dema-fde-dual-diagnostic.test.js        # 34 tests (7 new: forge, no-input, e2e lane, over-trigger, regression, per-field adversarial matrix, cross-class acceptance)
node scripts/review/dema-fde-dual-diagnostic-check.mjs --json
node --test tests/node0-ci-vendor-availability.test.js    # consumer unbroken
npm test && npm run check
```

## What this proves

The proof is now truer than the claim it carries: a diagnosis is accepted only
if it equals what its own input derives, and the local proof lane cannot be
opened by a forged label or by generic (non-GitHub) billing prose.

## What this does not prove

- Does NOT verify input **provenance**: an attacker who supplies a
  self-consistent input that genuinely derives to billing-lock still produces a
  verifiable report. Trusting the input source is the consumer's signing /
  `operator_declared` concern — a separate follow-on, not this slice.
- No new capability row (this hardens an existing kernel); no patch, commit,
  push, merge, daemon, network, token, mint, or wallet. Boundary all-false.
