# ADR-BOUNDARY-VOCAB-UNIFICATION-1A — Boundary vocabulary unification

**Status:** Accepted  
**Slice:** BOUNDARY-VOCAB-UNIFICATION-1A  
**R-04 status:** Undocumented-drift portion closed; 2 synonym pairs documented as aliases; full name reconciliation tracked as `BOUNDARY-SYNONYM-RECONCILE-1A`.

Do **not** read "R-04 closed" as full semantic reconciliation — registered keys and documented aliases only.

## Context

Multiple preview and kernel modules carry `boundary` blocks with effect-class keys. Drift appeared when some modules inlined parallel key lists instead of importing the canonical vocabulary, or used domain-specific keys without ADR documentation.

## Decision

1. **Single canonical source:** `packages/core/src/boundary-schema.js` exports `PREVIEW_BOUNDARY_CANONICAL_KEYS` (frozen, all-false default via `buildPreviewBoundary()`).
2. **`preview-boundary.js` re-exports** the canonical list and adds runtime-emission helpers only — it does not define a parallel key list.
3. **Intentional divergence is permitted** when a module's domain legitimately needs a different key set, provided it:
   - exports a named `*_BOUNDARY_KEYS` frozen array, and
   - appears in `packages/core/src/boundary-vocab-registry.js` with a one-line rationale.
4. **Accidental drift** (duplicating canonical keys inline) must be refactored to import `PREVIEW_BOUNDARY_CANONICAL_KEYS` or `buildPreviewBoundary()`.

This ADR does **not** require all modules to share identical keys — only that divergence is either imported from canonical or documented here.

## Canonical vocabulary (17 keys)

Defined in `boundary-schema.js`:

- `filesystem_write_performed`, `network_used`, `runtime_execution_performed`, `model_loaded`, `model_invocation_performed`, `prompt_executed`, `external_call_performed`, `raw_corpus_scan_performed`, `raw_data_included`, `tool_executed`, `chain_advance_performed`, `receipt_mint_performed`, `federation_invoked`, `node_connection_performed`, `public_network_used`, `consent_collected`, `content_read`

## Synonym pairs (aliases — rename deferred)

Machine-readable map: `BOUNDARY_EFFECT_SYNONYM_ALIASES` in `boundary-vocab-registry.js`.

| Domain key | `alias_of` (canonical) | Notes |
|------------|------------------------|-------|
| `file_write_performed` | `filesystem_write_performed` | Same filesystem-write effect class |
| `network_call_performed` | `network_used` | Same network-use effect class |

**Distinct (not synonyms):**

| Domain key | Related canonical | Rationale |
|------------|-------------------|-----------|
| `private_content_read` | `content_read` | Observe/eval kernels assert private-content non-read; not the governed `content_read` effect |

Full rename across modules: **`BOUNDARY-SYNONYM-RECONCILE-1A`** (separate slice).

## Intentional domain vocabularies

| Module | Export | Keys | Rationale |
|--------|--------|------|-----------|
| `self-awareness-report.js` | `SELF_AWARENESS_BOUNDARY_KEYS` | 14 | Self-knowledge introspection/autonomy terms |
| `rsi-proposal-preview.js` | `RSI_PROPOSAL_BOUNDARY_KEYS` | 14 | RSI self-change and economic activation |
| `self-loop-ooda.js` | `SELF_LOOP_OODA_BOUNDARY_KEYS` | 15 | OODA action_execution and daemon terms |
| `dema-capability-truth-registry.js` | `REGISTRY_BOUNDARY_KEYS` | 10 | Registry-level capability boundary |
| `dema-capability-truth-registry.js` | `ROW_BOUNDARY_KEYS` | 6 | Per-row execution allowance |
| `dema-fde-dual-diagnostic.js` | `FDE_BOUNDARY_KEYS` | 13 | FDE patch/commit/push/merge vocabulary |
| `step7-consent-refusal-preview.js` | `STEP7_CONSENT_BOUNDARY_KEYS` | 12 | Step7 consent ceremony |
| `behavioral-modulation.js` | `BEHAVIORAL_MODULATION_BOUNDARY_KEYS` | 10 | Modulation and hidden-effect boundaries |
| `diffusion-reasoner.js` | `DIFFUSION_REASONER_BOUNDARY_KEYS` | 14 | Denoising kernel + text_generation |
| `hash-table-knowledge-index.js` | `HASH_TABLE_BOUNDARY_KEYS` | 14 | Knowledge index kernel-family |
| `hhmm-state-machine.js` | `HHMM_BOUNDARY_KEYS` | 13 | HHMM lifecycle kernel |
| `model-eval-baseline.js` | `MODEL_EVAL_BASELINE_BOUNDARY_KEYS` | 10 | Local model measurement |
| `model-routing-preview.js` | `MODEL_ROUTING_PREVIEW_BOUNDARY_KEYS` | 12 | Routing preview extends eval baseline |
| `node0-activation-observe.js` | `NODE0_ACTIVATION_OBSERVE_BOUNDARY_KEYS` | 8 | Read-only observe snapshot (#243) |
| `house-of-wisdom-local-index-preview.js` | `HOUSE_BOUNDARY_KEYS` | 14 | House/UKE/URP local index |
| `first-run.js` | `FIRST_RUN_BOUNDARY_KEYS` | 6 | Operator first-run plan flags |
| `onboarding-seal.js` | `ONBOARDING_SEAL_BOUNDARY_KEYS` | 6 | Onboarding seal contract |

Modules that call `buildPreviewBoundary()` from `preview-boundary.js` are unified by import and need no separate ADR row.

## Enforcement

- `tests/boundary-vocab-unification.test.js` — frozen canonical, all-false default, ADR registry integrity, no undocumented drift, tamper detect, import integrity, synonym annotations.
- `scripts/review/boundary-vocab-unification-check.mjs` — CI gate mirroring registry + synonym checks.
- Machine-readable registry: `packages/core/src/boundary-vocab-registry.js`.

## Consequences

- New preview modules should import canonical keys unless an ADR row is added first.
- Feature keys belong in their owning slice, not silent edits to unrelated modules.
- `master-craftsmanship-audit.js` probes import `PREVIEW_BOUNDARY_CANONICAL_KEYS` instead of a private duplicate list.
- **0 undocumented drift** among registered surfaces; synonym **names** remain until `BOUNDARY-SYNONYM-RECONCILE-1A`.
