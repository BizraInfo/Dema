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

from importlib import import_module
from typing import Dict

# Handler name → (module, callable). Modules load only when selected so an
# optional handler dependency cannot block an unrelated bounded act.
REGISTRY: Dict[str, tuple[str, str]] = {
    "read_file_inside_boundary": (".read_file", "handle"),        # ALWAYS tier
    "write_under_mission_directory": (".write_file", "handle"),   # RECEIPT_BOUND tier
    "downloads_analyze": (".downloads_analyze", "handle"),        # RECEIPT_BOUND tier (read-only)
    "downloads_propose_organize": (".downloads_propose_organize", "handle"),  # RECEIPT_BOUND tier (read-only, proposal-only)
    "downloads_apply_organize": (".downloads_apply_organize", "handle"),      # RECEIPT_BOUND tier (read-only, dry-run plan only — apply runtime NOT BUILT v0.1)
    "sovereign_render": (".sovereign_render", "handle"),          # RECEIPT_BOUND tier (read-only, SMI Path A scaffold render to mission outputs)
    "node0_awakening": (".node0_awakening", "handle"),            # RECEIPT_BOUND tier (metadata-only scan, mints custom awakening receipt)
}


def get_handler(handler_name: str):
    """Look up a handler by name. Raises KeyError if not registered."""
    if handler_name not in REGISTRY:
        raise KeyError(
            f"handler not registered: {handler_name!r}. "
            f"Known handlers: {sorted(REGISTRY.keys())}"
        )
    module_name, callable_name = REGISTRY[handler_name]
    module = import_module(module_name, package=__package__)
    return getattr(module, callable_name)


def list_handlers():
    return sorted(REGISTRY.keys())
