import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyListenerWriteVector,
  isLoopbackAddress,
} from "../apps/cli/src/node0-runtime-write-surface-gatherer.js";

// NODE0-LISTENER-CAUSAL-WRITE-PROOF-1A — the contract is
//   LISTENER -> PROCESS -> HANDLER/CAPABILITY -> DEMA_HOME
// and the measured false-GREEN was that an *identified* non-loopback-bound
// process contributed to CLEAR without any handler/capability proof, while a
// non-wildcard external bind (a tailnet address) escaped the old wildcard test
// entirely. PROCESS_IDENTITY != HANDLER_CAPABILITY; NON_LOOPBACK_BIND is the
// honest predicate (not proven external reachability — firewall/NAT/routing are
// unmeasured), and it is broader than just the * / 0.0.0.0 / :: wildcards.

const L = (address, port, proc = null) => ({
  address, port,
  process: proc ? { name: proc.name, pid: proc.pid } : null,
});

// ── LCP-01 ── the measured false-GREEN: identified process, handler unproven ──
test("LCP-01: an identified non-loopback-bound process is UNRESOLVED, not clear", () => {
  const u = classifyListenerWriteVector([
    L("*", 3389, { name: "gnome-remote-de", pid: 4242 }),
  ]);
  assert.equal(u.length, 1);
  assert.match(u[0], /^listener_handler_capability_unverified:gnome-remote-de:4242:\*:3389$/);
});

// ── LCP-02 ── preserve the original law: unidentified owner stays unresolved ──
test("LCP-02: an unidentified externally bound listener stays UNRESOLVED (RWS-04 preserved)", () => {
  const u = classifyListenerWriteVector([L("0.0.0.0", 8946)]);
  assert.deepEqual(u, ["listener_process_unidentified:0.0.0.0:8946"]);
});

// ── LCP-03 ── positive control: loopback-only is not a network write vector ──
test("LCP-03: loopback listeners contribute nothing — surface can be CLEAR", () => {
  const u = classifyListenerWriteVector([
    L("127.0.0.1", 11434),
    L("127.0.0.1", 8888, { name: "unsloth", pid: 9 }),
    L("::1", 631),
    L("127.0.0.53%lo", 53),
  ]);
  assert.deepEqual(u, [], "no loopback address may raise an unresolved");
});

// ── the second measured seam: a non-wildcard external (tailnet) bind ──────────
test("LCP-EXT: a non-loopback address-specific bind is non-loopback-bound (unresolved)", () => {
  const u = classifyListenerWriteVector([
    L("100.79.96.62", 58851),
    L("fd7a:115c:a1e0::1532:603e", 40672),
  ]);
  assert.equal(u.length, 2, "tailnet binds must not escape the non-loopback test");
  assert.ok(u.every((r) => r.startsWith("listener_process_unidentified:")));
});

// ── loopback predicate unit pins ──────────────────────────────────────────────
test("isLoopbackAddress: 127/8, ::1, %lo loopback true; wildcards and tailnet false", () => {
  for (const a of ["127.0.0.1", "127.0.0.54", "::1", "127.0.0.53%lo", "::1%lo"])
    assert.equal(isLoopbackAddress(a), true, a);
  for (const a of ["*", "0.0.0.0", "::", "100.79.96.62", "fd7a:115c:a1e0::1"])
    assert.equal(isLoopbackAddress(a), false, a);
});

// ── LCP-07 ── removal control: the old PID-visible-so-clear logic must go RED ──
test("LCP-07 removal control: old 'identified process => clear' logic fails LCP-01", () => {
  // Re-enact the pre-repair rule: only unidentified externally bound listeners
  // were unresolved. Under it, the LCP-01 input yields zero unresolved — the
  // exact false-GREEN. If this ever matches the repaired classifier, the proof
  // is decorative.
  const old = (listeners) => {
    const out = [];
    for (const l of listeners) {
      const wildcard = l.address === "*" || l.address === "0.0.0.0" || l.address === "::";
      if (wildcard && l.process === null)
        out.push(`listener_process_unidentified:${l.address}:${l.port}`);
    }
    return out;
  };
  const input = [L("*", 3389, { name: "gnome-remote-de", pid: 4242 })];
  assert.equal(old(input).length, 0, "old logic is blind here (the defect)");
  assert.equal(classifyListenerWriteVector(input).length, 1, "repaired logic catches it");
});
