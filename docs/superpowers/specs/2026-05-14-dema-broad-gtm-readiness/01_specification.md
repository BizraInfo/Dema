# Phase 01 — Specification

## Scope

Define the P0 readiness workstream that moves Dema from lighthouse-alpha proof
surface toward broad-GTM readiness without weakening repository invariants.

This spec covers the Dema product face only. It does not implement Node0
runtime execution, SAT-5 admissibility, receipt issuance, federation, identity
artifacts, or cloud deployment.

## Current facts

- Dema is a Node.js ESM CLI with zero runtime dependencies.
- Current full gate passes: `npm test` and `npm run check`.
- Dema now exposes preview surfaces for ambient boundary, consent planning, and
  safety reporting.
- Local SAT verification is honest but partial: local verifier may return
  `PARTIAL_PLACEHOLDER`, never `PERMIT`.
- Broad-GTM blockers identified by the technical assessment:
  1. installer hardening is incomplete,
  2. SAT/verifier status needs clearer receipt-facing treatment,
  3. `dema sovereign` subprocess path is not hardened,
  4. receipt schema documentation is not explicit enough,
  5. typed error envelopes are absent.

## Product objective

Enable a technical/privacy-first operator to run Dema locally and understand:

1. what Dema observed,
2. what Dema refused to do,
3. what exact consent would be required,
4. what evidence is preview-only,
5. what upstream Node0/SAT proof is still missing.

## Functional requirements

### FR1 — Installer readiness spec

Document and later implement installer commands that can run in dry-run/check
mode before mutating local state.

Required behaviors:

- `--dry-run` shows intended files and directories.
- `--check` validates prerequisites and reports blockers.
- uninstall path requires explicit consent before removing Dema-managed files.
- release docs publish expected SHA-256 hashes.
- no installer step starts a daemon.

### FR2 — Receipt/verifier transparency

Every receipt-facing surface must disclose whether a verdict is placeholder,
partial, or upstream-certified.

Required behaviors:

- local verifier never emits `PERMIT`;
- placeholder verdict text is visible in human output;
- JSON output exposes stable schema and verifier status;
- receipt docs explain which fields are required and which are provisional.

### FR3 — Subprocess hardening

Any command that delegates to external code must be gated, validated, or removed
from broad-GTM surfaces.

Required behaviors:

- check target file existence;
- reject unsafe arguments or unknown flags;
- add timeout when spawning child processes;
- surface failure without hiding subprocess errors;
- document why the command is safe or mark it experimental/private.

### FR4 — Typed error envelope

CLI/JSON errors should eventually expose stable machine-readable codes.

Required behaviors:

- preserve simple human text;
- add `schema`, `code`, `message`, and optional `hint`;
- do not leak secrets or local private data;
- fail closed on unknown errors.

## Non-functional requirements

- Preserve zero runtime dependencies unless a written justification is added.
- Preserve local-first state under `DEMA_HOME` or `~/.dema`.
- Preserve exact consent for high-risk actions.
- Preserve preview-only boundaries in Dema.
- Keep documentation understandable to non-technical users.
- Keep every spec module under 500 lines.

## Out of scope

- Implementing SAT-5.
- Posting to the gateway.
- Minting receipts from Dema for runtime work.
- Publishing install endpoints.
- Federation, public lighthouse outreach, token claims, passive-income claims,
  AGI claims, or public Proof-of-Impact claims.

## Success criteria

- P0 work can be implemented as small, testable slices.
- Each slice has an explicit test anchor before code.
- New docs distinguish preview, placeholder, partial, and certified states.
- `npm test` and `npm run check` remain the minimum completion gate.
