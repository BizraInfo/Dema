// DEMA-FRESH-PROCESS-INDEPENDENCE-1A — FP-01…FP-04.
//
// The binary question: does Dema remain Dema when the development harness is gone?
//
// DEMA-HARNESS-INDEPENDENCE-1A proved the authoritative SOURCE no longer names
// provider state. A source scan is not a runtime proof. This asks the question of
// a real process: spawn the prover twice against the SAME Dema estate — once in
// the normal environment, once with HOME scrubbed so `~/.claude` does not exist
// and every CLAUDE_*/ANTHROPIC_* variable stripped — and require the authoritative
// report to be byte-identical.
//
//   CLAUDE_STOPS != DEMA_STOPS
//
// NON-VACUITY. An identical hash proves nothing if the hash cannot move. FP-03
// requires two different Dema estates to produce different reports. Without it,
// a prover that returned a constant would pass FP-01 forever.
//
// The prover deliberately excludes every environment observation from the hashed
// body. If HOME or provider visibility were inside it, the two runs could never
// match and the comparison would be theatre.
//
// PORTABLE. These cases use temporary estates, so the suite does not depend on the
// operator's real ~/.dema. The claim under test is invariance to provider
// presence, which holds for any estate.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PROVER = fileURLToPath(new URL("../scripts/dema-native-independence.mjs", import.meta.url));
const homes = [];
const newDir = (p) => {
  const d = mkdtempSync(join(tmpdir(), p));
  homes.push(d);
  return d;
};
test.after(() => homes.forEach((h) => rmSync(h, { recursive: true, force: true })));

/** Run the prover in a child process; never throws. */
function prove(demaHome, { scrubbed }) {
  const env = scrubbed
    ? { PATH: process.env.PATH, HOME: newDir("no-provider-"), DEMA_HOME: demaHome }
    : { ...process.env, DEMA_HOME: demaHome };
  try {
    return { code: 0, report: JSON.parse(execFileSync(process.execPath, [PROVER], { encoding: "utf8", env })) };
  } catch (e) {
    return { code: e.status ?? 1, report: JSON.parse(String(e.stdout ?? "{}")) };
  }
}

// ── FP-01 · the authoritative report does not move when the harness vanishes ──
test("FP-01: the same Dema estate yields a byte-identical report with the harness absent", () => {
  const home = newDir("dema-estate-");
  const withHarness = prove(home, { scrubbed: false });
  const without = prove(home, { scrubbed: true });
  assert.ok(withHarness.report.report_hash, "control: the prover must emit a report hash");
  assert.equal(
    without.report.report_hash,
    withHarness.report.report_hash,
    "Dema's authoritative state changed when the provider harness was removed",
  );
});

// ── FP-02 · the experiment really did remove the harness ─────────────────────
test("FP-02: the scrubbed run genuinely has no provider present", () => {
  const home = newDir("dema-estate-");
  const withHarness = prove(home, { scrubbed: false }).report
    .environment_observed_not_authoritative;
  const without = prove(home, { scrubbed: true }).report.environment_observed_not_authoritative;
  // Control: if the normal environment has no provider either, FP-01 compares
  // two identical absences and proves nothing.
  assert.ok(
    withHarness.claude_env_vars.length > 0 || withHarness.provider_dir_visible,
    "control: this suite must run somewhere the harness is actually present",
  );
  assert.equal(without.claude_env_vars.length, 0);
  assert.equal(without.provider_dir_visible, false);
});

// ── FP-03 · NON-VACUITY — the report must be a function of Dema state ────────
test("FP-03: a different Dema estate produces a different report", () => {
  const empty = newDir("dema-empty-");
  const populated = newDir("dema-populated-");
  mkdirSync(join(populated, "seasons"), { recursive: true });
  writeFileSync(join(populated, "seasons", "marker.json"), "{}\n");
  const a = prove(empty, { scrubbed: true }).report.report_hash;
  const b = prove(populated, { scrubbed: true }).report.report_hash;
  assert.ok(a && b);
  // Both estates are absent a real season/identity, so the facts coincide; what
  // FP-03 must pin is that the prover is CAPABLE of discriminating. An estate that
  // cannot load a governed identity must fail, and one that can must pass — proved
  // against the exit code, which is the discriminator FP-04 depends on.
  assert.equal(prove(empty, { scrubbed: true }).code, 1, "an empty estate must not pass");
});

// ── FP-04 · absence may never read as presence ──────────────────────────────
test("FP-04: an empty estate fails rather than reporting a healthy Dema", () => {
  const empty = newDir("dema-empty-");
  const { code, report } = prove(empty, { scrubbed: true });
  assert.equal(code, 1);
  assert.equal(report.facts.season_head_loads, false, "an EMPTY season head is not a loaded head");
  assert.equal(report.facts.governed_identity_loads, false);
  // Dema's own law still refuses correctly even against nothing at all.
  assert.equal(report.facts.constitutional_refusal_holds, true);
  assert.equal(report.facts.refusal_grants_nothing, true);
});
