import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFIER = join(ROOT, "scripts", "verify-root-canon.mjs");
const VERIFIER_SHA256 = "04fa344563d409c5d3608995491d9830d16544d30068788bbe50cdfad9afc735";
const PRIORITY_ROOT = "45aa2789b6085558a387cd3d6bbae894defdfa71fdd5a1db18135e6039e1477a";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function assertVerifierIdentity() {
  assert.equal(sha256(await readFile(VERIFIER)), VERIFIER_SHA256, "IDENTITY_MISMATCH: verifier source drifted");
}

async function makeFixture() {
  const fixture = await mkdtemp(join(tmpdir(), "gate6-root-canon-"));
  const manifest = JSON.parse(await readFile(join(ROOT, "docs", "root-canon", "root-canon.manifest.json"), "utf8"));
  const priority = JSON.parse(await readFile(join(ROOT, "proof-of-priority", "manifest.json"), "utf8"));
  await mkdir(join(fixture, "scripts"), { recursive: true });
  await copyFile(VERIFIER, join(fixture, "scripts", "verify-root-canon.mjs"));
  await mkdir(join(fixture, "docs", "root-canon"), { recursive: true });
  await copyFile(
    join(ROOT, "docs", "root-canon", "root-canon.manifest.json"),
    join(fixture, "docs", "root-canon", "root-canon.manifest.json"),
  );
  await mkdir(join(fixture, "proof-of-priority", "per-file"), { recursive: true });
  await copyFile(join(ROOT, "proof-of-priority", "manifest.json"), join(fixture, "proof-of-priority", "manifest.json"));
  for (const entry of manifest.roots) {
    const destination = join(fixture, entry.path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(ROOT, entry.path), destination);
    const filename = basename(entry.path);
    await copyFile(join(ROOT, "proof-of-priority", "per-file", `${filename}.ots`), join(fixture, "proof-of-priority", "per-file", `${filename}.ots`));
  }
  return { fixture, manifest, priority };
}

async function verifyFixture(fixture) {
  const copiedVerifier = pathToFileURL(join(fixture, "scripts", "verify-root-canon.mjs"));
  const { verifyRootCanon } = await import(`${copiedVerifier.href}?gate6=${randomUUID()}`);
  return verifyRootCanon();
}

test("root-canon control: untampered temporary roots verify", async () => {
  await assertVerifierIdentity();
  const { fixture } = await makeFixture();
  try {
    assert.equal((await verifyFixture(fixture)).verified, true);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("B1: rehashed mutable manifest cannot qualify changed founding bytes", async () => {
  await assertVerifierIdentity();
  const { fixture, manifest, priority } = await makeFixture();
  try {
    const target = manifest.roots[0];
    const targetPath = join(fixture, target.path);
    const changed = Buffer.concat([await readFile(targetPath), Buffer.from("\nGATE6-TAMPER\n")]);
    await writeFile(targetPath, changed);

    assert.equal((await verifyFixture(fixture)).verified, false, "control: unchanged manifest detects changed bytes");
    const changedSha256 = sha256(changed);
    target.sha256 = changedSha256;
    target.sha3_512 = createHash("sha3-512").update(changed).digest("hex");
    await writeFile(join(fixture, "docs", "root-canon", "root-canon.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const retained = priority.files.find((entry) => entry.filename === basename(target.path));
    assert.ok(retained, "fixture has the retained priority commitment");
    assert.equal(priority.root_hash, PRIORITY_ROOT, "fixture retains the sealed priority root");
    assert.notEqual(retained.file_sha256, changedSha256, "retained commitment still binds the original bytes");
    assert.equal(
      (await verifyFixture(fixture)).verified,
      false,
      "B1: verifier accepted changed bytes after only a mutable-manifest rehash; it must bind a retained anchor",
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
