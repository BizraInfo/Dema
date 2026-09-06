"""
write_under_mission_directory — first RECEIPT_BOUND-tier handler.

Writes a single file under the mission's lifecycle directory only.
One-shot writes (refuses overwrites — operator must use a new mission to
re-write). This is the simplest tier-2 act: side-effecting, receipt-bound,
boundary-enforced.

ARGS (in planned_act["args"]):
  relative_path: str   - path under <mission_dir>/, e.g. "outputs/result.txt"
                         no leading slash, no "..", no symlink escape allowed
  content:       str   - the bytes to write (utf-8)
  max_bytes:     int   - optional, default 1048576 (1 MB); content over fails

RETURNS:
  {
    "passed": True | False,
    "outputs": [<absolute path written>],
    "evidence": [<facts>],
    "finding": <str or None>,
    "content_excerpt": <first N chars of what was written>,
  }

CONSTITUTIONAL GROUND:
  - This handler MAY write — that's the whole point of tier-2.
  - It MUST validate path resolution (after symlink resolve) is under the
    mission directory. Anything else: passed=False, finding="path_escapes_*".
  - It MUST refuse overwrites — one-shot per act. If the target exists:
    passed=False, finding="target_already_exists".
  - It MUST NOT contact external services, mutate canon, or touch Node1.
  - The kernel's mint_act_handler_receipt mints the receipt regardless of
    outcome, so the receipt-bound invariant holds whether the write
    succeeds or fails.
"""
from __future__ import annotations

import os
from pathlib import Path

DEFAULT_MAX_BYTES = 1024 * 1024  # 1 MB

# Resolve once at import time. Same-process tests using a temp DEMA_HOME would
# need to re-import; v0.1 single-DEMA_HOME-per-process is acceptable.
DEMA_HOME = Path(os.environ.get("DEMA_HOME") or (Path.home() / ".dema"))
MISSIONS_ROOT = DEMA_HOME / "kernel" / "mission_lifecycle" / "missions"


def handle(planned_act: dict, capsule: dict, contract: dict) -> dict:
    args = planned_act.get("args", {}) or {}
    relative_path = args.get("relative_path")
    content = args.get("content")
    max_bytes = int(args.get("max_bytes", DEFAULT_MAX_BYTES))

    if not relative_path:
        return {
            "passed": False,
            "outputs": [],
            "evidence": ["handler invoked without 'relative_path' arg"],
            "finding": "missing_relative_path_arg",
            "content_excerpt": None,
        }
    if content is None:
        return {
            "passed": False,
            "outputs": [],
            "evidence": ["handler invoked without 'content' arg"],
            "finding": "missing_content_arg",
            "content_excerpt": None,
        }

    # Reject obvious escape attempts before resolving
    if relative_path.startswith("/") or relative_path.startswith("~"):
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"relative_path must be under mission dir, got: {relative_path!r}"],
            "finding": "path_escapes_mission_directory",
            "content_excerpt": None,
        }
    if ".." in Path(relative_path).parts:
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"relative_path contains '..' segment: {relative_path!r}"],
            "finding": "path_escapes_mission_directory",
            "content_excerpt": None,
        }

    if len(content) > max_bytes:
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"content {len(content)} bytes exceeds max_bytes {max_bytes}"],
            "finding": "content_exceeds_max_bytes",
            "content_excerpt": None,
        }

    mission_id = capsule["mission_id"]
    mission_dir = MISSIONS_ROOT / mission_id
    target = mission_dir / relative_path

    # Symlink-aware boundary check: resolve both, ensure target is under mission_dir.
    # Must NOT resolve target itself (it doesn't exist yet) — resolve its parent.
    try:
        target_parent_resolved = target.parent.resolve()
        mission_resolved = mission_dir.resolve()
    except (OSError, RuntimeError) as e:
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"path resolution failed: {type(e).__name__}: {e}"],
            "finding": "path_resolution_error",
            "content_excerpt": None,
        }

    if (target_parent_resolved != mission_resolved
            and not str(target_parent_resolved).startswith(str(mission_resolved) + os.sep)):
        return {
            "passed": False,
            "outputs": [],
            "evidence": [
                f"resolved parent {target_parent_resolved} not under mission dir {mission_resolved}",
                "symlink escape blocked",
            ],
            "finding": "path_escapes_mission_directory_after_resolve",
            "content_excerpt": None,
        }

    # Refuse overwrite — one-shot writes per act
    final_target = target_parent_resolved / target.name
    if final_target.exists():
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"target already exists: {final_target}"],
            "finding": "target_already_exists",
            "content_excerpt": None,
        }

    try:
        final_target.parent.mkdir(parents=True, exist_ok=True)
        final_target.write_text(content, encoding="utf-8")
        bytes_written = len(content.encode("utf-8"))
    except (OSError, UnicodeError) as e:
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"write failed: {type(e).__name__}: {e}"],
            "finding": "write_error",
            "content_excerpt": None,
        }

    return {
        "passed": True,
        "outputs": [str(final_target)],
        "evidence": [
            f"target resolved: {final_target}",
            f"path validated under mission dir {mission_resolved} (symlink-aware)",
            f"bytes written: {bytes_written}",
            f"max_bytes: {max_bytes}",
            "no overwrite (target did not exist before write)",
        ],
        "finding": None,
        "content_excerpt": content[:200] if content else None,
    }
