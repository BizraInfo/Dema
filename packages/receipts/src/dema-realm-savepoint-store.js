// DEMA-S3-REALM-SAVEPOINT-STORE-1A
//
// Immutable, content-addressed savepoints subordinate to the existing realm
// event authority. A savepoint does not invent a second mission lifecycle: it
// binds one already-derived realm event head and state hash to a model-neutral
// continuation contract. Local single-host only. No model invocation, network,
// signing, federation, token, wallet, or authority increase.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, link, unlink, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEMA_REALM_SAVEPOINT_SCHEMA = "bizra.dema.realm_savepoint.v1";
export const DEMA_REALM_SAVEPOINT_DOMAIN = "BIZRA:DEMA_REALM_SAVEPOINT:v1";
export const DEMA_REALM_SAVEPOINT_RELDIR = join("realm", "savepoints-v1");
export const CANONICALIZATION = "bizra.canonical-json.v1";

const FILE_RE = /^(\d{12})\.json$/;
const TEMP_RE = /^\.tmp-[A-Za-z0-9._-]+$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const FIELDS = Object.freeze([
  "schema", "domain", "canonicalization", "sequence",
  "previous_savepoint_hash", "realm_id", "season_id", "mission_id",
  "realm_event_head_hash", "realm_state_hash", "resume_capsule_hash",
  "current_phase", "next_legal_action", "must_not_repeat",
  "authority_delta", "created_at_iso", "savepoint_hash",
]);
const SORTED_FIELDS = Object.freeze([...FIELDS].sort());

const sha256 = (text) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const eventName = (sequence) => `${String(sequence).padStart(12, "0")}.json`;
const refuse = (reason, extra = {}) => Object.freeze({ ok: false, reason, ...extra });

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function isCanonicalIso(value) {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function normalizedStringSet(value) {
  if (!Array.isArray(value)) return null;
  if (value.some((x) => typeof x !== "string" || x.length === 0)) return null;
  const normalized = [...value].sort();
  if (normalized.some((x, i) => i > 0 && x === normalized[i - 1])) return null;
  return normalized;
}

function savepointBody(value) {
  const { savepoint_hash: _drop, ...body } = value;
  return body;
}

function hashSavepoint(value, canonicalize) {
  return sha256(`${DEMA_REALM_SAVEPOINT_DOMAIN}\0${canonicalize(savepointBody(value))}`);
}

function validateShape(value, canonicalize, { expectedSequence, expectedPreviousHash } = {}) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "savepoint_shape_mismatch";
  const keys = Object.keys(value).sort();
  if (keys.length !== SORTED_FIELDS.length || keys.some((key, i) => key !== SORTED_FIELDS[i])) {
    return "savepoint_shape_mismatch";
  }
  if (value.schema !== DEMA_REALM_SAVEPOINT_SCHEMA) return "savepoint_schema_mismatch";
  if (value.domain !== DEMA_REALM_SAVEPOINT_DOMAIN) return "savepoint_domain_mismatch";
  if (value.canonicalization !== CANONICALIZATION) return "savepoint_canonicalization_mismatch";
  if (!Number.isInteger(value.sequence) || value.sequence < 0) return "savepoint_sequence_invalid";
  if (expectedSequence !== undefined && value.sequence !== expectedSequence) return "savepoint_sequence_filename_mismatch";
  if (value.sequence === 0) {
    if (value.previous_savepoint_hash !== null) return "savepoint_previous_hash_invalid";
  } else if (!SHA_RE.test(value.previous_savepoint_hash)) {
    return "savepoint_previous_hash_invalid";
  }
  if (expectedPreviousHash !== undefined && value.previous_savepoint_hash !== expectedPreviousHash) {
    return "savepoint_previous_hash_broken";
  }
  for (const key of ["realm_id", "season_id", "mission_id"]) {
    if (typeof value[key] !== "string" || !ID_RE.test(value[key])) return `savepoint_${key}_invalid`;
  }
  for (const key of ["realm_event_head_hash", "realm_state_hash", "resume_capsule_hash"]) {
    if (!SHA_RE.test(value[key])) return `savepoint_${key}_invalid`;
  }
  if (typeof value.current_phase !== "string" || value.current_phase.length === 0) {
    return "savepoint_current_phase_invalid";
  }
  if (typeof value.next_legal_action !== "string" || value.next_legal_action.length === 0) {
    return "savepoint_next_legal_action_invalid";
  }
  const normalized = normalizedStringSet(value.must_not_repeat);
  if (normalized === null || normalized.some((x, i) => x !== value.must_not_repeat[i])) {
    return "savepoint_must_not_repeat_invalid";
  }
  if (value.authority_delta !== 0) return "savepoint_authority_delta_nonzero";
  if (!isCanonicalIso(value.created_at_iso)) return "savepoint_created_at_invalid";
  if (!SHA_RE.test(value.savepoint_hash)) return "savepoint_hash_invalid";
  try {
    if (hashSavepoint(value, canonicalize) !== value.savepoint_hash) return "savepoint_hash_mismatch";
  } catch (err) {
    return `savepoint_canonicalization_invalid:${err?.code ?? "unknown"}`;
  }
  return null;
}

