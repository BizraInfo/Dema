# ADR-016: Layer 2 (LLM-as-judge) ships as scaffold-only · no remote LLM from runtime

**Status:** Accepted (via typed-GO `GO save planner output as docs/06-adr/ADR-016-eval-layer2-scaffold-only.md`)
**Date:** 2026-05-23 GST
**Authors:** Coordinator (Claude Opus 4.7) at Mumu's direction · output of the `planner` subagent (run_id `a975ac4f8422504db`) with full Dema doctrine context
**Supersedes:** none
**Related:** ADR-001 Dema is One Face · ADR-002 No Shadow State · ADR-003 Core Truth Lives in bizra-omega · ADR-005 Explicit Consent · ADR-008 Runtime Activation · ADR-015 LLM is Suggestion · Verifier is Authority
**Implements:** `docs/A_PLUS_BLUEPRINT_v0_1.md` §6 row #3 (Eval Layer 2 scaffold — data-only rubrics)
**Evidence:** `docs/A_PLUS_BLUEPRINT_v0_1.md` · `/home/bizra-operating-system/Downloads/BIZRA_Eval_System_Playbook.md` (operator-disk reference) · the eval-gap audit on 2026-05-23 (in-session) · ADR-015 (LLM never as authority)

---

## Operating canon

> **The LLM is a suggestion engine; the verifier is authority (ADR-015). Layer 2 evaluations using LLM judges must therefore live outside the Dema runtime authority surface in v0.1.**

This ADR locks **how** Dema introduces LLM-as-judge evaluation without violating that canon. It does not introduce a new model invocation surface, a new dependency, or a new authority lane — it ships rubric data + result-envelope schema + paste-back validator only.

---

## Context

The 2026-05-23 in-session eval-gap audit compared three operator-disk artifacts (`BIZRA_Eval_System_Playbook.md`, `bizra_eval_architecture.svg`, the Phoenix workshop transcript) against the actual repo state. The audit concluded:

