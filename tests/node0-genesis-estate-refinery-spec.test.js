import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SPEC_PATH = new URL(
  "../docs/02-architecture/NODE0_GENESIS_ESTATE_REFINERY_0A.md",
  import.meta.url,
);

test("Genesis Estate Refinery 0A remains a root-bound, non-operational specification", async () => {
  const specification = await readFile(SPEC_PATH, "utf8");

  for (const required of [
    "# Node0 Genesis Estate Refinery 0A",
    "## Root Canon Binding",
    "## DEMA DNA Pack",
    "## Mission Contract",
    "## Canonical Schemas",
    "## Clean Twin Folder Plan",
    "## DEMA Daily Brief Template",
    "## Definition of Done",
    "### Approved source root",
    "### Asset card",
    "### Claim card",
    "### Receipt-shaped evidence record",
    "ROOT_CANON_VERIFIED",
    "ROOT_CANON_DRIFT_LOCKED",
    "docs/root-canon/root-canon.manifest.json",
    "scripts/verify-root-canon.mjs",
    "ROOT_1_THE_MESSAGE",
    "ROOT_2_THE_SEED",
    "ROOT_3_THE_THIRD_FACT",
    "authority_delta: 0",
    "COMPONENT_SPECIFICATION_ONLY",
    "record_kind: RECEIPT_SHAPED_NOT_A_RECEIPT",
    "source_locator_ref: registry:<opaque-id>",
    "content_included: false",
    "The clean-twin layout is a future containment convention only.",
    "The brief is a future human-facing report shape.",
    "no source-root create, delete, copy, or rename",
    "no VRO",
    "no Node0 closure claim",
  ]) {
    assert.match(specification, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const boundary of [
    "no filesystem scan",
    "no file-content read",
    "no file mutation",
    "no network use",
    "no provider or model invocation",
    "no runtime activation",
    "no consent consumption",
    "no receipt minting",
    "no keys or secrets",
    "no cloud write or publication",
  ]) {
    assert.match(specification, new RegExp(boundary, "i"));
  }

  for (const forbiddenInstruction of [
    "```bash",
    "rm -",
    "curl ",
    "fetch(",
    "writeFile",
    "mkdir",
    "copyFile",
    "rename(",
    "unlink(",
  ]) {
    assert.equal(
      specification.includes(forbiddenInstruction),
      false,
      `unexpected operational instruction: ${forbiddenInstruction}`,
    );
  }
});
