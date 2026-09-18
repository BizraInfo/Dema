# PEAK-EVIDENCE-SEMANTIC-ADMISSION-1A

**Truth state:** `IMPLEMENTED_REMOTE_BRANCH / CI_PENDING`

## Mission

Close one false-GREEN class in the Peak self-loop evidence path:

> Correct source-byte provenance is necessary, but it is not proof that the semantic event carried by those bytes is true.

The previous gatherer could read any file, hash the actual bytes, then emit a caller-supplied positive event such as `gate_passed` with `truth_label: MEASURED`. That made a readable JavaScript implementation file sufficient to represent a passing gate if the caller labelled it that way.

## Base and branch

- repository: `BizraInfo/Dema`
- base: `9f13a8da30e48aa426ec45a9c0eb947b0c3cea21`
- branch: `audit/peak-evidence-semantic-admission-1a`
- authority delta: `0`

## Evidence inspected

- `packages/core/src/peak-self-loop-preview.js`
- `packages/core/src/peak-evidence-gatherer.js`
- `packages/core/src/process-value-preview.js`
- `packages/core/src/verification-admission.js`
- `apps/cli/src/commands/peak-self-loop.js`
- `apps/cli/src/commands/node0.js`
- `scripts/bind-peak-evidence.mjs`
- `tests/peak-evidence-gatherer.test.js`
- `tests/peak-self-loop-preview.test.js`
- `docs/CURRENT_LIMITS.md`
- `skills-src/self-loop-engineering/SKILL.md`

The connected GitHub repository was inspected directly. The operator-local path `/home/bizra-operating-system/Downloads/Dema` was not mounted in the execution container used by this audit, so no local shell, DEMA_HOME, host process, or operator-runtime evidence is claimed.

## Finding

`peak-evidence-gatherer` v0.1 proved source binding but not event semantics. The diagnostic script `scripts/bind-peak-evidence.mjs` then supplied source-code paths while labelling them `gate_passed` / `clean_commit`. Because the gatherer minted `MEASURED` after readability + hashing, provenance could be promoted into a positive semantic signal.

This is distinct from PEB-08:

- PEB-08 remains the pure-kernel direct-call ceiling: a caller can bypass the gatherer entirely with a shape-valid envelope.
- This slice hardens the gatherer path itself so a caller using the gatherer cannot obtain a positive event merely from readable bytes.

## Minimum repair

Schema `bizra.dema.peak_evidence_gatherer.v0.2` admits one positive proof class only:

```text
type: gate_passed
source bytes: JSON object
receipt.gate == candidate.id
receipt.exit == 0
```

An admitted event carries:

```text
semantic_verifier: gate_receipt_exit_0_v1
```

`verifyEvidenceSignals` independently re-reads the source, re-derives SHA-256, re-runs the semantic verifier, and checks the verifier identity.

All other positive classes fail closed until they earn an event-class-specific semantic verifier. In particular, `clean_commit` is not inferred from source-code readability.

## Acceptance contract

The focused suite adds controls requiring:

1. valid `{gate:<id>, exit:0}` receipt -> admitted `MEASURED` signal;
2. missing source -> excluded;
3. changed bytes -> verification refusal;
4. forged source hash -> refusal;
5. source code relabelled `gate_passed` -> `gate_receipt_json_required`;
6. receipt with `exit:1` -> `gate_receipt_exit_not_zero`;
7. receipt for another gate -> `gate_receipt_id_mismatch`;
8. `clean_commit` without its own semantic verifier -> excluded;
9. hash-correct forged event whose real receipt says failure -> verification refusal;
10. valid semantic gate receipts can still move the Peak preview from HOLD to CONTINUE.

`scripts/bind-peak-evidence.mjs` is converted into a negative control: its existing implementation-file candidates must all be excluded and the Peak loop must remain `HOLD_AND_REDUCE_NOISE`.

## Ihsan / sovereignty boundary

No production action is executed by this slice. No consent phrase changes. No filesystem mutation primitive is added to the kernel. No network, model invocation, daemon, token, wallet, PoI, federation, signer, key generation, or authority transition is introduced.

The gatherer remains purity-by-injection: its caller supplies the read function.

## What this does not prove

- It does not close PEB-08 for direct callers of the pure Peak kernel.
- It does not prove arbitrary JSON receipts authentic; `gate_receipt_exit_0_v1` proves only the narrow carried semantic shape against the source bytes. Stronger receipt schemas/signatures belong in later event-class verifiers.
- It does not implement semantic verifiers for `clean_commit` or other positive process event types.
- It does not add freshness/expiry.
- It does not make the ordinary `dema peak-self-loop` CLI live; that CLI still supplies no signal events by default.
- It does not start an autonomous loop, PAT/SAT runtime, or economic mechanism.
- It does not claim local test success in the audit environment; exact-head remote CI is required for promotion.

## Open documentation debt

`packages/core/src/peak-self-loop-preview.js` still contains the historical sentence `No such caller exists yet`. A gatherer now exists, so that sentence is stale. The deeper statement remains true: the pure kernel cannot itself establish source binding, and direct callers can bypass the gatherer. Correct the comment separately or with a safe whole-file edit; do not treat prose cleanup as proof of this slice.

## Promotion condition

Remain `CI_PENDING` until the exact branch head has:

- focused semantic gatherer tests green;
- root `npm test` green or any red causally classified against unchanged base;
- `npm run check` green or causally classified;
- `npm run llm:guidance` green;
- claim/no-overclaim gates green;
- whitespace/diff gate green;
- independent review of the semantic distinction `provenance != event truth`.

No merge is authorized by this receipt.
