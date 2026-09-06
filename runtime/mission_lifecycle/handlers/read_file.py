"""
read_file_inside_boundary — first real Mission Kernel handler.

ALWAYS-tier act. Reads a single file from disk, validates the path is inside
the agent's declared scope.inside_boundary, returns content as evidence.

ARGS (in planned_act["args"]):
  path: str          - absolute or ~-expanded path to the file to read
  max_bytes: int     - optional, default 65536; truncate at this size

RETURNS:
  {
    "passed": True | False,
    "outputs": [str(path_read)],
    "evidence": [<facts>],
    "finding": <str or None>,
    "content_excerpt": <first N chars or None>,    # included for receipt visibility
  }

CONSTITUTIONAL GROUND:
  - This handler may NOT write any file.
  - This handler may NOT call any external network.
  - This handler MUST validate path is under agent's scope.inside_boundary
    (cross-checked against the agent contract loaded by the kernel).
  - On any path outside boundary: passed=False, finding="path_outside_boundary".
"""
from __future__ import annotations

import os
from fnmatch import fnmatch
from pathlib import Path

DEFAULT_MAX_BYTES = 65536


def _expand(path: str) -> Path:
    """Expand ~ and resolve to absolute Path."""
    return Path(os.path.expanduser(path)).resolve()


def _path_in_scope(path: Path, scope_patterns: list) -> bool:
    """Check if `path` matches any pattern in `scope_patterns`.

    Patterns may use ** glob (e.g. `~/.dema/**`). Path is already expanded.
    """
    s = str(path)
    for pat in scope_patterns:
        expanded_pat = os.path.expanduser(pat)
        # Translate ** → fnmatch * (close enough for inside-boundary check)
        flat_pat = expanded_pat.replace("**", "*")
        if fnmatch(s, flat_pat):
            return True
        # Also check prefix-match for directory patterns ending with /**
        if expanded_pat.endswith("/**") and s.startswith(expanded_pat[:-3] + "/"):
            return True
        if expanded_pat.endswith("/**") and s == expanded_pat[:-3]:
            return True
    return False


def handle(planned_act: dict, capsule: dict, contract: dict) -> dict:
    args = planned_act.get("args", {}) or {}
    raw_path = args.get("path")
    max_bytes = int(args.get("max_bytes", DEFAULT_MAX_BYTES))

    if not raw_path:
        return {
            "passed": False,
            "outputs": [],
            "evidence": ["handler invoked without 'path' arg"],
            "finding": "missing_path_arg",
            "content_excerpt": None,
        }

    target = _expand(raw_path)

    # Validate against agent's scope.inside_boundary
    capability = contract.get("capability", {})
    scope_in = capability.get("scope", {}).get("inside_boundary", [])
    if not _path_in_scope(target, scope_in):
        return {
            "passed": False,
            "outputs": [],
            "evidence": [
                f"requested path: {target}",
                f"agent scope.inside_boundary: {scope_in}",
            ],
            "finding": "path_outside_boundary",
            "content_excerpt": None,
        }

    if not target.exists():
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"path inside boundary but does not exist: {target}"],
            "finding": "path_not_found",
            "content_excerpt": None,
        }

    if not target.is_file():
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"path inside boundary but is not a regular file: {target}"],
            "finding": "path_not_regular_file",
            "content_excerpt": None,
        }

    try:
        with open(target, "rb") as f:
            raw = f.read(max_bytes)
        content = raw.decode("utf-8", errors="replace")
        truncated = target.stat().st_size > max_bytes
    except OSError as e:
        return {
            "passed": False,
            "outputs": [],
            "evidence": [f"read failed: {type(e).__name__}: {e}"],
            "finding": "read_error",
            "content_excerpt": None,
        }

    return {
        "passed": True,
        "outputs": [str(target)],
        "evidence": [
            f"path resolved: {target}",
            f"path validated against agent scope.inside_boundary",
            f"file size: {target.stat().st_size} bytes",
            f"truncated: {truncated}",
            f"max_bytes: {max_bytes}",
        ],
        "finding": None,
        "content_excerpt": content[:500] if content else None,
    }
