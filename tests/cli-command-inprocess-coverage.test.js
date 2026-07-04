import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { cmd_adk } from "../apps/cli/src/commands/adk.js";
import { cmd_assets } from "../apps/cli/src/commands/assets.js";
import { cmd_authorship } from "../apps/cli/src/commands/authorship.js";
import { cmd_models } from "../apps/cli/src/commands/models.js";
import { cmd_node0 } from "../apps/cli/src/commands/node0.js";
import { cmd_urp } from "../apps/cli/src/commands/urp.js";

class ExitSignal extends Error {
  constructor(code) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

async function captureCommand(run, { env = {} } = {}) {
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalEnv = {};
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  const toText = (chunk) =>
    typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");

  for (const key of Object.keys(env)) originalEnv[key] = process.env[key];
  process.exitCode = undefined;
  Object.assign(process.env, env);
  process.exit = (code = 0) => {
    throw new ExitSignal(code);
  };
  process.stdout.write = (chunk, encoding, callback) => {
    stdout += toText(chunk);
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  };
  process.stderr.write = (chunk, encoding, callback) => {
    stderr += toText(chunk);
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    await run();
    exitCode = process.exitCode ?? 0;
  } catch (err) {
    if (!(err instanceof ExitSignal)) throw err;
    exitCode = err.code;
  } finally {
    process.exit = originalExit;
    process.exitCode = originalExitCode;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    for (const key of Object.keys(env)) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }

  return { stdout, stderr, exitCode };
}

test("deterministic command render branches are covered in process", async () => {
  const json = await captureCommand(() =>
    cmd_models({
      subcommand: "catalog",
      argv: [
        "models",
        "catalog",
        "--provider",
        "ollama",
        "--model",
        "qwen2.5:7b",
        "--json",
      ],
    }),
  );
  assert.equal(json.exitCode, 0);
  assert.equal(JSON.parse(json.stdout).compatibility, "compatible");

  const human = await captureCommand(() =>
    cmd_models({
      subcommand: "catalog",
      argv: [
        "models",
        "catalog",
        "--provider",
        "lmstudio",
        "--model",
        "qwen/qwen3-coder",
      ],
    }),
  );
  assert.equal(human.exitCode, 0);
  assert.match(human.stdout, /Dema models catalog/);
  assert.match(human.stdout, /Compatibility:/);

  const scan = await captureCommand(() =>
    cmd_models({
      subcommand: "scan",
      argv: ["models", "scan", "--summary", "--json"],
    }),
  );
  assert.equal(scan.exitCode, 0);
  assert.ok(scan.stdout.length > 0);

  const inventory = await captureCommand(() =>
    cmd_models({ subcommand: undefined, argv: ["models"] }),
  );
  assert.equal(inventory.exitCode, 0);
  assert.match(inventory.stdout, /Dema|model|Model/i);

  const node0Json = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "map", "--json"] }),
  );
  assert.equal(node0Json.exitCode, 0);
  assert.equal(
    JSON.parse(node0Json.stdout).schema,
    "bizra.dema.node0_rosetta_constitution_preview.v0.1",
  );

  const node0Human = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "map"] }),
  );
  assert.equal(node0Human.exitCode, 0);
  assert.match(node0Human.stdout, /Node0 Rosetta Constitution/);

  const observeJson = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "activation", "observe", "--json"] }),
  );
  assert.equal(observeJson.exitCode, 0);
  assert.equal(
    JSON.parse(observeJson.stdout).schema,
    "bizra.dema.node0_activation_observe.v0.1",
  );

  const ladderJson = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "ladder", "--json"] }),
  );
  assert.equal(ladderJson.exitCode, 0);
  assert.equal(
    JSON.parse(ladderJson.stdout).schema,
    "bizra.dema.node0_activation_ladder.v0.1",
  );

  const ladderHuman = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "ladder"] }),
  );
  assert.equal(ladderHuman.exitCode, 0);
  assert.match(ladderHuman.stdout, /Node0 activation ladder/);

  const chainJson = await captureCommand(() =>
    cmd_node0({
      argv: [
        "node0",
        "chain",
        "--pain",
        "too much manual checking",
        "--goal",
        "bounded preview",
        "--self-loop",
        "--json",
      ],
    }),
  );
  assert.equal(chainJson.exitCode, 0);
  assert.equal(
    JSON.parse(chainJson.stdout).schema,
    "bizra.dema.node0_activation_chain_preview.v0.1",
  );

  const mumuStatus = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "mumu", "status", "--json"] }),
  );
  assert.equal(mumuStatus.exitCode, 0);
  assert.ok(JSON.parse(mumuStatus.stdout).schema);

  const mumuConsent = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "mumu", "consent"] }),
  );
  assert.equal(mumuConsent.exitCode, 0);
  assert.match(mumuConsent.stdout, /Node0 Mumu consent/);

  const result = await captureCommand(() =>
    cmd_node0({ argv: ["node0", "missing"] }),
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Mumu closed-loop face/);

  const patTemplate = await captureCommand(() =>
    cmd_adk({ argv: ["adk", "agent", "template", "pat-engineer", "--json"] }),
  );
  assert.equal(patTemplate.exitCode, 0);
  assert.equal(JSON.parse(patTemplate.stdout).validation.valid, true);

  const satTemplate = await captureCommand(() =>
    cmd_adk({ argv: ["adk", "agent", "template", "sat-verifier"] }),
  );
  assert.equal(satTemplate.exitCode, 0);
  assert.match(satTemplate.stdout, /ADK template: sat-verifier/);

  const unknownTemplate = await captureCommand(() =>
    cmd_adk({ argv: ["adk", "agent", "template", "unknown"] }),
  );
  assert.equal(unknownTemplate.exitCode, 1);
  assert.match(unknownTemplate.stderr, /unknown template id/);

  const tempRoot = await mkdtemp(join(tmpdir(), "dema-cli-inprocess-"));
  const harnessSuite = await captureCommand(() =>
    cmd_adk({ argv: ["adk", "harness", "run", "--json"] }),
  );
  assert.equal(harnessSuite.exitCode, 0);
  assert.equal(JSON.parse(harnessSuite.stdout).verdict, "CLEAN");

  const missingAssetsScanRoot = await captureCommand(() =>
    cmd_assets({ argv: ["assets", "scan", "--json"] }),
  );
  assert.equal(missingAssetsScanRoot.exitCode, 1);
  assert.equal(JSON.parse(missingAssetsScanRoot.stdout).error, "missing_scan_root");

  const missingShareabilityRoot = await captureCommand(() =>
    cmd_assets({ argv: ["assets", "shareability"] }),
  );
  assert.equal(missingShareabilityRoot.exitCode, 1);
  assert.match(missingShareabilityRoot.stderr, /assets shareability/);

  await writeFile(join(tempRoot, "README.md"), "# sample\n");
  const assetScan = await captureCommand(
    () =>
      cmd_assets({
        argv: ["assets", "scan", "--root", tempRoot, "--json"],
      }),
    { env: { DEMA_HOME: join(tempRoot, ".dema") } },
  );
  assert.equal(assetScan.exitCode, 0);
  assert.equal(JSON.parse(assetScan.stdout).valid, true);

  const authorshipDemo = await captureCommand(() =>
    cmd_authorship({ argv: ["authorship", "demo", "--json"] }),
  );
  assert.equal(authorshipDemo.exitCode, 0);
  assert.equal(JSON.parse(authorshipDemo.stdout).mode, "EPHEMERAL_DEMO");

  const latestMissing = await captureCommand(
    () => cmd_authorship({ argv: ["authorship", "latest"] }),
    { env: { DEMA_HOME: join(tempRoot, "empty-dema") } },
  );
  assert.equal(latestMissing.exitCode, 1);
  assert.match(latestMissing.stdout, /No authorship receipts found/);

  const verifyMissingLatest = await captureCommand(
    () => cmd_authorship({ argv: ["authorship", "verify", "--latest", "--json"] }),
    { env: { DEMA_HOME: join(tempRoot, "empty-dema") } },
  );
  assert.equal(verifyMissingLatest.exitCode, 1);
  assert.equal(JSON.parse(verifyMissingLatest.stdout).error, "no_authorship_receipts_found");

  const urpHome = join(tempRoot, "urp-home");
  const missingPassport = await captureCommand(() =>
    cmd_urp({ argv: ["urp", "index", "--json"] }),
  );
  assert.equal(missingPassport.exitCode, 1);
  assert.match(missingPassport.stderr, /urp index/);

  const invalidPassportPath = join(tempRoot, "invalid-passport.json");
  await writeFile(invalidPassportPath, "{not-json\n");
  const invalidPassport = await captureCommand(() =>
    cmd_urp({
      argv: ["urp", "index", "--passport", invalidPassportPath, "--json"],
    }),
  );
  assert.equal(invalidPassport.exitCode, 1);
  assert.match(invalidPassport.stdout, /invalid_passport_json/);

  const unreadablePassport = await captureCommand(() =>
    cmd_urp({
      argv: ["urp", "index", "--passport", join(tempRoot, "missing.json")],
    }),
  );
  assert.equal(unreadablePassport.exitCode, 1);
  assert.match(unreadablePassport.stdout, /cannot read/);

  const listEmpty = await captureCommand(
    () => cmd_urp({ argv: ["urp", "list"] }),
    { env: { DEMA_HOME: urpHome } },
  );
  assert.equal(listEmpty.exitCode, 0);
  assert.match(listEmpty.stdout, /URP Local Indexes: \(none\)/);

  const verifyMissing = await captureCommand(() =>
    cmd_urp({ argv: ["urp", "verify", "--json"] }),
  );
  assert.equal(verifyMissing.exitCode, 1);
  assert.match(verifyMissing.stderr, /urp verify/);

  const chooseVerifyMissing = await captureCommand(() =>
    cmd_urp({ argv: ["urp", "choose", "verify", "--json"] }),
  );
  assert.equal(chooseVerifyMissing.exitCode, 1);
  assert.match(chooseVerifyMissing.stderr, /choose verify/);

  const chooseListEmpty = await captureCommand(
    () => cmd_urp({ argv: ["urp", "choose", "list", "--json"] }),
    { env: { DEMA_HOME: urpHome } },
  );
  assert.equal(chooseListEmpty.exitCode, 0);
  assert.equal(JSON.parse(chooseListEmpty.stdout).count, 0);

  const chooseMissingIndex = await captureCommand(() =>
    cmd_urp({ argv: ["urp", "choose", "--json"] }),
  );
  assert.equal(chooseMissingIndex.exitCode, 1);
  assert.match(chooseMissingIndex.stderr, /urp choose/);

  const chooseMissingDecision = await captureCommand(() =>
    cmd_urp({ argv: ["urp", "choose", invalidPassportPath] }),
  );
  assert.equal(chooseMissingDecision.exitCode, 1);
  assert.match(chooseMissingDecision.stderr, /--decision is required/);

  const chooseInvalidDecision = await captureCommand(() =>
    cmd_urp({
      argv: ["urp", "choose", invalidPassportPath, "--decision", "MAYBE"],
    }),
  );
  assert.equal(chooseInvalidDecision.exitCode, 1);
  assert.match(chooseInvalidDecision.stderr, /invalid --decision/);

  const chooseInvalidJson = await captureCommand(() =>
    cmd_urp({
      argv: [
        "urp",
        "choose",
        invalidPassportPath,
        "--decision",
        "MARK_SHAREABLE",
        "--json",
      ],
    }),
  );
  assert.equal(chooseInvalidJson.exitCode, 1);
  assert.match(chooseInvalidJson.stdout, /invalid_index_json/);

  const urpLaunch = await captureCommand(
    () =>
      cmd_urp({
        argv: [
          "urp",
          "launch-5sat",
          "--consent",
          "LAUNCH NODE0 URP WITH 5 SAT ONLY AND LOCK AGAINST PAT/DEMA/MOMO",
          "--json",
        ],
      }),
    { env: { DEMA_HOME: join(tempRoot, "launch-home") } },
  );
  assert.equal(urpLaunch.exitCode, 0);
  assert.equal(JSON.parse(urpLaunch.stdout).launched, true);

  const node1PreviewRefused = await captureCommand(() =>
    cmd_urp({ argv: ["urp", "node1-5sat-preview", "--json"] }),
  );
  assert.equal(node1PreviewRefused.exitCode, 1);
  assert.match(node1PreviewRefused.stderr, /exact --consent/);

  const node1Preview = await captureCommand(
    () =>
      cmd_urp({
        argv: [
          "urp",
          "node1-5sat-preview",
          "--consent",
          "DECLARE NODE1 5 SAT VIA UNIVERSAL POOL",
          "--json",
        ],
      }),
    { env: { DEMA_HOME: join(tempRoot, "node1-home") } },
  );
  assert.equal(node1Preview.exitCode, 0);
  assert.equal(JSON.parse(node1Preview.stdout).preview, true);
});
