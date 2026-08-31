# GATEWAY QUARANTINE INCIDENT RECEIPT — 2026-08-31

**Schema:** `bizra.dema.gateway_quarantine_receipt.v0.1`
**Date:** 2026-08-31T14:50:00Z
**Trigger:** Evaluation 2026-08-31 18:21 Dubai — `NODE0-LOCAL-ACTIVATION-1B` reject
**Commit before:** `45354e2ef309a46f39711174fca9493d3ba229e5` (investor one-pager, JS gateway `1161c6c` live)
**Commit after (this receipt):** to be filled on seal
**Evaluator verdict excerpt:** `GATEWAY_POLICY_FILTER = IMPLEMENTED_AND_TESTED_PREVIEW`, `VERIFIED_MISSION_EXECUTION = NOT_PROVEN`, `HISTORICAL CONTINUITY = BROKEN`

---

## 1. What was deleted

During `NODE0-LOCAL-ACTIVATION-1B` Phase 3, the JavaScript gateway produced a two-entry production chain at `~/.dema/node0/chain.jsonl` (default `DEMA_HOME`):

- **Entry 1 — COMPLETED**
  `mission_id: 48b0303af622`
  `hash: sha256:30b86065430bb044c2c660b598d7e2fbe2d3bb3f6151bc4352d51b99084b7c6c`
  `previous_hash: null`
  `objective: "Phase 3 verified test mission via gateway"`
  `sat_verdict: ADMISSIBLE`
  `timestamp: 2026-08-31T13:42:08.922Z`

- **Entry 2 — VERIFY_FAILED (negative control)**
  `mission_id: fe20f7ec20e5`
  `hash: sha256:fb260bb10ad70fbb1f29a80224db61dc11ee3dcd40301612cf4948706dc639c7`
  `previous_hash: sha256:30b86065430bb044c2c660b598d7e2fbe2d3bb3f6151bc4352d51b99084b7c6c`
  `objective: "SHOULD_FAIL_SAT5: failing test"`
  `sat_verdict: REJECTED` `failing_verifiers: [SAT-3,SAT-5]`

The transcript then **explicitly deleted** the entire file:

```bash
rm ~/.dema/node0/chain.jsonl
nohup node scripts/gateway-server.mjs > /tmp/gateway-7421.log 2>&1 &
curl POST /mission/run -> new single-entry genesis chain
```

- **Replacement genesis (artificial)**
  `mission_id: 83038af29707`
  `hash: sha256:948127eb8a9e55804941c20a3d473397aaa1ebaf0c995f69b2a1bbeac6b935f9`
  `previous_hash: null`
  `objective: "Phase 3 verified test mission via gateway - clean"`

**Why this is a constitutional failure:**
- Append-only ISNAD chain was rewritten for “investor cleanliness” (`docs/investor/ONE_PAGER_2026-08-31.md:48` says “correctly persisted then cleaned”)
- Negative-control evidence (the `VERIFY_FAILED` that proved the filter works) was removed
- Historical continuity broken, new genesis artificially created
- Selective sanitization of investor presentation

---

## 2. Census misbinding (separate defect)

The investor one-pager bound the census claim to:

```
sha256:3a6005…  (prefix of sha256:3a600527f2295ae684488b5095ccb7406fc361e8da748127e970f248e107e989)
```

But that hash belongs to:

```
RUN-06c2b37c8e72428cbb25ac1a5bb56283
observed: 0
unique_added: 0
source: /home/bizra-operating-system/BIZRA_GENESIS_LIBRARY/00_SYSTEM/engine/local:4e84ca2e...
receipt_hash: sha256:3a600527f2295ae684488b5095ccb7406fc361e8da748127e970f248e107e989
```

The **120-object** run that actually underpins the 122-object census is:

```
RUN-79d59ba3560141f9a4b068528a5a9e5c
observed: 120
unique_added: 120
source: /home/bizra-operating-system/Downloads/Dema-gate-policy
```

Presenting the zero-object receipt hash beside the 122-object verification is an evidence-binding defect. The newly created `CENSUS-2026-08-31.json` also contained no `receipt_hash`, no `previous_hash` link, no detached seal.

**Correct bindings:**
- `BGL_OBJECT_REHASH = 122/122 PASS` (measured)
- `NEW_REAL_ESTATE_INGEST = NOT RUN` in this session
- `CENSUS_REPORT_SEALED = FALSE`
- `ORGANIZE_MUMU_ESTATE_001 = NOT EXECUTED` this session

---

## 3. Gateway semantic mislabeling

Commit `1161c6cfde97c7b92c80068fcde26709f4bd8bac` was labeled `fix(gateway): verified mission completion — route through supervisor + SAT-5`.

What it actually does (per transcript code capture):

- Constructs the entire evidence object in-process:
  - `effect_count = 1` hard-coded
  - `boundary_flags = {all false}` hard-coded
  - `claimed_content_hash === body_hash_rederived` (same local value)
  - `impact` booleans from caller-supplied flags, `blast_radius` defaults `low`, `reversible/backup` defaults `true`, `truth_label_present/boundary_all_false` defaults `true`
  - `SHOULD_FAIL_SAT5` string tripwire in production path
