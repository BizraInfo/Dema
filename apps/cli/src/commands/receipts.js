import {
  listReceiptsPage,
  readReceipt,
  formatReceiptList,
} from "../../../../packages/receipts/src/receipt-store.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { readFile } from "node:fs/promises";
import { verifyTalkRuntimeReceipt } from "../../../../packages/core/src/talk-runtime-receipt.js";

const VERIFY_HELP = `Usage: dema receipt verify <path>
Read-only verification of a v0.1 talk-runtime receipt's fields and receipt_id.
Exit 0: valid content digest; 1: invalid receipt, read error or usage; 2: missing file.
Content integrity only: no signature, producer authentication or runtime attestation.
--help, -h: show this help without reading a receipt.`;

export async function cmd_receipt({ argv }) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(VERIFY_HELP);
    process.exitCode = 0;
    return;
  }
  const path = argv[2];
  if (argv[1] !== "verify" || typeof path !== "string" || path.startsWith("-") || argv.length !== 3) {
    console.error(`receipt: path: invalid_usage\n${VERIFY_HELP}`);
    process.exitCode = 1;
    return;
  }
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    const missing = err?.code === "ENOENT";
    console.error(`${path}: file: ${missing ? "missing_file" : "read_failed"}`);
    process.exitCode = missing ? 2 : 1;
    return;
  }
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch {
    console.error(`${path}: json: invalid_json`);
    process.exitCode = 1;
    return;
  }
  const result = verifyTalkRuntimeReceipt(receipt);
  if (!result.verified) {
    console.error(`${path}: ${result.field}: ${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${path}: receipt_id: valid; invocation_status=${result.invocation_status} (content integrity only)`);
  process.exitCode = 0;
}

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

export async function cmd_receipts(ctx) {
  const { argv } = ctx;
  const limitStr = argValue(argv, "--limit");
  const offsetStr = argValue(argv, "--offset");
  // Exclude flag VALUES so `dema receipts --limit 5` is not read as `read receipt "5"`.
  const flagValues = new Set([limitStr, offsetStr].filter((v) => v !== undefined));
  const selector = argv
    .slice(1)
    .find((a) => !a.startsWith("-") && !flagValues.has(a));

  if (selector) {
    console.log(JSON.stringify(await readReceipt(selector), null, 2));
    process.exit(process.exitCode ?? 0);
  }

  const options = {};
  if (limitStr !== undefined) options.limit = Number(limitStr);
  if (offsetStr !== undefined) options.offset = Number(offsetStr);
  const page = await listReceiptsPage(undefined, options);

  if (wantsJson(argv)) {
    // Back-compat: --json stays a bare items array. Programmatic callers needing
    // completeness use listReceiptsPage directly.
    console.log(JSON.stringify(page.items, null, 2));
  } else {
    console.log(formatReceiptList(page.items));
    if (page.truncated) {
      console.log(
        page.capped
          ? `\n⚠ Showing ${page.items.length} of ${page.total_scanned}+ receipt(s) — the scan stopped at max_files=${page.max_files}; more may exist. Use --offset to page.`
          : `\n⚠ Showing ${page.items.length} of ${page.total_scanned} receipt(s). Use --limit/--offset to page through the rest.`,
      );
    }
  }
  process.exit(process.exitCode ?? 0);
}