function buildSavepoint(input, canonicalize, { sequence, previousSavepointHash, createdAtIso }) {
  const mustNotRepeat = normalizedStringSet(input.must_not_repeat ?? []);
  if (mustNotRepeat === null) return refuse("savepoint_must_not_repeat_invalid");
  const value = {
    schema: DEMA_REALM_SAVEPOINT_SCHEMA,
    domain: DEMA_REALM_SAVEPOINT_DOMAIN,
    canonicalization: CANONICALIZATION,
    sequence,
    previous_savepoint_hash: previousSavepointHash,
    realm_id: input.realm_id,
    season_id: input.season_id,
    mission_id: input.mission_id,
    realm_event_head_hash: input.realm_event_head_hash,
    realm_state_hash: input.realm_state_hash,
    resume_capsule_hash: input.resume_capsule_hash,
    current_phase: input.current_phase,
    next_legal_action: input.next_legal_action,
    must_not_repeat: mustNotRepeat,
    authority_delta: input.authority_delta ?? 0,
    created_at_iso: createdAtIso,
  };
  try {
    value.savepoint_hash = hashSavepoint(value, canonicalize);
  } catch (err) {
    return refuse(`savepoint_canonicalization_invalid:${err?.code ?? "unknown"}`);
  }
  const invalid = validateShape(value, canonicalize, { expectedSequence: sequence, expectedPreviousHash: previousSavepointHash });
  if (invalid) return refuse(invalid);
  return Object.freeze({ ok: true, savepoint: Object.freeze(value) });
}

