import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { measureBootLatency } from "../scripts/perf-bench.mjs";
import { measureCliBootMs } from "../scripts/review/performance-budget-gate.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PROBES = [
  { script: "scripts/perf-bench.mjs", measure: measureBootLatency, calls: 5, durations: [50, 10, 30, 20, 40], median: 30 },
  { script: "scripts/review/performance-budget-gate.mjs", measure: measureCliBootMs, calls: 4, durations: [30, 10, 20], median: 20 },
];

for (const { script, measure, calls: expectedCalls, durations, median } of PROBES) {
  test(`${script} preserves successful samples and propagates every failed invocation`, () => {
    const calls = [];
    const ticks = durations.flatMap((duration) => [0, duration]);
    assert.equal(measure({ execute: (...args) => calls.push(args), clock: { now: () => ticks.shift() } }), median);
    assert.equal(calls.length, expectedCalls);
    assert.equal(ticks.length, 0);
    for (const [command, args, options] of calls) {
      assert.equal(command, "node");
      assert.equal(args[0], join(ROOT, "apps/cli/src/index.js"));
      assert.deepEqual(args.slice(1), ["status", "--json"]);
      assert.equal(options.timeout, 5000);
      assert.equal(options.stdio, "ignore");
      assert.equal(options.env.DEMA_NODE0_ADAPTER, "local");
    }
    for (const detail of [{ status: 23 }, { code: "ETIMEDOUT" }, { code: "ENOENT" }, { signal: "SIGTERM" }]) {
      for (let position = 0; position < expectedCalls; position++) {
        const error = Object.assign(new Error("probe failed"), detail);
        let count = 0;
        assert.throws(() => measure({
          execute() { if (count++ === position) throw error; },
          clock: { now: () => 0 },
        }), (thrown) => thrown === error);
        assert.equal(count, position + 1, "no subsequent probe after failure");
      }
    }
    const recoveryTicks = durations.flatMap((duration) => [0, duration]);
    assert.equal(measure({ execute() {}, clock: { now: () => recoveryTicks.shift() } }), median);
  });

  for (const args of [[], ["--json"]]) {
    test(`${script} ${args.join(" ")} refuses a failed child without a measurement`, () => {
      const root = mkdtempSync(join(tmpdir(), "dema-perf-failure-"));
      try {
        const bin = join(root, "bin");
        const home = join(root, "home");
        const count = join(root, "calls");
        mkdirSync(bin);
        mkdirSync(home);
        writeFileSync(join(bin, "node"), `#!/bin/sh
calls=0
if [ -f "$PERF_PROBE_CALLS" ]; then read -r calls < "$PERF_PROBE_CALLS"; fi
calls=$((calls + 1))
printf '%s\\n' "$calls" > "$PERF_PROBE_CALLS"
exit 23
`, { mode: 0o700 });
        const result = spawnSync(process.execPath, [join(ROOT, script), ...args], {
          cwd: ROOT,
          encoding: "utf8",
          timeout: 10_000,
          env: { PATH: bin, DEMA_HOME: home, DEMA_NODE0_ADAPTER: "local", DEMA_NO_TUI: "1", PERF_PROBE_CALLS: count },
        });
        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.equal(result.signal, null);
        assert.equal(result.stdout, "", "failed probes must not emit a complete measurement");
        assert.match(result.stderr, /Command failed: node .*status --json/);
        assert.equal(readFileSync(count, "utf8").trim(), "1", "stop before launching another probe");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
}
