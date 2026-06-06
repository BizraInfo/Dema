import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const WORKFLOW_DIR = ".github/workflows";

async function readText(root, path) {
  return await readFile(join(root, path), "utf8");
}

export function findActionRefs(workflowText) {
  return [...workflowText.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => {
    const ref = match[1];
    const at = ref.lastIndexOf("@");
    const version = at >= 0 ? ref.slice(at + 1) : "";
    return {
      ref,
      pinned: /^[0-9a-f]{40}$/i.test(version),
    };
  });
}

export function findNodeMatrix(workflowText) {
  const match = workflowText.match(/node-version:\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((entry) => `node-${entry.trim()}`)
    .filter(Boolean);
}

export function findRunCommands(workflowText) {
  const commands = [];
  const lines = String(workflowText ?? "").split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);
    if (!match) continue;

    const baseIndent = match[1].length;
    const value = match[2].trim();
    if (/^[|>][+-]?\d*$/.test(value)) {
      for (i += 1; i < lines.length; i += 1) {
        const blockLine = lines[i];
        const trimmed = blockLine.trim();
        if (!trimmed) continue;

        const indent = blockLine.match(/^\s*/)[0].length;
        if (indent <= baseIndent) {
          i -= 1;
          break;
        }
        if (!trimmed.startsWith("#")) commands.push(trimmed);
      }
      continue;
    }

    if (value) commands.push(value);
  }

  return commands;
}

export function findWorkflowEvents(workflowText) {
  return ["pull_request", "push", "schedule", "workflow_dispatch"].filter(
    (event) => new RegExp(`^\\s{0,4}${event}:`, "m").test(workflowText),
  );
}

export function parseWorkflowWorktreeChanges(
  statusText,
  workflowDir = WORKFLOW_DIR,
) {
  return String(statusText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .map((line) => {
      const rawStatus = line.slice(0, 2);
      const rawPath = line.slice(3).trim();
      const path = rawPath.includes(" -> ")
        ? rawPath.split(" -> ").at(-1)
        : rawPath;
      return {
        status: rawStatus.trim() || rawStatus,
        path,
      };
    })
    .filter(
      (change) =>
        change.path.startsWith(`${workflowDir}/`) &&
        /\.ya?ml$/i.test(change.path),
    );
}

export function readWorkflowWorktreeStatus(root, workflowStatusText) {
  if (typeof workflowStatusText === "string") {
    return {
      available: true,
      changes: parseWorkflowWorktreeChanges(workflowStatusText),
    };
  }

  try {
    const statusText = execFileSync(
      "git",
      ["-C", root, "status", "--short", "--", WORKFLOW_DIR],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return {
      available: true,
      changes: parseWorkflowWorktreeChanges(statusText),
    };
  } catch {
    return {
      available: false,
      changes: [],
    };
  }
}

export async function readWorkflowFiles(root) {
  const dir = join(root, WORKFLOW_DIR);
  if (!existsSync(dir)) return [];

  const names = (await readdir(dir))
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
  return await Promise.all(
    names.map(async (name) => {
      const path = `${WORKFLOW_DIR}/${name}`;
      const text = await readText(root, path);
      return { path, text };
    }),
  );
}
