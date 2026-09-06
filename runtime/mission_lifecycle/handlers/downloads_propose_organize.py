"""
downloads_propose_organize — RECEIPT_BOUND handler.

Reads ~/Downloads (or analyze_root) and produces a PROPOSED organization plan
as YAML: which file moves where. NO files are touched. The proposal is
written under the mission directory; applying it is a separate v0.2 handler
(MUMO_GO_REQUIRED tier, not built yet).

ARGS (in planned_act["args"]):
  analyze_root: str   - directory to plan organization for (default: ~/Downloads)
  max_files:    int   - cap on files scanned (default: 1000)

RETURNS:
  {
    "passed": True | False,
    "outputs": [<proposed_moves.yaml path>, <propose_summary.md path>],
    "evidence": [<facts>],
    "finding": <str or None>,
    "summary_text": <TTS-ready narration of the proposal>,
    "proposal": {
      "moves": [{"src": ..., "dst": ..., "category": ...}, ...],
      "by_category": {category: count},
      "collisions": [<name conflicts>],
      "skipped_root_only": [<files left at root with reason>],
    },
  }

CONSTITUTIONAL GROUND:
  - READ-ONLY. No moves. No deletes. No mkdir.
  - The proposal file is written under mission_dir/outputs only.
  - Apply step (downloads_apply_organize) is MUMO_GO_REQUIRED tier and is NOT
    invoked here.
"""
from __future__ import annotations

import os
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


# Category routing — extension lowercase → target subfolder name (proposed)
CATEGORY_ROUTING = {
    "pdf": "Papers",
    "md": "Notes", "txt": "Notes", "rst": "Notes",
    "jpg": "Images", "jpeg": "Images", "png": "Images", "gif": "Images",
    "webp": "Images", "svg": "Images", "heic": "Images", "bmp": "Images", "tiff": "Images",
    "mp4": "Videos", "mov": "Videos", "mkv": "Videos", "webm": "Videos",
    "avi": "Videos", "flv": "Videos", "m4v": "Videos",
    "mp3": "Audio", "wav": "Audio", "m4a": "Audio", "flac": "Audio",
    "ogg": "Audio", "opus": "Audio", "aac": "Audio",
    "zip": "Archives", "tar": "Archives", "gz": "Archives", "7z": "Archives",
    "bz2": "Archives", "xz": "Archives", "rar": "Archives",
    "py": "Code", "js": "Code", "ts": "Code", "rs": "Code", "go": "Code",
    "c": "Code", "cpp": "Code", "h": "Code", "java": "Code", "rb": "Code",
    "sh": "Code", "lua": "Code", "swift": "Code", "kt": "Code",
    "docx": "Office", "doc": "Office", "xlsx": "Office", "xls": "Office",
    "pptx": "Office", "ppt": "Office", "odt": "Office", "ods": "Office",
    "json": "Config", "yaml": "Config", "yml": "Config", "toml": "Config",
    "xml": "Config", "ini": "Config", "conf": "Config",
}


def _try_yaml_dump(obj) -> str:
    try:
        import yaml
        return yaml.dump(obj, sort_keys=False, allow_unicode=True)
    except ImportError:
        import json
        return json.dumps(obj, indent=2, ensure_ascii=False)


