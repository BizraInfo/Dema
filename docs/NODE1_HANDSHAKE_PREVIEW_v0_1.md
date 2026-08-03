# Node1 Handshake Preview v0.1

**Status:** `PREVIEW_ONLY` / `DESIGNED_NOT_LIVE` — a described handshake, not an
implemented one. **[V]** No Node1 exists, no handshake code runs, and nothing in this
repository opens a connection to a second node.

**Satisfies:** `docs/NODE0_DEMA_URP_FLAGSHIP_DOD.md` §15 — *"Node1 handshake preview exists
before Node1."* The preview is required to exist **before** Node1, so this document is
written while Node1 does not exist. **[V]**

**Ruling of record (operator, 2026-08-03):** **Node1 is a second sovereign human.** One
human, one node. The operator's second machine is **estate — never a node.** The handshake
preview models a trusted friend joining, **consent-gated on both sides**, and
**non-federated until separately consented.**

---

## 1. What a node is, and what it is not

A node is **a person**, not a computer. **[A — constitutional ruling, operator]**

This follows the estate's own canon: one human, one node. A second machine owned by the
same human adds hardware, not sovereignty — it cannot consent, cannot be accountable, and
cannot disagree. **[D]** Counting it as Node1 would let the operator's own estate manufacture
a quorum with itself, which is precisely the failure a multi-node design exists to prevent.
**[D]**

| Thing | Classification |
|---|---|
| Operator's second machine | **estate** — additional hardware under one sovereignty **[A]** |
| A trusted friend running their own Node0 | **Node1 candidate** **[A]** |
| A hosted instance the operator controls | **estate** **[A]** |

## 2. The handshake, in preview

Four steps. None are implemented. **[V, PREVIEW_ONLY]**

1. **Independent existence.** Node1 completes its own clean-state journey and holds its own
   receipts before any contact. A node that cannot prove itself alone has nothing to offer a
   second party. **[D]**
2. **Offer.** Node0 emits a handshake offer — an artifact, not a connection: identity
   version, an evidence hash, and the scope being proposed. **[PLANNED]**
3. **Two-sided consent.** Each side records exact-string consent **locally and separately**.
   Neither side's consent implies the other's, and neither can be inferred from receipt of
   the offer. **[A]** A handshake with one-sided consent is not a handshake; it is an
   assertion of authority over someone else's node. **[D]**
4. **Bounded acknowledgement.** Each side records that the other exists and what was
   consented to. **Nothing is shared beyond that scope.** **[A]**

## 3. Non-federation is the default, and it is separate

Completing the handshake does **not** create federation. **[A]** It establishes only that
two sovereign nodes have acknowledged each other under recorded consent.

Federation, shared state, pooled compute, token flow, and PoI rewards each require their own
separate consent and their own proof gates. **[V]** Every one of them is `DESIGNED_NOT_LIVE`
in `docs/CURRENT_LIMITS.md` today, and this preview does not advance any of them. **[V]**

The ordering matters: **acknowledge, then decide.** Bundling federation into the handshake
would make the act of saying hello into an act of merging. **[D]**

## 4. Consent properties this preview requires

- **Exact-string, per act.** Re-pasting an earlier consent never counts. **[V]** — the
  repository's consent surface already enforces exact-string matching.
- **Revocable and recorded.** Each side keeps its own record; neither side's copy is
  authoritative over the other's. **[A]**
- **Fail-closed.** Absent, malformed, or ambiguous consent refuses. **[D]** Node0's covenant
  consent already refuses without a signing key rather than falling back to a demo path
  — CSJ-04. **[V]**

## 5. What this preview does NOT prove

- It does **not** prove a handshake works — nothing is implemented. **[V]**
- It does **not** authorize contacting anyone. Approaching a Node1 candidate is a separate
  operator act. **[A]**
- It does **not** establish federation, token, mint, PoI, or shared execution. **[V]**
- It does **not** commit to a wire format; step 2's artifact shape is unspecified here.

## 6. Preconditions before any real Node1 step

**[BLOCKED]** — the mission-signing key leaked 2026-07-21 is still the live signer. A
handshake binds identity, so no real handshake may be attempted before the rotation ceremony
(TASK-029) completes. **[V]** Node0 identity must not be presented to a second party as
clean until then.

---

*Every assertion above carries `[V]` verified, `[D]` derived, or `[A]` declared-assumption.
Surface labels follow `docs/CURRENT_LIMITS.md`, which remains the maturity ledger of record.*
