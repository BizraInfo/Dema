# ARTIFACT-011 — First Bounded Diagnostic Receipt (Operator Ceremony)

**Truth label:** `PREPARED` / **NOT YET MEASURED**

**Status:** Ceremony template only. This document does **not** claim that governed Node0 has executed, that ARTIFACT-011 exists on disk with `truth_label: MEASURED`, or that v0.1 release is complete.

**Anchored:** 2026-06-06 (Dubai GST)

---

## Purpose

Provide a **replayable operator ceremony** for closing the v0.1 hard release gate:

```text
ARTIFACT-011 — First Bounded Diagnostic Receipt
```

The ceremony separates:

- **Dema (this repo):** preview, consent check, status/doctor, receipt **read/list** only
- **Governed Node0 (upstream runtime):** bounded diagnostic **execution** and receipt **issuance**

Use this file as the evidence worksheet an operator fills in after running the ceremony. Until every checklist item is checked with captured command output and hashes, treat ARTIFACT-011 as **NOT MEASURED**.

---

## References

| Document                                                      | Role                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| [NODE0_DEMA_DOD_v0.1.md](../NODE0_DEMA_DOD_v0.1.md)           | Full v0.1 Definition of Done                                          |
| [ARTIFACT_011_PREP.md](../ARTIFACT_011_PREP.md)               | Allowed/forbidden scope for ARTIFACT-011                              |
| [NODE0_ACTIVATION_ROADMAP.md](../NODE0_ACTIVATION_ROADMAP.md) | Step A5 — first issuance (closes SEED)                                |
| [RECEIPTS.md](../RECEIPTS.md)                                 | Receipt storage and read semantics                                    |
| [PROOF_SUMMARY.md](../../PROOF_SUMMARY.md)                    | Latest Proof Forge summary                                            |
| `.proof-forge/receipts/2026-06-06_023040.json`                | DoD anchor receipt (Proof Forge local evidence; **not** ARTIFACT-011) |

**Proof Forge anchor (DoD docs verified):** receipt `2026-06-06_023040`, chain position 74, confidence Ironclad. That receipt proves repo gates and DoD documentation — **not** runtime diagnostic completion.

---

## Explicit boundary

```text
Dema does NOT mint ARTIFACT-011.
Governed Node0 issues ARTIFACT-011 into DEMA_HOME (~/.dema/receipts/).
Dema verifies readiness, records consent previews, and reads/lists the receipt after issuance.
```

Forbidden to claim during or before this ceremony:

- AGI, token launch, passive income, public federation
- Hidden background autonomy or silent daemon start
- Node1 activation, external provider routing without explicit consent
- Economic reward without a proof receipt
- That `dema mission propose` executes anything (`executes` must remain `false`)

---

## Operator preconditions

Complete **before** Step A5 runtime invocation:

- [ ] Fresh or isolated `DEMA_HOME` chosen (recommended: dedicated directory, not production home, until ceremony passes)
- [ ] Dema repo cloned; `npm install` completed
- [ ] Repo gates green on operator machine: `npm test`, `npm run check`, `npm run llm:guidance`
- [ ] Step A4 complete per [NODE0_ACTIVATION_ROADMAP.md](../NODE0_ACTIVATION_ROADMAP.md) (gateway HTTP adapter live if required by your Node0 build)
- [ ] `dema setup` run against target `DEMA_HOME`
- [ ] `dema doctor` exits 0 with: `ready=true`, `consoleReady=true`, `activationGate="EXPLICIT_GO_REQUIRED"`, `daemonStatus!="running"`
- [ ] Live local model available if your gateway requires it (`lm_studio.connected=true`, loaded model, token present — per roadmap A5)
- [ ] Governed bounded-diagnostic runtime path exists **outside this repo** and is invokable by operator
- [ ] Operator has the exact consent phrase ready (character-for-character, no translation)

**Exact consent phrase (required):**

```text
GO: Node0 bounded diagnostic activation only
```

---

## Step-by-step operator ceremony

Record **date/time (GST)**, **commit hash**, **DEMA_HOME path**, and **command exit codes** for each step.

### a. Verify repo state

```bash
cd /path/to/Dema
git status -sb
git rev-parse HEAD
npm test
npm run check
npm run llm:guidance
git diff --check
```

**Automated Dema-side ceremony preflight (steps b–d on isolated home):**

