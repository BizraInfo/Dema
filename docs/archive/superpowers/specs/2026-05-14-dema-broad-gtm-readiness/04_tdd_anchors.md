# Phase 04 — TDD Anchors

## Test-first sequence

### Slice 1 — Receipt schema documentation

Write tests or scripts that confirm:

- every field emitted by `downloads.audit.preview` appears in receipt docs;
- docs mention `PARTIAL_PLACEHOLDER`;
- docs state local verifier never emits `PERMIT`;
- docs include at least one valid task receipt JSON example.

Implementation target:

- `docs/RECEIPTS.md` or `docs/RECEIPTS_SCHEMA.md`.

### Slice 2 — Verifier explanation

Write failing tests for:

- valid task receipt returns `certified: false`;
- valid gateway handoff receipt returns `upstream_required: true`;
- malformed receipt returns stable rejection code;
- formatted output says "not SAT-certified".

Implementation target:

- `packages/verifier/src/`.

### Slice 3 — Installer dry-run/check

Write failing tests for:

- dry-run does not create `~/.dema`;
- check reports missing prerequisites without mutation;
- install remains idempotent;
- uninstall refuses without exact phrase.

Implementation target:

- `packages/installer/src/setup.js`;
- install scripts if already present.

### Slice 4 — Subprocess policy

Write failing tests for:

- `dema sovereign` refuses when scaffold is missing;
- unsupported args refuse;
- timeout is enforced;
- no `process.exit(0)` on spawn error unless child succeeded.

Implementation target:

- `apps/cli/src/index.js` or a extracted command helper.

### Slice 5 — Typed error envelope

Write failing tests for:

- missing receipt returns `bizra.dema.error.v0.1` in JSON mode;
- unsafe memory entry name returns stable code;
- gateway unavailable includes code and hint;
- human output remains concise.

Implementation target:

- `packages/core/src/errors.js`;
- CLI dispatch error boundary.

## Completion gates per slice

Each slice must pass:

```bash
npm test
npm run check
git diff --check
```

If a slice changes docs only, `git diff --check` plus any available doc
validation is sufficient.

## Anti-regression assertions

- No new runtime dependencies without written justification.
- No Dema-local `PERMIT` verdict.
- No hidden daemon.
- No broad catch that hides security-relevant errors.
- No command that mutates outside `DEMA_HOME` without explicit consent.
