# Receipt: NODE0-BASE-CONSTELLATION-1A

Truth label: `NODE0_BASE_CONSTELLATION_MEASURED_REPO` (kernel envelope: `OBSERVED_LOCAL`)

## Slice

Node0 observes its own body. A base is a device the human has enrolled into
their own node — this host and the phone in their hand are two bases of one
Node0, not two nodes. This slice lets the node answer, from real reads instead
of memory: **which bases belong to me, and how much of my own storage can I
not reach?**

The question existed because the prior surface (`multi-device-asset-awareness`)
was DOCS_ONLY: it reported a June fixture while a real phone was cabled to the
host — a node that describes itself from memory instead of looking is why its
human has to be its senses.

## The laws this slice pins

1. **A mounted sliver can never mask an unmounted terabyte** (NBC-01, measured
   defect): reachability computed per disk reported a 1024 GB drive as
   reachable because a 2 GB partition on it was mounted. Reachability is now
   partition-level; dark capacity is attributable to named partitions and is
   always stated, even when 0.
2. **Presence is never enrolment** (NBC-03): a cabled companion is surfaced as
   a base with `enrolled=false`. No cable promotes itself into membership.
3. **Verify runs INSIDE the emit path** (NBC-CLI-01): `dema node0
   constellation` re-derives every total from the envelope's own rows before
   printing; a mismatch exits 1 — a forged envelope is refused, never shown.
4. **Envelope-level summaries re-derive too** (NBC-08, PR #458 review catch):
   `dark_capacity_gb`, `base_count`, `attached_not_enrolled` each re-derive,
   so tampering the headline fails with a named reason.

## Surfaces

| Role | Path |
| --- | --- |
| Pure kernel (derive + verify, refusal reasons) | `packages/core/src/node0-base-constellation.js` |
| Read-only gatherer (plain `/proc`, `/sys`, gvfs reads; no child process, no device content) | `apps/cli/src/node0-base-constellation-gatherer.js` |
| CLI caller | `apps/cli/src/commands/node0.js` — `dema node0 constellation [--json]` |
| Kernel tests (NBC-01..08) | `tests/node0-base-constellation.test.js` |
| CLI tests (NBC-CLI-01..03, live end-to-end) | `tests/node0-base-constellation-cli.test.js` |
| Review gate (fixtures + planted forgeries) | `scripts/review/node0-base-constellation-check.mjs` |
| Gate self-proof (NBC-09) | `tests/node0-base-constellation.test.js` |

## Commit binding

| Act | Commit |
| --- | --- |
| Kernel + gatherer + NBC tests | `8790195` — feat(node0): the node can see its own bases and its own dark storage |
| First caller (`dema node0 constellation`) | `cc93ccd` — feat(cli): give the base constellation its first caller |
| Envelope-level re-derivation (review catch) | `c3a4af1` — fix(core): re-derive envelope-level constellation summaries in verify |
| Merged to main | `815ef10` — PR #458 |
| Registry row + review gate + this receipt | this slice (NODE0-CONSTELLATION-REGISTRY-1A) |

Qualification of the wiring slice (as recorded in the mission pointer,
`slice_2026_08_20_nbc_wiring_1a`): dual clean extractions 9496/9493 pass/0
fail both arms, five gates exit 0 both arms, corpus 133/133 new=0, secret scan
clean with fired control, mirror-verified tree `0645225f`; review-fix arm
9497/9494/0.

## First light (measured on the operator's host, 2026-08-19)

The first live run surfaced what reading the node's own source could never
show: `nvme2n1` (SAMSUNG MZVKW1T0HMLH) fully dark — 1024.2 GB unreachable
across three named partitions — and the operator's phone attached but
`enrolled=false`. The node can see its own body, including the parts it
cannot reach.

## The review gate's own controls

The gate does not trust a green verify: it plants three forged envelopes
(`dark_capacity_gb`, `base_count`, `attached_not_enrolled`) and requires each
to be REFUSED with its exact named reason. A verify that stops refusing turns
the gate red. An empty check list also fails closed — a green gate must say
what it verified.

## What this does not prove

It does not prove enrolment, pairing, ownership, custody of any signing key,
device willingness, mounting capability, operator execution, daemon runtime,
network use, wallet access, or live federation. Observation grants nothing:
boundary all-false, `device_effects` all-false, `authority_delta` 0.
