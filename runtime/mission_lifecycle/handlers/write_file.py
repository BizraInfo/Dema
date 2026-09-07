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
  - It MUST traverse directories without following symlinks and exclusively
    create the leaf relative to the opened parent; unsupported platforms refuse.
  - It MUST refuse overwrites — one-shot per act. If the target exists:
    passed=False, finding="target_already_exists".
  - It MUST NOT contact external services, mutate canon, or touch Node1.
  - The kernel's mint_act_handler_receipt mints the receipt regardless of
    outcome, so the receipt-bound invariant holds whether the write
    succeeds or fails.
"""
from __future__ import annotations

import os
from contextlib import ExitStack
from pathlib import Path

DEFAULT_MAX_BYTES = 1024 * 1024  # 1 MB

# Resolve once at import time. Same-process tests using a temp DEMA_HOME would
# need to re-import; v0.1 single-DEMA_HOME-per-process is acceptable.
DEMA_HOME = Path(os.environ.get("DEMA_HOME") or (Path.home() / ".dema"))
MISSIONS_ROOT = DEMA_HOME / "kernel" / "mission_lifecycle" / "missions"


def _fd_is_contained(fd: int, mission_resolved: Path) -> bool:
    try:
        current = Path(os.readlink(f"/proc/self/fd/{fd}"))
    except OSError:
        return False
    return (current.is_absolute()
            and current.is_relative_to(mission_resolved)
            and not str(current).endswith(" (deleted)"))


def _remediate_created_leaf(fd: int, parent_fd: int, leaf_name: str,
                            metadata: list[str]) -> None:
    try:
        leaf = os.stat(leaf_name, dir_fd=parent_fd, follow_symlinks=False)
        opened = os.fstat(fd)
        if (leaf.st_dev, leaf.st_ino) != (opened.st_dev, opened.st_ino):
            raise OSError("leaf replaced; refusing to unlink another object")
        os.unlink(leaf_name, dir_fd=parent_fd)
        os.fsync(parent_fd)
        try:
            os.stat(leaf_name, dir_fd=parent_fd, follow_symlinks=False)
        except FileNotFoundError:
            metadata.append("remediation verified: written leaf absent via held directory")
        else:
            metadata.append("remediation residual: leaf present after unlink")
    except OSError as e:
        metadata.append(f"remediation residual: {type(e).__name__}: {e}")


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

    # Descriptor-relative traversal rejects symlinks at each open, rather than
    # checking a pathname and later following a substituted entry. Pre-write
    # checks refuse a moved held directory before content is written; completion
    # checks still remediate a later move. No namespace isolation, openat2, or
    # crash-durability claim is made.
    if (not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY")
            or os.open not in os.supports_dir_fd
            or os.mkdir not in os.supports_dir_fd
            or os.unlink not in os.supports_dir_fd
            or not Path("/proc/self/fd").is_dir()):
        return {
            "passed": False, "outputs": [],
            "evidence": ["descriptor-relative no-symlink creation unavailable"],
            "finding": "safe_creation_unavailable", "content_excerpt": None,
        }

    final_target = target.absolute()
    mission_resolved = mission_dir.absolute()
    metadata = []
    target_created = False
    try:
        data = content.encode("utf-8")
        if len(data) > max_bytes:
            return {
                "passed": False, "outputs": [],
                "evidence": [f"content {len(data)} bytes exceeds max_bytes {max_bytes}"],
                "finding": "content_exceeds_max_bytes", "content_excerpt": None,
            }
        # Mission identity is supplied by the kernel, but never let it escape
        # the configured root when this shared handler is invoked directly.
        if (not isinstance(mission_id, str) or not mission_id
                or Path(mission_id).parts != (mission_id,)
                or mission_id in (".", "..")):
            raise ValueError("invalid mission_id")
        parts = Path(relative_path).parts
        if not parts or "\x00" in relative_path:
            raise ValueError("invalid relative_path")
        directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        with ExitStack() as stack:
            parent_fd = os.open(mission_resolved.anchor, directory_flags)
            stack.callback(os.close, parent_fd)
            # Existing mission ancestry must already exist and contain no links.
            for part in mission_resolved.parts[1:]:
                parent_fd = os.open(part, directory_flags, dir_fd=parent_fd)
                stack.callback(os.close, parent_fd)
            if not _fd_is_contained(parent_fd, mission_resolved):
                metadata.append("pre-write containment failed; mission ancestry moved or unavailable")
                return {
                    "passed": False, "outputs": [], "evidence": metadata,
                    "finding": "path_moved_before_write", "content_excerpt": None,
                }
            for part in parts[:-1]:
                try:
                    os.mkdir(part, mode=0o700, dir_fd=parent_fd)
                    metadata.append(f"directory created under mission: {part}")
                except FileExistsError:
                    pass
                parent_fd = os.open(part, directory_flags, dir_fd=parent_fd)
                stack.callback(os.close, parent_fd)
                if not _fd_is_contained(parent_fd, mission_resolved):
                    metadata.append("pre-write containment failed; parent moved or unavailable")
                    return {
                        "passed": False, "outputs": [], "evidence": metadata,
                        "finding": "path_moved_before_write", "content_excerpt": None,
                    }
            fd = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL
                         | os.O_NOFOLLOW, 0o600, dir_fd=parent_fd)
            target_created = True
            stack.callback(os.close, fd)
            if not _fd_is_contained(parent_fd, mission_resolved):
                metadata.append("pre-write containment failed; parent moved or unavailable")
                metadata.append("created leaf discarded before content write")
                _remediate_created_leaf(fd, parent_fd, parts[-1], metadata)
                return {
                    "passed": False, "outputs": [], "evidence": metadata,
                    "finding": "path_moved_before_write", "content_excerpt": None,
                }
            remaining = memoryview(data)
            while remaining:
                # ponytail: closes observed reparent seams; a rename between
                # this check and os.write still needs namespace isolation.
                if not _fd_is_contained(parent_fd, mission_resolved):
                    metadata.append("pre-write containment failed; parent moved or unavailable")
                    metadata.append("created leaf discarded before content write")
                    _remediate_created_leaf(fd, parent_fd, parts[-1], metadata)
                    return {
                        "passed": False, "outputs": [], "evidence": metadata,
                        "finding": "path_moved_before_write", "content_excerpt": None,
                    }
                written = os.write(fd, remaining)
                if written <= 0:
                    raise OSError("write made no progress")
                remaining = remaining[written:]
            os.fsync(fd)
            # OPERATOR RULING (W-06): completion-time detection and remediation.
            # Bind to the original mission pathname, not a relocated root fd.
            if not _fd_is_contained(parent_fd, mission_resolved):
                metadata.append("completion containment failed; parent moved or unavailable")
                metadata.append("requested output transiently created; remediation required")
                _remediate_created_leaf(fd, parent_fd, parts[-1], metadata)
                return {
                    "passed": False, "outputs": [], "evidence": metadata,
                    "finding": "completion_path_moved_or_unverifiable",
                    "content_excerpt": None,
                }
        bytes_written = len(data)
    except (OSError, UnicodeError, ValueError) as e:
        return {
            "passed": False,
            "outputs": [],
            "evidence": metadata + [
                f"write failed: {type(e).__name__}: {e}",
                f"requested output created: {target_created}; may be partial" if target_created
                else "requested output not created",
            ],
            "finding": "target_already_exists" if isinstance(e, FileExistsError) else "write_error",
            "content_excerpt": None,
        }

    return {
        "passed": True,
        "outputs": [str(final_target)],
        "evidence": metadata + [
            f"target requested: {final_target}",
            f"descriptor-relative creation under mission dir {mission_resolved}; no symlinks",
            f"bytes written: {bytes_written}",
            f"max_bytes: {max_bytes}",
            "exclusive creation; existing leaf refused atomically",
        ],
        "finding": None,
        "content_excerpt": content[:200] if content else None,
    }
