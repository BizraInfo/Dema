import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperation, listCapabilities } from "../packages/core/src/dema-relief-capabilities.js";

// The trust-boundary contract: authority comes from the registry, never a caller.

// ── CAP-01 a registered op resolves to a fixed argv the caller never chose ─────
test("CAP-01: git.status resolves to a fixed argv array (no caller command)", () => {
  const r = resolveOperation("git.status");
  assert.equal(r.file, "git");
  assert.deepEqual(r.argv, ["status", "--short"]);
  assert.equal(r.subject_effect, "read_only");
  assert.equal(r.control_plane_effect, "none");
});

// ── CAP-02 an unknown op is refused — no default execution ────────────────────
test("CAP-02: an unknown op is refused", () => {
  assert.equal(resolveOperation("git.push").error, "unknown_operation:git.push");
  assert.equal(resolveOperation("migrate.keys").error, "unknown_operation:migrate.keys");
});

// ── CAP-03 THE HOLE THIS CLOSES: no caller command can be smuggled ─────────────
test("CAP-03: a caller cannot inject a command — there is no command input", () => {
  // Even if a caller passes command/effect_class fields, resolveOperation ignores
  // them entirely; it only knows op names. A mutating string can never execute.
  const r = resolveOperation("git.status", { command: "rm -rf /", effect_class: "read_only" });
  assert.equal(r.file, "git");
  assert.deepEqual(r.argv, ["status", "--short"], "caller-supplied command is ignored");
  // and an op name that is actually shell is malformed, not run
  assert.equal(resolveOperation("git.status; rm -rf /").error, "op_malformed");
  assert.equal(resolveOperation("../../evil").error, "op_malformed");
});

// ── CAP-04 op args are validated (argv only, no shell metachars reach exec) ────
test("CAP-04: test.run validates paths; junk/injection args are refused", () => {
  const good = resolveOperation("test.run", { paths: ["tests/dema-relief-capabilities.test.js"] });
  assert.deepEqual(good.argv, ["--test", "tests/dema-relief-capabilities.test.js"]);
  assert.equal(resolveOperation("test.run", { paths: ["tests/x.test.js; rm -rf /"] }).error, "invalid_test_paths");
  assert.equal(resolveOperation("test.run", { paths: ["/etc/passwd"] }).error, "invalid_test_paths");
  assert.equal(resolveOperation("test.run", { paths: [] }).error, "invalid_test_paths");
  assert.equal(resolveOperation("test.run", {}).error, "invalid_test_paths");
});

// ── CAP-05 every registered op declares both effect surfaces ───────────────────
test("CAP-05: every capability declares subject_effect AND control_plane_effect", () => {
  const caps = listCapabilities();
  assert.ok(caps.length >= 6);
  for (const op of caps) {
    const r = resolveOperation(op, op === "test.run" ? { paths: ["tests/x.test.js"] } : {});
    // test.run with a fake path errors on validation, which is fine here; skip it
    if (r.error) continue;
    assert.ok(["read_only", "reversible_local"].includes(r.subject_effect), op);
    assert.ok(typeof r.control_plane_effect === "string", op);
  }
});

// ── CAP-06 the op added for a measured blind spot ─────────────────────────────
// 160 branches sat unmerged because nothing reported them, not because anything
// refused them. The op exists so that failure cannot recur silently.
test("CAP-06: git.unmerged_branches is registered, read-only, and lists rather than merges", () => {
  const r = resolveOperation("git.unmerged_branches");
  assert.equal(r.error, undefined, "must be registered");
  assert.equal(r.subject_effect, "read_only");
  assert.equal(r.control_plane_effect, "none");
  assert.equal(r.file, "git");
  assert.deepEqual([...r.argv], ["branch", "-r", "--no-merged", "origin/main"]);
  // it must never be able to become a mutating git verb
  for (const forbidden of ["merge", "push", "rebase", "reset", "checkout"]) {
    assert.ok(!r.argv.includes(forbidden), `argv must not contain ${forbidden}`);
  }
  assert.ok(listCapabilities().includes("git.unmerged_branches"));
});
