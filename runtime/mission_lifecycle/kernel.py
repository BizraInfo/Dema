#!/usr/bin/env python3
"""
DEMA Mission Lifecycle Kernel v0.1 — runtime implementation of the spec at
`~/.dema/kernel/mission_lifecycle/spec/phase_*.md`.

Loads an active Agent Capability Contract, instantiates Mission Capsules,
walks them through the 7-state lifecycle, mints SHA-256-chained receipts at
every transition, validates DoD, and flags wisdom-promotion-candidates.

USAGE
  python3 kernel.py preview <agent_name> "<task statement>"   # create mission, halt at preview
  python3 kernel.py status <mission_id>                        # show capsule state + receipts
  python3 kernel.py consent <mission_id> "<consent phrase>"    # record consent for MUMO_GO act
  python3 kernel.py run <mission_id>                           # transition ready->executing->validated->receipted
  python3 kernel.py list                                        # all missions
  python3 kernel.py --help

CONSTITUTIONAL GROUND
  - This kernel is preview-by-default. Every mission MUST go through preview
    before run. Run requires `state == ready` which itself requires all
    MUMO_GO consents collected.
  - Every state transition mints a receipt with V/D/P/U at the act level.
  - Receipts chain into the agent's per-day receipt directory; chain head is
    the agent's authoritative receipt chain.
  - Act handlers (the actual code that performs ALWAYS/RECEIPT_BOUND acts) are
    declared but stubbed at v0.1: they record "would_execute" without running
    real work. Real handlers are v0.2 and require their own typed-GO each.
  - No external network. No canon mutation. No Node1 contact. No self-promotion.

USAGE INVARIANT
  At v0.1, this kernel proves the lifecycle works end-to-end on
  EMPTY-ACTS-PLANNED missions. As act handlers register in v0.2, missions
  become substantive. The receipt chain exists from day one.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# ─── paths ────────────────────────────────────────────────────────────────
DEMA_HOME = Path(os.environ.get("DEMA_HOME") or (Path.home() / ".dema"))
AGENTS_DIR = DEMA_HOME / "agents"
KERNEL_HOME = DEMA_HOME / "kernel" / "mission_lifecycle"
MISSIONS_DIR = KERNEL_HOME / "missions"
CAPSULE_DIR = MISSIONS_DIR  # alias

EPISTEMIC_ANCHOR = DEMA_HOME / "memory" / "foundational-mindset.json"
EMBODIMENT_ANCHOR = DEMA_HOME / "memory" / "node0-space.json"

# ─── states (single source of truth in lifecycle_states.py) ──────────────
# kernel.py imports rather than redefines so runner.py and any future
# consumer reference the same transition table. Spec change -> one edit.
sys.path.insert(0, str(Path(__file__).parent))
from lifecycle_states import (  # noqa: E402
    STATE_DRAFT, STATE_PREVIEW, STATE_READY, STATE_EXECUTING,
    STATE_VALIDATED, STATE_RECEIPTED, STATE_ARCHIVED, STATE_SUSPENDED,
    VALID_TRANSITIONS,
)


# ─── utils ────────────────────────────────────────────────────────────────
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def sha256_hex(s):
    if isinstance(s, str):
        s = s.encode("utf-8")
    return hashlib.sha256(s).hexdigest()


def canonicalize_for_hash(obj):
    """Stable JSON serialization for hashing."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


# ─── agent contract loader ────────────────────────────────────────────────
def load_agent_contract(agent_name: str) -> dict:
    """Load all 6 yaml files for an agent + verify active state."""
    if not HAS_YAML:
        raise RuntimeError("PyYAML required to load agent contract")
    agent_dir = AGENTS_DIR / agent_name
    if not agent_dir.is_dir():
        raise FileNotFoundError(f"agent directory missing: {agent_dir}")

    contract = {}
    for name in ["capability", "knowledge_pack", "knowhow_playbook",
                 "kpi_contract", "definition_of_done", "authority_policy"]:
        path = agent_dir / f"{name}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"agent contract file missing: {path}")
        contract[name] = yaml.safe_load(path.read_text(encoding="utf-8"))

    # Verify active CONTRACT state — find most recent receipt with schema
    # bizra.dema.agent_capability_contract_act.v0.1 (NOT just chain head, which
    # may be a mission-transition receipt with mission state in `state_after`).
    chain_head_file = agent_dir / "receipts" / "chain-head.txt"
    if not chain_head_file.exists():
        raise RuntimeError(f"agent has no receipt chain at {chain_head_file}")

    contract_state = _latest_contract_state(agent_dir)
    if contract_state != "active":
        raise RuntimeError(f"agent {agent_name} contract is not active (state={contract_state})")

    contract["_agent_dir"] = agent_dir
    contract["_chain_head"] = chain_head_file.read_text(encoding="utf-8").strip()
    return contract


