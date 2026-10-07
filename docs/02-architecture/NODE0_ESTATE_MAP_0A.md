# NODE0 Estate Map 0A

Truth label: `NODE0_ESTATE_MAP_COMPONENT_ONLY`

## What this component does

`NODE0-ESTATE-MAP-0A` compares caller-supplied, metadata-only descriptions of
the same approved roots. It is the deterministic middle of a future estate-map
mission:

```text
approved root registry + prior observation + current observation
    -> canonical per-root outcome + deterministic summary
```

The registry and every observation bind only IDs and digests. Raw paths,
content, secrets, provider settings, and credentials are refused by the closed
input shape.

## Outcomes

| Current evidence | Prior evidence | Outcome | Promotion |
| --- | --- | --- | --- |
| `AVAILABLE` + `COMPLETE` | none | `BASELINE_REQUIRED` | `HOLD` |
| `AVAILABLE` + `COMPLETE` | same complete metadata digest | `UNCHANGED` | comparable |
| `AVAILABLE` + `COMPLETE` | different complete metadata digest | `CHANGED` | comparable |
| `UNAVAILABLE` | any | `UNAVAILABLE` | `HOLD` |
| incomplete or `UNKNOWN` | any | `INCOMPARABLE` | `HOLD` |
| complete available after unavailable/incomplete | non-comparable | `RESTORED_UNVERIFIED` | `HOLD` |
| root absent from current observation | any | `OBSERVATION_MISSING` | `HOLD` |

`UNAVAILABLE` is never treated as removal or deletion. A non-comparable root
sets `zero_meaningful_delta` to `null`, so an incomplete run cannot claim a
zero-delta success.

## Boundary and authority

This is a `COMPONENT` under
[Proof-of-Truth Claim Scope v0.1](POT_CLAIM_SCOPE_v0_1.md), not a route,
mission, responsibility, VRO, or Node0 closure claim.

It performs no filesystem scan/read/write, network use, provider/model call,
runtime start, consent consumption, receipt minting, checkpoint, recovery, or
human-burden measurement. `authority_delta` is always `0` and every boundary
flag is `false`.

The component compares supplied data. It does not establish that a supplied
digest represents a real root or that an observation is complete in the world.
Those require a future governed observer, mission verifier, receipt, and
recovery proof.

## Integrity check

`buildNode0EstateMapPayload(input)` content-addresses the decision and all-false
boundary, but never returns the supplied input. To independently rederive the
decision, `verifyNode0EstateMapPayload(payload, input)` requires that input as a
separate argument and rejects altered or rehashed decision data, extra payload
fields, schema drift, a nonzero authority delta, or a changed boundary.

## Check

```bash
node --test tests/node0-estate-map.test.js
```
