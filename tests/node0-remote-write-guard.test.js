// NODE0-SOURCE-LISTENER-SCAN-1A — bounded source-surface evidence only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  evaluateRemoteWriteGuard,
  remoteWriteObservation,
  INBOUND_LISTENER_PATTERNS,
} from "../packages/core/src/node0-remote-write-guard.js";
import { evaluateNode0ClosureInvariants } from "../packages/core/src/node0-closure-invariants.js";
import { gatherRemoteWriteEvidence } from "../apps/cli/src/node0-remote-write-gatherer.js";

const clean = (path, source) => ({ path, source });

test("RWG-01 a complete source scan with no listener is CLEAR", () => {
  const report = evaluateRemoteWriteGuard({
    files: [
      clean("a.js", "export function add(a,b){ return a+b; }"),
      clean("b.js", "import { readFile } from 'node:fs/promises';"),
    ],
  });
  assert.equal(report.source_listener_detected, false);
  assert.equal(report.status, "CLEAR");
  assert.equal(report.files_scanned, 2);
  assert.equal(report.listener_findings.length, 0);
});

test("RWG-02 NEGATIVE CONTROL — any listed listener becomes a source finding", () => {
  // Without this, RWG-01 would pass against a scanner that always says CLEAR.
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
    assert.equal(report.source_listener_detected, true, `${label} must be detected`);
    assert.equal(report.status, "FINDINGS");
  }
});

test("RWG-03 SILENCE IS NOT PROOF — an empty scan is UNKNOWN, never CLEAR", () => {
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
  assert.equal(report.source_listener_detected, false, "comments and strings are not listeners");
  assert.equal(report.status, "CLEAR");
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
  assert.equal(report.source_listener_detected, true);
  assert.ok(report.listener_findings.some((f) => f.id === "http_server"));
});

test("RWG-06 an unreadable file makes coverage incomplete and UNKNOWN", () => {
  const report = evaluateRemoteWriteGuard({
    files: [clean("ok.js", "export const a=1;"), { path: "bad.js", source: null }],
  });
  assert.ok(report.coverage_issues.some((f) => f.id === "unreadable_file"));
  assert.equal(report.coverage_complete, false);
  assert.equal(report.source_listener_detected, false);
  assert.equal(report.status, "UNKNOWN", "an unread file cannot be reported as clear");
});

test("RWG-07 source-only evidence cannot satisfy deployment-level remote_write", () => {
  const report = evaluateRemoteWriteGuard({
    files: [clean("a.js", "export const a=1;")],
  });
  const obs = remoteWriteObservation(report);
  assert.equal(
    obs,
    null,
    "a source syntax scan cannot prove the absence of deployment write paths",
  );

  // No source-only adapter means the broad closure invariant stays UNKNOWN.
  const closure = evaluateNode0ClosureInvariants({ remote_write: obs });
  const row = closure.invariants.find((i) => i.id === "remote_write");
  assert.equal(row.status, "UNKNOWN");
  assert.equal(row.source, null);

  // A listener finding is still only a source-surface finding. It does not prove
  // that an external party can silently mutate sovereign state either.
  const bad = evaluateRemoteWriteGuard({
    files: [clean("s.js", "net.createServer(h);")],
  });
  const badRow = evaluateNode0ClosureInvariants({
    remote_write: remoteWriteObservation(bad),
  }).invariants.find((i) => i.id === "remote_write");
  assert.equal(badRow.status, "UNKNOWN");
});

test("RWG-08 the report refuses to overclaim its scope", () => {
  const report = evaluateRemoteWriteGuard({ files: [clean("a.js", "export const a=1;")] });
  assert.match(report.what_this_does_not_prove, /DEMA_HOME/);
  assert.match(report.what_this_does_not_prove, /cloud-sync/);
  assert.match(report.what_this_does_not_prove, /git remote/);
  assert.ok(INBOUND_LISTENER_PATTERNS.length >= 9);
});

