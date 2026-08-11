// REALM0-WORLD-OBSERVER-1A — WO-01…WO-10.
//
// Dema's first sense organ: a deterministic, provenance-labeled observation of
// the local model estate that 0B binds as a REAL world anchor. The load-bearing
// laws under test:
//
//   IDENTITY   {provider, model_id, file_type, size_bytes} and nothing else —
//              paths, clocks, reachability, and resources never enter identity.
//   QUALITY    blindness (probe error, truncation, malformed record) yields
//              OBSERVATION_UNAVAILABLE — never "zero models".
//   HONESTY    same-name-same-size replacement is a STATED limit, not an
//              mtime hack.
//   ONE ANCHOR the observation flows through 0B's existing anchor primitive —
//              WO-09 proves estate → observer → anchored save → receipt v0.2 →
//              fresh-process WORLD_ANCHOR_MATCH, end to end.
//
// The estate under observation is REAL (a disposable directory scanned by the
// REAL scanner), never a hand-typed inventory — except where a test needs a
// malformed shape on purpose.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, utimes, unlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLocalModelInventoryScan,
  wrapInventoryAsLocalScan,
} from "../packages/core/src/local-model-inventory-scan.js";
import {
  buildLocalModelWorldObservation,
  REALM0_WORLD_OBSERVER_CONTRACT,
  WORLD_OBSERVER_KNOWN_LIMITS,
} from "../packages/core/src/realm0-world-observer.js";
import { saveSeasonState } from "../packages/receipts/src/season-state-store.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const dirs = [];
async function newDir(prefix) {
  const d = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}
test.after(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true }).catch(() => {});
});

/** Providers cleanly not running (no error) — observed absence, not blindness. */
const quietProviders = () => ({
  providers: {
    ollama: { reachable: true, error: null, models: [] },
    lm_studio: { reachable: true, error: null, models: [] },
    downloads: { files: [], root_present: true },
  },
  generated_at: "2026-08-12T00:00:00Z",
});

/** Observe a REAL disposable estate through the REAL scanner. */
async function observeEstate(estate, { hfCacheRoot, collectFn } = {}) {
  const scan = await buildLocalModelInventoryScan({
    collectFn: collectFn ?? (async () => quietProviders()),
    hfCacheRoot: hfCacheRoot ?? join(estate, "hf-absent"),
    secondaryRoots: [estate],
  });
  return buildLocalModelWorldObservation({ scan });
}

async function buildEstate() {
  const estate = await newDir("realm0-estate-");
  // The real scanner only records model files > 1 MB — the estate must be realistic.
  await writeFile(join(estate, "alpha.gguf"), Buffer.alloc(2 * 1024 * 1024, 1));
  await writeFile(join(estate, "beta.safetensors"), Buffer.alloc(3 * 1024 * 1024, 2));
  return estate;
}

// ── WO-01 · enumeration order never changes identity ────────────────────────
test("WO-01: identical estates in different enumeration order yield the identical digest", async () => {
  const models = [
    { provider: "downloads", model_id: "alpha", file_type: "gguf", size_bytes: 2048 },
    { provider: "downloads", model_id: "beta", file_type: "safetensors", size_bytes: 4096 },
  ];
  const forward = wrapInventoryAsLocalScan(
    { providers: { ollama: { reachable: true, models: [] }, lm_studio: { reachable: true, models: [] },
      downloads: { models: models.map((m) => ({ source: m.provider, id: m.model_id, file_type: m.file_type, size_bytes: m.size_bytes })), root_present: true } } });
  const reversed = wrapInventoryAsLocalScan(
    { providers: { ollama: { reachable: true, models: [] }, lm_studio: { reachable: true, models: [] },
      downloads: { models: [...models].reverse().map((m) => ({ source: m.provider, id: m.model_id, file_type: m.file_type, size_bytes: m.size_bytes })), root_present: true } } });
  const a = buildLocalModelWorldObservation({ scan: forward });
  const b = buildLocalModelWorldObservation({ scan: reversed });
  assert.equal(a.status, "OBSERVED");
  assert.equal(a.observation_digest, b.observation_digest,
    "enumeration order leaked into world identity");
});

// ── WO-02/WO-03 · the digest sees real change ───────────────────────────────
test("WO-02/03: removing or adding a real model changes the digest", async () => {
  const estate = await buildEstate();
  const before = await observeEstate(estate);
  assert.equal(before.status, "OBSERVED", before.reason);
  assert.ok(before.observed.identity_count >= 2, "control: the estate must be observed");

  await unlink(join(estate, "alpha.gguf"));
  const removed = await observeEstate(estate);
  assert.notEqual(removed.observation_digest, before.observation_digest,
    "a removed model must change the observed world");

  await writeFile(join(estate, "gamma.gguf"), Buffer.alloc(2 * 1024 * 1024 + 512, 3));
  const added = await observeEstate(estate);
  assert.notEqual(added.observation_digest, removed.observation_digest,
    "an added model must change the observed world");
});

