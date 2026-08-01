# BIZRA Node0 — Master Specification
### Consolidated state of the system as of Friday 2026-07-31, Dubai

**Truth posture:** index document. Every claim below binds to a canonical
doc or receipt on disk; this spec repeats nothing it can point to.
Evidence classes: `MEASURED` (ran, receipted, this week) · `DECLARED`
(doctrine on disk, not yet built) · `GREENFIELD` (named, nothing on disk).

---

## 1. Identity

BIZRA Node0 is a sovereign, local-first habitat. **Dema** — one per node,
bound for the node's lifetime — is the companion membrane between the human
and the agent teams (PAT ×7, SAT ×5). The quality standard is horological:
*finish the invisible · certify independently · jewel only the friction
points · no complications before chronometry.*

The constitutional law of every effect:

```text
human intention → semantic plan → risk classification → reversible preview
→ exact consent → bounded action → judge-free verification → receipt
→ undo capability
```

## 2. System map (canonical homes)

| Component | Home | State |
|---|---|---|
| Dema habitat (kernels, gates, surfaces) | `/home/…/Downloads/Dema` | MEASURED — 8,307 tests green; coverage gate honestly RED (93.03/78.26) |
| File Factory / GenomeFS estate engine | `/data/bizra/repos/bizra-filefactory` (Downloads copy = shim) | MEASURED — git `7f658d7`+, doctor GREEN |
| MPSC-002 Signal-to-Proof spine | `/home/…/Downloads/bizra-mpsc-002` | MEASURED — 13/13 acceptance |
| Estate (organized Downloads) | `~/Downloads/*` buckets | MEASURED — 1,351 ops applied, reversible |

## 3. Proven substrate (receipts index)

| Proof | Receipt |
|---|---|
| Signal→deploy→outcome chain, 13/13 criteria | `bizra-mpsc-002/receipts/RCPT-MPSC-002-…` |
| Estate organization, 1,351 ops, 0 deletions | `bizra-filefactory/receipts/JRNL-20260731T154640-47ba7251` |
| Rename corridor: apply→verify→undo 100%→re-apply | `…/genome/receipts/CORRIDOR-20260731T155254-d05f5567` |
| GenomeFS capsules 349, lineage 349/349, views 761/0 | `…/genome/*.json` + Proof Card |
| Retrieval index 345/349 (pdf+md+html+docx), consent-gated | `…/receipts/ASK-INDEX-…` |
| Verification-quality pass 18/18 | `…/receipts/VQ-20260731T162335` |
| Admission kernel independent SAT review (F1–F3) | `…/receipts/SAT-XVERIFY-20260731T163000-admission-kernel` |
| Admission kernel 1B weld, 15/15 + 19/19, adversarial probes | `…/receipts/WELD-20260731T164500-admission-kernel-1B` |

## 4. Doctrine ledger

| Doc | Subject | Status |
|---|---|---|
| ADR-049 | Earned-Autonomy Micro-Loop; judge-free VERIFY edge | Proposed; admission kernel now **v0.2 certified** |
| ADR-050 | Loop+harness vs 2026 market golden standard | 13-axis scorecard; gaps → OBS-1, SBX-1, SEC-1, budget-in-GATE |
| ADR-051 | One Dema per node; Two-Plane Federation; Lesson Admission Gate | DECLARED — awaiting operator correction pass |
| DOCTRINE-FILES v0.1.0 | Estate law (never delete, plan-before-touch, consent, reversible, content-is-proof) | MEASURED in practice |
| GENOMEFS-SPEC / VISION | Living Library implemented subset + Sealed Doors | on disk |

## 5. The loop (heart of the node)

```text
PERCEIVE → PROPOSE → GATE → CHECKPOINT → ACT → VERIFY → SEAL → DECIDE
                                            ▲
                     admission kernel v0.2 (PEAK-VERIFY-ADMISSION-1B):
                     verifier admitted only with exact bindings +
                     independent certifier; judgment verifiers refused forever
```

Stage status: **L1 NOT ACTIVATED — blast-radius guards landed, re-certification
pending.** Receipt `DEMA-ACTIVATION-L1-20260731T172500` and its
`L1_MEASURED_SANDBOX` label are **RETRACTED**
(`RETRACTION-20260731T173800-L1-defects`): independent review reproduced four
defects by execution, each of which the loop returned `PASS` for —
E1 occupied-`dst` overwrite (unbacked-up destruction), E2 erasure-by-rename of
the receipt chain (re-anchored at genesis, sealing its own erasure), E3 `resume`
mutating with no lease, E4 symlink scope escape past the lease boundary
(`inside()` was lexical). Guards for all four are on disk with regressions that
transport each attack: `l1-micro-loop.js` now refuses `dst_occupied`,
`act_targets_audit_state`, `lease_scope_violation` (realpath-resolved), and
`lease_required`/`lease_expired`/`lease_mismatch` on resume — plus E5 continuity
(`chain_absent_with_history` via `.l1/last_seal_head`) — **21/21**, and the
four original exploit probes now refuse where they previously returned `PASS`.

What still holds from construction: phase persistence before proceeding,
kill-resume convergence at all 5 boundaries, admission wired before checkpoint
so `self_certification` cannot reach ACT. E5 closed for out-of-band chain
delete when a prior seal marker remains: verify/run/resume fail closed before
mutation; mid-first-cycle crash without a seal remains genesis. Still open:
deleting both `chain.jsonl` and `last_seal_head` still looks like genesis (no
external signed head); suffix truncation still verifies. Promotion to
`MEASURED` is the operator's gate, not this file's.

GATE at L1 = minimal lease (scope·expiry·budget) inside the loop; full lease
kernel C1a/C1b remains the pre-L2 gate. L2 chaining stays sealed behind its own
slice.

Lesson carried forward (belongs in ADR-049 before L2): **admission is not
containment.** The v0.2 kernel asked "is this check judge-free?" and never asked
"what does this act destroy, and can the act reach the evidence it will be
judged by?" Blast radius is a separate gate from verifiability.

## 6. Priority queue (chronometry order — no complications first)

1. **Host session:** re-certify + commit the 1B weld (kernel + preview +
   tests + receipts, one import-closed unit).
2. **Coverage gate to green** — it is a VERIFY substrate; RED disqualifies it.
3. **L1 slice** — first closed cycle: one sandbox rename, kill-mid-cycle
   resume, forged-verify fails, zero authority increase on failure.
4. **Lease kernel** (C1a consolidation → C1b schema; adopt revocable
   resource-and-effect capability shape).
5. ADR-050 slices: OBS-1 (OTel from receipts) · SBX-1 (container sandbox
   mini-ADR) · SEC-1 (secret broker) · budget-in-GATE.
6. GenomeFS Sealed Doors in vision order (UNDERSTAND/LLM slot first).
7. ADR-051 lesson schema + Lesson Admission Gate (post-L1 only).

## 7. Standing boundaries (unchanged, non-negotiable)

No hidden daemon · exact-string consent · proposer ≠ certifier · authority
never rises from failure · economy/federation frozen · localhost-only model
invocation · Personal Plane never egresses · documents are data, never
authority · `Disk wins.`
