# ADR-039: Data Lake archive audit boundary

**Status:** Proposed  
**Date:** 2026-06-24 GST  
**Truth label:** `DATALAKE_ARCHIVE_AUDIT_LOCAL_METADATA_ONLY`

## Context

Dema now has a reference-only Dema/Data-Lake alignment preview, but the next safe bridge step is not a live sync. The safer next step is a local archive audit that can inspect a Data Lake ZIP envelope before any import, extraction, mutation, or proof-graph linking.

This ADR records the boundary for `dema datalake audit-zip <archive.zip>`.

## Decision

Add a local ZIP metadata audit surface that:

- reads only the ZIP central directory and archive bytes needed to hash the archive;
- emits a schema-tagged envelope: `bizra.dema.datalake_archive_audit.v0.1`;
- computes archive SHA-256, entry counts, top-level roots, extension counts, largest entries, and suspicious path markers;
- blocks extraction-safety if archive entry names contain path traversal or absolute paths;
- marks suspicious filenames such as `.env`, `settings.local`, `secret`, `token`, credential/key markers for review;
- exposes boundary flags proving no file extraction, archive entry write, Data Lake mutation, network call, model invocation, signing, minting, or federation.

## Non-goals

This is not a Data Lake importer. It does not read file bodies inside the archive, unpack files, write to the Data Lake, create receipts, sign artifacts, run PAT/SAT, call a model, invoke a network endpoint, mint tokens, or certify that the archive is safe for publication.

## Consequences

This gives Dema a measurable bridge-safety primitive: a deterministic, local, read-only archive envelope that can become evidence for a later consent-gated import receipt. The result is still metadata-only. Any import, extraction, repo mutation, or public-release decision remains a separate command and must carry its own consent, review, and proof boundary.

## Verification plan

- Unit-test central-directory parsing with synthetic ZIP central-directory fixtures.
- Unit-test clean archives, suspicious-path review findings, and rendered CLI output.
- CLI smoke: `dema datalake audit-zip <archive.zip> --json` emits the schema and boundary flags.
- Full gate: `npm run check` must stay green before merge.
