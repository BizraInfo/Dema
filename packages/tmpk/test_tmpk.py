"""TMPK acceptance tests — must be executed; output is evidence."""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from tmpk import (
    FateLease,
    LeaseConsumed,
    MUMU_IDEAL,
    OutOfEnvelope,
    TruthSpine,
    build_mumu_mission,
)


@pytest.fixture
def workdir(tmp_path: Path) -> Path:
    return tmp_path


def test_happy_path_reaches_terminal(workdir: Path) -> None:
    k = build_mumu_mission(workdir)
    result = k.run()
    assert result.startswith("TERMINAL_DONE"), result
    assert (workdir / MUMU_IDEAL["terminal_receipt"]).exists()
    assert k._gap() == 0
    ok, _ = k.spine.verify_chain()
    assert ok


def test_outward_blocker_emits_exactly_one(workdir: Path) -> None:
    k = build_mumu_mission(workdir, inject_outward=True)
    result = k.run()
    assert result.startswith("BLOCKED_FOR_HUMAN"), result
    assert k.blocks_emitted == 1
    lines = k.spine.path.read_text(encoding="utf-8").splitlines()
    blocks = [
        json.loads(line)
        for line in lines
        if json.loads(line).get("type") == "BLOCKED_FOR_HUMAN"
    ]
    assert len(blocks) == 1


def test_chain_tamper_is_detected(workdir: Path) -> None:
    k = build_mumu_mission(workdir)
    k.run()
    lines = k.spine.path.read_text(encoding="utf-8").splitlines()
    # File uses default json.dumps spacing (": "); hash uses compact form.
    found = False
    new_lines = []
    for line in lines:
        if '"transition": "mkdir_workspace"' in line:
            line = line.replace(
                '"transition": "mkdir_workspace"',
                '"transition": "mkdir_workspace_TAMPERED"',
            )
            found = True
        new_lines.append(line)
    assert found, "expected mkdir_workspace transition line in chain"
    k.spine.path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    ok, broken = TruthSpine(k.spine.path).verify_chain()
    assert not ok
    assert broken is not None


def test_lease_is_single_use() -> None:
    lease = FateLease("L1", "p", "write", time.monotonic() + 10)
    lease.authorize("p", "write")
    with pytest.raises(LeaseConsumed):
        lease.authorize("p", "write")


def test_lease_is_path_confined() -> None:
    lease = FateLease("L1", "p", "write", time.monotonic() + 10)
    with pytest.raises(OutOfEnvelope):
        lease.authorize("/etc/passwd", "write")
