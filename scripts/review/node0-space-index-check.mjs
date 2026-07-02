#!/usr/bin/env node
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildNode0SpaceIndex,
  verifyNode0SpaceIndex,
} from "../../packages/core/src/node0-space-index.js";

export async function runNode0SpaceIndexCheck() {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-space-index-check-"));
  const demaHome = await mkdtemp(join(tmpdir(), "dema-node0-space-index-home-"));
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "docs", "a.md"), "same\n");
  await writeFile(join(root, "docs", "b.md"), "same\n");
  await writeFile(join(root, ".env"), "SECRET=never-read\n");

  const metadata = await buildNode0SpaceIndex({ root, demaHome });
  const hashed = await buildNode0SpaceIndex({
    root,
    demaHome,
    hashContent: true,
    consentPhrase: metadata.root.hash_consent_phrase,
  });
  const failures = [];
  if (!verifyNode0SpaceIndex(metadata).ok) failures.push("metadata_verify_failed");
  if (metadata.boundary.file_content_read !== false) failures.push("metadata_read_content");
  if (!metadata.root.hash_consent_phrase.includes(metadata.root.normalized_path_hash)) {
    failures.push("consent_phrase_not_bound");
  }
  if (!metadata.duplicate_candidate_groups.some((g) => g.group_type === "size_collision_weak")) {
    failures.push("weak_size_group_missing");
  }
  if (hashed.mode !== "content_hash_index") failures.push("hash_mode_missing");
  if (!hashed.duplicate_candidate_groups.some((g) => g.group_type === "content_hash_match")) {
    failures.push("strong_hash_group_missing");
  }
  if (!hashed.denied.some((d) => d.content_class === "secret_metadata_only")) {
    failures.push("secret_denial_missing");
  }

  return {
    gate: "DEMA-NODE0-SPACE-INDEX-1A",
    status: failures.length ? "FAIL" : "PASS",
    failures,
    metadata_records: metadata.summary.records_count,
    weak_duplicate_groups: metadata.duplicate_candidate_groups.length,
    strong_duplicate_groups: hashed.duplicate_candidate_groups.length,
    no_network: metadata.boundary.network_used === false && hashed.boundary.network_used === false,
    no_mint:
      metadata.boundary.receipt_mint_performed === false &&
      hashed.boundary.receipt_mint_performed === false,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNode0SpaceIndexCheck()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.status === "PASS" ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
