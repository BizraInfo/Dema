// First Light restart verifier.
//
// Reloads persisted state in a fresh process and re-establishes every
// relationship needed for a local VERIFIED_LOCAL result.

import { lstat } from "node:fs/promises";
import { homedir } from "node:os";
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import { sha256CanonicalJsonV1 } from "../../../../packages/canon/src/sha256-canonical-json-v1.js";
import {
  FIRST_LIGHT_RETRIEVAL_SCHEMA,
  verifyFirstLightIndex,
  verifyFirstLightReceipt,
  verifyFirstLightProofCard,
  buildFirstLightPrompt,
} from "../../../../packages/core/src/node0-first-light.js";
import {
  firstLightFileIdentity,
  firstLightIdentityMatches,
  readFirstLightFileNoFollow,
  validateFirstLightStateRoot,
} from "./first-light-safe-fs.js";
import {
  FIRST_LIGHT_MAX_FILE_BYTES,
  firstLightBlocked,
  firstLightHashText,
} from "./first-light-storage.js";

const MISSION_ID_RE = /^first-light-[0-9a-f]{20}$/;

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function readJson(path) {
  const { buffer } = await readFirstLightFileNoFollow(
    path,
    FIRST_LIGHT_MAX_FILE_BYTES,
  );
  const value = buffer.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(buffer)) {
    throw new Error("json_not_utf8");
  }
  return JSON.parse(value);
}

async function verifyPersistedSource(rootPath, source, expectedIdentity) {
  const candidate = resolve(rootPath, source.relative_path);
  if (!inside(rootPath, candidate)) {
    return {
      verified: false,
      reason: `source_path_escape:${source.relative_path}`,
    };
  }
  try {
    const opened = await readFirstLightFileNoFollow(
      candidate,
      FIRST_LIGHT_MAX_FILE_BYTES,
    );
    const pathMetadata = await lstat(candidate, { bigint: true });
    if (
      !expectedIdentity ||
      pathMetadata.isSymbolicLink() ||
      !pathMetadata.isFile() ||
      !firstLightIdentityMatches(expectedIdentity, opened.metadata) ||
      !firstLightIdentityMatches(expectedIdentity, pathMetadata)
    ) {
      return {
        verified: false,
        reason: `source_identity_mismatch:${source.relative_path}`,
      };
    }
    const buffer = opened.buffer;
    const sourceText = buffer.toString("utf8");
    if (!Buffer.from(sourceText, "utf8").equals(buffer)) {
      return {
        verified: false,
        reason: `source_not_utf8:${source.relative_path}`,
      };
    }
    if (firstLightHashText(sourceText) !== source.source_sha256) {
      return {
        verified: false,
        reason: `source_hash_mismatch:${source.relative_path}`,
      };
    }
    const lines = sourceText.split("\n");
    const excerpt = lines
      .slice(source.line_start - 1, source.line_end)
      .join("\n");
    if (firstLightHashText(excerpt) !== source.excerpt_sha256) {
      return {
        verified: false,
        reason: `excerpt_hash_mismatch:${source.relative_path}`,
      };
    }
    return { verified: true, relative_path: source.relative_path, excerpt };
  } catch {
    return {
      verified: false,
      reason: `source_unreadable:${source.relative_path}`,
    };
  }
}

