import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SEASON_RECEIPT_SCHEMA,
  SEASON_RECEIPT_SCHEMA_V0_2,
  SEASON_RECEIPT_DOMAIN,
  RECEIPT_FIELDS,
  RECEIPT_FIELDS_V0_2,
  buildSeasonReceipt,
  buildSeasonReceiptV0_2,
  verifySeasonReceipt,
  verifyWorldAnchorRef,
  buildSeasonState,
} from "../packages/core/src/node0-minimum-season-save-resume.js";

/**
 * The exact bytes of the v0.2 receipt found on the operator's machine
 * (~/.dema/seasons/NODE0-FIRST-LIGHT-PREFLIGHT-HARDENING-1A, 2026-08-13).
 *
 * This fixture is the whole reason the slice is honest. No v0.2 WRITER exists
 * anywhere in this repository — the schema string appears in zero files — so a
 * verifier written from a guess about v0.2 would only prove it agrees with the
 * guess. This is the real artefact, and if the verifier does not accept it
 * unchanged, the verifier is wrong about v0.2 rather than the artefact being
 * wrong about itself.
 */
const REAL_V0_2 = Object.freeze({
  schema: "bizra.dema.node0_season_save_receipt.v0.2",
  domain: "BIZRA:NODE0_SEASON_SAVE_RECEIPT:v1",
  season_id: "NODE0-FIRST-LIGHT-PREFLIGHT-HARDENING-1A",
  state_hash: "sha256:e9f73dba17ca62971c54e2f11633d219d208b0d37d6e9f0fc732c4ee1c1e29fa",
  state_sequence: 2,
  previous_state_hash: "sha256:2b091bf3df808e7481070e475572213cf3e726f87dc0eb12f1cdd9d5c09668e0",
  saved_at: "2026-08-13T13:35:54Z",
  world_anchor_ref: "sha256:f3487ac9e04ab0dae3e1d13767ce224fe4dbce5d311db7978bcf1c5b921fcea8",
  receipt_hash: "sha256:0c85f80894849ca68d7b1170666b766e1e14ce16a1dd35e1c54b0037d5074777",
});

/// The anchor body that ref addresses, as found beside it.
const REAL_ANCHOR_BODY = Object.freeze({
  schema: "bizra.dema.realm0_world_anchor.v0.1",
  domain: "BIZRA:REALM0_WORLD_ANCHOR:v1",
  season_id: "NODE0-FIRST-LIGHT-PREFLIGHT-HARDENING-1A",
  observed: Object.freeze({ observer_contract: "probe", production_class: "local_models" }),
});

const clone = (o) => JSON.parse(JSON.stringify(o));

describe("season save receipt v0.2 · the real artefact", () => {
  it("SRV-01: the receipt found on disk verifies unchanged", () => {
    const r = verifySeasonReceipt(REAL_V0_2);
    assert.equal(r.ok, true, `real v0.2 artefact refused: ${r.reason}`);
    assert.equal(r.receipt_hash, REAL_V0_2.receipt_hash);
  });

  it("SRV-02: its hash COVERS world_anchor_ref — measured, not assumed", () => {
    // Established empirically before this verifier existed: recomputing the
    // carried hash matches only when world_anchor_ref is inside the body.
    const tampered = { ...clone(REAL_V0_2), world_anchor_ref: `sha256:${"0".repeat(64)}` };
    const r = verifySeasonReceipt(tampered);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "receipt_hash_mismatch");
  });

  it("SRV-03: it binds to the state it claims to attest", () => {
    const state = {
      state_hash: REAL_V0_2.state_hash,
      state_sequence: REAL_V0_2.state_sequence,
      previous_state_hash: REAL_V0_2.previous_state_hash,
      season_id: REAL_V0_2.season_id,
    };
    assert.equal(verifySeasonReceipt(REAL_V0_2, state).ok, true);
    const wrong = { ...state, state_hash: `sha256:${"1".repeat(64)}` };
    assert.equal(verifySeasonReceipt(REAL_V0_2, wrong).reason, "receipt_state_mismatch");
  });
});

