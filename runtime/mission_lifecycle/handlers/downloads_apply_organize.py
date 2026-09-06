"""
downloads_apply_organize — RECEIPT_BOUND handler (v0.1 dry-run scaffold).

Reads a `proposed_moves.yaml` produced by `downloads_propose_organize` and
emits an `apply_plan.yaml` that classifies each proposed move into
`ready_to_apply` or `blocked_with_reason`. NO files are moved, modified,
deleted, or created in the analyze_root. The plan output is written only
under mission_dir/outputs.

This is the dry-run scaffold for the future apply runtime. The actual
file-moving runtime will be a separate handler (MUMO_GO_REQUIRED tier) and
is deliberately NOT BUILT at v0.1. The constitutional fields in
apply_plan.yaml make this explicit:

  apply_blocked: true
  real_file_moves: false
  requires_future_typed_go: true

ARGS (in planned_act["args"]):
  proposed_moves_path: str  - path to a proposed_moves.yaml file
                              (typically from a prior
                              downloads_propose_organize mission's outputs)

RETURNS:
  {
    "passed": True | False,
    "outputs": [<apply_plan.yaml path>, <apply_summary.md path>],
    "evidence": [<facts>],
    "finding": <str or None>,
    "summary_text": <TTS-ready narration>,
    "plan": {...full plan dict...},
  }

CONSTITUTIONAL GROUND:
  - READ-ONLY. No os.rename / shutil.move / Path.unlink / Path.rmdir /
    os.remove / shutil.rmtree are imported or invoked.
  - apply_plan.yaml + apply_summary.md are written only under
    mission_dir/outputs.
  - Each proposed move is boundary-validated: src + dst MUST resolve under
    analyze_root. Symlink-escape and path-escape are classified as BLOCKED.
  - Apply runtime (real file moves) is NOT built at v0.1. Future apply will
    be MUMO_GO_REQUIRED tier with its own exact-string consent phrase.
"""
from __future__ import annotations

import json
import os
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


PROPOSAL_SCHEMA = "bizra.dema.downloads_organize_proposal.v0.1"
PLAN_SCHEMA = "bizra.dema.downloads_apply_plan.v0.1"


def _try_yaml_dump(obj) -> str:
    try:
        import yaml
        return yaml.dump(obj, sort_keys=False, allow_unicode=True)
    except ImportError:
        return json.dumps(obj, indent=2, ensure_ascii=False)


