// NODE0-SEASON-ACTION-AUTHORITY-1A — Phase 5 truth-boundary test.
//
// A pure evaluator must not flip a runtime-enforcement flag. This file exists so
// that adding the predicate can never be mistaken for wiring it: every claim
// below must remain FALSE until Slice B (FATE integration) and Slice C
// (reversible effect + recovery proof) land.
//
// If a later change makes one of these true, this test fails and forces the
// claim to be argued rather than absorbed.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  evaluateSeasonActionAuthority,
} from "../packages/core/src/node0-minimum-season-save-resume.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const KERNEL = `${REPO}packages/core/src/node0-minimum-season-save-resume.js`;
const MISSION_CLI = `${REPO}apps/cli/src/commands/mission.js`;

test("NC-01 the corridor CLI route is NOT season-gated by this slice", () => {
  const cli = readFileSync(MISSION_CLI, "utf8");
  assert.equal(
    cli.includes("evaluateSeasonActionAuthority"),
    false,
    "CORRIDOR_RENAME_SEASON_GATE_LIVE became true — the CLI now calls the predicate",
  );
});

test("NC-02 FATE is NOT integrated on the corridor route by this slice", () => {
  for (const rel of ["packages/mission/src/mission-corridor-closure.js", "packages/mission/src/corridor-closure-gatherer.js"]) {
    const p = `${REPO}${rel}`;
    if (!existsSync(p)) continue;
    const src = readFileSync(p, "utf8");
    assert.equal(
      /packages\/fate|from ["'].*fate\.js["']/.test(src),
      false,
      `FATE_EFFECT_ROUTE_INTEGRATED became true in ${rel} — that is Slice B, not this one`,
    );
  }
});

test("NC-03 the kernel executes no effect: no fs, exec, network or clock", () => {
  const src = readFileSync(KERNEL, "utf8");
  // Control: the file is non-empty and really is the kernel we mean.
  assert.ok(src.length > 1000, "kernel source unexpectedly small — check the path");
  assert.ok(src.includes("evaluateSeasonActionAuthority"), "wrong file bound");
  for (const forbidden of ["node:fs", "node:child_process", "node:net", "node:http", "node:https"]) {
    assert.equal(
      src.includes(`from "${forbidden}"`),
      false,
      `CORRIDOR_RENAME_EFFECT_EXECUTED risk — kernel imports ${forbidden}`,
    );
  }
});

test("NC-04 MUST_NOT_REPEAT_EFFECT_GATE_ENFORCED remains false", () => {
  // Enforcement means an effect cannot occur without passing the predicate.
  // Nothing in this slice binds the predicate to an effect boundary, so the
  // only honest value is false. The proof is NC-01: no caller exists.
  const cli = readFileSync(MISSION_CLI, "utf8");
  const callers = (cli.match(/evaluateSeasonActionAuthority/g) ?? []).length;
  assert.equal(callers, 0, "an effect route now calls the predicate — enforcement claim must be re-argued");
});

test("NC-05 a successful verdict never reads as execution authority", () => {
  const r = evaluateSeasonActionAuthority({});
  assert.notEqual(r.verdict, "AUTHORIZED_TO_EXECUTE");
  assert.equal(r.authority_delta, 0);
  assert.equal(r.consent_still_required, true);
  assert.equal(r.fate_still_required, true);
});

test("NC-06 NODE0_LOCAL_MISSION_PROVEN and DEMA_ACTIVE_LOCAL are not claimed here", () => {
  const src = readFileSync(KERNEL, "utf8");
  for (const flag of ["NODE0_LOCAL_MISSION_PROVEN", "DEMA_ACTIVE_LOCAL", "NODE0_CLOSED"]) {
    assert.equal(src.includes(`${flag} = true`), false, `kernel asserts ${flag}`);
    assert.equal(src.includes(`${flag}: true`), false, `kernel asserts ${flag}`);
  }
});
