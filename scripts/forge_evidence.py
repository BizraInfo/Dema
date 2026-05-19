#!/usr/bin/env python3
"""Append a Proof Forge receipt from a verification report.

This script writes only Proof Forge local evidence under .proof-forge/ and does
not mint agent-chain capability receipts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def canonical_hash(obj: dict) -> str:
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def git(project_dir: Path, args: list[str]) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=project_dir, text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError, PermissionError, subprocess.SubprocessError):
        return ""


def load_index(project_dir: Path) -> dict:
    index_path = project_dir / ".proof-forge" / "EVIDENCE_INDEX.json"
    if not index_path.exists():
        return {
            "schema": "bizra.proof-forge.index.v0.1",
            "project": "",
            "genesis_receipt": None,
            "latest_receipt": None,
            "chain_length": 0,
            "receipts": [],
        }
    return json.loads(index_path.read_text(encoding="utf-8"))


def latest_entry(index: dict, receipts_dir: Path) -> dict | None:
    latest_id = index.get("latest_receipt")
    entries = index.get("receipts", [])
    if latest_id:
        for entry in entries:
            if entry.get("id") == latest_id:
                return entry
    if entries:
        return entries[-1]
    files = sorted(receipts_dir.glob("*.json"))
    if not files:
        return None
    receipt = json.loads(files[-1].read_text(encoding="utf-8"))
    return {
        "id": receipt.get("receipt_id"),
        "evidence_hash": receipt.get("chain", {}).get("evidence_hash"),
        "path": f"receipts/{files[-1].name}",
    }


def make_receipt_id(receipts_dir: Path) -> str:
    base = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    candidate = base
    suffix = 1
    while (receipts_dir / f"{candidate}.json").exists():
        suffix += 1
        candidate = f"{base}_{suffix}"
    return candidate


def confidence_label(report: dict) -> dict:
    commands = report.get("commands", [])
    if commands and report.get("all_passed"):
        if len(commands) >= 3:
            return {"level": 5, "label": "Ironclad"}
        return {"level": 4, "label": "Strong"}
    if commands:
        return {"level": 1, "label": "Logged"}
    return {"level": 2, "label": "Attested"}


def verify_chain(project_dir: Path) -> int:
    index = load_index(project_dir)
    errors: list[str] = []
    warnings: list[str] = []
    previous = None
    for entry in index.get("receipts", []):
        path = project_dir / ".proof-forge" / entry.get("path", "")
        if not path.exists():
            errors.append(f"missing receipt: {path}")
            continue
        receipt = json.loads(path.read_text(encoding="utf-8"))
        chain = receipt.get("chain", {})
        expected_previous = chain.get("previous_hash")
        if expected_previous != previous:
            errors.append(
                f"{entry.get('id')}: previous_hash mismatch expected {previous!r} got {expected_previous!r}"
            )
        without_hash = json.loads(json.dumps(receipt))
        without_hash["chain"].pop("evidence_hash", None)
        actual_hash = canonical_hash(without_hash)
        if chain.get("evidence_hash") != actual_hash:
            if receipt.get("forge_tool") == "scripts/forge_evidence.py":
                errors.append(f"{entry.get('id')}: evidence_hash does not recompute")
            else:
                warnings.append(f"{entry.get('id')}: legacy evidence_hash shape not recomputed")
        previous = chain.get("evidence_hash")
    if errors:
        print(json.dumps({"ok": False, "errors": errors, "warnings": warnings}, indent=2))
        return 1
    print(json.dumps({
        "ok": True,
        "receipt_count": len(index.get("receipts", [])),
        "warnings": warnings,
    }, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-dir", required=True)
    parser.add_argument("--description")
    parser.add_argument("--verification-report")
    parser.add_argument("--anchor-type", default="proof_forge_evidence")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    project_dir = Path(args.project_dir).expanduser().resolve()
    if not project_dir.is_dir():
        raise SystemExit(f"project directory does not exist: {project_dir}")
    if args.verify:
        return verify_chain(project_dir)
    if not args.description or not args.verification_report:
        raise SystemExit("--description and --verification-report are required unless --verify is used")

    report_path = Path(args.verification_report).expanduser().resolve()
    if not report_path.is_file():
        raise SystemExit(f"verification report does not exist: {report_path}")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("schema") != "bizra.proof-forge.verification_report.v0.1":
        raise SystemExit("verification report schema is not bizra.proof-forge.verification_report.v0.1")
    proof_dir = project_dir / ".proof-forge"
    receipts_dir = proof_dir / "receipts"
    receipts_dir.mkdir(parents=True, exist_ok=True)
    index = load_index(project_dir)
    previous = latest_entry(index, receipts_dir)
    previous_hash = previous.get("evidence_hash") if previous else None
    position = int(index.get("chain_length") or len(index.get("receipts", []))) + 1
    receipt_id = make_receipt_id(receipts_dir)
    confidence = confidence_label(report)

    receipt = {
        "schema": "bizra.proof-forge.receipt.v0.1",
        "forge_tool": "scripts/forge_evidence.py",
        "forge_tool_version": "0.1",
        "receipt_id": receipt_id,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "anchor_type": args.anchor_type,
        "description": args.description,
        "project": {
            "repo": index.get("project") or git(project_dir, ["config", "--get", "remote.origin.url"]),
            "path": str(project_dir),
            "branch": git(project_dir, ["rev-parse", "--abbrev-ref", "HEAD"]),
            "commit": git(project_dir, ["rev-parse", "HEAD"]),
            "commit_subject": git(project_dir, ["log", "-1", "--pretty=%s"]),
            "dirty": bool(git(project_dir, ["status", "--short"])),
        },
        "artifacts": report.get("artifacts", []),
        "verification_report": report,
        "chain": {"previous_hash": previous_hash, "position": position},
        "confidence": {
            **confidence,
            "rationale": "Proof Forge local evidence appended from artifact hashes and verification report. This receipt does not mint an agent-chain capability.",
        },
        "notes": [
            "Proof-forge-only receipt; no agent-chain capability receipt minted by this script.",
            "Existing receipt bytes are not modified.",
        ],
    }
    without_hash = json.loads(json.dumps(receipt))
    receipt["chain"]["evidence_hash"] = canonical_hash(without_hash)

    receipt_path = receipts_dir / f"{receipt_id}.json"
    receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False), encoding="utf-8")

    entry = {
        "id": receipt_id,
        "timestamp_utc": receipt["timestamp_utc"],
        "description": args.description,
        "commit": receipt["project"]["commit"][:7],
        "evidence_hash": receipt["chain"]["evidence_hash"],
        "previous_hash": previous_hash,
        "confidence": confidence["label"],
        "all_passed": bool(report.get("all_passed")),
        "path": f"receipts/{receipt_id}.json",
        "anchor_type": args.anchor_type,
    }
    index.setdefault("receipts", []).append(entry)
    if not index.get("genesis_receipt"):
        index["genesis_receipt"] = receipt_id
    index["latest_receipt"] = receipt_id
    index["chain_length"] = position
    (proof_dir / "EVIDENCE_INDEX.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps({
        "receipt": str(receipt_path),
        "receipt_id": receipt_id,
        "position": position,
        "evidence_hash": receipt["chain"]["evidence_hash"],
        "previous_hash": previous_hash,
        "confidence": confidence["label"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
