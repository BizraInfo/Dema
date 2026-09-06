"""
Single source of truth for the Mission Lifecycle Kernel state machine.

Both kernel.py (the runtime) and the test runner's evidence tests
(t_evidence_state_transitions_in_table) consume these constants. Without
this module, the transition table was duplicated, and a spec drift could
cause runner to silently accept transitions kernel rejects (or vice versa).

This is referenced by spec phase_02_lifecycle_states.md. If the spec changes,
this module changes; both consumers reflect automatically.
"""
from __future__ import annotations

# ─── states ───────────────────────────────────────────────────────────────
STATE_DRAFT = "draft"
STATE_PREVIEW = "preview"
STATE_READY = "ready"
STATE_EXECUTING = "executing"
STATE_VALIDATED = "validated"
STATE_RECEIPTED = "receipted"
STATE_ARCHIVED = "archived"
STATE_SUSPENDED = "suspended"

ALL_STATES = (
    STATE_DRAFT, STATE_PREVIEW, STATE_READY, STATE_EXECUTING,
    STATE_VALIDATED, STATE_RECEIPTED, STATE_ARCHIVED, STATE_SUSPENDED,
)

# ─── transition table ─────────────────────────────────────────────────────
# Map of (from_state, to_state) -> trigger string. Receipts cite the trigger
# in their `trigger` field; runner verifies every transition pair is in this
# map.
VALID_TRANSITIONS = {
    (STATE_DRAFT, STATE_PREVIEW): "structural_validation_pass",
    (STATE_DRAFT, STATE_ARCHIVED): "operator_abandon",
    (STATE_PREVIEW, STATE_READY): "all_consents_collected",
    (STATE_PREVIEW, STATE_DRAFT): "validation_fail_back_to_draft",
    (STATE_PREVIEW, STATE_ARCHIVED): "operator_abandon",
    (STATE_READY, STATE_EXECUTING): "run_invoked",
    (STATE_EXECUTING, STATE_VALIDATED): "all_acts_succeeded",
    (STATE_EXECUTING, STATE_SUSPENDED): "interrupt_or_act_failed",
    (STATE_VALIDATED, STATE_RECEIPTED): "outcome_recorded",
    (STATE_RECEIPTED, STATE_ARCHIVED): "mission_closed",
    (STATE_SUSPENDED, STATE_READY): "operator_resume",
    (STATE_SUSPENDED, STATE_ARCHIVED): "operator_terminate",
}

# Convenience set form for membership checks
VALID_TRANSITION_PAIRS = frozenset(VALID_TRANSITIONS.keys())
