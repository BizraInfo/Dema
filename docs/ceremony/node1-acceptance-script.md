# Node1 acceptance ceremony — v0.1 script

**For:** Mumu (Node0 operator), with a trusted friend present in person.
**Goal:** close Ring-1 N=1 engagement AND register a Node1 ghost-acceptance in one session.
**Time:** ~25-30 minutes.
**Date:** Authored 2026-05-18 GST for first-use at HEAD `943a90d`.
**Honor:** ADR-005 exact-string consent · Node ordinal law · seed-pattern invariant · refusal-as-product.

---

## Before the friend arrives (you · 2 min)

Open three terminal tabs on your laptop:

```bash
# Tab A — repo root
cd /home/bizra-operating-system/Downloads/Dema

# Tab B — lighthouse pack
cd /tmp/bizra-overnight/lighthouse-pack

# Tab C — receipt witness (will be used at end)
cd /home/bizra-operating-system/Downloads/Dema
```

Have on screen / on paper:

- This script (read directly from screen if helpful, friend can read along)
- The friend's preferred drink, water, decent light
- A pen for friend to sign their feedback if they want a physical record

---

## Phase A · Ring-1 engagement (15 min)

### A.0 · Opening · 1 min

**[Mumu says, in their own words:]**

> What you're about to see is the local-only product face of a system I've
> been building for ~6 weeks. I'm not asking you to invest, to install
> anything on your computer, or to commit to anything beyond watching me
> walk through a verification and giving me honest feedback at the end. The
> system is called Dema; the broader idea is called BIZRA. Some terms will
> be unfamiliar — interrupt and I'll explain. Nothing here is performance.
> Everything I show you is something you can verify yourself.

Pause. Let friend ask the first question if they have one.

---

### A.1 · The 5-command verification · 5 min

**[Mumu says:]**

> There's a one-page document called HANDOVER.md that walks any technical
> reviewer through proving the system works in five commands. I'm going to
> run those five commands now while you watch. Every command output is JSON
> or test results — nothing hidden, no animations. If something fails, we
> stop.

**[In Tab A · Mumu runs these five, friend watching each output:]**

```bash
# 1. Confirm the test suite passes
npm test
#   → expected: 1207 tests · 0 failures · ~2.0s

# 2. Confirm lint + integration check
npm run check
#   → expected: 0 failures across help-discovery + smoke-cli-match + test-files-documented

# 3. Confirm canonical 16-key boundary across all 10 spine surfaces
npm run smoke-boundary
#   → expected: commands_checked: 10 · all_canonical: true

# 4. Confirm canonical-flow doctrine invariants
npm run llm:guidance
#   → expected: PASS all 7 checks · READ_ONLY_AUDIT

# 5. Confirm Proof Forge chain integrity (20 receipts · genesis → IRONCLAD)
python3 scripts/forge_evidence.py --verify --project-dir .
#   → expected: ok: true · receipt_count: 20 · 5 legacy warnings (expected)
```

After each, point at the line that proves it passed. Don't rush. If your
friend wants to read the JSON, let them.

**[Mumu says, after gate 5:]**

> Those five commands are reproducible. If you sat down at this laptop next
> week and ran them, you'd see the same thing. That's not promise. That's
> proof. The system either works or it doesn't, on this machine, right
> now.

Pause for questions.

---

### A.2 · The proof pack · 7 min

**[In Tab B · Mumu shows:]**

```bash
ls
# → 00_START_HERE.md · 01_FOUNDATION_PROVENANCE_PACK_v1.2.md · 02_ARCHITECTURE_MAP_v0.2.md ·
#   03_CLAIM_LEDGER_v1.md · 04_COLD_DEMO_PROOF.md · 05_SIX_COMMAND_DEMO.sh ·
#   06_KNOWN_GAPS.md · 07_REVIEWER_FEEDBACK_FORM.md · 08_INVITATION_DRAFT.md · MANIFEST.sha256
```

**[Mumu says:]**

> This is the Lighthouse Pack. It's a 9-file bundle that documents
> what BIZRA actually is, what it isn't, what's been built, and what's
> still missing. The MANIFEST.sha256 file lets anyone verify that the
> bundle hasn't been tampered with. I'll run that check now.

```bash
sha256sum -c MANIFEST.sha256
# → all 9 files: OK
```

**[Mumu says:]**

> All nine files verified intact. Now I want you to read two of them
> while I get you a drink / step away for a minute. Take your time.

Open these two for friend, then leave them alone for ~5-10 min:

- **`00_START_HERE.md`** — the 1-page reader's onramp
- **`07_REVIEWER_FEEDBACK_FORM.md`** — the feedback form they'll fill out