def handle(planned_act: dict, capsule: dict, contract: dict) -> dict:
    args = planned_act.get("args", {}) or {}
    analyze_root = Path(os.path.expanduser(args.get("analyze_root", "~/Downloads"))).resolve()
    max_files = int(args.get("max_files", 1000))

    if not analyze_root.exists() or not analyze_root.is_dir():
        return {
            "passed": False, "outputs": [],
            "evidence": [f"analyze_root not a directory: {analyze_root}"],
            "finding": "analyze_root_not_directory",
            "summary_text": None, "proposal": None,
        }

    t0 = time.time()
    moves = []
    by_category = Counter()
    skipped_root = []
    target_to_sources = defaultdict(list)
    truncated = False
    scanned = 0

    for entry in analyze_root.iterdir():
        if not entry.is_file():
            continue
        if scanned >= max_files:
            truncated = True
            break
        scanned += 1

        ext = entry.suffix.lower().lstrip(".")
        category = CATEGORY_ROUTING.get(ext)

        if not category:
            skipped_root.append({
                "name": entry.name,
                "reason": "extension_not_in_routing_table" if ext else "no_extension",
            })
            continue

        target_dir = analyze_root / category
        target_path = target_dir / entry.name

        # Boundary check: target MUST stay under analyze_root
        try:
            target_resolved = target_path.resolve()
        except (OSError, RuntimeError):
            skipped_root.append({"name": entry.name, "reason": "path_resolution_error"})
            continue
        if not str(target_resolved).startswith(str(analyze_root) + os.sep) \
                and target_resolved != analyze_root:
            skipped_root.append({"name": entry.name, "reason": "target_outside_root"})
            continue

        moves.append({
            "src": str(entry),
            "dst": str(target_path),
            "category": category,
            "size_bytes": entry.stat().st_size,
        })
        by_category[category] += 1
        target_to_sources[str(target_path)].append(str(entry))

    # Collision detection: would multiple sources land at the same target?
    collisions = {tgt: srcs for tgt, srcs in target_to_sources.items() if len(srcs) > 1}

    # Also flag target-already-exists collisions
    target_already_exists = []
    for m in moves:
        if Path(m["dst"]).exists():
            target_already_exists.append(m["dst"])

    scan_dt = time.time() - t0

    # Write proposal yaml
    mission_id = capsule["mission_id"]
    mission_dir = Path(os.path.expanduser("~/.dema/kernel/mission_lifecycle/missions")) / mission_id
    output_dir = mission_dir / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)

    proposal = {
        "schema": "bizra.dema.downloads_organize_proposal.v0.1",
        "proposal_id": mission_id,
        "analyze_root": str(analyze_root),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tier_to_apply": "MUMO_GO_REQUIRED",
        "applier_handler_name": "downloads_apply_organize",
        "applier_handler_status": "NOT_BUILT_v0_1_PROPOSAL_ONLY",
        "consent_phrase_template": f"GO: organize downloads {mission_id}",
        "moves": moves,
        "by_category": dict(by_category),
        "collisions_same_target": [
            {"target": tgt, "sources": srcs} for tgt, srcs in collisions.items()
        ],
        "target_already_exists": target_already_exists,
        "skipped_at_root": skipped_root,
        "stats": {
            "files_scanned": scanned,
            "files_proposed_to_move": len(moves),
            "files_to_skip": len(skipped_root),
            "categories_used": len(by_category),
            "collision_count": len(collisions),
            "scan_seconds": scan_dt,
            "truncated": truncated,
        },
    }
    proposal_yaml = output_dir / "proposed_moves.yaml"
    proposal_yaml.write_text(_try_yaml_dump(proposal), encoding="utf-8")

    # Write summary md
    md_lines = [
        f"# Downloads Organization PROPOSAL — {proposal['generated_at']}",
        "",
        f"**Analyze root:** `{analyze_root}`",
        f"**Files scanned:** {scanned}" + (" (truncated at max_files)" if truncated else ""),
        f"**Files proposed to move:** {len(moves)}",
        f"**Files to skip (stay at root):** {len(skipped_root)}",
        f"**Categories used:** {len(by_category)}",
        f"**Same-target collisions:** {len(collisions)}",
        f"**Targets already existing:** {len(target_already_exists)}",
        "",
        "## Proposed moves by category",
    ]
    for cat, n in by_category.most_common():
        md_lines.append(f"- {cat}: {n} files → `{analyze_root}/{cat}/`")
    if collisions:
        md_lines.extend(["", "## ⚠ Same-target collisions (would overwrite if applied)"])
        for tgt, srcs in list(collisions.items())[:10]:
            md_lines.append(f"- `{tgt}` ← {len(srcs)} sources")
    if target_already_exists:
        md_lines.extend(["", "## ⚠ Targets that already exist (would fail to move)"])
        for tgt in target_already_exists[:10]:
            md_lines.append(f"- `{tgt}`")
    md_lines.extend([
        "",
        "## To apply this proposal",
        "",
        f"At v0.1, **applying is not built**. The applier handler is named",
        f"`downloads_apply_organize` and will be `MUMO_GO_REQUIRED` tier with",
        f"a reversible-journal discipline. Building it is a separate halt-gate.",
        "",
        f"When built, the exact-string consent phrase will be:",
        f"```",
        f"GO: organize downloads {mission_id}",
        f"```",
        "",
        "## Constitutional witness",
        "- proposal was generated read-only — zero files in the source directory were moved, modified, or deleted",
        "- proposal output was written only under the mission directory",
        "- target paths are boundary-validated to stay under analyze_root",
        "- no external network",
        "- no canon mutation",
    ])
    summary_md = output_dir / "propose_summary.md"
    summary_md.write_text("\n".join(md_lines), encoding="utf-8")

    # TTS-ready narration
    top_cats = ", ".join(f"{n} {cat}" for cat, n in by_category.most_common(3))
    summary_text = (
        f"I propose organizing {len(moves)} files into {len(by_category)} category subfolders. "
        f"The biggest groups: {top_cats}. "
        f"{len(skipped_root)} files would stay at the root because their type does not match a routing rule. "
        f"{len(collisions)} same-target name collisions detected. "
        f"This proposal is read-only at version one. "
        f"Applying it requires a separate operator typed go and a reversible-journal handler. "
        f"The applier handler is named, but not yet built. Nothing has been moved."
    )

    return {
        "passed": True,
        "outputs": [str(proposal_yaml), str(summary_md)],
        "evidence": [
            f"scanned {scanned} files in {scan_dt:.2f}s",
            f"proposed {len(moves)} moves across {len(by_category)} categories",
            f"top categories: {top_cats}",
            f"{len(skipped_root)} files skipped at root",
            f"{len(collisions)} same-target collisions detected",
            f"{len(target_already_exists)} target-already-exists conflicts detected",
            f"truncated: {truncated}",
            f"proposal yaml: {proposal_yaml}",
            f"propose summary md: {summary_md}",
            "read-only: zero files moved in analyze_root",
            f"applier handler 'downloads_apply_organize' deferred to v0.2 (MUMO_GO_REQUIRED tier)",
        ],
        "finding": None,
        "summary_text": summary_text,
        "proposal": proposal,
    }
