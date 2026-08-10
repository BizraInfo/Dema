// Test-only process preload: the MIRROR of kill-before-pointer-commit-preload.
//
// That one kills before the active pointer commits, leaving the old fingerprint
// retired and the pointer un-advanced — a liveness stall with authority still
// held by the old generation.
//
// This one lets the pointer rename COMPLETE and then delivers a real SIGKILL,
// which places the crash on the other side of the authority boundary: the new
// generation is authoritative, and the rotation receipt has not been written.
// That is the state the crash matrix needs and the one no existing fixture
// produced.
//
// Production code contains no fault-injection branch. The kill arms only when a
// retired registry already exists in the watched keys dir, so the identical
// rename inside `initAuthorshipKey` (genesis activation, no retirement on disk)
// runs untouched.

import { existsSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { basename, join } from "node:path";

const keysDir = process.env.BIZRA_TEST_CP5_KEYS_DIR || "";
const retiredRegistry = keysDir ? join(keysDir, "retired-registry.json") : "";
const originalRename = fsPromises.rename;

fsPromises.rename = async function killAfterPointerCommit(from, to, ...rest) {
  const armed =
    retiredRegistry
    && basename(String(to)) === "active-key.json"
    && existsSync(retiredRegistry);
  const result = await originalRename.call(this, from, to, ...rest);
  if (armed) process.kill(process.pid, "SIGKILL");
  return result;
};

syncBuiltinESMExports();
