import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Lighthouse archives exclude the operator-session transcript", async () => {
  const { stdout } = await execFileAsync(
    "git",
    ["check-attr", "export-ignore", "--", "sessionlast.md"],
    { cwd: root },
  );
  assert.equal(stdout.trim(), "sessionlast.md: export-ignore: set");
});

test("Lighthouse front door has no hard-coded Momo identity fallback", async () => {
  const [runtime, page] = await Promise.all([
    readFile(join(root, "packages/dema-ui/src/app/api/mission/node0-runtime.ts"), "utf8"),
    readFile(join(root, "packages/dema-ui/src/app/mission/page.tsx"), "utf8"),
  ]);
  assert.doesNotMatch(runtime, /BIZRA_NODE0_DISPLAY_NAME\s*\|\|\s*["']Momo["']/);
  assert.match(runtime, /human_display_name_unbound/);
  assert.doesNotMatch(page, /DEMA · Momo · local proposal/);
});
