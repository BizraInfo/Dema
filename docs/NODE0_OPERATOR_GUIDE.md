# Node0 Operator Guide

> **Purpose:** Operator reference for Ring-1 trusted users who run Dema on their own machine. Covers daily run loop · first-time setup · DEMA_HOME structure · environment variables · receipt inspection · safe boundaries · troubleshooting beyond QUICKSTART. The companion to [`QUICKSTART.md`](QUICKSTART.md) (which is the 2-minute first-runner intro) and [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) (which is for showing Dema to an audience).
>
> **Audience:** Ring-1 operators (Samy / equivalent trusted reviewer running Dema in a near-production context · not the original founder).
>
> **Boundary:** Read-only inspection unless explicitly noted. Every command in this guide is safe to run; nothing here mints a receipt, calls a remote provider, or mutates state outside `$DEMA_HOME`.
>
> **Last verified:** 2026-05-24 GST against `main @ 45a584e` on Node v22.22.2.

---

## Daily run loop

Three commands. Run them once a day to confirm your node is honest about its state.

```bash
node bin/dema status      # readiness snapshot
node bin/dema doctor      # row-by-row check with fix hints
node bin/dema receipts    # list local receipts (empty array = no receipts yet)
```

If `status` shows `Ready: false` or `Activation gate: BLOCKED`, that is **expected** on a node that hasn't been activated by the governed gateway. See [`QUICKSTART.md`](QUICKSTART.md) for what each row means.

**`doctor` exits 1** when predicates fail — that is the **Verified Refusal Pattern** working as designed. Don't try to make doctor green by force; advance through the fix-hints `doctor` prints.

---

## First-time setup

```bash
node bin/dema setup
```

Expected output (first run · creates the `~/.dema/` skeleton):

```json
{
  "schema": "bizra.dema.setup.v0.1",
  "root": "/home/<you>/.dema",
  "os": {
    "platform": "linux",
    "arch": "x64"
  },
  "created": true,
  "paths": {
    "home": "/home/<you>/.dema",
    "profile": "/home/<you>/.dema/profile.json",
    "config": "/home/<you>/.dema/config.local.json",
    "receipts": "/home/<you>/.dema/receipts",
    "memory": "/home/<you>/.dema/memory",
    "logs": "/home/<you>/.dema/logs",
    "skills": "/home/<you>/.dema/skills"
  },
  "createdPaths": [
    "/home/<you>/.dema/receipts",
    "/home/<you>/.dema/memory",
    "/home/<you>/.dema/logs",
    "/home/<you>/.dema/skills",
    "/home/<you>/.dema/profile.json",
    "/home/<you>/.dema/config.local.json"
  ],
  "existingPaths": [
    "/home/<you>/.dema"
  ],
  "untouched": [
    "daemon state",
    "mission runtime",
    "runtime pulse",
    "receipt history",
    "external provider settings"
  ],
  "boundaries": {
    "noHiddenDaemon": true,
    "missionExecuted": false,
    "artifact011Issued": false,
    "localFirst": true
  }
}
```

**Setup is idempotent.** Re-running shows `"created": false` and `createdPaths: []` — no destructive overwrites:

```json
{
  "schema": "bizra.dema.setup.v0.1",
  "root": "/home/<you>/.dema",
  ...
  "created": false,
  ...
}
```

The `untouched` array lists what setup **explicitly does not touch** — your daemon state (if any), mission runtime, runtime pulse, receipt history, external provider settings.

---

## DEMA_HOME directory structure

After `dema setup`, `~/.dema/` contains:

```text
~/.dema/
├── profile.json              # operator profile (created · empty on first run)
├── config.local.json         # local config (created · empty on first run)
├── receipts/                 # receipts from the governed gateway (read-only here)
├── memory/                   # operator-side memory store
├── logs/                     # Dema activity logs
└── skills/                   # operator-installed skills (e.g., run-dema)
```

In a long-running operator setup (post-Lighthouse + multiple sessions) you may also see (per ADR-022 substrate-out doctrine, these are operator-side, NOT in the repo):

```text
~/.dema/
├── agents/                   # Node0 mission agent state
├── audit/                    # μ-A1 audit state-root logs
├── bin/                      # operator-installed scripts (mu-test-all, agent-db-query)
├── kernel/                   # Mission Lifecycle Kernel state
├── lint/                     # μ-layer consent + enforcement logs
├── wisdom/                   # Wisdom Capsule registry
├── milestones/               # multi-session continuity markers
├── demo/                     # demo session captures
└── founder_inventory/        # operator-specific founder-asset snapshots
```

