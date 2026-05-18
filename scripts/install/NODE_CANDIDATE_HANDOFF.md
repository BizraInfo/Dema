# Node Candidate Handoff · install.sh user guide

**For:** any human invited to join BIZRA as a node candidate, after completing the in-person acceptance ceremony at the host's Node0.

This document is the on-device companion to your in-person ceremony. It walks
you through the 4 steps that bootstrap your local Node-N state on your own
hardware. It is preview-only — nothing leaves your machine, nothing connects
to a network, nothing automatic happens.

The unified installer (`scripts/install/install.sh`) handles every node in
BIZRA. The host's Node0 uses it without arguments. You, as a candidate, use
it with identity flags the host gave you alongside this document.

---

## What this handoff is and isn't

**It IS:**

- A local-only setup on your own device
- Preview-only — no network calls, no federation, no data leaves your machine
- A way to verify on your hardware what you witnessed on the host's hardware
- Reversible — `install.sh --uninstall` removes everything (exact consent required)
- The same code path the host's Node0 uses on their own machine

**It IS NOT:**

- A runtime activation (the BIZRA runtime lives upstream of this repository)
- A network handshake to the host's machine
- A token, payment, or economic claim of any kind
- An automatic installation (you walk through each step manually)

---

## What you need

- A laptop or desktop with **Node.js v20 or later** installed
- The Dema source code (delivered by the host via USB, tarball, or git clone)
- The identity parameters the host gave you alongside this document
- About **10 minutes** of attention

---

## Your identity parameters

The host should have given you these values together with this document:

| Parameter | Example | What it means |
|---|---|---|
| `--operator "<your name>"` | `"Samy"` | Your name in the registry |
| `--ordinal N` | `1` | Your node number (Node1 = first invited, Node2 = second, ...) |
| `--paired-receipt-id "<id>"` | `"2026-05-18_082658"` | The Proof-Forge receipt of your in-person acceptance |
| `--paired-receipt-hash "<hash>"` | `"8ac3d72699be..."` | The evidence hash of that receipt (64 hex chars) |
| `--paired-receipt-date "<YYYY-MM-DD>"` | `"2026-05-18"` | The date your in-person ceremony happened |

Keep these values handy. You'll paste them into the install command.

---

## The 4-step bootstrap

### Step 1 · Verify the source you received

Open a terminal. Navigate to the Dema directory you received.

```bash
ls -la
# Should show: apps/  packages/  scripts/  tests/  docs/  package.json  README.md ...
```

### Step 2 · Walk the 5-command verification (same as you saw at the host's place)

```bash
# 1. All tests pass
npm test

# 2. Integration check
npm run check

# 3. All 10 spine surfaces emit canonical boundary
npm run smoke-boundary

# 4. Doctrine invariants
npm run llm:guidance

# 5. Receipt chain integrity
python3 scripts/forge_evidence.py --verify --project-dir .
```

If any of these fail, **stop and contact the host**. Something is off.

### Step 3 · See your name in the registry (the counter-flip moment, on your hardware)

```bash
node -e 'import("./packages/core/src/node-registry-preview.js").then(m => {
  const r = m.buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: <YOUR_ORDINAL>, node_label: "Node<YOUR_ORDINAL>",
        status: "accepted_primary", candidate_name: "<YOUR_NAME>" }
    ]
  });
  console.log(JSON.stringify({
    connected_node_count: r.registry_state.connected_node_count,
    pat_agents_planned: r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate.pat_agents,
    sat_agents_planned: r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate.sat_agents
  }, null, 2));
})'
```

Replace `<YOUR_ORDINAL>` and `<YOUR_NAME>` with the values the host gave you.
Output shows the counter-flip moment on your hardware — same math the host
showed you on theirs.

### Step 4 · Run the unified installer

First, dry-run to see what it would do (writes nothing):

```bash
./scripts/install/install.sh --dry-run \
  --operator "<your name>" \
  --ordinal <your ordinal> \
  --paired-receipt-id "<id>" \
  --paired-receipt-hash "<hash>" \
  --paired-receipt-date "<YYYY-MM-DD>"
```

Read the output. If it looks right, run for real (no `--dry-run`):

