# SAT Role Boundary — Constitutional Guard Contract v0.1

**Status:** `DECLARED` — doctrine + contract, not runtime. No SAT runtime code is
introduced by this document.
**Scope:** BIZRA Node0 + Dema local Genesis Realm.
**Truth boundary:** This file defines the _boundary_ SAT must obey. It is not a
receipt, not a verifier, not CI output. It binds future code; it executes nothing.

**Companion to:** [`pat-builder-sat-validator.md`](pat-builder-sat-validator.md)
(authority/topology layer) and [`../canon/LAW_OF_ASSUMPTION.md`](../canon/LAW_OF_ASSUMPTION.md)
(the V/D/A/U claim discipline SAT enforces).

---

## 0. The correction this encodes

SAT is **not** "another agent team helping MuMu build." That collapse destroys the
property that makes BIZRA trustworthy: PAT cannot mark its own homework.

```text
Dema   = bridge and mission steward
PAT-7  = personal agent team serving MuMu      (warm creation layer)
SAT-5  = constitutional guard layer serving BIZRA law  (cold governance layer)
```

One-line law:

```text
PAT proposes.
SAT verifies.
Dema routes.
MuMu consents.
Receipts preserve.
PoI rewards only after proof.
```

SAT exists so PAT cannot self-verify, self-reward, or self-canonize. SAT is the
constitutional immune system, not a creative swarm and not merely "security."

---

## 1. The two layers

|                     | PAT + Dema (warm)                                                          | SAT (cold)                                                                       |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Serves              | MuMu                                                                       | the BIZRA constitution                                                           |
| May                 | propose · imagine · plan · build · implement · optimize · draft candidates | verify · block · audit · challenge assumptions · enforce claim discipline        |
| Must not            | self-verify · self-reward · self-canonize · overclaim                      | build · create reward for itself · accept unverified impact · approve on "vibes" |
| Output              | candidate artifacts (proposals, plans, code)                               | a structured, fail-closed **verdict**                                            |
| Visible to operator | yes (via Dema)                                                             | no (Dema surfaces the verdict, not the persona)                                  |

PAT expands possibility; SAT constrains authority. PAT builds the candidate; SAT
decides whether the candidate is allowed to become **state**.

---

## 2. SAT-5 roles (code-anchored, live)

Source of truth = `packages/agents/src/agent-profile-registry.js` `SAT_ROLES`
(ids `sat.verifier`, `sat.compliance`, `sat.resource`, `sat.economist`,
`sat.evolution`). These are the names this contract uses.

| Role           | Guarding question                                           | Checks                                                                                                                     |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Verifier**   | Can this be re-checked by someone who does not trust us?    | proofs · tests · receipts · deterministic rules · signatures · replayability                                               |
| **Compliance** | Is the claim stronger than the proof?                       | claim discipline · consent law · forbidden fields · truth labels · public/economic boundary · Law-of-Assumption compliance |
| **Resource**   | Is this action allowed to use these resources?              | hardware · data · tool · privacy · URP · cost · local-resource boundaries                                                  |
| **Economist**  | Did verified impact happen, or is this only activity?       | PoI scoring · reward validity · anti-gaming · token movement · local settlement · impact-verified-before-reward            |
| **Evolution**  | Did the system actually improve without damaging integrity? | RSI safety · regression risk · performance delta · learning validity · measured-not-assumed improvement                    |

### ⚠️ Role-naming drift (must be reconciled, not hidden)

`pat-builder-sat-validator.md:34` names SAT-5 as **S1 Validator · S2 Oracle
[FROZEN] · S3 Mediator · S4 Archivist · S5 Sentinel** — a _different_ set from the
executable registry above. This is on-disk drift between two sources.

**Resolution for Node0:** the executable `agent-profile-registry.js` `SAT_ROLES`
(Verifier/Compliance/Resource/Economist/Evolution) is the live truth, because code
and tests bind to it (e.g. `flywheel-sat-validation.js` derives its legal-validator
set from `CANONICAL_AGENTS` where `agent_class === "SAT"`). The S1–S5 naming in the
topology doc is older shorthand and should be reconciled in a follow-up doc edit —
not silently overwritten here.

---

## 3. The SAT verdict contract (DECLARED)

Every SAT decision must be machine-checkable enough to become a receipt field
later. Two shapes are sanctioned.

Full verdict envelope:

```json
{
  "sat_agent": "Verifier | Compliance | Resource | Economist | Evolution",
  "input_ref": "",
  "checks": [],
  "verdict": "APPROVE | REJECT | BLOCKED | NEEDS_EVIDENCE",
  "reason": "",
  "truth_label": "",
  "what_would_disprove_this": "",
  "next_verification_step": ""
}
```

Minimal gate return (for the first verdict functions):

```json
{
  "approved": false,
  "reason": "missing_receipt",
  "blocking": true,
  "truth_label": "PARTIAL",
  "required_next_step": "provide verifier result"
}
```

Fail-closed is the default: any missing required declaration → not approved.

---

## 4. What SAT may block

Inside the architecture (not spiritually, not personally), SAT may block a system
transition that violates the constitution — including transitions initiated by
MuMu, PAT, Dema, or SAT itself:

