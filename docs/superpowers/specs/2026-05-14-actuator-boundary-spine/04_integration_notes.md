# Phase 04 - Integration Notes

## SNR extraction

Signal:

- Bash is the deepest bridge from text to operating-system side effects.
- The Dema boundary should be enforced through typed intent, consent, policy,
  and review gates rather than agent discretion.
- Review checks are valuable because they turn doctrine into a repeatable local
  proof.

Noise:

- Full Bash sandbox design belongs outside this Dema repo until Node0 runtime
  gates are ready.
- Token, PoI, and economic flywheel mechanics remain policy-only here.
- GUI and mobile-agent actuation should stay classified as future actuator
  classes, not implemented behavior.

## HHMM mapping

Use these phase states for future consent-spine planning:

```text
OBSERVE:
  parse intent, extract files, commands, services, unsafe references

CLASSIFY:
  map permissions to actuator classes and risk labels

CONSTRAIN:
  apply preview policy decisions and exact-consent requirements

HANDOFF:
  prepare governed runtime request only if approval exists

VERIFY:
  run read-only checks and render Proof-of-Truth labels
```

Illegal transitions:

- `OBSERVE -> HANDOFF` without classification.
- `CLASSIFY -> EXECUTE` inside Dema.
- `CONSTRAIN -> HANDOFF` when consent is missing, expired, or revoked.
- `VERIFY -> economic reward` without verified impact governance.

## Hash-table representation

Use stable keys for future internal maps:

```text
permission_key = resource_id + ":" + action
actuator_key = mission_id + ":" + actuator_class
policy_key = mission_id + ":" + code + ":" + resource_id
commitment_hash = sha256(stableStringify(permissions))
```

This keeps duplicate permissions collapsed and makes future consent diffs easy
to audit without introducing runtime state in this repo.

## Diffusion reasoning amplifier

For future planner output, amplify only claims that survive multiple local
lenses:

```text
candidate permission
  -> actuator classifier
  -> policy preview
  -> consent shape validator
  -> actuator source gate
  -> formatted operator warning
```

If any lens blocks, the candidate becomes noise and must be rewritten as a
preview-only warning or runtime handoff requirement.

## Proof-of-Truth convergence

Formal:

- schema-tagged consent and review reports;
- explicit forbidden shell patterns;
- finite HHMM-style phase transitions.

Cryptographic:

- current Dema preview uses commitment hashes for consent drafts;
- runtime effect logs and receipts remain deferred to governed Node0.

Empirical:

- actuator check runs locally;
- consent planner tests prove unsafe references are excluded;
- ambient tests prove Bash risk remains visible.

Economic:

- Dema does not mint, settle, reward, or claim economic value;
- economic channel stays closed until verified impact and governance exist.

## Implementation order

1. Keep the actuator review gate green.
2. Add actuator classification to consent planner output.
3. Add a dedicated consent-spine preview command if operator UX needs it.
4. Define runtime handoff request shape only after exact-consent semantics are
   stable.
5. Defer actual runtime capability minting to governed Node0 runtime.