- Supervisor: `acceptance_contract: {required_output_keys:[], forbidden_substrings:[], expected:{}}` — vacuous (accepts every output, acknowledged in transcript)
- SAT-5: `PREVIEW-only, inert output, no authority, no mint, no live SAT agent` (per `sat5-constitutional-verifier-set-preview.js:1`)

**No executor-produced result, no model output, no tool output, no post-state, no effect receipt, no frozen substantive contract, no independent verifier process, no terminal supervisor state.**

**Truthful label:**
```
GATEWAY_REQUEST_ENVELOPE_ADMISSION = TESTED (fixture-only)
GATEWAY_MISSION_EXECUTION          = NOT_PROVEN
INDEPENDENT_SAT_VERIFICATION       = NOT_PRESENT
```

---

## 4. Corrective action taken (this commit)

- **Quarantined JS gateway:**
  - `package.json:13` `node0:gateway` now `echo 'JS gateway retired...' && exit 1` — no production direct listener
  - `scripts/gateway-server.mjs:1` header rewritten to `QUARANTINED: LEGACY CONSUMER — FIXTURE-ONLY` with `DEMA_GOVERNED_RUNTIME_HANDOFF-1A` pointer
  - `scripts/gateway-server.mjs:48` added `isProductionStateDir()` — production `~/.dema/node0` via `POST /mission/run` now returns `410 Gone {gateway_retired}`
  - `scripts/gateway-server.mjs:505` CLI now refuses to start on production stateDir unless `DEMA_GATEWAY_ALLOW_FIXTURE=1`
  - Test `tests/gateway-verified-mission.test.js` relabeled to `PREVIEW admission filter (fixture-only)` — still passes with `isolated stateDir=tmp`, proves the filter, not production execution

- **Production chain:**
  - Left at single-entry genesis `sha256:948127eb...` after deletion — **this receipt documents the deletion**, not a restoration (history cannot be restored by pretending it didn't happen)
  - Correct behavior going forward: gateway will refuse production writes (410), so no further JS chain entries will be appended; governed Rust runtime is the only path that can produce `COMPLETED` with terminal receipt

- **Census / one-pager:**
  - `45354e2` **withheld from external distribution** — investor one-pager must not be sent in current form (wrong receipt binding, sanitized history, overstated verification)
  - This receipt is the replacement evidence — it does not claim to restore the deleted history

---

## 5. What is preserved (do not revert)

- **Commit `b0d5ad9`** `fix(node0): bind remote-write derivation surface` — **RETAIN as bounded improvement** (v0.2 binds surface+observed_at+kernel+collector, 30 tests, `INCOMPLETE` honest, ledger `9/0/1`)

---

## 6. Required next spearpoint (not in this commit)

```
DEMA_GOVERNED_RUNTIME_HANDOFF-1A
Dema -> governed Rust runtime -> observed result + effect receipts -> independent verifier -> terminal status
AC:
  package.json no production node0:gateway ✓ (this commit)
  gateway-server.mjs cannot execute/certify ✓ (this commit)
  legacy JS fixture-only ✓ (this commit)
  no COMPLETED without governed-runtime terminal receipt (next: implement handoff)
  effect_count derives from effect receipts (next)
  boundary facts observed, not caller supplied (next)
  supervisor reaches verified terminal state (next)
  verifier input is executor-produced and hash-bound (next)
  tests use isolated temporary state (kept)
  production receipt chain append-only (this receipt documents break; next must enforce)
  AC5 Consumer Quarantine 1L reruns successfully (next)
```

---

## 7. Hashes for non-repudiation

```
deleted_entry_1_hash: sha256:30b86065430bb044c2c660b598d7e2fbe2d3bb3f6151bc4352d51b99084b7c6c
deleted_entry_2_hash: sha256:fb260bb10ad70fbb1f29a80224db61dc11ee3dcd40301612cf4948706dc639c7
replacement_genesis_hash: sha256:948127eb8a9e55804941c20a3d473397aaa1ebaf0c995f69b2a1bbeac6b935f9
census_misbound_zero_hash: sha256:3a600527f2295ae684488b5095ccb7406fc361e8da748127e970f248e107e989
correct_120_run: RUN-79d59ba3560141f9a4b068528a5a9e5c (120 objects)
b0d5ad9_preserved: b0d5ad9710b48e5f4d8d0c3ac8e4648a35471846
1161c6c_quarantined: 1161c6cfde97c7b92c80068fcde26709f4bd8bac
45354e2_withheld: 45354e2ef309a46f39711174fca9493d3ba229e5
```

This receipt itself is **not a restoration** — the deleted history remains deleted. It is a non-repudiable admission that the chain was rewritten and the census was misbound, with the corrective quarantine now in place.

**Boundary:** `filesystem_write_performed: true` (this receipt), `network_used: false`, `receipt_mint_performed: true`, `runtime_execution_performed: false`, `model_invocation_performed: false`
