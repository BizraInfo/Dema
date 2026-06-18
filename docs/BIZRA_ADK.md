# BIZRA ADK v0.1 — Agent Development Kit

**Slice:** `BIZRA-ADK-AGENT-CONTRACT-1A` + `BIZRA-ADK-TEST-HARNESS-1A`
**Truth label:** `ADK_AGENT_CONTRACT_DEFINE_ONLY` / `ADK_AGENT_HARNESS_READ_ONLY`
**Status:** SHIPPED (define · validate · receipt-preview · adversarial harness)

## Definition

BIZRA ADK is **not** a generic agent SDK. It is a **consent-bound, proof-gated, Ihsān-aware** kit for defining agents that may one day reason, act, and collaborate — but only through BIZRA gates.

```text
Generic ADK:  agent → tool → action
BIZRA ADK:    agent → scope → consent → proof → effect gate → action → receipt → review → STOP
```

## v0.1 boundaries (binding)

| Allowed                | Forbidden            |
| ---------------------- | -------------------- |
| Define agent contracts | Execute agents       |
| Validate contracts     | Network I/O          |
| Preview receipts       | Key generation       |
| PAT / SAT templates    | Signing              |
| Adversarial harness    | Federation           |
|                        | Token / PoI runtime  |
|                        | Raw PAT memory → SAT |

## Core modules (`packages/adk/src/`)

| Module               | Role                                                  |
| -------------------- | ----------------------------------------------------- |
| `agent-contract.js`  | Schema + lifecycle vocabulary                         |
| `agent-scope.js`     | `PRIVATE_PAT` / `SYSTEM_SAT_SUMMARY` scopes           |
| `effect-policy.js`   | Allowed/forbidden effects + always-forbidden defaults |
| `agent-validator.js` | Fail-closed validator                                 |
| `receipt-preview.js` | Receipt preview builder                               |
| `test-harness.js`    | Adversarial negative test harness (read-only)         |
| `pat-template.js`    | PAT role templates (Mirror … Scribe)                  |
| `sat-template.js`    | SAT role templates (Proof Verifier … Impact Scorer)   |

## Required guardrail fields

Every agent contract **must** include:

```text
truth_label, scope, serves, allowed_effects, forbidden_effects,
privacy_class, consent_policy, proof_policy, receipt_policy,
what_this_proves, what_this_does_not_prove, stop_by_default (true)
```

Missing fields → validator refuses.

## PAT / SAT firewall

- **PAT** (`PRIVATE_PAT`, `PAT_RAW_LOCAL`): may see private local context; **must not** leak raw memory to SAT.
- **SAT** (`SYSTEM_SAT_SUMMARY`, `SAT_SUMMARY_ONLY`): receives **proof summaries only**; **must not** receive raw PAT memory.

Always forbidden on every agent: `SIGN`, `FEDERATE`, `MINT_TOKEN`, `EXPORT_PRIVATE_MEMORY`.

## CLI

```bash
dema adk agent validate ./agents/pat-engineer.json
dema adk agent template pat-engineer --json
dema adk agent template sat-verifier --json
dema adk agent receipt-preview ./agents/pat-engineer.json --json
dema adk harness run --json
dema adk harness run ./agents/pat-engineer.json --json
```

## Adversarial harness (1A)

The harness runs **negative tests that must fail** (missing scope, `SIGN` in allowed effects, PAT→SAT raw memory, etc.) and **positive golden templates that must pass**. It proves the validator refuses unsafe contracts before any runtime exists.

```bash
node scripts/review/adk-test-harness.mjs
```

## Agent lifecycle (declared, not executed in v0.1)

```text
DECLARE → BIND_SCOPE → LOAD_CONTEXT → INFER_LOOP_STATE → PLAN
→ REQUEST_CONSENT_IF_NEEDED → EXECUTE_IF_ALLOWED → VERIFY → RECEIPT → LEARN → STOP
```

`STOP` is mandatory. No infinite autonomy.

## Relation to Dema / Node0

- **Dema** = operator face (realm, mumu journey, ADK define/validate).
- **Node0** = governed runtime (`npm run node0`) — outside ADK v0.1.
- **PAT-7 / SAT-5** live runtime remains `DESIGNED_NOT_LIVE` per Component DNA.

## Verification

```bash
node --test tests/adk-agent-contract.test.js tests/adk-agent-scope.test.js tests/adk-pat-sat-firewall.test.js tests/adk-test-harness.test.js
node scripts/review/adk-agent-contract.mjs
node scripts/review/adk-test-harness.mjs
npm test
npm run check
```

## Future slices (not in v0.1)

- `dema adk init`, publish-template, package-node
- `@bizra/adk-hhmm`, `@bizra/adk-snr` as separate bounded modules after ADR + proof gate
- Agent execution only after EffectCap + consent + receipt spine integration