// ── WO-04 · jitter is not world change ──────────────────────────────────────
test("WO-04: mtime and clock jitter never move the digest", async () => {
  const estate = await buildEstate();
  const before = await observeEstate(estate);
  // Age every file and re-observe with a different scan clock.
  const past = new Date("2020-01-01T00:00:00Z");
  await utimes(join(estate, "alpha.gguf"), past, past);
  const after = await observeEstate(estate, {
    collectFn: async () => ({ ...quietProviders(), generated_at: "2027-01-01T09:09:09Z" }),
  });
  assert.equal(after.observation_digest, before.observation_digest,
    "clock/mtime jitter leaked into world identity");
});

// ── WO-05 · blindness is never zero models ──────────────────────────────────
test("WO-05: probe errors, truncation, and malformed records yield OBSERVATION_UNAVAILABLE", async () => {
  const estate = await buildEstate();
  // Provider probe ERROR → blind.
  const probeError = await observeEstate(estate, {
    collectFn: async () => ({ providers: {
      ollama: { reachable: false, error: "connection_refused", models: [] },
      lm_studio: { reachable: true, error: null, models: [] },
      downloads: { files: [], root_present: true } } }),
  });
  assert.equal(probeError.status, "OBSERVATION_UNAVAILABLE");
  assert.ok(probeError.blind_sources.some((s) => s.startsWith("ollama:")));
  assert.equal(probeError.observed, null, "a blind scan must never fabricate an observed world");

  // HF cache read failure → blind (hfCacheRoot pointed at a FILE).
  const hfFile = join(estate, "alpha.gguf");
  const hfBlind = await observeEstate(estate, { hfCacheRoot: hfFile });
  assert.equal(hfBlind.status, "OBSERVATION_UNAVAILABLE");
  assert.ok(hfBlind.blind_sources.some((s) => s.startsWith("huggingface_cache:")));

  // Truncated filesystem scan → blind.
  const truncated = wrapInventoryAsLocalScan({ providers: {
    ollama: { reachable: true, models: [] }, lm_studio: { reachable: true, models: [] },
    downloads: { files: [], root_present: true } } },
    { secondaryScans: [{ root_present: true, truncated_at_max_files: true, models: [] }] });
  const t = buildLocalModelWorldObservation({ scan: truncated });
  assert.equal(t.status, "OBSERVATION_UNAVAILABLE");
  assert.ok(t.blind_sources.some((s) => s.endsWith("truncated_at_max_files")));

  // Malformed record → blind, not silently skipped.
  const malformed = wrapInventoryAsLocalScan({ providers: {
    ollama: { reachable: true, models: [{ id: 42 }] }, lm_studio: { reachable: true, models: [] },
    downloads: { files: [], root_present: true } } });
  const m = buildLocalModelWorldObservation({ scan: malformed });
  assert.equal(m.status, "OBSERVATION_UNAVAILABLE");

  // A provider CLEANLY not running (no error) is observed absence — disclosed.
  const quietDown = await observeEstate(estate, {
    collectFn: async () => ({ providers: {
      ollama: { reachable: false, error: null, models: [] },
      lm_studio: { reachable: true, error: null, models: [] },
      downloads: { files: [], root_present: true } } }),
  });
  assert.equal(quietDown.status, "OBSERVED",
    "a cleanly stopped provider is a fact about the world, not blindness");
  assert.equal(quietDown.source_quality.ollama.api_reachable, false);
  assert.equal(quietDown.source_quality.ollama.disclosed,
    "provider_api_not_running_observed_absence");
});

// ── WO-06 · identity carries no paths, clocks, or user data ────────────────
test("WO-06: the anchored payload contains no filesystem paths and no excluded fields", async () => {
  const estate = await buildEstate();
  const obs = await observeEstate(estate);
  const anchored = JSON.stringify(obs.observed);
  assert.equal(anchored.includes(estate), false, "estate path leaked into the anchored payload");
  assert.equal(anchored.includes(tmpdir()), false, "tmp path leaked into the anchored payload");
  for (const forbidden of ["\"path\"", "modified_at", "generated_at", "reachable", "usable_for", "load_status"]) {
    assert.equal(anchored.includes(forbidden), false, `${forbidden} leaked into world identity`);
  }
  assert.deepEqual(obs.observed.known_limits, WORLD_OBSERVER_KNOWN_LIMITS,
    "the stated gap must travel INSIDE the anchored payload");
});

