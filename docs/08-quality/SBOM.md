# Software Bill of Materials & Dependency Posture — Dema

- **Date:** 2026-06-02 (GST) · **Package:** `@bizra/dema-root@0.1.0-alpha.0`
- **Truth label:** `[M]` measured this session via `package.json`, `ls node_modules`, and `grep` of `node:` imports.

## 1. Headline posture

Dema ships with a **zero-dependency** supply chain:

| Surface                          | Count         | Source                           |
| -------------------------------- | ------------- | -------------------------------- |
| Production dependencies          | **0**         | `package.json` `dependencies`    |
| Dev dependencies                 | **0**         | `package.json` `devDependencies` |
| Installed `node_modules` entries | **0** (empty) | `ls node_modules`                |
| Lockfile (`package-lock.json`)   | **none**      | absent by design                 |
| Third-party transitive packages  | **0**         | follows from the above           |

**Consequence:** the transitive-CVE attack surface is effectively nil. There is no lockfile to poison, no postinstall script to hijack, and no registry-resolution step in CI or install. Supply-chain integrity is achieved by **subtraction**, not tooling.

## 2. Runtime surface (the "bill" of what is actually consumed)

Dema runs on the Node.js standard library only. Statically-imported builtins `[M]`:

| `node:` builtin               | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `node:crypto`                 | Ed25519 signing/verification, SHA-256 content addressing     |
| `node:fs`, `node:fs/promises` | local receipt / profile / index read-write under `DEMA_HOME` |
| `node:os`                     | home-dir resolution (`~/.dema`)                              |
| `node:path`                   | path composition                                             |
| `node:readline`               | interactive `dema chat` REPL                                 |
| `node:url`                    | module-path resolution (`fileURLToPath`)                     |
| `node:util`                   | `promisify` and formatting                                   |
| `node:child_process`          | argv-array subprocess execution for review/check gates, CLI smoke, local Node0 shellout adapter, model safety probes, and guarded local wrappers |

`node:child_process` is used both statically and dynamically; it is not a third-party dependency. The actuator gate permits `execFile`/`execFileSync` and `spawn`/`spawnSync` with argv arrays, and rejects raw shell execution patterns (`child_process.exec`, `execSync`, or `shell:true`). Loopback HTTP surfaces use platform `fetch`/`AbortController`, not npm packages: Node0 gateway `127.0.0.1:7421`, Ollama `localhost`/`127.0.0.1:11434`, and LM Studio `127.0.0.1:1234` where applicable.

- **Engine constraint:** Node ≥ 20 (`package.json` `engines`).
- **Module system:** ESM (`"type": "module"`).

## 3. Provenance & timestamping

While Dema has no package dependencies to attest, it anchors **document provenance** with OpenTimestamps (Bitcoin-anchored) `[M]`:

| Artifact                                    | Anchor                       |
| ------------------------------------------- | ---------------------------- |
| `PROOF_SUMMARY.md.ots`                      | OpenTimestamps               |
| `proof-of-priority/merkle-root.txt.ots`     | Merkle root → OpenTimestamps |
| `proof-of-priority/per-file/*.pdf.ots` (×3) | per-file OpenTimestamps      |

This gives priority/precedence proofs an independent, third-party-verifiable timestamp without trusting Dema's own clock.

## 4. Build & release integrity

- **Build step:** none required — pure stdlib, no transpile, no bundler.
- **Verification gate:** `npm run check` (59 sub-commands incl. tests, coverage, CLI smoke, 11 review scripts) is the release-readiness gate; `scripts/release-readiness.mjs` exists for release framing.
- **Open gap:** npm package releases are **not yet cryptographically signed** (no Sigstore/npm provenance). Tracked as a future hardening step; low urgency given the package is not yet published to a public registry.

## 5. Maintaining the zero-dep invariant

To preserve this posture:

1. **Do not add dependencies casually.** Every helper must remain small, explicit, and stdlib-based. A new dependency must clear an ADR justifying why stdlib cannot serve.
2. **No lockfile is correct here** — adding one would imply a dependency tree that does not exist.
3. If a dependency ever becomes unavoidable, this SBOM must be updated in the same PR, and the dependency pinned + provenance-checked.

## 6. Status label

`MEASURED` — every figure in §1–§2 was verified on disk on 2026-06-02. §4's "releases not signed" is a stated, unclosed gap (no overclaim).
