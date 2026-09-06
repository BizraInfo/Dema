#!/usr/bin/env python3
"""Stage only the manifest-declared vulnerable mission-kernel baseline."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import sys


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def contained(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    parser.add_argument("--manifest", type=Path, default=Path(__file__).resolve().parents[1] / "runtime/mission_lifecycle/lineage-manifest.json")
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_root = manifest_path.parent
    destination = Path(args.destination).resolve()
    runtime_root = Path.home() / ".dema"
    if contained(destination, runtime_root):
        raise SystemExit("REFUSED_RUNTIME_DESTINATION")
    if destination.exists():
        raise SystemExit("REFUSED_NONFRESH_DESTINATION")
    staged = []
    for artifact in manifest["artifacts"]:
        source = source_root / artifact["source_relative_path"]
        if source.is_symlink() or not source.is_file():
            raise SystemExit(f"REFUSED_SOURCE_TYPE:{artifact['source_relative_path']}")
        if sha256(source) != artifact["sha256"]:
            raise SystemExit(f"SOURCE_HASH_MISMATCH:{artifact['source_relative_path']}")
        target = destination / artifact["stage_relative_path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        os.chmod(target, int(artifact["mode_octal"], 8))
        if sha256(target) != artifact["sha256"]:
            raise SystemExit(f"DESTINATION_HASH_MISMATCH:{artifact['stage_relative_path']}")
        staged.append({"path": artifact["stage_relative_path"], "sha256": artifact["sha256"], "mode_octal": artifact["mode_octal"]})
    print(json.dumps({"schema":"bizra.node0.mission_kernel_stage.v1","destination":str(destination),"staged":staged},sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
