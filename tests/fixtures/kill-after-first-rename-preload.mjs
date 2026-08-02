// Test-only process preload: replace the Node fs builtin before the CLI module
// graph loads, then deliver a real SIGKILL after the no-replace target link is
// published but before the exact source unlink. Production code contains no
// fault-injection branch.

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { resolve } from "node:path";

const expectedPath = resolve(process.env.BIZRA_TEST_KILL_UNLINK_PATH || "/never/unlink");
const expectedSuffix = `/${expectedPath.split("/").at(-1)}`;
const originalUnlinkSync = fs.unlinkSync;

fs.unlinkSync = function killBeforeExactSourceUnlink(path, ...rest) {
  const observed = String(path);
  if (resolve(observed) === expectedPath || observed.endsWith(expectedSuffix)) {
    process.kill(process.pid, "SIGKILL");
  }
  return originalUnlinkSync.call(this, path, ...rest);
};

syncBuiltinESMExports();
