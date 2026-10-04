#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  FIXED_SURFACE_COUNT,
  scanPublicLinkInventory,
} from "./public-link-scan-core.mjs";

export * from "./public-link-scan-core.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(dirname(SCRIPT_DIR));
const DEFAULT_INVENTORY_PATH = resolve(
  REPO_ROOT,
  "docs/audits/evidence/bizra-ai-public-claim-postdeploy-2026-07-24.json",
);

function normalizeOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("invalid_inventory_origin");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("invalid_inventory_origin_protocol");
  }
  if (parsed.username || parsed.password) {
    throw new Error("credentialed_inventory_origin");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("inventory_origin_must_be_origin_only");
  }
  return parsed.origin;
}

function requiredString(value, code) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(code);
  }
  return value;
}

export function normalizeFixedInventory(
  capture,
  { expectedSurfaceCount = FIXED_SURFACE_COUNT } = {},
) {
  if (!capture || typeof capture !== "object" || Array.isArray(capture)) {
    throw new Error("invalid_inventory_capture");
  }
  if (
    !Number.isInteger(expectedSurfaceCount) ||
    expectedSurfaceCount < 1
  ) {
    throw new Error("invalid_expected_surface_count");
  }
  if (
    !Array.isArray(capture.surfaces) ||
    capture.surfaces.length !== expectedSurfaceCount
  ) {
    throw new Error(
      `fixed_inventory_count_mismatch:${capture.surfaces?.length ?? "missing"}:${expectedSurfaceCount}`,
    );
  }

  const origin = normalizeOrigin(capture.baseUrl);
  const declaredSiteCommit = requiredString(
    capture.declaredSourceReviewCommit,
    "missing_declared_site_commit",
  ).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(declaredSiteCommit)) {
    throw new Error("invalid_declared_site_commit");
  }

  const ids = new Set();
  const paths = new Set();
  const routes = capture.surfaces.map((surface) => {
    if (!surface || typeof surface !== "object" || Array.isArray(surface)) {
      throw new Error("invalid_inventory_surface");
    }
    if (surface.requestMethod !== "GET") {
      throw new Error("non_get_inventory_route");
    }
    const id = requiredString(surface.id, "missing_inventory_id");
    if (ids.has(id)) throw new Error("duplicate_inventory_id");
    ids.add(id);

    const requestPath = requiredString(
      surface.requestPath,
      "missing_inventory_path",
    );
    let requestUrl;
    try {
      requestUrl = new URL(requestPath, `${origin}/`);
    } catch {
      throw new Error("invalid_inventory_path");
    }
    if (requestUrl.origin !== origin) {
      throw new Error("cross_origin_inventory_path");
    }
    if (
      !requestPath.startsWith("/") ||
      requestPath.startsWith("//") ||
      requestUrl.search ||
      requestUrl.hash
    ) {
      throw new Error("invalid_inventory_path");
    }
    if (paths.has(requestPath)) {
      throw new Error("duplicate_inventory_path");
    }
    paths.add(requestPath);

    return {
      id,
      kind: requiredString(surface.kind, "missing_inventory_kind"),
      requestPath,
      sourcePath: requiredString(
        surface.sourcePath,
        "missing_inventory_source_path",
      ),
      inventoryDisposition: requiredString(
        surface.inventoryDisposition,
        "missing_inventory_disposition",
      ),
    };
  });

  return { origin, declaredSiteCommit, routes };
}

function parseArguments(argv) {
  if (argv.length === 0) {
    return { inventoryPath: DEFAULT_INVENTORY_PATH };
  }
  if (argv.length === 2 && argv[0] === "--inventory") {
    return { inventoryPath: resolve(argv[1]) };
  }
  throw new Error(
    "Usage: node scripts/audit/public-link-scan.mjs [--inventory <capture.json>]",
  );
}

export async function runPublicLinkScan({
  inventoryPath = DEFAULT_INVENTORY_PATH,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const capture = JSON.parse(await readFile(inventoryPath, "utf8"));
  const inventory = normalizeFixedInventory(capture);
  return scanPublicLinkInventory({ ...inventory, fetchImpl, now });
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report = await runPublicLinkScan(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.request_error_count > 0) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(
      `public-link-scan: ${error instanceof Error ? error.message : "failed"}\n`,
    );
    process.exitCode = 1;
  }
}

const invokedAsScript =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) await main();
