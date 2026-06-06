import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir, homedir, hostname, userInfo } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  ARTIFACT_FILES,
  buildProofArtifacts,
  canonicalStringify,
  contentHash,
  verifyProofArtifacts,
} from "../scripts/node0-local-urp-proof.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = fileURLToPath(
  new URL("../scripts/node0-local-urp-proof.mjs", import.meta.url),
);
const proofDir = "artifacts/proofs/node0-local-urp";

async function readArtifact(name, root = repoRoot) {
  return JSON.parse(await readFile(join(root, proofDir, name), "utf8"));
}

test("Node0 local URP proof artifacts exist and verify byte-for-byte", async () => {
  const result = await verifyProofArtifacts({ root: repoRoot });

  assert.equal(result.schema, "bizra.dema.urp_local.verify_report.v0.1");
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.files.map((file) => file.path),
    ARTIFACT_FILES,
  );
  assert.ok(result.files.every((file) => file.matches === true));
});

test("status proves URP_LOCAL_ACTIVE with required local-only truth fields", async () => {
  const status = await readArtifact("node0_local_urp_status.json");

  assert.equal(status.schema, "bizra.dema.urp_local.status.v0.1");
  assert.equal(status.truth_label, "URP_LOCAL_ACTIVE");
  assert.equal(status.node_id, "Node0");
  assert.equal(status.pat_count, 7);
  assert.equal(status.sat_count, 5);
  assert.equal(status.visibility, "local_only");
  assert.equal(status.poi_mode, "sandbox_no_cash_value");
  assert.equal(status.federation, "not_implemented");
  assert.equal(status.token_value_claim, false);
  assert.equal(status.public_network, false);
  assert.equal(status.node1_handshake, false);
  assert.equal(status.raw_private_data_included, false);
  assert.equal(status.content_sha256, contentHash(status));
});

test("SAT-5 registration has the local seed roles and does not claim SAT PERMIT", async () => {
  const sat = await readArtifact("sat5_urp_registration.json");

  assert.equal(sat.schema, "bizra.dema.urp_local.sat5_registration.v0.1");
  assert.equal(sat.binding, "non_canonical_local_seed");
  assert.equal(sat.sat_count, 5);
  assert.equal(sat.content_sha256, contentHash(sat));
  assert.deepEqual(
    sat.roles.map((role) => role.name),
    ["Validator", "Oracle", "Mediator", "Archivist", "Sentinel"],
  );
  assert.ok(
    sat.roles.every(
      (role) => role.verdict_authority === "placeholder_only_never_permit",
    ),
  );
});

test("registry includes one skill, knowledge pack, resource offer, and PoI sandbox record", async () => {
  const registry = await readArtifact("urp_local_registry.json");

  assert.equal(registry.schema, "bizra.dema.urp_local.registry.v0.1");
  assert.equal(registry.truth_label, "URP_LOCAL_ACTIVE");
  assert.equal(registry.content_sha256, contentHash(registry));
  assert.equal(registry.skills.length, 1);
  assert.equal(registry.knowledge_packs.length, 1);
  assert.equal(registry.resource_offers.length, 1);
  assert.equal(registry.poi_sandbox_records.length, 1);
  assert.equal(
    registry.idempotency.duplicate_policy,
    "duplicate_offer_id_is_same_offer",
  );
  assert.equal(
    new Set(registry.resource_offers.map((offer) => offer.offer_id)).size,
    1,
  );
});

test("local receipts and PoI record are hash-verifiable and identity-safe", async () => {
  for (const file of ARTIFACT_FILES) {
    const artifact = await readArtifact(file);
    assert.equal(artifact.content_sha256, contentHash(artifact));
    if ("identity_bound" in artifact)
      assert.equal(artifact.identity_bound, false);
    if ("signing_key_used" in artifact)
      assert.equal(artifact.signing_key_used, null);
    if ("artifact_011_class" in artifact)
      assert.equal(artifact.artifact_011_class, false);
    assert.equal(artifact.token_value_claim, false);
  }
});

test("proof artifacts avoid raw private data and public-network claims", async () => {
  const serialized = await Promise.all(
    ARTIFACT_FILES.map((file) =>
      readFile(join(repoRoot, proofDir, file), "utf8"),
    ),
  ).then((parts) => parts.join("\n"));

  const forbiddenFragments = [
    homedir(),
    hostname(),
    userInfo().username,
    "/home/",
    "public_network_enabled",
    "node1_connected",
    '"cash_value_claim": true',
    '"real_token_value": true',
  ].filter(Boolean);

  for (const fragment of forbiddenFragments) {
    assert.equal(
      serialized.includes(fragment),
      false,
      `forbidden fragment leaked: ${fragment}`,
    );
  }
  assert.equal(
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(serialized),
    false,
    "IPv4 address leaked",
  );
  assert.equal(
    /\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/i.test(serialized),
    false,
    "MAC address leaked",
  );
});

test("generator is deterministic and idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-urp-proof-"));
  const first = await buildProofArtifacts({ root, write: true });
  const second = await buildProofArtifacts({ root, write: true });
  const verify = await verifyProofArtifacts({ root });

  assert.deepEqual(first.files, second.files);
  assert.equal(verify.ok, true);
  assert.equal(
    canonicalStringify(first.artifacts.node0_local_urp_status),
    canonicalStringify(second.artifacts.node0_local_urp_status),
  );
});

test("CLI verify mode reports success for committed artifacts", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath, "--verify"]);
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.urp_local.verify_report.v0.1");
  assert.equal(report.ok, true);
});
