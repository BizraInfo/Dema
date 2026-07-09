// NODE0-FOUNDER-IMPACT-LOOP-0A — `dema founder impact` effect layer.
//
// scope  — dry-run: read a manifest, gather the declared bounded source set (read-only), build the
//          candidate receipt IN MEMORY, print the scope. Writes NOTHING.
// run    — read a manifest, build + verify the candidate receipt, and ONLY under the exact consent phrase
//          atomically write it under $DEMA_HOME/founder-impact/<content-hash>.json (tmp+rename, mode 0600).
// verify — read a receipt file (read-only) and re-derive the whole body via the pure verifier.
//
// The pure kernels live in packages/core/src; fs is confined here. No model, network, daemon, mint, or
// federation. committed_live/mint stay false; the receipt binds source hashes, never raw bytes.

import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { wantsJson, humanHintLine } from "../../../../packages/core/src/output-mode.js";
import { gatherFounderImpactSources } from "../../../../packages/core/src/node0-founder-impact-gather.js";
import {
  buildFounderImpactReceipt,
  verifyFounderImpactReceipt,
  NODE0_FOUNDER_IMPACT_LOOP_GO_PHRASE,
} from "../../../../packages/core/src/node0-founder-impact-loop-preview.js";

const injectedFs = { readFile, stat };

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function readManifest(manifestPath) {
  const abs = manifestPath && isAbsolute(manifestPath) ? resolve(manifestPath) : manifestPath;
  let raw;
  try {
    raw = await readFile(abs, "utf8");
  } catch {
    return { ok: false, error: "manifest_not_found_or_unreadable", manifest: null };
  }
  try {
    return { ok: true, error: null, manifest: JSON.parse(raw) };
  } catch {
    return { ok: false, error: "manifest_not_valid_json", manifest: null };
  }
}

// Testable I/O core for `dema founder impact scope <manifest>`. Read-only; writes nothing.
export async function runFounderImpactScope({ manifestPath } = {}) {
  if (!manifestPath || typeof manifestPath !== "string" || manifestPath.startsWith("--")) {
    return { ok: false, error: "missing_manifest_argument" };
  }
  const m = await readManifest(manifestPath);
  if (!m.ok) return { ok: false, error: m.error };
  const gathered = await gatherFounderImpactSources({ manifest: m.manifest, fs: injectedFs });
  if (!gathered.ok) return { ok: false, error: "gather_failed", blocked_by: gathered.blocked_by };
  // Build in memory only (no consent phrase needed to PREVIEW the shape — nothing is written).
  const built = buildFounderImpactReceipt({ consent: NODE0_FOUNDER_IMPACT_LOOP_GO_PHRASE, input: gathered.input });
  return { ok: built.ok, built, wrote: false };
}

