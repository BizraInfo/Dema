# Receipt: NODE0-SPINE-RUNNER-CLI-1A

Truth label: `NODE0_MEASURED_PROOF_SPINE_SANDBOX_RUN`

## Slice

One consent-gated operator CLI that runs the measured proof spine in sandbox only:

```text
execute (sandbox rename)
→ execute receipt
→ Ed25519 receipt attestation
→ proof chain (single anchor = execute content_hash)
→ signed chain head
→ JSON envelope
```

## Proof Contract

The default gate must pass only while:

- the exact spine GO phrase matches byte-for-byte (wrapper authorizes full spine; inner phrases composed, not bypassable),
- missing/wrong wrapper consent fails before mutation/signing/chain,
- reversibility is visible via backup/undo manifest fields (`auto_undo_performed: false` on CLI),
- all four spine stages verify and bind in order,
- mutation stays inside the sandbox root,
- no private key material appears in stdout JSON,
- the boundary holds sandbox-only and signing authority ≠ execution authority.

`npm run check` runs `node0-spine-runner-check.mjs` and keeps `NODE0_SPINE_RUNNER_CLI_1A` at `MEASURED_REPO`.

## Commands

```bash
dema node0 spine run --consent "GO: run measured proof spine in sandbox" --json
node --test tests/node0-spine-runner.test.js
node --test tests/node0-spine-runner-cli.test.js
node scripts/review/node0-spine-runner-check.mjs --json
npm run check
```