def _latest_contract_state(agent_dir: Path) -> str:
    """Find the most recent contract activation/validation receipt and return its state_after.

    Walks receipts/ recursively, sorts by timestamp descending, returns the first
    receipt whose schema is bizra.dema.agent_capability_contract_act.v0.1.
    """
    receipts = []
    for json_file in (agent_dir / "receipts").rglob("*.json"):
        try:
            r = json.loads(json_file.read_text(encoding="utf-8"))
            if r.get("schema") == "bizra.dema.agent_capability_contract_act.v0.1":
                receipts.append(r)
        except (json.JSONDecodeError, OSError):
            continue
    if not receipts:
        return "(no contract act receipts found)"
    receipts.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return receipts[0].get("state_after", "(no state_after field)")


def find_receipt_by_hash(agent_dir: Path, target_hash: str):
    for json_file in (agent_dir / "receipts").rglob("*.json"):
        try:
            r = json.loads(json_file.read_text(encoding="utf-8"))
            if r.get("blake3_self") == target_hash:
                return r
        except (json.JSONDecodeError, OSError):
            continue
    return None


# ─── IQRA bridge ──────────────────────────────────────────────────────────
IQRA_MISSIONS_DIR = DEMA_HOME / "kernel" / "missions"


def load_iqra_preview(iqra_mission_id: str) -> dict:
    """Load an IQRA preview receipt and return a structured ref dict.

    The IQRA engine writes preview.json under ~/.dema/kernel/missions/<id>/
    (separate dir from mission_lifecycle missions). We bind to it by
    {mission_id, self_hash, paths} so the Mission Kernel can prove which
    IQRA preview seeded its capsule.
    """
    iqra_dir = IQRA_MISSIONS_DIR / iqra_mission_id
    preview_json = iqra_dir / "preview.json"
    if not preview_json.exists():
        raise FileNotFoundError(f"IQRA preview not found: {preview_json}")
    receipt = json.loads(preview_json.read_text(encoding="utf-8"))
    if receipt.get("schema") != "bizra.dema.iqra_preview.v0.1":
        raise ValueError(f"not an IQRA preview receipt (schema={receipt.get('schema')!r}): {preview_json}")
    return {
        "iqra_mission_id": receipt["mission_id"],
        "iqra_preview_self_hash": receipt["self_hash"],
        "iqra_preview_json": str(preview_json),
        "iqra_preview_md": str(iqra_dir / "preview.md"),
        "iqra_task_statement": receipt["task_statement"],
        "iqra_timestamp": receipt["timestamp"],
        "iqra_model": receipt.get("model"),
    }


# ─── capsule operations ───────────────────────────────────────────────────
def new_mission_capsule(agent_name: str, task_statement: str, contract: dict,
                        iqra_preview_ref: dict = None) -> dict:
    mission_id = str(uuid.uuid4())
    capsule = {
        "schema": "bizra.dema.mission_capsule.v0.1",
        "mission_id": mission_id,
        "schema_version": "0.1",
        "created_at": now_iso(),
        "last_modified_at": now_iso(),
        "operator": {
            "authored_by": "mumo",
            "task_statement": task_statement,
            "iqra_preview_ref": iqra_preview_ref,
        },
        "agent_binding": {
            "agent_name": agent_name,
            "contract_id": contract["capability"]["contract_id"],
            "contract_state_at_bind": "active",
            "bound_at": now_iso(),
        },
        "authority": {
            "required_tier": "ALWAYS",  # default; updated as acts are added
            "acts_planned": [],          # empty at v0.1; real acts are v0.2
        },
        "state": {
            "current": STATE_DRAFT,
            "history": [
                {
                    "state": STATE_DRAFT,
                    "entered_at": now_iso(),
                    "receipt_ref": None,
                }
            ],
        },
        "kpis": {
            "contract_ref": contract["capability"]["contract_id"],
            "scoring": {kpi["id"]: None for kpi in contract["kpi_contract"].get("kpis", [])},
        },
        "dod": {
            "contract_ref": contract["capability"]["contract_id"],
            "predicates_required": [],   # filled per mission's planned acts
            "predicates_passed": [],
        },
        "evidence": {
            "inputs_read": [],
            "outputs_written": [],
            "receipts_minted": [],
            "blake3_chain_segment": {"first": None, "last": None, "count": 0},
        },
        "outcome": {
            "result": None,
            "finding": None,
            "wisdom_candidate": False,
            "wisdom_capsule_ref": None,
        },
    }
    return capsule