function checkPersistedRelations({
  id,
  demaHome,
  latest,
  state,
  scopeRecord,
  index,
  receipt,
  card,
  allowProvisional,
}) {
  const blocked = [
    ...verifyFirstLightIndex(index).blocked_by,
    ...verifyFirstLightReceipt(receipt).blocked_by,
    ...verifyFirstLightProofCard({ card, receipt }).blocked_by,
  ];
  if (state.schema !== "bizra.node0.first_light_state.v0.1") {
    blocked.push("state_schema_mismatch");
  }
  if (scopeRecord.schema !== "bizra.node0.first_light_scope.v0.1") {
    blocked.push("scope_record_schema_mismatch");
  }
  if (latest !== null) {
    if (latest.schema !== "bizra.node0.first_light_latest.v0.1") {
      blocked.push("latest_schema_mismatch");
    }
    if (latest.receipt_id !== receipt.receipt_id) {
      blocked.push("latest_receipt_mismatch");
    }
  }
  if (
    state.status !== "COMPLETE" &&
    !(allowProvisional && state.status === "PROVISIONAL")
  ) {
    blocked.push("mission_not_complete");
  }
  if (
    state.mission_id !== id ||
    receipt.mission_id !== id ||
    index.mission_id !== id
  ) {
    blocked.push("mission_id_mismatch");
  }
  if (
    scopeRecord.mission_id !== id ||
    scopeRecord.state_root_path !== demaHome ||
    scopeRecord.scope?.root_set_hash !== receipt.root?.root_set_hash ||
    scopeRecord.scope?.root_path !== receipt.root?.path ||
    scopeRecord.scope?.root_path !== index.root_path
  ) {
    blocked.push("scope_record_mismatch");
  } else {
    const { root_set_hash, ...scopeBody } = scopeRecord.scope;
    if (sha256CanonicalJsonV1(scopeBody) !== root_set_hash) {
      blocked.push("scope_record_hash_mismatch");
    }
  }
  if (state.scope_record_hash !== sha256CanonicalJsonV1(scopeRecord)) {
    blocked.push("state_scope_record_hash_mismatch");
  }
  if (
    scopeRecord.consent?.action_class !== receipt.consent?.action_class ||
    scopeRecord.consent?.consent_context_hash !==
      receipt.consent?.consent_context_hash ||
    scopeRecord.consent?.phrase_hash !== receipt.consent?.phrase_hash
  ) {
    blocked.push("scope_consent_mismatch");
  }
  if (
    receipt.index?.index_hash !== index.index_hash ||
    receipt.index?.file_count !== index.file_count
  ) {
    blocked.push("receipt_index_mismatch");
  }
  for (const source of receipt.retrieval?.sources ?? []) {
    const indexed = index.files?.find(
      (file) => file.relative_path === source.relative_path,
    );
    if (!indexed || indexed.source_sha256 !== source.source_sha256) {
      blocked.push("receipt_index_source_mismatch");
    }
  }
  if (state.index_hash !== index.index_hash) {
    blocked.push("state_index_hash_mismatch");
  }
  if (state.receipt_id !== receipt.receipt_id) {
    blocked.push("state_receipt_id_mismatch");
  }
  if (state.proof_card_hash !== card.proof_card_hash) {
    blocked.push("state_proof_card_hash_mismatch");
  }
  return blocked;
}

export async function resumeFirstLightMission({
  dema_home,
  mission_id,
  allow_provisional = false,
} = {}) {
  const demaHome = resolve(
    dema_home || process.env.DEMA_HOME || join(homedir(), ".dema"),
  );
  const firstLightRoot = join(demaHome, "first-light");
  try {
    const safeRoot = await validateFirstLightStateRoot(firstLightRoot);
    if (!safeRoot.ok) return safeRoot;
    let id = mission_id;
    let latest = null;
    if (!id) {
      latest = await readJson(join(firstLightRoot, "latest.json"));
      id = latest.mission_id;
    }
    if (!MISSION_ID_RE.test(id ?? "")) {
      return firstLightBlocked("mission_id_invalid");
    }
    const missionDir = join(firstLightRoot, id);
    const safeMission = await validateFirstLightStateRoot(missionDir);
    if (!safeMission.ok) return safeMission;
    const [state, scopeRecord, index, receipt, card] = await Promise.all([
      readJson(join(missionDir, "state.json")),
      readJson(join(missionDir, "scope.json")),
      readJson(join(missionDir, "index.json")),
      readJson(join(missionDir, "receipt.json")),
      readJson(join(missionDir, "proof-card.json")),
    ]);
    const blockedBy = checkPersistedRelations({
      id,
      demaHome,
      latest,
      state,
      scopeRecord,
      index,
      receipt,
      card,
      allowProvisional: allow_provisional,
    });
    const source_verification = [];
    for (const source of receipt.retrieval?.sources ?? []) {
      const expectedIdentity = scopeRecord.scope?.files?.find(
        (file) => file.relative_path === source.relative_path,
      );
      source_verification.push(
        await verifyPersistedSource(
          receipt.root.path,
          source,
          expectedIdentity,
        ),
      );
    }
    blockedBy.push(
      ...source_verification
        .filter((item) => !item.verified)
        .map((item) => item.reason),
    );
    if (source_verification.every((item) => item.verified)) {
      const retrieval = {
        schema: FIRST_LIGHT_RETRIEVAL_SCHEMA,
        rejected: false,
        retrieval_hash: receipt.retrieval.retrieval_hash,
        sources: receipt.retrieval.sources.map((source) => ({
          ...source,
          excerpt: source_verification.find(
            (item) => item.relative_path === source.relative_path,
          )?.excerpt,
        })),
      };
      const prompt = buildFirstLightPrompt({
        question: receipt.question.text,
        retrieval,
      });
      if (prompt.prompt_hash !== receipt.prompt.prompt_hash) {
        blockedBy.push("prompt_hash_mismatch");
      }
    }
    return {
      ok: blockedBy.length === 0,
      blocked_by: [...new Set(blockedBy)],
      verification_state:
        blockedBy.length > 0
          ? "BLOCKED"
          : state.status === "COMPLETE"
            ? "VERIFIED_LOCAL"
            : "PROVISIONAL_VERIFIED",
      mission_id: id,
      state,
      index,
      receipt,
      proof_card: card,
      source_verification,
    };
  } catch {
    return firstLightBlocked("first_light_state_unreadable");
  }
}
