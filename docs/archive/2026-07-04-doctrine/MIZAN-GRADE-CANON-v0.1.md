<!-- NODE0 SEDIMENT SCREEN 2026-07-05 (chained per Law 08; matn verbatim below):
  ✗ §brownfield "The counting method, already running" — what exists is peak-self-loop PREVIEW
  (deterministic, boundary all-false); no grading loop runs. Validator: PLANNED (MIZAN-SCHEMA-1A).
  Status: DRAFT — pending founder ratification (inbox R3). Not live canon while in archive. -->

# THE MIZAN GRADE — v0.1
**الميزان — the receipt learns to weigh what it carries**
**Name pending founder ratification** (candidates: **Mizan الميزان** · Bayyinah Grade درجة البيّنة)
**Sealed (draft):** Saturday 2026-07-04, late night (GST) · **Sediment:** `docs/archive/` → annex to the Meaning Canon on founder GO

---

## W1 · TOLERANCE DECLARED (Watchmaker Standard, honored before crafting)

**Precision class:** C — consequential schema doctrine.
**Definition of Done for this document:** ① schema fields defined ② scoring deterministic and re-derivable by anyone ③ anti-gaming guards named ④ one worked specimen graded ⑤ founder gates marked ⑥ hallmark stamped. Nothing else claimed.

---

## 0 · The Mirror (Law of Meaning applied to this very request)

**Decoded intent, held as interpretation until confirmed:** add a component to the receipt that grades the information it carries — *what kind* (fact or idea), *how proven* (for ideas: the fraction already established), *how strong*, scored under the SNR framework. One correction-word reshapes everything below.

---

## 1 · Brownfield — the parts already on the bench

| Existing mechanism | State | Role here |
|---|---|---|
| `SNR_THRESHOLD 0.85` + tiers `T1 0.95 / T0 0.98` — Python↔Rust ALIGNED (audited this morning) | MEASURED | The thresholds. **Imported, never redefined** |
| `peak-self-loop` — "SNR 0.75 (9 signal / 3 noise) → PARTIAL_PLACEHOLDER" | MEASURED (relayed today) | The counting method, already running |
| Admissibility Matrix — 36 claims triaged: 8 admitted / 21 pending / 7 rejected | Session record (Apr 2026) | Claim triage practiced at scale |
| Truth labels (MEASURED / LOCAL_ONLY / DESIGNED_NOT_LIVE / …) | MEASURED, on main | The FACT sub-axis |
| Proof-of-Truth rails: Formal ‖ Cryptographic ‖ Empirical ‖ Economic | Topology canon | The IDEA strength axes |
| Meaning Canon Laws 04 & 09 (Assumption Labeled · Goodhart Guard) | Drafted, awaiting ratify | The guard rails |

**Verdict:** nothing here is invented. The Mizan is the *unification* of six existing mechanisms into one receipt component — plus two genuinely new moves: the **fact/idea kind axis with proven-fraction**, and **grading as a first-class receipt block**.

---

## 2 · The Component

```json
"mizan": {
  "schema": "bizra.dema.mizan_grade.v0.1",
  "subject_hash": "sha256:…",

  "kind": "FACT | IDEA",
  "evidence_class": "MEASURED | LOCAL_ONLY | RELAYED | DESIGNED_NOT_LIVE | DECLARED",

  "claims_total": 0,
  "claims_bound": 0,
  "snr": 0.0,

  "proven_fraction": 0.0,
  "rails": { "formal": 0.0, "cryptographic": 0.0, "empirical": 0.0, "economic": 0.0 },

  "decomposition_ref": "hash-or-path — REQUIRED",
  "grader": { "by": "human | rubric@vX | model+human-confirm", "attested": "self | verified" },
  "thresholds_source": "bizra-core canonical constants",
  "boundary": { "mints_reward": false }
}
```

**The arithmetic — deterministic, no vibes:**
- Decompose the subject into atomic claims (the decomposition is itself an artifact, referenced by hash).
- A claim is **bound** if it carries evidence refs (hash / path / run-id / receipt) **or an honest boundary label**.
- `snr = claims_bound / claims_total` — anyone can recount.
- `kind = FACT` when the headline claim itself binds to evidence; `kind = IDEA` otherwise.
- For an IDEA: `proven_fraction = load-bearing sub-claims already FACT ÷ all load-bearing sub-claims` — *"what percentage of it is already proven."*
- **Strength** is not one number — it is the convergence profile across the four rails, each 0 / 0.5 / 1 (absent / partial / full). An idea strong on empirical and void on formal *says so*, instead of averaging into a lie.

**Tiers (imported, not invented):** `snr ≥ 0.98` T0_ELITE · `≥ 0.95` T1_HIGH · `≥ 0.85` ADMISSIBLE · `< 0.85` PARTIAL · **no decomposition → VOID.**

