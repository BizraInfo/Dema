import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HOOK_DIR, "..", "..");
export const LOG_DIR = join(HOOK_DIR, "logs");

export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function ensureLogDir() {
  mkdirSync(LOG_DIR, { recursive: true });
}

export function appendJsonl(filename, record) {
  ensureLogDir();
  const line = `${JSON.stringify({ ...record, logged_at: new Date().toISOString() })}\n`;
  appendFileSync(join(LOG_DIR, filename), line, "utf8");
}

export function reportOnlyOutput({ hookEventName, message, systemMessage }) {
  const payload = { continue: true };
  if (message) {
    payload.hookSpecificOutput = {
      hookEventName,
      additionalContext: message,
    };
  }
  if (systemMessage) {
    payload.systemMessage = systemMessage;
  }
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}
