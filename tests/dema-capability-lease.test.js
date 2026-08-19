import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  authorityVerdict,
  CAPABILITY_LEASE_SCHEMA,
  CAPABILITY_LEASE_SCHEMA_V0_2,
} from "../packages/core/src/dema-capability-lease.js";
import {
  LEASE_ATTENUATION_SCHEMA,
  genesisLease,
  deriveLease,
} from "../packages/core/src/dema-lease-attenuation.js";

const NOW = "2026-08-13T05:00:00Z";
const READY = { ready: true };
const goodLease = {
  capability_ids: ["repo.patch_bounded"],
  scope: "/data/bizra/worktrees/relief-wt",
  expires_at: "2026-08-13T09:00:00Z",
  max_blast_radius: { files: 3, bytes: 20000 },
  granted_by: "mumu",
};
const smallBlast = { files: 1, bytes: 500, reversible: true };

// The hash is INJECTED into the attenuation kernel, so the test supplies its own.
// Test and production may differ in algorithm; they may not differ in the law.
const hash = (o) => `sha256:${createHash("sha256").update(JSON.stringify(o)).digest("hex")}`;

/**
 * A lawful chain: an operator-issued root, then one derived child that asked for
 * MORE than the root held (`authorship.migration`) and was clamped to the
 * intersection. Rebuilt per call so no test can mutate another's fixture.
 */
const lawfulChain = () => {
  const root = genesisLease({
    issuer: "mumu",
    capability_ids: ["repo.patch_bounded", "fs.read"],
    scope: "/data/bizra/worktrees/relief-wt",
    expires_at: "2026-08-13T09:00:00Z",
    max_blast_radius: { files: 3, bytes: 20000 },
    hash,
  });
  const { lease } = deriveLease({
    parent: root,
    request: {
      capability_ids: ["repo.patch_bounded", "authorship.migration"],
      scope: "/data/bizra/worktrees/relief-wt/packages",
      max_blast_radius: { files: 1, bytes: 1000 },
    },
    hash,
  });
  return [root, lease];
};

// ── CL-01 read-only is always ALLOW (observation) ────────────────────────────
test("CL-01: read_only observation is ALLOW", () => {
  const v = authorityVerdict({ effect_class: "read_only", capability_id: "git.status" });
  assert.equal(v.schema, CAPABILITY_LEASE_SCHEMA);
  assert.equal(v.verdict, "ALLOW");
});

// ── CL-02 identity/financial are HARD sovereign even WITH a lease ─────────────
test("CL-02: identity_key/financial never auto-authorize, even under a lease", () => {
  const idLease = { ...goodLease, capability_ids: ["authorship.migration"] };
  const v = authorityVerdict({
    effect_class: "identity_key", capability_id: "authorship.migration",
    exact_scope: "/data/bizra/worktrees/relief-wt", standing_lease: idLease,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "QUEUE_SOVEREIGN");
  assert.match(v.reason, /hard_sovereign_effect:identity_key/);
  assert.equal(authorityVerdict({ effect_class: "financial", capability_id: "mint" }).verdict, "QUEUE_SOVEREIGN");
});

// ── CL-03 reversible_local ALLOWED under a matching, in-scope, blast-bounded lease ─
test("CL-03: reversible_local within a valid standing lease is ALLOW", () => {
  const v = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/packages/core/src/x.js",
    standing_lease: goodLease, measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "ALLOW");
  assert.equal(v.reason, "within_standing_lease");
});

// ── CL-04 no lease -> QUEUE_SOVEREIGN (never silently autonomous) ─────────────
test("CL-04: reversible_local without a lease queues for the sovereign", () => {
  const v = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/wt/x", measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "QUEUE_SOVEREIGN");
  assert.equal(v.reason, "no_standing_lease");
});