describe("season save receipt v0.2 · contract", () => {
  it("SRV-10: v0.2 is v0.1 plus exactly one field", () => {
    assert.equal(SEASON_RECEIPT_SCHEMA_V0_2, "bizra.dema.node0_season_save_receipt.v0.2");
    const extra = RECEIPT_FIELDS_V0_2.filter((f) => !RECEIPT_FIELDS.includes(f));
    assert.deepEqual(extra, ["world_anchor_ref"]);
    // the domain did NOT change between versions
    assert.equal(REAL_V0_2.domain, SEASON_RECEIPT_DOMAIN);
  });

  it("SRV-11: the builder reproduces the real artefact byte for byte", () => {
    const built = buildSeasonReceiptV0_2({
      season_id: REAL_V0_2.season_id,
      state_hash: REAL_V0_2.state_hash,
      state_sequence: REAL_V0_2.state_sequence,
      previous_state_hash: REAL_V0_2.previous_state_hash,
      saved_at: REAL_V0_2.saved_at,
      world_anchor_ref: REAL_V0_2.world_anchor_ref,
    });
    assert.deepEqual({ ...built }, { ...REAL_V0_2 });
  });

  it("SRV-12: a v0.2 receipt missing world_anchor_ref is refused", () => {
    const { world_anchor_ref: _drop, ...missing } = clone(REAL_V0_2);
    const r = verifySeasonReceipt(missing);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "receipt_fields_unexpected");
  });

  it("SRV-13: a v0.1 receipt carrying world_anchor_ref is still refused — v0.1 stays strict", () => {
    const v1 = buildSeasonReceipt({
      season_id: "s", state_hash: `sha256:${"a".repeat(64)}`, state_sequence: 1,
      previous_state_hash: null, saved_at: "2026-07-22T00:00:00.000Z",
    });
    const smuggled = { ...v1, world_anchor_ref: `sha256:${"b".repeat(64)}` };
    const r = verifySeasonReceipt(smuggled);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "receipt_fields_unexpected");
  });

  it("SRV-14: a malformed world_anchor_ref is refused before hashing decides", () => {
    for (const bad of ["", "not-a-hash", "sha256:xyz", `sha1:${"a".repeat(40)}`, 42, null]) {
      const r = verifySeasonReceipt({ ...clone(REAL_V0_2), world_anchor_ref: bad });
      assert.equal(r.ok, false, `accepted a bad ref: ${String(bad)}`);
    }
  });

  it("SRV-15 REGRESSION: v0.1 receipts verify exactly as before", () => {
    const v1 = buildSeasonReceipt({
      season_id: "s", state_hash: `sha256:${"a".repeat(64)}`, state_sequence: 1,
      previous_state_hash: null, saved_at: "2026-07-22T00:00:00.000Z",
    });
    assert.equal(v1.schema, SEASON_RECEIPT_SCHEMA);
    assert.equal(verifySeasonReceipt(v1).ok, true);
    assert.equal(Object.keys(v1).sort().join(","), [...RECEIPT_FIELDS].sort().join(","));
    // an unknown schema is still unknown, not silently upgraded
    assert.equal(verifySeasonReceipt({ ...v1, schema: "bizra.dema.node0_season_save_receipt.v9.9" }).reason, "unknown_schema");
  });
});

describe("season save receipt v0.2 · the world anchor it names", () => {
  it("SRV-20: the ref is a content address of the anchor body", () => {
    const r = verifyWorldAnchorRef(REAL_V0_2.world_anchor_ref, {
      ...REAL_ANCHOR_BODY,
      anchor_hash: REAL_V0_2.world_anchor_ref,
    });
    // The fixture anchor body here is a REDUCTION of the real one (the real
    // observation carries 34 model identities), so it must NOT hash-match —
    // which is exactly the point: a different body cannot answer for this ref.
    assert.equal(r.ok, false);
    assert.equal(r.reason, "world_anchor_content_mismatch");
  });

  it("SRV-21: an anchor whose self-declared hash disagrees with the ref is refused", () => {
    const r = verifyWorldAnchorRef(`sha256:${"c".repeat(64)}`, {
      ...REAL_ANCHOR_BODY,
      anchor_hash: `sha256:${"d".repeat(64)}`,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "world_anchor_ref_mismatch");
  });

  it("SRV-22 NO VACUOUS PROOF: a missing anchor is UNRESOLVED, not verified", () => {
    const r = verifyWorldAnchorRef(REAL_V0_2.world_anchor_ref, null);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "world_anchor_unresolved");
    // and the receipt itself still verifies without it — anchor resolution is a
    // SEPARATE, stronger check, never a silent precondition nobody ran.
    assert.equal(verifySeasonReceipt(REAL_V0_2).ok, true);
  });

  it("SRV-23: a round-tripped anchor body verifies against its own ref", () => {
    // Build ref FROM the body, then check it — proves the checker agrees with
    // the addressing rule rather than with a hardcoded string.
    const probe = verifyWorldAnchorRef(null, null);
    assert.equal(probe.ok, false);
    const body = { ...REAL_ANCHOR_BODY };
    const built = verifyWorldAnchorRef.addressOf(body);
    const ok = verifyWorldAnchorRef(built, { ...body, anchor_hash: built });
    assert.equal(ok.ok, true, `round-trip failed: ${ok.reason}`);
  });
});
