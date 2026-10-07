# PROD-01 Acceptance Truth Reconciliation 1A

**Task of record:** `TASK-075.02.01` (child of `TASK-075.02`)

**Audit mode:** Read-only evidence reconciliation. No runtime, verifier, supervisor,
network call, principal activation, model invocation, PAT/SAT work, or production-code
change was performed by this audit.

**Current Dema checkout:** `7f4ce3a7f06a201821cc557887d768ab978aced9`.

## Mission

Re-derive each PROD-01 acceptance criterion from exact C6b evidence. Historical C3
narrative is not used as a passing source. This audit does not alter the parent task's
acceptance criteria; it determines whether their current truth surface agrees with the
admitted C6b packet.

## Bound evidence

The audited package is:

```text
/data/bizra/node0-closure/runtime/prod01-runtime-persistence-3a
PACKAGE_DESCRIPTOR.json
sha256:341ed689a78be7b7fa4965330da95b9bd5a147797621a71c592cc826278240cd
```

Its one-use authorization record is terminally `CONSUMED` and binds that same package
digest. The package scope is one `127.0.0.1:7421` producer, one bounded mission POST,
bounded GET observations, forced SIGKILL, one restart on the same receipt-store path,
and automatic final shutdown. It forbids principal activation, public network, model
invocation, Node1/Node2, federation, minting, and authority increase.

| Bound object | Exact binding |
| --- | --- |
| Producer source | `3f4d8fae83af645610c436f8e7356605946f5a58` / tree `c9ceb9b7e759af9037c3c1800b9a32027aea71f4` |
| Producer binary | `sha256:abf5ced44f6228dca9fc1ada2e63c35847b453283a7dcec192896e4843da02da` |
| Dema consumer | `bf1a6ba9ef886dbc3f525dded1fedb1715001ad6` / tree `6199dcbfdd04320b65c9164232360ac5e5882a76` |
| Supervisor | `sha256:fb0336a0d4e2cf353d5e2c907a92f727adaea2a36dc2ebb22d900d9190b0a623` |
| Deterministic evidence verifier | `sha256:a02bce3c4689d0bb0aac48d294ac10873641684854427caba162d8ff5ef69860` |
| Post-run verifier receipt | `PROD01_C6_PERSISTENCE_PROOF_RECEIPT.json`, `sha256:028baacad3995a0fd4fb5018528bdbe626ae9205d957e1d4318cbbd27ab10dc6` |

The live binary and source bindings were re-read during this audit and still match the
bound values. The verifier itself was deliberately **not executed**: a prior forensic
audit established that executing an unreviewed verifier may create a disposable runtime
side effect. This document instead reads its receipt and independently compares the raw
artifact bytes it names.

## Diagnostic contract

| Rail | Re-derived evidence | Limit |
| --- | --- | --- |
| Provenance | Descriptor, consumed one-use record, source/tree/binary bindings, and content-addressed evidence paths agree. | Establishes the exact C6b run package, not a currently running Node0. |
| Consistency | Pre/post mission, chain, and principal-status response files are byte-identical; their SHA-256 values match the receipt's evidence map. | Equality alone would be weak without forced-death disambiguation. |
| Disambiguation | Phase 1 records PID `4046477`; phase 3 records SIGKILL, dead predecessor, and free port; phase 4 records fresh PID `4046570`; phase 7 records final SIGKILL, dead predecessor, and free port. | Proves this bounded fixture's two-process transition only. |
| Corroboration | Separate post-run verifier receipt reports `12` passed and `0` failed; raw headers, JSON, control records, source bindings, and file hashes were independently re-read here. | The receipt's identity verdict remains a negative result; Dema status was explicitly unavailable and is not used as transport or identity proof. |

## AC matrix

