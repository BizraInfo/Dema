# Node0 Genesis v1 Lighthouse — Candidate Handoff

Status: `NODE0_LIGHTHOUSE_CANDIDATE_NOT_READY`

This document is the technical handoff for the first BIZRA Seed. It is a
candidate package, not a public federation launch and not proof that Genesis v1
is closed. The private pilot/operator policy remains in [`LIGHTHOUSE.md`](LIGHTHOUSE.md).

## Current release identity

The locally qualified candidate is:

```text
campaign: NODE0-GENESIS-FINAL-SPRINT-1A
commit:   b0e984904563158253a7e3a17b5ac624cf7e1959
tree:     cafe3e6476c2df926f445b5de6546ded26d7e0d6
release:  NOT_CREATED
truth:    CURRENT_MEASURED / LOCAL_CANDIDATE
```

The commit is not a canonical remote release until exact-head CI, final tree
comparison, merge/re-read, and a release manifest are complete.

## Claim ceiling

```text
NODE0_GENESIS_V1_CLOSED                    = false
MOMO_SERVICE_READY                         = NOT_PROVEN
FOUNDER_ENGINEERING_REQUIRED_FOR_NORMAL_USE = NOT_PROVEN
NODE0_LIGHTHOUSE_READY                     = false
PUBLIC_FEDERATION_ACTIVE                   = false
PRODUCTION_ECONOMY_ACTIVE                  = false
```

The candidate currently proves a local governed runtime composition, a
proposal-only Prompt Compiler → MissionContract path, a constitutional
attention receipt reducer, and local PAT/SAT/FATE/URP projections. It does not
prove sovereign-root custody, human usefulness, public federation, or a
production economy.

## Clean-node preflight

Use a disposable directory or a fresh personal machine. A second device owned
by the same human remains another Node0 asset; it is not Node1.

```bash
node --version                 # Node 20 or newer
git clone https://github.com/BizraInfo/Dema.git
cd Dema
node bin/dema welcome
node bin/dema setup
node bin/dema status
node bin/dema doctor
```

The CLI setup is local and consent-bound. It does not establish a principal,
start public networking, or enroll a human into federation.

For candidate developer/runtime qualification, install the pinned repository
dependencies according to the lockfiles, then run:

```bash
npm ci
npm test
npm run check
npm run llm:guidance
cd packages/dema-ui
npm ci
npm run build
```

The fresh-node commands above are **instructions**, not current second-machine
evidence. The current candidate's combined closure-required proof was
`80/80`; its DEMA build passed while repository type validation was skipped by
configuration. Reproduce and record the exact environment before promoting a
claim.

## Local Genesis runtime

The governed candidate runtime binds to loopback only:

```bash
cd Dema
npm run genesis:node0 -- --no-ui
```

The current installed candidate uses a user-owned service pair: DEMA on the
human-facing port and the governed URP adapter on its loopback API port. Service
installation is host-specific and is not yet a portable installer claim. Do
not revive the retired JavaScript gateway as a production executor.

Readiness is only readiness:

```text
HTTP 200 ≠ principal bound
service active ≠ Node0 closed
```

## Human and system boundaries

- `HUMAN-0` is the human-owned Node0 identity; `Momo` is the user-facing name.
- A device is an asset of the human node, not the human node itself.
- Root DNA is public/canonical context; Momo's private Node Story and current
  life state stay local and are not copied into this package.
- PAT-7 is human-private proposal/capability space; models remain replaceable.
- SAT-5 is the BIZRA system verification plane; it is not a caller-supplied
  boolean and does not receive Momo's full private story.
- FATE controls consequential authority and exact consent.
- Local URP reports resource availability separately from authorization.
- Operational signer identity is not Human Sovereign Root identity.
- No private key enters Git, receipts, logs, model context, or this package.

The public Root DNA canon is represented by these content-addressed source
artifacts; the list contains no private user state:

```text
BIZRA_Ideology_Master_Document_v0.1_Draft-1.pdf  c4c570…bfc32
bizra.pdf                                       f95bc…01538
BIZRA_Third_Fact_v0_1_FINAL.pdf                 1deacd…cd02d
narrations.pdf                                  ada134…1560
themassage.pdf                                  e05b73…d3ce
```

The current measured combined Root DNA commitment is:

```text
sha256:147957733a3e713dc4522a86efd0780e44d2786c3246fd6127a91fbeeee32ece
```

## Safe user flow

```text
Momo natural intent
  → Prompt Compiler
  → validated MissionContract proposal
  → context and CAA orientation
  → DEMA shows what it understood/knows/infers/needs
  → exact consent only if required
  → FATE
  → bounded effect
  → independent observation
  → SAT verification
  → receipt
```

Understanding never creates consent. A consequential instruction must remain
`authority: NONE` until the governed FATE path receives the exact current
consent phrase. A missing or changed context, tampered contract, stale card, or
unknown consequential token fails closed.

The allocation receipt records why attention moved; it does not authorize an
effect. On restart, the frontier is re-derived from current state rather than
blindly replaying yesterday's ranking.

## Recovery and rollback

The journal and receipts are the recovery source. Verify before retrying an
ambiguous effect; never automatically retry an effect whose commit status is
unknown. A controlled service restart must preserve mission identity, contract
binding, receipt validity, and duplicate-effect count.

The current candidate service switch is reversible by removing the sprint
drop-ins under the human user systemd configuration, running
`systemctl --user daemon-reload`, and restarting the original user services.
Record the pre-switch unit files before applying this procedure. Do not delete
campaign evidence or historical receipts during rollback.

## Incoming-human handshake

Node0 may prepare a public/admissible `OFFER` describing the protocol shape.
An offer is not a connection; a connection is not authority transfer. No
Momo-private state, PAT private memory, signer material, or local receipts with
private context may cross the boundary.

```text
NODE_ONBOARDING_READY   = false until clean reproduction and release sealing
PUBLIC_FEDERATION_ACTIVE = false
```

An actual second human requires a separate identity and consent ceremony. A
fixture, second process, or second personal device must not be called a real
second human.

## Remaining admission gates

This candidate handoff becomes a Lighthouse package only after the campaign
independently verifies the missing gates: current host `remote_write`, valid
principal/root proof, a real useful Momo mission, exact-consent bounded effect,
full-path recovery, clean reproduction, exact-head CI, final release manifest,
and Founder Exit. Until then the truthful status is
`NODE0_LIGHTHOUSE_CANDIDATE_NOT_READY`.

Current limits and historical evidence boundaries are maintained in
[`CURRENT_LIMITS.md`](CURRENT_LIMITS.md). The private operator lane and its
separate invitation rules are maintained in [`LIGHTHOUSE.md`](LIGHTHOUSE.md).
