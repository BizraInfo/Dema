#!/usr/bin/env node
// BIZRA First Light — one-shot local folder → grounded answer → receipt.
//
// This is intentionally separate from the broad `dema` preview surface. It
// exposes one complete corridor and exits; no daemon or hidden loop is started.

import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import {
  executeFirstLightMission,
  prepareFirstLightMission,
  resumeFirstLightMission,
} from "./commands/first-light.js";

const RESULT_SCHEMA = "bizra.node0.first_light_cli_result.v0.1";
const CARD_SCHEMA = "bizra.node0.first_light_consent_card.v0.1";
const DEFAULT_QUESTION =
  "What are PAT and SAT, and how do they work together in BIZRA?";
const VALUE_FLAGS = new Set([
  "root",
  "question",
  "provider",
  "model",
  "nonce",
  "now",
  "expires",
  "consent",
  "consent-context",
  "dema-home",
]);
const BOOLEAN_FLAGS = new Set(["json", "help"]);

const HELP = `BIZRA First Light

Usage:
  bizra start
      Interactive local First Light: folder → consent → grounded answer →
      canonicalized local receipt → receipt-derived Proof Card.

  bizra start --root <absolute-folder> --question "<question>"
      [--provider ollama] [--model qwen3:4b]
      [--nonce <nonce>] [--now <RFC3339>] [--expires <RFC3339>] [--json]
      Preview the exact root-bound consent card. Content is not read, no model
      is called, and no First Light state is written.

  bizra start <same preview arguments>
      --consent "<exact phrase>" --consent-context <sha256:...>
      Execute the disclosed context once and persist its verified local receipt
      and Proof Card under DEMA_HOME.

  bizra start --resume [mission-id] [--dema-home <path>] [--json]
      Reload persisted truth and re-verify the receipt, Proof Card, cited file
      hashes, cited excerpts, and reconstructed prompt.

Boundary: local files + named localhost model + DEMA_HOME only. No daemon,
federation, token mint, public network, DNS, or deployment.
`;

function parse(argv) {
  const flags = {};
  const positionals = [];
  const blocked = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    if (BOOLEAN_FLAGS.has(name)) {
      if (Object.hasOwn(flags, name)) blocked.push(`duplicate_flag:${name}`);
      flags[name] = true;
      continue;
    }
    if (name === "resume") {
      if (Object.hasOwn(flags, name)) blocked.push("duplicate_flag:resume");
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        flags.resume = next;
        index += 1;
      } else {
        flags.resume = "";
      }
      continue;
    }
    if (!VALUE_FLAGS.has(name)) {
      blocked.push(`unknown_flag:${name}`);
      continue;
    }
    if (Object.hasOwn(flags, name)) blocked.push(`duplicate_flag:${name}`);
    const value = argv[index + 1];
    if (value == null || value.startsWith("--")) {
      blocked.push(`missing_flag_value:${name}`);
      continue;
    }
    flags[name] = value;
    index += 1;
  }
  return { flags, positionals, blocked_by: [...new Set(blocked)] };
}

function isoAfter(nowIso, minutes) {
  return new Date(Date.parse(nowIso) + minutes * 60_000).toISOString();
}

function blocked(...reasons) {
  return {
    schema: RESULT_SCHEMA,
    status: "BLOCKED",
    ok: false,
    blocked_by: [...new Set(reasons.flat().filter(Boolean))],
  };
}

function consentCard(prepared) {
  return {
    schema: CARD_SCHEMA,
    truth_label: "DISCLOSED_NOT_EXECUTED",
    status: "CONSENT_REQUIRED",
    ok: true,
    mission_id: prepared.mission_id,
    question: prepared.question,
    root: {
      path: prepared.scope.root_path,
      root_set_hash: prepared.scope.root_set_hash,
      file_count: prepared.scope.file_count,
      total_bytes: prepared.scope.total_bytes,
      content_read: prepared.scope.content_read,
      skipped_symlinks: prepared.scope.skipped_symlinks,
      skipped_oversized: prepared.scope.skipped_oversized,
      skipped_directories: prepared.scope.skipped_directories,
    },
    state: { path: prepared.dema_home },
    provider: prepared.provider,
    model: prepared.model,
    target_endpoint: prepared.target_endpoint,
    action_class: prepared.envelope.action_class,
    nonce: prepared.envelope.nonce,
    now_iso: prepared.now_iso,
    expires_at_iso: prepared.envelope.expires_at,
    consent_context_hash: prepared.envelope.consent_context_hash,
    required_phrase: prepared.required_phrase,
    boundary: {
      content_read: false,
      model_invocation_performed: false,
      filesystem_write_performed: false,
    },
  };
}

