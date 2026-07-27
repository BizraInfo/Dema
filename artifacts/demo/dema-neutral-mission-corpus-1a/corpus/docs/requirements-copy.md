# MERIDIAN Requirements

Status key: [A] accepted · [P] proposed · [X] rejected

- REQ-001 [A] Scan a pallet barcode and record arrival time.
- REQ-002 [A] Work offline for up to 4 hours; sync when the depot link returns.
- REQ-003 [A] Operator identity on every check-in record.
- REQ-004 [A] Supervisor override with reason text.
- REQ-005 [A] Export a daily manifest as CSV.
- REQ-006 [P] Bulk check-in for multi-pallet deliveries.
- REQ-007 [A] Audit log, append-only, 90-day retention.
- REQ-008 [X] Photo capture — rejected, device storage.
- REQ-009 [A] Depot-level access control.
- REQ-010 [P] Damaged-goods flag.
- REQ-011 [A] Duplicate-scan detection within a 60s window.
- REQ-012 [A] Session timeout after 15 minutes idle.
- REQ-013 [A] **Rollback procedure.** Any release must ship with a tested rollback
  to the previous depot build, executable in under 10 minutes without vendor
  assistance, signed off by two engineers before release. Accepted 2025-10-01.

<!-- REQ-013 exists only in this file. It was added after the 2025-10-01 meeting
     and never merged back into docs/requirements.md. -->
