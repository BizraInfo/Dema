import test from "node:test";
import assert from "node:assert/strict";
import { authorityVerdict, CAPABILITY_LEASE_SCHEMA } from "../packages/core/src/dema-capability-lease.js";

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
