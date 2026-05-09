# Dema Unified Installer Architecture v0.1

## Goal

A non-technical user can install Dema and reach a safe local status screen without touching code, without starting hidden processes, and without dispatching a mission.

## Install levels

1. GUI installer: Windows, macOS, Linux
2. Terminal installer: curl/PowerShell
3. Developer install: clone + npm install

## Installer responsibilities

- detect OS
- create local Dema home
- create profile skeleton only when missing
- create local config only when missing
- create receipt/memory/log/skills folders idempotently
- detect LM Studio or Ollama when available
- show local-only default
- list exactly what was created
- list exactly what was left untouched
- never start hidden daemon
- never dispatch mission
- never issue ARTIFACT-011

## Local state

```text
~/.dema/
  profile.json
  config.local.json
  receipts/
  memory/
  logs/
  skills/
```

## Idempotency contract

The installer is safe to run more than once.

If a file already exists, the installer must preserve it and report it as existing. This protects local identity, memory preference, and receipt history.

Expected setup report:

```text
Created:
- ~/.dema/receipts/
- ~/.dema/memory/
- ~/.dema/logs/
- ~/.dema/skills/

Preserved:
- ~/.dema/profile.json
- ~/.dema/config.local.json

Not touched:
- daemon state
- mission runtime
- receipt history
- external provider settings
```

## Installer modes (v0.3.5)

Both `install-unix.sh` and `install-windows.ps1` accept three modes:

| Mode | Flag | Effect |
|---|---|---|
| Apply | (no flag) | Create missing dirs/files; preserve existing. |
| Dry-run | `--dry-run` (sh) / `-DryRun` (ps1) | Print what would be created; write nothing. |
| Check | `--check` (sh) / `-Check` (ps1) | Report current state of `$DEMA_HOME`; write nothing. |

`--help` / `-Help` prints usage on either platform.

## Uninstall path (v0.3.5)

`scripts/install/uninstall-unix.sh` and `scripts/install/uninstall-windows.ps1` delete `$DEMA_HOME` and everything under it. Both gate the destructive act behind an exact-string consent phrase:

```text
REMOVE DEMA LOCAL DATA
```

Match is case-sensitive; whitespace must be exact. Anything else exits 1 and writes nothing.

This phrase is **separate** from the FATE bounded-diagnostic consent phrase. FATE consent is for runtime acts; uninstall consent is for local-data destruction.

## Hash verification (v0.3.5)

When the canonical install endpoint at `https://install.bizra.ai/dema` is published, each released script will publish its SHA-256 hash alongside it. Operators verify with:

```bash
curl -fsSL https://install.bizra.ai/dema | tee /tmp/install.sh
sha256sum /tmp/install.sh   # compare against published hash
sh /tmp/install.sh
```

Until the endpoint is published (a halt-gated L5 act), the canonical reference is the script bytes at the v0.3.5 tag in `BizraInfo/Dema`. Hash table:

```text
SHA-256 hashes at v0.3.5 (commit 27a6662):
  install-unix.sh       bbe0060dcd61ed5aca76e6de1cb0b9dc32e386d388e4f2df6a0f74d698ff0693
  install-windows.ps1   5c14121e803c7656f8100595e14295c5f32871397282a9d05b45dd4ced6f3198
  uninstall-unix.sh     4f55a343c94de1aa45bbe691d928dfa88ccce823ad8d69eda9b0ea25c266f4c1
  uninstall-windows.ps1 3dcf4d36874e47de8040526f5da5cec8f20b6fcb173c72fc42ffaf980404a416
```

Verify locally with `sha256sum scripts/install/<name>` (Linux/macOS) or `Get-FileHash -Algorithm SHA256 scripts/install/<name>` (PowerShell). Future v0.3.x patches that touch these scripts must update this block in the same PR.

## Release rule

No public release until:

- first receipt flow works
- no-code install tested
- uninstall tested
- no hidden background daemon
- signed release artifacts planned