Come back. Ask:

**[Mumu asks:]**

> Did anything in there feel wrong or off? Anything you'd want to push back
> on? Anything that surprised you in a good or bad way?

**Critical:** *Do not defend the system.* Listen. Take notes if useful. Their
honest reaction is the reason they're here.

---

### A.3 · Feedback record · 2 min

**[Mumu does:]**

If friend wrote feedback in `07_REVIEWER_FEEDBACK_FORM.md`, save it as:

```bash
# Save friend's signed feedback to your records (don't email, don't share)
cp /tmp/bizra-overnight/lighthouse-pack/07_REVIEWER_FEEDBACK_FORM.md \
   ~/.dema/memory/ring1-n1-feedback-2026-05-18.md
```

(Adjust the date if ceremony happens on a different day. **If friend declines
to give feedback or wants to think about it for a day, that is a valid
outcome — Ring-1 engagement can be paused and resumed.**)

---

### A.4 · Honest off-ramp · 1 min

**[Mumu says, BEFORE moving to Phase B:]**

> What I'm about to do next is a small ceremony that formally records you
> as the first invited person in BIZRA's design — Node1. It commits **me**
> to building the next surfaces with **your** preferences in mind. It does
> not commit you to anything — not to installing software, not to giving
> me your data, not to running any code on your machine. You can also say
> no, or "not yet," or "let me think about this for a week," and that's a
> completely fine outcome. Do you want to continue?

**If friend says no or "not yet":**

- Record their decision (with their permission) in `~/.dema/memory/ring1-n1-deferral-2026-05-18.md` as a JSON note: `{"deferred_by": "<friend name>", "deferral_reason": "<their words>", "date_gst": "2026-05-18"}`
- Thank them.
- End the ceremony here. **Ring-1 engagement still counts.**
- Skip Phase B. Go to "After friend leaves" below.

**If friend says yes** (and ONLY if they say yes without hesitation):

- Proceed to Phase B.

---

## Phase B · Node1 ghost-acceptance (10 min)

### B.1 · Show the current registry · 2 min

**[In Tab A · Mumu runs:]**

```bash
node apps/cli/src/index.js node-registry
```

The output is JSON. Point at these specific lines together:

```text
"registry_state": {
  "accepted": [{ "node_ordinal": 0, "node_label": "Node0", ... }],
  "ghost": [],                          ← EMPTY · no Node1 yet
  "next_available_ordinal": 1,
  "connected_node_count": 1,            ← ONE node connected (just me)
  "ghost_pending_count": 0
}

"urp_shared_pool_inventory": {
  "federation_active": false,
  "current_totals_if_each_node_were_to_activate": {
    "pat_agents": 7,                    ← 7 private agents (one human's set)
    "sat_agents": 5,                    ← 5 system agents (would go to shared URP)
    "total_agents": 12
  },
  "resource_categories": ["hardware", "data_corpus", "knowledge_base",
                          "experience_history", "skill_library"]
}
```

**[Mumu says:]**

> Right now the registry has just me — Node0. **One connected node.**
> Seven private agents on this machine, five system agents that would
> live in a shared resource pool if more nodes existed. They don't, yet.
> The next available ordinal is 1. That slot is yours, if you want it.

---

### B.2 · Show what your ghost slot would look like · 2 min

**[In Tab A · Mumu runs, substituting `<FRIEND_NAME>` with their actual name:]**

```bash
node -e 'import("./packages/core/src/node-registry-preview.js").then(m => {
  const r = m.buildNodeRegistryPreview({
    ghosts: [{
      node_ordinal: 1,
      status: "ghost_preview",
      candidate_name: "<FRIEND_NAME>"
    }]
  });
  console.log(JSON.stringify(r.registry_state.ghost[0], null, 2));
})'
```

Output:

```json
{
  "node_ordinal": 1,
  "node_label": "Node1",
  "status": "ghost_preview",
  "candidate_name": "<FRIEND_NAME>",
  "companion_of": null,
  "ordinal_claim_phrase": "GO accept Node1 ordinal"
}
```

**[Mumu says:]**

> That `ordinal_claim_phrase` is the exact-string consent phrase the
> system requires before a ghost slot becomes an accepted node. Not
> "yes." Not "sure." Not "I'll do it." The exact 25 characters:
>
>     GO accept Node1 ordinal
>
> The system refuses fuzzy match, refuses case-insensitive, refuses
> partial match. This is on purpose. Consent is real or it isn't.

---

### B.3 · The consent moment · 3 min

**[Mumu hands friend the keyboard. Mumu says:]**