async function writeFounderImpactReceipt(receipt, demaHome) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "founder-impact");
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const hashHex = String(receipt.content_hash || "").replace("sha256:", "").slice(0, 16) || "receipt";
  const finalPath = join(realDir, `${hashHex}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(receipt, null, 2), { encoding: "utf8", mode: 0o600, flag: "w" });
  await rename(tmpPath, finalPath);
  return finalPath;
}

// Testable I/O core for `dema founder impact run <manifest> --consent "…"`.
export async function runFounderImpactRun({ manifestPath, consent, demaHome } = {}) {
  if (!manifestPath || typeof manifestPath !== "string" || manifestPath.startsWith("--")) {
    return { ok: false, error: "missing_manifest_argument" };
  }
  const m = await readManifest(manifestPath);
  if (!m.ok) return { ok: false, error: m.error };
  const gathered = await gatherFounderImpactSources({ manifest: m.manifest, fs: injectedFs });
  if (!gathered.ok) return { ok: false, error: "gather_failed", blocked_by: gathered.blocked_by };

  const built = buildFounderImpactReceipt({ consent: consent ?? "", input: gathered.input });
  if (!built.ok || !built.receipt) {
    return { ok: false, error: null, built, wrote: false, write_refused_reason: built.blocked_by?.join(",") ?? "not_built" };
  }
  const verified = verifyFounderImpactReceipt(built.receipt);
  const writeConsentOk = consent === NODE0_FOUNDER_IMPACT_LOOP_GO_PHRASE;
  let receiptPath = null;
  if (writeConsentOk && verified.ok) {
    receiptPath = await writeFounderImpactReceipt(built.receipt, demaHome);
  }
  return {
    ok: built.ok && verified.ok,
    error: null,
    built,
    verified,
    wrote: Boolean(receiptPath),
    write_refused_reason: writeConsentOk ? null : "write_consent_required",
    receiptPath,
  };
}

// Testable I/O core for `dema founder impact verify <receipt>`.
export async function runFounderImpactVerify({ receiptPath } = {}) {
  if (!receiptPath || typeof receiptPath !== "string" || receiptPath.startsWith("--")) {
    return { ok: false, error: "missing_receipt_argument" };
  }
  let raw;
  try {
    raw = await readFile(await realpath(receiptPath), "utf8");
  } catch {
    return { ok: false, error: "receipt_not_found_or_unreadable" };
  }
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch {
    return { ok: false, error: "receipt_not_valid_json" };
  }
  const verified = verifyFounderImpactReceipt(receipt);
  return { ok: verified.ok, error: null, verified, receipt };
}

export async function cmd_founder(ctx) {
  const { argv } = ctx;
  const group = argv[1]; // "impact"
  const action = argv[2]; // scope | run | verify
  const wantJson = wantsJson(argv);

  if (group !== "impact" || !["scope", "run", "verify"].includes(action)) {
    const usage =
      'dema founder impact scope <manifest> [--json] · dema founder impact run <manifest> --consent "GO: dema founder impact loop 0a" [--json] · dema founder impact verify <receipt> [--json]';
    console.error(`Dema error: unknown founder subcommand. Usage: ${usage}`);
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (action === "scope") {
    const out = await runFounderImpactScope({ manifestPath: argv[3] });
    if (out.error) {
      if (wantJson) console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error, blocked_by: out.blocked_by ?? [] }, null, 2));
      else console.error(`Dema error: ${out.error}${out.blocked_by ? " · " + out.blocked_by.join(", ") : ""}`);
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const b = out.built;
    const r = b.receipt;
    if (wantJson) {
      console.log(JSON.stringify({
        preview_only: true,
        ok: b.ok,
        status: b.status,
        wrote: false,
        impact_class: r?.impact_class ?? null,
        served_to: r?.served_to ?? null,
        source_count: r?.source_count ?? null,
        digest_content_hash: r?.digest_content_hash ?? null,
        content_hash: r?.content_hash ?? null,
        continue_allowed: b.continue_allowed,
        mint_allowed: r?.mint_allowed ?? false,
        fde_summary: r?.fde_summary ?? null,
        boundary: r?.boundary ?? null,
        blocked_by: b.blocked_by,
      }, null, 2));
    } else {
      const lines = [
        "DEMA · FOUNDER IMPACT SCOPE — LOCAL_ONLY (dry-run · reads declared sources · writes nothing · no model/network/mint)",
        `  status: ${b.status}`,
        `  sources: ${r?.source_count ?? "-"} · impact_class: ${r?.impact_class ?? "-"} · served_to: ${r?.served_to ?? "-"}`,
        `  digest: ${r?.digest_content_hash ?? "-"}`,
        `  content_hash: ${r?.content_hash ?? "-"}`,
        `  fde (advisory): ${r?.fde_summary?.failure_class ?? "-"} (${r?.fde_summary?.lens ?? "-"})`,
        `  continue_allowed: ${b.continue_allowed} · mint_allowed: ${r?.mint_allowed ?? false}`,
      ];
      if (!b.ok) for (const c of b.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("founder impact scope"));
      console.log(lines.join("\n"));
    }
    if (!b.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (action === "run") {
    const out = await runFounderImpactRun({
      manifestPath: argv[3],
      consent: argValue(argv, "--consent"),
      demaHome: argValue(argv, "--dema-home"),
    });
    if (out.error) {
      if (wantJson) console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error, blocked_by: out.blocked_by ?? [] }, null, 2));
      else console.error(`Dema error: ${out.error}${out.blocked_by ? " · " + out.blocked_by.join(", ") : ""}`);
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const b = out.built;
    const r = b.receipt;
    if (wantJson) {
      console.log(JSON.stringify({
        preview_only: true,
        ok: out.ok,
        status: b.status,
        wrote: out.wrote,
        write_refused_reason: out.write_refused_reason,
        receipt_path: out.receiptPath,
        content_hash: r?.content_hash ?? null,
        impact_class: r?.impact_class ?? null,
        served_to: r?.served_to ?? null,
        mint_allowed: r?.mint_allowed ?? false,
        continue_allowed: b.continue_allowed,
        boundary: r?.boundary ?? null,
        blocked_by: b.blocked_by,
      }, null, 2));
    } else {
      const lines = [
        "DEMA · FOUNDER IMPACT RUN — LOCAL_ONLY (candidate receipt · atomic write under DEMA_HOME · no model/network/mint)",
        `  status: ${b.status}`,
        `  content_hash: ${r?.content_hash ?? "-"}`,
      ];
      if (out.wrote) lines.push(`  receipt written: ${out.receiptPath}`);
      else lines.push(`  receipt: NOT written (${out.write_refused_reason ?? "not built"}) — add --consent "${NODE0_FOUNDER_IMPACT_LOOP_GO_PHRASE}"`);
      lines.push(`  impact_class: ${r?.impact_class ?? "-"} · served_to: ${r?.served_to ?? "-"} · mint_allowed: ${r?.mint_allowed ?? false}`);
      if (!out.ok) for (const c of b.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("founder impact run"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  // verify
  const out = await runFounderImpactVerify({ receiptPath: argv[3] });
  if (out.error) {
    if (wantJson) console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error }, null, 2));
    else console.error(`Dema error: ${out.error}`);
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (wantJson) {
    console.log(JSON.stringify({ preview_only: true, ok: out.ok, verdict: out.ok ? "VERIFIED" : "FAILED", blocked_by: out.verified.blocked_by }, null, 2));
  } else {
    const lines = [
      "DEMA · FOUNDER IMPACT VERIFY — LOCAL_ONLY (read-only re-derivation · no model/network/mint)",
      `  verdict: ${out.ok ? "VERIFIED" : "FAILED"}`,
    ];
    if (!out.ok) for (const c of out.verified.blocked_by || []) lines.push(`    ${c}`);
    lines.push(humanHintLine("founder impact verify"));
    console.log(lines.join("\n"));
  }
  if (!out.ok) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
