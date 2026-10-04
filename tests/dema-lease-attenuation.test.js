import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  LEASE_ATTENUATION_SCHEMA,
  MAX_DELEGATION_DEPTH,
  NARROWABLE_DIMENSIONS,
  genesisLease,
  deriveLease,
  verifyLeaseChain,
} from "../packages/core/src/dema-lease-attenuation.js";

// The kernel is pure: the hash is injected, exactly as the deployment and
// season kernels do it. Test and production may differ in algorithm; they may
// not differ in the law.
const hash = (o) => `sha256:${createHash("sha256").update(JSON.stringify(o)).digest("hex")}`;

const T0 = "2026-08-19T00:00:00.000Z";
const T1 = "2026-08-20T00:00:00.000Z";
const T2 = "2026-08-21T00:00:00.000Z";

const root = () =>
  genesisLease({
    issuer: "human",
    capability_ids: ["repo.patch_bounded", "git.status", "fs.read"],
    scope: "docs/",
    expires_at: T1,
    max_blast_radius: { files: 10, bytes: 100_000 },
    hash,
  });

describe("lease attenuation · the law", () => {
  it("LA-01: a genesis lease is a root — depth 0, no parent", () => {
    const g = root();
    assert.equal(g.schema, LEASE_ATTENUATION_SCHEMA);
    assert.equal(g.depth, 0);
    assert.equal(g.parent_chain_hash, null);
    assert.ok(g.chain_hash);
  });

  it("LA-02: a derived lease that asks for LESS gets exactly what it asked for", () => {
    const { lease, narrowed } = deriveLease({
      parent: root(),
      request: {
        capability_ids: ["fs.read"],
        scope: "docs/adr/",
        expires_at: T0,
        max_blast_radius: { files: 2, bytes: 1000 },
      },
      hash,
    });
    assert.deepEqual(lease.capability_ids, ["fs.read"]);
    assert.equal(lease.scope, "docs/adr/");
    assert.equal(lease.expires_at, T0);
    assert.deepEqual(lease.max_blast_radius, { files: 2, bytes: 1000 });
    assert.deepEqual(narrowed, [], "asking for less narrows nothing further");
    assert.equal(lease.depth, 1);
  });

  it("LA-10 THE LAW: widening is UNREPRESENTABLE in every dimension", () => {
    // Not 'refused'. There is no code path that returns a wider lease, so the
    // over-request is silently clamped to the parent's bound - and reported, so
    // a caller that believed it held more finds out.
    const p = root();
    const { lease, narrowed } = deriveLease({
      parent: p,
      request: {
        capability_ids: ["fs.read", "keys.sign", "net.fetch"], // 2 the parent never held
        scope: "/",                                            // escape the scope
        expires_at: T2,                                        // outlive the parent
        max_blast_radius: { files: 9999, bytes: 9_999_999 },   // exceed the blast
      },
      hash,
    });
    assert.deepEqual(lease.capability_ids, ["fs.read"], "capabilities intersect");
    assert.equal(lease.scope, "docs/", "scope cannot escape the parent's");
    assert.equal(lease.expires_at, T1, "expiry cannot outlive the parent's");
    assert.deepEqual(lease.max_blast_radius, { files: 10, bytes: 100_000 });
    for (const d of NARROWABLE_DIMENSIONS) {
      assert.ok(narrowed.includes(d), `over-request in ${d} must be reported`);
    }
  });

  it("LA-11: each dimension narrows independently — one over-ask does not widen the rest", () => {
    for (const [dim, req] of [
      ["capability_ids", { capability_ids: ["keys.sign"] }],
      ["scope", { scope: "../etc" }],
      ["expires_at", { expires_at: T2 }],
      ["max_blast_radius", { max_blast_radius: { files: 99, bytes: 99 } }],
    ]) {
      const { lease, narrowed } = deriveLease({ parent: root(), request: req, hash });
      assert.ok(narrowed.includes(dim), `${dim} must report narrowing`);
      assert.ok(lease.expires_at <= T1);
      assert.ok(lease.max_blast_radius.files <= 10);
      assert.ok(lease.capability_ids.every((c) => root().capability_ids.includes(c)));
    }
  });

  it("LA-12: an empty intersection yields a lease that authorises nothing, not an error", () => {
    const { lease } = deriveLease({
      parent: root(),
      request: { capability_ids: ["keys.sign"] },
      hash,
    });
    assert.deepEqual(lease.capability_ids, []);
  });

  it("LA-13: delegation depth only increases, and it is capped", () => {
    let l = root();
    for (let i = 1; i <= MAX_DELEGATION_DEPTH; i += 1) {
      l = deriveLease({ parent: l, request: {}, hash }).lease;
      assert.equal(l.depth, i);
    }
    assert.throws(() => deriveLease({ parent: l, request: {}, hash }), /depth/i);
  });
});

describe("lease attenuation · the chain re-derives the law, not just the hashes", () => {
  const chainOf3 = () => {
    const g = root();
    const a = deriveLease({ parent: g, request: { capability_ids: ["fs.read", "git.status"] }, hash }).lease;
    const b = deriveLease({ parent: a, request: { scope: "docs/adr/", max_blast_radius: { files: 1, bytes: 10 } }, hash }).lease;
    return [g, a, b];
  };

  it("LA-20: an honest chain verifies", () => {
    const r = verifyLeaseChain({ chain: chainOf3(), hash });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.depth, 2);
  });

  it("LA-21 NEGATIVE CONTROL: a child hand-built WIDER than its parent is refused", () => {
    // The whole point. Someone bypasses deriveLease and writes the object
    // literal themselves, with a correctly recomputed hash. Verification must
    // re-derive the attenuation property, not merely check digests.
    const [g, a, b] = chainOf3();
    const forgedBody = { ...b, capability_ids: [...b.capability_ids, "keys.sign"] };
    const { chain_hash: _drop, ...body } = forgedBody;
    const forged = { ...body, chain_hash: hash({ parent: a.chain_hash, ...body }) };
    const r = verifyLeaseChain({ chain: [g, a, forged], hash });
    assert.equal(r.ok, false);
    assert.match(String(r.reason), /wider|capabilit/i);
  });

  it("LA-22 NEGATIVE CONTROL: a tampered body whose hash was not recomputed is refused", () => {
    const [g, a, b] = chainOf3();
    const r = verifyLeaseChain({ chain: [g, a, { ...b, scope: "/" }], hash });
    assert.equal(r.ok, false);
    assert.match(String(r.reason), /hash|chain/i);
  });

  it("LA-23 NEGATIVE CONTROL: a re-parented link is refused", () => {
    const [g, a, b] = chainOf3();
    const r = verifyLeaseChain({ chain: [g, b], hash });
    assert.equal(r.ok, false);
  });

  it("LA-24: an empty or non-genesis-rooted chain is refused, never defaulted", () => {
    assert.equal(verifyLeaseChain({ chain: [], hash }).ok, false);
    const [, a, b] = chainOf3();
    assert.equal(verifyLeaseChain({ chain: [a, b], hash }).ok, false);
  });

  it("LA-25 CONTROL: the verifier can actually pass — it is not refusing everything", () => {
    assert.equal(verifyLeaseChain({ chain: [root()], hash }).ok, true);
  });
});
