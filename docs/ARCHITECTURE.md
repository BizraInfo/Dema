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

dema status
  reads Node0 readiness through an adapter

dema ambient / dema ambient:json
  previews ambient execution boundaries; executes nothing

dema today
  records continuity only; mission_executed=false, runtime_pulse.fired=false

dema mission propose
  previews ARTIFACT-011 readiness and exact consent; executes nothing

dema receipts
  lists or views local proof receipts

dema monetize
  displays the safe first offer boundary only
```