```bash
npm run artifact-011:preflight
# or with witness file:
node scripts/artifact-011-ceremony-preflight.mjs --isolated --json \
  --out docs/evidence/runs/artifact-011-preflight-$(date -u +%Y%m%dT%H%MZ).json
```

**Expected:** `truth_label: PREPARED`, `cleared_for_preview_ceremony: true`, `cleared_for_runtime_ceremony: false`, all `boundary.*` flags false. This does **not** replace repo gates in the block above and does **not** prove ARTIFACT-011 MEASURED.

**Expected:** tests pass; check passes; working tree understood (note dirty/clean).

**Operator notes:**

```text
Date/time:
Commit:
Test result:
Check result:
```

---

### b. Run status / doctor

```bash
export DEMA_HOME=/path/to/isolated/dema-home   # if not using ~/.dema
dema status:json
dema doctor --json
```

**Expected:** doctor exit 0; activation gate `EXPLICIT_GO_REQUIRED`; no hidden daemon.

**Operator notes:**

```text
DEMA_HOME:
dema doctor exit code:
activationGate:
daemonStatus:
```

---

### c. Mission propose **without** consent

```bash
dema mission propose --json
```

**Expected:** preview only; `executes: false`; consent required or blocked; **no receipt minted**.

**Operator notes:**

```text
executes field:
consent verdict:
```

---

### d. Mission propose **with** exact consent

```bash
dema mission propose --consent "GO: Node0 bounded diagnostic activation only" --json
```

**Expected:** consent accepted in preview; `executes: false`; readiness gating visible; **still no runtime execution from Dema**.

**Operator notes:**

```text
consent accepted:
expectedArtifact (if shown):
executes:
```

---

### e. Execute governed Node0 one-shot path (outside Dema repo)

**This step is NOT a Dema CLI command.**

Invoke the **governed Node0 bounded diagnostic runtime** per your upstream operator runbook (gateway + one-shot service). Dema repo invariants forbid implementing or claiming runtime execution here.

**Expected:** exactly one bounded diagnostic; no Node1; no federation; no token claims.

**Operator notes:**

```text
Runtime command / entrypoint used:
Runtime repo / version:
Start time:
End time:
Exit code:
```

---

### f. Confirm ARTIFACT-011 receipt on disk

```bash
ls -la "$DEMA_HOME/receipts/"
# Expect a file such as ARTIFACT-011.json (exact filename per runtime)
sha256sum "$DEMA_HOME/receipts/ARTIFACT-011.json"   # adjust path if needed
```

**Expected fields (minimum):**

- `artifact_id`: `"ARTIFACT-011"`
- `action`: `"bounded_diagnostic_activation"`
- `truth_label`: `"MEASURED"` (not `FIXTURE`, not `PREVIEW`)
- `receipt_id`, `created_at`, and hash-chain fields per [RECEIPTS.md](../RECEIPTS.md)

**Operator notes:**

```text
Receipt path:
SHA-256:
truth_label:
receipt_id:
```

---

### g. Read receipt via Dema

```bash
dema receipts
dema receipts ARTIFACT-011 --json
```

**Expected:** exit 0; artifact id `ARTIFACT-011`; parseable JSON; malformed/tampered receipts must fail closed (do not proceed if read errors).

**Operator notes:**

```text
dema receipts ARTIFACT-011 exit code:
Matches on-disk file (Y/N):
```

---

### h. Record learning entry

Post-receipt learning is required for v0.1 DoD. The HOW-1A House of Wisdom kernel (`packages/learn/src/how-lesson-writer.js`, schema `bizra.dema.house_of_wisdom_lesson.v0.1`) exists but **automated CLI persistence after ARTIFACT-011 is not yet closed** in this repo.

**Operator action (until CLI loop ships):**

1. Write a short operator reflection tied to receipt id / content hash
2. Store locally under `DEMA_HOME` (e.g. `memory/learning/` or operator log) with `share_status: local_only`
3. Capture `lesson_hash` or reflection hash if using HOW-1A verify path

**Operator notes:**

```text
Learning entry path:
Linked receipt_id / hash:
Schema tag (if any):
share_status:
```

---

### i. Run Proof Forge verification (repo evidence)

After filling this ceremony worksheet, re-anchor repo evidence:

