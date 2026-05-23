# Dema · Product v0.1

The public-facing product page. If you need the internal product
strategy, this is also it — Dema is small enough that the public and
internal stories must be the same story.

> See also: [CURRENT_LIMITS.md](CURRENT_LIMITS.md) for what is measured,
> designed-but-not-live, and planned.

---

## One sentence

Dema is your sovereign AI node companion: **local-first, consent-bound,
and receipt-backed**.

## What Dema is

Dema is a small command-line companion that runs on **your machine**.
It helps you:

1. See what is **ready** locally (profile, models, gateway, receipts).
2. See what is **blocked** and **why**.
3. **Preview** any action before it happens.
4. Type **exact consent** when a bounded action is needed.
5. Read the **receipt** that proves what happened — and what didn't.

There is no daemon. No background tasks. No automatic uploads. No
opaque "agent doing things behind your back."

## What Dema is not

- Dema is **not a hosted service**. Your data stays in `~/.dema/` (or
  the path you set via `DEMA_HOME`).
- Dema is **not a chatbot UI**. There is a chat surface, but it is one
  way to talk to a local kernel, not the product.
- Dema is **not autonomous**. Every action above a trivial preview
  requires typed consent.
- Dema is **not a federation**. Federation between nodes is designed,
  not live (see [CURRENT_LIMITS.md](CURRENT_LIMITS.md)).
- Dema is **not a token / economy**. No PoI, no chain-bound mint, no
  shared resource pool runtime today.

## Who Dema is for

Roughly three early personas, in order of fit:

| Persona | What they get from Dema |
|---|---|
| Operator who runs local AI and wants receipts for what it actually did | A consent-bound runtime envelope around their local models |
| Developer integrating a local model into a workflow they need to audit later | A way to preview, gate, and record bounded diagnostic actions |
| Researcher / reviewer evaluating "sovereign AI" claims | A working, reproducible, stdlib-only example of what consent-gated proof discipline looks like in code |

Dema is **not** intended for users who want a no-friction assistant
that decides things for them. The friction is the product.

## The product loop

```text
Remember → Inspect → Propose → Ask Consent → Act Boundedly → Prove → Learn → Next Action
```

Mapped to commands:

| Step | Command |
|---|---|
| Remember | `dema setup` (creates `~/.dema/profile.json`, idempotent) |
| Inspect | `dema status`, `dema doctor` |
| Propose | `dema journey "<intent>"`, `dema consent plan "<intent>"`, `dema mission draft "<intent>"` |
| Ask Consent | Operator types the exact phrase the consent plan named |
| Act Boundedly | Currently handled upstream by the governed gateway (Dema-local execution is `DESIGNED_NOT_LIVE`) |
| Prove | `dema receipts`, `dema receipts <artifact-id>` |
| Learn | The receipt's `next_safe_action` field |
| Next Action | Single suggested step shown in the active kernel banner |

## The product promise

Dema says:

> Here is what I know.
> Here is what is safe.
> Here is what is blocked.
> Here is what I can preview with your consent.
> Here is the receipt.

When Dema cannot say all five of those honestly, Dema refuses the
action and surfaces the refusal as a receipt of its own.

## How Dema is different

Dema combines three lineages that usually live in separate tools:

- **Local-first AI harness** (in the spirit of small, user-owned
  CLI assistants) — your data and your work stay on your machine.
- **Persistent local memory and skill growth** — `~/.dema/memory/` is
  yours and grows with you; no upload.
- **BIZRA-native consent, FATE, Ihsān, and receipts** — every important
  step is gated by exact-string consent and emits a structured proof
  artifact.

Equivalents elsewhere usually pick one or two of those three. Dema's
position is that all three are non-negotiable.

## Boundary and refusals

The first-class product surfaces are **previews** and **refusals**, not
actions. A refusal that names *why* and *what next* is a successful
output, not a failure.

The full L0–L5 autonomy envelope lives in
[`02-architecture/dema-autonomy-envelope.md`](02-architecture/dema-autonomy-envelope.md).
The exact-string consent rule is implemented in
[`packages/fate/src/fate.js`](../packages/fate/src/fate.js).

## How to verify the claims on this page

Every claim above is anchored in code or tests:

```bash
node --test tests/*.test.js                  # full local test count
node --test tests/onboarding-seal.test.js    # 9-invariant first-run regression contract
node --test tests/approval-gate.test.js      # L0–L5 consent matrix
node --test tests/install.test.js            # idempotent local-only setup
```

If any of these stop holding, the corresponding sentence above must be
edited or removed before that change can merge.

---

Refresh trigger: any commit that changes the product surface, autonomy
envelope, consent semantics, or boundary.
