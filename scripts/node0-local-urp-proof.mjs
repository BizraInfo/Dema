#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const PROOF_DIR = "artifacts/proofs/node0-local-urp";
const PROOF_DATE = "2026-05-14";

export const ARTIFACT_FILES = [
  "node0_local_urp_status.json",
  "urp_local_registry.json",
  "sat5_urp_registration.json",
  "urp_skill_registry_receipt.json",
  "urp_knowledge_pack_receipt.json",
  "urp_resource_offer_receipt.json",
  "poi_sandbox_record.json"
];

const TRUTH_FIELDS = {
  truth_label: "URP_LOCAL_ACTIVE",
  node_id: "Node0",
  pat_count: 7,
  sat_count: 5,
  visibility: "local_only",
  poi_mode: "sandbox_no_cash_value",
  federation: "not_implemented",
  token_value_claim: false
};

const LOCAL_BOUNDARY = {
  public_network: false,
  node1_handshake: false,
  external_user_data: false,
  raw_private_data_included: false,
  token_value_claim: false,
  real_reward_claim: false,
  federation_claim: false
};

const RECEIPT_BOUNDARY = {
  identity_bound: false,
  signing_key_used: null,
  artifact_011_class: false,
  issuer: "node0_local_sandbox",
  receipt_authority: "local_proof_preview_not_canonical_runtime"
};

const SAT_ROLES = [
  ["S1", "Validator", "receipts/proofs/replay"],
  ["S2", "Oracle", "frozen truth axioms / impact-event review"],
  ["S3", "Mediator", "policy conflict resolution"],
  ["S4", "Archivist", "system memory / evidence retention"],
  ["S5", "Sentinel", "security / tamper / privacy boundary"]
].map(([id, name, responsibility]) => ({
  id,
  name,
  responsibility,
  residence: "URP",
  service_scope: "system_serving",
  verdict_authority: "placeholder_only_never_permit"
}));

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, ordered(value[key])])
    );
  }
  return value;
}

