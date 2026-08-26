# 05 · Risk Management Plan

**Status:** PROPOSED · register seeded from tonight's measured incidents

## Risk register

| ID | Risk | P | I | Mitigation in place (evidence) | Contingency | Owner |
|---|---|---|---|---|---|---|
| R1 | Host environment blocks live binding (quickshell absent) | **observed** | M | conformance machinery detects & holds PENDING honestly (`92442244…`) | operator provisions host; nothing else blocked | Operator |
| R2 | Spec-source absence (ICD §87, DRS-TR-*) forces guessing | **observed** | H | UNKNOWN-first verdicts; sha pins recorded for future verification (`LANDING_MANIFEST.md`) | obtain operator-supplied specs; re-run A20 | Operator |
| R3 | Cross-language semantic drift | **observed & closed** | H | parity probe + PARITY gate under shared digests | extend vectors on any parser change | Boundary eng |
| R4 | CI timeout misconfiguration masks real state | **occurred** (`32911742215` cancelled @15m20s) | M | ceilings raised w/ evidence-cited commits `2f3a8ae`,`f25e1e1`; all-runs enumeration habit | rerun-on-fix protocol | SRE |
| R5 | Key-person concentration (operator + agent fleet) | M | H | everything hash-addressed; laws are executable docs; onboarding ≤2 days measured on parity harness | contract specialist retainer | Eng mgmt |
| R6 | Overclaim drift into marketing/docs | M | H | registry forbidden_claims + no-overclaim gate + llm:guidance thin-router | revert authority = any reviewer | Architect |
| R7 | Dirty-tree work loss on main | M | M | concern-isolated commits; AUTO-SHIP verify-green-then-push loop exists | recovery via reflog + receipts | Eng mgmt |

## Monitoring protocols

CI sweep after every push (all workflows enumerated — never `--limit N`
blind spots); qualification receipt regenerated on any law change; drift
cron (blueprint §3.3) once infrastructure phase lands.

## Contingency procedures

Any CONTRADICTED in qualification ⇒ halt transitions, preserve evidence,
require operator ruling. Any REFUSE ⇒ named prerequisite missing — fix the
prerequisite, never the verdict enum.
