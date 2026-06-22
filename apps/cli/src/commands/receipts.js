import {
  listReceiptsPage,
  readReceipt,
  formatReceiptList,
} from "../../../../packages/receipts/src/receipt-store.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

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
