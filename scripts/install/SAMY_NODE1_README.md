# Welcome, Samy · You are Node1 · Phase C on-device handoff

**Paired with:** Mumu's Node0 acceptance ceremony 2026-05-18 12:25 GST
**Paired Proof-Forge receipt:** `2026-05-18_082658` (position 21 · IRONCLAD)
**Evidence hash you can verify:** `8ac3d72699be44df51e79733a944036ab296b5698884ab3a47cf77eb64ad323c`

This document is the on-device companion to the in-person ceremony at Mumu's
home where you typed `GO accept Node1 ordinal` and became BIZRA's first
invited human-node. This handoff lets you confirm that acceptance on your
own machine.

---

## What this handoff is and isn't

**It IS:**

- A local-only setup on your own device
- Preview-only — no network calls, no federation, no data leaves your machine
- A way to verify on your hardware what you witnessed on Mumu's hardware
- Reversible — delete `~/.dema/` at any time and Phase C uninstalls itself
- A bridge between your in-person acceptance and any future activation

**It IS NOT:**

- A runtime activation (the BIZRA runtime lives upstream of this repository)
- A network handshake to Mumu's machine (nothing connects to Mumu's laptop)
- A token, payment, or economic claim of any kind
- An automatic installation (you walk through each step manually)
- A binding requirement — you can stop at any step

---

## What you need

- A laptop or desktop with **Node.js v20 or later** installed
  - Check: `node -v` should print `v20.x.x` or higher
  - Install if needed: <https://nodejs.org/>
- The Dema source code (delivered by Mumu via USB, tarball, or git clone when push to origin unblocks)
- About **10 minutes** of attention

---

## The 4-step Phase C bootstrap

### Step 1 · Verify the source you received

Open a terminal. Navigate to the Dema directory you received from Mumu.
Verify the contents are what they should be:

```bash
ls -la
# Should show: apps/  packages/  scripts/  tests/  docs/  package.json  README.md ...

# Optional: verify integrity if Mumu gave you a manifest checksum
cd scripts/install
ls samy-bootstrap.sh
# → should be executable
```

### Step 2 · Walk the same 5-command verification Mumu showed you

These are the same five gates you watched at Mumu's home. Now run them on
your own hardware — same outputs, same proof, your machine, your verification:

```bash
# Back to repo root
cd ..

# 1. All tests pass
npm test
#   → expected: 1218 tests · 0 failures · ~2.0s

# 2. Integration check
npm run check
#   → expected: PASS

# 3. All 10 spine surfaces emit canonical boundary
npm run smoke-boundary
#   → expected: commands_checked: 10 · all_canonical: true

# 4. Doctrine invariants
npm run llm:guidance
#   → expected: PASS all 7 checks · READ_ONLY_AUDIT

# 5. Receipt chain integrity (21 receipts including yours · #21)
python3 scripts/forge_evidence.py --verify --project-dir .
#   → expected: ok: true · receipt_count: 21
```

If any of these fail, **stop and contact Mumu**. Something is off.
If all five return as expected, the system on your hardware is identical
to the system you witnessed on Mumu's.

### Step 3 · Inspect the registry — see your own name in it

Before bootstrapping, look at the registry on your machine. It should show
Node0 as the default (because the default builder assumes Node0 unless
overridden):

```bash
node apps/cli/src/index.js node-registry
```

Now run the registry preview WITH yourself included — this is the same
"counter flip" moment Mumu showed you on his laptop, but now on yours:

```bash
node -e 'import("./packages/core/src/node-registry-preview.js").then(m => {
  const r = m.buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: 1, node_label: "Node1", status: "accepted_primary", candidate_name: "Samy" }
    ]
  });
  console.log(JSON.stringify({
    connected_node_count: r.registry_state.connected_node_count,
    pat_agents_planned:  r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate.pat_agents,
    sat_agents_planned:  r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate.sat_agents,
    total_agents_planned: r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate.total_agents
  }, null, 2));
})'
```

Output:

