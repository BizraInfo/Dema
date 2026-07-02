# NPC Intent Binder — v0.1 (DEMA-NPC-INTENT-BINDER-HARDENING-1A)

**Truth label:** `NPC_INTENT_BINDER_PREVIEW_ONLY` · **Status:** LOCAL_ONLY · not runtime, not execution.

## What it is

The **upstream front-end** to the Task Decomposition Engine (TADE, #305). Where TADE
turns a natural-language clause string into ontology atoms, the binder turns **raw,
untrusted agent/LLM output** — a ` ```json ` fence or bare JSON — into a
**content-addressed intent packet**, fail-closed.

This is the seam where orchestration moves *out of probabilistic agent thought* and
*into a deterministic, verifiable local artifact behind the FATE boundary*: downstream
consumers trust the packet, not the model's word.

## Contract

- Kernel: `packages/core/src/npc-intent-binder-hardening.js` — `bindNpcIntent({ raw })`,
  `verifyNpcIntentPacket(packet)`.
- Parses a ` ```json ``` ` fence if present, else the trimmed raw (JS `.trim()`).
- Rejects **fail-closed** (never throws) with a reason: `empty_input`, `non_json_input`,
  `malformed_json`, `not_object`, `missing_action_type`, `missing_target_path`.
- Requires non-empty `action_type` and `target_path`.
- Emits a deterministic `packet_hash` (`sha256` over `stableStringify`, mirroring TADE).
- Binds the canonical **17-key** `buildPreviewBoundary()` (all `false`) — on both bound
  and rejection packets.
- `verifyNpcIntentPacket` re-derives from the packet's own intent (body-bound): a forged
  field (e.g. `target_path` swapped to `/etc/shadow` post-bind) changes the hash and fails.

## What a bound packet proves / does not prove

Proves: the raw output parsed to a well-formed intent with the required fields, and is
content-addressed. **Does NOT prove** the action is safe, consented, authorized, or
executed. No runtime, no model invocation, no mint.

## Boundaries

Pure kernel — no fs, network, process, clock, random. Parses an in-memory string; never
reads files. Note vs the candidate brief: the boundary is the canonical **17-key** matrix
(not "10-key"), and JS uses `.trim()` (not `.strip()`).
