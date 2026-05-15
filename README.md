# Dema

**Your sovereign AI node companion.**

Dema helps you run a private AI workspace on your own machine -- with memory, safe actions, receipts, and a clear next step.

Local-first.
Consent-bound.
Receipt-backed.
No coding required.

```text
Install Dema
-> create your profile
-> connect a local model
-> see your node health
-> approve one bounded action
-> receive your first proof receipt
```

BIZRA is the ecosystem.
Dema is the door.

---

## The 60-second version

Dema is for people who want local AI without invisible autonomy.

It shows:

- what is ready on your machine
- what is blocked
- what Dema can safely preview
- what requires your exact consent
- what receipt will prove the result

Dema does not ask you to trust a black box. It tells you what it knows, what it will not touch, and what the next safe action is.

---

## First run

```bash
dema welcome
dema setup
dema status
dema doctor
dema consent plan "Check my local node health"
dema mission propose
```

Expected first impression:

```text
Welcome to Dema.

Your node is local-first.
Your actions are consent-bound.
Your important steps can produce receipts.

Next:
1. Run setup
2. Check status
3. Preview first bounded diagnostic
```

`dema mission propose` is a preview command. It checks readiness and consent state, then stops. It does not start a daemon, execute work, or create the first runtime receipt.

`dema consent plan "<intent>"` is also preview-only. It drafts the smallest detected permission scope, shows unsafe references for human review, and does not approve consent, mint a capability, execute work, or create a receipt.

---

## Install

### Guided installer

Download Dema, open it, and follow the first-run wizard.

The wizard guides you through:

1. Welcome
2. Privacy mode
3. Profile
4. Model detection
5. Local health check
6. Receipt folder
7. First safe action preview

### Terminal install

The terminal installer endpoint is planned for the packaged alpha release. Until release assets are published, use the developer install below.

Planned Linux / macOS command:

```bash
curl -fsSL https://install.bizra.ai/dema/install.sh | sh
```

Planned Windows PowerShell command:

```powershell
irm https://install.bizra.ai/dema/install.ps1 | iex
```

Each script's SHA-256 hash is published in [docs/INSTALLER_ARCHITECTURE.md](docs/INSTALLER_ARCHITECTURE.md) at every release tag. Operators can verify the bytes match before execution. The endpoint also hosts uninstall scripts at `/dema/uninstall.sh` and `/dema/uninstall.ps1`, plus a small index page at `/dema/`.

### Developer install

```bash
git clone https://github.com/BizraInfo/Dema
cd Dema
npm install
npm test
npm run check
```

---

## What setup creates

`dema setup` creates local state in your Dema home directory, usually `~/.dema`:

```text
~/.dema/
  profile.json
  config.local.json
  receipts/
  memory/
  logs/
  skills/
```

Setup is idempotent and non-destructive. If a profile or config already exists, Dema leaves it in place.

Setup does not start a background process.
Setup does not execute a mission.
Setup does not issue ARTIFACT-011.

---

## Receipts

A receipt is Dema's way of saying:

```text
what happened,
what did not happen,
what evidence exists,
and what the next safe action is.
```

Use:

```bash
dema receipts
dema receipts ARTIFACT-011
```

Learn more in [`docs/RECEIPTS.md`](docs/RECEIPTS.md).

---

## Product promise

Dema says:

> Here is what I know.  
> Here is what is safe.  
> Here is what is blocked.  
> Here is what I can preview with your consent.
> Here is the receipt.

---

## Current boundary

ARTIFACT-011 — the first bounded-diagnostic receipt — was issued on
**2026-05-06** by the governed runtime path (gateway POST `/missions`,
admissibility verdict PERMIT). The local mirror lives at
`~/.dema/receipts/artifact-011.json` and is viewable via `dema receipts`.

The exact consent phrase that gated the issuance was:

```text
GO: Node0 bounded diagnostic activation only
```

That phrase is **not** a re-usable token. Each future L4 mission requires
its own typed phrase per the
[Dema Autonomy Envelope](docs/02-architecture/dema-autonomy-envelope.md).
Issuance never happened *inside* this repo — Dema reads and lists; the
governed runtime in `bizra-cognition-gateway` (upstream, in
`bizra-data-lake`) is what creates receipts. See
[`SPROUT_PIN.md`](SPROUT_PIN.md) for the captured chain head, Bitcoin
state, and replay recipe.

Dema's public language remains local-first, consent-bound, and proof-safe.

---

## Proof of priority

Dema's three founding documents are anchored on Bitcoin via OpenTimestamps. The algorithm and root are **reproducible from this repo** with Node ≥20:

```bash
npm run priority-anchor:verify
```

Canonical state lives in [`proof-of-priority/PIN.md`](proof-of-priority/PIN.md). Spec in [`docs/PRIORITY_ANCHOR.md`](docs/PRIORITY_ANCHOR.md).
