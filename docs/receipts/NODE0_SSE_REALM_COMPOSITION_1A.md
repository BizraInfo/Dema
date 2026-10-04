# Receipt: NODE0-REALM-SSE-COMPOSITION-1A

Truth label: `NODE0_REALM_SSE_COMPOSITION_MEASURED_REPO`

## Slice

SSE-to-Realm composition bridge: transport chain, frame law, wire law and
presence projection proven as ONE pipeline with layer-tagged refusals.

## Proof Contract

The gate passes only while a golden mission_work fixture transcript, carried
over REAL serialized SSE wire text:

- parses and chain-verifies at the transport layer (seq from 1, hash-linked,
  exactly one terminal, nothing after it),
- passes the realm frame law per payload BY NAME (§13 size cap →
  `frame:FRAME_OVERSIZE`; §6.1 strict UTF-8),
- walks the realm admission/wire law through the presence reducer to
  `VERIFIED_DONE`,
- keeps `simulated:true` on the derived render — fixtures stay
  production-inadmissible END-TO-END,
- degrades to UNKNOWN with a NAMED layer block (`sse:` / `sse-chain:` /
  `frame:` / `realm:`) whenever ANY layer refuses — never a familiar state,
  never stale success,
- is content-addressed and deterministically re-derived; a tampered copy
  fails verification.

## The join ceiling (measured honestly)

With honest transport hashes, `FRAME_JSON_INVALID` is UNREACHABLE through
this composition: anything surviving `verifySseStream` carries an object
payload by law, so the CHAIN layer owns non-object payloads
(`event_N:payload_not_object`) and later layers do not run. The frame decode
remains in the kernel for direct-bytes consumers — the Rust boundary service
(TASK-079.04) will call this same export on raw socket bytes, where every
refusal is reachable.

## Known ceiling (inherited)

Same as the transport slice: no independent external anchor — a forged body
with recomputed transport hashes is not rejected by this gate alone.
Launder-resistance requires a signer or externally measured stream head.

## Proof ran

Focused 10/10 · suite green · check exit 0 (gate wired) · guidance PASS ·
diff-check clean. Boundary all-false; authority_delta 0; no socket, server,
daemon, runtime, key, or live home mutation exists anywhere in this slice.
