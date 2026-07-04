# DEMA Node0 World-State Cockpit — Design Concept v0.2 (Refactor)

**Truth label:** `DESIGN_CONCEPT_NOT_LIVE` · Sources: الرسالة · البذرة · Third Fact v0.1 · UX chat history (Peak Performance Activation) · Node0·Dema Lifecycle Wireframes t1/t2 *(provenance: GPT design session — proposer lane; absorbed here under CLAIM_MUST_BIND)* · Dema Brand Film shell
**Date:** 2026-07-02 · **Supersedes:** the implicit v0.1 concept scattered across the cockpit artifact + wireframes

---

## 0. The verdict that unlocks the refactor

The open question — *Awwwards spectacle vs. restraint-and-proof* — is already answered inside the corpus, three times:

1. Chat history, gate verdict: **"The masterpiece move remains restraint: proof density over motion."**
2. Third Fact, Pillar 02 (الخشوع الحقيقي): *confidence only where there is proof, restraint where there is uncertainty.*
3. The cockpit critique's closing law: *make the UI incapable of accidentally claiming more than the underlying Dema repo proves.*

**Refactor thesis: CLAIM_MUST_BIND applies to pixels.** Every rendered element is a claim. A glowing "Active" panel is an overclaim. A decorative hash is a forged receipt. Therefore the design system's distinctive craft — the thing that could actually win an award, in a category nobody else occupies — *is* proof density itself. Spectacle is not banned; it is **rationed to exactly one moment** (§4).

---

## 1. Core defect in v0.1

The wireframes present two competing spatial metaphors as siblings:

- **t1 — the Lifecycle** (Niyyah → Basirah → Khayal → Mithaq → Tafsil → Tawbah → Tadarruj): the operator's journey through **time**.
- **t2 — the APR Refinery** (Distill → Crack → Catalytic → Fraction → Bind → Grade): the proof engine's **machinery**.

Treated as alternatives, they force a false choice and invite a second cockpit-style artifact that duplicates state. The chat history already names the correct relation:

> *The Cockpit is the human-facing control plane. The APR is the proof-processing engine. Receipt atoms are the shared currency between them.*

Wireframe **2b** ("cockpit ⟂ refinery") is therefore not one option among seven — **it is the master frame**. The other six framings are *states of its two planes*.

---

## 2. Refactored spatial model — one screen, three strata

```
┌──────────────────────────────────────────────────────┐
│ STRATUM A · CONTROL PLANE (operator · time)          │
│   journey rail: 1a subway-line (first run / newcomer)│
│   collapses to → 1c loop dial (steady state)         │
│   expands to  → 1b stepper (resumable onboarding)    │
│   overlay     → 1d swimlanes (trust-boundary view)   │
├──────────────────────────────────────────────────────┤
│ STRATUM B · ATOM STREAM (shared currency)            │
│   2c receipt-atom card = the hero unit               │
│   front: claim · SNR · risk · truth label            │
│   back: proves / does-not-prove / critique / consent │
├──────────────────────────────────────────────────────┤
│ STRATUM C · APR ENGINE (autonomous · machinery)      │
│   2a six-tower pipeline, visually subordinate        │
│   pause/resume · speed · pressure gauge              │
└──────────────────────────────────────────────────────┘
```

Rules of the strata:

- **A commands, C computes, B is the only thing that crosses.** No control in A reaches into C except by producing or consenting to an atom in B. This renders Anti-Pattern #5 (authorization laundering) structurally impossible in the UI: there is no widget through which relayed consent could flow.
- **Stage mapping:** the APR's six towers live *inside* lifecycle stages 2–5. Basirah feeds Intake; Khayal = Distill+Crack+Catalytic (simulation/critique); **Mithaq = Bind** (the shared gate — one gate, drawn once, in both vocabularies); Tafsil = Grade + chain. Tawbah and Tadarruj are control-plane-only stages (the engine never initiates reversal or learning).
- **Newcomer/returning duality:** same track, two densities. 1a/1b for first run; 1c dial as the persistent home for the returning operator. Never two products.

---

## 3. Color is a truth-state channel, never decoration (canon)

The wireframes already converged on a semantic palette. Promote it from habit to law:

| Token | Hex | Meaning — and nothing else |
|---|---|---|
| `ink` | `#1a1a1a` | verified structure, chrome |
| `paper` | `#f0eee9` / `#fbfaf7` | ground; the document, not a dashboard |
| `amber` | `#c47a1c` | **human gate**: consent pending, GO required, Mithaq |
| `blue` | `#2a78d6` | reversal path: Tawbah, undo, branch |
| `green` | `#2f8a57` | sealed / chained / learned: post-proof states only |
| `mut` | `#8a857c` | metadata, uncertainty, heuristic scores |

Corollaries: nothing is green before its chain hash exists; amber may pulse (it marks the one human obligation on screen); green never animates (proof is calm); gradients and glow are banned except inside §4.

