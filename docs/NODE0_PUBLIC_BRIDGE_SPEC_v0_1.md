# Node0 Public Bridge Spec v0.1

**Status:** `DESIGNED_NOT_LIVE` — this document is a boundary specification. No public
bridge is running. **[V]** No code in this repository serves any public network surface;
Dema's boundary forbids runtime execution here.

**Satisfies:** `docs/NODE0_DEMA_URP_FLAGSHIP_DOD.md` §15 — *"Public bridge spec exists
before any public connection."* The DoD requires the spec to exist **before** a connection,
so this document is deliberately written while nothing is connected. **[V]**

**Ruling of record (operator, 2026-08-03):** Node0's public surface in v0.1 is **read-only
proof artifacts only** — hashes, receipts, and the witness script. **No queryable API.**

---

## 1. What this spec decides

One question: *what may Node0 expose to a party who is not the operator?*

The answer for v0.1 is the narrowest one that still lets an outsider verify a claim: **the
artifacts, and nothing that answers questions about them.** **[D]** An evaluator may take
what we publish and check it themselves. They may not ask Node0 anything.

## 2. Permitted public surface (v0.1)

Exactly three classes. **[A — declared boundary, bounded and reversible]**

| Class | Example | Why it is safe |
|---|---|---|
| **Content hashes** | `journey_invariant_hash`, `before/after_manifest_hash` | A hash discloses nothing about the data and is checkable by recomputation. **[D]** |
| **Receipts** | a sealed receipt JSON, its chain position | Already the unit of proof; read-only, immutable once written. **[D]** |
| **Witness script** | `scripts/proof/first-light-mission.mjs` and its suite | The evaluator runs it on their own machine, against their own directory. **[V]** |

Publication for v0.1 means **static artifacts** — a file, a repository, a document. **[D]**
An evaluator obtains them, runs the witness script locally, and compares values. Nothing
they do reaches Node0.

## 3. Forbidden in v0.1 — explicitly

- **No queryable API.** No endpoint that accepts a request and answers from Node0 state —
  no mission submission, no receipt lookup, no chain query, no status probe. **[A]**
- **No federation, token, mint, or PoI surface.** These are `DESIGNED_NOT_LIVE` throughout
  the tree and a public bridge does not change that. **[V]** — see `docs/CURRENT_LIMITS.md`.
- **No environment-bound value published as a constant.** `seal_head`, `launch_hash`,
  `decision_id`, `created_at`, and the profile hashes are **measured to differ** between
  clean homes; publishing one as if it were universal would be a false claim. **[V]** —
  CSJ-03 pins this in both directions.
- **No identity or key material.** The mission-signing key leaked 2026-07-21 remains the
  live signer and is unrotated; Node0 identity must not be published as clean until the
  rotation ceremony completes. **[V, BLOCKED]** — TASK-029.

## 4. The boundary this spec protects

A read-only artifact cannot be made to act. **[D]** The moment Node0 answers a question, it
has state an outsider can influence — timing, load, existence-of-record — and every one of
those is a channel this spec has not analysed. v0.1 declines the whole category rather than
try to enumerate safe queries. **[A]**

This is the same posture as the rest of the estate: refusal is the default, and a capability
is added only when a proof gate opens it. **[D]**

## 5. What this spec does NOT prove

- It does **not** prove any artifact is correct — only that publishing this class is bounded.
- It does **not** authorize publication. Each act of publishing remains a separate operator
  GO. **[A]**
- It does **not** describe a running bridge, because none exists. **[V]**
- It is **not** a security review of the artifacts themselves.

## 6. What would move v0.1 to v0.2

A queryable surface requires, at minimum: a written threat model for the query channel, a
rate and disclosure analysis, a consent record for what may be answered, and a proof gate
demonstrating the refusal path. **[PLANNED]** None of these exist. **[V]**

---

*Every assertion above carries `[V]` verified, `[D]` derived, or `[A]` declared-assumption.
Surface labels follow `docs/CURRENT_LIMITS.md`, which remains the maturity ledger of record.*
