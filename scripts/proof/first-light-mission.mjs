// FIRST-LIGHT reproduction harness — one bounded, mandatory-anchored, reversible
// Omega0-M mission over a frozen fixture folder.
//
// This is the artifact a witness runs. Everything that could vary is pinned:
// the fixture bytes, the anchor path, and `now`. A random anchor path enters the
// sealed body and changes `seal_head` between runs, so it MUST NOT be mkdtemp'd —
// otherwise two honest runs disagree and the proof reads as fabricated.
//
// [LOCAL_ONLY] Proves the mechanical half only: consent-bound apply, zero-loss
// verification, complete undo, exact restoration, re-application, external anchor,
// and a recomputable seal. Does NOT prove Node0 closure, L1 activation, federation,
// or that any anchor store is durable. No network, no model invocation.

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";

import {
  OMEGA0_SCHEMA,
  replaySeal,
  runMechanicalClosure,
} from "../../packages/core/src/omega0-mechanical-closure.js";

export const FIRST_LIGHT_SCHEMA = "bizra.dema.first_light_mission.v0.1";
export const FIRST_LIGHT_TRUTH_LABEL = "FIRST_LIGHT_MEASURED_LOCAL";

/** Frozen clock. Any change here changes the seal. */
export const FIRST_LIGHT_NOW = 1_800_000_000_000;

/**
 * Frozen fixture: a deliberately messy flat folder of mixed types.
 * Byte-for-byte fixed — do not derive from repo files, or the seal drifts
 * every time the repo changes.
 */
export const FIRST_LIGHT_FIXTURE = Object.freeze([
  ["invoice-2026-03.md", "# Invoice\n\namount: 950\ncurrency: EUR\n"],
  ["notes-messy.md", "scattered thoughts\n- one\n- two\n"],
  ["readme.md", "# Estate\n\nUnsorted.\n"],
  ["budget.json", '{"pool":0.5,"zakat":0.025}\n'],
  ["manifest.json", '{"files":10,"sorted":false}\n'],
  ["helper.js", "export const noop = () => null;\n"],
  ["parser.js", "export const parse = (s) => String(s).trim();\n"],
  ["report.txt", "quarterly figures, unreviewed\n"],
  ["scratch.txt", "todo: organise this folder\n"],
  ["LICENSE", "All rights reserved.\n"],
]);

// The reproducible constants a witness compares.
//
// These are CONTENT-bound: the manifest records paths relative to the leased
// root, so they are identical on any machine and any work directory (verified
// across three separate work dirs). `seal_head` is deliberately NOT published as
// a constant — it binds the absolute scope and anchor paths, so it is stable for
// a fixed directory but differs across machines. That is correct behaviour (the
// seal attests where the anchor actually lived); it simply makes it the wrong
// value to ask a stranger to match. A witness verifies `seal_head` LOCALLY via
// replay (`seal_head_matches: true`), and cross-machine via these two hashes.
export const FIRST_LIGHT_BEFORE_MANIFEST_HASH =
  "403db0b4b5d97b53e9a3836c49749f86d2965bcd7d81f3d989782c779cfd2202";
export const FIRST_LIGHT_AFTER_MANIFEST_HASH =
  "89eb646f08b7f56c9ac173a9e83d0b4999429372ea14cfc871e3936ba3f0265b";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Reversible effect: bucket loose files by extension. Move-only — never deletes. */
export function bucketByExtensionAdapter(root) {
  let journal = [];
  const walk = (rel, out) => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const r = rel === "." ? entry.name : join(rel, entry.name);
      if (entry.isDirectory()) walk(r, out);
      else out.push({ path: r, content_id: sha256(readFileSync(join(root, r))) });
    }
    return out;
  };
  return {
    propose() {
      return readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .sort()
        .map((name) => ({
          op: "move",
          src: name,
          dst: join(extname(name).slice(1) || "noext", name),
        }));
    },
    manifest() {
      return walk(".", []).sort((a, b) => a.path.localeCompare(b.path));
    },
    apply(plan) {
      journal = [];
      for (const op of plan) {
        mkdirSync(join(root, op.dst, ".."), { recursive: true });
        renameSync(join(root, op.src), join(root, op.dst));
        journal.push(op);
      }
      return journal.slice();
    },
    undo(applied) {
      for (const op of [...applied].reverse()) {
        renameSync(join(root, op.dst), join(root, op.src));
      }
      return true;
    },
    anchorState() {
      return { anchorLog: [], observed: null };
    },
  };
}

/** Write the frozen fixture into `root`, replacing anything already there. */
export function materialiseFixture(root) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const [name, body] of FIRST_LIGHT_FIXTURE) {
    writeFileSync(join(root, name), body);
  }
  return readdirSync(root).sort();
}

/**
 * Run the mission. `workDir` holds both the leased scope root and the anchor;
 * the anchor is a sibling of the scope, never inside it (the kernel refuses an
 * anchor the act could reach).
 */
export function runFirstLightMission({ workDir, now = FIRST_LIGHT_NOW } = {}) {
  const root = join(workDir, "demo-estate");
  const anchorDir = join(workDir, "first-light-anchor"); // pinned, NOT mkdtemp
  materialiseFixture(root);
  rmSync(anchorDir, { recursive: true, force: true });
  mkdirSync(anchorDir, { recursive: true });

  const effect = bucketByExtensionAdapter(root);
  const before = effect.manifest();

  const sealed = runMechanicalClosure({
    mission: { objective: "organize a chaotic folder by file type", root },
    lease: {
      lease_id: "FIRST-LIGHT-1",
      scope_root: root,
      expires_at: now + 60_000,
      budget_acts: 1,
    },
    consent: { by: "Mumu", ref: "FIRST-LIGHT-2026-08-02" },
    anchorDir,
    effect,
    now,
  });

  const after = effect.manifest();
  // A FRESH adapter = a fresh process reading the same world (OM0-09).
  const replay = replaySeal(sealed, bucketByExtensionAdapter(root));
  const ids = (m) => m.map((f) => f.content_id).sort();
  const manifestHash = (m) => sha256(JSON.stringify(m));

  return Object.freeze({
    schema: FIRST_LIGHT_SCHEMA,
    truth_label: FIRST_LIGHT_TRUTH_LABEL,
    omega0_schema: OMEGA0_SCHEMA,
    status: sealed.status,
    files_in: FIRST_LIGHT_FIXTURE.length,
    before_manifest_hash: manifestHash(before),
    after_manifest_hash: manifestHash(after),
    content_ids_preserved_exactly:
      JSON.stringify(ids(before)) === JSON.stringify(ids(after)),
    verification: sealed.verification,
    reversibility: sealed.reversibility,
    proof_card: sealed.proof_card,
    authority_delta: sealed.authority_delta,
    seal_head: sealed.seal_head,
    anchor_outside_scope: !`${anchorDir}/`.startsWith(`${root}/`),
    replay: {
      replayed: replay.replayed,
      seal_head_matches: replay.seal_head_matches,
      world_state_matches: replay.world_state_matches,
    },
    boundary: {
      network: false,
      model_invocation: false,
      runtime_activation: false,
      federation: false,
    },
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const workDir = process.argv[2];
  if (!workDir) {
    console.error(
      "Usage: node scripts/proof/first-light-mission.mjs <work-dir>\n" +
        "  <work-dir> must be a scratch directory; it is created/replaced.",
    );
    process.exit(2);
  }
  console.log(JSON.stringify(runFirstLightMission({ workDir }), null, 2));
}