// ── CL-05 concrete mismatches DENY (scope, expiry, blast) ─────────────────────
test("CL-05: out-of-scope, expired, or over-blast requests are DENIED, not allowed", () => {
  const outScope = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/etc/passwd", standing_lease: goodLease, measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(outScope.verdict, "DENY");
  assert.equal(outScope.reason, "lease_scope_mismatch");

  const expired = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x", standing_lease: goodLease,
    measured_blast_radius: smallBlast, machine_state: READY, now: "2026-08-14T00:00:00Z",
  });
  assert.equal(expired.verdict, "DENY");
  assert.equal(expired.reason, "lease_expired");

  const overBlast = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x", standing_lease: goodLease,
    measured_blast_radius: { files: 99, bytes: 5, reversible: true }, machine_state: READY, now: NOW,
  });
  assert.equal(overBlast.verdict, "DENY");
  assert.equal(overBlast.reason, "blast_exceeds_lease");
});

// ── CL-06 the critique's example: a scoped external_network lease can ALLOW ────
test("CL-06: external_network to an exact leased scope is ALLOW (push to a pre-authorized branch)", () => {
  const pushLease = {
    capability_ids: ["git.push_feature_branch"], scope: "refs/heads/sprint/relief",
    expires_at: "2026-08-13T09:00:00Z", max_blast_radius: { files: 100, bytes: 10_000_000 }, granted_by: "mumu",
  };
  const v = authorityVerdict({
    effect_class: "external_network", capability_id: "git.push_feature_branch",
    exact_scope: "refs/heads/sprint/relief", standing_lease: pushLease,
    measured_blast_radius: { files: 3, bytes: 1000, reversible: true }, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "ALLOW");
});

// ── CL-07 fail-closed: unknown effect, missing capability, irreversible blast ──
test("CL-07: unverifiable inputs are UNVERIFIABLE, never ALLOW", () => {
  assert.equal(authorityVerdict({ effect_class: "teleport", capability_id: "x" }).verdict, "UNVERIFIABLE");
  assert.equal(authorityVerdict({ effect_class: "reversible_local" }).reason, "capability_id_required");
  const irreversible = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x", standing_lease: goodLease,
    measured_blast_radius: { files: 1, bytes: 5, reversible: false }, machine_state: READY, now: NOW,
  });
  assert.equal(irreversible.verdict, "UNVERIFIABLE");
  assert.equal(irreversible.reason, "blast_unmeasured_or_irreversible");
  // valid lease+scope but machine not ready -> UNVERIFIABLE, not ALLOW
  const notReady = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x", standing_lease: goodLease,
    measured_blast_radius: smallBlast, machine_state: { ready: false }, now: NOW,
  });
  assert.equal(notReady.verdict, "UNVERIFIABLE");
  assert.equal(notReady.reason, "machine_state_not_ready");
});

// ═══════════════════════════════════════════════════════════════════════════
// LEASE-ATTENUATION-WIRING-1A — the v0.2 contract: a lease must show where it
// came from. v0.1 is untouched; v0.2 has no "if a chain is present" branch.
// ═══════════════════════════════════════════════════════════════════════════

// ── CL-08 v0.1 is untouched — every existing call site keeps its rules ────────
test("CL-08: a v0.1 call still honours a plain object lease, under the v0.1 schema", () => {
  const v = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x.js", standing_lease: goodLease,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "ALLOW");
  assert.equal(v.schema, CAPABILITY_LEASE_SCHEMA, "no silent version bump for existing callers");
});

// ── CL-09 v0.2 REQUIRES the chain — not "verifies it if present" ──────────────
test("CL-09: under v0.2 a lease with no derivation chain is DENIED", () => {
  const v = authorityVerdict({
    contract: "v0.2",
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x.js", standing_lease: goodLease,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW, hash,
  });
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "lease_chain_required");
  assert.equal(v.schema, CAPABILITY_LEASE_SCHEMA_V0_2);
});

// ── CL-10 NEGATIVE CONTROL: the object literal cannot buy the weaker contract ─
// A hand-written lease claiming the attenuation schema — the exact shape that
// made the law a habit nobody practised — selects v0.2 whether the caller asked
// or not, and is refused. The wider capability it grants itself is never read.
test("CL-10: an object-literal attenuation lease with a WIDER capability set is refused, not honoured", () => {
  const forgedLiteral = {
    schema: LEASE_ATTENUATION_SCHEMA,
    issuer: "not-the-operator",
    capability_ids: ["repo.patch_bounded", "git.push_feature_branch", "authorship.migration"],
    scope: "/", expires_at: "2099-01-01T00:00:00Z",
    max_blast_radius: { files: 1e9, bytes: 1e12 },
    depth: 0, parent_chain_hash: null, chain_hash: "sha256:whatever",
  };
  const v = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x.js", standing_lease: forgedLiteral,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW, hash,
  });
  assert.equal(v.schema, CAPABILITY_LEASE_SCHEMA_V0_2, "presenting an attenuation lease selects v0.2");
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "lease_chain_required");
});

