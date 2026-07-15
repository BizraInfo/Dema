# NODE0-FOUNDER-IMPACT-LOOP-0A — Technical Spec

**Truth label:** `NODE0_FOUNDER_IMPACT_CANDIDATE_LOCAL_ONLY`
**Status:** design/scoping — implementation gated on a separate build GO.
**ADR:** [ADR-044](../06-adr/ADR-044-node0-founder-impact-loop-0a.md)

Shape follows repo law: **pure kernel → read-only gatherer → CLI wrapper → tests (red first)**, plus the four wiring points.

---

## 1. Modules

| File | Layer | Role | Purity |
|---|---|---|---|
| `packages/core/src/node0-founder-impact-loop-preview.js` | **pure kernel** | `buildFounderImpactReceipt(input)` composes the candidate receipt envelope; `verifyFounderImpactReceipt(receipt)` re-derives it whole-body and asserts the authority-monotonicity invariant. No fs/net/clock/random. | pure |
| `packages/core/src/node0-founder-impact-digest.js` | **pure kernel** | `buildFounderImpactDigest(sanitizedDocs)` → OKF-conformant bundle (every concept has `type` + parseable frontmatter) with BIZRA proof-extension keys; deterministic; content-addressed. | pure |
| `packages/core/src/node0-founder-impact-gather.js` | **gatherer** | reads the **declared bounded** source set (injected `fs`), returns raw docs for sanitize; localhost/local-fs only; no network. | fs-injected |
| CLI dispatch (in `bin/dema` command tree) | **wrapper** | `dema founder impact scope` / `dema founder impact run` | thin |

