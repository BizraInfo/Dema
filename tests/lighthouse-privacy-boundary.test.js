import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Lighthouse archives exclude operator-session transcripts", async () => {
  const { stdout } = await execFileAsync(
    "git",
    ["check-attr", "export-ignore", "--", "sessionlast.md", "eval season plan e.md"],
    { cwd: root },
  );
  assert.deepEqual(stdout.trim().split("\n"), [
    "sessionlast.md: export-ignore: set",
    "eval season plan e.md: export-ignore: set",
  ]);
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

test("Lighthouse user-service installer refuses incomplete Root DNA before writing units", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "node0-service-install-"));
  const fixtureRoot = join(fixture, "repo");
  const home = join(fixture, "home");
  const roots = join(fixture, "roots");
  const units = join(fixture, "units");
  try {
    await mkdir(home, { recursive: true });
    await mkdir(roots, { recursive: true });
    await writeFile(join(home, "profile.json"), "{}\n");
    const files = [
      "scripts/install/install-node0-user-services.sh",
      "apps/cli/src/commands/identity-root-gatherer.js",
      "package.json",
    ];
    for (const relative of files) {
      const target = join(fixtureRoot, relative);
      await mkdir(dirname(target), { recursive: true });
      await cp(join(root, relative), target);
    }
    await cp(join(root, "packages/core/src"), join(fixtureRoot, "packages/core/src"), { recursive: true });
    await cp(join(root, "packages/consent/src"), join(fixtureRoot, "packages/consent/src"), { recursive: true });
    await mkdir(join(fixtureRoot, "packages/dema-ui/.next/standalone/packages/dema-ui"), { recursive: true });
    await writeFile(join(fixtureRoot, "packages/dema-ui/.next/standalone/packages/dema-ui/server.js"), "");
    const script = join(fixtureRoot, "scripts/install/install-node0-user-services.sh");
    await assert.rejects(
      execFileAsync("bash", [script, "--render", "--dema-home", home, "--roots-dir", roots, "--unit-dir", units], { cwd: fixtureRoot }),
      /root_unreadable/,
    );
    await assert.rejects(readFile(join(units, "dema-homebase.service")));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
