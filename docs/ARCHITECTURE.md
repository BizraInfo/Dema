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

dema onboard / dema onboard --json
  previews first-run user state and blocked actions; performs no setup, mission, network, or mint

dema roadmap preview / dema roadmap preview --json
  previews advisory optimization priorities and dependencies; dispatches no work and enforces no gates

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

dema monetize
  displays the safe first offer boundary only
```
