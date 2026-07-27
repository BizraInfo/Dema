# Security Review — MERIDIAN

Reviewer: T. Okonkwo (external)
Date: 2025-10-22
Verdict: **RELEASE BLOCKED**

| ID | Finding | Severity | Status |
|---|---|---|---|
| SEC-001 | Session timeout not enforced server-side | Medium | Fixed 2025-10-28 |
| SEC-002 | Manifest export leaks operator full names | Low | Fixed 2025-10-28 |
| SEC-003 | No rate limit on `/override` | Medium | Fixed 2025-11-02 |
| SEC-004 | **Shared supervisor credentials, committed to the repo in 2025-07 and never rotated** | **High** | **OPEN** |

## Release condition

SEC-004 must be closed before any public release. Closing it requires:

1. Rotating the shared depot supervisor credentials.
2. Moving to per-supervisor identities (relates to DD-04).
3. Confirming no released build embeds the old credential.

Rotation had not started as of this review. **This is a blocking condition, not a
recommendation.**
