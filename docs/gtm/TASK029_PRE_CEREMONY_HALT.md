# TASK-029 pre-ceremony halt (GTM G0)

Truth: **no production signing posture claim** until founder ceremony completes.

## What is already proven (fixture / code)

- External-trust authorship verification paths exist on disk (see task notes).
- P0.2b crash matrix (2026-07-29) found **CP5** blocking defect: crash after
  `appendRetiredRegistry` and before `activateGeneration` can leave
  `retired_generation` with no usable active key. Ceremony blocked until CP5 closes.

## What this GTM cycle does NOT do

- No real key generation
- No revocation receipt on operator `~/.dema`
- No registry mutation
- No cron change

## Exact founder GO required before ceremony

Typed consent for rotate + expected old fingerprint + isolated ceremony machine.
After GO: close CP5 in a dedicated slice, then run ceremony outside AI transcripts.

## GTM language until then

"Local receipts are content-addressed; production mission-signing key rotation is
scheduled under founder ceremony (TASK-029). Do not treat current key custody as
launch-ready signing posture."
