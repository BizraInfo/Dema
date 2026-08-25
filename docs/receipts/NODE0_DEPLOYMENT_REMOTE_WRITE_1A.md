
## Amendment 2026-08-25 — correlation contract (REMOTE-WRITE-CORRELATION-CONTRACT-1A)

Operator audit finding: the evaluator promoted every non-loopback listener
directly to `EXTERNAL_WRITE_PATH_PRESENT` — ExternalReachability treated as
ExternalWriteAuthority. A trace is not a diagnosis.

Law now pinned in `evaluateDeploymentSurface`:

```text
VIOLATED  ⟺  ≥1 DIRECT-WRITE finding (sync mount over state root,
              writable state root, writable root file, root under sync
              mount, root hash drift — each binds write capability to
              sovereign state by structure)
UNKNOWN   ⟐  reachability-only findings alone → INCOMPLETE /
             reachability_without_write_correlation:<kinds>,
             all findings carried as context; adapter settles nothing
```

Both branches fail closed: UNKNOWN blocks closure exactly as VIOLATED does.
The change claims no uncorrelated causal fact and certifies no clean surface.

Host re-observation under the contract (same ground, read-only):
20 non-loopback listeners, ZERO direct-write findings →
verdict INCOMPLETE, observation_hash sha256:56895ea3e39d1b8b54bcd71d14a39caf7e22c611bec8fafa42c60367188fdf3d,
executed_code_hash sha256:97e55d8cac6e1ded3… Ledger: remote_write
VIOLATED → UNKNOWN. Node0 remains OPEN.

Earlier same-day amendments: verdict-conditional `what_this_proves` prose
(DRW-45..47); evidence rebound after each kernel-byte change by fresh host
observation, never by reinterpretation.

## Amendment 2026-08-25b — identity separation + semantic definition (PROPOSED)

Three distinct hashes prove three different things; they are never interchangeable:

```text
ObservationBodyHash (observation_hash)  — integrity of the envelope body
RawFileHash      (sha256sum of file)    — integrity of the bytes on disk
ExecutedCodeHash (executed_code_hash)   — binding to the kernel bytes
                                          that produced the observation
Current ground (2026-08-25T17:2xZ run under the correlation contract):
  body  sha256:56895ea3e39d1b8b54bcd71d14a39caf7e22c611bec8fafa42c60367188fdf3d
  file  sha256:7ef52c89780cbbe5a2366083f742dfc34a729825535abf4ceb561341bbc1ffab
  code  sha256:97e55d8cac6e1ded3… (full value inside the artefact body)
```

SEMANTIC NOTE (PROPOSED — no invariant ID change; migration blast radius declined):
`remote_write` is defined as UNGOVERNED MUTATION AUTHORITY — whether any
principal or mechanism outside the governed Node0 transition authority can
mutate sovereign state without passing through the constitutional
transition/receipt boundary. Evidence classes remain distinct and
non-interchangeable:

```text
non_loopback_listener     = reachability evidence
writable_state_root/file  = mutability evidence (not necessarily REMOTE)
sync_mount_over_state     = external mutability-path evidence
root_file_hash_drift      = integrity-state evidence (deviation occurred;
                            not itself a live write path)
```

Future instrumentation must target Principal ∧ Capability ∧ Target ∧ Bypass,
not any single class alone.

Status vocabulary correction: this correction is IMPLEMENTED_LOCAL ·
TESTED_LOCAL · HOST_OBSERVED · UNCOMMITTED · NOT_CANONICAL until a commit
whose tree equals the qualified candidate tree lands on the remote.
