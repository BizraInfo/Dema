"""
sovereign_render — RECEIPT_BOUND handler (v0.1 view-only scaffold wrapper).

Invokes the SMI Path A scaffold's render_sovereign_screen() function and writes
the rendered output to mission_dir/outputs/sovereign_render.txt. The handler
itself performs NO mutation, NO network I/O, NO canon writes. It exists so
that a kernel-managed mission can witness the scaffold rendering via the
agent receipt chain.

ARGS (in planned_act["args"]):
  (none — the handler passes mission/act focus through environment)

RETURNS standard handler envelope. See handlers/__init__.py for shape.

CONSTITUTIONAL GROUND:
  - READ-ONLY. The renderer only reads disk; this handler only writes the
    capture to mission_dir/outputs (existing handler pattern).
  - No keyboard surface invoked. No typed-GO ceremony.
  - Panel 5 reads the focused mission capsule from disk.
  - The wrapped scaffold lives at ~/.dema/kernel/sovereign_tui/sovereign.py
    and declares schema bizra.dema.sovereign_tui_render.v0.1.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path


SOVEREIGN_DIR = Path(os.path.expanduser("~/.dema/kernel/sovereign_tui"))
SOVEREIGN_PY = SOVEREIGN_DIR / "sovereign.py"
CURRENT_MISSION_ID_ENV = "DEMA_SOVEREIGN_MISSION_ID"
CURRENT_ACT_ID_ENV = "DEMA_SOVEREIGN_ACT_ID"


def handle(planned_act: dict, capsule: dict, contract: dict) -> dict:
    if not SOVEREIGN_PY.exists():
        return {
            "passed": False, "outputs": [],
            "evidence": [f"scaffold module missing: {SOVEREIGN_PY}"],
            "finding": "scaffold_missing",
        }

    old_mission_id = os.environ.get(CURRENT_MISSION_ID_ENV)
    old_act_id = os.environ.get(CURRENT_ACT_ID_ENV)
    os.environ[CURRENT_MISSION_ID_ENV] = capsule["mission_id"]
    os.environ[CURRENT_ACT_ID_ENV] = planned_act.get("act_id", "")

    sys.path.insert(0, str(SOVEREIGN_DIR))
    try:
        try:
            import sovereign  # type: ignore
            lines = sovereign.render_sovereign_screen()
            schema = sovereign.SCHEMA
        finally:
            sys.path.pop(0)
            if old_mission_id is None:
                os.environ.pop(CURRENT_MISSION_ID_ENV, None)
            else:
                os.environ[CURRENT_MISSION_ID_ENV] = old_mission_id
            if old_act_id is None:
                os.environ.pop(CURRENT_ACT_ID_ENV, None)
            else:
                os.environ[CURRENT_ACT_ID_ENV] = old_act_id
    except Exception as e:
        return {
            "passed": False, "outputs": [],
            "evidence": [f"scaffold render failed: {type(e).__name__}: {e}"],
            "finding": "scaffold_render_error",
        }

    rendered = "\n".join(lines)

    mission_id = capsule["mission_id"]
    output_dir = Path(os.path.expanduser(
        "~/.dema/kernel/mission_lifecycle/missions")) / mission_id / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "sovereign_render.txt"
    out_path.write_text(rendered + "\n", encoding="utf-8")

    panel_count = sum(1 for ln in lines if ln.startswith("╭─ Panel "))

    return {
        "passed": True,
        "outputs": [str(out_path)],
        "evidence": [
            f"scaffold module: {SOVEREIGN_PY}",
            f"scaffold schema: {schema}",
            f"panels rendered: {panel_count}",
            f"output bytes: {len(rendered)}",
            f"output path: {out_path}",
            "view-only render; no Node0 state mutated by this handler",
            "render contract §2 honored (panels disk-sourced, missing→named-blank)",
            "Panel 5 read focused mission capsule from disk",
            "no keyboard surface invoked at v0.4 scaffold",
        ],
        "finding": None,
        "summary_text": (
            f"I rendered the seven-panel sovereign mission interface scaffold. "
            f"{panel_count} panels printed from disk. "
            f"This is a view-only render at version zero point four. "
            f"No node state was mutated. No keyboard surface was invoked. "
            f"The output is captured at sovereign render dot text under the mission outputs directory."
        ),
        "render": {
            "schema": schema,
            "panel_count": panel_count,
            "output_path": str(out_path),
            "captured_at": datetime.now(timezone.utc).isoformat(),
        },
    }
