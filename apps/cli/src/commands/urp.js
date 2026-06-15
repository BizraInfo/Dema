import { buildUrpLocalIndex } from "../../../../packages/urp/src/local-index.js";
import { saveUrpLocalIndex } from "../../../../packages/urp/src/local-index-writer.js";
import { listUrpLocalIndexes } from "../../../../packages/urp/src/local-index-list.js";
import { verifyUrpLocalIndexFile } from "../../../../packages/urp/src/local-index-verify.js";
import {
  buildChooseDecision,
  DECISION_MARK_SHAREABLE,
  DECISION_MARK_LOCAL_ONLY,
} from "../../../../packages/urp/src/choose-decision.js";
import { saveChooseDecision } from "../../../../packages/urp/src/choose-writer.js";
import { listChooseDecisions } from "../../../../packages/urp/src/choose-list.js";
import { verifyChooseReceiptFile } from "../../../../packages/urp/src/choose-verify.js";
import {
  buildNode05SatUrpLaunch,
  buildNode15SatPreview,
} from "../../../../packages/urp/src/five-sat-urp-launch.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_urp(ctx) {
  const { argv } = ctx;
  const urpSub = argv[1] ?? "";
  const wantJsonU = wantsJson(argv);

  if (urpSub === "index") {
    const passportPath = argValue(argv, "--passport");
    const receiptsDir = argValue(argv, "--receipts-dir");

    if (!passportPath) {
      console.error(
        "Usage: dema urp index --passport <passport.json> [--receipts-dir <dir>] [--json]",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const { readFile } = await import("node:fs/promises");
    let passport;
    try {
      const raw = await readFile(passportPath, "utf8");
      try {
        passport = JSON.parse(raw);
      } catch {
        const err = {
          schema: "bizra.dema.urp_local_index_cli_result.v0.1",
          indexed: false,
          written: false,
          error: "invalid_passport_json",
          passport_path: passportPath,
        };
        console.log(
          wantJsonU
            ? JSON.stringify(err, null, 2)
            : `FAILED: invalid JSON in ${passportPath}`,
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
    } catch {
      const err = {
        schema: "bizra.dema.urp_local_index_cli_result.v0.1",
        indexed: false,
        written: false,
        error: "cannot_read_passport",
        passport_path: passportPath,
      };
      console.log(
        wantJsonU
          ? JSON.stringify(err, null, 2)
          : `FAILED: cannot read ${passportPath}`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const { join: joinPath } = await import("node:path");
    const { homedir: getHome } = await import("node:os");
    const envHome = process.env.DEMA_HOME;
    const resolvedReceiptsDir =
      receiptsDir ??
      joinPath(envHome ?? joinPath(getHome(), ".dema"), "receipts");
    const buildResult = await buildUrpLocalIndex(passport, {
      receiptsDir: resolvedReceiptsDir,
    });
    if (!buildResult.indexed) {
      const out = {
        schema: "bizra.dema.urp_local_index_cli_result.v0.1",
        indexed: false,
        written: false,
        error: buildResult.error,
        verification: buildResult.verification,
      };
      if (wantJsonU) {
        console.log(JSON.stringify(out, null, 2));
      } else {
        console.log(
          `FAILED: ${buildResult.error} · LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const writeResult = await saveUrpLocalIndex(buildResult);
    const out = {
      schema: "bizra.dema.urp_local_index_cli_result.v0.1",
      indexed: true,
      written: writeResult.written,
      truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX",
      mode: "LOCAL_INDEX_ONLY",
      share_status: "MARKED_LOCAL_ONLY",
      write_result: writeResult,
    };
    if (wantJsonU) {
      console.log(JSON.stringify(out, null, 2));
    } else if (writeResult.written) {
      console.log(
        [
          `URP Local Index: WRITTEN`,
          `  Index hash: ${writeResult.index_hash}`,
          `  Index path: ${writeResult.index_path}`,
          `  Mode:       LOCAL_INDEX_ONLY`,
          `  Share:      MARKED_LOCAL_ONLY`,
          `  Truth:      LOCAL_VERIFIED_RESOURCE_INDEX`,
        ].join("\n"),
      );
    } else {
      console.log(
        `FAILED: writer rejected · ${writeResult.error} · LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`,
      );
    }
    if (!writeResult.written) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (urpSub === "list") {
    const result = await listUrpLocalIndexes();
    if (wantJsonU) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.count === 0) {
      console.log(
        [
          "URP Local Indexes: (none)",
          `  Dir: ${result.indexes_dir}`,
          `  LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`,
        ].join("\n"),
      );
    } else {
      const lines = [
        `URP Local Indexes: ${result.count}`,
        `  Dir: ${result.indexes_dir}`,
      ];
      for (const e of result.entries) {
        if (e.error) {
          lines.push(
            `  ! ${e.filename}: ${e.error}${e.message ? " · " + e.message : ""}`,
          );
        } else {
          const integ =
            e.filename_hash_matches && e.body_hash_intact ? "OK" : "CORRUPT";
          lines.push(
            `  - ${e.filename}  receipts=${e.receipts_count ?? "?"}  ${e.truth_label ?? ""}  [${integ}]`,
          );
        }
      }
      lines.push(`  LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`);
      console.log(lines.join("\n"));
    }
    if (result.corruption_detected) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (urpSub === "verify") {
    const positional = argv.slice(2).filter((a) => !a.startsWith("--"));
    const indexPath = positional[0];

    if (!indexPath) {
      console.error("Usage: dema urp verify <index.json> [--json]");
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const result = await verifyUrpLocalIndexFile(indexPath);
    if (wantJsonU) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const lines = [
        `URP Local Index Verify: ${result.verdict}`,
        `  File: ${indexPath}`,
      ];
      if (result.verified) {
        lines.push(`  Index hash: ${result.index_hash}`);
        lines.push(
          `  Filename↔hash: ${result.filename_hash_matches === null ? "n/a (non-canonical filename)" : result.filename_hash_matches ? "OK" : "MISMATCH"}`,
        );
        lines.push(`  Receipts:    ${result.receipts_count ?? "?"}`);
        lines.push(`  Truth:       ${result.truth_label}`);
      } else {
        lines.push(`  Error:       ${result.error}`);
        if (result.declared && result.recomputed) {
          lines.push(`  Declared:    ${result.declared}`);
          lines.push(`  Recomputed:  ${result.recomputed}`);
        }
        if (result.field) {
          lines.push(`  Forbidden field: ${result.field}`);
        }
        lines.push(`  Truth:       ${result.truth_label}`);
      }
      lines.push(`  LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY`);
      console.log(lines.join("\n"));
    }
    if (!result.verified) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (urpSub === "choose") {
    // Sub-action: `dema urp choose verify <choose.json> [--json]` (URP-4.1C-ter).
    if (argv[2] === "verify") {
      const positional = argv.slice(3).filter((a) => !a.startsWith("--"));
      const filePath = positional[0];
      if (!filePath) {
        console.error(
          "Usage: dema urp choose verify <choose-receipt.json> [--json]",
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      const result = await verifyChooseReceiptFile(filePath);
      if (wantJsonU) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const lines = [
          `URP Choose Verify: ${result.verdict}`,
          `  File: ${filePath}`,
        ];
        if (result.verified) {
          lines.push(`  Choose hash: ${result.choose_hash}`);
          lines.push(
            `  Filename↔hash: ${result.filename_hash_matches === null ? "n/a (non-canonical filename)" : result.filename_hash_matches ? "OK" : "MISMATCH"}`,
          );
          lines.push(`  Decision:    ${result.decision}`);
          lines.push(
            `  Transition:  ${result.previous_share_status} → ${result.next_share_status}`,
          );
          lines.push(`  Truth:       ${result.truth_label}`);
        } else {
          lines.push(`  Error:       ${result.error}`);
          if (result.declared && result.recomputed) {
            lines.push(`  Declared:    ${result.declared}`);
            lines.push(`  Recomputed:  ${result.recomputed}`);
          }
          if (result.field) {
            lines.push(`  Forbidden field: ${result.field}`);
          }
          if (result.received_schema) {
            lines.push(`  Received schema: ${result.received_schema}`);
          }
          lines.push(`  Truth:       ${result.truth_label}`);
        }
        lines.push(`  LOCAL ONLY · no network · no federation · no mint`);
        console.log(lines.join("\n"));
      }
      if (!result.verified) process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    // Sub-action: `dema urp choose list [--json]` (lists persisted choose receipts).
    if (argv[2] === "list") {
      const r = await listChooseDecisions();
      if (wantJsonU) {
        console.log(JSON.stringify(r, null, 2));
      } else if (r.count === 0) {
        console.log(
          [
            "URP Choose Receipts: (none)",
            `  Dir: ${r.choices_dir}`,
            `  LOCAL ONLY · no network · no federation · no mint`,
          ].join("\n"),
        );
      } else {
        const lines = [
          `URP Choose Receipts: ${r.count}`,
          `  Dir: ${r.choices_dir}`,
        ];
        for (const e of r.entries) {
          if (e.error) {
            lines.push(
              `  ! ${e.filename}: ${e.error}${e.message ? " · " + e.message : ""}`,
            );
          } else {
            const integ =
              e.filename_hash_matches && e.body_hash_intact ? "OK" : "CORRUPT";
            lines.push(
              `  - ${e.filename}  ${e.decision ?? "?"}  ${e.previous_share_status ?? "?"} -> ${e.next_share_status ?? "?"}  [${integ}]`,
            );
          }
        }
        lines.push(`  LOCAL ONLY · no network · no federation · no mint`);
        console.log(lines.join("\n"));
      }
      if (r.corruption_detected) process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const positional = argv.slice(2).filter((a) => !a.startsWith("--"));
    const indexPath = positional[0];
    const decision = argValue(argv, "--decision");
    const consent = argValue(argv, "--consent");

    if (!indexPath) {
      console.error(
        'Usage: dema urp choose <index.json> --decision MARK_SHAREABLE|MARK_LOCAL_ONLY --consent "<exact phrase>" [--json]',
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (!decision) {
      console.error(
        "dema urp choose: --decision is required (MARK_SHAREABLE or MARK_LOCAL_ONLY)",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (
      decision !== DECISION_MARK_SHAREABLE &&
      decision !== DECISION_MARK_LOCAL_ONLY
    ) {
      console.error(
        `dema urp choose: invalid --decision "${decision}"; must be MARK_SHAREABLE or MARK_LOCAL_ONLY`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const { readFile: rf } = await import("node:fs/promises");
    let index;
    try {
      const raw = await rf(indexPath, "utf8");
      try {
        index = JSON.parse(raw);
      } catch {
        const err = {
          schema: "bizra.dema.urp_choose_cli_result.v0.1",
          chosen: false,
          written: false,
          error: "invalid_index_json",
          index_path: indexPath,
        };
        console.log(
          wantJsonU
            ? JSON.stringify(err, null, 2)
            : `FAILED: invalid JSON in ${indexPath}`,
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
    } catch {
      const err = {
        schema: "bizra.dema.urp_choose_cli_result.v0.1",
        chosen: false,
        written: false,
        error: "cannot_read_index",
        index_path: indexPath,
      };
      console.log(
        wantJsonU
          ? JSON.stringify(err, null, 2)
          : `FAILED: cannot read ${indexPath}`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const kernelResult = buildChooseDecision(index, {
      decision,
      consent,
    });
    if (!kernelResult.chosen) {
      const out = {
        schema: "bizra.dema.urp_choose_cli_result.v0.1",
        chosen: false,
        written: false,
        error: kernelResult.error,
        expected_consent: kernelResult.expected_consent ?? null,
        from: kernelResult.from ?? null,
        decision,
      };
      if (wantJsonU) {
        console.log(JSON.stringify(out, null, 2));
      } else {
        console.error(
          `Choose REJECTED · ${kernelResult.error}` +
            (kernelResult.expected_consent
              ? ` · expected consent phrase: "${kernelResult.expected_consent}"`
              : ""),
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const writeResult = await saveChooseDecision(kernelResult);
    const out = {
      schema: "bizra.dema.urp_choose_cli_result.v0.1",
      chosen: true,
      written: writeResult.written,
      truth_label: writeResult.truth_label ?? null,
      decision: kernelResult.decision,
      previous_share_status: kernelResult.previous_share_status,
      next_share_status: kernelResult.next_share_status,
      source_index_hash: kernelResult.source_index_hash,
      choose_hash: kernelResult.choose_hash,
      receipt_path: writeResult.receipt_path ?? null,
      mode_octal: writeResult.mode_octal ?? null,
      already_existed: writeResult.already_existed ?? null,
      write_result: writeResult,
    };
    if (wantJsonU) {
      console.log(JSON.stringify(out, null, 2));
    } else if (writeResult.written) {
      console.log(
        [
          `Choose receipt persisted. No external share performed.`,
          `  Decision:     ${kernelResult.decision}`,
          `  From:         ${kernelResult.previous_share_status}`,
          `  To:           ${kernelResult.next_share_status}`,
          `  Source index: ${kernelResult.source_index_hash}`,
          `  Choose hash:  ${kernelResult.choose_hash}`,
          `  Receipt:      ${writeResult.receipt_path}`,
          `  Mode:         ${writeResult.mode_octal}`,
          `  Already existed: ${writeResult.already_existed ? "yes (idempotent)" : "no (new)"}`,
          `  Truth:        ${writeResult.truth_label}`,
          `  LOCAL ONLY · no network · no federation · no mint`,
        ].join("\n"),
      );
    } else {
      console.error(
        `Choose receipt NOT persisted · writer error: ${writeResult.error}`,
      );
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }

  // Sub-action: `dema urp launch-5sat` (URP-5SAT-1A Node0 5 SAT launch/lock).
  if (urpSub === "launch-5sat") {
    const consent = argValue(argv, "--consent");
    const exactConsent =
      "LAUNCH NODE0 URP WITH 5 SAT ONLY AND LOCK AGAINST PAT/DEMA/MOMO";
    if (!consent || consent !== exactConsent) {
      console.error(
        `dema urp launch-5sat: exact --consent "${exactConsent}" required`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const launch = buildNode05SatUrpLaunch();
    // Save as content-addressed receipt (atomic). Self-contained for micro.
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const { writeFile, rename, mkdir } = await import("node:fs/promises");
    const home = process.env.DEMA_HOME || join(homedir(), ".dema");
    const receiptsDir = join(home, "receipts");
    await mkdir(receiptsDir, { recursive: true });
    const receiptPath = join(
      receiptsDir,
      `node0-5sat-urp-launch-${launch.launch_hash}.json`,
    );
    const tmpPath = receiptPath + ".tmp";
    await writeFile(tmpPath, JSON.stringify(launch, null, 2));
    await rename(tmpPath, receiptPath);
    // Write active state for "always on active" (the system treats URP 5SAT as active and locked once launched).
    const activeDir = join(home, "urp");
    await mkdir(activeDir, { recursive: true });
    const activePath = join(activeDir, "5sat-active-locked.json");
    const activeTmp = activePath + ".tmp";
    const activeState = {
      schema: "bizra.dema.node0_5sat_urp_active.v0.1",
      active: true,
      locked: true,
      active_sat: launch.body.active_sat,
      manipulators_blocked: launch.body.manipulators_blocked,
      connection_rules: launch.body.connection_rules,
      launched_at: launch.body.launched_at_iso,
      truth_label: "NODE0_5SAT_URP_ACTIVE_AND_LOCKED",
    };
    await writeFile(activeTmp, JSON.stringify(activeState, null, 2));
    await rename(activeTmp, activePath);
    const result = {
      launched: true,
      launch_hash: launch.launch_hash,
      receipt_path: receiptPath,
      active_state_path: activePath,
      active_sat: launch.body.active_sat,
      locked: true,
      manipulators_blocked: launch.body.manipulators_blocked,
      truth_label: launch.body.truth_label,
    };
    const wantJsonLocal = argv.includes("--json");
    if (wantJsonLocal) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Node0 5 SAT URP launched and locked.");
      console.log(`  Active SAT: ${result.active_sat.join(" | ")}`);
      console.log(
        `  Locked against: ${result.manipulators_blocked.join(", ")}`,
      );
      console.log(`  Receipt: ${receiptPath}`);
      console.log(`  Active State: ${activePath}`);
      console.log(
        "  LOCAL ONLY · no federation · no mint · declared active state",
      );
      console.log(`  Truth: ${result.truth_label}`);
    }
    process.exit(process.exitCode ?? 0);
  }

  // Sub-action: `dema urp node1-5sat-preview` (preview "mint" for Node1 via universal pool).
  if (urpSub === "node1-5sat-preview") {
    const consent = argValue(argv, "--consent");
    const exact = "DECLARE NODE1 5 SAT VIA UNIVERSAL POOL";
    if (!consent || consent !== exact) {
      console.error(
        `dema urp node1-5sat-preview: exact --consent "${exact}" required`,
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const preview = buildNode15SatPreview();
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const { writeFile, rename, mkdir } = await import("node:fs/promises");
    const home = process.env.DEMA_HOME || join(homedir(), ".dema");
    const receiptsDir = join(home, "receipts");
    await mkdir(receiptsDir, { recursive: true });
    const receiptPath = join(
      receiptsDir,
      `node1-5sat-preview-${preview.preview_hash}.json`,
    );
    const tmpPath = receiptPath + ".tmp";
    await writeFile(tmpPath, JSON.stringify(preview, null, 2));
    await rename(tmpPath, receiptPath);
    const result = {
      preview: true,
      preview_hash: preview.preview_hash,
      receipt_path: receiptPath,
      new_5_sat: preview.body.new_5_sat,
      truth_label: preview.body.truth_label,
    };
    const wantJsonLocal = argv.includes("--json");
    if (wantJsonLocal) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Node1 5 SAT preview declared via universal pool.");
      console.log(`  New 5 SAT: ${result.new_5_sat.join(" | ")}`);
      console.log(`  Receipt: ${receiptPath}`);
      console.log("  PREVIEW ONLY · no mint in Dema");
      console.log(`  Truth: ${result.truth_label}`);
    }
    process.exit(process.exitCode ?? 0);
  }

  console.error(
    'Usage: dema urp index --passport <passport.json> [--receipts-dir <dir>] [--json]\n       dema urp list [--json]\n       dema urp verify <index.json> [--json]\n       dema urp choose <index.json> --decision MARK_SHAREABLE|MARK_LOCAL_ONLY --consent "<exact phrase>" [--json]',
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
