# Dema Architecture v0.1

```text
Dema App Shell
  ↓
Profile + Memory
  ↓
Node0 Adapter
  ↓
Mission Proposal
  ↓
FATE Consent Boundary
  ↓
Runtime Adapter
  ↓
Receipt Viewer
  ↓
Skill Memory
```

Dema does not own dangerous execution.

Dema talks to adapters.  
Adapters talk to runtime.  
Runtime enforces FATE.  
Receipts decide truth.

## v0.1 command surfaces

```text
dema setup
  creates ~/.dema without starting a daemon

dema / dema help
  shows CLI help only; starts no runtime

dema welcome
  shows first-run orientation only; performs no setup

dema status:json
  reads Node0 readiness through an adapter as JSON

dema doctor
  validates readiness predicates and exits nonzero on failed gates

dema consent plan / dema consent plan --json
  previews micro-consent scope; records no approval and executes nothing

dema memory / dema memory show NAME
  reads local memory/profile entries only

dema design emulate-loop / dema design emulate-loop --json
  previews PAT/SAT loop design assumptions; runs no agents, runtime, network, receipts, or local writes

dema task
  lists or runs registered local preview tasks behind autonomy gates

dema sovereign
  renders the local scaffold view only; starts no daemon or federation

dema onboard / dema onboard --json
  previews first-run user state and blocked actions; performs no setup, mission, network, or mint

dema roadmap preview / dema roadmap preview --json
  previews advisory optimization priorities and dependencies; dispatches no work and enforces no gates

dema evidence receipt preview / dema evidence receipt preview --json
  previews receipt-shaped evidence with canonical hashes; mints no receipt, signs nothing, and writes nothing

dema ihsan floor preview / dema ihsan floor preview --score N --json
  previews an externally supplied Ihsan scalar against the floor; certifies nothing and runs no gate

dema behavior modulation preview / dema behavior modulation preview --json
  previews visible, reversible guidance modulation under exact consent; applies no behavior change

dema diagnostics plan / dema diagnostics plan --json
  previews a self-diagnostics mission plan; runs no checks and executes nothing

dema mission draft / dema mission draft --json
  previews Intent -> MissionDraft -> ConsentPlan; records no approval and executes nothing

dema status
  reads Node0 readiness through an adapter

dema ambient / dema ambient:json
  previews ambient execution boundaries; executes nothing

dema report safety / dema report safety --json
  previews safety posture and evidence gaps; certifies nothing

dema mcp blueprint / dema mcp blueprint --json
  previews MCP integration controls; calls no MCP tools and stores no credentials

dema network blueprint / dema network blueprint --json
  previews Node1/Node2 readiness gates; connects no nodes and opens no sockets

dema today
  records continuity only; mission_executed=false, runtime_pulse.fired=false

dema mission propose
  previews ARTIFACT-011 readiness and exact consent; executes nothing

dema receipts
  lists or views local proof receipts

dema models
  inventories local model surfaces with local-only probes; invokes no model and mutates nothing

dema monetize
  displays the safe first offer boundary only
```
