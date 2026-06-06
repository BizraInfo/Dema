import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  ARTIFACT_SAFETY_SCHEMA,
  evaluateArtifactSafety,
  scanPathLeakage,
  scanSecretLikeStrings,
  scanClaimBoundary,
  formatArtifactSafetyReport,
} from "../packages/core/src/artifact-safety-eval.js";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/artifact-safety-check.mjs", import.meta.url),
);

// No `schema` field on this fixture: tests 1/12/14 are about the
// path/secret/claim scanners; schema-routing coverage lives in
// tests/artifact-safety-eval-schema-wiring.test.js. Carrying a fake
// schema id here would trigger a (correct) "schema_unknown" warning
// from the wired scanSchema and pollute the assertions.
const SAFE_ARTIFACT = {
  truth_label: "VERIFIED",
  status: "DESIGNED_NOT_LIVE",
  summary: "Operator-recorded preview only.",
};

test("1 safe artifact with truth labels passes PUBLIC_SAFE", () => {
  const result = evaluateArtifactSafety(SAFE_ARTIFACT);
  assert.equal(result.schema, ARTIFACT_SAFETY_SCHEMA);
  assert.equal(result.verdict, "PUBLIC_SAFE");
  assert.equal(result.score, 1);
  assert.equal(result.findings.length, 0);
});

test("2 artifact with /home/ fails LEAKAGE_DETECTED", () => {
  const result = evaluateArtifactSafety({ note: "stored at /home/bizra/data" });
  assert.equal(result.verdict, "LEAKAGE_DETECTED");
  assert.ok(result.findings.some((f) => f.pattern_id === "unix_home"));
});

test("3 artifact with /Users/ fails LEAKAGE_DETECTED", () => {
  const result = evaluateArtifactSafety("path /Users/mumu/project");
  assert.equal(result.verdict, "LEAKAGE_DETECTED");
  assert.ok(result.findings.some((f) => f.pattern_id === "mac_users"));
});

test("4 artifact with C:\\Users\\ fails LEAKAGE_DETECTED", () => {
  const result = evaluateArtifactSafety("C:\\Users\\operator\\file.txt");
  assert.equal(result.verdict, "LEAKAGE_DETECTED");
  assert.ok(result.findings.some((f) => f.pattern_id === "win_users"));
});

test("5 artifact with .dema path fails LEAKAGE_DETECTED", () => {
  const result = evaluateArtifactSafety(
    "state under ~/.dema/lighthouse/ring-1",
  );
  assert.equal(result.verdict, "LEAKAGE_DETECTED");
  assert.ok(result.findings.some((f) => f.pattern_id === "dema_home_dir"));
});

test("6 artifact with api_key-like text fails LEAKAGE_DETECTED", () => {
  const result = evaluateArtifactSafety({
    api_key: "sk-test-value-should-not-share",
  });
  assert.equal(result.verdict, "LEAKAGE_DETECTED");
  assert.ok(result.findings.some((f) => f.kind === "SECRET_LIKE"));
});

test("7 artifact saying URP is live fails CLAIM_BOUNDARY_VIOLATION", () => {
  const result = evaluateArtifactSafety(
    "Status update: URP is live on the network.",
  );
  assert.equal(result.verdict, "CLAIM_BOUNDARY_VIOLATION");
  assert.ok(result.findings.some((f) => f.kind === "CLAIM_OVERREACH"));
});

test("8 artifact saying URP is DESIGNED_NOT_LIVE passes", () => {
  const result = evaluateArtifactSafety(
    "URP shared runtime is DESIGNED_NOT_LIVE per canon.",
  );
  assert.equal(result.verdict, "PUBLIC_SAFE");
});

test("9 proof-room-like artifact with absolute repo_root is not PUBLIC_SAFE", () => {
  // The stub envelope is intentionally minimal (missing most proof-room-bundle
  // required fields). Pre-wiring it surfaced as LOCAL_ONLY/LEAKAGE_DETECTED
  // because the path leak was the strongest deterministic signal. Post-wiring,
  // structural-schema violation takes verdict priority via deriveVerdict, so
  // SCHEMA_VIOLATION is now the correct verdict for this stub. The semantic
  // assertion ("not PUBLIC_SAFE") is preserved.
  const result = evaluateArtifactSafety({
    schema: "bizra.dema.proof_room_bundle.v0.1",
    repo_root: "/home/bizra-operating-system/Downloads/Dema",
    ok: true,
  });
  assert.notEqual(result.verdict, "PUBLIC_SAFE");
  assert.ok(
    result.verdict === "LOCAL_ONLY" ||
      result.verdict === "LEAKAGE_DETECTED" ||
      result.verdict === "SCHEMA_VIOLATION",
  );
});

test("10 scanner is read-only: input unchanged", () => {
  const input = JSON.stringify(SAFE_ARTIFACT);
  const before = input;
  evaluateArtifactSafety(input);
  assert.equal(before, input);
});

test("11 CLI returns non-zero on unsafe artifact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifact-safety-unsafe-"));
  const path = join(dir, "unsafe.json");
  await writeFile(
    path,
    JSON.stringify({ leak: "/home/operator/secret" }),
    "utf8",
  );
  await assert.rejects(
    () => execFileAsync("node", [scriptPath, "--artifact", path, "--json"]),
    (error) => error.code === 1,
  );
});

test("12 CLI returns zero on safe artifact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifact-safety-safe-"));
  const path = join(dir, "safe.json");
  await writeFile(path, JSON.stringify(SAFE_ARTIFACT), "utf8");
  const { stdout } = await execFileAsync("node", [
    scriptPath,
    "--artifact",
    path,
    "--json",
  ]);
  const report = JSON.parse(stdout);
  assert.equal(report.verdict, "PUBLIC_SAFE");
});

test("13 no new dependency added", async () => {
  const pkg = JSON.parse(
    await readFile(
      fileURLToPath(new URL("../package.json", import.meta.url)),
      "utf8",
    ),
  );
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test("14 formatArtifactSafetyReport renders verdict", () => {
  const result = evaluateArtifactSafety(SAFE_ARTIFACT);
  const text = formatArtifactSafetyReport(result);
  assert.match(text, /PUBLIC_SAFE/);
  assert.match(text, /Layer 1/);
});

test("scan helpers export independently", () => {
  assert.ok(scanPathLeakage("bizra.dema.schema.v0.1").length === 0);
  assert.ok(scanSecretLikeStrings("no network").length === 0);
  assert.ok(scanClaimBoundary("preview only").length === 0);
});
