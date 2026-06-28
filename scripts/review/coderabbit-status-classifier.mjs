#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CODERABBIT_STATUS_CLASSIFIER_SCHEMA =
  "bizra.dema.coderabbit_status_classifier.v0.1";

const CREDIT_EXHAUSTION_PATTERNS = Object.freeze([
  /prepaid credits exhausted/i,
  /used up its prepaid credits/i,
  /enable the review add-on/i,
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function includesCodeRabbit(value) {
  return /coderabbit/i.test(normalizeText(value));
}

function isFailureState(value) {
  return /(^|\s)(fail|failure|failed|error|cancelled)(\s|$)/i.test(
    normalizeText(value),
  );
}

export function isCodeRabbitCreditExhaustion(text) {
  const normalized = normalizeText(text);
  return CREDIT_EXHAUSTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function classifyCodeRabbitLine(line) {
  const failed = isFailureState(line);
  if (!failed) {
    return freezeDeep({
      reviewer: "CodeRabbit",
      input_state: "PASS_OR_NON_FAILURE",
      classified_state: "PASS_OR_NON_FAILURE",
      blocks_merge: false,
      reason: "coderabbit_not_failing",
      source_line: line,
    });
  }

  if (isCodeRabbitCreditExhaustion(line)) {
    return freezeDeep({
      reviewer: "CodeRabbit",
      input_state: "FAILURE",
      classified_state: "SKIPPED_EXTERNAL_CREDIT_EXHAUSTED",
      blocks_merge: false,
      reason: "explicit_coderabbit_credit_exhaustion",
      source_line: line,
    });
  }

  return freezeDeep({
    reviewer: "CodeRabbit",
    input_state: "FAILURE",
    classified_state: "FAILED_REVIEW_SIGNAL",
    blocks_merge: true,
    reason: "coderabbit_failure_without_credit_exhaustion_evidence",
    source_line: line,
  });
}

export function classifyCodeRabbitStatusText(text) {
  const lines = normalizeText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const coderabbitLines = lines.filter(includesCodeRabbit);
  const statuses = coderabbitLines.map(classifyCodeRabbitLine);
  const blocking_failures = statuses.filter((status) => status.blocks_merge);

  return freezeDeep({
    schema: CODERABBIT_STATUS_CLASSIFIER_SCHEMA,
    ok: blocking_failures.length === 0,
    reviewer: "CodeRabbit",
    policy: "skip_only_explicit_credit_exhaustion",
    skipped_only_when: Object.freeze([
      "prepaid credits exhausted",
      "used up its prepaid credits",
      "enable the review add-on",
    ]),
    observed: statuses.length,
    statuses: Object.freeze(statuses),
    blocking_failures: Object.freeze(blocking_failures),
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const fromFile = argValue("--from-file");
  const input = fromFile
    ? readFileSync(fromFile, "utf8")
    : readFileSync(0, "utf8");
  const report = classifyCodeRabbitStatusText(input);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
