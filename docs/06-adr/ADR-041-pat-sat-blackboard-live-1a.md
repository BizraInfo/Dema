# ADR-041: PAT-SAT-BLACKBOARD-LIVE-1A — single-step live suggestion

- **Status:** Accepted (2026-06-24)
- **Truth label:** `PAT_SAT_BLACKBOARD_LIVE_SUGGESTION_ONLY` (completed) / `…_REFUSED|_FAILED|_BLOCKED`
- **Slice:** `PAT-SAT-BLACKBOARD-LIVE-1A`

## Context

The operator asked for "PAT-SAT-BLACKBOARD live coordination / activation." That phrase
decomposes into several distinct §1 bindings: an autonomous self-driving PAT/SAT loop
(**forbidden** unqualified), identity/key-sign and Block0 seal (**operator-only**, and the
`activate` performer `node0_activate.py` lives in BIZRA-DATA-LAKE, not this repo), and
mint/federation (**forbidden**). None of those are authorized by a blanket GO.

The **one** constitutional "live" form inside Dema is the `dema talk` precedent: a single,
exact-consent-gated, localhost-only, suggestion-only local model call. The operator scoped
the GO to exactly that.

## Decision

`dema agent-loop blackboard --live [--provider ollama] [--model …] --consent "<phrase>"`:

- Builds the deterministic dry-run board (scaffold) and makes **exactly one** live call for
  the PAT `propose` seat via the sanctioned `invokeDemaTalkLive` gate (provider router,
  localhost + whitelist + exact-consent gates, Layer-1 safety, injectable `fetchImpl`).
- A pure kernel `composeLiveBlackboard` embeds the dry-run board + the suggestion into an
  envelope. Because a model ran, `model_invocation_performed` MAY be `true` (honest); the
  **10 forbidden runtime-emission keys stay false** (filesystem_write, external_call,
  raw_corpus_scan, raw_data, tool_executed, chain_advance, receipt_mint, federation,
  node_connection, public_network) and an explicit `autonomy` block is all-false.
- `verifyLiveBlackboard` enforces those invariants and is **body-bound** (the hash re-derives
  over the whole envelope, so a tampered suggestion / boundary / autonomy is caught). The
  model output itself is non-deterministic and is NOT re-derived — only integrity + invariants.
- Without `--consent`, the gate refuses **before any network call**.

## Consequence

- `tests/pat-sat-blackboard-live.test.js` (kernel + mock-fetch integration) and
  `tests/pat-sat-blackboard-live-cli.test.js` (binary refusal path) registered in TESTING.md.
- `--live` is a flag on the existing `agent-loop blackboard` command — no new kebab (ADR-012).

## What this does NOT prove

Not autonomous PAT/SAT coordination (one suggestion, no self-driving loop). The suggestion is
advisory, never authority (ADR-015), never executed. No identity bound, no key signed, no
receipt/token/PoI minted, no daemon, no federation. Live activation remains an operator-only
§1 act in BIZRA-DATA-LAKE.
