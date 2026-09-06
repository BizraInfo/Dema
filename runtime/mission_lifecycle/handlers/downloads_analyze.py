"""
downloads_analyze — RECEIPT_BOUND handler for Downloads folder analysis.

Read-only inventory + categorization of ~/Downloads (or any analyze_root arg).
Produces factual summary (file counts, sizes, types, age buckets, exact-name
duplicates) without moving or deleting anything. Output written under the
mission directory; original files never touched.

ARGS (in planned_act["args"]):
  analyze_root: str   - directory to analyze (default: ~/Downloads)
  max_files:    int   - cap on files scanned (default: 1000)

RETURNS:
  {
    "passed": True | False,
    "outputs": [<summary.md path written under mission dir>],
    "evidence": [<facts>],
    "finding": <str or None>,
    "summary_text": <plain-prose summary, suitable for TTS>,
    "stats": {file_count, total_bytes, by_extension, by_age, duplicates},
  }

CONSTITUTIONAL GROUND:
  - READ-ONLY. No file moves, no deletes, no modifications to analyze_root.
  - Writes ONLY under mission_dir/outputs/ (boundary-enforced by Mission Kernel).
  - No external network.
  - No canon mutation.
"""
from __future__ import annotations

import os
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


def _format_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} PB"


def _categorize(ext: str) -> str:
    ext = ext.lower().lstrip(".")
    if ext in ("md", "txt", "rst", "csv", "tsv", "log"):
        return "text"
    if ext in ("pdf",):
        return "pdf"
    if ext in ("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "heic"):
        return "image"
    if ext in ("mp4", "mov", "avi", "mkv", "webm", "flv", "m4v"):
        return "video"
    if ext in ("mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"):
        return "audio"
    if ext in ("zip", "tar", "gz", "bz2", "xz", "7z", "rar"):
        return "archive"
    if ext in ("py", "js", "ts", "rs", "go", "c", "cpp", "h", "java", "rb", "sh"):
        return "code"
    if ext in ("json", "yaml", "yml", "toml", "xml", "ini", "conf"):
        return "config"
    if ext in ("docx", "xlsx", "pptx", "doc", "xls", "ppt", "odt"):
        return "office"
    return "other"


def handle(planned_act: dict, capsule: dict, contract: dict) -> dict:
    args = planned_act.get("args", {}) or {}
    analyze_root = Path(os.path.expanduser(args.get("analyze_root", "~/Downloads")))
    max_files = int(args.get("max_files", 1000))

    if not analyze_root.exists():
        return {
            "passed": False, "outputs": [],
            "evidence": [f"analyze_root does not exist: {analyze_root}"],
            "finding": "analyze_root_not_found",
            "summary_text": None, "stats": None,
        }
    if not analyze_root.is_dir():
        return {
            "passed": False, "outputs": [],
            "evidence": [f"analyze_root is not a directory: {analyze_root}"],
            "finding": "analyze_root_not_directory",
            "summary_text": None, "stats": None,
        }

    t0 = time.time()
    files = []
    truncated = False
    for entry in analyze_root.iterdir():
        if not entry.is_file():
            continue
        if len(files) >= max_files:
            truncated = True
            break
        try:
            stat = entry.stat()
            files.append({
                "name": entry.name,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "ext": entry.suffix.lower(),
            })
        except OSError:
            continue
    scan_dt = time.time() - t0

    total_bytes = sum(f["size"] for f in files)
    by_ext = Counter(f["ext"] or "(none)" for f in files)
    by_category = Counter(_categorize(f["ext"]) for f in files)

    now = datetime.now(timezone.utc).timestamp()
    age_buckets = {"<7d": 0, "7-30d": 0, "30-90d": 0, ">90d": 0}
    for f in files:
        age_days = (now - f["mtime"]) / 86400
        if age_days < 7:
            age_buckets["<7d"] += 1
        elif age_days < 30:
            age_buckets["7-30d"] += 1
        elif age_days < 90:
            age_buckets["30-90d"] += 1
        else:
            age_buckets[">90d"] += 1

    # Detect duplicates by base-name (strip "(1)", "(2)", etc.)
    import re
    BASE_RE = re.compile(r"\s*\(\d+\)(?=\.\w+$|$)")
    name_groups = defaultdict(list)
    for f in files:
        base = BASE_RE.sub("", f["name"])
        name_groups[base].append(f["name"])
    duplicates = {base: names for base, names in name_groups.items() if len(names) > 1}

    # Largest files
    largest = sorted(files, key=lambda f: f["size"], reverse=True)[:5]

    # Build summary text suitable for TTS narration
    top_cats = ", ".join(f"{n} {cat}" for cat, n in by_category.most_common(3))
    summary_text = (
        f"I scanned {len(files)} files in {analyze_root.name}, totaling {_format_size(total_bytes)}. "
        f"By category: {top_cats}. "
        f"{age_buckets['<7d']} files are from the last week. "
        f"{len(duplicates)} apparent duplicate name pairs detected. "
        f"All analysis was read-only. No files were moved. "
        f"This act produced a receipt-bound mission capsule under contract."
    )

    # Write summary.md under mission dir
    mission_id = capsule["mission_id"]
    mission_dir = Path(os.path.expanduser("~/.dema/kernel/mission_lifecycle/missions")) / mission_id
    output_dir = mission_dir / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "downloads_summary.md"
    md_lines = [
        f"# Downloads Folder Analysis — {datetime.now(timezone.utc).isoformat()}",
        "",
        f"**Analyzed:** `{analyze_root}`",
        f"**Files scanned:** {len(files)}" + (" (truncated at max_files)" if truncated else ""),
        f"**Total size:** {_format_size(total_bytes)}",
        f"**Scan duration:** {scan_dt:.2f}s",
        "",
        "## By category",
    ]
    for cat, n in by_category.most_common():
        md_lines.append(f"- {cat}: {n}")
    md_lines.extend([
        "",
        "## By age",
        f"- <7 days: {age_buckets['<7d']}",
        f"- 7-30 days: {age_buckets['7-30d']}",
        f"- 30-90 days: {age_buckets['30-90d']}",
        f"- >90 days: {age_buckets['>90d']}",
        "",
        "## Top 5 largest files",
    ])
    for f in largest:
        md_lines.append(f"- {f['name']}: {_format_size(f['size'])}")
    md_lines.extend([
        "",
        f"## Apparent duplicate name pairs: {len(duplicates)}",
    ])
    for base, names in list(duplicates.items())[:10]:
        md_lines.append(f"- `{base}`: {len(names)} copies")
    md_lines.extend([
        "",
        "## Constitutional witness",
        "- analysis was read-only — no file in the source directory was moved, modified, or deleted",
        "- output written only under the mission directory (boundary-enforced)",
        "- no external network calls during scan",
        f"- receipt schema: bizra.dema.mission_act_handler.v0.1",
    ])
    summary_path.write_text("\n".join(md_lines), encoding="utf-8")

    return {
        "passed": True,
        "outputs": [str(summary_path)],
        "evidence": [
            f"scanned {len(files)} files in {scan_dt:.2f}s",
            f"total size: {_format_size(total_bytes)}",
            f"top categories: {top_cats}",
            f"{len(duplicates)} duplicate name pairs",
            f"truncated: {truncated}",
            f"summary md written to {summary_path}",
            "read-only: zero files moved or modified in analyze_root",
        ],
        "finding": None,
        "summary_text": summary_text,
        "stats": {
            "file_count": len(files),
            "total_bytes": total_bytes,
            "by_category": dict(by_category),
            "by_extension": dict(by_ext.most_common(20)),
            "age_buckets": age_buckets,
            "duplicate_count": len(duplicates),
            "duplicates": {k: v for k, v in list(duplicates.items())[:20]},
            "largest_5": [{"name": f["name"], "size": f["size"]} for f in largest],
            "scan_seconds": scan_dt,
            "truncated": truncated,
        },
    }
