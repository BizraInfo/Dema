// DEMA-ASK-H3H4 — `dema ask` CLI adapter.
//
// dema ask "<question>" --scope <folder> --consent "GO: dema ask H3/H4 sanitizer-gated"
// dema ask verify <receipt.json>
//
// Reads text files under --scope (content_read), sanitizes each file, indexes ONLY
// ALLOWED text, answers (extractive by default; --invoke for local LLM), and writes
// one truth-graph receipt under $DEMA_HOME/ask/<hash>.json (tmp+rename, mode 0600).

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

import {
  DEMA_ASK_H3H4_GO_PHRASE,
  runDemaAskH3H4,
  verifyDemaAskH3H4Receipt,
} from "../../../../packages/core/src/dema-ask-h3h4.js";
import { llmAdapterConsentPhraseFor } from "../../../../packages/core/src/llm-adapter.js";

const TEXT_EXTS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".json",
  ".csv",
  ".rst",
]);
const MAX_FILE_BYTES = 256_000;
const MAX_FILES = 200;

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function resolveDemaHome(explicit) {
  return explicit || process.env.DEMA_HOME || join(homedir(), ".dema");
}

async function walkTextFiles(scopeAbs, { maxFiles = MAX_FILES } = {}) {
  const out = [];
  const stack = [scopeAbs];
  while (stack.length > 0 && out.length < maxFiles) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (out.length >= maxFiles) break;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".git") continue;
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = extname(ent.name).toLowerCase();
      if (!TEXT_EXTS.has(ext)) continue;
      out.push(full);
    }
  }
  return out;
}

/**
 * Load scope into docs with scope-relative paths (Layer-1 safe cites).
 */
export async function gatherAskScopeDocs(scopePath) {
  if (!scopePath || typeof scopePath !== "string" || scopePath.startsWith("--")) {
    return { ok: false, error: "missing_scope", docs: [], disk_source_hashes: {} };
  }
  const scopeAbs = isAbsolute(scopePath) ? resolve(scopePath) : resolve(process.cwd(), scopePath);
  let scopeReal;
  try {
    scopeReal = await realpath(scopeAbs);
    const st = await stat(scopeReal);
    if (!st.isDirectory()) {
      return { ok: false, error: "scope_not_directory", docs: [], disk_source_hashes: {} };
    }
  } catch {
    return { ok: false, error: "scope_not_found", docs: [], disk_source_hashes: {} };
  }

  const files = await walkTextFiles(scopeReal);
  const docs = [];
  const disk_source_hashes = {};
  for (const abs of files) {
    let st;
    try {
      st = await stat(abs);
    } catch {
      continue;
    }
    if (st.size > MAX_FILE_BYTES) continue;
    let raw;
    try {
      raw = await readFile(abs);
    } catch {
      continue;
    }
    const text = raw.toString("utf8");
    // Skip obvious binary.
    if (text.includes("\u0000")) continue;
    const rel = relative(scopeReal, abs).split("\\").join("/");
    const content_hash = `sha256:${sha256Hex(raw)}`;
    disk_source_hashes[rel] = content_hash;
    docs.push({ path: rel, text, abs_path: abs });
  }
  return {
    ok: true,
    error: null,
    scope: scopeReal,
    docs,
    disk_source_hashes,
  };
}

