import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, symlink, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runSetup } from "../packages/installer/src/setup.js";

// Salvaged idea (QWEN-CODE-SCREEN 2026-06-02): close the TOCTOU write-through
// in writeJsonIfMissing. The exists()-then-writeFile pattern follows a symlink
// at the target path and clobbers/creates a victim OUTSIDE the dema root. The
// fix is an atomic exclusive create (flag "wx" = O_CREAT|O_EXCL), which fails
// closed on any pre-existing path, including a symlink — no write-through.

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("runSetup symlink containment", () => {
  it("does not write through a symlinked profile.json to a victim outside root", async () => {
    const root = await mkdtemp(join(tmpdir(), "dema-symlink-root-"));
    const victimDir = await mkdtemp(join(tmpdir(), "dema-symlink-victim-"));
    const victimPath = join(victimDir, "victim.json");

    // Plant a symlink at the path runSetup will try to write.
    await symlink(victimPath, join(root, "profile.json"));

    await runSetup(root);

    assert.equal(
      await fileExists(victimPath),
      false,
      "runSetup must not create/clobber a file outside the dema root via a symlink",
    );
  });
});
