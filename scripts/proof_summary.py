#!/usr/bin/env python3
"""Generate a concise Markdown summary for a Proof Forge receipt."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def short(value: str | None) -> str:
    if not value:
        return "GENESIS"
    return value[:12]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--project-dir", required=True)
    args = parser.parse_args()

    project_dir = Path(args.project_dir).expanduser().resolve()
    receipt_path = Path(args.receipt).expanduser().resolve()
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    report = receipt.get("verification_report", {})
    commands = report.get("commands", [])

    command_rows = []
    for command in commands:
        result = "PASS" if command.get("passed") else "FAIL"
        command_rows.append(
            f"| `{command.get('command')}` | {result} | {command.get('duration_seconds')}s |"
        )
    if not command_rows:
        command_rows.append("| Manual/artifact hash evidence | LOGGED | n/a |")

    lines = [
        "# Proof Summary — Latest",
        "",
        f"**Receipt:** `{receipt.get('receipt_id')}` · **Chain position:** {receipt.get('chain', {}).get('position')} · **Confidence:** {receipt.get('confidence', {}).get('label')}",
        f"**Anchor type:** `{receipt.get('anchor_type')}`",
        f"**Previous:** `{short(receipt.get('chain', {}).get('previous_hash'))}`",
        f"**Chain head:** `{receipt.get('chain', {}).get('evidence_hash')}`",
        "",
        "---",
        "",
        "## What was anchored",
        "",
        receipt.get("description", ""),
        "",
        "This is a Proof Forge local-evidence receipt. It does not claim an agent-chain capability mint.",
        "",
        "## Verification",
        "",
        "| Check | Result | Duration |",
        "|---|---:|---:|",
        *command_rows,
        "",
        "## Artifacts",
        "",
        "| Path | Type | SHA-256 |",
        "|---|---|---|",
    ]
    for artifact in receipt.get("artifacts", []):
        lines.append(
            f"| `{artifact.get('path')}` | {artifact.get('type')} | `{artifact.get('sha256')}` |"
        )
    lines.extend([
        "",
        "## Evidence chain",
        "",
        f"- Previous hash: `{receipt.get('chain', {}).get('previous_hash')}`",
        f"- Evidence hash: `{receipt.get('chain', {}).get('evidence_hash')}`",
        f"- Receipt path: `{receipt_path.relative_to(project_dir) if receipt_path.is_relative_to(project_dir) else receipt_path}`",
        "",
        "## Boundary",
        "",
        "- Existing receipt bytes were not modified.",
        "- No commit or push is implied by this local evidence.",
        "- No runtime, federation, token, or economic claim is made.",
        "",
    ])
    text = "\n".join(lines)
    summaries_dir = project_dir / ".proof-forge" / "summaries"
    summaries_dir.mkdir(parents=True, exist_ok=True)
    summary_path = summaries_dir / f"{receipt.get('receipt_id')}.md"
    summary_path.write_text(text, encoding="utf-8")
    latest_path = project_dir / "PROOF_SUMMARY.md"
    latest_path.write_text(text, encoding="utf-8")
    print(json.dumps({"summary": str(summary_path), "latest": str(latest_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
