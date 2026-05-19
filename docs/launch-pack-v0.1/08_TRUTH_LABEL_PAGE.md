# Truth Label Page · Canonical Taxonomy

> Read this **before** reading any other document in the binder. Every claim in the GTM document, the ADRs, the Known Gaps register, and the runbook is labeled with one of the four labels below. The labels are the protection.

| Field | Value |
|---|---|
| **Canon source** | `[[feedback_law_of_assumption_canon_of_canons]]` · 2026-05-09 entry · "FIRST corpus entry · bounded autonomy under V/D/P/U" |
| **Aliases** | LoA (Law of Assumption) · V/D/A/U · V/D/P/U (older alias · same taxonomy) |
| **Constitutional binding** | All 14 ADRs use this taxonomy · all session memory uses it · all receipt descriptions use it |

---

## The 4 labels (canonical · in increasing distance from disk truth)

### 🟢 VERIFIED

**Definition**: A direct check on disk · in the chain · or in a test run · NOW · returns the claim as true.

**Example uses**:
- "ADR-009 status is Accepted" — VERIFIED (you can `cat docs/06-adr/ADR-009-poi-proof-of-impact-design.md | grep Status`)
- "70 receipts in chain at HEAD" — VERIFIED (you can `ls .proof-forge/receipts/*.json | wc -l`)
- "Zero runtime dependencies" — VERIFIED (you can `grep dependencies package.json`)
- "Node0 sovereign Ed25519 keypair exists" — VERIFIED (you can `ls ~/.bizra/mumo/node0-key.hex`)

**Test of correctness**: a single shell command, file read, or test run can confirm or falsify the claim **right now**.

**Misuse**: claiming VERIFIED when the verification command hasn't actually been run is a zann violation. If you label something VERIFIED, you have actually run the check.

---

### 🔵 DERIVED

**Definition**: Not directly grep-able · but **follows by reasoning** from VERIFIED inputs. The reasoning is shown explicitly so the reviewer can re-derive.

**Example uses**:
- "The architect-self-binding is structurally preserved" — DERIVED (because: 3 years of work on disk + no token mint event in chain + ADR-009 POI-C1 binding refusal = no founder pre-allocation possible)
- "Dema is the right tool for non-Rust contributors" — DERIVED (because: zero runtime deps + plain JS + node --test + 2223 passing tests = no toolchain barrier)
- "ADR-014 closes the wrong-codebase audit pattern" — DERIVED (because: ADR-014 names 3 runtimes explicitly + future audits can be evaluated against the topology = wrong-codebase becomes fast-resolution)

**Test of correctness**: the reasoning chain is explicit; each step references a VERIFIED input; the conclusion follows logically.

**Misuse**: hand-waving over the reasoning ("obviously this implies that") is a zann violation. Each derivation step must be auditable.

---

### 🟡 ASSUMED-with-Ihsān

**Definition**: Cannot be directly verified · cannot be derived from verified inputs · BUT the architect is willing to STATE the assumption explicitly so the reviewer can challenge it. The "with Ihsān" suffix means: the assumption is made carefully · would survive the Daughter Test · would survive Mumu personally being subject to its consequences.