Reuses (does **not** rebuild): `untrusted-corpus-sanitizer-preview.js` (#349), `public-metric-claim-gate-preview.js` (#350), `node0-materialization-pulse-e2e-preview.js` (#355) spine, `dema-fde-dual-diagnostic.js` (classifier), `receipts/src/canonical-receipt.js`.

## 2. CLI (ADR-012: space-subcommand, no new kebab)

```bash
dema founder impact scope <manifest.json> [--json]      # dry-run: shows bounded set, sanitizer preview, plan. No write.
dema founder impact run <manifest.json> --consent "GO: dema founder impact loop 0a" [--json]
                                                        # sanitize → digest → claim-gate → candidate receipt
dema founder impact verify <receipt.json> [--json]      # re-derive + invariant check
```

`manifest.json` = operator-declared bounded source set: `{ "sources": ["path", …], "served_to": "founder", "consent": "GO: dema founder impact loop 0a" }`. Exact-string consent (FATE); missing/mismatch → STOP.

## 3. Schemas

- `bizra.dema.founder_impact_receipt.v0.1` — `{ schema, truth_label, impact_class:"candidate", served_to:"founder", source_set:[{path,sha256}], artifact:{sha256,okf_version}, sanitizer_verdict, claim_gate_verdict, fde_classification|null, mint_allowed:false, what_this_proves, what_this_does_not_prove, boundary:{…16 keys…} }`
- `bizra.dema.founder_impact_digest.v0.1` — OKF-conformant bundle: each concept `{type (required), title, description, source_sha256, evidence, truth_label}` + markdown body with `# Citations`. Plain OKF readers ignore the BIZRA extension keys (OKF §4.1); BIZRA readers get provenance.

## 4. Test plan — red-first (`tests/node0-founder-impact-loop.test.js`, `tests/node0-founder-impact-digest.test.js`)

```
RED-01 run without exact consent GO phrase → refuses (no artifact, no receipt)
RED-02 receipt binds source-set sha256, NOT raw corpus bytes (raw_data_included:false)
RED-03 impact_class === "candidate" AND mint_allowed === false (never mint)
RED-04 sanitizer BLOCKED source → loop aborts before digest (composes #349)
RED-05 claim-gate reject → receipt NOT emitted (composes #350)
RED-06 boundary: model_invocation_performed / external_call_performed / receipt_mint_performed / federation_invoked all false
RED-07 boundary: content_read true + filesystem_write_performed true (honest, consented)
RED-08 FDE classifies missing-Ollama as OUTWARD (environment prerequisite), NOT code failure (uses shipped FDE)
RED-09 verify re-derives receipt from artifact + source hashes and binds `fde_summary` to the embedded report (whole-body, not subset)
RED-10 tampered artifact hash → verify fails closed
RED-11 digest is OKF-conformant: every concept has non-empty `type` + parseable frontmatter
RED-12 served_to === "founder"; no second recipient in 0A
RED-13 INVARIANT: no code path lets an FDE classification flip mint_allowed/continue_allowed/scope false→true
```

## 5. FDE classification matrix (blockers)

| Blocker | FDE lens | Allowed action | Hard rule |
|---|---|---|---|
| Ollama not serving (future 0B model step) | **Outward** | stop · diagnose · operator runs `ollama serve` | do NOT call it a code failure |
| Sanitizer BLOCKED / QUARANTINED content | Inward (proof/consent) | abort loop, no artifact | do not bypass sanitizer |
| Consent GO phrase missing/mismatch | Boundary | STOP | no action |
| Claim-gate reject | Inward (proof) | do not emit receipt; repair claim | do not hide failure |
| Artifact hash mismatch on verify | Inward (code) | patch / re-derive | do not weaken verify |
| CI gate unavailable | Outward | stop · diagnose | do not mark as code failure |
| Impact simulated | Economy | candidate only | do not mint |

## 6. Registry / CURRENT_LIMITS promotion rules

- `dema-capability-truth-registry.js`: add `NODE0_FOUNDER_IMPACT_LOOP_0A`, truth_label `NODE0_FOUNDER_IMPACT_CANDIDATE_LOCAL_ONLY`; **bump the capability count** in the same edit.
- `docs/CURRENT_LIMITS.md`: new row — LOCAL_ONLY / candidate; `what_this_proves` = "local founder-impact candidate loop"; `what_this_does_not_prove` = "live PoI · verified impact · mint · federation · autonomy · RSI at scale".
- `docs/TESTING.md`: row in the **same commit** (integration-check sees tracked tests only), `[MEASURED]`-labeled per corpus gate.
- Promotion `candidate → verified/MEASURED` requires: an independent impact judge + operator confirmation + same-slice CURRENT_LIMITS update (out of 0A scope).

## 7. Exact file list (implementation — on build GO)

```
docs/06-adr/ADR-044-node0-founder-impact-loop-0a.md        [this scope · done]
docs/specs/NODE0_FOUNDER_IMPACT_LOOP_0A.md                 [this scope · done]
packages/core/src/node0-founder-impact-loop-preview.js     [kernel]
packages/core/src/node0-founder-impact-digest.js           [kernel]
packages/core/src/node0-founder-impact-gather.js           [gatherer]
tests/node0-founder-impact-loop.test.js                    [red-first]
tests/node0-founder-impact-digest.test.js                  [red-first]
scripts/review/node0-founder-impact-loop-check.mjs         [review gate: kernel-purity + no-overclaim + authority-monotonicity invariant]
bin/dema (or apps/cli command tree)                        [CLI wiring: founder impact scope/run/verify]
scripts/check.mjs                                          [wire review gate]     ┐
docs/TESTING.md                                            [test row]            ├ four wiring points
docs/CURRENT_LIMITS.md                                     [honesty row]         │
packages/core/src/dema-capability-truth-registry.js       [register + count++]  ┘
```

## 8. Acceptance gates (verified present on disk)

`npm test` · `npm run coverage` · `npm run check` · `npm run perf` (`scripts/perf-bench.mjs --a-plus`) · `npm run delivery:check` (`scripts/delivery-check.mjs`) · `npm run proof:truth:check` (`scripts/review/node0-proof-of-truth-control-plane-check.mjs`) · `git diff --check`. Run full suite from a `Dema`-basename checkout (proof-room basename gate).

## 9. Target outcome

Dema produces **one useful artifact** (an OKF-conformant, cited digest of a bounded slice of Mohamed's own corpus) and emits **one candidate founder-impact receipt** — served to the founder first, minting nothing, claiming nothing beyond a local candidate loop.
