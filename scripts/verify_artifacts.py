#!/usr/bin/env python3
"""Collect artifact metadata and command evidence for Proof Forge.

This script is read-only with respect to project artifacts. It may write only the
verification report requested by --output.

Commands are tokenized with shlex and executed without a shell. Shell operators
such as ;, &&, |, and redirects are treated as arguments, not control flow.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shlex
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def classify(path: Path) -> str:
    suffix = path.suffix.lower()
    name = path.name.lower()
    if suffix in {".py", ".js", ".mjs", ".ts", ".tsx", ".go", ".rs"}:
        return "code"
    if "test" in name or "spec" in name:
        return "test"
    if suffix in {".md", ".txt", ".rst"}:
        return "doc"
    if suffix in {".json", ".yaml", ".yml", ".toml"}:
        return "data"
    return "binary"


def display_path(path: Path, project_dir: Path) -> str:
    try:
        return str(path.resolve().relative_to(project_dir.resolve()))
    except ValueError:
        home = Path.home()
        text = str(path.resolve())
        return text.replace(str(home), "~", 1)


def redact_local_paths(value: str, project_dir: Path) -> str:
    text = value.replace(str(project_dir.resolve()), "<project>")
    return text.replace(str(Path.home()), "~")


def artifact_record(path: Path, project_dir: Path) -> dict:
    stat = path.stat()
    return {
        "path": display_path(path, project_dir),
        "type": classify(path),
        "size_bytes": stat.st_size,
        "mtime_utc": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "sha256": sha256_file(path),
    }


def run_command(command: str, cwd: Path, timeout: int) -> dict:
    started = time.perf_counter()
    try:
        argv = shlex.split(command)
    except ValueError as exc:
        duration = time.perf_counter() - started
        return {
            "command": redact_local_paths(command, cwd),
            "argv": [],
            "cwd": ".",
            "exit_code": None,
            "duration_seconds": round(duration, 3),
            "stdout": "",
            "stderr": f"command parse failed: {exc}",
            "passed": False,
        }
    if not argv:
        duration = time.perf_counter() - started
        return {
            "command": command,
            "argv": [],
            "cwd": ".",
            "exit_code": None,
            "duration_seconds": round(duration, 3),
            "stdout": "",
            "stderr": "empty command",
            "passed": False,
        }
    try:
        proc = subprocess.run(
            argv,
            cwd=cwd,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        stdout = proc.stdout
        stderr = proc.stderr
        exit_code = proc.returncode
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or ""
        stderr = (exc.stderr or "") + f"\ncommand timed out after {timeout}s"
        exit_code = None
    except (FileNotFoundError, PermissionError, subprocess.SubprocessError) as exc:
        stdout = ""
        stderr = f"{type(exc).__name__}: {exc}"
        exit_code = None
    duration = time.perf_counter() - started
    return {
        "command": redact_local_paths(command, cwd),
        "argv": [redact_local_paths(part, cwd) for part in argv],
        "cwd": ".",
        "exit_code": exit_code,
        "duration_seconds": round(duration, 3),
        "stdout": redact_local_paths(stdout, cwd),
        "stderr": redact_local_paths(stderr, cwd),
        "passed": exit_code == 0,
    }


def discover_default_commands(project_dir: Path) -> list[str]:
    commands: list[str] = []
    package_json = project_dir / "package.json"
    if package_json.exists():
        package = json.loads(package_json.read_text(encoding="utf-8"))
        scripts = package.get("scripts", {})
        if "test" in scripts:
            commands.append("npm test")
        if "check" in scripts:
            commands.append("npm run check")
    return commands


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-dir", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--artifact", action="append", default=[])
    parser.add_argument(
        "--command",
        action="append",
        default=[],
        help="Command to run without a shell; quote arguments, but do not use shell chaining.",
    )
    parser.add_argument("--output", required=True)
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    project_dir = Path(args.project_dir).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    artifacts = [Path(item).expanduser().resolve() for item in args.artifact]
    missing = [str(path) for path in artifacts if not path.exists()]
    if missing:
        raise SystemExit(f"missing artifact(s): {missing}")

    commands = args.command or discover_default_commands(project_dir)
    artifact_records = [artifact_record(path, project_dir) for path in artifacts]
    command_results = [run_command(command, project_dir, args.timeout) for command in commands]
    all_passed = all(result["passed"] for result in command_results) if command_results else False

    report = {
        "schema": "bizra.proof-forge.verification_report.v0.1",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "description": args.description,
        "project_dir": ".",
        "artifacts": artifact_records,
        "commands": command_results,
        "verification_type": "automated" if command_results else "artifact_hash_only",
        "all_passed": all_passed,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "output": display_path(output, project_dir),
        "artifact_count": len(artifact_records),
        "command_count": len(command_results),
        "all_passed": all_passed,
    }, indent=2))
    return 0 if all_passed or not command_results else 1


if __name__ == "__main__":
    raise SystemExit(main())
