// Test-only process preload: replace node:fs/promises `rename` before the store
// module graph loads, then deliver a real SIGKILL at the exact CP5 boundary —
// after `appendRetiredRegistry` has durably retired the old fingerprint and
// before the active pointer commits. Production code contains no fault-injection
// branch.
//
// The kill arms only when a retired registry already exists in the watched keys
// dir, so the identical rename inside `initAuthorshipKey` (which activates the
// genesis generation with no retirement on disk) runs untouched.

import { existsSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { basename, join } from "node:path";

const keysDir = process.env.BIZRA_TEST_CP5_KEYS_DIR || "";
const retiredRegistry = keysDir ? join(keysDir, "retired-registry.json") : "";
const originalRename = fsPromises.rename;

fsPromises.rename = async function killBeforePointerCommit(from, to, ...rest) {
  if (
    retiredRegistry
    && basename(String(to)) === "active-key.json"
    && existsSync(retiredRegistry)
  ) {
    process.kill(process.pid, "SIGKILL");
  }
  return originalRename.call(this, from, to, ...rest);
};

syncBuiltinESMExports();
