"""
tmpk.py — Thin Mission Progress Kernel (TMPK) · CONDUCTOR-WELD-0A.

Constitution:
    The human provides intent, judgment, and sovereign consent;
    the runtime owns control flow.

DEMA-FDE contract:
    - inward failures may be repaired under bounded lease
    - outward failures must be diagnosed, not repaired
    - missing consent stops action
    - simulated impact cannot mint
    - unavailable infrastructure is never disguised as code failure
    - every state transition is sealed in the Truth Spine

Truth label: TMPK_PREVIEW_ONLY (Python-object FATE; not OS-enforced).
authority_delta = 0. Does not claim NODE0_CLOSED, RSI-live, or singularity.

This file is written to be RUN, not to be believed.
Run:  python3 tmpk.py --workdir /tmp/bizra_weld
Test: python3 -m pytest test_tmpk.py -v
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional


# ---------- Exceptions ----------

class LeaseDenied(Exception):
    """Base for all lease-authority failures."""


class LeaseConsumed(LeaseDenied):
    ...


class LeaseExpired(LeaseDenied):
    ...


class OutOfEnvelope(LeaseDenied):
    ...


class PreconditionFailed(Exception):
    ...


class PostconditionFailed(Exception):
    ...


# ---------- FATE Lease ----------

@dataclass
class FateLease:
    """Single-use, path-confined, time-bounded capability (Python-level only)."""

    lease_id: str
    path: str
    op: str  # "read" | "write" | "mkdir" | "seal"
    expires_at: float
    consumed: bool = False

    def authorize(self, path: str, op: str) -> None:
        if self.consumed:
            raise LeaseConsumed(f"{self.lease_id}: already consumed")
        if time.monotonic() > self.expires_at:
            raise LeaseExpired(f"{self.lease_id}: expired")
        if path != self.path:
            raise OutOfEnvelope(
                f"{self.lease_id}: path {path!r} != {self.path!r}"
            )
        if op != self.op:
            raise OutOfEnvelope(
                f"{self.lease_id}: op {op!r} != {self.op!r}"
            )
        self.consumed = True


# ---------- Truth Spine ----------

class TruthSpine:
    """Hash-chained append-only receipt log.

    NOTE: this is tamper-EVIDENT, not trust-CONFERRING.
    It proves ordering and non-repudiation of what was written.
    It does not prove the writer was honest.
    """

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.prev_hash = "GENESIS"
        if self.path.exists():
            for line in self.path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                rec = json.loads(line)
                self.prev_hash = rec.get("hash", self.prev_hash)

    def seal(self, record: dict) -> str:
        rec = dict(record)
        rec["prev"] = self.prev_hash
        rec["t_ns"] = time.time_ns()
        blob = json.dumps(rec, sort_keys=True, separators=(",", ":")).encode()
        h = hashlib.sha256(blob).hexdigest()
        rec["hash"] = h
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, sort_keys=True) + "\n")
        self.prev_hash = h
        return h

    def verify_chain(self) -> tuple[bool, Optional[str]]:
        """Return (ok, first_broken_hash_or_None)."""
        if not self.path.exists():
            return True, None
        prev = "GENESIS"
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            claimed = rec.pop("hash")
            if rec["prev"] != prev:
                return False, claimed
            expected = hashlib.sha256(
                json.dumps(rec, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest()
            if expected != claimed:
                return False, claimed
            prev = claimed
        return True, None


# ---------- Transition ----------

@dataclass
class Transition:
    name: str
    precondition: Callable[[], bool]
    effect: Callable[[], None]
    postcondition: Callable[[], bool]
    lease_path: str
    lease_op: str
    inward_repair: Optional["Transition"] = None


# ---------- TMPK ----------

class TMPK:
    MAX_ITERS = 64
    MAX_REPAIRS = 4

    def __init__(self, ideal: dict, workdir: Path, mission_id: str):
        self.ideal = ideal
        self.workdir = workdir
        self.mission_id = mission_id
        self.spine = TruthSpine(
            workdir / "truth_spine" / "receipts" / "chain.jsonl"
        )
        self.transitions: list[Transition] = []
        self.repairs_used = 0
        self.blocks_emitted = 0

    def add(self, t: Transition) -> "TMPK":
        self.transitions.append(t)
        return self

    def _gap(self) -> int:
        return sum(
            1
            for rel in self.ideal["required_artifacts"]
            if not (self.workdir / rel).exists()
        )

    def _terminal_sealed(self) -> bool:
        return (self.workdir / self.ideal["terminal_receipt"]).exists()

    def _observe(self) -> dict:
        return {
            "mission": self.mission_id,
            "gap": self._gap(),
            "terminal_sealed": self._terminal_sealed(),
            "repairs_used": self.repairs_used,
            "blocks_emitted": self.blocks_emitted,
        }

    def _issue_lease(self, path: str, op: str) -> FateLease:
        lease = FateLease(
            lease_id=f"L-{time.time_ns()}",
            path=path,
            op=op,
            expires_at=time.monotonic() + 30.0,
        )
        self.spine.seal(
            {
                "type": "lease.issue",
                "mission": self.mission_id,
                "lease_id": lease.lease_id,
                "path": path,
                "op": op,
            }
        )
        return lease

    def run(self) -> str:
        self.spine.seal(
            {
                "type": "mission.start",
                "mission": self.mission_id,
                "ideal": self.ideal,
                "state": self._observe(),
            }
        )

        for _ in range(self.MAX_ITERS):
            if self._gap() == 0 and self._terminal_sealed():
                h = self.spine.seal(
                    {
                        "type": "terminal.done",
                        "mission": self.mission_id,
                        "state": self._observe(),
                    }
                )
                return f"TERMINAL_DONE hash={h}"

            for t in self.transitions:
                if t.precondition():
                    result = self._attempt(t)
                    if result == "applied":
                        break
                    if result == "blocked":
                        return "BLOCKED_FOR_HUMAN"
                    if result == "repair_cap":
                        return "REPAIR_CAP_HIT"
            else:
                self.spine.seal(
                    {
                        "type": "blocked.no_admissible_transition",
                        "mission": self.mission_id,
                        "state": self._observe(),
                    }
                )
                self.blocks_emitted += 1
                return "BLOCKED_FOR_HUMAN:no_admissible_transition"
        return "MAX_ITERS_EXCEEDED"

    def _attempt(self, t: Transition) -> str:
        lease = self._issue_lease(t.lease_path, t.lease_op)
        try:
            lease.authorize(t.lease_path, t.lease_op)
            t.effect()
            if not t.postcondition():
                raise PostconditionFailed(t.name)
            self.spine.seal(
                {
                    "type": "transition.applied",
                    "mission": self.mission_id,
                    "transition": t.name,
                    "lease": lease.lease_id,
                    "state": self._observe(),
                }
            )
            return "applied"
        except LeaseDenied as e:
            return self._handle_failure(t, e)
        except (PreconditionFailed, PostconditionFailed) as e:
            return self._handle_failure(t, e)
        except FileNotFoundError as e:
            return self._handle_failure(t, e)

    def _handle_failure(self, t: Transition, e: Exception) -> str:
        repair = t.inward_repair
        inward_ok = (
            repair is not None
            and self.repairs_used < self.MAX_REPAIRS
            and repair.precondition()
        )
        if inward_ok:
            assert repair is not None
            if self.repairs_used >= self.MAX_REPAIRS:
                return "repair_cap"
            rlease = self._issue_lease(repair.lease_path, repair.lease_op)
            try:
                rlease.authorize(repair.lease_path, repair.lease_op)
                repair.effect()
                if not repair.postcondition():
                    raise PostconditionFailed(repair.name)
                self.repairs_used += 1
                self.spine.seal(
                    {
                        "type": "repair.applied",
                        "mission": self.mission_id,
                        "failed_transition": t.name,
                        "error": type(e).__name__,
                        "repair": repair.name,
                        "lease": rlease.lease_id,
                        "state": self._observe(),
                    }
                )
                return "applied"
            except Exception as e2:
                return self._emit_blocker(t, e2, "inward_repair_failed")
        if (
            repair is not None
            and self.repairs_used >= self.MAX_REPAIRS
        ):
            return "repair_cap"
        return self._emit_blocker(t, e, "outward")

    def _emit_blocker(self, t: Transition, e: Exception, cause: str) -> str:
        self.blocks_emitted += 1
        payload = {
            "type": "BLOCKED_FOR_HUMAN",
            "mission": self.mission_id,
            "transition": t.name,
            "cause": cause,
            "error": type(e).__name__,
            "detail": str(e),
            "state": self._observe(),
        }
        self.spine.seal(payload)
        return "blocked"


# ---------- MUMU mission ----------

MUMU_IDEAL = {
    "mission": "MUMU-DAILY-STATE-RELIEF-0A",
    "required_artifacts": [
        "workspace/mumu/daily_state.json",
        "workspace/mumu/relief_plan.md",
    ],
    "terminal_receipt": (
        "truth_spine/receipts/MUMU-DAILY-STATE-RELIEF-0A.terminal.json"
    ),
}


def _write(workdir: Path, rel: str, data: str) -> None:
    p = workdir / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(data, encoding="utf-8")


def _read(workdir: Path, rel: str) -> str:
    return (workdir / rel).read_text(encoding="utf-8")


def build_mumu_mission(workdir: Path, inject_outward: bool = False) -> TMPK:
    """Build demo mission.

    When inject_outward=True, input is absent and write_daily_state has no
    inward_repair — missing SOV/input is classified outward (BLOCKED_FOR_HUMAN).
    When inject_outward=False, input is seeded; an optional inward_repair can
    re-seed input if a later sabotage deletes it (repair.precondition must hold).
    """
    if not inject_outward:
        _write(
            workdir,
            "input/daily_state_raw.json",
            json.dumps(
                {"date": "2026-10-30", "mood": "steady", "energy": 0.7}
            ),
        )

    kernel = TMPK(MUMU_IDEAL, workdir, MUMU_IDEAL["mission"])

    kernel.add(
        Transition(
            name="mkdir_workspace",
            precondition=lambda: not (workdir / "workspace/mumu").exists(),
            effect=lambda: (workdir / "workspace/mumu").mkdir(
                parents=True, exist_ok=True
            ),
            postcondition=lambda: (workdir / "workspace/mumu").is_dir(),
            lease_path="workspace/mumu",
            lease_op="mkdir",
        )
    )

    inward: Optional[Transition] = None
    if not inject_outward:
        inward = Transition(
            name="seed_from_input",
            precondition=lambda: (
                workdir / "input/daily_state_raw.json"
            ).exists(),
            effect=lambda: _write(
                workdir,
                "input/daily_state_raw.json",
                json.dumps(
                    {
                        "date": "2026-10-30",
                        "mood": "repaired",
                        "energy": 0.7,
                    }
                ),
            ),
            postcondition=lambda: (
                workdir / "input/daily_state_raw.json"
            ).exists(),
            lease_path="input/daily_state_raw.json",
            lease_op="write",
        )

    kernel.add(
        Transition(
            name="write_daily_state",
            precondition=lambda: (workdir / "workspace/mumu").is_dir()
            and not (workdir / "workspace/mumu/daily_state.json").exists(),
            effect=lambda: _write(
                workdir,
                "workspace/mumu/daily_state.json",
                _read(workdir, "input/daily_state_raw.json"),
            ),
            postcondition=lambda: json.loads(
                _read(workdir, "workspace/mumu/daily_state.json")
            )["date"]
            == "2026-10-30",
            lease_path="workspace/mumu/daily_state.json",
            lease_op="write",
            inward_repair=inward,
        )
    )

    kernel.add(
        Transition(
            name="write_relief_plan",
            precondition=lambda: (
                workdir / "workspace/mumu/daily_state.json"
            ).exists()
            and not (workdir / "workspace/mumu/relief_plan.md").exists(),
            effect=lambda: _write(
                workdir,
                "workspace/mumu/relief_plan.md",
                "# Relief Plan\n- steady state, proceed\n",
            ),
            postcondition=lambda: len(
                _read(workdir, "workspace/mumu/relief_plan.md")
            )
            > 0,
            lease_path="workspace/mumu/relief_plan.md",
            lease_op="write",
        )
    )

    kernel.add(
        Transition(
            name="seal_terminal",
            precondition=lambda: kernel._gap() == 0
            and not kernel._terminal_sealed(),
            effect=lambda: _write(
                workdir,
                MUMU_IDEAL["terminal_receipt"],
                json.dumps(
                    {
                        "status": "TERMINAL_DONE",
                        "mission": MUMU_IDEAL["mission"],
                    }
                ),
            ),
            postcondition=lambda: (
                workdir / MUMU_IDEAL["terminal_receipt"]
            ).exists(),
            lease_path=MUMU_IDEAL["terminal_receipt"],
            lease_op="write",
        )
    )

    return kernel


# ---------- CLI ----------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="TMPK — Conductor Weld 0A")
    ap.add_argument("--workdir", required=True, type=Path)
    ap.add_argument(
        "--inject-outward",
        action="store_true",
        help="Omit input to force an outward blocker",
    )
    args = ap.parse_args(argv)

    args.workdir.mkdir(parents=True, exist_ok=True)
    kernel = build_mumu_mission(
        args.workdir, inject_outward=args.inject_outward
    )
    result = kernel.run()
    ok, broken = kernel.spine.verify_chain()

    print(
        json.dumps(
            {
                "result": result,
                "chain_ok": ok,
                "chain_broken_at": broken,
                "state": kernel._observe(),
                "spine_path": str(kernel.spine.path),
                "truth_label": "TMPK_PREVIEW_ONLY",
                "authority_delta": 0,
            },
            indent=2,
        )
    )

    return 0 if result.startswith("TERMINAL_DONE") and ok else 1


if __name__ == "__main__":
    sys.exit(main())