Typography carries the same duty: hand-drawn faces (Caveat / Architects Daughter) mark *proposal-stage* content — sketches, previews, unproven framings; monospace marks *receipt-grade* content — hashes, labels, counts. The moment something seals, its type shifts from hand to mono. The wireframe aesthetic thus survives into product as a **truth gradient**, not a style.

Bilingual spine: stage names render as Arabic script + transliteration + one-word gloss (نية · Niyyah · intent). The Heart documents are Arabic; the interface must not orphan them.

---

## 4. The Mithaq moment — the single permitted ceremony

Resolution of spectacle-vs-restraint: **95% of the interface is quiet paper. One beat is theater — the typed consent.**

When an atom reaches Bind: the engine stratum dims and pauses, the control plane locks, focus collapses to the atom's back face, and the consent phrase must be typed exactly (never pasted, never pre-filled, never a button). On seal: a single, fast, non-looping transition — hand-type → mono, amber → green, hash chip computes *visibly* (real `crypto.subtle.digest`, characters resolving as the digest completes), card drops into the chain.

This is theater in service of gravity: the ceremony exists because the moment is constitutionally heavy, not because the screen was boring. Batch consent (LOW/MEDIUM risk only) gets the same ceremony once per batch with an explicit batch phrase — per the chat-history correction, **auto-consent does not exist** in any state, animation, or copy.

---

## 5. Truth labels are a first-class UI material

Every panel bears a label chip, top-right, mono, muted — from the settled set: `PREVIEW_SIMULATION_ONLY` · `GATED_OPERATOR_ONLY` · `MEASURED_*` · `DESIGNED_NOT_LIVE` · `SIMULATED_MANUAL_INPUT_ONLY` · `DEMO_LEDGER_NOT_CRYPTOGRAPHIC` · `WAITING_FOR_WITNESS`.

The four audited cockpit overclaims become permanent design rules:

1. **Network claim ↔ network reality.** "Zero external calls" may render only in a self-contained build (fonts subset + embedded, as the wireframe bundle already does). Otherwise the claim is absent — not softened, absent.
2. **No decorative hashes.** A hash chip either recomputes live from the canonical JSON of the content it sits on, or it is labeled `DEMO_HASH_NOT_BOUND`. Formula stays canon: `receipt_hash = SHA-256(canonical_json(receipt_without_hash_fields))`; `chain_hash = SHA-256(prev + ":" + receipt_hash)`; genesis = `SHA-256("GENESIS:" + receipt_hash)`.
3. **Heuristics are labeled heuristic.** SNR word-scoring, "self-*" traits, convergence meters: `HEURISTIC_NOT_PROOF`. "SMT-gating" never appears over a string check.
4. **Counts are audited claims.** Any "N panels / N tests / N receipts" copy is derived from the live DOM/state at render, never hardcoded. (The stale `6,090` class of bug dies here.)

---

## 6. Invariants → interaction law

The ten APR invariants translate into behavior, not documentation:

- Seal control **does not exist** (not merely disabled) until critique + compliance pass — absence is the honest state.
- `READY_REMOTE` and `PUBLIC_SAFE` render as **welded-shut stations**: visible on the rail, permanently struck through, tooltip stating why. Showing the boundary is the feature; hiding it would itself be an overclaim of simplicity.
- `READY_LOCAL` unlocks only at ≥3 sealed compliant receipts, and the unlock is displayed *with its rule* ("3 of 3 sealed → READY_LOCAL"), so the state is always accompanied by its proof.
- Every export envelope surfaces `what_this_proves` / `what_this_does_not_prove` as equal-weight columns. The negative space is mandatory content.
- Tawbah (undo) is drawn on the rail even before UNDO-PROVEN ships — labeled `DESIGNED_NOT_LIVE`, blue, dashed. The honest incompleteness stays visible.

---

## 7. Build target (unchanged, re-housed)

**APR-MSSC-001** remains the minimal solvable case — browser-only, 3 hardcoded claims → 3 sealed atoms, Web Crypto only, no backend — now laid out as the three strata of §2 rather than four flat zones. Acceptance criteria inherit the original nine, plus: every §5 rule holds; every panel carries a label; consent phrase typed, not pasted.

**Out of scope for v0.2** (explicitly, to prevent drift): HHMM telemetry visuals (privacy hazard until real + consented), reward/PoI meters (economic pillar is 2/10 — a meter would be an overclaim in pixels), any federation/remote UI, and the Brand Film integration (see gap below).

**Known gap:** `Dema_Brand_Film_dc.html` is only the shell — it imports `./bizra-film.jsx`, which was not uploaded. The film cannot be audited or integrated until that file is provided. Labeled: `FILM_CONTENT_NOT_IN_EVIDENCE`.

---

## 8. One-line canon

> **The interface is a receipt, not a stage. Paper by default; ceremony only at consent; color only as truth-state; every pixel bound to what the repo can prove — and the boundary drawn where proof ends.**
