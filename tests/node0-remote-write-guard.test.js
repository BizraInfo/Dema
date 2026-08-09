// NODE0-REMOTE-WRITE-GUARD-1A — the one closure invariant with no prior guard.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRemoteWriteGuard,
  remoteWriteObservation,
  INBOUND_LISTENER_PATTERNS,
} from "../packages/core/src/node0-remote-write-guard.js";
import { evaluateNode0ClosureInvariants } from "../packages/core/src/node0-closure-invariants.js";

const clean = (path, source) => ({ path, source });

test("RWG-01 a CLI with no listener satisfies remote_write=false", () => {
  const report = evaluateRemoteWriteGuard({
    files: [
      clean("a.js", "export function add(a,b){ return a+b; }"),
      clean("b.js", "import { readFile } from 'node:fs/promises';"),
    ],
  });
  assert.equal(report.remote_write, false);
  assert.equal(report.status, "SATISFIED");
  assert.equal(report.files_scanned, 2);
  assert.equal(report.listener_findings.length, 0);
});

test("RWG-02 NEGATIVE CONTROL — any real listener flips the verdict", () => {
  // Without this, RWG-01 would pass against a guard that always says SATISFIED.
  for (const [label, src] of [
    ["http", "import http from 'node:http'; http.createServer(handler).listen(80);"],
    ["net", "net.createServer(onConn);"],
    ["tls", "tls.createServer(opts);"],
    ["ws", "const s = new WebSocketServer({ port: 9 });"],
    ["http2", "http2.createSecureServer(opts);"],
    ["deno", "Deno.serve(handler);"],
    ["bun", "Bun.serve({ fetch: handler });"],
  ]) {
    const report = evaluateRemoteWriteGuard({ files: [clean(`${label}.js`, src)] });
    assert.equal(report.remote_write, true, `${label} must be detected`);
    assert.equal(report.status, "VIOLATED");
  }
});

test("RWG-03 SILENCE IS NOT PROOF — an empty scan is UNKNOWN, never SATISFIED", () => {
  // A broken gatherer returning zero files would otherwise report the
  // strongest possible security result.
  const report = evaluateRemoteWriteGuard({ files: [] });
  assert.equal(report.vacuous, true);
  assert.equal(report.status, "UNKNOWN");
  assert.equal(remoteWriteObservation(report), null, "a vacuous scan yields no observation");
  assert.equal(evaluateRemoteWriteGuard({}).status, "UNKNOWN");
});

test("RWG-04 a mention in a comment or string is not a capability", () => {
  // MEASURED: this tree's probe files contain "fetch(" as a STRING because they
  // scan other code for it. Counting that as capability is the false positive
  // this guard exists to avoid.
  const report = evaluateRemoteWriteGuard({
    files: [
      clean("probe.js", 'const FORBIDDEN = ["http.createServer(", ".listen("];'),
      clean("doc.js", "// http.createServer(x).listen(80) is forbidden here\nexport const x=1;"),
      clean("block.js", "/* net.createServer(y) */ export const y=2;"),
      clean("tpl.js", "const t = `http.createServer(z)`;"),
    ],
  });
  assert.equal(report.remote_write, false, "comments and strings are not listeners");
  assert.equal(report.status, "SATISFIED");
});

test("RWG-05 POSITIVE CONTROL — the stripper does not blind the scan", () => {
  // If stripNonCode were too aggressive it would erase real code and RWG-04
  // would pass for the wrong reason. Real code adjacent to a comment must
  // still be detected.
  const report = evaluateRemoteWriteGuard({
    files: [
      clean(
        "mixed.js",
        "// a harmless comment mentioning nothing\nhttp.createServer(h).listen(8080);",
      ),
    ],
  });
  assert.equal(report.remote_write, true);
  assert.ok(report.listener_findings.some((f) => f.id === "http_server"));
});

test("RWG-06 an unreadable file is a finding, not a silent skip", () => {
  const report = evaluateRemoteWriteGuard({
    files: [clean("ok.js", "export const a=1;"), { path: "bad.js", source: null }],
  });
  assert.ok(report.listener_findings.some((f) => f.id === "unreadable_file"));
  assert.equal(report.remote_write, true, "an unread file cannot be reported as clean");
});

test("RWG-07 the observation is sourced and feeds the closure kernel", () => {
  const report = evaluateRemoteWriteGuard({
    files: [clean("a.js", "export const a=1;")],
  });
  const obs = remoteWriteObservation(report);
  assert.equal(obs.observed, false);
  assert.match(obs.source, /node0-remote-write-guard/);
  assert.match(obs.source, /1 files/);

  // It must actually satisfy the closure invariant it was built for.
  const closure = evaluateNode0ClosureInvariants({ remote_write: obs });
  const row = closure.invariants.find((i) => i.id === "remote_write");
  assert.equal(row.status, "SATISFIED");
  assert.equal(row.source, obs.source);

  // And a violated guard must block it.
  const bad = evaluateRemoteWriteGuard({
    files: [clean("s.js", "net.createServer(h);")],
  });
  const badRow = evaluateNode0ClosureInvariants({
    remote_write: remoteWriteObservation(bad),
  }).invariants.find((i) => i.id === "remote_write");
  assert.equal(badRow.status, "VIOLATED");
});

test("RWG-08 the report refuses to overclaim its scope", () => {
  const report = evaluateRemoteWriteGuard({ files: [clean("a.js", "export const a=1;")] });
  assert.match(report.what_this_does_not_prove, /DEMA_HOME/);
  assert.match(report.what_this_does_not_prove, /cloud-sync/);
  assert.match(report.what_this_does_not_prove, /git remote/);
  assert.ok(INBOUND_LISTENER_PATTERNS.length >= 7);
});
