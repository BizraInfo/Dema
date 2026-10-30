# BIZRA Asset Ledger — map-only v0

**Mode:** MAP_ONLY · no Drive ingest · no silent absorption · `authority_delta=0`  
**Updated:** 2026-10-30 · after #499 + #501 on main  
**Claim labels:** mandatory seven from `docs/CLAIM_REGISTER_v0_1.md` §§6–8 (not branch slang).

## Truth labels (canonical)

| Label | Meaning (abbrev.) |
| --- | --- |
| `VERIFIED` | Repeatable evidence reachable from the repo (path, hash, or git SHA) |
| `MEASURED` | Reproducible command + conditions + SHA |
| `DERIVED` | Follows from VERIFIED/MEASURED with chain named |
| `SCENARIO` | Contingent; assumptions named |
| `DESIGNED_NOT_LIVE` | Spec/design only; not live |
| `UNKNOWN` | Honest absence of evidence |
| `FORBIDDEN` | Must not appear as a public claim |

Optional column **branch_state** is git/PR hygiene only — never a substitute for the claim label.

## Inventory (resolvable refs only)

| Asset | Path / ref | Claim label | branch_state | Does NOT prove |
| --- | --- | --- | --- | --- |
| Third Fact PDF | `docs/root-canon/source/BIZRA_Third_Fact_v0_1_FINAL.pdf` (+ root `BIZRA_Third_Fact_v0_1_FINAL.pdf`) | `DESIGNED_NOT_LIVE` (manuscript); doctrine text ≠ runtime close | on `main` | Live Node0-closed |
| Third Fact proof matrix | `docs/specs/NODE0_THIRD_FACT_LIVE_PROOF_MATRIX_0A.md` | `DESIGNED_NOT_LIVE` | on `main` | Live proof harness complete |
| Dema face entry | `bin/dema` @ `9ee508fa` | `VERIFIED` (CLI face exists) | on `main` | Bridged operational Ready / `DEMA_ACTIVE_LOCAL` |
| First-look estate opt-in | `packages/core/src/dema-first-look-home.js` · validation `tests/dema-first-look-home.test.js` · merge #501 `9ee508fa` | `VERIFIED` (opt-in paths coded) | on `main` | RSI / federation / ambient estate auto-bind |
| Fail-closed readiness + actuator | merges #500 + #499 @ `65ff98d3` (ancestry on `main`) | `VERIFIED` (fail-closed tests landed) | on `main` | Multi-node URP |
| Public claim binding | `backlog/tasks/task-030 - PUBLIC-CLAIM-RECEIPT-BINDING-1A-bind-or-remove-every-live-bizra.ai-claim.md` | `UNKNOWN` until AC#1 re-observed | open backlog | Live bizra.ai honesty without re-measure |
| Claim register | `docs/CLAIM_REGISTER_v0_1.md` | `VERIFIED` (register declared) | on `main` | Automated linter enforcement (declared ≠ enforced) |

## Unmapped until clone-resolvable paths exist

Do **not** invent paths. Keep here until a repo-relative path, git SHA, or durable external artifact ID is known:

- Constellation compose WIP (local untracked `.wip` / `season-node0-constellation-compose*` — absent from `origin/main`)
- Gemini funding / valuation chat exports under operator `~/Downloads` (e.g. filename stem `Gemini-تقييم وجذب التمويل…`) — `$` figures remain chat-sourced, not capital proof
- Asana Seed/Gulf outreach examples — no Asana task ID or export receipt bound in this repo yet
- Layer 0 Arabic roots (`البذرة` / `الرسالة`) corpus map
- Chat/agent longitudinal corpus (map before move)
- 200+ research notes absorption atlas

## Does NOT prove (global)

`NODE0_CLOSED`, wireable raise, RSI-LIVE, federation, or that any Gemini/Asana text ≡ `origin/main`.