function completedResult(result) {
  return {
    schema: RESULT_SCHEMA,
    truth_label: "MEASURED_LOCAL",
    status: "COMPLETE",
    ok: true,
    mission_id: result.mission_id,
    verification_state: result.verification_state,
    answer_text: result.answer_text,
    receipt_id: result.receipt.receipt_id,
    proof_card_hash: result.proof_card.proof_card_hash,
    sources: result.proof_card.sources,
    paths: result.paths,
  };
}

function resumedResult(result) {
  return {
    schema: RESULT_SCHEMA,
    truth_label: "MEASURED_LOCAL",
    status: result.ok ? "RESUMED_VERIFIED" : "RESUME_BLOCKED",
    ok: result.ok,
    blocked_by: result.blocked_by,
    mission_id: result.mission_id,
    verification_state: result.verification_state,
    answer_text: result.receipt?.answer?.text ?? null,
    receipt_id: result.receipt?.receipt_id ?? null,
    proof_card_hash: result.proof_card?.proof_card_hash ?? null,
    source_verification: (result.source_verification ?? []).map((source) => ({
      verified: source.verified,
      relative_path: source.relative_path ?? null,
      reason: source.reason ?? null,
    })),
  };
}

function human(value) {
  if (value.status === "CONSENT_REQUIRED") {
    return [
      "BIZRA First Light · CONSENT REQUIRED",
      `Folder: ${value.root.path}`,
      `Scope: ${value.root.file_count} supported files · ${value.root.total_bytes} bytes`,
      `State: ${value.state.path}`,
      `Question: ${value.question}`,
      `Local model: ${value.provider} · ${value.model} · ${value.target_endpoint}`,
      `Action class: ${value.action_class}`,
      `Context: ${value.consent_context_hash}`,
      `Expires: ${value.expires_at_iso}`,
      "",
      "Exact phrase:",
      value.required_phrase,
      "",
      "No content was read, no model was called, and no state was written.",
    ].join("\n");
  }
  if (value.status === "COMPLETE" || value.status === "RESUMED_VERIFIED") {
    return [
      `BIZRA First Light · ${value.status}`,
      `Mission: ${value.mission_id}`,
      `Verification: ${value.verification_state}`,
      "",
      value.answer_text,
      "",
      `Receipt: ${value.receipt_id}`,
      `Proof Card: ${value.proof_card_hash}`,
    ].join("\n");
  }
  return [
    `BIZRA First Light · ${value.status ?? "BLOCKED"}`,
    `Blocked by: ${(value.blocked_by ?? ["unknown"]).join(", ")}`,
  ].join("\n");
}

function emit(value, { json, write_stdout, write_stderr }) {
  if (json) {
    write_stdout(`${JSON.stringify(value, null, 2)}\n`);
  } else if (value.ok === false) {
    write_stderr(`${human(value)}\n`);
  } else {
    write_stdout(`${human(value)}\n`);
  }
}

async function preparedFromFlags(flags, { clock, nonce_factory, env }) {
  const nowIso = flags.now || clock();
  const expiresIso = flags.expires || isoAfter(nowIso, 15);
  const demaHome = resolve(
    flags["dema-home"] || env.DEMA_HOME || join(homedir(), ".dema"),
  );
  return prepareFirstLightMission({
    root_path: flags.root,
    question: flags.question,
    provider: flags.provider || "ollama",
    model: flags.model || "qwen3:4b",
    dema_home: demaHome,
    nonce: flags.nonce || nonce_factory(),
    now_iso: nowIso,
    expires_at_iso: expiresIso,
  });
}

