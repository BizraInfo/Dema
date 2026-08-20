// DEMA-WEB-WITNESS-1A — CLI + gatherer tests. No test touches the network:
// the gatherer is exercised with an injected fake fetch, and the spawned CLI
// paths are exactly the ones that must refuse BEFORE any fetch could happen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  gatherWebWitnessObservation,
  WEB_WITNESS_BODY_CAP_BYTES,
} from "../apps/cli/src/web-witness-gatherer.js";
import {
  buildWebWitness,
  DEMA_WEB_WITNESS_GO_PHRASE,
} from "../packages/core/src/dema-web-witness.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

function run(args) {
  return spawnSync("node", [BIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
    timeout: 20000,
  });
}

function fakeFetch(body, { status = 200, type = "text/html", url } = {}) {
  return async (requestUrl) => ({
    status,
    url: url ?? requestUrl,
    redirected: false,
    headers: { get: (k) => (k === "content-type" ? type : null) },
    arrayBuffer: async () => Buffer.from(body),
  });
}

test("WWG-01 gatherer turns one injected GET into a bindable observation", async () => {
  const body = "<html><title>Door</title><body>hello <a href='/x'>x</a></body></html>";
  const gathered = await gatherWebWitnessObservation("https://example.org/", {
    fetchImpl: fakeFetch(body),
    now: () => new Date("2026-08-20T03:00:00.000Z"),
  });
  assert.equal(gathered.ok, true);
  const o = gathered.observation;
  assert.equal(o.body_sha256, sha256(Buffer.from(body)));
  assert.equal(o.title, "Door");
  assert.match(o.text_excerpt, /hello x/);
  assert.deepEqual(o.links, ["https://example.org/x"]);
  // The observation feeds the kernel and the witness re-verifies end to end.
  const built = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: o,
  });
  assert.equal(built.ok, true);
});

test("WWG-02 oversized bodies declare overflow and carry NO hash — a partial hash would lie", async () => {
  const big = Buffer.alloc(WEB_WITNESS_BODY_CAP_BYTES + 1, 65);
  const gathered = await gatherWebWitnessObservation("https://example.org/big", {
    fetchImpl: fakeFetch(big),
  });
  assert.equal(gathered.observation.body_overflow, true);
  assert.equal(gathered.observation.body_sha256, null);
});

test("WWG-03 a dead host surfaces as request_failed, never a fabricated witness", async () => {
  const gathered = await gatherWebWitnessObservation("https://example.org/", {
    fetchImpl: async () => {
      throw Object.assign(new Error("boom"), { cause: { code: "ECONNREFUSED" } });
    },
  });
  assert.equal(gathered.ok, false);
  assert.equal(gathered.reason, "request_failed");
  assert.equal(gathered.detail, "ECONNREFUSED");
});

test("WW-CLI-01 witness without the exact phrase refuses before any fetch", () => {
  const r = run(["web", "witness", "https://example.org/", "--consent", "yes please"]);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.error, "consent_exact_string_mismatch");
  assert.equal(out.required_phrase, DEMA_WEB_WITNESS_GO_PHRASE);
  assert.match(out.note, /Nothing was fetched/);
});

test("WW-CLI-02 bare `dema web` prints the contract and exits 1", () => {
  const r = run(["web"]);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.schema, "bizra.dema.web_cli.v0.1");
  assert.equal(out.witness_phrase, DEMA_WEB_WITNESS_GO_PHRASE);
});

test("WW-CLI-03 diff runs pure over two saved witnesses and states drift", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-web-witness-"));
  const obs = (body, at) => ({
    request_url: "https://example.org/p",
    final_url: "https://example.org/p",
    redirected: false,
    fetched_at_iso: at,
    status: 200,
    content_type: "text/html",
    body_sha256: sha256(body),
    body_byte_length: Buffer.byteLength(body),
    body_overflow: false,
    title: "P",
    text_excerpt: body,
    links: [],
    link_count_total: 0,
  });
  const a = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: obs("version one", "2026-08-19T00:00:00.000Z"),
  }).witness;
  const b = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: obs("version two", "2026-08-20T00:00:00.000Z"),
  }).witness;
  const aPath = join(dir, "a.json");
  const bPath = join(dir, "b.json");
  writeFileSync(aPath, JSON.stringify(a));
  writeFileSync(bPath, JSON.stringify(b));

  const r = run(["web", "diff", aPath, bPath, "--json"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const verdict = JSON.parse(r.stdout);
  assert.equal(verdict.same_body, false);
  assert.equal(verdict.same_url, true);

  // A tampered later witness is refused by the diff, exit 1.
  const forged = { ...b, status: 999 };
  const fPath = join(dir, "f.json");
  writeFileSync(fPath, JSON.stringify(forged));
  const rf = run(["web", "diff", aPath, fPath, "--json"]);
  assert.equal(rf.status, 1);
  assert.equal(JSON.parse(rf.stdout).reason, "later_witness_invalid");
});
