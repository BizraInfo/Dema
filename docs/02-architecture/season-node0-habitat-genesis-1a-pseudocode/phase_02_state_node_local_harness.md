# Phase 02 · State-Node Local Harness (wisdom absorb)

**Status:** DESIGNED_NOT_LIVE (spec only this slice)  
**Source giants:** Pi (~1.2k tok) · OpenCode (fuzzy patch + undo) · Hermes (memory/cron — prune tools) · llama.cpp GBNF

## Peak gem

Move rules/tools/undo into the **host FSM**; call the LLM as a pure function per tick with fog-of-war AST slices. Do not carry 7k–15k tool catalogs in context on Node0.

## Flow logic

```
TICK:
  quest ← mainspring.active_quest          # host RAM / SQLite — not chat log
  class ← select_persona(quest.stage)      # Scout | Architect | Surgeon | Sentinel
  tools ← equip_slot(class)                # 1–2 tools only
  fog   ← ast_slice(quest.target)          # ≤ ~2k tokens
  prompt ← frozen_prefix(class) + fog      # KV-cache stable prefix
  out ← llm_call(prompt, gbnf_schema)      # optional; never implicit
  hit ← fuzzy_patch_or_verify(out)         # 9-strategy in host code
  IF hit.fail AND retries < 3 → RETRY_NODE
  IF hit.fail AND retries ≥ 3 → git_respawn(savepoint)
  ELSE advance_quest(); emit_receipt_preview()
```

## Constraints (BIZRA)

- Exact-string consent before any model invoke
- No daemon by default; no silent Ollama truncation: declare `num_ctx` in caliber + agent config
- Fuzzy patch lives in host code (OpenCode wisdom), not in the prompt
- Pi wisdom: prefix purity; Hermes wisdom: 3-strike repair — without 15k tool bloat
- Doublespeed: absorb MCP control-plane + mutation + HITL review patterns only — **do not clone phone-farm abuse**

## Next implementable special case

Wire one PREVIEW tick against existing `hhmm-state-machine.js` + constellation (already shipped) — no new daemon.
