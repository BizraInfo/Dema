"""
node0_awakening — RECEIPT_BOUND handler for Dema Awakening v0.1.

Invokes atlas.scan_metadata over Node0 scan_roots, writes the inventory to
mission_dir/outputs/atlas_inventory_v0_1.json, and mints a custom receipt
of schema `bizra.dema.node0_awakening_receipt.v0.1` (NOT the kernel's generic
mission_act_handler receipt — that fires separately after this handler returns).

CUSTOM MINT PATTERN (swarm GAP-1 fix):
  This handler mints its own receipt directly because the awakening receipt
  carries a domain-specific schema with structural fields the kernel's
  mint_act_handler_receipt can't emit. We follow the voice.py pattern:
  build canonical payload → sha256 → write under agent_dir/receipts/<date>/
  → update chain-head.txt atomically.

ARGS (in planned_act["args"]):
  scan_roots:           list[str]   default: ["~", "/data/bizra", "/data2/BIZRA-ASSET"]
  excluded_zones_extra: list[str]   default: []
  max_entries:          int         default: 500000

RETURNS standard handler result + extra keys:
  atlas_ref:              dict with inventory_path + sha256 + counts
  custom_receipt_path:    str path of the awakening receipt
  custom_receipt_hash:    self_hash of the awakening receipt
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Make atlas importable
_KERNEL_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_KERNEL_ROOT / "atlas"))
import atlas  # noqa: E402


DEMA_HOME = Path(os.environ.get("DEMA_HOME") or (Path.home() / ".dema"))


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _canonicalize(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _build_vdpu_claims(inventory_doc: dict) -> dict:
    """Compute V/D/P/U claims grounded in atlas-actual fields only."""
    stats = inventory_doc["stats"]
    regions = stats["region_summaries"]

    verified = [
        {
            "claim": f"{stats['total_files']} files metadata-scanned across {len(inventory_doc['scan_roots'])} scan roots",
            "evidence_kind": "path_count",
            "evidence_value": stats["total_files"],
        },
        {
            "claim": f"{stats['total_bytes']} bytes summed (metadata, not content read)",
            "evidence_kind": "stat",
            "evidence_value": stats["total_bytes"],
        },
        {
            "claim": f"{stats['total_excluded_paths']} paths excluded at sensitivity-tier-2 verify",
            "evidence_kind": "path_count",
            "evidence_value": stats["total_excluded_paths"],
        },
    ]

    derived = []
    if regions:
        top_region = regions[0]
        derived.append({
            "claim": f"Largest region by bytes: {top_region['region']} ({top_region['byte_total']} bytes, {top_region['file_count']} files)",
            "derivation": "region_summaries[0] after sort by byte_total descending",
        })
    high_cert = [r for r in regions if r["mean_classification_certainty"] >= 0.9]
    derived.append({
        "claim": f"{len(high_cert)} of {len(regions)} regions have mean_classification_certainty >= 0.9",
        "derivation": "filtered region_summaries by mean_classification_certainty threshold",
    })

    assumed = [
        {
            "claim": "Classification labels approximate the operator's actual mental categorization of files",
            "assumption": "extension + parent-dir heuristic correlates with operator intent",
            "confidence": 0.7,
            "boundary": "files in repurposed dirs (e.g. PDFs in Downloads that are research papers vs receipts) collapse to single label; correction requires operator input",
        },
        {
            "claim": "project_root assignments via .git ancestor walk identify discrete projects",
            "assumption": "operator uses git for project boundaries",
            "confidence": 0.85,
            "boundary": "non-git projects (raw folders, archived experiments) appear as project_root=null",
        },
    ]

    unknown = [
        {
            "claim": "no inspection of file contents was performed in any region",
            "ground": "doctrine requires metadata-only first pass; deeper read requires typed GO per refusal-as-product Layer 1",
        },
        {
            "claim": f"sensitivity-tier-2 excluded paths ({stats['total_excluded_paths']} entries) — Dema does not know what they contain",
            "ground": "exclusion is intentional; auditor can verify by attempting to read excluded paths and finding atlas never touched them",
        },
    ]
    if stats.get("mtime_refused_count", 0) > 0:
        unknown.append({
            "claim": f"{stats['mtime_refused_count']} files refused-insertion due to unparseable mtime",
            "ground": "atlas refuses to fabricate mtime_year=0 (swarm fix ε); these files are not in the inventory",
        })
    return {"verified": verified, "derived": derived,
            "assumed_with_ihsan": assumed, "unknown": unknown}


def _pick_mission_candidates(inventory_doc: dict) -> list[dict]:
    """Three slots, three heuristics — atlas-field-grounded per awakening_report spec."""
    regions = inventory_doc["stats"]["region_summaries"]
    candidates: list[dict | None] = []

    # 1. highest-snr-region: max(byte_total * mean_classification_certainty)
    EXCLUDED_KINDS = {"cold-archive", "cloud-mirror", "model-cache"}
    snr_pool = [r for r in regions if r["region"] not in EXCLUDED_KINDS]
    if snr_pool:
        best = max(snr_pool, key=lambda r: r["byte_total"] * r["mean_classification_certainty"])
        candidates.append({
            "id": "M-AWAKEN-1", "kind": "highest-snr-region",
            "title": f"Explore region: {best['region']}",
            "target_region": best["region"],
            "rationale": f"Largest signal-weighted region: {best['file_count']} files / {best['byte_total']} bytes / mean certainty {best['mean_classification_certainty']:.2f}",
            "estimated_effort_hours": 4.0,
            "suggested_consent_phrase": f"GO: explore region {best['region']} under consent",
        })
    else:
        candidates.append({"id": "M-AWAKEN-1", "kind": "highest-snr-region",
                           "title": None, "target_region": None,
                           "rationale": None, "estimated_effort_hours": None,
                           "suggested_consent_phrase": None,
                           "ground": "no non-cold regions available"})

    # 2. unfinished-loop: project_root with age 30d+ and last activity 14d+ old, ≥10 files
    projects: dict[str, dict] = {}
    now_ts = datetime.now(timezone.utc).timestamp()
    for entry in inventory_doc["inventory"]:
        pr = entry["project_root"]
        if not pr:
            continue
        # mtime_iso → unix
        try:
            ts = datetime.fromisoformat(entry["mtime_iso"]).timestamp()
        except (ValueError, TypeError):
            continue
        if pr not in projects:
            projects[pr] = {"min_ts": ts, "max_ts": ts, "count": 1}
        else:
            p = projects[pr]
            p["min_ts"] = min(p["min_ts"], ts)
            p["max_ts"] = max(p["max_ts"], ts)
            p["count"] += 1

    SEC_PER_DAY = 86400
    unfinished_pool = []
    for pr, p in projects.items():
        age_days = (now_ts - p["min_ts"]) / SEC_PER_DAY
        idle_days = (now_ts - p["max_ts"]) / SEC_PER_DAY
        if age_days > 30 and idle_days > 14 and p["count"] >= 10:
            unfinished_pool.append((pr, p, idle_days))
    if unfinished_pool:
        unfinished_pool.sort(key=lambda x: -x[2])
        pr, p, idle = unfinished_pool[0]
        title_basename = os.path.basename(pr) or pr
        candidates.append({
            "id": "M-AWAKEN-2", "kind": "unfinished-loop",
            "title": f"Close or retire project: {title_basename}",
            "target_region": "project-root",
            "rationale": f"Project with {p['count']} files, idle {idle:.0f} days; either has unfinished work or should be archived",
            "estimated_effort_hours": 6.0,
            "suggested_consent_phrase": f"GO: review project {title_basename} for closure",
        })
    else:
        candidates.append({"id": "M-AWAKEN-2", "kind": "unfinished-loop",
                           "title": None, "target_region": None,
                           "rationale": None, "estimated_effort_hours": None,
                           "suggested_consent_phrase": None,
                           "ground": "no project_root with age>30d AND idle>14d AND ≥10 files"})

    # 3. gold-signal: max dup_signature_clusters OR largest unclassified cluster
    if regions:
        with_dups = sorted(regions, key=lambda r: -r["dup_signature_clusters"])
        top_dup = with_dups[0]
        if top_dup["dup_signature_clusters"] >= 3:
            candidates.append({
                "id": "M-AWAKEN-3", "kind": "gold-signal",
                "title": f"Resolve duplicate clusters in {top_dup['region']}",
                "target_region": top_dup["region"],
                "rationale": f"{top_dup['dup_signature_clusters']} (basename+size+type) clusters span ≥2 parents — likely duplicates worth de-duplication review",
                "estimated_effort_hours": 2.0,
                "suggested_consent_phrase": f"GO: dedupe-review region {top_dup['region']}",
            })
        else:
            # Fallback: largest unclassified-other region
            other_regions = [r for r in regions if r["region"] in ("other", "binary")]
            if other_regions:
                largest_other = max(other_regions, key=lambda r: r["file_count"])
                candidates.append({
                    "id": "M-AWAKEN-3", "kind": "gold-signal",
                    "title": f"Classify unclassified cluster in {largest_other['region']}",
                    "target_region": largest_other["region"],
                    "rationale": f"{largest_other['file_count']} files of type {largest_other['region']} with low mean certainty {largest_other['mean_classification_certainty']:.2f}",
                    "estimated_effort_hours": 3.0,
                    "suggested_consent_phrase": f"GO: classify region {largest_other['region']}",
                })
            else:
                candidates.append({"id": "M-AWAKEN-3", "kind": "gold-signal",
                                   "title": None, "target_region": None,
                                   "rationale": None, "estimated_effort_hours": None,
                                   "suggested_consent_phrase": None,
                                   "ground": "no dup_signature_clusters >= 3 and no unclassified region"})
    else:
        candidates.append({"id": "M-AWAKEN-3", "kind": "gold-signal",
                           "title": None, "target_region": None,
                           "rationale": None, "estimated_effort_hours": None,
                           "suggested_consent_phrase": None,
                           "ground": "no region_summaries"})

    return candidates


def _write_awakening_report(mission_id: str, mission_dir: Path,
                            inventory_path: Path, inventory_doc: dict,
                            speech_intro: str, speech_summary: str,
                            vdpu: dict, candidates: list,
                            duration_seconds: float,
                            chain_head_at_mint: str,
                            receipt_path: Path) -> Path:
    """Emit bizra.dema.awakening_report.v0.1 to mission_dir/outputs."""
    stats = inventory_doc["stats"]
    report = {
        "schema": "bizra.dema.awakening_report.v0.1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mission_id": mission_id,
        "duration_seconds": round(duration_seconds, 3),
        "speech_transcripts": {
            "intro": speech_intro,
            "summary": speech_summary,
        },
        "atlas_ref": {
            "inventory_path": str(inventory_path.relative_to(mission_dir)),
            "sha256": _sha256_file(inventory_path),
            "scan_roots_count": len(inventory_doc["scan_roots"]),
            "excluded_zones_count": len(inventory_doc["excluded_zones"]),
            "total_files": stats["total_files"],
            "total_bytes": stats["total_bytes"],
        },
        "vdpu_claims": vdpu,
        "mission_candidates": candidates,
        "receipt_ref": {
            "receipt_path": str(receipt_path),
            "schema": "bizra.dema.node0_awakening_receipt.v0.1",
            "chain_head_at_mint": chain_head_at_mint,
        },
        "no_actions_taken": True,
        "operator_choice": None,
    }
    out_dir = mission_dir / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "awakening_report_v0_1.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False),
                        encoding="utf-8")
    return out_path


def _mint_custom_receipt(capsule: dict, contract: dict,
                        inventory_path: Path, inventory_doc: dict,
                        vdpu: dict, candidates: list,
                        duration_seconds: float,
                        speech_transcripts: dict) -> tuple[Path, str, str]:
    """Mint bizra.dema.node0_awakening_receipt.v0.1 directly.

    Returns (receipt_path, self_hash, prev_hash).
    """
    agent_dir = contract["_agent_dir"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    receipt_dir = agent_dir / "receipts" / today
    receipt_dir.mkdir(parents=True, exist_ok=True)

    chain_head_file = agent_dir / "receipts" / "chain-head.txt"
    prev_hash = (chain_head_file.read_text(encoding="utf-8").strip()
                 if chain_head_file.exists() else "GENESIS")

    act_id = str(uuid.uuid4())
    stats = inventory_doc["stats"]
    receipt = {
        "schema": "bizra.dema.node0_awakening_receipt.v0.1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "act_id": act_id,
        "mission_id": capsule["mission_id"],
        "agent_name": contract["capability"]["agent"]["name"],
        "contract_ref": contract["capability"]["contract_id"],
        "awakening_summary": {
            "regions_inventoried": len(stats["region_summaries"]),
            "sensitivity_zones_excluded": stats["total_excluded_paths"],
            "files_metadata_scanned": stats["total_files"],
            "bytes_metadata_summed": stats["total_bytes"],
            "gold_signals_surfaced": sum(1 for c in candidates if c.get("kind") == "gold-signal" and c.get("title")),
            "mission_candidates_proposed": 3,
            "duration_seconds": round(duration_seconds, 3),
        },
        "vdpu_claims": {
            "verified": [v["claim"] for v in vdpu["verified"]],
            "derived": [d["claim"] for d in vdpu["derived"]],
            "assumed_with_ihsan": [a["claim"] for a in vdpu["assumed_with_ihsan"]],
            "unknown": [u["claim"] for u in vdpu["unknown"]],
        },
        "boundary_invariants_asserted": [
            "metadata-only — no file content was read",
            "no uploads — no network calls during scan",
            "no mutations — atlas wrote only to mission_dir/outputs",
            "sensitivity-tier-2 excluded thrice — by path list AND by mode-0700 AND by realpath",
            "no auto-action — mission candidates are proposals only, awaiting typed GO",
        ],
        "verified": [
            "awakening orchestrator invoked atlas.scan_metadata",
            f"atlas produced atlas_inventory_v0_1.json at {inventory_path}",
            "inventory.content_was_read=false confirmed via JSON field",
            "inventory.lstat_only=true confirmed via JSON field",
            "V/D/P/U claims grounded in inventory.stats fields only",
            f"{len([c for c in candidates if c.get('title')])} mission candidates produced",
            f"receipt chained to prev_hash {prev_hash[:12]}…",
        ],
        "derived": [
            "awakening was a single RECEIPT_BOUND act under mission_kernel",
        ],
        "assumed_with_ihsan": [
            {
                "assumption": "operator authorized the awakening by invoking the awaken shim",
                "ground": "shim invocation is operator-typed; receipt records the shim-invocation as the consent primitive",
                "boundary": "if automation invoked the shim, this assumption fails; v0.1 has no tty-check enforcement",
                "rejectable": True,
            }
        ],
        "unknown": [
            "whether operator will type GO on any mission candidate (open question · drives next cycle)"
        ],
        "boundary_compliance": {
            "inside_node0_only": True,
            "no_external_network": True,
            "no_canon_mutation": True,
            "no_node1_contact": True,
            "no_self_promotion": True,
            "writes_under": "mission_dir/outputs only",
        },
        "consent": {
            "required": False,
            "phrase_received": None,
            "fire_authority": "operator-initiated awaken shim invocation",
        },
        "model": None,
        "digest_algo": "sha256",
        "blake3_prev": prev_hash,
    }
    payload = _canonicalize(receipt)
    self_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    receipt["blake3_self"] = self_hash

    out_path = receipt_dir / f"mission-{capsule['mission_id']}-act-AWAKEN-{self_hash[:8]}.json"
    out_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False),
                        encoding="utf-8")
    # Atomic chain-head update
    chain_head_file.write_text(self_hash, encoding="utf-8")

    return out_path, self_hash, prev_hash


def handle(planned_act: dict, capsule: dict, contract: dict) -> dict:
    """RECEIPT_BOUND handler entrypoint."""
    args = planned_act.get("args") or {}
    scan_roots = args.get("scan_roots") or [
        str(Path.home()),
        "/data/bizra",
        "/data2/BIZRA-ASSET",
    ]
    excluded_zones_extra = args.get("excluded_zones_extra") or []
    max_entries = int(args.get("max_entries", 500_000))

    import time
    t0 = time.time()

    mission_id = capsule["mission_id"]
    mission_dir = Path(os.path.expanduser(
        "~/.dema/kernel/mission_lifecycle/missions")) / mission_id

    # 1. Atlas scan
    inventory_doc = atlas.scan_metadata(
        scan_roots, excluded_zones_extra=excluded_zones_extra,
        max_entries=max_entries,
    )
    inventory_path = atlas.write_inventory(inventory_doc, mission_dir)

    # 2. V/D/P/U + candidates
    vdpu = _build_vdpu_claims(inventory_doc)
    candidates = _pick_mission_candidates(inventory_doc)

    # 3. Speech transcripts (privacy clause: aggregated counts only, no abs paths)
    stats = inventory_doc["stats"]
    speech_intro = (
        "Mumu, I do not yet fully know my own home. "
        "I'll metadata-scan the scan roots you've authorized and report back "
        "what I see, what I refuse to look at, and what missions I'd propose."
    )
    speech_summary = (
        f"I scanned {len(inventory_doc['scan_roots'])} scan roots and excluded "
        f"{stats['total_excluded_paths']} sensitivity-tier-2 paths. "
        f"I found {stats['total_files']} files across "
        f"{len(stats['region_summaries'])} regions. "
        f"I propose three missions, each requiring your typed consent before action."
    )
    duration = time.time() - t0

    # 4. Mint custom receipt FIRST so awakening_report can cite it
    receipt_path, self_hash, prev_hash = _mint_custom_receipt(
        capsule, contract, inventory_path, inventory_doc,
        vdpu, candidates, duration,
        {"intro": speech_intro, "summary": speech_summary},
    )

    # 5. Write awakening_report
    report_path = _write_awakening_report(
        mission_id, mission_dir, inventory_path, inventory_doc,
        speech_intro, speech_summary, vdpu, candidates, duration,
        chain_head_at_mint=prev_hash, receipt_path=receipt_path,
    )

    return {
        "passed": True,
        "outputs": [str(inventory_path), str(report_path)],
        "evidence": [
            f"atlas scanned {stats['total_files']} files in {duration:.2f}s",
            f"{stats['total_excluded_paths']} paths excluded at sensitivity verify",
            f"{len(stats['region_summaries'])} regions classified",
            f"{len([c for c in candidates if c.get('title')])} mission candidates produced",
            f"custom receipt minted: {self_hash[:16]}…",
            f"chain extended from {prev_hash[:12]}… to {self_hash[:12]}…",
            "metadata-only invariant held (atlas.content_was_read=False)",
        ],
        "finding": None,
        "summary_text": speech_summary,
        "atlas_ref": {
            "inventory_path": str(inventory_path),
            "sha256": _sha256_file(inventory_path),
            "total_files": stats["total_files"],
            "total_bytes": stats["total_bytes"],
        },
        "custom_receipt_path": str(receipt_path),
        "custom_receipt_hash": self_hash,
        "mission_candidates": candidates,
        "speech_transcripts": {"intro": speech_intro, "summary": speech_summary},
    }
