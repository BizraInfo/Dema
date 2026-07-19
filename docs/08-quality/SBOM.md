# Software Bill of Materials & Dependency Posture — Dema

- **Date:** 2026-06-02 (GST), **boundary split 2026-07-19** · **Package:** `@bizra/dema-root@0.1.0-alpha.0`
- **Truth label:** `[M]` measured via `package.json`, `ls node_modules`, `grep` of `node:` imports; UI boundary measured 2026-07-19 via `packages/dema-ui/package.json` + `package-lock.json`.

## 0. Trust boundaries (read this first)

Since #404 merged `packages/dema-ui`, the repository holds **two distinct supply-chain boundaries**. A single repo-wide "zero dependencies" claim is no longer true and is not made:

| Boundary | Scope | Posture |
| --- | --- | --- |
| **Kernel TCB** | root `@bizra/dema-root` (CLI, kernels, gates, receipts) | **zero-dependency** — §1 below, unchanged |
| **Dema UI** | `packages/dema-ui` (Next.js web shell) | **66 production + 9 dev dependencies**, `package-lock.json` with **927 package entries** — §1b below |
| **Repository aggregate** | everything tracked | kernel TCB stays zero-dep; the UI package carries the full graph above; nothing in the kernel imports from `packages/dema-ui` |

## 1. Kernel TCB posture (root package)

The root package ships with a **zero-dependency** supply chain:

| Surface                          | Count         | Source                           |
| -------------------------------- | ------------- | -------------------------------- |
| Production dependencies          | **0**         | `package.json` `dependencies`    |
| Dev dependencies                 | **0**         | `package.json` `devDependencies` |
| Installed `node_modules` entries | **0** (empty) | `ls node_modules`                |
| Lockfile (`package-lock.json`)   | **none**      | absent by design                 |
| Third-party transitive packages  | **0**         | follows from the above           |

**Consequence (kernel TCB only):** the transitive-CVE attack surface of the kernel is effectively nil. There is no lockfile to poison, no postinstall script to hijack, and no registry-resolution step in the kernel's CI or install. Supply-chain integrity is achieved by **subtraction**, not tooling. The zero-dependency gate (`scripts`) reads the **root** `package.json` only — it does not, and does not claim to, govern `packages/dema-ui`.

## 1b. Dema UI boundary (`packages/dema-ui`) — measured 2026-07-19

| Surface | Count | Source |
| --- | --- | --- |
| Production dependencies | **66** | `packages/dema-ui/package.json` `dependencies` (Next.js, React, Prisma, next-auth, Zod, Zustand, Radix, Z.ai SDK, …) |
| Dev dependencies | **9** | `packages/dema-ui/package.json` `devDependencies` |
| Lockfile package entries | **927** | `packages/dema-ui/package-lock.json` |
| Version ranges | caret (`^`) in manifest; exact in lockfile | manifest + lockfile |
| CI verification of this boundary | **not yet** — see `DEMA-UI-CI-TRUTH-GATE-1A` (TASK-019): `npm ci` + `tsc --noEmit` + tests + build + `npm audit` are planned, not running | honesty row |

The UI is a render shell: no kernel, gate, receipt, or consent path imports from it. Its dependency graph is therefore outside the kernel TCB — but it **is** part of the repository's aggregate attack surface and must be audited on its own rail.

## 2. Runtime surface (the "bill" of what is actually consumed)

Dema runs on the Node.js standard library only. Statically-imported builtins `[M]`:

| `node:` builtin               | Purpose                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node:crypto`                 | Ed25519 signing/verification, SHA-256 content addressing                                                                                         |
| `node:fs`, `node:fs/promises` | local receipt / profile / index read-write under `DEMA_HOME`                                                                                     |
| `node:os`                     | home-dir resolution (`~/.dema`)                                                                                                                  |
| `node:path`                   | path composition                                                                                                                                 |
| `node:readline`               | interactive `dema chat` REPL                                                                                                                     |
| `node:url`                    | module-path resolution (`fileURLToPath`)                                                                                                         |
| `node:util`                   | `promisify` and formatting                                                                                                                       |
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
