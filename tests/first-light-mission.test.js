import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  FIRST_LIGHT_AFTER_MANIFEST_HASH,
  FIRST_LIGHT_BEFORE_MANIFEST_HASH,
  FIRST_LIGHT_FIXTURE,
  FIRST_LIGHT_SCHEMA,
  runFirstLightMission,
} from "../scripts/proof/first-light-mission.mjs";

const work = () => mkdtempSync(join(tmpdir(), "fl-"));

test("FL-01: the mission seals with zero loss and exact restoration", () => {
  const out = runFirstLightMission({ workDir: work() });
  assert.equal(out.schema, FIRST_LIGHT_SCHEMA);
  assert.equal(out.status, "SEALED");
  assert.equal(out.files_in, FIRST_LIGHT_FIXTURE.length);
  assert.equal(out.verification.source_loss, 0);
  assert.equal(out.verification.content_hash_changes, 0);
  assert.equal(out.verification.file_count_preserved, true);
  assert.equal(out.reversibility.proven, true);
  assert.equal(out.reversibility.undo_success_pct, 100);
  assert.equal(out.proof_card.restoration_verified, true);
  assert.equal(out.proof_card.status, "VERIFIED_WITHIN_DECLARED_SCOPE");
  assert.equal(out.content_ids_preserved_exactly, true);
  assert.equal(out.authority_delta, 0);
});

test("FL-02: undo restores the exact pre-mission manifest", () => {
  const out = runFirstLightMission({ workDir: work() });
  assert.equal(out.reversibility.restored_hash, out.before_manifest_hash);
  assert.equal(out.reversibility.reapply_hash, out.after_manifest_hash);
});

test("FL-03: the anchor is enforced and stored outside the leased scope", () => {
  const out = runFirstLightMission({ workDir: work() });
  assert.equal(out.proof_card.anchor_enforced, true);
  assert.equal(out.anchor_outside_scope, true);
});

test("FL-04: a fresh reader recomputes both the seal and the world", () => {
  const out = runFirstLightMission({ workDir: work() });
  assert.equal(out.replay.replayed, true);
  assert.equal(out.replay.seal_head_matches, true);
  assert.equal(out.replay.world_state_matches, true);
});

// THE WITNESS CONTRACT. These are the only values a stranger on another machine
// can be asked to match. If this test fails, either the fixture or the effect
// changed — and every published reproduction instruction is now wrong.
test("FL-05: manifest hashes are content-bound and match the published constants", () => {
  const out = runFirstLightMission({ workDir: work() });
  assert.equal(out.before_manifest_hash, FIRST_LIGHT_BEFORE_MANIFEST_HASH);
  assert.equal(out.after_manifest_hash, FIRST_LIGHT_AFTER_MANIFEST_HASH);
});

test("FL-06: manifest hashes are identical across different work directories", () => {
  const a = runFirstLightMission({ workDir: work() });
  const b = runFirstLightMission({ workDir: work() });
  assert.equal(a.before_manifest_hash, b.before_manifest_hash);
  assert.equal(a.after_manifest_hash, b.after_manifest_hash);
});

// seal_head binds the absolute scope + anchor paths, so it is reproducible for a
// FIXED directory and legitimately differs across directories. Both halves are
// asserted so nobody publishes it as a cross-machine constant by mistake.
test("FL-07: seal_head is stable per work dir and path-bound across dirs", () => {
  const fixed = work();
  assert.equal(
    runFirstLightMission({ workDir: fixed }).seal_head,
    runFirstLightMission({ workDir: fixed }).seal_head,
  );
  assert.notEqual(
    runFirstLightMission({ workDir: work() }).seal_head,
    runFirstLightMission({ workDir: work() }).seal_head,
  );
});

test("FL-08: the mission declares an all-false runtime boundary", () => {
  const out = runFirstLightMission({ workDir: work() });
  for (const key of ["network", "model_invocation", "runtime_activation", "federation"]) {
    assert.equal(out.boundary[key], false, `${key} must be false`);
  }
});
