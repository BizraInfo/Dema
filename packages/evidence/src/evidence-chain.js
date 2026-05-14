import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const EVIDENCE_CHAIN_SCHEMA = "bizra.dema.evidence_chain.v0.1";
const GENESIS_HASH = "sha256:genesis";

function boundary() {
  return {
    scope: "in_memory_contract",
    execution_enabled: false,
    mutation_performed: false,
    receipt_minted: false,
    artifact_issued: false,
    signing_performed: false
  };
}

function digest(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

function eventHash({ sequence, previous_hash: previousHash, payload_hash: payloadHash }) {
  return digest({ sequence, previous_hash: previousHash, payload_hash: payloadHash });
}

export function buildEvidenceChain({ events = [] } = {}) {
  let previousHash = GENESIS_HASH;
  const entries = events.map((payload, index) => {
    const payloadHash = digest(payload);
    const entry = {
      sequence: index,
      previous_hash: previousHash,
      payload,
      payload_hash: payloadHash
    };
    const hash = eventHash(entry);
    previousHash = hash;
    return { ...entry, event_hash: hash };
  });

  return {
    schema: EVIDENCE_CHAIN_SCHEMA,
    mode: "PREVIEW_ONLY",
    entries,
    root_hash: previousHash,
    valid: true,
    boundary: boundary()
  };
}

export function validateEvidenceChain(chain) {
  const entries = Array.isArray(chain?.entries) ? chain.entries : [];
  let previousStoredHash = GENESIS_HASH;
  let previousComputedHash = GENESIS_HASH;
  const findings = [];

  entries.forEach((entry, index) => {
    const payloadHash = digest(entry.payload);
    const expectedHash = eventHash({
      sequence: index,
      previous_hash: entry.previous_hash,
      payload_hash: payloadHash
    });
    const computedHash = eventHash({
      sequence: index,
      previous_hash: previousComputedHash,
      payload_hash: payloadHash
    });

    if (entry.sequence !== index) {
      findings.push({ code: "sequence_mismatch", index });
    }
    if (entry.previous_hash !== previousStoredHash) {
      findings.push({ code: "previous_hash_mismatch", index });
    }
    if (entry.payload_hash !== payloadHash) {
      findings.push({ code: "payload_hash_mismatch", index });
    }
    if (entry.event_hash !== expectedHash) {
      findings.push({ code: "event_hash_mismatch", index });
    }

    previousStoredHash = entry.event_hash;
    previousComputedHash = computedHash;
  });

  if (chain?.root_hash !== previousComputedHash) {
    findings.push({ code: "root_hash_mismatch", index: null });
  }

  return {
    schema: EVIDENCE_CHAIN_SCHEMA,
    mode: "PREVIEW_ONLY",
    ok: findings.length === 0,
    expected_root_hash: previousComputedHash,
    actual_root_hash: chain?.root_hash ?? null,
    findings,
    boundary: boundary()
  };
}