def _load_proposal(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    try:
        import yaml
        return yaml.safe_load(text)
    except ImportError:
        return json.loads(text)


def _classify_move(move: dict, analyze_root: Path,
                   collision_targets: set) -> tuple[str, str | None]:
    """Return (status, detail).
    status ∈ {ready, blocked_src_missing, blocked_boundary_violation,
              blocked_target_exists, blocked_collision}.
    """
    src = Path(move["src"])
    dst = Path(move["dst"])

    if str(dst) in collision_targets:
        return "blocked_collision", f"multiple sources target {dst}"

    if not src.exists():
        return "blocked_src_missing", f"src no longer exists: {src}"

    try:
        src_resolved = src.resolve()
        dst_resolved = dst.resolve() if dst.exists() else (dst.parent.resolve() / dst.name)
    except (OSError, RuntimeError) as e:
        return "blocked_boundary_violation", f"path resolution error: {e}"

    root_str = str(analyze_root) + os.sep
    if not (str(src_resolved).startswith(root_str) or src_resolved == analyze_root):
        return "blocked_boundary_violation", f"src outside analyze_root: {src_resolved}"
    if not (str(dst_resolved).startswith(root_str) or dst_resolved == analyze_root):
        return "blocked_boundary_violation", f"dst outside analyze_root: {dst_resolved}"

    if dst.exists():
        return "blocked_target_exists", f"dst already exists: {dst}"

    return "ready", None


def handle(planned_act: dict, capsule: dict, contract: dict) -> dict:
    args = planned_act.get("args", {}) or {}
    proposed_path_arg = args.get("proposed_moves_path")
    if not proposed_path_arg:
        return {
            "passed": False, "outputs": [],
            "evidence": ["missing required arg: proposed_moves_path"],
            "finding": "missing_proposed_moves_path",
            "summary_text": None, "plan": None,
        }

    proposed_path = Path(os.path.expanduser(proposed_path_arg)).resolve()
    if not proposed_path.exists() or not proposed_path.is_file():
        return {
            "passed": False, "outputs": [],
            "evidence": [f"proposed_moves file not found: {proposed_path}"],
            "finding": "proposed_moves_not_found",
            "summary_text": None, "plan": None,
        }

    try:
        proposal = _load_proposal(proposed_path)
    except Exception as e:
        return {
            "passed": False, "outputs": [],
            "evidence": [f"failed to parse proposal file: {type(e).__name__}: {e}"],
            "finding": "proposal_parse_error",
            "summary_text": None, "plan": None,
        }

    if not isinstance(proposal, dict):
        return {
            "passed": False, "outputs": [],
            "evidence": [f"proposal must be a dict, got {type(proposal).__name__}"],
            "finding": "proposal_not_dict",
            "summary_text": None, "plan": None,
        }

    if proposal.get("schema") != PROPOSAL_SCHEMA:
        return {
            "passed": False, "outputs": [],
            "evidence": [f"unexpected proposal schema: {proposal.get('schema')!r}; "
                         f"expected {PROPOSAL_SCHEMA!r}"],
            "finding": "proposal_schema_mismatch",
            "summary_text": None, "plan": None,
        }

    analyze_root_str = proposal.get("analyze_root")
    if not analyze_root_str:
        return {
            "passed": False, "outputs": [],
            "evidence": ["proposal missing analyze_root field"],
            "finding": "proposal_missing_analyze_root",
            "summary_text": None, "plan": None,
        }
    analyze_root = Path(analyze_root_str).resolve()

    moves = proposal.get("moves") or []
    if not isinstance(moves, list):
        return {
            "passed": False, "outputs": [],
            "evidence": [f"proposal.moves must be a list, got {type(moves).__name__}"],
            "finding": "proposal_moves_not_list",
            "summary_text": None, "plan": None,
        }

    t0 = time.time()

    # Detect collisions upfront — multiple sources targeting the same dst
    dst_counts = Counter(m.get("dst") for m in moves if isinstance(m, dict))
    collision_targets = {dst for dst, n in dst_counts.items() if n > 1}

    ready_to_apply = []
    moves_blocked = []
    reason_counts = Counter()

    for m in moves:
        if not isinstance(m, dict):
            moves_blocked.append({
                "src": None, "dst": None, "category": None,
                "reason": "blocked_invalid_entry",
                "detail": f"move entry not a dict: {type(m).__name__}",
            })
            reason_counts["blocked_invalid_entry"] += 1
            continue

        status, detail = _classify_move(m, analyze_root, collision_targets)
        if status == "ready":
            ready_to_apply.append({
                "src": m.get("src"),
                "dst": m.get("dst"),
                "category": m.get("category"),
                "size_bytes": m.get("size_bytes"),
            })
        else:
            moves_blocked.append({
                "src": m.get("src"),
                "dst": m.get("dst"),
                "category": m.get("category"),
                "reason": status,
                "detail": detail,
            })
            reason_counts[status] += 1

    scan_dt = time.time() - t0

    mission_id = capsule["mission_id"]
    mission_dir = Path(os.path.expanduser(
        "~/.dema/kernel/mission_lifecycle/missions")) / mission_id
    output_dir = mission_dir / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)

    plan = {
        "schema": PLAN_SCHEMA,
        "plan_id": mission_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_proposal_path": str(proposed_path),
        "source_proposal_schema": proposal.get("schema"),
        "source_proposal_id": proposal.get("proposal_id"),
        "analyze_root": str(analyze_root),

        # Constitutional fields — make the boundary explicit in the artifact
        "apply_blocked": True,
        "real_file_moves": False,
        "requires_future_typed_go": True,
        "applier_runtime_status": "NOT_BUILT_v0_1_DRY_RUN_ONLY",
        "consent_phrase_template_for_future_apply": (
            f"GO: organize downloads {mission_id}"
        ),

        "moves_total": len(moves),
        "moves_ready_to_apply": ready_to_apply,
        "moves_blocked": moves_blocked,

        "stats": {
            "total_moves": len(moves),
            "ready_count": len(ready_to_apply),
            "blocked_count": len(moves_blocked),
            "blocked_by_collision": reason_counts.get("blocked_collision", 0),
            "blocked_by_target_exists": reason_counts.get("blocked_target_exists", 0),
            "blocked_by_src_missing": reason_counts.get("blocked_src_missing", 0),
            "blocked_by_boundary_violation": reason_counts.get(
                "blocked_boundary_violation", 0),
            "blocked_by_invalid_entry": reason_counts.get("blocked_invalid_entry", 0),
            "scan_seconds": scan_dt,
        },

        "constitutional_witness": [
            "this handler is READ-ONLY at v0.1",
            "zero files were moved, modified, deleted, or created in analyze_root",
            "apply_plan.yaml is written only under mission_dir/outputs",
            "src + dst paths are boundary-validated to stay under analyze_root",
            "the future apply runtime (v0.2) will be MUMO_GO_REQUIRED tier",
            "no external network",
            "no canon mutation",
        ],
    }

    plan_yaml_path = output_dir / "apply_plan.yaml"
    plan_yaml_path.write_text(_try_yaml_dump(plan), encoding="utf-8")

    md_lines = [
        f"# Downloads Apply PLAN (dry-run) — {plan['generated_at']}",
        "",
        f"**Source proposal:** `{proposed_path}`",
        f"**Analyze root:** `{analyze_root}`",
        f"**Plan id (this mission):** `{mission_id}`",
        "",
        "## Boundary",
        "",
        "- `apply_blocked: true`",
        "- `real_file_moves: false`",
        "- `requires_future_typed_go: true`",
        "- `applier_runtime_status: NOT_BUILT_v0_1_DRY_RUN_ONLY`",
        "",
        "**Nothing has been moved.** This is a dry-run classification only.",
        "",
        "## Classification",
        "",
        f"- **Total proposed moves:** {len(moves)}",
        f"- **Ready to apply (when runtime built):** {len(ready_to_apply)}",
        f"- **Blocked:** {len(moves_blocked)}",
    ]
    if reason_counts:
        md_lines.append("")
        md_lines.append("### Blocked-reason breakdown")
        for reason, n in reason_counts.most_common():
            md_lines.append(f"- `{reason}`: {n}")
    if moves_blocked:
        md_lines.extend(["", "### First blocked entries (up to 10)"])
        for b in moves_blocked[:10]:
            md_lines.append(f"- `{b['reason']}` — {b['detail']}")
    md_lines.extend([
        "",
        "## To execute this plan",
        "",
        "At v0.1, **executing is not built**. The apply runtime is named in the",
        "constitutional fields above. Building it is a separate halt-gate and",
        "will require:",
        "",
        f"- a separate mission with `tier: MUMO_GO_REQUIRED`",
        f"- exact-string consent phrase: `GO: organize downloads {mission_id}`",
        f"- a reversible-journal discipline (each mv recorded for unmove)",
        "",
        "## Constitutional witness",
    ])
    for w in plan["constitutional_witness"]:
        md_lines.append(f"- {w}")
    summary_md_path = output_dir / "apply_summary.md"
    summary_md_path.write_text("\n".join(md_lines), encoding="utf-8")

    # TTS-ready narration
    summary_text = (
        f"I have classified {len(moves)} proposed moves into {len(ready_to_apply)} ready and "
        f"{len(moves_blocked)} blocked. "
        f"This is a dry-run plan only. No files have been moved, modified, or deleted. "
        f"Applying this plan requires a separate operator typed go and an apply runtime that is "
        f"not yet built. The plan and its boundary are recorded in apply plan dot yaml under the "
        f"mission outputs directory."
    )

    return {
        "passed": True,
        "outputs": [str(plan_yaml_path), str(summary_md_path)],
        "evidence": [
            f"loaded proposal from {proposed_path}",
            f"proposal schema verified: {PROPOSAL_SCHEMA}",
            f"analyze_root: {analyze_root}",
            f"classified {len(moves)} moves in {scan_dt:.3f}s",
            f"ready_to_apply: {len(ready_to_apply)}",
            f"blocked: {len(moves_blocked)}",
            f"blocked-by-collision: {reason_counts.get('blocked_collision', 0)}",
            f"blocked-by-target-exists: {reason_counts.get('blocked_target_exists', 0)}",
            f"blocked-by-src-missing: {reason_counts.get('blocked_src_missing', 0)}",
            f"blocked-by-boundary-violation: {reason_counts.get('blocked_boundary_violation', 0)}",
            f"apply_plan.yaml: {plan_yaml_path}",
            f"apply_summary.md: {summary_md_path}",
            "apply_blocked=true, real_file_moves=false, requires_future_typed_go=true",
            "zero files moved/modified/deleted in analyze_root",
            "apply runtime (v0.2) deliberately NOT BUILT",
        ],
        "finding": None,
        "summary_text": summary_text,
        "plan": plan,
    }
