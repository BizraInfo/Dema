import { createHash } from "node:crypto";
import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join, isAbsolute, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const THINK_RECEIPT_SAVE_CONSENT = "SAVE LOCAL THINK RECEIPT";
export const THINK_RECEIPT_SCHEMA = "bizra.dema.think_receipt.v0.1";
const EXPECTED_SOURCE_SCHEMA = "bizra.dema.think_live.v0.1";
const OUTPUT_PREVIEW_MAX = 500;

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export function buildThinkReceipt(envelope, { now = new Date() } = {}) {
  if (!envelope || typeof envelope !== "object") {
    return { error: "Think receipt requires a valid think_live envelope." };
  }
  if (envelope.schema !== EXPECTED_SOURCE_SCHEMA) {
    return {
      error: `Expected schema ${EXPECTED_SOURCE_SCHEMA}, got ${envelope.schema ?? "none"}.`,
    };
  }

  const payload = { ...envelope };
  delete payload.proof_hash;
  const recomputed = sha256(stableStringify(payload));
  const hashMatch = recomputed === envelope.proof_hash;

  if (!hashMatch) {
    return {
      error:
        "proof_hash verification failed — envelope may be tampered. Receipt not saved.",
    };
  }

  const inv = envelope.invocation ?? {};
  const b = envelope.boundary ?? {};
  const be = envelope.boundary_evidence ?? {};

  const receipt = {
    schema: THINK_RECEIPT_SCHEMA,
    generated_at: envelope.generated_at ?? null,
    saved_at: now.toISOString(),
    query: envelope.query ?? null,
    model: envelope.context_manifest?.model ?? null,
    mode: envelope.mode ?? null,
    output_preview: envelope.output
      ? envelope.output.slice(0, OUTPUT_PREVIEW_MAX)
      : null,
    source_envelope: {
      schema: envelope.schema,
      proof_hash: envelope.proof_hash,
      proof_hash_verified: true,
    },
    invocation: {
      status: inv.status ?? null,
      model_responded: inv.model_responded ?? false,
      output_length_chars: inv.output_length_chars ?? 0,
      consent_verified: inv.consent_phrase_verified ?? false,
    },
    boundary_summary: {
      model_invocation_performed: b.model_invocation_performed ?? false,
      consent_collected: b.consent_collected ?? false,
      network_used: b.network_used ?? false,
      public_network_used: b.public_network_used ?? false,
      external_call_performed: b.external_call_performed ?? false,
      external_call_scope: be.external_call_scope ?? null,
      filesystem_write_performed: b.filesystem_write_performed ?? false,
      receipt_mint_performed: b.receipt_mint_performed ?? false,
    },
    evidence_summary: {
      model_invocation: be.model_invocation ?? null,
      public_network: be.public_network ?? null,
      filesystem_write: be.filesystem_write ?? null,
      receipt_minted: be.receipt_minted ?? null,
    },
    save_boundary: {
      filesystem_write_performed: true,
      receipt_mint_performed: false,
      network_used: false,
      public_network_used: false,
    },
    consent_evidence: {
      think_consent_verified: inv.consent_phrase_verified ?? false,
      save_consent_verified: true,
    },
  };

  receipt.receipt_hash = sha256(stableStringify(receipt));
  return receipt;
}

export function serializeThinkReceipt(receipt, { pretty = false } = {}) {
  return (
    (pretty ? JSON.stringify(receipt, null, 2) : JSON.stringify(receipt)) + "\n"
  );
}

export function buildThinkReceiptSavePath(
  receipt,
  { demaHome, pretty = false } = {},
) {
  const home = resolveDemaHome(demaHome);
  const content = serializeThinkReceipt(receipt, { pretty });
  const sha = sha256Hex(content);
  const filename = `think-${sha}.json`;
  const dir = join(home, "receipts");
  return {
    dir,
    filename,
    path: join(dir, filename),
    sha256: sha,
    content,
    dema_home: home,
  };
}

async function assertContained(receiptsDir, finalPath) {
  const realRoot = await realpath(receiptsDir);
  const absFinal = resolve(receiptsDir, finalPath);
  const rel = relative(realRoot, absFinal);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error(
      `think-receipt-save: save target escapes receipts dir: ${absFinal}`,
    );
  }
}

export async function saveThinkReceipt(
  envelope,
  { demaHome, consent, pretty = false, now } = {},
) {
  if (typeof consent !== "string" || consent.length === 0) {
    return {
      saved: false,
      reason: "consent_missing",
      expected: THINK_RECEIPT_SAVE_CONSENT,
    };
  }
  if (consent !== THINK_RECEIPT_SAVE_CONSENT) {
    return {
      saved: false,
      reason: "consent_mismatch",
      expected: THINK_RECEIPT_SAVE_CONSENT,
    };
  }

  const receipt = buildThinkReceipt(envelope, { now });
  if (receipt.error) {
    return {
      saved: false,
      reason: "verification_failed",
      error_message: receipt.error,
    };
  }

  const {
    dir: receiptsDir,
    filename,
    path: finalPath,
    sha256: sha,
    content,
    dema_home,
  } = buildThinkReceiptSavePath(receipt, { demaHome, pretty });

  await mkdir(receiptsDir, { recursive: true });
  await assertContained(receiptsDir, filename);

  const tmpFilename = `${filename}.tmp-${process.pid}-${Date.now()}`;
  const tmpPath = join(receiptsDir, tmpFilename);

  try {
    await writeFile(tmpPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tmpPath, finalPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      /* swallow */
    }
    return {
      saved: false,
      reason: "io_error",
      expected: THINK_RECEIPT_SAVE_CONSENT,
      error_message: err?.message ?? String(err),
    };
  }

  return Object.freeze({
    saved: true,
    path: finalPath,
    filename,
    sha256: sha,
    dema_home,
  });
}