**Example uses**:
- "A typical Ring-1 reviewer will spend 30-60 minutes verifying" — ASSUMED-with-Ihsān (no data yet · this is the first reviewer · estimate based on the complexity of the 6-command demo and 7-claim falsification path)
- "The 90-day plan is right-sized for one operator + one coordinator" — ASSUMED-with-Ihsān (no prior comparable session-arc · this is the first GTM execution at this scope)
- "Samy or alternative reviewer will respond within 20 days" — ASSUMED-with-Ihsān (estimate based on Mumu's relationship · explicit as a risk in §VIII.R1)

**Test of correctness**: the assumption is stated explicitly · the reviewer can challenge it · the assumption has a fallback plan if false.

**Misuse**: stating an assumption as if it were VERIFIED or DERIVED. If the architect wouldn't subject family to the consequence of the assumption being wrong, the label should not be "with Ihsān" — it should be downgraded to UNKNOWN.

---

### ⚪ UNKNOWN

**Definition**: Cannot be verified · cannot be derived · cannot be honestly assumed. The architect declares ignorance rather than fabricate.

**Example uses**:
- "Whether Ring-1 reviewer feedback will be primarily positive or negative" — UNKNOWN (no precedent · don't assume)
- "Whether competing OSS agent frameworks (Pi · Hermes · OpenClaw) will copy the receipt-chain pattern" — UNKNOWN (predicting other actors)
- "Whether Bitcoin will exist at Day 90 for OTS anchoring" — UNKNOWN (extreme · listed to demonstrate the discipline · the actual probability is high but it's still UNKNOWN by canon)
- "Whether your specific terminal supports 24-bit color before you run it" — UNKNOWN (you have to actually try it)

**Test of correctness**: the absence of evidence is the evidence. The architect refuses to fill the gap with confidence theatre.

**Misuse**: there is no misuse · UNKNOWN is always honest. The only misuse adjacent is labeling something UNKNOWN when it could have been VERIFIED by a single command · that would be laziness.

---

## How to read a labeled claim

Every claim in this binder follows the pattern:

```text
<claim text>  [LABEL · optional brief justification]
```

For example, from the GTM document §III.A:

```text
"Formal: 2223/2223 tests · 4 review gates green · 14 ADRs"  [VERIFIED · run npm test + ls docs/06-adr/]
```

You can interpret this as:

- VERIFIED → run the command in brackets to confirm
- DERIVED → look for the reasoning chain in the surrounding paragraphs
- ASSUMED-with-Ihsān → look for the explicit "we assume..." sentence
- UNKNOWN → look for the explicit "we do not know..." sentence

---

## How to challenge a label

If you (the reviewer) believe a label is wrong:

1. Quote the labeled claim
2. State which label you believe is correct
3. Explain why
4. Report in `07_REVIEWER_FEEDBACK_FORM_v2.md` §"Surprises" or §"Found gaps"

**Examples of legitimate challenges**:

- "Document labels X as VERIFIED but I ran the verification command and got Y. The label should be FALSIFIED."
- "Document labels Y as DERIVED but the reasoning chain skips a step. The label should be ASSUMED-with-Ihsān until the gap is filled."
- "Document labels Z as ASSUMED-with-Ihsān but the consequence of being wrong would harm an external party. The label should be UNKNOWN until verification."

---

## Why this taxonomy exists (the load-bearing reason)

BIZRA's constitution rejects two failure modes:

| Failure mode | Why rejected |
|---|---|
| **ZANN** (zhann · speculation passed off as certainty) | Riba-Zero invariant: extracting value from time-decay of unverified claims is the same root structure as financial usury. Confidence theatre is its rhetorical form. |
| **Hidden assumption laundering** | When an architect builds on assumptions they refuse to NAME, the system becomes load-bearing on invisible scaffolding. The first stress event reveals the hidden truth — usually painfully. |

The 4-label taxonomy makes both impossible. Every claim either names its verification path (VERIFIED · DERIVED) or names its uncertainty (ASSUMED-with-Ihsān · UNKNOWN). No claim hides in the gap between.

This is what `[[feedback_law_of_assumption_killer_behavior]]` calls "the canon of canons · the single thing DEMA must always remember."

---

## Sanity check · run this on the binder

After reading the GTM document and the 2 ADRs, count:

| Label | Approximate count in binder | Is the ratio reasonable? |
|---|---|---|
| VERIFIED | _____ (you fill in) | Should be the majority for disk-state claims |
| DERIVED | _____ | Should be moderate · most strategic conclusions |
| ASSUMED-with-Ihsān | _____ | Should be small · explicit forward-looking claims |
| UNKNOWN | _____ | Should be non-zero · architect declaring ignorance is healthy |

**If you see a binder where everything is VERIFIED, suspect zann.** Even disk truth requires interpretation. The 4-label taxonomy creates space for that interpretation.

**If you see a binder where nothing is VERIFIED, suspect drift.** A 70-receipt chain produces VERIFIED facts daily.

The ratio is the discipline.

---

## Cross-references

- Canonical entry: `[[feedback_law_of_assumption_canon_of_canons]]`
- Killer behavior memory: `[[feedback_law_of_assumption_killer_behavior]]`
- Validation canon: `[[feedback_validate_dont_assume]]`
- Verify-before-asserting: `[[feedback_verify_before_asserting]]`
- ZANN_ZERO constitutional anchor: `[[reference_bizra_constitutional_anchors]]`

---

**The four labels are the binder's protection against itself. Use them carefully.**
