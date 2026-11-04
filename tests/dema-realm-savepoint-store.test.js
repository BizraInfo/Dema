import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalizeJsonV1 } from "../packages/canon/src/canonical-json-v1.js";
import {
  appendDemaRealmSavepoint,
  replayDemaRealmSavepoints,
  DEMA_REALM_SAVEPOINT_RELDIR,
} from "../packages/receipts/src/dema-realm-savepoint-store.js";

const H = (char) => `sha256:${char.repeat(64)}`;
const T0 = "2026-08-04T14:00:00.000Z";
const T1 = "2026-08-04T14:01:00.000Z";
function input(overrides = {}) {
  return {
    realm_id: "node0",
    season_id: "season-2026-08",
    mission_id: "mission-memory-1a",
    realm_event_head_hash: H("a"),
    realm_state_hash: H("b"),
    resume_capsule_hash: H("c"),
    current_phase: "VERIFY",
    next_legal_action: "RUN_FOCUSED_TESTS",
    must_not_repeat: ["APPLY_EFFECT_AGAIN"],
    authority_delta: 0,
    ...overrides,
  };
}
async function home() { return mkdtemp(join(tmpdir(), "dema-s3-store-")); }
const appendSavepoint = (args, ops) => appendDemaRealmSavepoint({ ...args, canonicalize: canonicalizeJsonV1 }, ops);
const replaySavepoints = (args) => replayDemaRealmSavepoints({ ...args, canonicalize: canonicalizeJsonV1 });