These extra directories are **created on demand** by operator-side tooling — they are not part of `dema setup`'s mandatory skeleton.

**Disk usage on the founder's machine** (reference snapshot 2026-05-24): `~/.dema/` total ~50 MB across all subdirectories. If yours grows past 1 GB, audit `~/.dema/logs/` and `~/.dema/audit/` for runaway log files.

---

## Environment variables

| Variable | Default | Effect | When to set |
|---|---|---|---|
| `DEMA_HOME` | `~/.dema` | Where Dema reads + writes local state | Set to `$(mktemp -d)` to isolate test runs; otherwise leave default |
| `DEMA_NO_TUI` | unset | When `1`, disables the keypress-loop TTY entry on bare `dema` invocation | Always set in scripts; useful in narrow terminals |
| `NO_COLOR` | unset | When set, strips ANSI escape codes from output | Set when piping to `grep`, `jq`, or capturing for docs |
| `DEMA_PRE_PUSH_BYPASS` | unset | When `1`, skips the operator-side μ-layer pre-push hook | **Avoid on `main`.** Bypass is logged to `~/.dema/lint/consent_enforcement_log.ndjson` |
| `DEMA_BANNER_INTERACTIVE` | unset | When `0`, disables the keypress menu in the bare TUI homebase | Set when running in a non-interactive terminal |
| `DEMA_AGENT_DB_QUERY_PATH` | `~/.dema/bin/agent-db-query` | Path to the operator-side Python wrapper for MC-A memory queries | Set to `/nonexistent/...` for graceful no-wrapper testing |
| `DEMA_NODE0_STATUS_COMMAND` | unset | Command to fetch live Node0 status from the governed gateway | Set only when the gateway is running |
| `NODE_ENV` | unset | When `test`, certain test-only paths activate | Set by the test runner; do not set manually in operator use |

**Test-safe environment** (isolates everything · safe for any local experiment):

```bash
export DEMA_HOME=$(mktemp -d)
export DEMA_NO_TUI=1
export NO_COLOR=1
```

---

## Receipt inspection

```bash
node bin/dema receipts                  # list all receipts in $DEMA_HOME/receipts/
node bin/dema receipts <ID>             # show one receipt by ID, artifact ID, exact path, or unique filename
node bin/dema receipts artifact-011     # canonical example — only present after gateway issues it
```

On a fresh `DEMA_HOME` you see `[]` (empty array). After the governed gateway issues your ARTIFACT-011, that receipt is downloaded into `~/.dema/receipts/artifact-011.json` and `dema receipts artifact-011` returns the full envelope.

**Read-only by design.** Dema does NOT mint receipts — see [`docs/06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md`](06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md). Minting lives in the governed gateway (BIZRA Omega substrate, out of this repo per ADR-003).

If you need to inspect a receipt's chain position or hash chain integrity, the receipt envelope contains `chain_id`, `chain_position`, and `parent_hash` fields. Walking the chain is operator-side scripting; this repo provides the read surface only.

---

## Memory inspection (MC-A bridge)

```bash
node bin/dema memory --help              # show the memory subcommand surface
node bin/dema memory list                # list operator-side memory entries
node bin/dema memory query "<query>"     # MC-A · requires Python wrapper at $DEMA_AGENT_DB_QUERY_PATH
node bin/dema memory query "<query>" --json
```

`dema memory query` is the JS↔Python bridge to BIZRA Omega AgentDB. It requires:
1. Python 3.10+ on PATH
2. The operator-side wrapper at `~/.dema/bin/agent-db-query` (or override via `DEMA_AGENT_DB_QUERY_PATH`)
3. `BIZRA_OMEGA_ROOT` env var pointing at the substrate (default `/data/bizra/dema-runtime-arch-wt`)

Per ADR-022 doctrine, the substrate stays out of this repo. The wrapper is operator-side too. If the wrapper is missing, you'll see a clean error envelope (`bizra.dema.memory_query_result.v0.1`) with exit 1 — that's the wired-but-not-configured state, by design.

---

## Pre-push μ-layer (operator-installed)

The pre-push hook at `.git/hooks/pre-push` (operator-installed; **not** in this repo) runs `~/.dema/bin/mu-test-all`, which executes 7 doctrine harnesses:

