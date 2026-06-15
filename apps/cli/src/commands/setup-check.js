import { checkSetup } from "../../../../packages/installer/src/setup.js";

export async function cmd_setup_check(ctx) {
  const result = await checkSetup();
  console.log(JSON.stringify(result, null, 2));
  if (result.verdict !== "INTACT") process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
