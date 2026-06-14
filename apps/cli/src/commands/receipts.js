import {
  listReceipts,
  readReceipt,
  formatReceiptList,
} from "../../../../packages/receipts/src/receipt-store.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

export async function cmd_receipts(ctx) {
  const { argv } = ctx;
  const selector = argv.slice(1).find((a) => !a.startsWith("-"));
  if (selector) {
    console.log(JSON.stringify(await readReceipt(selector), null, 2));
  } else {
    const allReceipts = await listReceipts();
    if (wantsJson(argv)) {
      console.log(JSON.stringify(allReceipts, null, 2));
    } else {
      console.log(formatReceiptList(allReceipts));
    }
  }
  process.exit(process.exitCode ?? 0);
}
