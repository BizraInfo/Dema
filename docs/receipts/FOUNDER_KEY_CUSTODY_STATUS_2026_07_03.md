# Founder key custody status — 2026-07-03

**Status:** `CUSTODY_CLEAN_NO_ROTATION_REQUIRED`
**Closes:** RISK-001 ("password/credential exposure in AI transcript") from the
founder's ChatGPT thread export (sha256 `9163af8f…`, lines 27290–27361 and
8788–8805). That risk was a conditional hygiene rule plus a reference to an
"earlier reported exposure" that was never substantiated by any evidence.

## Operator declaration (OPERATOR_DECLARED, 2026-07-03)

The founder/operator declared in-session: there is nothing exposed — no local
API key exists, no machine password or private key was ever pasted into any
AI chat. Node0/Dema hold no third-party credentials yet.

## Disk evidence (VERIFIED, metadata only)

- `~/.dema/keys/node0-ed25519.pem` — private key present, mode `0600`
  (owner-only), created 2026-06-18; never tracked by git.
- No key material anywhere in repo history — gitleaks gate green across full
  history on every CI-eligible run.
- Repo holds no stored credentials; account topology is declared metadata
  only (see operator memory: awareness ≠ keys).

## What this proves

- The recurring "P0 rotate exposed credentials" item is CLOSED by operator
  declaration bound to the disk facts above. Future audits citing the
  ChatGPT thread's RISK-001 should cite this receipt as its resolution.

## What this does not prove

- It does not prove the state of external vendor systems, nor future
  hygiene. If a credential is ever actually pasted into a model chat after
  this date, it is burned and must be rotated — this receipt does not
  pre-clear that.
- It is not a cryptographic attestation; it is an operator declaration plus
  verified local metadata.

Boundary: no key material read or reproduced here · no rotation performed ·
no signing · no network.