| AC | Predicate | Verdict | Exact evidence | Scope and reason |
| --- | --- | --- | --- | --- |
| 1 | Real PID observed, not asserted | **PASS** | `control/phase-1-start.json` (`sha256:a51f84a00665ab4613ab9ca29ac0945d01258fda519ab809fb2d433473604f88`) records PID/PGID/SID `4046477`; restart record names fresh PID `4046570`. | The bound binary is recorded with its exact SHA-256 and was re-read at the bound path. This proves process observation in the C6b run, not a currently live PID. |
| 2 | Real localhost endpoint observed, not hardcoded | **PASS** | Phase 1 and phase 4 records name `127.0.0.1:7421` and `health: PASS`; pre and post health headers are `HTTP/1.1 200 OK`. | Bounded loopback endpoint only. It does not prove external reachability or PROD-02 transport. |
| 3 | Real persisted state survives process death | **PASS** | Pre/post mission response: `sha256:b4ebbe162e4ed2d1dafda17fc47d6df73e68243f58d7aa42ebe27de57027bb87`; authoritative receipt-store snapshot exists with chain head `69500a19186b3648b765df212747236cfc365d544ae52c78863a614146f05890`, length `9`. | The first process was forcibly killed before the distinct restart process returned the same recorded mission. Scope is one admitted fixture in the bound receipt store. |
| 4 | Kill/restart proves mission state reconstructs from home, not fresh state | **PASS** | Phase 3 forced-death record: `sha256:40d6b4fd72e1d985264972835cab542fb867d3bbd103f67a243bf49343cbeecb`; phase 4 restart record: `sha256:bc54ff11ceb1d5c3a932a4e9b4225b3ba0ba1f17f82dd1100213021c4e2874c5`; post-restart `GET /missions/:id` is `200` and byte-identical to pre-kill output. | The supervisor uses the same `BIZRA_RECEIPT_STORE_PATH` for both starts. A fresh state could not supply the admitted mission response after the first process was killed. |
| 5 | Runtime identity is chain-sealed and verified | **FAIL** | Both pre/post principal-status files (`sha256:49f091f97f77f5af6ef691e0f768bb0ae9a22cc6a00a3b7b5e7595507f98d2d2`) report `verdict: ABSENT`, `identityVerified: false`, `activeChainRecordFound: false`, and `canonicalPayloadAvailable: false`. The descriptor says `runtime_identity: NOT_PROVEN_BY_THIS_PACKET`; the verifier verdict is `PERSISTENCE_EVIDENCE_CONSISTENT_RUNTIME_IDENTITY_NOT_PROVEN`. | Chain continuity alone is not a verified runtime identity. The packet forbade principal activation, so this is an explicit negative result, not an inference from missing prose. |
| 6 | Mission identity unchanged across restart | **PASS** | The complete pre/post mission JSON files are byte-identical. They preserve the same mission ID, receipt ID, chain head, timestamp, intent, stage, rejection state, and admissibility object. | One exact fixture and one restart only. It does not prove arbitrary mission recovery. |
| 7 | No human intervention required for restart | **PASS** | The bound supervisor calls `start_gateway 'phase-4-restart'` immediately after `stop_gateway_sigkill 'phase-3-sigkill'`; the phase timestamps differ by milliseconds and the control record reports fresh PID `4046570`. | Pass is limited to the automated C6b supervisor transition. It does not claim unattended service boot after machine restart or a general daemon manager. |
| 8 | Predecessor process not still live | **PASS** | Phase 3 records `wait_status: 137`, `predecessor_dead: true`, `port_free: true`; final shutdown has the same fields for PID `4046570`. | Both controlled processes were proven dead within the bounded run. Current port inspection also found no listener on `7421`. |

## Result

```text
AC1 PASS   real process observed
AC2 PASS   real loopback endpoint observed
AC3 PASS   bound persisted mission survives forced death
AC4 PASS   restart reconstructs that mission from the same receipt-store path
AC5 FAIL   runtime identity absent and not verified
AC6 PASS   mission identity byte-identical across restart
AC7 PASS   restart automated inside the bound supervisor
AC8 PASS   predecessor dead and port free

PROD-01 FORMAL CLOSURE: OPEN
SINGLE REMAINING BLOCKER: AC5 / runtime identity chain-sealed and verified
AUTHORITY DELTA: 0
```

No parent checkbox is changed by this audit. The parent task can become a closure
candidate only after a separately authorized, evidence-bound identity proof satisfies
AC5 and its Definition of Done item "Runtime identity verified." That future proof must
not reuse this consumed C6b authorization and must not reinterpret an `ABSENT` principal
status as a passing identity.

## Non-claims

- This does not prove that Node0 is currently running, healthy, or product-closed.
- This does not start or qualify Dema-to-Node0 execution transport (PROD-02).
- This does not activate a principal, invoke a model, make PAT-7 live, connect SAT-5,
  or authorize federation, public network, or any authority increase.
- This does not establish multi-mission, multi-device, public-service, or unattended
  machine-boot recovery behavior.