describe("DEMA-S3 realm savepoint store", () => {
  it("publishes the first immutable savepoint and replays the same head", async () => {
    const h = await home();
    try {
      const written = await appendSavepoint({ demaHome: h, input: input(), createdAtIso: T0 });
      assert.equal(written.ok, true);
      assert.equal(written.appended, true);
      assert.equal(written.savepoint.sequence, 0);
      assert.equal(written.savepoint.previous_savepoint_hash, null);
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, true);
      assert.equal(restoredState.sequence, 0);
      assert.equal(restoredState.head_savepoint_hash, written.savepoint.savepoint_hash);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("appends a second savepoint with an exact parent link", async () => {
    const h = await home();
    try {
      const first = await appendSavepoint({ demaHome: h, input: input(), createdAtIso: T0 });
      const second = await appendSavepoint({
        demaHome: h,
        input: input({ current_phase: "CLOSEOUT", next_legal_action: "SEAL_RECEIPT" }),
        createdAtIso: T1,
      });
      assert.equal(second.ok, true);
      assert.equal(second.savepoint.sequence, 1);
      assert.equal(second.savepoint.previous_savepoint_hash, first.savepoint.savepoint_hash);
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.savepoints.length, 2);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("normalizes must_not_repeat before hashing", async () => {
    const h = await home();
    try {
      const result = await appendSavepoint({
        demaHome: h,
        input: input({ must_not_repeat: ["Z", "A"] }),
        createdAtIso: T0,
      });
      assert.deepEqual(result.savepoint.must_not_repeat, ["A", "Z"]);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("refuses authority increase", async () => {
    const h = await home();
    try {
      const result = await appendSavepoint({ demaHome: h, input: input({ authority_delta: 1 }), createdAtIso: T0 });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "savepoint_authority_delta_nonzero");
      assert.equal((await replaySavepoints({ demaHome: h })).exists, false);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("rejects duplicate must_not_repeat entries instead of silently deduplicating", async () => {
    const h = await home();
    try {
      const result = await appendSavepoint({ demaHome: h, input: input({ must_not_repeat: ["A", "A"] }), createdAtIso: T0 });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "savepoint_must_not_repeat_invalid");
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("detects one-byte tampering and refuses the whole history", async () => {
    const h = await home();
    try {
      await appendSavepoint({ demaHome: h, input: input(), createdAtIso: T0 });
      const file = join(h, DEMA_REALM_SAVEPOINT_RELDIR, "000000000000.json");
      const body = JSON.parse(await readFile(file, "utf8"));
      body.current_phase = "FORGED";
      await writeFile(file, JSON.stringify(body));
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, false);
      assert.equal(restoredState.reason, "savepoint_hash_mismatch");
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("detects a sequence gap", async () => {
    const h = await home();
    try {
      const dir = join(h, DEMA_REALM_SAVEPOINT_RELDIR);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "000000000001.json"), "{}\n");
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, false);
      assert.equal(restoredState.reason, "savepoint_sequence_gap");
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("ignores abandoned private temp files during recovery", async () => {
    const h = await home();
    try {
      const dir = join(h, DEMA_REALM_SAVEPOINT_RELDIR);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, ".tmp-dead-worker"), "partial");
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, true);
      assert.equal(restoredState.exists, false);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("fails closed on an unexpected file in the authority directory", async () => {
    const h = await home();
    try {
      const dir = join(h, DEMA_REALM_SAVEPOINT_RELDIR);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "notes.txt"), "not evidence");
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, false);
      assert.equal(restoredState.reason, "savepoint_dir_unexpected_entry");
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("two racing writers cannot both own one sequence", async () => {
    const h = await home();
    try {
      const [a, b] = await Promise.all([
        appendSavepoint({ demaHome: h, input: input({ next_legal_action: "A" }), createdAtIso: T0 }),
        appendSavepoint({ demaHome: h, input: input({ next_legal_action: "B" }), createdAtIso: T0 }),
      ]);
      const winners = [a, b].filter((x) => x.ok && x.appended);
      const conflicts = [a, b].filter((x) => !x.ok && x.reason === "savepoint_transition_conflict");
      assert.equal(winners.length, 1);
      assert.equal(conflicts.length, 1);
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, true);
      assert.equal(restoredState.savepoints.length, 1);
      assert.ok(["A", "B"].includes(restoredState.head.next_legal_action));
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("same candidate race settles idempotently", async () => {
    const h = await home();
    try {
      const [a, b] = await Promise.all([
        appendSavepoint({ demaHome: h, input: input(), createdAtIso: T0 }),
        appendSavepoint({ demaHome: h, input: input(), createdAtIso: T0 }),
      ]);
      assert.equal([a, b].filter((x) => x.ok && x.appended).length, 1);
      assert.equal([a, b].filter((x) => x.ok && x.idempotent).length, 1);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("fresh process reconstruction needs no prior model context", async () => {
    const h = await home();
    try {
      const first = await appendSavepoint({ demaHome: h, input: input(), createdAtIso: T0 });
      assert.equal(first.ok, true);
      const { spawn } = await import("node:child_process");
      const moduleUrl = new URL("../packages/receipts/src/dema-realm-savepoint-store.js", import.meta.url).href;
      const child = spawn(process.execPath, ["--input-type=module", "-e", `import { replayDemaRealmSavepoints } from ${JSON.stringify(moduleUrl)}; import { canonicalizeJsonV1 } from ${JSON.stringify(new URL("../packages/canon/src/canonical-json-v1.js", import.meta.url).href)}; const r=await replayDemaRealmSavepoints({demaHome:process.argv[1],canonicalize:canonicalizeJsonV1}); console.log(JSON.stringify({ok:r.ok,hash:r.head_savepoint_hash,next:r.head.next_legal_action}));`, h], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      const exit = await new Promise((resolve) => child.on("close", resolve));
      assert.equal(exit, 0, stderr);
      const restored = JSON.parse(stdout);
      assert.deepEqual(restored, { ok: true, hash: first.savepoint.savepoint_hash, next: "RUN_FOCUSED_TESTS" });
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("rejects a broken parent link before trusting the tail", async () => {
    const h = await home();
    try {
      await appendSavepoint({ demaHome: h, input: input(), createdAtIso: T0 });
      await appendSavepoint({ demaHome: h, input: input({ current_phase: "CLOSEOUT" }), createdAtIso: T1 });
      const file = join(h, DEMA_REALM_SAVEPOINT_RELDIR, "000000000001.json");
      const body = JSON.parse(await readFile(file, "utf8"));
      body.previous_savepoint_hash = H("d");
      await writeFile(file, JSON.stringify(body));
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, false);
      assert.equal(restoredState.reason, "savepoint_previous_hash_broken");
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("returns durability-uncertain and forbids retry when the canonical file is visible but dir fsync fails", async () => {
    const h = await home();
    try {
      const { link, unlink } = await import("node:fs/promises");
      const result = await appendDemaRealmSavepoint(
        { demaHome: h, input: input(), canonicalize: canonicalizeJsonV1, createdAtIso: T0 },
        {
          linkFile: link,
          unlinkTemp: unlink,
          fsyncDir: async () => {
            const error = new Error("simulated dir fsync failure");
            error.code = "EIO";
            throw error;
          },
        },
      );
      assert.equal(result.ok, false);
      assert.equal(result.durability_uncertain, true);
      assert.equal(result.effect_retry_forbidden, true);
      assert.equal(result.replay_required, true);
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, true);
      assert.equal(restoredState.savepoints.length, 1);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("real child processes cannot fork sequence zero", async () => {
    const h = await home();
    try {
      const { spawn } = await import("node:child_process");
      const moduleUrl = new URL("../packages/receipts/src/dema-realm-savepoint-store.js", import.meta.url).href;
      const childCode = `import { appendDemaRealmSavepoint } from ${JSON.stringify(moduleUrl)}; import { canonicalizeJsonV1 } from ${JSON.stringify(new URL("../packages/canon/src/canonical-json-v1.js", import.meta.url).href)}; const [home,next]=process.argv.slice(1); const H=(c)=>\`sha256:\${c.repeat(64)}\`; const input={realm_id:"node0",season_id:"season-2026-08",mission_id:"mission-memory-1a",realm_event_head_hash:H("a"),realm_state_hash:H("b"),resume_capsule_hash:H("c"),current_phase:"VERIFY",next_legal_action:next,must_not_repeat:["APPLY_EFFECT_AGAIN"],authority_delta:0}; const r=await appendDemaRealmSavepoint({demaHome:home,input,canonicalize:canonicalizeJsonV1,createdAtIso:${JSON.stringify(T0)}}); console.log(JSON.stringify(r));`;
      const run = (next) => new Promise((resolve) => {
        const child = spawn(process.execPath, ["--input-type=module", "-e", childCode, h, next], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.on("close", (code) => resolve({ code, stdout, stderr }));
      });
      const [left, right] = await Promise.all([run("LEFT"), run("RIGHT")]);
      assert.equal(left.code, 0, left.stderr);
      assert.equal(right.code, 0, right.stderr);
      const outcomes = [JSON.parse(left.stdout), JSON.parse(right.stdout)];
      assert.equal(outcomes.filter((x) => x.ok && x.appended).length, 1);
      assert.equal(outcomes.filter((x) => !x.ok && x.reason === "savepoint_transition_conflict").length, 1);
      const restoredState = await replaySavepoints({ demaHome: h });
      assert.equal(restoredState.ok, true);
      assert.equal(restoredState.savepoints.length, 1);
    } finally { await rm(h, { recursive: true, force: true }); }
  });

  it("canonical bytes are stable regardless of caller object key order", async () => {
    const h1 = await home();
    const h2 = await home();
    try {
      const normal = input();
      const reversed = Object.fromEntries(Object.entries(normal).reverse());
      const a = await appendSavepoint({ demaHome: h1, input: normal, createdAtIso: T0 });
      const b = await appendSavepoint({ demaHome: h2, input: reversed, createdAtIso: T0 });
      assert.equal(a.savepoint.savepoint_hash, b.savepoint.savepoint_hash);
      const [fa] = await readdir(join(h1, DEMA_REALM_SAVEPOINT_RELDIR));
      const [fb] = await readdir(join(h2, DEMA_REALM_SAVEPOINT_RELDIR));
      assert.equal(await readFile(join(h1, DEMA_REALM_SAVEPOINT_RELDIR, fa), "utf8"), await readFile(join(h2, DEMA_REALM_SAVEPOINT_RELDIR, fb), "utf8"));
    } finally {
      await rm(h1, { recursive: true, force: true });
      await rm(h2, { recursive: true, force: true });
    }
  });
});
