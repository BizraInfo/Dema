# Contributing to Dema

Dema follows BIZRA law:

```text
No claim without proof.
No action without consent.
No memory without boundary.
No monetization without verified benefit.
```

## Development

```bash
npm install
npm test
npm run check
```

## Source preservation

A slice is not source-durable until its source bytes are both committed to Git
and ingested into the governed BIZRA Genesis Library as immutable original
bytes. Receipts, test output, and session transcripts are evidence, not source
backups. This policy does not authorize BGL ingestion: until that governed path
and its consent are present, label the slice `RECOVERY_RISK` and do not call
source recovery complete.

## Pull request checklist

- [ ] User-facing language is simple and non-hype.
- [ ] No token/economic claims.
- [ ] No hidden background process.
- [ ] Consent boundary is explicit.
- [ ] Tests included.
- [ ] Source preservation is Git-committed and BGL-ingested, or explicitly marked `RECOVERY_RISK`.
- [ ] README remains understandable by non-technical users.

## Lighthouse pilot lane

Lighthouse is Dema's **private, invitation-only pilot lane** for early operators. Participation is 1:1 with explicit consent; no operator names are public, no open applications exist, no "how to apply" page exists. The operator contract lives in [docs/LIGHTHOUSE.md](docs/LIGHTHOUSE.md).

Public outreach for Lighthouse operators is a public federation claim and is forbidden per [`dema monetize`](apps/cli/src/index.js).
