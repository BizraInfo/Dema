# BIZRA Covenant Gate v0.1 (PROTOTYPE)

**Status labels (per Omnidirectional Audit rule):**

- [PROTOTYPE] — The gate logic, ThoughtPacket emission, screening rules, and demo receipt are implemented and tested locally.
- [DESIGN] — The overall state machine (Proposal → Screen → Packet → Micro-Consent "GO" → Receipt → GraduationDecision) is the intended kernel.
- [DO NOT CLAIM] — Not production cryptography. Not Shariah or legal opinion. Not real oracle verification. Not smart contract deployment. No fund movement. Dema remains the local face only.

## Purpose

The minimal solvable special case for a verifiable consent-and-screening gate before any Impact Bonding Curve / launchpad graduation.

It enforces the boundary the audit repeatedly surfaced:

> Agents may analyze, propose, screen, simulate, and prepare.
> Agents must not silently approve, deploy, migrate liquidity, or move funds.

## Usage (local, terminal-first)

```bash
# Screen a proposal
node -e '
  const { screenProposal } = require("./packages/covenant/src/covenant-gate.js");
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  console.log(JSON.stringify(screenProposal(p), null, 2));
' proposal.json

# Emit receipt (exact micro-consent required)
node -e '
  const { screenProposal, signReceipt } = require("./packages/covenant/src/covenant-gate.js");
  const fs = require("fs");
  const decision = screenProposal(JSON.parse(fs.readFileSync("proposal.json", "utf8")));
  const receipt = signReceipt(decision, "GO");
  console.log(JSON.stringify(receipt, null, 2));
' 
```

## Minimal schemas (as implemented)

See `packages/covenant/src/covenant-gate.js` for the canonical JS versions (frozen objects, deterministic hashing).

The Python skeleton in the audit is the reference design.

## Claim Ledger (this document)

- Screening rules + ThoughtPacket taxonomy: [PROTOTYPE]
- Micro-consent via exact "GO" + receipt: [PROTOTYPE]
- Demo HMAC signature: [PROTOTYPE] (warning present in output)
- No guaranteed APR / prohibited sector / debt ratio / team disclosure rules: [DESIGN]
- Integration with full Impact Curve / AMM graduation / Waqf treasury: [HYPOTHESIS] — not implemented
- Shariah compliance: [DO NOT CLAIM] — assistive screening only; requires scholar review
- Production use / on-chain / fund movement: [DO NOT CLAIM]

## Next micro (if consented)

- Wire `dema covenant screen <file>` and `dema covenant consent <decision> --typed-go GO` into the main CLI.
- Add real Ed25519 receipt signing (using existing authorship key machinery).
- Add fixtures + more adversarial test cases.
- Extend ThoughtPacket taxonomy with "minority_report", "consensus".

This module exists to make the audit's "one gate, one proposal, one decision, one consent, one receipt" concrete and locally auditable.

All changes to this surface must pass the same pre-push:seal + claim discipline.