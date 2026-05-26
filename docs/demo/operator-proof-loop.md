# Operator Proof Loop Demo

A 90-second walkthrough of DEMA's dual proof loop. Every command below
is real, read-only or consent-gated, and runs against your local node.

**Requirements:** Node.js >= 20, a local Ollama instance with any model
(e.g. `gemma4:e4b`). No network, no cloud, no accounts.

## Setup

```bash
git clone https://github.com/BizraInfo/Dema
cd Dema
node bin/dema setup        # creates ~/.dema/ (idempotent)
```

## 1. Where does my node stand?

```bash
node bin/dema status --full
```

Expected: Node0 identity, harness verdict (CLEAN), both proof loops
COMPLETE with per-source presence, receipt counts, and 5 locked future
layers (federation, token_economy, node1_urp, ed25519_authorship,
multi_model_router).

## 2. Is the system healthy?

```bash
node bin/dema harness
```

Expected: Verdict CLEAN with 4 verdict inputs (all_gates_pass,
compliance_clean, no_blocker_gaps, behavioral_probes_all_present),
5/5 proactive gates, 3 behavioral probes PRESENT, 6 hooks wired.

## 3. What proof history exists?

```bash
node bin/dema receipts
```

Expected: typed receipt list sorted newest-first (think/mission/route),
with timestamps and truth labels. Empty on first run.

## 4. What is safe to do next?

```bash
node bin/dema think "What is DEMA?" --dry-run
```

Expected: resource estimate, model readiness check, consent phrases
shown (no model invoked, no network, no filesystem write). The output
tells you exactly what consent phrases are needed for live invocation.

## 5. Live think with receipt

Replace `<model>` with your loaded Ollama model (e.g. `gemma4:e4b`).

```bash
node bin/dema think "Say exactly: DEMA proof loop is operational." \
  --consent "RUN LOCAL THINK" \
  --model-consent "GO: invoke local LLM at <model>" \
  --model "<model>" \
  --save-receipt \
  --save-consent "SAVE LOCAL THINK RECEIPT" \
  --json
```

Expected: think_live envelope to stdout (schema `bizra.dema.think_live.v0.1`),
receipt saved to `~/.dema/receipts/think-<sha256>.json` (stderr confirms path).

Three consent gates fire:

1. `RUN LOCAL THINK` — authorizes the think operation
2. `GO: invoke local LLM at <model>` — authorizes model invocation
3. `SAVE LOCAL THINK RECEIPT` — authorizes receipt persistence

## 6. Verify the latest think

```bash
node bin/dema think --closeout latest
```

Expected: Think Closeout Report showing query, model, status, output
preview, consent verified (yes), proof hash verified (PASS), boundary
summary (model_invoked true, public_network false, fs_write false).

## 7. Are the proof loops behaviorally sound?

```bash
node bin/dema think --probe
```

Expected: 5/5 PASS — boundary_observed, determinism, consent_gate,
receipt_integrity, tamper_detection. Verdict: CLEAN.

## 8. Confirm receipts

```bash
node bin/dema receipts
```

Expected: the think receipt from step 5 now appears, typed as `think`,
with timestamp and valid status.

## What is NOT live

These layers are intentionally locked and will not activate:

- Federation (multi-node communication)
- Token / PoI economy
- Node1 / URP networking
- Ed25519 authorship signing
- Full multi-model router

Current truthful status: **local proof cockpit for governed AI execution**.

## Boundary guarantee

Every command in this demo is either:

- **Read-only** (status, harness, receipts, dry-run, closeout, probe)
- **Consent-gated** (live think + receipt save require exact phrases)

No command writes outside `~/.dema/`. No command contacts the public
internet. No command runs without the operator's explicit consent phrase.