async function runNonInteractive(flags, deps) {
  if (flags.resume !== undefined) {
    const result = await resumeFirstLightMission({
      dema_home: flags["dema-home"] || deps.env.DEMA_HOME,
      mission_id: flags.resume || undefined,
    });
    return resumedResult(result);
  }
  if (!flags.root) return blocked("root_required");
  if (!flags.question) return blocked("question_required");
  if (
    flags.consent &&
    (!flags.nonce || !flags.now || !flags.expires)
  ) {
    return blocked("execution_requires_nonce_now_expires");
  }
  const prepared = await preparedFromFlags(flags, deps);
  if (!prepared.ok) return blocked(prepared.blocked_by);
  if (!flags.consent) return consentCard(prepared);
  if (!flags["consent-context"]) return blocked("consent_context_required");
  if (flags["consent-context"] !== prepared.envelope.consent_context_hash) {
    return blocked("consent_context_mismatch");
  }
  const result = await executeFirstLightMission({
    prepared,
    presented_phrase: flags.consent,
    // Evaluate freshness against the live CLI clock. `--now` reconstructs the
    // disclosed preview only; it must never let a caller revive an expired card.
    now_iso: deps.clock(),
    dema_home: flags["dema-home"] || deps.env.DEMA_HOME,
    model_invoker: deps.model_invoker,
  });
  return result.ok ? completedResult(result) : blocked(result.blocked_by);
}

async function defaultQuestions({ cwd, write_stdout }) {
  const { createInterface } = await import("node:readline/promises");
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  return {
    async values() {
      const rootInput = await reader.question(`Folder [${cwd}]: `);
      const questionInput = await reader.question(`Question [${DEFAULT_QUESTION}]: `);
      return {
        root: rootInput.trim() || cwd,
        question: questionInput.trim() || DEFAULT_QUESTION,
      };
    },
    async consent(requiredPhrase) {
      write_stdout("\nType the exact phrase shown above to continue:\n");
      return reader.question("> ");
    },
    close() {
      reader.close();
    },
  };
}

async function runInteractive(deps) {
  const questions = deps.questions || (await defaultQuestions(deps));
  try {
    const chosen = await questions.values();
    const nowIso = deps.clock();
    const prepared = await prepareFirstLightMission({
      root_path: resolve(chosen.root),
      question: chosen.question,
      provider: "ollama",
      model: "qwen3:4b",
      dema_home: deps.env.DEMA_HOME || join(homedir(), ".dema"),
      nonce: deps.nonce_factory(),
      now_iso: nowIso,
      expires_at_iso: isoAfter(nowIso, 15),
    });
    if (!prepared.ok) return blocked(prepared.blocked_by);
    const card = consentCard(prepared);
    deps.write_stdout(`${human(card)}\n`);
    const phrase = await questions.consent(card.required_phrase);
    const result = await executeFirstLightMission({
      prepared,
      presented_phrase: phrase,
      now_iso: deps.clock(),
      dema_home: deps.env.DEMA_HOME,
      model_invoker: deps.model_invoker,
    });
    return result.ok ? completedResult(result) : blocked(result.blocked_by);
  } finally {
    questions.close?.();
  }
}

export async function runBizraCli({
  argv = process.argv.slice(2),
  env = process.env,
  write_stdout = (value) => process.stdout.write(value),
  write_stderr = (value) => process.stderr.write(value),
  clock = () => new Date().toISOString(),
  nonce_factory = () => randomBytes(16).toString("hex"),
  model_invoker = undefined,
  questions = undefined,
  cwd = process.cwd(),
} = {}) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "help") {
    write_stdout(HELP);
    return 0;
  }
  if (argv[0] !== "start") {
    write_stderr(`Unknown command: ${argv[0]}\n\n${HELP}`);
    return 1;
  }
  const parsed = parse(argv.slice(1));
  if (parsed.flags.help) {
    write_stdout(HELP);
    return 0;
  }
  if (parsed.blocked_by.length || parsed.positionals.length) {
    const result = blocked(
      parsed.blocked_by,
      parsed.positionals.map((value) => `unexpected_argument:${value}`),
    );
    emit(result, { json: parsed.flags.json, write_stdout, write_stderr });
    return 1;
  }
  const deps = {
    env,
    write_stdout,
    write_stderr,
    clock,
    nonce_factory,
    model_invoker,
    questions,
    cwd,
  };
  const result =
    argv.length === 1
      ? await runInteractive(deps)
      : await runNonInteractive(parsed.flags, deps);
  emit(result, {
    json: parsed.flags.json,
    write_stdout,
    write_stderr,
  });
  return result.ok === false ? 1 : 0;
}