```bash
./scripts/install/install.sh \
  --operator "<your name>" \
  --ordinal <your ordinal> \
  --paired-receipt-id "<id>" \
  --paired-receipt-hash "<hash>" \
  --paired-receipt-date "<YYYY-MM-DD>"
```

The installer writes:

- `~/.dema/profile.json` — your Node-N profile (name, ordinal, paired receipt)
- `~/.dema/memory/node{N}-self-witness.json` — your on-device witness
- `~/.dema/memory/`, `~/.dema/receipts/`, `~/.dema/logs/`, `~/.dema/skills/` — directories

If `~/.dema/profile.json` already exists, the installer will NOT overwrite it.
If you want to re-run from scratch: `./scripts/install/install.sh --uninstall`
(requires typing `REMOVE DEMA LOCAL DATA` to confirm).

---

## After bootstrap · what to do next

### 1. Send your self-witness back to the host

```bash
cat ~/.dema/memory/node*-self-witness.json
```

Copy the output. Paste into a message back to the host. They'll record on
Node0's registry that your Phase C is complete.

Until you send this back, your status on the host's machine remains
`ghost_accepted_pending_device_install`.

### 2. Explore the surfaces

```bash
node apps/cli/src/index.js status
node apps/cli/src/index.js state
node apps/cli/src/index.js receipts
node apps/cli/src/index.js node-registry
node apps/cli/src/index.js help
```

All of these are read-only. None of them connect to a network.

### 3. Send feedback

Anything that confuses you, surprises you, or that you'd push back on —
write to the host. Your honest reaction shapes what gets built next.

---

## Boundary discipline

Every surface you run on your device emits a canonical 16-key boundary
object. Almost all 16 keys are pinned `false`. The installer flips ONE
key when it writes your profile: `filesystem_write_performed`. Every
other key remains false:

```text
network_used                    : false   ← never reaches the internet
federation_invoked              : false   ← no cross-node connection
runtime_execution_performed     : false   ← no agents running
receipt_mint_performed          : false   ← no canonical receipt creation
chain_advance_performed         : false   ← no chain head movement
external_call_performed         : false   ← no API calls
model_loaded · model_invocation : false   ← no model load
public_network_used             : false   ← never reaches the internet
node_connection_performed       : false   ← no Node-to-Node connection
consent_collected               : false   ← installer is not itself a
                                            consent ceremony · your prior
                                            in-person typed consent is
                                            the binding record
```

If any of these are `true` after running a command and you don't
understand why, ask the host. The system is supposed to make the
boundary visible, not hidden.

---

## How to disengage

```bash
./scripts/install/install.sh --uninstall
# Type the exact phrase: REMOVE DEMA LOCAL DATA
```

That removes:
- Your Node-N profile
- Your self-witness
- Any local receipts you generated
- The entire `~/.dema/` directory

That does NOT remove:
- The Dema source code (delete that directory separately if you want)
- The Proof-Forge receipt on the host's machine (their local evidence;
  ask them to update their memory if you want it noted)

Your right to disengage is unconditional. The system that lets you out
is the system worth being in.

---

## Doctrine anchors

This handoff honors:

- **Node ordinal law** — you are Node-N by canon (registry-assigned · not guessed)
- **Seed-pattern invariant** — your Node-N already carries the full system DNA
- **ADR-005** exact-string consent — your typed consent at the host's terminal is the binding event
- **Daughter Test** — the host held this test before inviting you · you should hold it too

---

## A note on what comes next

Phase C bootstrap is preview-only. It writes your profile and self-witness;
it does NOT activate runtime, federation, or anything else. Future phases
(when canon authorizes them) may include:

- Local LLM routing on your hardware (read-only · model invocation gated by exact consent)
- Bounded local-file access (within a directory you explicitly declare)
- Receipt-shape-ready output (your contributions become POI-eligible per ADR-009)
- Federation with other nodes (only after Ring-2+ proves cross-node receipts hold)

None of these activate automatically. Each requires its own canon amendment
and your typed consent at that future moment.

---

**End of handoff document.**

May your node be a seed that does not dominate. أهلاً وسهلاً.