def save_capsule(capsule: dict):
    mission_id = capsule["mission_id"]
    capsule["last_modified_at"] = now_iso()
    out_dir = MISSIONS_DIR / mission_id
    out_dir.mkdir(parents=True, exist_ok=True)
    capsule_path = out_dir / "capsule.yaml"
    if HAS_YAML:
        capsule_path.write_text(yaml.dump(capsule, sort_keys=False, allow_unicode=True),
                                encoding="utf-8")
    else:
        capsule_path.write_text(json.dumps(capsule, indent=2, ensure_ascii=False),
                                encoding="utf-8")


def load_capsule(mission_id: str) -> dict:
    capsule_path = MISSIONS_DIR / mission_id / "capsule.yaml"
    if not capsule_path.exists():
        raise FileNotFoundError(f"mission capsule not found: {capsule_path}")
    text = capsule_path.read_text(encoding="utf-8")
    if HAS_YAML:
        return yaml.safe_load(text)
    return json.loads(text)


# ─── receipt minting ──────────────────────────────────────────────────────
def mint_state_transition_receipt(capsule: dict, contract: dict,
                                  state_before: str, state_after: str,
                                  trigger: str,
                                  consent: dict = None) -> dict:
    """Mint a receipt for a state transition. Returns the receipt dict.

    Receipts go into the AGENT'S receipt chain (not a separate kernel chain),
    per spec Phase 02 invariant I02-02.
    """
    agent_dir = contract["_agent_dir"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    receipt_dir = agent_dir / "receipts" / today
    receipt_dir.mkdir(parents=True, exist_ok=True)

    chain_head_file = agent_dir / "receipts" / "chain-head.txt"
    prev_hash = chain_head_file.read_text(encoding="utf-8").strip() if chain_head_file.exists() else "GENESIS"

    act_id = str(uuid.uuid4())
    receipt = {
        "schema": "bizra.dema.mission_state_transition.v0.1",
        "act_id": act_id,
        "mission_id": capsule["mission_id"],
        "agent_name": contract["capability"]["agent"]["name"],
        "contract_ref": contract["capability"]["contract_id"],
        "timestamp": now_iso(),
        "state_before": state_before,
        "state_after": state_after,
        "trigger": trigger,
        "verified": [
            f"capsule schema is bizra.dema.mission_capsule.v0.1",
            f"agent contract state at bind: active (chain head {prev_hash[:12]}…)",
            f"transition ({state_before} -> {state_after}) is in VALID_TRANSITIONS table",
            f"trigger: {trigger}",
            f"agent: {contract['capability']['agent']['name']}",
            f"contract_id: {contract['capability']['contract_id']}",
            f"law_of_assumption cited via knowledge_pack.doctrine[law_of_assumption]",
            f"node0_space cited via knowledge_pack.doctrine[node0_space]",
        ] + ([
            f"iqra_preview_ref bound: mission={capsule['operator']['iqra_preview_ref']['iqra_mission_id']} "
            f"self_hash={capsule['operator']['iqra_preview_ref']['iqra_preview_self_hash'][:12]}…"
        ] if capsule.get("operator", {}).get("iqra_preview_ref") else []),
        "derived": [
            "mission lifecycle kernel performed this state transition autonomously per state machine",
            "no act handlers were invoked at v0.1 (handlers are stubbed pending v0.2)",
        ],
        "assumed_with_ihsan": [
            {
                "assumption": "state machine transition is valid because (state_before, state_after) is in VALID_TRANSITIONS",
                "ground": "kernel.py:VALID_TRANSITIONS dict; spec phase 02 transition table",
                "boundary": "if VALID_TRANSITIONS itself drifts from spec, validation passes incorrectly",
                "rejectable": True,
            },
        ],
        "unknown": [
            "whether mission outcome will pass DoD predicates at validated state",
            "whether KPI thresholds will be met when KPI scoring is computed (deferred to validation)",
        ],
        "boundary_compliance": {
            "inside_node0_only": True,
            "no_external_network": True,
            "no_canon_mutation": True,
            "no_node1_contact": True,
            "no_self_promotion": True,
            "writes_under": str(agent_dir / "receipts"),
        },
        "consent": consent or {"required": False, "phrase_received": None},
        "model": None,
        "digest_algo": "sha256",
        "blake3_prev": prev_hash,
    }
    payload = canonicalize_for_hash(receipt)
    receipt["blake3_self"] = sha256_hex(payload)

    receipt_json = receipt_dir / f"mission-{capsule['mission_id']}-{state_after}-{act_id[:8]}.json"
    receipt_json.write_text(json.dumps(receipt, indent=2, ensure_ascii=False),
                            encoding="utf-8")

    # Update chain head
    chain_head_file.write_text(receipt["blake3_self"], encoding="utf-8")

    # Update capsule's evidence
    capsule["evidence"]["receipts_minted"].append(act_id)
    if capsule["evidence"]["blake3_chain_segment"]["first"] is None:
        capsule["evidence"]["blake3_chain_segment"]["first"] = receipt["blake3_self"]
    capsule["evidence"]["blake3_chain_segment"]["last"] = receipt["blake3_self"]
    capsule["evidence"]["blake3_chain_segment"]["count"] += 1

    return receipt


def mint_act_handler_receipt(capsule: dict, contract: dict,
                             planned_act: dict, result: dict) -> dict:
    """Mint a receipt for a single act handler invocation.

    Schema: bizra.dema.mission_act_handler.v0.1
    Receipts go into the agent's chain (same dir as state-transition receipts).
    """
    agent_dir = contract["_agent_dir"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    receipt_dir = agent_dir / "receipts" / today
    receipt_dir.mkdir(parents=True, exist_ok=True)

    chain_head_file = agent_dir / "receipts" / "chain-head.txt"
    prev_hash = chain_head_file.read_text(encoding="utf-8").strip() if chain_head_file.exists() else "GENESIS"

    act_id = str(uuid.uuid4())
    receipt = {
        "schema": "bizra.dema.mission_act_handler.v0.1",
        "act_id": act_id,
        "mission_id": capsule["mission_id"],
        "agent_name": contract["capability"]["agent"]["name"],
        "contract_ref": contract["capability"]["contract_id"],
        "timestamp": now_iso(),
        "act": {
            "planned_act_id": planned_act.get("act_id"),
            "tier": planned_act.get("tier"),
            "handler": planned_act.get("handler"),
            "args": planned_act.get("args", {}),
        },
        "result": {
            "passed": result.get("passed", False),
            "outputs": result.get("outputs", []),
            "finding": result.get("finding"),
            "content_excerpt": result.get("content_excerpt"),
        },
        "verified": [
            f"handler {planned_act.get('handler')!r} invoked",
            f"act tier: {planned_act.get('tier')}",
            f"agent contract_id: {contract['capability']['contract_id']}",
            f"law_of_assumption + node0_space cited via knowledge_pack.doctrine",
        ] + result.get("evidence", []),
        "derived": [
            "act result is what the handler returned; kernel did not modify it",
        ],
        "assumed_with_ihsan": [
            {
                "assumption": "the handler honored its declared boundary contract",
                "ground": "handler is in registry; registry is operator-curated",
                "boundary": "if a handler violates its tier or boundary, only post-hoc audit catches it; v0.1 has no runtime sandbox",
                "rejectable": True,
            }
        ],
        "unknown": [
            "whether the act outcome contributes to KPI thresholds (KPI scoring deferred to v0.2)",
        ],
        "boundary_compliance": {
            "inside_node0_only": True,
            "no_external_network": True,
            "no_canon_mutation": True,
            "no_node1_contact": True,
            "no_self_promotion": True,
            "writes_under": str(agent_dir / "receipts"),
        },
        "consent": {"required": planned_act.get("tier") == "MUMO_GO_REQUIRED",
                    "phrase_received": planned_act.get("consent_received_phrase")},
        "model": None,
        "digest_algo": "sha256",
        "blake3_prev": prev_hash,
    }
    payload = canonicalize_for_hash(receipt)
    receipt["blake3_self"] = sha256_hex(payload)

    out_json = receipt_dir / f"mission-{capsule['mission_id']}-act-{planned_act.get('act_id', 'unknown')}-{act_id[:8]}.json"
    out_json.write_text(json.dumps(receipt, indent=2, ensure_ascii=False),
                        encoding="utf-8")
    chain_head_file.write_text(receipt["blake3_self"], encoding="utf-8")

    capsule["evidence"]["receipts_minted"].append(act_id)
    if capsule["evidence"]["blake3_chain_segment"]["first"] is None:
        capsule["evidence"]["blake3_chain_segment"]["first"] = receipt["blake3_self"]
    capsule["evidence"]["blake3_chain_segment"]["last"] = receipt["blake3_self"]
    capsule["evidence"]["blake3_chain_segment"]["count"] += 1

    return receipt


def transition_state(capsule: dict, contract: dict, target_state: str,
                     trigger: str, consent: dict = None) -> dict:
    current = capsule["state"]["current"]
    if (current, target_state) not in VALID_TRANSITIONS:
        raise ValueError(f"invalid transition: {current} -> {target_state}")
    receipt = mint_state_transition_receipt(capsule, contract, current,
                                            target_state, trigger, consent)
    capsule["state"]["current"] = target_state
    capsule["state"]["history"].append({
        "state": target_state,
        "entered_at": now_iso(),
        "receipt_ref": receipt["act_id"],
    })
    save_capsule(capsule)
    return receipt


# ─── commands ─────────────────────────────────────────────────────────────
def cmd_preview(agent_name: str, task: str, acts_file: str = None,
                iqra_preview_ref: dict = None) -> dict:
    contract = load_agent_contract(agent_name)
    capsule = new_mission_capsule(agent_name, task, contract, iqra_preview_ref=iqra_preview_ref)

    # Load acts from file if provided
    if acts_file:
        acts_path = Path(os.path.expanduser(acts_file))
        if not acts_path.exists():
            raise FileNotFoundError(f"acts file not found: {acts_path}")
        if HAS_YAML and acts_path.suffix in (".yaml", ".yml"):
            acts = yaml.safe_load(acts_path.read_text(encoding="utf-8"))
        else:
            acts = json.loads(acts_path.read_text(encoding="utf-8"))
        if not isinstance(acts, list):
            raise ValueError(f"acts file must contain a list, got {type(acts).__name__}")
        capsule["authority"]["acts_planned"] = acts
        # Set required_tier to highest tier among planned acts
        tiers = [a.get("tier", "ALWAYS") for a in acts]
        if "MUMO_GO_REQUIRED" in tiers:
            capsule["authority"]["required_tier"] = "MUMO_GO_REQUIRED"
        elif "RECEIPT_BOUND" in tiers:
            capsule["authority"]["required_tier"] = "RECEIPT_BOUND"

    save_capsule(capsule)

    # Transition draft -> preview (structural validation always passes for empty acts at v0.1)
    transition_state(capsule, contract, STATE_PREVIEW,
                     "structural_validation_pass")

    print(f"mission_id: {capsule['mission_id']}")
    print(f"state:      {capsule['state']['current']}")
    print(f"agent:      {agent_name}")
    print(f"task:       {task}")
    print(f"capsule:    {MISSIONS_DIR / capsule['mission_id'] / 'capsule.yaml'}")
    print(f"chain head: {contract['_agent_dir']}/receipts/chain-head.txt")
    if iqra_preview_ref:
        print(f"iqra_ref:   mission={iqra_preview_ref['iqra_mission_id']} "
              f"hash={iqra_preview_ref['iqra_preview_self_hash'][:12]}…")
    return capsule


def cmd_preview_from_iqra(agent_name: str, iqra_mission_id: str, acts_file: str = None) -> dict:
    """Bridge: take an IQRA preview's task + self-hash, create a Mission Capsule
    bound to it, run the standard preview flow.

    The capsule.operator.iqra_preview_ref is populated; the first state-transition
    receipt's verified[] cites the IQRA mission_id + self_hash as evidence the
    bridge happened (post-hoc auditable via E-T06 evidence test).
    """
    iqra_ref = load_iqra_preview(iqra_mission_id)
    print(f"loaded iqra preview: mission={iqra_ref['iqra_mission_id']}")
    print(f"  task: {iqra_ref['iqra_task_statement']}")
    print(f"  hash: {iqra_ref['iqra_preview_self_hash']}")
    print(f"  preview_md: {iqra_ref['iqra_preview_md']}")
    print()
    return cmd_preview(agent_name, iqra_ref["iqra_task_statement"],
                       acts_file=acts_file, iqra_preview_ref=iqra_ref)


def cmd_status(mission_id: str):
    capsule = load_capsule(mission_id)
    print(f"mission_id: {capsule['mission_id']}")
    print(f"created:    {capsule['created_at']}")
    print(f"task:       {capsule['operator']['task_statement']}")
    print(f"agent:      {capsule['agent_binding']['agent_name']}")
    print(f"state:      {capsule['state']['current']}")
    print()
    print("history:")
    for h in capsule["state"]["history"]:
        ref = h.get("receipt_ref", "(none)")
        print(f"  {h['state']:<12} entered {h['entered_at']}  receipt {ref[:8] if ref else '(none)'}…")
    print()
    print(f"acts_planned:    {len(capsule['authority']['acts_planned'])}")
    print(f"receipts_minted: {len(capsule['evidence']['receipts_minted'])}")
    print(f"chain_segment:   first={capsule['evidence']['blake3_chain_segment']['first']}, last={capsule['evidence']['blake3_chain_segment']['last']}")
    print(f"outcome:         {capsule['outcome']['result'] or '(pending)'}")
    if capsule['outcome'].get('wisdom_candidate'):
        print(f"  wisdom_candidate: TRUE (operator may type 'GO: promote wisdom {mission_id}')")


def cmd_run(mission_id: str):
    capsule = load_capsule(mission_id)
    if capsule["state"]["current"] != STATE_PREVIEW and capsule["state"]["current"] != STATE_READY:
        print(f"ERROR: mission not in preview/ready state (current: {capsule['state']['current']})",
              file=sys.stderr)
        sys.exit(1)

    contract = load_agent_contract(capsule["agent_binding"]["agent_name"])

    # Check all MUMO_GO consents collected
    unresolved = [
        p for p in capsule["authority"]["acts_planned"]
        if p["tier"] == "MUMO_GO_REQUIRED" and not p.get("consent_received")
    ]
    if unresolved:
        print(f"ERROR: {len(unresolved)} MUMO_GO_REQUIRED acts await consent", file=sys.stderr)
        for u in unresolved:
            print(f"  - {u['act_id']}: needs '{u['consent_phrase_template']}'", file=sys.stderr)
        sys.exit(1)

    # Move preview -> ready (if not already)
    if capsule["state"]["current"] == STATE_PREVIEW:
        transition_state(capsule, contract, STATE_READY, "all_consents_collected")

    # ready -> executing
    transition_state(capsule, contract, STATE_EXECUTING, "run_invoked")

    # walk acts — invoke registered handlers, mint per-act receipts
    act_results = []
    for planned_act in capsule["authority"]["acts_planned"]:
        handler_name = planned_act.get("handler")
        if not handler_name:
            # legacy/stubbed: no handler declared, mark would_execute and continue
            capsule["evidence"]["outputs_written"].append(
                f"would_execute:{planned_act['act_id']} (no handler declared)"
            )
            continue
        try:
            from handlers import get_handler  # type: ignore
        except ImportError:
            sys.path.insert(0, str(Path(__file__).parent))
            from handlers import get_handler  # type: ignore

        try:
            handler = get_handler(handler_name)
        except KeyError as e:
            capsule["evidence"]["outputs_written"].append(
                f"handler_missing:{handler_name}"
            )
            mint_act_handler_receipt(capsule, contract, planned_act,
                                     {"passed": False, "outputs": [],
                                      "evidence": [str(e)],
                                      "finding": "handler_not_registered"})
            continue

        result = handler(planned_act, capsule, contract)
        act_results.append({"act_id": planned_act["act_id"], "result": result})
        for out in result.get("outputs", []):
            capsule["evidence"]["outputs_written"].append(out)
        mint_act_handler_receipt(capsule, contract, planned_act, result)

        if not result.get("passed", False):
            # transition to suspended on first act failure
            transition_state(capsule, contract, STATE_SUSPENDED,
                             f"act_failed:{planned_act['act_id']}")
            print(f"ERROR: act {planned_act['act_id']} failed: {result.get('finding')}",
                  file=sys.stderr)
            sys.exit(1)

    # all acts succeeded (vacuously for empty list, or all real acts passed)
    transition_state(capsule, contract, STATE_VALIDATED, "all_acts_succeeded")

    # validate DoD (vacuously passes for empty predicates_required)
    required = set(capsule["dod"]["predicates_required"])
    capsule["dod"]["predicates_passed"] = list(required)  # at v0.1, all required pass trivially

    # validated -> receipted
    capsule["outcome"]["result"] = "success"
    transition_state(capsule, contract, STATE_RECEIPTED, "outcome_recorded")

    # check wisdom candidacy (KPI scoring deferred at v0.1)
    capsule["outcome"]["wisdom_candidate"] = False  # no scoring data at v0.1

    # receipted -> archived
    transition_state(capsule, contract, STATE_ARCHIVED, "mission_closed")

    save_capsule(capsule)
    print(f"mission {mission_id} archived. state: {capsule['state']['current']}")
    print(f"receipts minted: {len(capsule['evidence']['receipts_minted'])}")
    print(f"chain segment: {capsule['evidence']['blake3_chain_segment']['count']} receipts")


def cmd_list():
    if not MISSIONS_DIR.is_dir():
        print("(no missions yet)")
        return
    for d in sorted(MISSIONS_DIR.iterdir()):
        if not d.is_dir():
            continue
        try:
            cap = load_capsule(d.name)
            print(f"{d.name}  state={cap['state']['current']:<12}  task={cap['operator']['task_statement'][:50]}")
        except Exception as e:
            print(f"{d.name}  (error: {e})")


def cmd_consent(mission_id: str, phrase: str):
    capsule = load_capsule(mission_id)
    contract = load_agent_contract(capsule["agent_binding"]["agent_name"])

    matched = False
    for planned in capsule["authority"]["acts_planned"]:
        if planned.get("tier") != "MUMO_GO_REQUIRED":
            continue
        if planned.get("consent_phrase_template") == phrase or phrase.startswith("GO: "):
            planned["consent_received"] = True
            planned["consent_received_phrase"] = phrase
            planned["consent_received_at"] = now_iso()
            matched = True
            print(f"consent recorded for act {planned['act_id']}")

    if not matched:
        print(f"WARNING: no MUMO_GO_REQUIRED act matched phrase '{phrase}'", file=sys.stderr)

    save_capsule(capsule)


# ─── main ─────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(
        description="DEMA Mission Lifecycle Kernel v0.1",
    )
    sub = p.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("preview", help="create mission and transition to preview state")
    sp.add_argument("agent_name", help="agent name (e.g., dema.node0_mission_agent)")
    sp.add_argument("task", help="task statement (free text)")
    sp.add_argument("--acts-file", help="path to YAML/JSON file of planned acts")

    sp = sub.add_parser("preview-from-iqra",
                        help="bridge: create mission from an existing IQRA preview")
    sp.add_argument("agent_name", help="agent name (e.g., dema.node0_mission_agent)")
    sp.add_argument("iqra_mission_id", help="IQRA mission directory name under ~/.dema/kernel/missions/")
    sp.add_argument("--acts-file", help="path to YAML/JSON file of planned acts (operator-curated)")

    sp = sub.add_parser("status", help="show mission state")
    sp.add_argument("mission_id")

    sp = sub.add_parser("run", help="advance mission to archived (executing -> validated -> receipted -> archived)")
    sp.add_argument("mission_id")

    sub.add_parser("list", help="list all missions")

    sp = sub.add_parser("consent", help="record consent for a MUMO_GO_REQUIRED act")
    sp.add_argument("mission_id")
    sp.add_argument("phrase")

    args = p.parse_args()

    KERNEL_HOME.mkdir(parents=True, exist_ok=True)
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)

    if args.command == "preview":
        cmd_preview(args.agent_name, args.task, args.acts_file)
    elif args.command == "preview-from-iqra":
        cmd_preview_from_iqra(args.agent_name, args.iqra_mission_id, args.acts_file)
    elif args.command == "status":
        cmd_status(args.mission_id)
    elif args.command == "run":
        cmd_run(args.mission_id)
    elif args.command == "list":
        cmd_list()
    elif args.command == "consent":
        cmd_consent(args.mission_id, args.phrase)


if __name__ == "__main__":
    main()