// ── CL-11 the guard is REACHABLE — a real chain still ALLOWs ─────────────────
// Without this the DENYs above would be vacuous: a gate that refuses everything
// proves nothing about the law it claims to enforce.
test("CL-11: a lease derived through the attenuation law is ALLOWED under v0.2", () => {
  const v = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/packages/core/src/x.js",
    lease_chain: lawfulChain(), hash,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "ALLOW");
  assert.equal(v.reason, "within_standing_lease");
  assert.equal(v.schema, CAPABILITY_LEASE_SCHEMA_V0_2);
});

// ── CL-12 an intact chain is not a lawful one ────────────────────────────────
test("CL-12: a hand-widened leaf with a correctly recomputed hash is DENIED", () => {
  const [root, child] = lawfulChain();
  const widened = { ...child, capability_ids: [...child.capability_ids, "git.push_feature_branch"] };
  const { chain_hash: _carried, ...body } = widened;
  const forged = { ...body, chain_hash: hash({ parent: root.chain_hash, ...body }) };
  // the digest is perfect — only re-deriving the law catches it
  assert.notEqual(forged.chain_hash, child.chain_hash);

  const v = authorityVerdict({
    effect_class: "external_network", capability_id: "git.push_feature_branch",
    exact_scope: "/data/bizra/worktrees/relief-wt/packages/core/src/x.js",
    lease_chain: [root, forged], hash,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "DENY");
  assert.match(v.reason, /^lease_chain_unverified:wider_capabilities:git\.push_feature_branch$/);
});

// ── CL-13 the chain attests one lease; only that lease may be honoured ───────
test("CL-13: a standing_lease that is not the chain's leaf is DENIED", () => {
  const v = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/packages/core/src/x.js",
    lease_chain: lawfulChain(), standing_lease: goodLease, hash,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "standing_lease_not_chain_leaf");
});

// ── CL-14 the clamp shows up here as a refusal, not a silent widening ────────
test("CL-14: a capability the parent never held is absent from the leaf, so the act is DENIED", () => {
  const chain = lawfulChain();
  const leaf = chain[chain.length - 1];
  assert.ok(!leaf.capability_ids.includes("authorship.migration"), "the over-request was clamped at derivation");
  const v = authorityVerdict({
    effect_class: "reversible_local", capability_id: "authorship.migration",
    exact_scope: "/data/bizra/worktrees/relief-wt/packages/core/src/x.js",
    lease_chain: chain, hash,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "lease_capability_mismatch");
});

// ── CL-15 fail-closed on the verifier's own preconditions ────────────────────
test("CL-15: no hash function and an unknown contract are UNVERIFIABLE, never ALLOW", () => {
  const noHash = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/packages/core/src/x.js",
    lease_chain: lawfulChain(),
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(noHash.verdict, "UNVERIFIABLE");
  assert.equal(noHash.reason, "lease_chain_hash_function_required");

  // a typo in the contract must not silently downgrade to v0.1
  const typo = authorityVerdict({
    contract: "v0.11",
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x.js", standing_lease: goodLease,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(typo.verdict, "UNVERIFIABLE");
  assert.equal(typo.reason, "lease_contract_unknown:v0.11");

  // an empty chain is a missing chain, not an empty permission
  const empty = authorityVerdict({
    effect_class: "reversible_local", capability_id: "repo.patch_bounded",
    exact_scope: "/data/bizra/worktrees/relief-wt/x.js", lease_chain: [], hash,
    measured_blast_radius: smallBlast, machine_state: READY, now: NOW,
  });
  assert.equal(empty.verdict, "DENY");
  assert.equal(empty.reason, "lease_chain_required");
});
