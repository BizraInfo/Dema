import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as receipts from "../packages/core/src/talk-runtime-receipt.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));
const receipt = () => receipts.buildTalkRuntimeReceipt({
  result: { provider: "llamacpp", model: "gemma4-12b", invocation_status: "completed", verdict_role: "suggestion", response_length_chars: 5 },
  recordedAtIso: "2026-10-10T00:00:00.000Z",
});
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function rehash(value) {
  const { receipt_id, ...body } = value;
  return { ...body, receipt_id: createHash("sha256").update(canonical(body)).digest("hex") };
}
function verify(value) {
  assert.equal(typeof receipts.verifyTalkRuntimeReceipt, "function");
  return receipts.verifyTalkRuntimeReceipt(value);
}
function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), "dema-receipt-verify-"));
  try { return fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
}
function cli(args, home) {
  const env = { ...process.env, HOME: home, DEMA_HOME: join(home, "dema"),
    LLAMACPP_KEY: "", LMSTUDIO_KEY: "", LLAMACPP_URL: "", LMSTUDIO_URL: "", OLLAMA_URL: "", DEMA_TALK_IDENTITY: "0" };
  const r = spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", env, timeout: 15000 });
  assert.ifError(r.error);
  return r;
}
function saved(home, value = receipt()) {
  const path = join(home, "receipt.json");
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

test("receipt verifier accepts clean JSON and reordered keys without mutating input", () => {
  const original = JSON.parse(JSON.stringify(receipt()));
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  assert.equal(verify(reordered).verified, true);
  assert.deepEqual(reordered, original);
  assert.equal(Object.isFrozen(verify(original)), true);
});
test("receipt verifier accepts the builder's nullable metadata defaults", () => {
  assert.equal(verify(receipts.buildTalkRuntimeReceipt()).verified, true);
});
test("receipt verifier rejects altered body and altered recorded digest", () => {
  for (const value of [{ ...receipt(), response_length_chars: 6 }, { ...receipt(), receipt_id: "0".repeat(64) }]) {
    const r = verify(value);
    assert.equal(r.verified, false);
    assert.equal(r.field, "receipt_id");
    assert.equal(r.reason, "digest_mismatch");
  }
});
test("receipt verifier reports missing digest and unsupported schema fields", () => {
  const { receipt_id, ...body } = receipt();
  assert.equal(verify(body).field, "receipt_id");
  assert.equal(verify({ ...receipt(), schema: "unsupported" }).field, "schema");
});
test("receipt verifier rejects malformed objects and correctly rehashed invalid fields", () => {
  for (const v of [null, [], "receipt"]) assert.equal(verify(v).field, "receipt");
  for (const [field, value] of [["invocation_status", "success"], ["no_task_executed", false], ["response_length_chars", -1], ["verdict_role", "authority"], ["consent_phrase_sha256", "not-a-digest"]]) {
    const r = verify(rehash({ ...receipt(), [field]: value }));
    assert.equal(r.verified, false);
    assert.equal(r.field, field);
  }
});
test("receipt verifier rejects missing metadata and extra fields even with a matching digest", () => {
  const { model, ...rest } = receipt();
  assert.equal(verify(rehash(rest)).field, "model");
  assert.equal(verify(rehash({ ...receipt(), raw_response: "private" })).verified, false);
});
test("receipt verifier rejects malformed effect flags without echoing values", () => {
  const bad = rehash({ ...receipt(), invocation_effects: { ...receipt().invocation_effects, network_used: "synthetic-private-value" } });
  const r = verify(bad);
  assert.equal(r.field, "invocation_effects.network_used");
  assert.doesNotMatch(JSON.stringify(r), /synthetic-private-value/);
});
test("receipt verify CLI accepts clean receipt read-only with exit0", () => withHome(home => {
  const path = saved(home), before = readFileSync(path);
  const r = cli(["receipt", "verify", path], home);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /receipt_id.*valid/);
  assert.match(r.stdout, /invocation_status=completed/);
  assert.deepEqual(readFileSync(path), before);
  assert.deepEqual(readdirSync(home), ["receipt.json"]);
}));
test("receipt verify CLI rejects exactly one flipped content byte naming file and field", () => withHome(home => {
  const path = saved(home), bytes = readFileSync(path);
  const at = bytes.indexOf(Buffer.from("gemma4-12b"));
  assert.ok(at >= 0);
  const changed = Buffer.from(bytes); changed[at] ^= 1; writeFileSync(path, changed);
  assert.equal(bytes.reduce((n, b, i) => n + Number(b !== changed[i]), 0), 1);
  const r = cli(["receipt", "verify", path], home);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(path));
  assert.match(r.stderr, /receipt_id.*digest_mismatch/);
  assert.deepEqual(readFileSync(path), changed);
}));
test("receipt verify CLI missing file has distinct exit2", () => withHome(home => {
  const path = join(home, "missing.json");
  const r = cli(["receipt", "verify", path], home);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes(path));
  assert.match(r.stderr, /file.*missing_file/);
  assert.deepEqual(readdirSync(home), []);
}));
test("receipt verify CLI malformed JSON names file and json field with exit1", () => withHome(home => {
  const path = saved(home); writeFileSync(path, '{"private":"synthetic-private-value"');
  const r = cli(["receipt", "verify", path], home);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(path));
  assert.match(r.stderr, /json.*invalid_json/);
  assert.doesNotMatch(r.stderr, /synthetic-private-value/);
}));
test("receipt verify CLI invalid rehashed field names file and field with exit1", () => withHome(home => {
  const path = saved(home, rehash({ ...receipt(), no_task_executed: false }));
  const r = cli(["receipt", "verify", path], home);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(path));
  assert.match(r.stderr, /no_task_executed/);
}));
test("receipt --help prints help before reading a missing file", () => withHome(home => {
  for (const args of [["receipt", "--help"], ["receipt", "verify", join(home, "missing.json"), "--help"]]) {
    const r = cli(args, home);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /dema receipt verify <path>/);
    assert.equal(r.stderr, "");
  }
  assert.deepEqual(readdirSync(home), []);
}));
test("receipt verification appears in flat and evidence help", () => withHome(home => {
  for (const args of [["--help"], ["help", "evidence"]]) {
    const r = cli(args, home);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /receipt verify <path>/);
  }
  assert.deepEqual(readdirSync(home), []);
}));
test("receipt verify CLI rejects absent path and unreadable directory with exit1", () => withHome(home => {
  const usage = cli(["receipt", "verify"], home);
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /path/);
  const dir = cli(["receipt", "verify", home], home);
  assert.equal(dir.status, 1);
  assert.ok(dir.stderr.includes(home));
  assert.match(dir.stderr, /file.*read_failed/);
}));
test("receipt from a refused talk call verifies as refused with zero model fetch", () => withHome(home => {
  const talk = cli(["talk", "--provider", "llamacpp", "--model", "gemma4-12b", "--prompt", "hello", "--consent", "wrong", "--receipt", "--json"], home);
  assert.equal(talk.status, 1);
  const result = JSON.parse(talk.stdout);
  assert.equal(result.invocation_status, "refused");
  assert.equal(result.boundary.network_used, false);
  const r = cli(["receipt", "verify", result.receipt_path], home);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /invocation_status=refused/);
  assert.doesNotMatch(r.stdout, /invocation_status=completed/);
}));
