# PROD-01 C1/C2 Closeout 0A

**Mission:** `BIZRA-SOVEREIGN-AGENT-COMPUTER-0A / C1 → C2`
**Task of record:** `TASK-075.02`
**Qualification time:** `2026-08-23T00:14:51.905Z`
**Terminal state:** `BLOCKED_BY_A5`; `READY_FOR_HUMAN_GO=false`.

## Changed acceptance mechanisms

- **A2:** the verifier uses `lstat`, canonical realpaths, exact expected namespace contents, and rejects a live `consumed/` namespace before Human GO. The former `.consumed/` artifact remains explicitly retained as 1A forensic evidence.
- **A3:** `test-cleanup-failures.sh` starts the actual supervisor only with `PROD01_DISPOSABLE_CLEANUP_TEST=1` below a private `/tmp/prod01-cleanup-2a.*` root. The supervisor records real PGID/SID and terminates the bound process group plus remaining session members. A direct C1 run measured supervisor PID `910836`, producer PID `910849`, PGID `910849`, and SID `910849`; the producer, group, session, and port `7421` were all absent afterward.
- **A4:** the terminal claim is `mkdir(<namespace>/consumed/<authorization-id>)`; no authorization-ID sanitization or removable lock remains. Eight independent claimants produced exactly one winner and seven `EEXIST` losses. The authorization record is checked against the descriptor-derived authorization ID, package digest, canonical scope digest, effect class, namespace, validity window, and `execution_count=1` before the mkdir.
- **A5:** the descriptor binds the supervisor, packet, atomic consumer, cleanup test, and verifier. The terminal authority manifest binds each of those upstream bytes and the descriptor without a reverse/self-reference cycle. A Git target now requires both the declared `HEAD`/tree and a clean index/worktree.

## Final package bytes

| Artifact | SHA-256 |
| --- | --- |
| Descriptor | `1c22304d47974a690d5068d0a3d6a474129f2aad6ee63563038a87087558ee56` |
| Gate packet | `809f3eb29e6a411f39f4c44ced1a6deb7924b9a5a7f618ba6e117e32af3d29c7` |
| Terminal authority manifest | `771101bceef819d047c05e22e0a5f5bc5b6199388752b19139702ffe33234efd` |
| Supervisor | `f09328e309d68a48d601ce456e2aa443021a6f5fb886123e1b94e96dd11e094d` |
| Atomic consumer | `cac8832066be638bbdd2add3e49d5995a2d08db13c6f602438580da97f89e8dc` |
| Cleanup proof | `9e5408b2deedb1ade7242c77162b71bf2e5379f0ca6e05987b413d74386596bf` |
| Package verifier | `893e63db2c470daa5e26adb94e2847c597e31d3a1897682e0e43d4107442eb54` |

## C2 evidence

```text
A1 PASS   PACKAGE_DESCRIPTOR_VERIFICATION
A2 PASS   NAMESPACE_ISOLATION
A3 PASS   CLEANUP_FAILURE_CONTRACT
A4 PASS   ATOMIC_SINGLE_USE_AUTH
A5 FAIL   ACTUAL_OBJECT_BINDINGS
A6 PASS   STATIC_QUALIFICATION
```

The only failed A5 checks are deliberate live-binding refusals:

```text
actual consumer HEAD: 9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3
declared consumer HEAD: ab2d0815815553224febdc0c413f0c2662f79969

actual consumer tree: 4f1d41f545f01f9f6710a8c2490617b129197194
declared consumer tree: c016ae2832bcd60381af1416782ea407752c6407

actual consumer worktree: DIRTY
```

The producer binding is exact and clean. All current package-source hashes and all manifest-to-source comparisons pass. The package cannot qualify the current DEMA worktree, and therefore cannot authorize a runtime.

## Non-events and next authority

Measured after C2: live `consumed/` namespace absent; human authorization record absent; port `7421` free; `bizra-cognition-gateway` absent.

No normal supervisor execution, real authorization consumption, runtime persistence, push, merge, federation, Node1 action, mint, or authority increase occurred.

The next safe transition requires fresh Human GO: either provide an exact clean consumer worktree matching the declared target, or authorize a new package whose declared consumer object is built from an explicitly selected clean worktree. Re-run C2 only after that authority-bound choice; do not start the normal supervisor from this state.
