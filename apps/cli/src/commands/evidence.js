import {
  buildEvidenceReceiptPreview,
  formatEvidenceReceiptPreview,
} from "../../../../packages/verifier/src/evidence-receipt-preview.js";

export async function cmd_evidence(ctx) {
  const { argv } = ctx;
  const receiptCommand = argv[1];
  const receiptSubcommand = argv[2];
  if (receiptCommand !== "receipt" || receiptSubcommand !== "preview") {
    throw new Error(
      "Unknown evidence command. Use `dema evidence receipt preview [--json]`.",
    );
  }
  const receipt = buildEvidenceReceiptPreview();
  console.log(
    argv.includes("--json")
      ? JSON.stringify(receipt, null, 2)
      : formatEvidenceReceiptPreview(receipt),
  );
  process.exit(process.exitCode ?? 0);
}