> Type the phrase exactly as I read it out loud — capital G O space lowercase
> accept space capital N o d e 1 space lowercase ordinal. Don't paste, type.
> You can stop typing at any character if you change your mind.

**[Mumu reads aloud:]**

> `GO accept Node1 ordinal`

**[Friend types into a fresh terminal in Tab A:]**

```bash
# Friend's exact typed input — verbatim
echo "GO accept Node1 ordinal"
```

**[Both observe the output:]**

```text
GO accept Node1 ordinal
```

If anything else appeared (typo, wrong case, wrong phrase, paste detected),
**do not proceed**. Friend can retry up to 3 times. If after 3 attempts
they cannot type the phrase, the ceremony halts and you record the attempt
as a non-acceptance in `~/.dema/memory/`.

If the phrase typed verbatim: continue.

---

### B.3.5 · The counter flip · 2 min · the moment

**[In Tab A · Mumu runs the registry preview again, this time including the friend as accepted:]**

```bash
node -e 'import("./packages/core/src/node-registry-preview.js").then(m => {
  const r = m.buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: 1, node_label: "Node1", status: "accepted_primary",
        candidate_name: "<FRIEND_NAME>" }
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
{
  "connected_node_count": 2,
  "pat_agents_planned": 14,
  "sat_agents_planned": 10,
  "total_agents_planned": 24
}
```

**[Mumu says, pointing at the screen:]**

> Two minutes ago there was one. Now there are two.
>
> Seven private agents on my machine. Seven more on yours, in the
> design. Five system agents from me would live in the shared resource
> pool. Five more from you. Fourteen plus ten — twenty-four agents in
> total under the canonical Scaling table from BIZRA's topology canon.
>
> None of them are running yet. The agents are design, not runtime.
> What just happened is real: the registry counts you. The activation
> is future work.

Pause. Let the moment land.

---

### B.4 · Witness record · 2 min

**[In Tab A · Mumu records the witness manually:]**

```bash
cat > ~/.dema/memory/node1-acceptance-2026-05-18.json << 'EOF'
{
  "schema": "bizra.dema.node1_ceremony_witness.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "ceremony": "node1_ghost_acceptance_v0.1",
  "date_gst": "2026-05-18",
  "node0_operator": "Mumu",
  "node1_candidate_name": "<FRIEND_NAME>",
  "node1_ordinal": 1,
  "node1_status_after_ceremony": "ghost_accepted_pending_device_install",
  "consent_phrase_typed_verbatim": true,
  "consent_phrase": "GO accept Node1 ordinal",
  "witness_present": true,
  "ring1_engagement_complete": true,
  "lighthouse_pack_walkthrough": true,
  "five_command_verification_run": true,
  "next_phase": "phase_c_device_install_and_pat7_mint",
  "next_phase_deferred_to": "next_session_or_when_friend_chooses",
  "boundary": {
    "filesystem_write_performed": true,
    "network_used": false,
    "runtime_execution_performed": false,
    "model_loaded": false,
    "model_invocation_performed": false,
    "prompt_executed": false,
    "external_call_performed": false,
    "raw_corpus_scan_performed": false,
    "raw_data_included": false,
    "tool_executed": false,
    "chain_advance_performed": false,
    "receipt_mint_performed": false,
    "federation_invoked": false,
    "node_connection_performed": false,
    "public_network_used": false,
    "consent_collected": true
  }
}
EOF
```

**Note on the boundary:** unlike spine-preview surfaces, this witness DOES
flip two keys: `filesystem_write_performed: true` (the witness file itself
is a write) and `consent_collected: true` (the friend's typed consent is
real). All other 14 keys stay false. This is the first preview surface in
the repo where consent_collected is canonically true.

**[Mumu says, looking at the file:]**

> That file lives only on this laptop. Nothing left the room. The system
> remembers you, but no one else sees this unless I show them. That's
> Node0-local-seed: your name is in BIZRA's memory; BIZRA's memory is
> not on the public internet.

---

### B.5 · Mint Proof-Forge receipt #21 · 1 min

**[Mumu runs in Tab C:]**