```json
{ "connected_node_count": 2, "pat_agents_planned": 14, "sat_agents_planned": 10, "total_agents_planned": 24 }
```

**This is the same output Mumu saw.** The math is canonical — 2 humans, 14
private agents in design (7 each), 10 system agents in design (5 each into
the shared resource pool that doesn't exist yet).

### Step 4 · Run the Samy bootstrap

This step writes a Node1 profile to your local `~/.dema/` directory. It is
preview-only — no network, no federation, no runtime activation:

```bash
# First, check what it would do (no writes):
./scripts/install/samy-bootstrap.sh --dry-run

# Then, if the dry-run output looks right, run for real:
./scripts/install/samy-bootstrap.sh
```

This creates:

- `~/.dema/profile.json` — your Node1 profile (name, ordinal, paired receipt #21)
- `~/.dema/memory/node1-self-witness.json` — your on-device witness
- `~/.dema/memory/`, `~/.dema/receipts/` — empty dirs for your future use

The bootstrap **does NOT** overwrite an existing `~/.dema/profile.json` if
one is there. If you already have a `~/.dema/` from elsewhere, the script
will tell you and stop.

---

## After bootstrap · what to do next

### 1. Send your witness back to Mumu

```bash
cat ~/.dema/memory/node1-self-witness.json
```

Copy the output. Paste it into a message back to Mumu (WhatsApp, email,
Signal — any channel you both use). Mumu will record on Node0's registry
that your Phase C is complete.

Until you send this back, your Node1 status on Mumu's machine remains
`ghost_accepted_pending_device_install`. Sending the witness flips it to
`phase_c_complete`.

### 2. Explore the surfaces

You can run any of the 10 spine commands on your device:

```bash
node apps/cli/src/index.js status
node apps/cli/src/index.js state
node apps/cli/src/index.js receipts
node apps/cli/src/index.js help
```

All of these are read-only. None of them connect to a network.

### 3. Send feedback

Anything that confuses you, surprises you, or that you'd push back on —
write to Mumu. Your honest reaction shapes what gets built next.

---

## The boundary discipline

Every surface you run on your device emits a canonical 16-key boundary
object. All 16 keys are pinned `false` for read-only surfaces. The
bootstrap script flips ONE key from false to true: `filesystem_write_performed`
(because writing your profile is itself a filesystem write). Every other
key remains false:

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
consent_collected               : false   ← bootstrap is not itself a
                                            consent ceremony · your prior
                                            in-person typed consent is
                                            the binding record
```

If any of these are `true` after running a command and you don't
understand why, ask Mumu. The system is supposed to make the boundary
visible, not hidden.

---

## How to disengage

At any point, if you want out:

```bash
# Remove the entire Dema local state from your device:
rm -rf ~/.dema/
```

That removes:
- Your Node1 profile
- Your self-witness
- Any local receipts you generate

That does NOT remove:
- The Dema source code in the directory Mumu gave you (delete that separately if you want: `rm -rf /path/to/dema/`)
- The receipt #21 on Mumu's machine (that's Mumu's local evidence; he can keep, delete, or note your departure as he chooses)
- Any memory Mumu has of the ceremony (that's not on disk and not removable by you · ask Mumu to update his memory anchors if you want them removed)

Your right to disengage is unconditional. The system that lets you out is
the system worth being in.

---

## Doctrine anchors

This handoff honors:

- **Node ordinal law** — you are Node1 by canon · not "Mumu's second device"
- **Seed-pattern invariant** — your Node1 already carries the full system DNA
- **ADR-005** exact-string consent — your typed consent at Mumu's terminal is the binding event
- **Daughter Test** — would Mumu subject his own daughter to this? If no, halt.

---

## Honor

You are the first invited human in BIZRA's local history. The ceremony
that recorded you was not theater. The receipt chain that names you is
not promotional. Whatever comes next is shaped by whether systems like
this can be trusted by people like you.

Thank you for being Node1.

— Mumu

---

**End of handoff document.**