// ── WO-07 · negative control: a constant-digest observer would pass nothing ─
test("WO-07: a constant-digest observer misses the change WO-02 catches — the discrimination is real", async () => {
  const estate = await buildEstate();
  const constantObserver = () => ({ status: "OBSERVED", observation_digest: "sha256:" + "0".repeat(64) });
  const c1 = constantObserver();
  await unlink(join(estate, "alpha.gguf"));
  const c2 = constantObserver();
  assert.equal(c1.observation_digest, c2.observation_digest,
    "control: the blind observer genuinely cannot see the change");
  const real = await observeEstate(estate);
  assert.equal(real.status, "OBSERVED");
  assert.notEqual(real.observation_digest, c1.observation_digest);
});

// ── WO-08 · production wiring: the season CLI carries the observer ──────────
test("WO-08: removing the CLI wiring would turn this pin RED", () => {
  const src = readFileSync(join(REPO_ROOT, "apps/cli/src/commands/season.js"), "utf8");
  assert.ok(src.includes("--observe-world-local-models"),
    "the season save surface must expose the observer — no hand-typed anchors");
  assert.ok(src.includes("buildLocalModelWorldObservation"), "CLI must consume the real observer");
  assert.ok(src.includes("buildLocalModelInventoryScan"), "CLI must consume the real scanner");
  assert.ok(src.includes("world_observation_unavailable"),
    "an unavailable observation must refuse the save, never fabricate an anchor");
});

// ── WO-09 · the whole eye-to-anchor chain, and a fresh process reads it ─────
test("WO-09: real estate → observer → anchored save → receipt v0.2 → fresh-process WORLD_ANCHOR_MATCH", async () => {
  const estate = await buildEstate();
  const obs = await observeEstate(estate);
  assert.equal(obs.status, "OBSERVED", obs.reason);

  const home = await newDir("realm0-obs-home-");
  const SEASON = "realm0-observer-season";
  const saved = await saveSeasonState({
    demaHome: home,
    state: {
      season_id: SEASON, mission_id: "genesis-mission-001", mission_phase: "WORLD_OBSERVED",
      completed_steps: [], next_safe_action: "RUN_PROOF_GATE", must_not_repeat: [],
      pending_consent: [], repository_commit: "a".repeat(40), repository_tree: "a".repeat(40),
      saved_at: "2026-08-12T00:10:00Z",
    },
    worldAnchor: { observed: obs.observed },
  });
  assert.equal(saved.ok, true, saved.reason);
  assert.equal(saved.receipt_schema, "bizra.dema.node0_season_save_receipt.v0.2");
  assert.match(saved.world_anchor_ref, /^sha256:/);

  const script = `
    import(${JSON.stringify(join(REPO_ROOT, "packages/receipts/src/season-state-store.js"))}).then(async (m) => {
      const r = await m.resumeSeason({
        demaHome: ${JSON.stringify(home)}, seasonId: ${JSON.stringify(SEASON)},
        repositoryCommit: ${JSON.stringify("a".repeat(40))}, repositoryTree: ${JSON.stringify("a".repeat(40))},
      });
      process.stdout.write(JSON.stringify({ ok: r.ok, world_anchor: r.world_anchor }));
    });`;
  const { stdout } = await execFileAsync("node", ["--input-type=module", "-e", script]);
  const child = JSON.parse(stdout);
  assert.equal(child.ok, true);
  assert.equal(child.world_anchor, "WORLD_ANCHOR_MATCH",
    "a fresh process must re-derive the observed world through the anchor chain");
});

// ── WO-10 · the world moves while asleep; the eye can tell ──────────────────
test("WO-10: mutating the estate after an anchored save yields a DIFFERENT later observation", async () => {
  const estate = await buildEstate();
  const first = await observeEstate(estate);
  assert.equal(first.status, "OBSERVED");

  // The node sleeps; the world changes.
  await writeFile(join(estate, "delta.gguf"), Buffer.alloc(2 * 1024 * 1024 + 64, 4));
  const later = await observeEstate(estate);
  assert.equal(later.status, "OBSERVED");
  assert.notEqual(later.observation_digest, first.observation_digest,
    "the comparison path must be ABLE to see the divergence");
  // Reconciliation is deliberately NOT claimed here — seeing is this slice;
  // deciding what a divergence MEANS is a later, separately-governed act.
});
