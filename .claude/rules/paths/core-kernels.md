---
paths:
  - "packages/core/**"
  - "packages/verifier/**"
  - "packages/receipts/**"
  - "packages/fate/**"
---

# Path rule — core kernels

Pure kernels: no fs, network, process, clock, or random unless the slice explicitly documents injection.

Headers must state PREVIEW_ONLY / NOT ML / NOT runtime when the name sounds like ML (HHMM, diffusion, SAPE).

Every kernel exports a `verify*` or equivalent re-derivation path.

Allowlist: `scripts/review/kernel-purity-allowlist.js`

Tests: mirror file in `tests/` with boundary-false and forgery cases.