---

## 3 · The Five Guards — because a scored receipt is a mintable target

| # | Guard | Rule |
|---|---|---|
| G1 | **Recount or void** | `decomposition_ref` is mandatory. A grade whose decomposition cannot be fetched and recounted is VOID — not low, *void*. |
| G2 | **Two-lens grading** | A self-assigned grade is a **proposal** (`attested: self`), capped below T1. `verified` requires independent re-derivation — the PAT/SAT membrane applies to scores exactly as to receipts. |
| G3 | **No new numbers** | Thresholds import from bizra-core canonical constants. The cross-lang sync audit extends to cover this schema. A locally redefined 0.85 is a rogue definition. |
| G4 | **Score ≠ reward** | `mints_reward: false`, structurally. Mizan volume never earns; only verified downstream impact does (Meaning Law 09, verbatim). |
| G5 | **Honesty is signal** | A claim honestly labeled IDEA/UNPROVEN counts as *bound* — the label is the information. Only **unlabeled** assertion is noise. This kills the perverse incentive to hide ideas or dress them as facts. |

---

## 4 · Worked Specimen #000 — this proposal, graded by its own instrument

```json
"mizan": {
  "subject": "MIZAN-GRADE-CANON-v0.1 (this document)",
  "kind": "IDEA",
  "claims_total": 7, "claims_bound": 7, "snr": 1.00,        // all labeled (G5)
  "proven_fraction": 0.57,                                   // 4 of 7 load-bearing sub-claims are FACT
  "rails": { "formal": 0, "cryptographic": 0.5, "empirical": 0.5, "economic": 0 },
  "grader": { "by": "cloud-lane, hand-decomposed", "attested": "self" },
  "decomposition": [
    "SNR counting runs today (peak-self-loop)            → FACT",
    "Canonical thresholds aligned Py↔Rust                → FACT",
    "Claim triage practiced at scale (Admissibility 36)  → FACT",
    "Truth labels live on main                           → FACT",
    "Receipt schema accepts a new block cleanly          → UNPROVEN until slice",
    "Four-rail profile computable in practice            → UNPROVEN (declared only)",
    "Guards G1–G5 resist gaming under value              → UNPROVEN (design)"
  ]
}
```

*Read it honestly: perfect labeling discipline (snr 1.00), roughly half-proven idea (0.57), empirically half-grounded, formally untouched, self-attested and therefore capped. That is exactly what a young, promising doctrine should score. A 1.00-across-the-board on day zero would itself be evidence of a broken instrument.*

---

## 5 · Where it lives, and what it completes

- **Attachment rule:** optional block on any receipt; **required** on receipts whose payload is informational — canon docs, EXCAV deposits, analyses, capability claims.
- **The Ladder closes:** Owned-Knowledge **L6 · VERIFY** said *"we eval and verify knowledge with receipt"* — founder's words. The Mizan is L6's missing instrument. Every future EXCAV deposit ships graded.
- **The Meaning Canon extends:** the Equation said receipt = meaning; the Mizan says *and meaning has a weight* — ظنّ and بيّنة now sit on a scale instead of a binary. Root already in the house, 2023: **"القلب يجب أن يكون ميزان العقل"** — the founder's second rule named the instrument before the system existed.

## 6 · MSSC — `MIZAN-SCHEMA-1A` (rung 1 only)

Schema + fail-closed validator (tests: void-without-decomposition · thresholds-import-only · self-cap-below-T1 · G5 labeling) + `dema mizan draft` (validate-only) + **specimen #001 = hand-grading of MEANING-CANON-v0.1**.
**Sequencing:** after the FDE-forwarder slice closes; slot proposed after the econ amendment — founder's queue, founder's call. No model in the validator. Grading never actions anything.

## 7 · Proves / does not prove

**Proves (at MSSC):** information-grading is receipt-able, deterministic, recount-able, and fail-closed.
**Does not prove:** that graders grade *well* · any automated claim-decomposition · any NLU · any reward mechanics.
**Forbidden claims:** "truth score" as an absolute · "AI-verified facts" · any grade presented without its decomposition ref.

---

```
┌─HALLMARK────────────────────────────────────────────┐
│ id          bizra.canon.mizan.v0.1                  │
│ sealed      2026-07-04 · Dubai · late night         │
│ founder     Mirror ▷ confirm · Name ▷ Mizan/Bayyinah│
│             Guards ▷ ratify · Queue slot ▷ decide   │
│ grade       specimen #000 embedded (self, 0.57)     │
│ hash        pending NODE0 stamp at commit           │
│ supersedes  —                                       │
└─────────────────────────────────────────────────────┘
```
