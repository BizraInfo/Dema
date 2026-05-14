# U1 Node0 Local URP Proof Pin

This pin records the bounded proof state merged by PR #32. It is a proof-of-state note, not a runtime activation, release note, or federation claim.

## Merge record

- PR: #32
- PR URL: https://github.com/BizraInfo/Dema/pull/32
- Merge commit: `784568392f48c9353474e92a5a361f490cfd9d80` (`7845683`)
- Head branch: `proof/u1-node0-local-urp`
- Main verification worktree: `/home/bizra-operating-system/Downloads/Dema-main-verify`

## Truth fields

- Truth label: `URP_LOCAL_ACTIVE`
- Node: `Node0`
- PAT count: `7`
- SAT count: `5`
- SAT roles: Validator, Oracle, Mediator, Archivist, Sentinel
- PoI mode: `sandbox_no_cash_value`
- Visibility: `local_only`

## Boundary

U1 does not claim:

- Node1 handshake
- Public network or federation
- Token value, cash value, or reward authority
- SAT PERMIT authority
- ARTIFACT-011 issuance
- Autonomous supervisor or hidden daemon
- Raw private data scanning

CodeRabbit was treated as advisory after its valid findings were addressed; BIZRA-owned gates decide proof quality.

## Verification

Commands run against merged `origin/main`:

```bash
env -u DEMA_NODE0_ADAPTER npm test
env -u DEMA_NODE0_ADAPTER npm run check
```

Result:

```text
npm test      119/119 pass
npm run check 119/119 pass
```

`npm run check` includes:

```bash
node scripts/node0-self-check.mjs --verify
```

## Gate evidence

Required owned/native gates passed before merge:

- BIZRA Review Gate / `proof-quality`
- Node 20.x test matrix
- Node 22.x test matrix
- CodeQL
- Socket Project Report
- Socket Pull Request Alerts

## U1 closure

U1 proves only this bounded local state:

```text
Node0 local URP proof seed
SAT-5 local seed registration
self_check_report.json
critic_report_001.json
repo-gate self-check verification
```

U2 must build on this by adding executable contracts, EffectCap invariants, and micro-consent law without weakening the U1 boundaries.