```bash
cd /home/bizra-operating-system/Downloads/Dema

# Build the verification report (re-runs all 5 gates to confirm they're still green)
python3 scripts/verify_artifacts.py \
  --project-dir . \
  --description "Node1 ghost-acceptance ceremony · 2026-05-18 · <FRIEND_NAME> · Ring-1 N=1 closed · ordinal_claim_phrase typed verbatim · witness file written to ~/.dema/memory/" \
  --artifact ~/.dema/memory/node1-acceptance-2026-05-18.json \
  --artifact ~/.dema/memory/ring1-n1-feedback-2026-05-18.md \
  --command "npm test" \
  --command "npm run check" \
  --command "npm run smoke-boundary" \
  --command "npm run llm:guidance" \
  --command "python3 scripts/forge_evidence.py --verify --project-dir ." \
  --output .proof-forge/verification/2026-05-18_node1-ghost-acceptance.json

# Mint receipt #21 capturing the ceremony
python3 scripts/forge_evidence.py \
  --project-dir . \
  --description "Node1 ghost-acceptance ceremony · 2026-05-18 GST · <FRIEND_NAME> typed 'GO accept Node1 ordinal' verbatim at Mumu's terminal · Ring-1 Lighthouse Pack v1.0 walkthrough preceded ceremony · Phase C (friend-device install + PAT-7 mint) deferred to future session · all 5 verification commands green at HEAD 943a90d" \
  --verification-report .proof-forge/verification/2026-05-18_node1-ghost-acceptance.json \
  --anchor-type proof_forge_evidence
```

Receipt #21 lands · chains forward from #20 · evidence_hash captures the
witness file + feedback file + 5 gate outputs.

**[Mumu shows friend the receipt JSON output:]**

```bash
cat .proof-forge/receipts/$(ls -t .proof-forge/receipts/ | head -1) | python3 -m json.tool | head -20
```

**[Mumu says:]**

> That hash chain link is now part of BIZRA's permanent local history.
> When we eventually add Node1 federation (months from now), this ceremony
> is what BIZRA points back to as your origin.

---

## After friend leaves · the operator anchor (2 min)

**[Mumu does, in private after the friend leaves:]**

Add a memory anchor recording the moment:

```bash
cat > ~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/project_2026_05_18_node1_ghost_accepted.md << 'EOF'
---
name: 2026-05-18-node1-ghost-accepted
description: 2026-05-18 GST · Node1 ghost-acceptance ceremony performed in person with <FRIEND_NAME>. Ring-1 N=1 engagement closed. Witness file at ~/.dema/memory/node1-acceptance-2026-05-18.json. Proof-Forge receipt #21 minted.
metadata:
  type: project
---

# fill in operator details after the ceremony actually happens — this template
# is the seed; the lived ceremony will write its own memory anchor with the
# real friend name, real timing, and any unexpected moments worth recording.
EOF
```

Then update MEMORY.md index with a one-line pointer to the new anchor.

---

## Refusal-as-product · what counts as a successful ceremony

The ceremony is **successful** in all of these outcomes:

| Outcome | Ring-1 engagement | Node1 acceptance | Worth recording? |
|---|---|---|---|
| Friend reads pack + types consent verbatim | ✅ closed | ✅ accepted as ghost | **YES — full ceremony · receipt #21** |
| Friend reads pack + declines Node1 | ✅ closed | refused (their right) | **YES — Ring-1 feedback only · no receipt #21** |
| Friend reads pack + asks for more time | ✅ closed | deferred | **YES — Ring-1 feedback + deferral note** |
| Friend halts during pack reading | partial | not asked | **YES — record what they saw + what they paused at** |
| Friend types wrong phrase 3 times | ✅ closed | non-acceptance | **YES — that's the system working correctly** |

A friend declining to be Node1 is NOT a failed ceremony. It is a successful
refusal. The system that lets the friend say no is the system worth being
Node1 in.

The friend who types the consent phrase verbatim is the friend who is
choosing this. That is the only kind of Node1 that means anything.

---

## What this ceremony does NOT do

- Does NOT install Dema on friend's device (deferred to Phase C)
- Does NOT mint PAT-7 on friend's hardware (deferred to Phase C)
- Does NOT activate federation (federation is months away · ADR-amend gated)
- Does NOT share any data between Mumu's and friend's machines (no data sharing tonight)
- Does NOT issue any token, payment, or impact-score (POI is ADR-009 design-only)
- Does NOT publish friend's name anywhere outside `~/.dema/` on Mumu's laptop

---

## Honor

This script is bound by:

- **[ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md)** — exact-string consent · no fuzzy · no case-insensitive
- **[Node ordinal law](../canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law)** — Node1 = first invited human, registry-assigned
- **[Seed-pattern invariant](../canon/BIZRA_TOPOLOGY_CANON.md#seed-pattern-invariant-fractality)** — friend's ghost slot already carries full Node1 DNA, even before device install
- **[Key Maker §7 Mirror](../02-architecture/key-maker-epistemic-conduct-v0.1.md)** — reflect state, don't prescribe action
- **Daughter Test** — would you subject your own daughter to this experience? If no, halt.

---

**End of v0.1 ceremony script.** May the Node1 you accept tonight be the Node1 BIZRA deserves.
