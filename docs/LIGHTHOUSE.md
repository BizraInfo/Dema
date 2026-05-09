# Lighthouse — Private Pilot Lane

BIZRA Lighthouse is a **private, invitation-only pilot lane** for carefully selected early operators.

Its purpose is to validate Dema local setup, consent boundaries, node health, and receipt-backed workflows **before any public federation or network claims**.

- No operator names are public.
- No open applications are available.
- Participation is handled 1:1 with explicit consent and privacy boundaries.

This document captures the operator contract. It is the canonical source. ROADMAP keeps the public-roadmap line; this doc is the working contract.

---

## Why this exists

Per [docs/ROADMAP.md](ROADMAP.md), Node1 onboarding "depends on the constitutional layer being proven across more than one operator." Lighthouse is that proving step. Every Dema CLI surface today is L0–L2 (per [docs/02-architecture/pat-builder-sat-validator.md](02-architecture/pat-builder-sat-validator.md)); Lighthouse runs against the install + L4-receipt-via-gateway path until v0.4 ships a CLI-driven L4 surface.

The Liveness Law: a node must be alive alone before federating. Lighthouse proves "alive alone" on a second machine, with a different human, before the federation handshake exists.

---

## Operator profile

A Lighthouse operator must:

- Be **personally known** to the program owner (trust circle, not public outreach).
- Read the three founding documents (الرسالة + البذرة + Third Fact) without translation handholding.
- Be comfortable with Node 20+, terminal, git, and reading code when needed.
- Operate inside **consent + receipts discipline** — exact-string consent, no shortcuts, no "just push it" reflexes.
- Hold a posture where **the bounded act is the point**, not "what's the upside."
- Have bandwidth for the full sequence (~3–5 sessions across install → setup → doctor → first L4 receipt).

**Disqualifiers:**

- Treats the program as token / passive-income / network speculation.
- Needs hand-holding through `npm install` or `git clone`.
- Has a public posture that would convert their installation into a launch announcement.
- Will not read the founding documents first.

---

## Sourcing surface

| Allowed | Forbidden |
|---|---|
| 1:1 conversations with people in the existing trust circle | Twitter/X open call |
| Small private channels the program owner is already trusted in | Hacker News post |
| | Discord blast / mailing list announcement |
| | Any recruitment message that itself becomes a marketing artifact |

Public outreach for operators **is** a public federation claim. Per [`dema monetize`](../apps/cli/src/index.js) blocklist, that is forbidden.

---

## Phase A — minimum viable commitment

Lowest viable bar to count an operator as real (not theoretical):

- Install + run the bounded local Dema setup flow when invited.
- Produce **one L4 receipt** proving the setup or diagnostic actually happened on their machine.
- Keep private keys, local data, and device access **under their own control**.
- Stay reachable for one future federation-handshake attempt when Node1 readiness allows.
- **No** always-on obligation.
- **No** monthly cadence yet.
- **No** public identity disclosure.
- **No** co-authoring requirement.

One L4 receipt separates a real Lighthouse operator from a theoretical supporter. That's the entire entry bar.

---

## Phase B — graduation criteria

An operator graduates from Lighthouse to a peer position when:

- They produce **repeated liveness receipts** (cadence is operator-chosen, not imposed).
- And/or they make **one meaningful contribution back** to docs, ADRs, onboarding, security feedback, or operator experience.

Graduation gates the federation handshake act (an L5 receipt). The handshake itself is a separate typed GO with its own halt gate.

---

## Onboarding sequence

Each step has a verifiable artifact. None can be skipped.

1. Operator reads الرسالة + البذرة + Third Fact (founding documents, hashed on Bitcoin blocks 948027/8/9).
2. Operator installs Dema v0.3.x on their own machine.
3. `dema setup` → idempotent `~/.dema/` skeleton on operator's machine.
4. `dema doctor` → must pass all four predicates (`ready`, `consoleReady`, `activationGate === EXPLICIT_GO_REQUIRED`, `daemonStatus !== running`).
5. Operator reads [docs/ARTIFACT_011_PREP.md](ARTIFACT_011_PREP.md) and [docs/06-adr/ADR-005-operator-consent.md](06-adr/) (or equivalent consent ADR).
6. Operator provides consent for bounded diagnostic per the FATE exact-string phrase.
7. Operator's first L4 receipt is issued by the upstream gateway and mirrored locally.
8. Operator continues operating inside receipts discipline. No public framing of their participation.

---

## Halt gates

Each of these requires explicit GO from the program owner — auto-mode does not override:

- Sharing the founding documents outside the trust circle.
- DM / email outreach to a candidate.
- First-time issuance of any L4 receipt on the operator's machine.
- Federation handshake (L5 receipt) — Phase B gate.
- Any change to this document that loosens an operator constraint.

---

## What this document is not

- Not a recruitment surface. Do not link from public posts.
- Not a contract substitute for FATE consent — every action still binds to exact-string consent at the moment of execution.
- Not a guarantee that any specific operator becomes Node1. Node1 is whichever Lighthouse operator first reaches federation-readiness, by virtue of the handshake — not by signup.