export function canonicalStringify(value) {
  return JSON.stringify(ordered(value), null, 2);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function contentHash(value) {
  const copy = structuredClone(value);
  delete copy.content_sha256;
  return sha256(canonicalStringify(copy));
}

function withContentHash(value) {
  const copy = { ...value, content_sha256: null };
  copy.content_sha256 = contentHash(copy);
  return copy;
}

function localReceipt(schema, receiptId, subject, payload) {
  return withContentHash({
    schema,
    receipt_id: receiptId,
    proof_date: PROOF_DATE,
    ...TRUTH_FIELDS,
    ...RECEIPT_BOUNDARY,
    ...LOCAL_BOUNDARY,
    scope: "local_only_read_only_proof",
    subject,
    payload
  });
}

function buildArtifacts(root) {
  const node0StandalonePath = join(root, "scripts", "node0_standalone.py");
  const status = {
    schema: "bizra.dema.urp_local.status.v0.1",
    proof_id: "node0-local-urp-proof-v0.1",
    proof_date: PROOF_DATE,
    ...TRUTH_FIELDS,
    ...LOCAL_BOUNDARY,
    component_count: 7,
    components: ["PAT", "SAT", "DEMA", "FATE", "URP", "RECEIPTS", "POI"],
    proof_scope: [
      "local_only",
      "sandbox_no_cash_value",
      "no_federation",
      "no_node1_handshake",
      "no_external_network",
      "no_raw_private_data"
    ],
    prereq_checks: {
      node0_standalone_py: existsSync(node0StandalonePath) ? "present" : "missing_not_in_this_checkout"
    },
    boundary_note:
      "This is a local proof artifact set, not ARTIFACT-011, not a SAT PERMIT, and not a runtime execution."
  };

  const sat5 = {
    schema: "bizra.dema.urp_local.sat5_registration.v0.1",
    proof_date: PROOF_DATE,
    ...TRUTH_FIELDS,
    ...LOCAL_BOUNDARY,
    binding: "non_canonical_local_seed",
    canon_status: "declared_by_operator_prompt_for_local_proof_only",
    roles: SAT_ROLES,
    boundary_note:
      "SAT-5 registration here is a local seed proof; real SAT-5 PERMIT authority remains upstream."
  };

  const skillReceipt = localReceipt(
    "bizra.dema.urp_local.skill_receipt.v0.1",
    "urp-skill-local-dema-readiness-v0.1",
    "skill_registry",
    {
      skill_id: "dema.local_readiness.preview",
      name: "Dema Local Readiness Preview",
      autonomy_level: "L1",
      allowed_effects: ["read_local_status", "render_preview_report"],
      blocked_effects: ["network_call", "filesystem_mutation", "runtime_execution"]
    }
  );

  const knowledgeReceipt = localReceipt(
    "bizra.dema.urp_local.knowledge_pack_receipt.v0.1",
    "urp-knowledge-pack-dema-boundaries-v0.1",
    "knowledge_pack_registry",
    {
      pack_id: "dema.boundaries.v0.1",
      title: "Dema Local Boundaries",
      truth_sources: [
        "docs/ARCHITECTURE.md",
        "docs/ENGINEERING_DISCIPLINE.md",
        "docs/02-architecture/dema-autonomy-envelope.md"
      ],
      excludes_private_user_data: true
    }
  );

  const resourceReceipt = localReceipt(
    "bizra.dema.urp_local.resource_offer_receipt.v0.1",
    "urp-resource-offer-local-compute-readiness-v0.1",
    "resource_offer_registry",
    {
      offer_id: "node0.local.compute.readiness.preview",
      resource_type: "local_compute_preview",
      visibility: "local_only",
      economic_mode: "sandbox_no_cash_value",
      duplicate_policy: "idempotent_same_offer_id",
      external_access: false
    }
  );

  const poi = withContentHash({
    schema: "bizra.dema.urp_local.poi_sandbox_record.v0.1",
    record_id: "poi-sandbox-node0-local-urp-v0.1",
    proof_date: PROOF_DATE,
    ...TRUTH_FIELDS,
    ...RECEIPT_BOUNDARY,
    ...LOCAL_BOUNDARY,
    status: "pending_verification",
    economic_mode: "sandbox_no_cash_value",
    reward_mode: "sandbox_credit_only",
    value_claim: false,
    evidence_hashes: [
      skillReceipt.content_sha256,
      knowledgeReceipt.content_sha256,
      resourceReceipt.content_sha256
    ],
    kpi_type: "proof_integrity",
    kpi_value: 1
  });

  const registry = {
    schema: "bizra.dema.urp_local.registry.v0.1",
    proof_date: PROOF_DATE,
    ...TRUTH_FIELDS,
    ...LOCAL_BOUNDARY,
    skills: [
      {
        skill_id: skillReceipt.payload.skill_id,
        receipt_id: skillReceipt.receipt_id,
        content_sha256: skillReceipt.content_sha256
      }
    ],
    knowledge_packs: [
      {
        pack_id: knowledgeReceipt.payload.pack_id,
        receipt_id: knowledgeReceipt.receipt_id,
        content_sha256: knowledgeReceipt.content_sha256
      }
    ],
    resource_offers: [
      {
        offer_id: resourceReceipt.payload.offer_id,
        receipt_id: resourceReceipt.receipt_id,
        content_sha256: resourceReceipt.content_sha256
      }
    ],
    sat_registrations: [
      {
        registration_id: "sat5-local-seed-v0.1",
        roles: SAT_ROLES.map((role) => role.name),
        binding: sat5.binding
      }
    ],
    poi_sandbox_records: [
      {
        record_id: poi.record_id,
        content_sha256: poi.content_sha256
      }
    ],
    idempotency: {
      resource_offer_policy: "duplicate_offer_id_is_same_offer",
      duplicate_resource_offer_rejected_or_idempotent: true
    }
  };

  return {
    node0_local_urp_status: status,
    urp_local_registry: registry,
    sat5_urp_registration: sat5,
    urp_skill_registry_receipt: skillReceipt,
    urp_knowledge_pack_receipt: knowledgeReceipt,
    urp_resource_offer_receipt: resourceReceipt,
    poi_sandbox_record: poi
  };
}

function fileEntries(artifacts) {
  return [
    ["node0_local_urp_status.json", artifacts.node0_local_urp_status],
    ["urp_local_registry.json", artifacts.urp_local_registry],
    ["sat5_urp_registration.json", artifacts.sat5_urp_registration],
    ["urp_skill_registry_receipt.json", artifacts.urp_skill_registry_receipt],
    ["urp_knowledge_pack_receipt.json", artifacts.urp_knowledge_pack_receipt],
    ["urp_resource_offer_receipt.json", artifacts.urp_resource_offer_receipt],
    ["poi_sandbox_record.json", artifacts.poi_sandbox_record]
  ];
}

export async function buildProofArtifacts({ root = REPO_ROOT, write = false } = {}) {
  const artifacts = buildArtifacts(root);
  const dir = join(root, PROOF_DIR);
  if (write) await mkdir(dir, { recursive: true });

  const files = [];
  for (const [name, artifact] of fileEntries(artifacts)) {
    const body = `${canonicalStringify(artifact)}\n`;
    const path = join(dir, name);
    if (write) await writeFile(path, body, "utf8");
    files.push({
      path: name,
      sha256: sha256(body),
      written: write
    });
  }

  return {
    schema: "bizra.dema.urp_local.build_report.v0.1",
    proof_dir: PROOF_DIR,
    files,
    artifacts,
    boundary: {
      scope: "local_only",
      network_used: false,
      token_value_claim: false,
      node1_handshake: false,
      private_data_scanned: false
    }
  };
}

export async function verifyProofArtifacts({ root = REPO_ROOT } = {}) {
  const expected = await buildProofArtifacts({ root, write: false });
  const dir = join(root, PROOF_DIR);
  const files = [];

  for (const [name, artifact] of fileEntries(expected.artifacts)) {
    const expectedBody = `${canonicalStringify(artifact)}\n`;
    let actualBody = null;
    try {
      actualBody = await readFile(join(dir, name), "utf8");
    } catch {
      actualBody = null;
    }
    files.push({
      path: name,
      exists: actualBody !== null,
      matches: actualBody === expectedBody,
      expected_sha256: sha256(expectedBody),
      actual_sha256: actualBody === null ? null : sha256(actualBody)
    });
  }

  return {
    schema: "bizra.dema.urp_local.verify_report.v0.1",
    proof_dir: PROOF_DIR,
    ok: files.every((file) => file.exists && file.matches),
    files,
    boundary: expected.boundary
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const verify = process.argv.includes("--verify");
  const report = verify
    ? await verifyProofArtifacts()
    : await buildProofArtifacts({ write: true });
  console.log(JSON.stringify(report, null, 2));
  if (verify && !report.ok) process.exitCode = 1;
}
