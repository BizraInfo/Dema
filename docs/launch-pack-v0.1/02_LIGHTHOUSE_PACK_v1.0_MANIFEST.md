# Binder Item 02 · Lighthouse Pack v1.0 Manifest

> **Pointer**: this binder item references the prior Lighthouse Pack v1.0 (sealed 2026-05-18 at HEAD `5d80368`). The pack itself exists at `/tmp/bizra-overnight/lighthouse-pack/` AND at `~/Documents/bizra/lighthouse-pack-v1.0/`.

## Pack contents (from MANIFEST.sha256)

```text
5ce9da5cb674e87f02a2fab010be911bf8ef460e55df50e5a20f4d6cb8566301  00_START_HERE.md
566738e43adad641c87e56d94227bf81c83ef10e23ad78541f837aebeedcfbe8  01_FOUNDATION_PROVENANCE_PACK_v1.2.md
c3e7107cd5a2c1ecc0e1c9cd328a6bf5d174dd758860c07adccbeb6bc5dee645  02_ARCHITECTURE_MAP_v0.2.md
c8755e3b17cc4a0558c0a7b47cc1e445d1e6888f34528027be2e6eed10c93156  03_CLAIM_LEDGER_v1.md
97d0593534a062f4584c56abe1d9adaad7d731cd8016e2cfc605db26332b9734  04_COLD_DEMO_PROOF.md
ae3159e0c24465f76c715cceb3af2b86dfce8769cae1bcd5249183f29acecb8e  05_SIX_COMMAND_DEMO.sh
d3ab5104e988a61858a9aef2bd3c7681d05795f90143c94bb84bff6026c65a07  06_KNOWN_GAPS.md         ← superseded by binder item 06
245232e28ac895480cc1013237962aeb2ecb67ac7d8f8b0993a9c01e5e8837b6  07_REVIEWER_FEEDBACK_FORM.md  ← superseded by binder item 07
d08481ecf87c836a2ce8788888aa10955d1ac21d11e45ddfe5cc43f08889007f  08_INVITATION_DRAFT.md
```

Total: **164KB · 9 files**.

## Why included as reference (not bundled)

The pack is **frozen at 5d80368** for cryptographic immutability. The binder v0.1 carries the manifest (these SHA-256s) but does NOT re-distribute the pack files. Reviewers fetch the pack from Mumu directly (out-of-band) and verify against this manifest.

## Verification command (when reviewer has the pack)

```bash
cd /path/to/lighthouse-pack-v1.0/
sha256sum -c MANIFEST.sha256
```

Expected: all 9 entries return `OK`. If any returns `FAILED`, the pack is invalid.

## What's superseded in this binder

- Pack `06_KNOWN_GAPS.md` (sealed 2026-05-18) → Binder `06_KNOWN_GAPS_v2.md` (current 2026-05-19 HEAD `ea4c231`)
- Pack `07_REVIEWER_FEEDBACK_FORM.md` (sealed 2026-05-18) → Binder `07_REVIEWER_FEEDBACK_FORM_v2.md` (current binder structure)

## Cross-reference

- Memory: `[[project_2026_05_18_lighthouse_pack_v1_0_sealed]]`
- Frozen HEAD: `5d80368` on branch `season-r3-smoke-boundary-v0.1`
- Current main HEAD (this binder): `ea4c231` + this binder's commit