test("RWG-09 the source scan represents Next launch scripts and non-read API routes", async (t) => {
  // Break caught: scanning only JavaScript source omits the shipped Next server
  // declaration and TypeScript route surface, then reports a clean scan.
  const repoRoot = await mkdtemp(join(tmpdir(), "dema-remote-write-next-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const uiRoot = join(repoRoot, "packages", "dema-ui");
  const routeRoot = join(uiRoot, "src", "app", "api", "example");
  await mkdir(routeRoot, { recursive: true });
  await writeFile(
    join(uiRoot, "package.json"),
    JSON.stringify({ scripts: { dev: "next dev -p 3000", start: "next start" } }),
  );
  await writeFile(
    join(routeRoot, "route.ts"),
    "export async function POST(request: Request) { return Response.json({ ok: true }); }",
  );

  const evidence = await gatherRemoteWriteEvidence({ repoRoot, roots: ["packages"] });
  const report = evaluateRemoteWriteGuard(evidence);
  assert.ok(
    report.listener_findings.some((finding) => finding.id === "next_server_script"),
    "the manifest-declared Next listener must be represented",
  );
  assert.ok(
    report.listener_findings.some((finding) => finding.id === "non_read_method_route"),
    "a POST route must be represented as an inbound surface without assuming mutation",
  );
  assert.equal(remoteWriteObservation(report), null, "surface discovery is still not closure proof");
});

test("RWG-10 a missing root makes a nonempty scan incomplete and UNKNOWN", async (t) => {
  // Break caught: walk() used to drop an unreadable root silently. One readable
  // file was then enough to turn a partial scan green.
  const repoRoot = await mkdtemp(join(tmpdir(), "dema-remote-write-partial-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  await mkdir(join(repoRoot, "apps"), { recursive: true });
  await writeFile(join(repoRoot, "apps", "clean.js"), "export const clean = true;");

  const evidence = await gatherRemoteWriteEvidence({
    repoRoot,
    roots: ["apps", "missing-root"],
  });
  assert.ok(Array.isArray(evidence.coverage_issues), "coverage issues must be explicit");
  assert.ok(
    evidence.coverage_issues.some((issue) => issue.id === "unreadable_directory"),
    "the omitted root must be represented in the evidence",
  );
  const report = evaluateRemoteWriteGuard(evidence);
  assert.equal(report.files_scanned, 1, "the scan is nonempty, so this catches partial green");
  assert.equal(report.coverage_complete, false);
  assert.equal(report.status, "UNKNOWN");
  assert.equal(remoteWriteObservation(report), null);
});

test("RWG-11 the report names the narrow source property, not remote_write", () => {
  // Break caught: the old report field/status vocabulary claimed a broad
  // closure verdict even after the closure adapter was made fail-closed.
  const report = evaluateRemoteWriteGuard({
    files: [clean("a.js", "export const a = 1;")],
  });
  assert.equal(report.source_listener_detected, false);
  assert.equal(report.status, "CLEAR");
  assert.equal(
    Object.hasOwn(report, "remote_write"),
    false,
    "the narrow report must not publish the broad invariant as its own field",
  );
  assert.match(report.schema, /source_listener_scan/);
});

test("RWG-12 Windows-style manifest and route paths cannot evade matching", () => {
  const report = evaluateRemoteWriteGuard({
    files: [
      clean(
        String.raw`C:\repo\packages\dema-ui\package.json`,
        JSON.stringify({ scripts: { start: "next start" } }),
      ),
      clean(
        String.raw`C:\repo\packages\dema-ui\src\app\api\example\route.ts`,
        "export async function POST() { return Response.json({ ok: true }); }",
      ),
    ],
  });
  assert.ok(report.listener_findings.some((f) => f.id === "next_server_script"));
  assert.ok(report.listener_findings.some((f) => f.id === "non_read_method_route"));
});
