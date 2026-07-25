export const CHECK_GATE_EVIDENCE_SCHEMA =
  "bizra.dema.check_gate_evidence.v0.1";
export const CHECK_GATE_EVIDENCE_FD_ENV = "BIZRA_CHECK_GATE_EVIDENCE_FD";

const START_COMPLETE_KEYS = Object.freeze([
  "schema",
  "event",
  "command_count",
]);
const FAILURE_KEYS = Object.freeze([
  "schema",
  "event",
  "index",
  "command",
  "exit_code",
  "mask_policy",
]);
const TAP_ALLOWLIST_COMMAND = Object.freeze([
  "node",
  "--test",
  "--test-reporter=tap",
]);

function hasExactKeys(record, expected) {
  const keys = Object.keys(record);
  return (
    keys.length === expected.length && expected.every((key) => keys.includes(key))
  );
}

function validateRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return "record must be a JSON object";
  }
  if (record.schema !== CHECK_GATE_EVIDENCE_SCHEMA) {
    return `schema must equal ${CHECK_GATE_EVIDENCE_SCHEMA}`;
  }
  if (record.event === "start" || record.event === "complete") {
    if (!hasExactKeys(record, START_COMPLETE_KEYS)) {
      return `${record.event} record must contain exactly the canonical key set`;
    }
    if (!Number.isInteger(record.command_count) || record.command_count < 0) {
      return "command_count must be a non-negative integer";
    }
    return null;
  }
  if (record.event !== "failure") {
    return "event must be start, failure, or complete";
  }
  if (!hasExactKeys(record, FAILURE_KEYS)) {
    return "failure record must contain exactly the canonical key set";
  }
  if (!Number.isInteger(record.index) || record.index < 0) {
    return "index must be a non-negative integer";
  }
  if (
    !Array.isArray(record.command) ||
    record.command.length === 0 ||
    record.command.some((part) => typeof part !== "string") ||
    record.command[0].length === 0
  ) {
    return "command must be a non-empty string array";
  }
  if (!Number.isInteger(record.exit_code) || record.exit_code <= 0) {
    return "exit_code must be a positive integer";
  }
  if (
    record.mask_policy !== "tap_allowlist" &&
    record.mask_policy !== "authoritative"
  ) {
    return "mask_policy must be tap_allowlist or authoritative";
  }
  if (
    record.mask_policy === "tap_allowlist" &&
    (record.exit_code !== 1 ||
      record.command.length !== TAP_ALLOWLIST_COMMAND.length ||
      !TAP_ALLOWLIST_COMMAND.every(
        (part, index) => record.command[index] === part,
      ))
  ) {
    return "tap_allowlist is reserved for exit 1 from the canonical direct TAP test command";
  }
  return null;
}

export function checkGateStart(commandCount) {
  return {
    schema: CHECK_GATE_EVIDENCE_SCHEMA,
    event: "start",
    command_count: commandCount,
  };
}

export function checkGateComplete(commandCount) {
  return {
    schema: CHECK_GATE_EVIDENCE_SCHEMA,
    event: "complete",
    command_count: commandCount,
  };
}

export function checkGateFailure({
  index,
  command,
  exitCode,
  maskPolicy,
}) {
  return {
    schema: CHECK_GATE_EVIDENCE_SCHEMA,
    event: "failure",
    index,
    command,
    exit_code: exitCode,
    mask_policy: maskPolicy === "tap_allowlist" ? "tap_allowlist" : "authoritative",
  };
}

export function parseCheckGateEvidence(content) {
  const records = [];
  const malformed = [];
  if (typeof content !== "string" || !content.trim()) {
    return { records, malformed };
  }
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  for (const [index, line] of lines.entries()) {
    if (!line) {
      malformed.push({ line_number: index + 1, reason: "empty record" });
      continue;
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      malformed.push({ line_number: index + 1, reason: "invalid JSON" });
      continue;
    }
    const reason = validateRecord(record);
    if (reason) malformed.push({ line_number: index + 1, reason });
    else records.push(record);
  }
  return { records, malformed };
}

export function evaluateCheckGateEvidence({ content, checkExit }) {
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, reason: "required side-channel evidence is missing" };
  }
  if (!Number.isInteger(checkExit) || checkExit < 0) {
    return { ok: false, reason: "aggregate check exit is missing or invalid" };
  }
  const parsed = parseCheckGateEvidence(content);
  if (parsed.malformed.length > 0) {
    const first = parsed.malformed[0];
    return {
      ok: false,
      reason: `malformed record at line ${first.line_number}: ${first.reason}`,
    };
  }
  if (parsed.records.length !== 2) {
    return {
      ok: false,
      reason: `expected exactly start + terminal evidence; received ${parsed.records.length} record(s)`,
    };
  }
  const [start, terminal] = parsed.records;
  if (start.event !== "start") {
    return { ok: false, reason: "first evidence record must be start" };
  }
  if (checkExit === 0) {
    if (terminal.event !== "complete") {
      return {
        ok: false,
        reason: "zero aggregate exit must terminate with complete evidence",
      };
    }
    if (terminal.command_count !== start.command_count) {
      return { ok: false, reason: "start/complete command_count mismatch" };
    }
    return { ok: true, failure: null };
  }
  if (terminal.event !== "failure") {
    return {
      ok: false,
      reason: "nonzero aggregate exit must terminate with failure evidence",
    };
  }
  if (terminal.index >= start.command_count) {
    return { ok: false, reason: "failure index exceeds declared command_count" };
  }
  if (terminal.mask_policy === "tap_allowlist") {
    return {
      ok: false,
      reason:
        "tap_allowlist failure cannot terminate aggregate check evidence; isolate the TAP gate and require aggregate completion",
    };
  }
  return { ok: true, failure: terminal };
}