- mutation without consent
- reward without verification
- XP without receipt-backed evidence
- House of Wisdom entry without proof
- public claim without a truth boundary
- Block0 step without prerequisite proof
- an assumption promoted as fact
- a semantic claim dressed as deterministic proof
- **any agent self-verifying its own reward**

This mirrors the "sovereign-bypass" anti-pattern (anti-pattern 6) already declared
in [`pat-builder-sat-validator.md`](pat-builder-sat-validator.md): consent
authorizes the _attempt_; SAT decides whether the attempt is _admissible_. Both are
required and independent.

---

## 5. Node0 Genesis-hosted URP SAT vs future multi-node shared-URP SAT

Per [`../canon/BIZRA_TOPOLOGY_CANON.md`](../canon/BIZRA_TOPOLOGY_CANON.md) (cited in
the companion doc): each human node mints PAT-7 locally and contributes SAT-5 into
one shared Universal Resource Pool. **SAT custody, logical location, loyalty, and
authority are always URP/system-side, never human/PAT-side.**

At Genesis, Node0 may physically host the one URP on the same machine because no
second node exists yet. That is physical co-location only. It MUST NOT be described
as local SAT, user-owned SAT, or SAT inside the human node. The constitutional
membrane remains logically intact even when both domains temporarily share one
physical host.

That cross-node shared pool is federation and remains `forbidden-until-proven`
(see NODE0 checklist forbidden claims: `public federation live`, `Node1/Node2
network live`). Node0 therefore does not wait for federation: it must demonstrate
the **URP-resident SAT pattern on one physical machine without collapsing the
membrane**:

```text
LOCAL HUMAN DOMAIN                 SYSTEM / URP DOMAIN
MuMu -> Dema -> PAT proposal  ->  membrane -> SAT audit
                                      |
MuMu consent authorizes attempt      |
                                      v
governed action <- PERMIT/REFUSE <- SAT constitutional verdict
       |
       v
receipt proves -> reward only after verified impact
```

The human controls PAT and consent. The human has no ownership or management
authority over SAT. SAT serves the BIZRA constitution and the whole system. New
nodes add SAT capacity into the same URP; they do not create per-user SAT domains
or complete missing organs.

---

## 6. Implementation boundary (binds future code)

Do **not** implement SAT as free-form chat personas. Implement SAT as
**role-bounded verdict functions**, fail-closed and receipt-ready:

```text
satVerifierCheck()      satComplianceCheck()    satResourceCheck()
satEconomistCheck()     satEvolutionCheck()
```

Each returns the minimal gate shape in §3. None may build, reward itself, or accept
unverified impact.

**Registry contract extension (DECLARED, not yet wired):** every PAT/SAT profile in
`agent-profile-registry.js` should explicitly carry:

```text
serves                 # "MuMu" (PAT) | "BIZRA constitution" (SAT)
may_do[]               # the warm/cold permissions from §1
must_not_do[]          # the forbidden actions from §1
can_block[]            # the transitions this agent may halt (SAT) / [] (PAT)
required_receipt_fields[]  # what a verdict by this agent must emit (§3)
```

This is a contract declaration. Wiring it into the registry schema + tests is a
separate, GO-gated slice — **no runtime code in this document.**

---

## 7. Disk reality (truth-labeled)

| Artifact                                                                       | Truth label            | Note                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This boundary contract                                                         | `DECLARED`             | binds future code; executes nothing                                                                                                                                  |
| `agent-profile-registry.js` SAT_ROLES                                          | `MEASURED_LOCAL`       | the live 5-role identity set                                                                                                                                         |
| `flywheel-sat-validation.js` (SAT-VALIDATE-1A)                                 | `MEASURED_LOCAL`       | first real SAT gate: an **Economist/Verifier-shaped** check — re-derives impact→XP, enforces no-self-verification, signs a fail-closed verdict receipt. 10/10 tests. |
| 5 named `satXxxCheck()` verdict functions                                      | `DESIGNED_NOT_LIVE`    | only the XP-validation gate exists today                                                                                                                             |
| Registry `serves`/`may_do`/`must_not_do`/`can_block`/`required_receipt_fields` | `DESIGNED_NOT_LIVE`    | declared in §6, not wired                                                                                                                                            |
| Cross-node shared-URP SAT pool                                                 | `BLOCKED` (federation) | forbidden-until-proven                                                                                                                                               |

The existing `flywheel-sat-validation.js` is the proof that the corrected model is
already partly real: it is a verdict function, not a persona; it blocks PAT from
marking its own homework (`self_validation_forbidden`); its output is content-
addressed and re-verifiable under the external key. What remains is to generalize
that single gate into the full SAT-5 contract above.

---

## 8. The forbidden mistake

Wrong (vibes):

```text
SAT approves because the idea is aligned.
```

Correct (checks):

```text
SAT approves because these checks passed, these receipts exist, these assumptions
are bounded, and these failure cases were rejected.
```

---

## 9. Final rule

```text
PAT is allowed to be creative.   SAT is required to be strict.
PAT expands possibility.         SAT constrains authority.
PAT builds the candidate.        SAT decides if it may become state.
PAT serves MuMu.                 SAT serves the BIZRA constitution.
Dema must show both voices clearly.
```