async function writeAskReceipt(receipt, demaHome) {
  const home = resolveDemaHome(demaHome);
  const dir = join(home, "ask");
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const hashHex =
    String(receipt.content_hash || "").replace("sha256:", "").slice(0, 16) || "receipt";
  const finalPath = join(realDir, `${hashHex}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(receipt, null, 2), {
    encoding: "utf8",
    mode: 0o600,
    flag: "w",
  });
  await rename(tmpPath, finalPath);
  return finalPath;
}

export async function runAskCommand({
  question,
  scope,
  consent,
  demaHome,
  answer_mode = "extractive",
  model,
  llm_consent,
  fetchImpl,
  created_at,
  planted_tokens = [],
  top_k = 5,
} = {}) {
  if (!question || typeof question !== "string" || question.trim() === "") {
    return { ok: false, error: "missing_question", wrote: false };
  }
  if (consent !== DEMA_ASK_H3H4_GO_PHRASE) {
    return {
      ok: false,
      error: "consent_phrase_mismatch",
      required_consent: DEMA_ASK_H3H4_GO_PHRASE,
      wrote: false,
      awaiting_consent: true,
    };
  }

  const gathered = await gatherAskScopeDocs(scope);
  if (!gathered.ok) {
    return { ok: false, error: gathered.error, wrote: false };
  }

  // Harvest planted secret-shaped tokens from non-ALLOWED docs for perimeter proof.
  // (Kernel never puts them in prompt; we still assert absence.)
  const autoPlanted = [];
  for (const doc of gathered.docs) {
    const m = String(doc.text).match(/\bsk-[A-Za-z0-9:_-]{12,}\b/g);
    if (m) autoPlanted.push(...m);
  }
  const tokens = [...new Set([...planted_tokens, ...autoPlanted])];

  const result = await runDemaAskH3H4({
    consent,
    input: {
      question,
      docs: gathered.docs.map((d) => ({ path: d.path, text: d.text })),
      consent_scope: `scope:${gathered.scope}`,
    },
    answer_mode,
    top_k,
    created_at: typeof created_at === "number" ? created_at : Date.now(),
    model,
    llm_consent,
    fetchImpl,
    planted_tokens: tokens,
  });

  if (!result.ok || !result.receipt) {
    return {
      ok: false,
      error: "ask_refused",
      blocked_by: result.blocked_by,
      wrote: false,
      result,
    };
  }

  const verified = verifyDemaAskH3H4Receipt(result.receipt, {
    disk_source_hashes: gathered.disk_source_hashes,
    planted_tokens: tokens,
  });
  if (!verified.ok) {
    return {
      ok: false,
      error: "receipt_verify_failed",
      blocked_by: verified.blocked_by,
      wrote: false,
      receipt: result.receipt,
    };
  }

  const receiptPath = await writeAskReceipt(result.receipt, demaHome);
  return {
    ok: true,
    error: null,
    wrote: true,
    receiptPath,
    receipt: result.receipt,
    verified,
    corpus: result.corpus,
    planted_tokens_checked: tokens,
  };
}

export async function runAskVerify({ receiptPath, scope } = {}) {
  if (!receiptPath || typeof receiptPath !== "string" || receiptPath.startsWith("--")) {
    return { ok: false, error: "missing_receipt_argument" };
  }
  let raw;
  try {
    raw = await readFile(await realpath(receiptPath), "utf8");
  } catch {
    return { ok: false, error: "receipt_not_found" };
  }
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch {
    return { ok: false, error: "receipt_not_json" };
  }

  let disk_source_hashes = null;
  if (scope) {
    const gathered = await gatherAskScopeDocs(scope);
    if (gathered.ok) disk_source_hashes = gathered.disk_source_hashes;
  }

  const verified = verifyDemaAskH3H4Receipt(receipt, { disk_source_hashes });
  return { ok: verified.ok, verified, receiptPath };
}

function firstAskPositional(argv) {
  // Dispatcher leaves the command token at argv[0] (same contract as talk/corpus).
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a || a.startsWith("-")) continue;
    if (a === "verify") continue;
    return a;
  }
  return undefined;
}

function emitAskResult(out) {
  const sanitizer =
    out.receipt?.sanitizer ??
    (out.result?.corpus
      ? {
          allowed_count: out.result.corpus.allowed_count,
          quarantined_count: out.result.corpus.quarantined_count,
          blocked_count: out.result.corpus.blocked_count,
          quarantined: out.result.corpus.quarantined,
        }
      : null);
  console.log(
    JSON.stringify(
      {
        ok: out.ok,
        error: out.error ?? null,
        blocked_by: out.blocked_by ?? out.result?.blocked_by ?? null,
        wrote: out.wrote,
        receiptPath: out.receiptPath ?? null,
        answer: out.receipt?.answer ?? null,
        answer_hash: out.receipt?.answer_hash ?? null,
        source_refs: out.receipt?.source_refs ?? null,
        source_hashes: out.receipt?.source_hashes ?? null,
        sanitizer,
        verified: out.verified ?? null,
      },
      null,
      2,
    ),
  );
}

export async function cmd_ask(ctx) {
  const { argv } = ctx;
  // argv[0] === "ask"; subcommands start at argv[1]
  const sub = argv[1];

  if (sub === "verify") {
    const receiptPath = argv[2];
    const scope = argValue(argv, "--scope");
    const out = await runAskVerify({ receiptPath, scope });
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  // dema ask "<question>" --scope DIR --consent "…"
  let question = argValue(argv, "--question") ?? firstAskPositional(argv);
  const scope = argValue(argv, "--scope");
  const consent = argValue(argv, "--consent") ?? "";
  const demaHome = argValue(argv, "--dema-home");
  const wantsInvoke = argv.includes("--invoke");
  // ASK-INVOKE-CONSENT-FAIL-CLOSED-1A — no default model, no self-issued
  // consent. Both must come from the human; see the gate below.
  const model = argValue(argv, "--model");
  const llmConsent = argValue(argv, "--llm-consent");

  if (!consent || consent !== DEMA_ASK_H3H4_GO_PHRASE) {
    const preview = {
      schema: "bizra.dema.ask_h3h4.cli.v0.1",
      status: "AWAITING_CONSENT",
      required_consent: DEMA_ASK_H3H4_GO_PHRASE,
      usage:
        'dema ask "<question>" --scope <folder> --consent "GO: dema ask H3/H4 sanitizer-gated"',
      note: "Without exact consent, no corpus content is read into the ask index.",
    };
    console.log(JSON.stringify(preview, null, 2));
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  // ASK-INVOKE-CONSENT-FAIL-CLOSED-1A — the CLI checks PRESENCE only; the
  // adapter remains the sole judge of correctness (exact-string match). The
  // CLI must never issue the phrase on the human's behalf: the party doing the
  // invoking cannot also be the party certifying it was authorized. Refuses
  // before runAskCommand, so no corpus is read on this path either.
  if (wantsInvoke) {
    if (!model) {
      process.stderr.write(
        "dema ask: --invoke requires --model <name> — no default; the human names the model.\n",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (!llmConsent) {
      process.stderr.write(
        `dema ask: --invoke requires --llm-consent "${llmAdapterConsentPhraseFor(model)}" — typed by you, never issued by the CLI.\n`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
  }

  const out = await runAskCommand({
    question,
    scope,
    consent,
    demaHome,
    answer_mode: wantsInvoke ? "llm_invoke" : "extractive",
    model: wantsInvoke ? model : undefined,
    llm_consent: wantsInvoke ? llmConsent : undefined,
  });

  emitAskResult(out);
  if (!out.ok) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