```bash
cd /path/to/Dema
python3 scripts/verify_artifacts.py \
  --project-dir . \
  --description "ARTIFACT-011 operator ceremony completed; evidence worksheet filled." \
  --artifact docs/evidence/ARTIFACT-011_FIRST_BOUNDED_DIAGNOSTIC_RECEIPT.md \
  --command "npm test" \
  --command "npm run check" \
  --command "npm run llm:guidance" \
  --command "npm run perf" \
  --output .proof-forge/reports/artifact-011-ceremony_verification.json

python3 scripts/forge_evidence.py \
  --project-dir . \
  --description "ARTIFACT-011 operator ceremony evidence worksheet completed (MEASURED gate)." \
  --verification-report .proof-forge/reports/artifact-011-ceremony_verification.json

python3 scripts/proof_summary.py \
  --receipt "$(ls -t .proof-forge/receipts/*.json | head -1)" \
  --project-dir .
```

**Note:** Proof Forge receipts prove **documentation and gate status**, not substitute for `truth_label: MEASURED` on ARTIFACT-011 itself.

**Operator notes:**

```text
New Proof Forge receipt id:
Evidence hash:
```

---

## Evidence checklist (operator fill-in)

Check only after capturing proof (command output, hashes, timestamps):

- [ ] Repo gates green at ceremony start (`npm test`, `npm run check`, `npm run llm:guidance`)
- [ ] `dema doctor` exit 0 with correct activation gate
- [ ] `dema mission propose` without consent did not execute (`executes: false`)
- [ ] `dema mission propose --consent "GO: Node0 bounded diagnostic activation only"` accepted exact phrase only
- [ ] Governed Node0 runtime executed **outside Dema repo** (one bounded diagnostic)
- [ ] `$DEMA_HOME/receipts/` contains ARTIFACT-011 with `truth_label: MEASURED`
- [ ] Receipt SHA-256 recorded
- [ ] `dema receipts ARTIFACT-011` exit 0 and matches on-disk file
- [ ] Learning entry recorded locally with receipt linkage
- [ ] Proof Forge re-run after worksheet completion (optional but recommended)
- [ ] No forbidden claims made in operator notes or public messaging

**Ceremony completion verdict:** ☐ `READY_FOR_OPERATOR` (template only) → ☐ `MEASURED` (all boxes checked)

---

## Failure modes and fail-closed responses

| Condition                                                            | Response                                                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Consent phrase typo, extra whitespace, translation, or partial match | **BLOCK** — do not invoke runtime; fix phrase                                             |
| `dema mission propose` shows `executes: true`                        | **STOP** — Dema regression; do not proceed                                                |
| `dema doctor` not ready / daemon already running                     | **BLOCK** — resolve readiness first                                                       |
| Runtime invoked but no receipt file                                  | **FAIL** — do not claim MEASURED; inspect runtime logs                                    |
| Receipt `truth_label` is `PREVIEW`, `FIXTURE`, or absent             | **FAIL** — not v0.1 close gate                                                            |
| `dema receipts ARTIFACT-011` errors or ambiguous selector            | **FAIL** — fix storage path or filename collision                                         |
| Receipt tampered / hash chain verify fails                           | **FAIL** — treat as invalid; do not publish                                               |
| Temptation to say "Dema minted the receipt"                          | **CORRECT** — governed Node0 issued; Dema read only                                       |
| URP proof tests fail after artifact drift                            | Regenerate: `node scripts/node0-local-urp-proof.mjs && node scripts/node0-self-check.mjs` |

---

## No-zann claim boundary

**May say (with evidence attached):**

- "Operator ceremony documented and prep complete (`PREPARED`)"
- "ARTIFACT-011 read path tested in repo (fixture tests)"
- "DoD anchored; Proof Forge receipt `2026-06-06_023040` proves doc + gate verification"

**May say only after Step f–g pass with hashes:**

- "ARTIFACT-011 issued with `truth_label: MEASURED` on operator path"
- "v0.1 hard release gate ARTIFACT-011 closed"

**Must not say without proof:**

- Runtime already ran because tests pass
- Dema executes diagnostics
- Token, federation, AGI, or public network activation
- Learning loop is fully automated in CLI (kernel only today)

---

## Completion signature (operator)

```text
Operator:
Date (GST):
DEMA_HOME:
Dema repo commit:
ARTIFACT-011 receipt SHA-256:
Ceremony verdict: PREPARED | MEASURED | ABORTED
Notes:
```
