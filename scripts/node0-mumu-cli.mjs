// N0-MUMU-CLI-1/2 · read-only CLI surface over the sealed Node0 Mumu closed loop.
//
// Dema is the face: it READS and REPORTS the loop's receipt chain. It does NOT
// run the governed runtime (that stays `npm run node0`) and never mutates the
// chain. These builders back `dema node0 mumu status`, `verify`, `consent`, and
// `journey`. Stdlib only; no network/shell imports. See ADR-037.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { readReceiptChain, verifyReplay } from "./node0-mumu-replay.mjs";

export const SCHEMA_PREFIX = "bizra.dema.node0_mumu";

// Declared GENESIS single-node invariants (ADR-037 §Network mode). The drift
// guard in tests binds these to the loop's persisted state/network-mode.v0.1.json.
export const NETWORK_MODE = Object.freeze({
  network_mode: "GENESIS_SINGLE_NODE_ACTIVE_NETWORK",
  node_count: 1,
  external_federation_active: false,
  global_kernel_active_locally: true,
  local_urp_active: true,
  public_network_claim: false,
  token_minted: false,
  wallet_used: false,
  network_used: false,
});

// Read-only boundary stamp. Reading + hash-verifying a chain is project
// verification, not governed runtime execution (canonical key stays false).
function readOnlyBoundary() {
  return {
    read_only: true,
    runtime_execution_performed: false,
    token_minted: false,
    file_content_read: false,
  };
}

export function defaultOutDir() {
  if (process.env.DEMA_MUMU_OUT) {
    return resolve(process.env.DEMA_MUMU_OUT);
  }
  const demaHome = process.env.DEMA_HOME || join(homedir(), ".dema");
  const homeOut = join(demaHome, "node0", "mumu");
  const chainPath = join(homeOut, "receipts", "receipt-chain.v0.1.jsonl");
  if (existsSync(chainPath)) {
    return resolve(homeOut);
  }
  return resolve(join("artifacts", "node0", "mumu"));
}

export const JOURNEY_STAGES = Object.freeze({
  INACTIVE: "INACTIVE",
  AWAITING_CONSENT: "AWAITING_CONSENT",
  ACTIVE: "ACTIVE",
  TAMPERED: "TAMPERED",
});

export function readConsentRequest(outDir) {
  const path = join(resolve(outDir), "covenant", "consent-request.v0.1.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { parse_error: true };
  }
}

function loopActionComplete(outDir) {
  return existsSync(
    join(resolve(outDir), "action", "mumu-today.v0.1.md"),
  );
}

export function buildMumuConsent({ outDir = defaultOutDir() } = {}) {
  const abs = resolve(outDir);
  const raw = readConsentRequest(abs);
  const loopComplete = loopActionComplete(abs);
  if (!raw || raw.parse_error) {
    return {
      schema: `${SCHEMA_PREFIX}_cli_consent.v0.1`,
      consent_pending: false,
      loop_complete: loopComplete,
      out_dir: abs,
      boundary: readOnlyBoundary(),
      next_step:
        "npm run node0 -- --root <dir> --metadata-only",
    };
  }
  return {
    schema: `${SCHEMA_PREFIX}_cli_consent.v0.1`,
    consent_pending: !loopComplete,
    loop_complete: loopComplete,
    decision_id: raw.decision_id,
    expected_consent_phrase: raw.expected_consent_phrase,
    instruction: raw.instruction,
    out_dir: abs,
    boundary: readOnlyBoundary(),
    next_step: loopComplete
      ? "dema node0 mumu verify"
      : `npm run node0 -- --root <dir> --metadata-only --consent "${raw.expected_consent_phrase}"`,
  };
}

export function buildMumuJourney({
  outDir = defaultOutDir(),
  operator = "Mumu",
} = {}) {
  const status = buildMumuStatus({ outDir });
  const verify = buildMumuVerify({ outDir });
  const consent = buildMumuConsent({ outDir });

  let stage;
  if (verify.verdict === "VERIFIED") stage = JOURNEY_STAGES.ACTIVE;
  else if (!status.chain_present) stage = JOURNEY_STAGES.INACTIVE;
  else if (consent.consent_pending) stage = JOURNEY_STAGES.AWAITING_CONSENT;
  else stage = JOURNEY_STAGES.TAMPERED;

  const steps = [
    {
      id: "propose",
      label: "Metadata scan + covenant proposal",
      command: "npm run node0 -- --root <dir> --metadata-only",
      done: status.chain_present,
    },
    {
      id: "consent",
      label: "Exact-string consent for action artifacts",
      command: consent.expected_consent_phrase
        ? `npm run node0 -- --root <dir> --metadata-only --consent "${consent.expected_consent_phrase}"`
        : null,
      done: consent.loop_complete,
    },
    {
      id: "verify",
      label: "Dema face replay-verify",
      command: "dema node0 mumu verify",
      done: verify.verdict === "VERIFIED",
    },
    {
      id: "realm",
      label: "Dema realm home (operator face)",
      command: "dema realm",
      done: verify.verdict === "VERIFIED",
    },
  ];

  const next_command =
    stage === JOURNEY_STAGES.INACTIVE
      ? steps[0].command
      : stage === JOURNEY_STAGES.AWAITING_CONSENT
        ? steps[1].command
        : stage === JOURNEY_STAGES.ACTIVE
          ? "dema realm"
          : "dema node0 mumu verify --json";

  return {
    schema: `${SCHEMA_PREFIX}_cli_journey.v0.1`,
    operator,
    activation_target: operator,
    stage,
    out_dir: status.out_dir,
    status_summary: {
      chain_present: status.chain_present,
      receipt_count: status.receipt_count,
      verify_verdict: verify.verdict,
    },
    consent: consent.consent_pending
      ? {
          decision_id: consent.decision_id,
          expected_consent_phrase: consent.expected_consent_phrase,
        }
      : null,
    steps,
    next_command,
    governed_loop_entry: "npm run node0",
    boundary: readOnlyBoundary(),
    note:
      stage === JOURNEY_STAGES.ACTIVE
        ? `Dema is active for ${operator} on GENESIS single-node mode.`
        : "Close the loop: governed runtime stays npm run node0; Dema reads and verifies.",
  };
}

export function buildMumuStatus({ outDir = defaultOutDir() } = {}) {
  const abs = resolve(outDir);
  const receipts = readReceiptChain(abs);
  const chainPresent = receipts.length > 0;
  return {
    schema: `${SCHEMA_PREFIX}_cli_status.v0.1`,
    loop_available: true,
    out_dir: abs,
    chain_present: chainPresent,
    receipt_count: receipts.length,
    network_mode: NETWORK_MODE,
    boundary: readOnlyBoundary(),
    next_step: chainPresent
      ? "dema node0 mumu journey"
      : "dema node0 mumu journey  # then npm run node0 -- --root <dir> --metadata-only",
  };
}

export function buildMumuVerify({ outDir = defaultOutDir() } = {}) {
  const abs = resolve(outDir);
  const receipts = readReceiptChain(abs);
  if (receipts.length === 0) {
    return {
      schema: `${SCHEMA_PREFIX}_cli_verify.v0.1`,
      chain_present: false,
      verdict: "ABSENT",
      boundary: readOnlyBoundary(),
      note: "No receipt chain found. Run `npm run node0` first.",
    };
  }
  const replay = verifyReplay({ outDir: abs });
  return {
    schema: `${SCHEMA_PREFIX}_cli_verify.v0.1`,
    chain_present: true,
    verdict: replay.ok ? "VERIFIED" : "TAMPERED",
    replay,
    boundary: readOnlyBoundary(),
  };
}