async function fsyncPath(path) {
  const handle = await open(path, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

const DEFAULT_OPS = Object.freeze({ linkFile: link, unlinkTemp: unlink, fsyncDir: fsyncPath });

async function publishNoReplace(dir, finalPath, bytes, ops = DEFAULT_OPS) {
  const temp = join(dir, `.tmp-${randomUUID()}`);
  try {
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (err) {
    return { published: false, reason: `savepoint_temp_write_failed:${err?.code ?? "unknown"}` };
  }
  let result;
  try {
    await ops.linkFile(temp, finalPath);
    try {
      await ops.fsyncDir(dir);
      result = { published: true, durable: true };
    } catch (err) {
      result = {
        published: true,
        durable: false,
        reason: `savepoint_publication_durability_uncertain:${err?.code ?? "unknown"}`,
        durability_uncertain: true,
        replay_required: true,
      };
    }
  } catch (err) {
    result = err?.code === "EEXIST"
      ? { published: false, durable: true, reason: "savepoint_already_published" }
      : { published: false, durable: false, reason: `savepoint_publication_unavailable:${err?.code ?? "unknown"}` };
  }
  try { await ops.unlinkTemp(temp); } catch (err) {
    result.cleanup_failure = `savepoint_temp_cleanup_failed:${err?.code ?? "unknown"}`;
  }
  return result;
}

export async function replayDemaRealmSavepoints({ demaHome, canonicalize } = {}) {
  if (typeof canonicalize !== "function") return refuse("canonicalizer_required");
  const home = resolveHome(demaHome);
  const dir = join(home, DEMA_REALM_SAVEPOINT_RELDIR);
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err?.code === "ENOENT") {
      return Object.freeze({ ok: true, exists: false, sequence: -1, head_savepoint_hash: null, savepoints: Object.freeze([]) });
    }
    return refuse(`savepoint_dir_unreadable:${err?.code ?? "unknown"}`, { escalate_to_human: true });
  }
  const sequences = [];
  for (const name of entries) {
    if (TEMP_RE.test(name)) continue;
    const match = name.match(FILE_RE);
    if (!match) return refuse("savepoint_dir_unexpected_entry", { escalate_to_human: true, entry: name });
    sequences.push(Number(match[1]));
  }
  sequences.sort((a, b) => a - b);
  const savepoints = [];
  let previous = null;
  for (let i = 0; i < sequences.length; i += 1) {
    if (sequences[i] !== i) return refuse("savepoint_sequence_gap", { escalate_to_human: true, expected: i, found: sequences[i] });
    let body;
    try {
      body = JSON.parse(await readFile(join(dir, eventName(i)), "utf8"));
    } catch {
      return refuse("savepoint_unparseable", { escalate_to_human: true, sequence: i });
    }
    const invalid = validateShape(body, canonicalize, { expectedSequence: i, expectedPreviousHash: previous });
    if (invalid) return refuse(invalid, { escalate_to_human: true, sequence: i });
    previous = body.savepoint_hash;
    savepoints.push(Object.freeze(body));
  }
  return Object.freeze({
    ok: true,
    exists: savepoints.length > 0,
    sequence: savepoints.length - 1,
    head_savepoint_hash: previous,
    head: savepoints[savepoints.length - 1] ?? null,
    savepoints: Object.freeze(savepoints),
  });
}

export async function appendDemaRealmSavepoint(
  { demaHome, input, canonicalize, createdAtIso = new Date().toISOString() } = {},
  publicationOps = DEFAULT_OPS,
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return refuse("savepoint_input_missing");
  if (typeof canonicalize !== "function") return refuse("canonicalizer_required");
  const home = resolveHome(demaHome);
  const dir = join(home, DEMA_REALM_SAVEPOINT_RELDIR);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const before = await replayDemaRealmSavepoints({ demaHome: home, canonicalize });
  if (!before.ok) return before;
  const sequence = before.sequence + 1;
  const built = buildSavepoint(input, canonicalize, {
    sequence,
    previousSavepointHash: before.head_savepoint_hash,
    createdAtIso,
  });
  if (!built.ok) return built;
  const finalPath = join(dir, eventName(sequence));
  const publication = await publishNoReplace(
    dir,
    finalPath,
    `${canonicalize(built.savepoint)}\n`,
    publicationOps,
  );
  if (publication.durability_uncertain) {
    return refuse(publication.reason, {
      durability_uncertain: true,
      replay_required: true,
      effect_retry_forbidden: true,
      savepoint_visible: true,
      ...(publication.cleanup_failure ? { cleanup_failure: publication.cleanup_failure } : {}),
    });
  }
  if (!publication.published) {
    const afterRace = await replayDemaRealmSavepoints({ demaHome: home, canonicalize });
    if (!afterRace.ok) return afterRace;
    const winner = afterRace.savepoints[sequence] ?? null;
    if (winner?.savepoint_hash === built.savepoint.savepoint_hash) {
      return Object.freeze({ ok: true, appended: false, idempotent: true, reason: "already_applied_idempotently", savepoint: winner });
    }
    return refuse("savepoint_transition_conflict", {
      escalate_to_human: true,
      winner_savepoint_hash: winner?.savepoint_hash ?? null,
    });
  }
  const verified = await replayDemaRealmSavepoints({ demaHome: home, canonicalize });
  if (!verified.ok || verified.head_savepoint_hash !== built.savepoint.savepoint_hash) {
    return refuse("savepoint_post_write_verification_failed", { escalate_to_human: true });
  }
  return Object.freeze({
    ok: true,
    appended: true,
    durable: true,
    savepoint: built.savepoint,
    head_savepoint_hash: verified.head_savepoint_hash,
    ...(publication.cleanup_failure ? { cleanup_failure: publication.cleanup_failure } : {}),
  });
}
