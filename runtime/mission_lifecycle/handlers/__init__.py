"""
Handler registry for the Mission Lifecycle Kernel v0.1.

Each handler is a Python callable that takes (planned_act, capsule, contract)
and returns a result dict with at least:
  {
    "passed": bool,                     # did the act succeed?
    "outputs": [<paths or refs>],       # what the act produced
    "evidence": [<verified facts>],     # facts checked by the handler
    "finding": <str or None>,           # if passed=False, why
  }

Handlers MUST honor the act's tier as declared in the agent's authority_policy:
  - ALWAYS: act may run autonomously; receipt is minted but no per-act consent gate
  - RECEIPT_BOUND: act may run autonomously; receipt is mandatory
  - MUMO_GO_REQUIRED: handler MUST verify consent_received in planned_act

Handlers MUST respect Node0-space boundary: never write outside the agent's
declared scope.inside_boundary. Path validation lives in each handler.

Registration is by handler NAME, not act_id. An act references a handler via
`planned_act["handler"]` field. Multiple acts can use the same handler with
different args.
"""
from __future__ import annotations

from typing import Callable, Dict

from . import read_file as _read_file
from . import write_file as _write_file
from . import downloads_analyze as _downloads_analyze
from . import downloads_propose_organize as _downloads_propose_organize
from . import downloads_apply_organize as _downloads_apply_organize
from . import sovereign_render as _sovereign_render
from . import node0_awakening as _node0_awakening

# Handler name → callable
REGISTRY: Dict[str, Callable] = {
    "read_file_inside_boundary": _read_file.handle,        # ALWAYS tier
    "write_under_mission_directory": _write_file.handle,   # RECEIPT_BOUND tier
    "downloads_analyze": _downloads_analyze.handle,        # RECEIPT_BOUND tier (read-only)
    "downloads_propose_organize": _downloads_propose_organize.handle,  # RECEIPT_BOUND tier (read-only, proposal-only)
    "downloads_apply_organize": _downloads_apply_organize.handle,      # RECEIPT_BOUND tier (read-only, dry-run plan only — apply runtime NOT BUILT v0.1)
    "sovereign_render": _sovereign_render.handle,          # RECEIPT_BOUND tier (read-only, SMI Path A scaffold render to mission outputs)
    "node0_awakening": _node0_awakening.handle,            # RECEIPT_BOUND tier (metadata-only scan, mints custom awakening receipt)
}


def get_handler(handler_name: str):
    """Look up a handler by name. Raises KeyError if not registered."""
    if handler_name not in REGISTRY:
        raise KeyError(
            f"handler not registered: {handler_name!r}. "
            f"Known handlers: {sorted(REGISTRY.keys())}"
        )
    return REGISTRY[handler_name]


def list_handlers():
    return sorted(REGISTRY.keys())
