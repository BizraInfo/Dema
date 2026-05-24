# Quickstart

> **Purpose:** Get Dema running on a fresh machine and see your first status frame in **under 2 minutes**. Verified by running the commands below and pasting the actual output. No accounts, no remote calls, no daemon.

---

## Prerequisites

You need **Node.js 20 or newer**. Nothing else — Dema has zero production dependencies and zero dev dependencies.

```bash
node --version    # must print v20.x or higher (this repo is verified on v22.22.2)
```

If you don't have Node, install it from [nodejs.org](https://nodejs.org) or your platform's package manager. Use Node 22+ if you also want to run `npm run check` and `npm run coverage` (their threshold flags are Node 22+).

---

## Install

```bash
git clone https://github.com/BizraInfo/Dema
cd Dema
```

There is **no install step**. No `npm install`. No build. The CLI runs directly from source.

---

## First command — prove it works (~5 seconds)

```bash
node bin/dema --version
```

Expected output:

```text
dema 0.1.0-alpha.0
```

If you see that line, you have a working Dema. Everything below uses the same `node bin/dema <subcommand>` shape.

---

## First user command — see your node (~15 seconds)

```bash
node bin/dema status
```

Expected output (against a fresh `~/.dema/` — yours will look the same on first run):

```text
DEMA — Sovereign AI Node Companion

Identity
  Node: Node0
  Human: unknown

Readiness
  Ready: false
  Console ready: false
  Activation gate: BLOCKED
  Daemon: unknown
  Mission executed: false
  Runtime pulse fired: false
  Model connected: false
  Loaded models: none
  Model token visible: false
  Rust Bus: not ready
  Next artifact: ARTIFACT-011
  Next action: complete_setup

Findings
  - Node0 adapter not connected
  - DEMA_NODE0_STATUS_COMMAND unavailable: not configured

Boundary: no action without explicit consent.
```

**What this tells you in one read:**
- Dema knows your node is **Node0**.
- Activation is **BLOCKED** — by design, until you complete setup.
- Nothing is running. No daemon, no model, no mission.
- The next safe action is `complete_setup`.

This is the **honest state**. Dema does not pretend readiness it doesn't have.

---

## Read the welcome (~10 seconds)

```bash
node bin/dema welcome
```

You'll see the product promise + a first-run orientation paragraph + the explicit allow / block list for the `first_run` phase (read · preview · verify allowed; runtime · mission · federation · receipt-mint blocked). Read it once.

---

## Run the readiness check (~15 seconds)

```bash
node bin/dema doctor
```

This runs a row-by-row check and prints fix hints. On a fresh machine you'll see something like:

```text
Dema Doctor — Node0 readiness check

  ❌ Activation gate   BLOCKED
       → Fix: activation gate is BLOCKED
       run `dema setup` to initialize and check doctrine consent
  ✅ Daemon            n/a-via-gateway (no hidden daemon)
  ❌ Ready             false
       → Fix: complete first-run setup with `dema setup`, then verify with `dema status`
  ❌ Console ready     false
       → Fix: gateway unreachable
       if you intend to run governed runtime, confirm it's started (separate repo). For preview-only use, this is expected.
  ⚠️ Gateway probe     unreachable (by design when no runtime running)

Verdict: blocked
  3 predicates failed · 1 warning · 1 OK
```

**Doctor exits 1 on a fresh machine.** That is the **correct** behavior — there is no gateway yet, no runtime yet, and you haven't accepted the doctrine. Doctor is honest about the state, then prints fix hints. Don't try to "make doctor green" by force; advance through `dema setup` instead.

---

## You're in. What now?

Three paths from here:

| If you want to... | Run | Time |
|---|---|---|
| Continue first-run setup | `node bin/dema setup` | ~10s |
| See the bounded preview of a real task | `node bin/dema journey "Fix auth.py and run pytest"` | ~5s |
| Read everything once before acting | [`docs/USER_LIFECYCLE.md`](USER_LIFECYCLE.md) + [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) | ~10 min |

All commands at this stage are **preview-only**. Nothing mints a receipt. Nothing calls a remote provider. Nothing writes outside `~/.dema/`. To do anything binding, you have to type explicit consent — that's [ADR-005](06-adr/ADR-005-operator-actions-require-explicit-consent.md) and you'll see it referenced everywhere.

---

## If something goes wrong

| Symptom | Fix |
|---|---|
| `node: command not found` | Install Node 20+ from [nodejs.org](https://nodejs.org) |
| `dema --version` prints nothing | Check `node --version` is ≥ 20; on macOS, your default `node` may be old — try `nvm use 22` |
| `dema status` hangs in a fancy terminal | Set `DEMA_NO_TUI=1` and re-run; some terminals enter the TTY keypress loop unexpectedly |
| `dema doctor` exits 1 against fresh state | **Expected.** There is no gateway yet. See the doctor section above. |
| You want to test without touching `~/.dema/` | Set `DEMA_HOME=$(mktemp -d)` before running; isolates state under tmpdir |

---

## What this Quickstart does **not** cover

- Setting up a local model broker (Ollama) — see [`docs/06-adr/ADR-018-model-broker-promotion-path.md`](06-adr/ADR-018-model-broker-promotion-path.md)
- The full subcommand surface (~60 commands) — see `node bin/dema --help` and [`README.md`](../README.md) for the inventory
- Running the test suite — see `npm test` (2618/2618 PASS expected) and [`docs/TESTING.md`](TESTING.md)
- The full release / CI surface — see [`docs/RELEASE_PROCESS.md`](RELEASE_PROCESS.md) and [`docs/CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md)
- The architecture model — see [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Verification

This Quickstart was verified by running every command above in a fresh tmpdir against `main @ a6ad0a1` on Node v22.22.2 on 2026-05-24 GST. Every expected-output block is **verbatim** from a real run. If you run the same commands and see different output, that's a regression — please file an issue with the diff.
