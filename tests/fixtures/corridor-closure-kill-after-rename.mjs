// Child-process fault injector for CTX-02.
//
// The parent has already established the exact C1 claim. This process drives
// the real C2/Omega0 no-replace move, then dies after the destination hard link
// is published but before the source link is removed or EFFECT_APPLIED can be
// appended. No cleanup hook or thrown exception is allowed to turn the process
// loss into an in-process simulation.

import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { resolve } from "node:path";

const config = JSON.parse(await readFile(process.argv[2], "utf8"));
const sourcePath = resolve(config.effect.scopeRoot, config.effect.from);
const sourceSuffix = `/${config.effect.from}`;
const originalUnlinkSync = fs.unlinkSync;
fs.unlinkSync = function killBeforeExactSourceUnlink(path, ...rest) {
  if (resolve(String(path)) === sourcePath || String(path).endsWith(sourceSuffix)) {
    process.kill(process.pid, "SIGKILL");
  }
  return originalUnlinkSync.call(this, path, ...rest);
};
syncBuiltinESMExports();

const {
  buildRenameEffectAdapter,
  runTransactionalMechanicalClosure,
} = await import("../../packages/mission/src/corridor-closure-gatherer.js");
const base = buildRenameEffectAdapter(config.effect);

await runTransactionalMechanicalClosure({ ...config.args, effect: base });

// Reaching here would mean the fault injector did not terminate at the real
// boundary. Keep that distinguishable from the expected SIGKILL.
process.exitCode = 91;