- **Layer 1 (deterministic / code evals)**: shipped + more complete than the Playbook claimed (artifact-safety scanner, proof-room composition, Onboarding Seal v0.1, envelope-schema-validator wired through `eval:layer1`). The Playbook's "Layer 1 needs to expand" item was already done.
- **Layer 2 (LLM-as-judge / SAT+ rubrics)**: true gap. Four rubric categories proposed in the Playbook (Truthfulness, Actionability, Boundary Compliance, Artifact-Safety-LLM). The Artifact-Safety-LLM rubric overlaps with the already-shipped deterministic Layer 1 scanner and was recommended for drop.
- **Layer 3 (golden dataset · meta-eval)**: true gap; deferred (parking-lot row in `docs/A_PLUS_BLUEPRINT_v0_1.md` §6 row #4).

The Playbook's example Layer 2 implementation invoked the Anthropic SDK directly:

```python
from anthropic import Anthropic
client = Anthropic()
```

That call is a remote-provider invocation from the runtime. The user-scope `/home/bizra-operating-system/CLAUDE.md` halt-gate lists "no remote LLM/provider calls from the runtime" as a constitutional rule. The repo-local `CLAUDE.md` reinforces "no runtime execution in this repo." So the Playbook's reference implementation cannot land verbatim.

Three paths existed:

- **(a) Local-model lane** — Route Layer 2 calls through `dema model-broker` to a local Ollama / LM Studio instance.
- **(b) Scaffold-only** — Ship rubrics + prompts + result-envelope schema as data; operator runs the LLM externally and pastes verdicts back; Dema validates the pasted verdict.
- **(c) Mark `DESIGNED_NOT_LIVE`** — Defer entirely.

## Decision

**Path (b) — Scaffold-only.**

Layer 2 v0.1 ships:

1. **3 rubric data modules** (Truthfulness · Actionability · Boundary-Compliance) as frozen JS data + prompt-pack strings, exported from `packages/core/src/eval-layer2-rubrics.js`.
2. **2 new envelope schemas** under `packages/core/schemas/`:
   - `bizra.dema.eval_layer2_rubric_pack.v0.1` — the rubric pack itself, self-validating
   - `bizra.dema.eval_layer2_judge_verdict.v0.1` — the paste-back verdict envelope
3. **A pure validator** `validatePastedJudgeVerdict()` in `packages/core/src/eval-layer2-verdict-validator.js`, delegating structural validation to the existing `envelope-schema-validator.validateAgainstRegistry()` and layering semantic checks the JSON Schema cannot express (rubric_id cross-referenced against the live `RUBRIC_IDS` export · evidence_excerpt non-empty after trim · `schema` field matches the expected verdict id). `score ∈ {0,1,2}` · `judged_artifact_sha256` 64-hex pattern · `judge_origin = external_paste_back` are enforced structurally by the schema's enum / pattern; the semantic layer does not re-check them.
4. **Two read-only CLI surfaces**:
   - `dema eval layer2 prompts [--json]` — emits the frozen rubric pack to stdout
   - `dema eval layer2 verify <abs-path> [--json]` — validates a pasted-back verdict file; exits 1 on validation failure
5. **No runtime model invocation, no automated runner, no result aggregation, no write surface.**

### Why path (b) over (a) or (c)

| Path | Issue | Verdict |
|---|---|---|
| **(a) Local-model lane** | `packages/models` (model-broker) is currently `DESIGNED_NOT_LIVE` per `docs/CURRENT_LIMITS.md`. Shipping (a) inside v0.1 would convert a preview surface into a runtime authority dependency before model-broker hardens — expanding blast radius beyond a v0.1 scaffold and crossing ADR-015 ("LLM never as authority"). | Defer to v0.2 once model-broker is `MEASURED`. |
| **(b) Scaffold-only** | Operator must run the judge externally and paste results back. Some friction, but the friction is the boundary: Dema does not invoke remote LLMs and does not authorize what an external judge produced — Dema only validates the structure + semantics of the pasted verdict. | **Adopt.** |
| **(c) DESIGNED_NOT_LIVE only** | Ships zero new capability. Honest but doesn't move the eval spine forward. | Reject. |

### v0.2 promotion path

Once `packages/models` hardens out of `DESIGNED_NOT_LIVE`, the natural v0.2 additions are:

- `dema eval layer2 judge <input-artifact-path> --rubric <id> --judge-cmd <operator-supplied-command>` — operator-bring-your-own external invocation surface, still no remote LLM from runtime
- `dema eval layer2 aggregate <verdicts-dir>` — multi-rubric aggregation
- Wiring through `model-broker` to a local model (Ollama / LM Studio) — same boundary as today but automated
- A separate ADR-017 to formalize whichever v0.2 path is chosen

Layer 3 (golden dataset · meta-eval) remains a separate slice (`docs/A_PLUS_BLUEPRINT_v0_1.md` §6 row #4), to be sequenced after Layer 2 v0.1 ships.

---

## Module boundary (after v0.1 lands)

### `packages/core/src/eval-layer2-rubrics.js`

Data module. Pure. No I/O.

- `EVAL_LAYER2_RUBRIC_PACK_SCHEMA: string` — `"bizra.dema.eval_layer2_rubric_pack.v0.1"`
- `RUBRIC_IDS: ReadonlyArray<string>` — `["truthfulness", "actionability", "boundary_compliance"]`
- `RUBRICS: ReadonlyObject` — deep-frozen `{ truthfulness: {...}, actionability: {...}, boundary_compliance: {...} }`
- `getRubricPack(): FrozenEnvelope` — returns the full pack as a frozen envelope tagged with the schema id
- `getPromptFor(rubricId: string): { system: string, user_template: string } | null`

### `packages/core/src/eval-layer2-verdict-validator.js`

Validator module. Pure.

- `EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA: string` — `"bizra.dema.eval_layer2_verdict_validator.v0.1"` (verdict-of-the-validator envelope)
- `validatePastedJudgeVerdict(parsedJson: object): FrozenEnvelope` — returns `{ schema, ok, truth_label, errors, boundary }` where `truth_label ∈ {"MEASURED", "VALIDATION_FAILED", "SCHEMA_UNKNOWN", "SEMANTIC_VIOLATION"}`. Delegates structural pass to `validateAgainstRegistry`; layers semantic checks.
- `formatVerdictReport(result: FrozenEnvelope): string` — human-readable output for CLI

### CLI surface in `apps/cli/src/index.js`

- `dema eval layer2 prompts [--json]` — emits the frozen rubric pack to stdout; read-only
- `dema eval layer2 verify <abs-path-to-verdict.json> [--json]` — reads the file, parses JSON, runs `validatePastedJudgeVerdict`, prints report, exits 0 on `ok=true`, else 1; read-only on the artifact

### Reused / unchanged

`envelope-schema-validator.js` is consumed via existing `validateAgainstRegistry` and the private `_knownSchemas` map (auto-loaded at module init from `packages/core/schemas/`). The two new schemas dropped into `packages/core/schemas/*.v0.1.json` are picked up automatically by the existing `loadKnownSchemasFromDir` — no validator code change required.

---

## Envelope schemas

### `bizra.dema.eval_layer2_rubric_pack.v0.1`

File: `packages/core/schemas/eval-layer2-rubric-pack.v0.1.json`

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema` | const `bizra.dema.eval_layer2_rubric_pack.v0.1` | ✓ | |
| `version` | string (pattern `^v0\.1$`) | ✓ | |
| `rubrics` | array of RubricDef | ✓ | length ≥ 3 |
| `boundary` | canonical 16-key preview-boundary all-`const:false` | ✓ | matches `packages/core/src/preview-boundary.js` |
| `notes` | string | optional | |
| `non_goals` | array of strings | optional | |

Per-rubric `RubricDef`:

| Field | Type | Required |
|---|---|---|
| `id` | enum `truthfulness \| actionability \| boundary_compliance` | ✓ |
| `title` | string | ✓ |
| `score_scale` | object `{ min: 0, max: 2 }` | ✓ |
| `prompt` | object `{ system: string, user_template: string }` | ✓ |
| `score_meanings` | array of strings (length 3) | ✓ |

Consumed by: `getRubricPack()` for self-validation in tests; the `dema eval layer2 prompts` CLI subcommand.

### `bizra.dema.eval_layer2_judge_verdict.v0.1`

File: `packages/core/schemas/eval-layer2-judge-verdict.v0.1.json`

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema` | const `bizra.dema.eval_layer2_judge_verdict.v0.1` | ✓ | |
| `rubric_id` | enum matching `RUBRIC_IDS` | ✓ | |
| `judged_artifact_sha256` | string · pattern `^[a-f0-9]{64}$` | ✓ | |
| `score` | integer `{0, 1, 2}` | ✓ | |
| `evidence_excerpt` | string · min 1 char (post-trim) | ✓ | |
| `judge_origin` | enum `external_paste_back` | ✓ | v0.1 schema enum is restricted to the single value Dema actually supports. v0.2 will bump the schema id (`...v0.2`) and add additional invocation surfaces (e.g., `local_model_via_broker`) once `dema model-broker` hardens out of `DESIGNED_NOT_LIVE`. Non-v0.1 values are caught structurally as `enum_mismatch`; no semantic re-check needed |
| `judged_at` | ISO-8601 string | ✓ | |
| `judge_model_name` | string | optional | |
| `judge_run_id` | string | optional | |
| `notes` | string | optional | |

Consumed by: `validatePastedJudgeVerdict()`; `dema eval layer2 verify` CLI.

---

## Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Operator (or future contributor) mistakes the scaffold for a live evaluator and ships overclaim ("Layer 2 is live") | HIGH | Explicit `docs/CURRENT_LIMITS.md` row at v0.1: validator = `MEASURED`; judge runtime = `DESIGNED_NOT_LIVE`. Layer 1 claim-boundary scanner already gates docs against overclaim. |
| 2 | Hidden network call slips in ("just a convenience" Anthropic fetch) | HIGH | Tests assert no `fetch(` / `node:https` / `node:http` reference in any new Layer 2 source file. CI grep can be added as a guard. |
| 3 | Schema namespace drift — new envelopes added but not auto-picked-up by validator registry | MED | New `tests/eval-layer2-schema-registry-wiring.test.js` asserts both schema IDs appear in `KNOWN_SCHEMA_IDS` and have non-empty `properties`. |
| 4 | Deep-freeze invariant broken on emitted envelopes | MED | Every exported function returns `Object.freeze(...)`; tests assert `Object.isFrozen()` on result + nested arrays/objects. |
| 5 | Test count drops below 2,549 floor | MED | Add ≥ 28 new tests across 4 files; floor moves to ~2,577. |
| 6 | Filesystem write performed by the scaffold | MED | No write surface in v0.1. Tests snapshot `~/.dema/` and repo root for mtime stability across CLI subprocess invocations. |
| 7 | Path leakage / secret-like strings in rubric prompt text | MED | Pipe `getRubricPack()` JSON through `evaluateArtifactSafety` in a test; assert verdict = `PUBLIC_SAFE`. |
| 8 | ADR drift — design shipped without ADR | LOW | This ADR (016) ships ahead of any code. |

---

## Invariants that must be preserved across the v0.1 slice

- 0 production deps · 0 dev deps
- No remote LLM / provider call from runtime (no `fetch`, no `https`, no Anthropic SDK import anywhere in slice)
- No mint, no federation, no token / PoI claim, no daemon, no public send
- All emitted envelopes deep-frozen
- Total tests never decrease (floor: 2,549 at time of writing)
- `eval:layer1` CLI semantics unchanged (sanity-run pre- and post-slice; verdict on the public-safe proof-room bundle identical)
- Every new `bizra.dema.*.v0.1` schema added under `packages/core/schemas/` MUST be auto-picked-up by `envelope-schema-validator`'s private registry (registry-wiring test enforces this)
- New CLI surfaces emit JSON envelopes and pass `npm run eval:layer1` against their stdout output

---

## Verification strategy

### Existing tests that must still pass (regression floor 2,549)

All Layer 1 tests (artifact-safety-eval · artifact-safety-eval-schema-wiring · envelope-schema-validator · onboarding-seal · proof-room-bundle), all CLI subprocess tests, all integration-check / actuator-check / env-hygiene-check tests.

### New tests added (~28 total)

| File | Approx tests | Locks |
|---|---|---|
| `tests/eval-layer2-rubrics.test.js` | ~8 | pack shape · all 3 rubric IDs · prompt strings non-empty · self-validate via `validateAgainstRegistry` · deep-frozen · boundary stamp · `getPromptFor("unknown")` returns null · pack passes Layer 1 `evaluateArtifactSafety` with verdict PUBLIC_SAFE |
| `tests/eval-layer2-verdict-validator.test.js` | ~15 | happy path · missing required → `VALIDATION_FAILED` · unknown `rubric_id` (structural `enum_mismatch` + semantic `UNKNOWN_RUBRIC`) · `score=3` → structural `enum_mismatch` → `VALIDATION_FAILED` (score is enforced by schema enum, not by semantic layer) · empty `evidence_excerpt` → semantic `EMPTY_EVIDENCE` → `SEMANTIC_VIOLATION` · bad sha256 → `pattern_mismatch` · wrong schema → `SCHEMA_UNKNOWN` · v0.2-style `judge_origin` → structural `enum_mismatch` (no semantic re-check; schema enum is now restricted to `external_paste_back`) · hostile input (null / array / string / number) → `VALIDATION_FAILED` · frozen result · 6-key boundary stamp · formatter renders both happy + sad paths · module pure |
| `tests/eval-layer2-schema-registry-wiring.test.js` | ~3 | both new schemas appear in `KNOWN_SCHEMA_IDS` · both have non-empty `properties` · both `$id` matches filename convention |
| `tests/eval-layer2-cli.test.js` | ~5 | `dema eval layer2 prompts` exits 0 + emits JSON · `verify <good>` exits 0 · `verify <bad>` exits 1 · `verify <missing-file>` exits 1 with helpful message · stdout from `prompts` passes Layer 1 PUBLIC_SAFE when piped through `evaluateArtifactSafety` |

### Local pre-merge gate (run exactly per repo `CLAUDE.md`)

```bash
npm test                                              # floor ≥ 2,549; expect ~2,577
npm run check                                         # env-hygiene + tests + node0_self_check_verify
npm run llm:guidance                                  # canonical-flow links live
npm run eval:layer1 -- --artifact "$(pwd)/artifacts/proofs/proof-room-v0.1-public-safe/proof-room-bundle.json" --json
git diff --check                                      # whitespace
~/.dema/bin/mu-test-all                               # operator-side μ-layer gate (pre-push hook runs this)
```

### Sample fixtures

- Inline JSON object for a valid pasted-back judge verdict (one per rubric)
- Inline JSON for ≥ 4 invalid cases (missing field · wrong score · bad sha · unknown rubric)
- No on-disk fixtures required for v0.1 — tests build objects in-memory; `mkdtempSync` only when CLI subprocess reads a file

---

## Explicit non-goals for v0.1

1. **No automated judge runner.** Dema does not invoke any LLM (local or remote) in v0.1. → v0.2 candidate: `--judge-cmd` operator-supplied external invocation.
2. **No meta-eval against a golden dataset.** No precision / recall calculation. → v0.2 / v0.3 candidate (`docs/A_PLUS_BLUEPRINT_v0_1.md` §6 row #4 `golden-dataset-v0-1`).
3. **No aggregation across multiple verdicts.** v0.1 validates one verdict file at a time. → v0.2 candidate: `dema eval layer2 aggregate <dir>`.
4. **No `dema model-broker` wiring.** Path (a) deferred until model-broker is `MEASURED`. → v0.2 / v0.3 candidate.
5. **No Layer 2 entry in the `FORBIDDEN_LIVE_CLAIMS` list yet.** That hardening is reserved for the slice that surfaces the validator publicly (would otherwise be a same-slice circular dependency).
6. **No artifact-safety judging by an LLM.** Eval-audit recommended dropping the Artifact-Safety-LLM rubric — Artifact Safety remains a deterministic Layer 1 surface only.
7. **No write surface anywhere in the slice.** All new modules and CLI surfaces are read-only. → v0.2 candidate: `--save-verdict` flag mirroring the verification-result-save canon (PR #87 era).

---

## Typed-GO line

The exact phrase the operator types to start implementation:

```text
GO ship eval-layer-2-scaffold-v0-1 with scaffold-only resolution, covering
truthfulness + actionability + boundary_compliance rubrics, data-only
(no remote LLM, no local model invocation), no automated runner,
no aggregation, no golden dataset, no model-broker wiring, no write surface
```

---

## Consequences

### Positive

- Layer 2 evaluation becomes possible immediately, with full doctrine compliance.
- Operator owns the LLM invocation lane completely (their key, their environment, their model choice).
- Paste-back verdicts are structurally + semantically validated by Dema before storage.
- Clean v0.2 promotion path that does not require redesigning the v0.1 surface.
- Layer 1 + Layer 2 + Layer 3 progression matches the eval-pyramid framing in `docs/A_PLUS_BLUEPRINT_v0_1.md` §5.2 and the operator-disk `BIZRA_Eval_System_Playbook.md`.

### Negative

- v0.1 cannot benchmark Dema autonomously; every Layer 2 measurement is operator-mediated.
- Cannot run continuous regression-style Layer 2 sweeps inside CI without v0.2 work.
- Two separate vocabularies must be maintained until v0.2: the rubric data and the verdict envelope.

### Trade-off accepted

The slowness of operator-mediated Layer 2 in v0.1 is accepted in exchange for not crossing the no-remote-LLM constitutional boundary. The boundary is more load-bearing than the speed.

---

## When this ADR changes

This ADR is `v0.1`. Material edits to the path decision (b → a, b → c, or b → hybrid) require a new ADR (e.g., ADR-017) plus an operator-typed GO. Editorial refinements that do not change the decision may land through standard PR.

Last refreshed: 2026-05-23.
