import {
  buildModelBrokerPreview,
  routeForTask,
} from "../../../../packages/models/src/model-broker-preview.js";
import {
  DEFAULT_SAMPLE_REGISTRY,
  buildRegistryFromConfig,
} from "../../../../packages/models/src/model-registry-config-preview.js";

/** Exact consent required to load an operator roster file (TASK-043). */
export const MODEL_REGISTRY_LOAD_CONSENT =
  "GO: load operator model registry";

/**
 * Documented operator roster location (under DEMA_HOME).
 * Schema: { entries: [ { id, provider, model_name, role, size_class,
 *   locality, allowed_tasks, max_concurrency, context_limit, status } ] }
 */
import {
  ROUTE_RECEIPT_SAVE_CONSENT,
  serializeRouteReceiptForSave,
  saveRouteReceipt,
} from "../../../../packages/receipts/src/route-receipt-save.js";
import { invokeRoutedLocalModel } from "../../../../packages/core/src/routed-llm-invocation.js";
import {
  INVOCATION_RESULT_SAVE_CONSENT,
  serializeInvocationResultForSave,
  saveInvocationResult,
} from "../../../../packages/receipts/src/invocation-result-save.js";
import {
  VERIFICATION_RESULT_SAVE_CONSENT,
  serializeVerificationResultForSave,
  saveVerificationResult,
} from "../../../../packages/receipts/src/verification-result-save.js";
import {
  verifyRoutedInvocationEnvelope,
  readEnvelopeFromFile,
  resolveLatestInvocationPath,
} from "../../../../packages/core/src/routed-invocation-verifier.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_model_broker(ctx) {
  const { argv } = ctx;
  // CLI preview for the local model broker + registry config + verifier.
  // v0.1 (PR #81): --registry-stdin + DEFAULT_SAMPLE_REGISTRY.
  // v0.2 (PR #82): --use-local-registry + --registry-file <abs-path>
  // v0.2 (PR #83): --save-receipt + exact consent
  // v0.1 (PR #84): --invoke + --invoke-consent + bridge to llm-adapter
  // v0.1 (PR #85): --save-invocation-result + exact consent
  // v0.1 (this slice): verify-invocation action — deterministic
  //   invariant checker over saved invocation envelopes.
  // Emits route receipt OR routed invocation envelope OR verification
  // envelope JSON to stdout depending on action + flags. Does NOT invoke
  // any model except through the explicit --invoke gate. Does NOT call
  // network outside the adapter. Does NOT mint receipts.
  const action = argv[1];
  if (action === "verify-invocation") {
    // ─── verify-invocation deterministic invariant checker ──────────────
    const explicitFile = argValue(argv, "--invocation-result-file") ?? null;
    const useLatest = argv.includes("--latest");
    const pretty = argv.includes("--pretty");

    if (explicitFile && useLatest) {
      process.stderr.write(
        "dema model-broker verify-invocation: --invocation-result-file and --latest are mutually exclusive\n",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (!explicitFile && !useLatest) {
      process.stderr.write(
        "dema model-broker verify-invocation: one of --invocation-result-file <abs-path> or --latest is required\n",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const { isAbsolute: pathIsAbsolute } = await import("node:path");

    let targetPath;
    let sourceKind;
    if (explicitFile) {
      if (!pathIsAbsolute(explicitFile)) {
        process.stderr.write(
          `dema model-broker verify-invocation: --invocation-result-file path must be absolute (got: ${explicitFile})\n`,
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      targetPath = explicitFile;
      sourceKind = "file";
    } else {
      const latest = await resolveLatestInvocationPath({
        demaHome: process.env.DEMA_HOME,
      });
      if (!latest) {
        process.stderr.write(
          "dema model-broker verify-invocation: no invocation-*.json files found in $DEMA_HOME/receipts/\n",
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      targetPath = latest;
      sourceKind = "latest";
    }

    let readResult;
    try {
      readResult = await readEnvelopeFromFile(targetPath);
    } catch (err) {
      if (err?.code === "ENOENT") {
        process.stderr.write(
          `dema model-broker verify-invocation: envelope file not found: ${targetPath}\n`,
        );
      } else if (err instanceof SyntaxError) {
        process.stderr.write(
          `dema model-broker verify-invocation: malformed envelope JSON at ${targetPath}: ${err.message}\n`,
        );
      } else {
        process.stderr.write(
          `dema model-broker verify-invocation: envelope read failed at ${targetPath}: ${err?.message ?? err}\n`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const verification = verifyRoutedInvocationEnvelope(readResult.envelope, {
      source: {
        kind: sourceKind,
        path: targetPath,
        source_invocation_result_hash: readResult.sourceHash,
      },
    });

    // v0.1 (this slice): --save-verification-result + exact consent.
    // Single serialization shared by save + stdout (byte-for-byte).
    const verificationOut = serializeVerificationResultForSave(verification, {
      pretty,
    });
    const saveVerificationFlag = argv.includes("--save-verification-result");
    if (saveVerificationFlag) {
      const saveConsent = argValue(argv, "--save-verification-consent") ?? null;
      const saveResult = await saveVerificationResult(verification, {
        demaHome: process.env.DEMA_HOME,
        consent: saveConsent,
        pretty,
      });
      if (!saveResult.saved) {
        if (saveResult.reason === "consent_missing") {
          process.stderr.write(
            `dema model-broker verify-invocation: --save-verification-result requires --save-verification-consent "${VERIFICATION_RESULT_SAVE_CONSENT}"\n`,
          );
        } else if (saveResult.reason === "consent_mismatch") {
          process.stderr.write(
            `dema model-broker verify-invocation: --save-verification-result consent phrase mismatch; required: "${VERIFICATION_RESULT_SAVE_CONSENT}"\n`,
          );
        } else {
          process.stderr.write(
            `dema model-broker verify-invocation: --save-verification-result failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
          );
        }
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      process.stderr.write(
        `saved verification result to: ${saveResult.path}\n`,
      );
    }

    process.stdout.write(verificationOut);

    if (verification.verdict !== "compliant") {
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }

  if (action !== "route") {
    process.stderr.write(
      `dema model-broker: unknown action '${action ?? ""}' (expected: route | verify-invocation)\n`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  // --save-verification-result is only valid for verify-invocation; reject
  // here so the operator gets a precise pointer instead of silent ignore.
  if (
    argv.includes("--save-verification-result") ||
    argv.includes("--save-verification-consent")
  ) {
    process.stderr.write(
      "dema model-broker route: --save-verification-result is only valid for the 'verify-invocation' action\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const taskKind = argValue(argv, "--task") ?? null;
  const requiredRole = argValue(argv, "--required-role") ?? null;
  const maxSizeClass = argValue(argv, "--max-size") ?? null;
  const localOnly = !argv.includes("--no-local-only");
  const allowUnknown = argv.includes("--allow-unknown");
  const pretty = argv.includes("--pretty");
  const useStdinRegistry = argv.includes("--registry-stdin");
  const useLocalRegistry = argv.includes("--use-local-registry");
  const explicitRegistryFile = argValue(argv, "--registry-file") ?? null;

  // Mutual exclusion: only one registry input mode at a time.
  const registryInputCount =
    (useStdinRegistry ? 1 : 0) +
    (useLocalRegistry ? 1 : 0) +
    (explicitRegistryFile ? 1 : 0);
  if (registryInputCount > 1) {
    process.stderr.write(
      "dema model-broker route: --registry-stdin, --registry-file, and --use-local-registry are mutually exclusive (pass at most one)\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (!taskKind && !requiredRole) {
    process.stderr.write(
      "dema model-broker route: --task <kind> or --required-role <role> is required\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  // 1 MB cap on registry file size (matches packages/receipts/src/receipt-store.js).
  const MAX_REGISTRY_FILE_BYTES = 1024 * 1024;

  let registry = DEFAULT_SAMPLE_REGISTRY;
  if (useStdinRegistry) {
    let raw = "";
    try {
      for await (const chunk of process.stdin) raw += chunk;
    } catch (err) {
      process.stderr.write(
        `dema model-broker route: stdin read failed: ${err?.message ?? err}\n`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    try {
      const parsed = JSON.parse(raw);
      registry = buildRegistryFromConfig(parsed);
    } catch (err) {
      process.stderr.write(
        `dema model-broker route: malformed --registry-stdin JSON: ${err?.message ?? err}\n`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
  } else if (useLocalRegistry || explicitRegistryFile) {
    // Resolve target path.
    const { join: pathJoin, isAbsolute: pathIsAbsolute } =
      await import("node:path");
    const { homedir } = await import("node:os");
    const { open } = await import("node:fs/promises");

    let targetPath;
    if (explicitRegistryFile) {
      if (!pathIsAbsolute(explicitRegistryFile)) {
        process.stderr.write(
          `dema model-broker route: --registry-file path must be absolute (got: ${explicitRegistryFile}). Use --use-local-registry for default DEMA_HOME location.\n`,
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      targetPath = explicitRegistryFile;
    } else {
      // --use-local-registry: $DEMA_HOME/models/registry.json (env override
      // honored; falls back to ~/.dema per repo convention).
      const home = process.env.DEMA_HOME || pathJoin(homedir(), ".dema");
      targetPath = pathJoin(home, "models", "registry.json");
    }

    const registryConsent = argValue(argv, "--registry-consent") ?? null;
    if (registryConsent !== MODEL_REGISTRY_LOAD_CONSENT) {
      process.stderr.write(
        `dema model-broker route: loading an operator roster requires --registry-consent "${MODEL_REGISTRY_LOAD_CONSENT}"\n`,
      );
      process.stderr.write(
        "  roster path (default): $DEMA_HOME/models/registry.json\n",
      );
      process.stderr.write(
        "  schema: { entries: [{ id, provider, model_name, role, size_class, locality, allowed_tasks, max_concurrency, context_limit, status }] }\n",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    // Read-only load through a single file handle with bounded read.
    // The handle approach closes the TOCTOU race that a stat()+readFile()
    // pattern leaves open: between stat() and readFile() an attacker
    // could swap the file with a larger one and bypass the size cap. By
    // reading at most MAX+1 bytes from a single open handle, we never
    // allocate more than MAX+1 even if the file grows under us, and we
    // never trust a separate stat() call.
    let fh = null;
    try {
      fh = await open(targetPath, "r");
      const buffer = Buffer.alloc(MAX_REGISTRY_FILE_BYTES + 1);
      const { bytesRead } = await fh.read(
        buffer,
        0,
        MAX_REGISTRY_FILE_BYTES + 1,
        0,
      );
      if (bytesRead > MAX_REGISTRY_FILE_BYTES) {
        process.stderr.write(
          `dema model-broker route: registry file too large: exceeds ${MAX_REGISTRY_FILE_BYTES} bytes\n`,
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      const raw = buffer.subarray(0, bytesRead).toString("utf8");
      const parsed = JSON.parse(raw);
      registry = buildRegistryFromConfig(parsed);
    } catch (err) {
      if (err?.code === "ENOENT") {
        process.stderr.write(
          `dema model-broker route: registry file not found: ${targetPath}\n`,
        );
      } else if (err instanceof SyntaxError) {
        process.stderr.write(
          `dema model-broker route: malformed registry file JSON at ${targetPath}: ${err.message}\n`,
        );
      } else {
        process.stderr.write(
          `dema model-broker route: registry file load failed at ${targetPath}: ${err?.message ?? err}\n`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    } finally {
      if (fh) {
        try {
          await fh.close();
        } catch {
          /* best-effort close */
        }
      }
    }
  }

  const broker = buildModelBrokerPreview({ registry });
  const routeOpts = {
    local_only: localOnly,
    allow_unknown: allowUnknown,
  };
  if (taskKind) routeOpts.task_kind = taskKind;
  if (requiredRole) routeOpts.required_role = requiredRole;
  if (maxSizeClass) routeOpts.max_size_class = maxSizeClass;

  const receipt = routeForTask(broker, routeOpts);

  const saveReceiptFlag = argv.includes("--save-receipt");
  const invokeFlag = argv.includes("--invoke");
  const saveInvocationResultFlag = argv.includes("--save-invocation-result");

  // Early validation: --save-invocation-result requires --invoke (no
  // envelope exists to save without invocation).
  if (saveInvocationResultFlag && !invokeFlag) {
    process.stderr.write(
      "dema model-broker route: --save-invocation-result requires --invoke (no envelope to save without invocation)\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  // v0.1 (this slice): --invoke runs the routed local-LLM invocation.
  // Hard ordering: route → save route receipt → invoke selected model.
  // --invoke REQUIRES --save-receipt + --prompt + --invoke-consent.
  if (invokeFlag) {
    if (!saveReceiptFlag) {
      process.stderr.write(
        "dema model-broker route: --invoke requires --save-receipt for route durability before invocation.\n",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const prompt = argValue(argv, "--prompt") ?? "";
    if (typeof prompt !== "string" || prompt.length === 0) {
      process.stderr.write(
        'dema model-broker route: --invoke requires --prompt "<text>"\n',
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const invokeConsent = argValue(argv, "--invoke-consent") ?? "";
    if (typeof invokeConsent !== "string" || invokeConsent.length === 0) {
      process.stderr.write(
        'dema model-broker route: --invoke requires --invoke-consent "GO: invoke local LLM at <selected_model_id>"\n',
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    // Step 1: save first (route durability before invocation).
    const consent = argValue(argv, "--consent") ?? "";
    const saveResult = await saveRouteReceipt(receipt, {
      demaHome: process.env.DEMA_HOME,
      consent,
      pretty,
    });
    if (!saveResult.saved) {
      if (saveResult.reason === "consent_missing") {
        process.stderr.write(
          `dema model-broker route: --save-receipt requires --consent "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
        );
      } else if (saveResult.reason === "consent_mismatch") {
        process.stderr.write(
          `dema model-broker route: --save-receipt consent phrase mismatch; required: "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
        );
      } else {
        process.stderr.write(
          `dema model-broker route: --save-receipt failed (${saveResult.reason}): ${saveResult.error_message ?? "unknown"}\n`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    process.stderr.write(`saved receipt to: ${saveResult.path}\n`);

    // Step 2: invoke routed local model via the bridge → adapter.
    const timeoutMsArg = argValue(argv, "--timeout-ms");
    const timeoutMs =
      timeoutMsArg !== undefined
        ? Number.parseInt(timeoutMsArg, 10)
        : undefined;
    const envelope = await invokeRoutedLocalModel({
      routeReceipt: receipt,
      prompt,
      invokeConsent,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    });

    // Serialize ONCE so stdout and any saved file match byte-for-byte
    // (architect-locked invariant; mirrors PR #83 route-receipt-save).
    const envelopeContent = serializeInvocationResultForSave(envelope, {
      pretty,
    });

    // Step 3 (optional): persist envelope to disk under explicit consent.
    // v0.1 invocation result SAVE (mirrors v0.2 route receipt SAVE from
    // PR #83). Preview-grade save (NOT canonical chain-bound mint).
    // Saves BOTH success and failure envelopes for audit.
    if (saveInvocationResultFlag) {
      const saveInvocationConsent =
        argValue(argv, "--save-invocation-consent") ?? "";
      const saveInvResult = await saveInvocationResult(envelope, {
        demaHome: process.env.DEMA_HOME,
        consent: saveInvocationConsent,
        pretty,
      });
      if (!saveInvResult.saved) {
        if (saveInvResult.reason === "consent_missing") {
          process.stderr.write(
            `dema model-broker route: --save-invocation-result requires --save-invocation-consent "${INVOCATION_RESULT_SAVE_CONSENT}"\n`,
          );
        } else if (saveInvResult.reason === "consent_mismatch") {
          process.stderr.write(
            `dema model-broker route: --save-invocation-result consent phrase mismatch; required: "${INVOCATION_RESULT_SAVE_CONSENT}"\n`,
          );
        } else {
          process.stderr.write(
            `dema model-broker route: --save-invocation-result failed (${saveInvResult.reason}): ${saveInvResult.error_message ?? "unknown"}\n`,
          );
        }
        // Still emit the envelope to stdout so the operator can see the
        // result they were trying to save.
        process.stdout.write(envelopeContent);
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      process.stderr.write(
        `saved invocation result to: ${saveInvResult.path}\n`,
      );
    }

    // Step 4: stdout emits the envelope (replaces the bare route receipt).
    process.stdout.write(envelopeContent);

    // Non-zero exit on adapter-reported failure so operators can chain
    // routed invocation into scripts that fail-fast on missing/refused
    // models.
    if (
      envelope.invocation_result === null ||
      envelope.invocation_result.invocation_status === "failed"
    ) {
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }

  // Non-invoke path: stdout = route receipt; optionally save.
  const content = serializeRouteReceiptForSave(receipt, { pretty });
  process.stdout.write(content);

  // v0.2: --save-receipt persists the route receipt to
  // $DEMA_HOME/receipts/route-<sha256>.json under exact-string consent.
  // Preview-grade SAVE (not canonical chain-bound MINT per ADR-008 §C12).
  if (saveReceiptFlag) {
    const consent = argValue(argv, "--consent") ?? "";
    const result = await saveRouteReceipt(receipt, {
      demaHome: process.env.DEMA_HOME,
      consent,
      pretty,
    });
    if (!result.saved) {
      if (result.reason === "consent_missing") {
        process.stderr.write(
          `dema model-broker route: --save-receipt requires --consent "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
        );
      } else if (result.reason === "consent_mismatch") {
        process.stderr.write(
          `dema model-broker route: --save-receipt consent phrase mismatch; required: "${ROUTE_RECEIPT_SAVE_CONSENT}"\n`,
        );
      } else {
        process.stderr.write(
          `dema model-broker route: --save-receipt failed (${result.reason}): ${result.error_message ?? "unknown"}\n`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    process.stderr.write(`saved receipt to: ${result.path}\n`);
  }
  process.exit(process.exitCode ?? 0);
}