| Harness | Purpose |
|---|---|
| μ-H1 drift linter | catches doctrine drift in CLAUDE.md / AGENTS.md |
| μ-K1 self-critique | self-critique discipline |
| μ-H2 tool envelope | tool-call envelope canon |
| μ-C1-enforcer | docs/* gating |
| μ-M2 doctrine projector | doctrine-catch registry |
| μ-A1 audit tool | mu_state_root audit (verdict WARN allowed; exit 0) |
| μ-C1 consent CLI | consent surface canon |

Typical green run: **104 PASS / 0 FAIL · ~18s**. A receipt is appended to `~/.dema/lint/mu_test_run_log.ndjson` on every run.

**Installing the hook** (one-time, operator-side):

```bash
# 1. Confirm the orchestrator binary exists
ls -la ~/.dema/bin/mu-test-all

# 2. Confirm Git hooks directory exists for this repo
ls -la .git/hooks/

# 3. Install the hook (operator-side · not in repo by design)
cat > .git/hooks/pre-push <<'EOF'
#!/bin/bash
if [ -n "$DEMA_PRE_PUSH_BYPASS" ]; then
  exit 0
fi
~/.dema/bin/mu-test-all
EOF
chmod +x .git/hooks/pre-push
```

**Bypassing the hook** (rare · only with explicit reason):

```bash
DEMA_PRE_PUSH_BYPASS=1 git push origin <branch>
```

Bypass is logged to `~/.dema/lint/consent_enforcement_log.ndjson` for audit. Avoid bypass on `main`.

---

## Safe boundaries — things to NOT do

These actions cross constitutional halt-gates. Read CLAUDE.md user-scope before deciding any of them are necessary.

| Don't | Why |
|---|---|
| `git push --force` to `main` | Forbidden per CLAUDE.md · destroys upstream history |
| `git reset --hard` without backup tag | Forbidden per CLAUDE.md · destroys local work; if absolutely necessary, create a safety tag first (`git tag matrix-pre-rebase-$(date +%Y%m%d)`) |
| Delete files in `~/.dema/lint/` | Audit trail — μ-layer + consent log live there. Even bypass attempts are recorded. |
| Delete files in `~/.dema/receipts/` | Once the gateway issues a receipt, you may inspect but not delete · chain integrity depends on the file existing |
| Modify CI workflows without typed-GO | Workflow-changes-authorized halt-gate (per [`CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md) §8) |
| Use `dema model-broker invoke` without exact-string consent | 6 sequential gates fail-closed (ADR-018) — by design |
| Run any `dema` command on a fresh tmpdir to "test" production behavior | The behavior IS what you see; if doctor says BLOCKED on fresh state, that is the right answer (ADR-006 · ADR-007) |
| Treat ASPIRATIONAL Third Fact claims as committed (mesh / federation / token / PoI) | See [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) for the binding labels |

---

## Troubleshooting (beyond QUICKSTART)

| Symptom | Diagnosis | Fix |
|---|---|---|
| `dema setup` fails with `EACCES` | Filesystem permissions on `$DEMA_HOME` parent | Confirm `~/.dema/` parent is writeable; or set `DEMA_HOME=$(mktemp -d)` to test |
| `dema status` shows `Human: unknown` after setup | `profile.json` exists but `human` field empty (expected on first run) | Author the profile manually if needed; the unknown is honest, not a bug |
| `dema doctor` shows `Gateway probe: unreachable` even after gateway is running | `DEMA_NODE0_STATUS_COMMAND` env var not set or wrong | Confirm the gateway endpoint; export `DEMA_NODE0_STATUS_COMMAND=...` |
| Pre-push hook errors with `~/.dema/bin/mu-test-all: not found` | μ-layer orchestrator not installed | Re-install per memory canon (operator-side); or `DEMA_PRE_PUSH_BYPASS=1` with explicit reason |
| `dema memory query` errors with `python3: not found` | Python 3.10+ not on PATH | Install Python 3.10+ or set `DEMA_AGENT_DB_QUERY_PATH=/nonexistent/...` to keep tests green |
| `dema memory query` errors with `wrapper not found` | Wrapper missing at `~/.dema/bin/agent-db-query` | Either install the wrapper (operator-side · per ADR-022) or accept the wired-not-configured state |
| `npm test` fails on Node 20 but passes on Node 22 | Coverage flags need Node 22 | Upgrade or skip coverage step on 20.x (CI matrix already does this) |
| `dema receipts artifact-011` says "not found" | Gateway hasn't issued the receipt yet | Wait for ARTIFACT-011 from the governed gateway; on a fresh operator setup this is normal |
| Disk usage of `~/.dema/` over 1 GB | Runaway logs or audit files | Audit `~/.dema/logs/` and `~/.dema/audit/`; safe to truncate logs older than 30 days |
| `dema chat` REPL loops or won't exit | TTY keypress loop stuck | `Ctrl-C` twice, or close the terminal |
| Layer 1 scanner flags `~/.dema/` references in your prose docs | Scanner is for runtime artifacts, not prose | This is documented in [`CURRENT_LIMITS.md`](CURRENT_LIMITS.md); do not run `eval:layer1` on prose |

---

## Upgrade procedure

When a new Dema version lands on `main`:

```bash
# 1. Confirm you're on main and clean
git status

# 2. Pull the latest
git pull origin main

# 3. Confirm tests still pass
node --test tests/*.test.js | tail -8    # # fail 0 expected

# 4. Confirm your DEMA_HOME structure is compatible
node bin/dema status     # should produce the same shape as before

# 5. Re-run setup (idempotent · safe to repeat)
node bin/dema setup      # "created": false on existing $DEMA_HOME

# 6. Check the changelog or recent commits for breaking changes
git log --oneline -10
```

Stdlib-only means there are no dependency upgrades to manage. The only thing that can break on upgrade is **schema versioning** of receipts / envelopes — and those are versioned (`bizra.dema.<envelope>.v0.X`) so the schema validator catches mismatches.

---

## Backup recommendations

| Path | Backup frequency | Why |
|---|---|---|
| `~/.dema/receipts/` | Daily | Receipt history is your operator-side proof spine |
| `~/.dema/memory/` | Daily | Operator memory store; loss = loss of session continuity |
| `~/.dema/lint/` | Weekly | μ-layer + consent audit logs; useful for forensic reconstruction |
| `~/.dema/audit/` | Weekly | mu_state_root audit history |
| `~/.dema/wisdom/` | Weekly | Wisdom Capsule registry |
| `~/.dema/profile.json` + `config.local.json` | On change | Small files; easy to back up; restore with `cp` |
| `~/.dema/logs/` | Optional | Activity logs; large; restore not usually needed |
| `.git/hooks/pre-push` | On install | One-line file pointing at `~/.dema/bin/mu-test-all` |

**Restore = `cp`.** Dema reads files from `$DEMA_HOME` directly; restoring is a filesystem copy.

---

## Where to file feedback

| Channel | Use |
|---|---|
| GitHub issues at `BizraInfo/Dema` | Repo bugs · CI failures · doc gaps |
| `SECURITY.md` channel | Security disclosure (current SECURITY.md is non-negotiables list; full STRIDE threat model is PLANNED — see GTM matrix #12) |
| Direct contact with operator (Mumu) | Reserved for Ring-1 trusted reviewers; do not share publicly |

---

## Related

- [`QUICKSTART.md`](QUICKSTART.md) — 2-minute first-runner intro
- [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) — 3-min and 10-min audience demos
- [`CURRENT_LIMITS.md`](CURRENT_LIMITS.md) — labeled truth boundaries
- [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) — per-claim truth labels
- [`RELEASE_PROCESS.md`](RELEASE_PROCESS.md) — release discipline + halt-gates
- [`CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md) — workflow internals + workflow-changes-authorized gate
- [`06-adr/ADR-005-operator-actions-require-explicit-consent.md`](06-adr/ADR-005-operator-actions-require-explicit-consent.md) — consent canon
- [`06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md`](06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md) — verify vs mint
- [`06-adr/ADR-007-multi-session-chain-policy.md`](06-adr/ADR-007-multi-session-chain-policy.md) — concurrent producer policy
- [`../CLAUDE.md`](../CLAUDE.md) — user-scope operator discipline

---

## Update protocol

Re-refresh this guide when:
- `dema setup` output schema changes (re-capture under fresh `DEMA_HOME`).
- A new environment variable is added (update §"Environment variables").
- A new operator-side tool lands at `~/.dema/bin/` (update §"Pre-push μ-layer" or §"Memory inspection").
- The pre-push hook contract changes (update §"Pre-push μ-layer").
- A new safe-boundary item is canonized (update §"Safe boundaries").

Update the **Last verified** line and the `main @ <sha>` reference on every refresh.
