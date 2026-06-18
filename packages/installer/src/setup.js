import {
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
  lstat,
  realpath,
  open,
} from "node:fs/promises";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, parse, relative, resolve, join } from "node:path";
import { arch, homedir, platform } from "node:os";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(path) {
  const alreadyExists = await exists(path);
  await mkdir(path, { recursive: true });
  return { path, status: alreadyExists ? "existing" : "created" };
}

const PROFILE_SCHEMA = "bizra.dema.profile.v0.1";
const CONFIG_SCHEMA = "bizra.dema.local_config.v0.1";
const ROOT_MARKER_SCHEMA = "bizra.dema.root_marker.v0.1";

async function writeJsonIfMissing(path, value) {
  // Atomic exclusive create: flag "wx" (O_CREAT|O_EXCL) fails closed if the
  // path already exists — including as a symlink — eliminating the
  // exists()-then-writeFile TOCTOU window and the symlink write-through it
  // allowed (a symlinked target outside the dema root was followed and
  // clobbered). EEXIST is the expected "already present" signal.
  try {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return { path, status: "created" };
  } catch (err) {
    if (err.code === "EEXIST") return { path, status: "existing" };
    throw err;
  }
}

async function sha256File(path) {
  try {
    const data = await readFile(path);
    return createHash("sha256").update(data).digest("hex");
  } catch {
    return null;
  }
}

async function checkPath(path, kind) {
  const present = await exists(path);
  const entry = { path, kind, present, hash: null };
  if (present && kind === "file") {
    entry.hash = await sha256File(path);
  }
  return entry;
}

export async function runSetup(
  root = process.env.DEMA_HOME || join(homedir(), ".dema"),
) {
  const entries = [];
  entries.push(await ensureDir(root));
  entries.push(await ensureDir(join(root, "receipts")));
  entries.push(await ensureDir(join(root, "memory")));
  entries.push(await ensureDir(join(root, "logs")));
  entries.push(await ensureDir(join(root, "skills")));

  const profilePath = join(root, "profile.json");
  entries.push(
    await writeJsonIfMissing(profilePath, {
      schema: PROFILE_SCHEMA,
      preferred_name: null,
      memory_consent: "local",
      hidden_autonomy: false,
      created_at: new Date().toISOString(),
    }),
  );

  const configPath = join(root, "config.local.json");
  entries.push(
    await writeJsonIfMissing(configPath, {
      schema: CONFIG_SCHEMA,
      mode: "local",
      noHiddenDaemon: true,
      requireExplicitConsent: true,
      nextArtifact: "ARTIFACT-011",
    }),
  );

  const rootMarkerPath = join(root, ".dema-root.json");
  const markerOwnedPaths = entries
    .filter((entry) => entry.status === "created" && entry.path !== root)
    .map((entry) => resolve(entry.path));
  entries.push(
    await writeJsonIfMissing(rootMarkerPath, {
      schema: ROOT_MARKER_SCHEMA,
      root_id: randomUUID(),
      root: resolve(root),
      owned_paths: [...markerOwnedPaths, resolve(rootMarkerPath)],
      created_at: new Date().toISOString(),
    }),
  );

  const createdPaths = entries
    .filter((entry) => entry.status === "created")
    .map((entry) => entry.path);
  const existingPaths = entries
    .filter((entry) => entry.status === "existing")
    .map((entry) => entry.path);

  return {
    schema: "bizra.dema.setup.v0.1",
    root,
    os: { platform: platform(), arch: arch() },
    created: createdPaths.length > 0,
    paths: {
      home: root,
      profile: profilePath,
      config: configPath,
      root_marker: rootMarkerPath,
      receipts: join(root, "receipts"),
      memory: join(root, "memory"),
      logs: join(root, "logs"),
      skills: join(root, "skills"),
    },
    createdPaths,
    existingPaths,
    untouched: [
      "daemon state",
      "mission runtime",
      "runtime pulse",
      "receipt history",
      "external provider settings",
    ],
    boundaries: {
      noHiddenDaemon: true,
      missionExecuted: false,
      artifact011Issued: false,
      localFirst: true,
    },
    next: [
      "Run `dema status`.",
      "Run `dema doctor`.",
      "Preview with `dema mission propose`.",
    ],
  };
}

const EXPECTED_DIRS = ["receipts", "memory", "logs", "skills"];
const EXPECTED_FILES = ["profile.json", "config.local.json", ".dema-root.json"];

function demaOwnedPaths(root) {
  return [
    ...EXPECTED_FILES.map((file) => join(root, file)),
    ...EXPECTED_DIRS.map((dir) => join(root, dir)),
  ];
}

function removableMarkerPaths(root, marker) {
  if (!Array.isArray(marker.owned_paths)) return null;
  const allowed = new Set(demaOwnedPaths(root).map((path) => resolve(path)));
  const removable = [];
  for (const path of marker.owned_paths) {
    if (typeof path !== "string" || !isAbsolute(path)) return null;
    const resolved = resolve(path);
    if (!allowed.has(resolved)) return null;
    removable.push(resolved);
  }
  return removable.length > 0 ? removable : null;
}

export async function checkSetup(
  root = process.env.DEMA_HOME || join(homedir(), ".dema"),
) {
  const checks = [];

  checks.push(await checkPath(root, "dir"));
  for (const dir of EXPECTED_DIRS) {
    checks.push(await checkPath(join(root, dir), "dir"));
  }
  for (const file of EXPECTED_FILES) {
    checks.push(await checkPath(join(root, file), "file"));
  }

  const allPresent = checks.every((c) => c.present);
  const fileChecks = checks.filter((c) => c.kind === "file");
  const allHashed = fileChecks.every((c) => c.hash !== null);

  return {
    schema: "bizra.dema.setup_check.v0.1",
    root,
    verdict: allPresent ? "INTACT" : "INCOMPLETE",
    integrity: allPresent && allHashed ? "VERIFIED" : "DEGRADED",
    checks,
    missing: checks.filter((c) => !c.present).map((c) => c.path),
    file_hashes: Object.fromEntries(
      fileChecks.filter((c) => c.hash).map((c) => [c.path, c.hash]),
    ),
  };
}

const REMOVE_CONSENT_PHRASE = "REMOVE DEMA LOCAL DATA";

function isSameOrInside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function isDirectoryEntry(path) {
  try {
    return (await lstat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readRegularJson(path) {
  let handle;
  try {
    handle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    if (!(await handle.stat()).isFile()) return null;
    return JSON.parse(await handle.readFile("utf8"));
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function hasDemaSetupLayout(root) {
  const allDirsPresent = (
    await Promise.all(
      EXPECTED_DIRS.map((dir) => isDirectoryEntry(join(root, dir))),
    )
  ).every(Boolean);
  if (!allDirsPresent) return false;

  const profile = await readRegularJson(join(root, "profile.json"));
  const config = await readRegularJson(join(root, "config.local.json"));
  const marker = await readRegularJson(join(root, ".dema-root.json"));
  const markerIsValid =
    profile?.schema === PROFILE_SCHEMA &&
    config?.schema === CONFIG_SCHEMA &&
    marker?.schema === ROOT_MARKER_SCHEMA &&
    typeof marker.root_id === "string" &&
    marker.root_id.length > 0 &&
    typeof marker.root === "string" &&
    resolve(marker.root) === root;
  if (!markerIsValid) return null;

  const removablePaths = removableMarkerPaths(root, marker);
  return removablePaths ? { removablePaths } : null;
}

async function validateRemoveRoot(root) {
  if (typeof root !== "string" || root.trim() === "") {
    return { ok: false };
  }

  const lexicalRoot = resolve(root);
  if (
    lexicalRoot === parse(lexicalRoot).root ||
    lexicalRoot === resolve(homedir()) ||
    isSameOrInside(resolve(process.cwd()), lexicalRoot)
  ) {
    return { ok: false };
  }

  let entry;
  try {
    entry = await lstat(root);
  } catch (err) {
    if (err.code === "ENOENT") {
      return { ok: true, root: lexicalRoot, present: false };
    }
    throw err;
  }

  if (entry.isSymbolicLink()) {
    return { ok: false };
  }

  const physicalRoot = await realpath(root);
  if (
    physicalRoot !== lexicalRoot ||
    physicalRoot === parse(physicalRoot).root ||
    physicalRoot === resolve(homedir()) ||
    isSameOrInside(resolve(process.cwd()), physicalRoot)
  ) {
    return { ok: false };
  }

  const layout = await hasDemaSetupLayout(physicalRoot);
  if (!layout) {
    return { ok: false };
  }

  return {
    ok: true,
    root: lexicalRoot,
    present: true,
    removablePaths: layout.removablePaths,
  };
}

export async function removeSetup(
  root = process.env.DEMA_HOME || join(homedir(), ".dema"),
  { consent = "", dryRun = false } = {},
) {
  if (consent !== REMOVE_CONSENT_PHRASE) {
    return {
      schema: "bizra.dema.setup_remove.v0.1",
      root,
      removed: false,
      reason: "consent_phrase_mismatch",
      required_phrase: REMOVE_CONSENT_PHRASE,
      dry_run: dryRun,
    };
  }

  const validation = await validateRemoveRoot(root);
  if (!validation.ok) {
    return {
      schema: "bizra.dema.setup_remove.v0.1",
      root,
      removed: false,
      reason: "unsafe_remove_root",
      dry_run: dryRun,
    };
  }

  if (!validation.present) {
    return {
      schema: "bizra.dema.setup_remove.v0.1",
      root,
      removed: false,
      reason: "not_found",
      dry_run: dryRun,
    };
  }

  if (dryRun) {
    return {
      schema: "bizra.dema.setup_remove.v0.1",
      root,
      removed: false,
      reason: "dry_run",
      would_remove: validation.removablePaths,
      dry_run: true,
    };
  }

  for (const path of validation.removablePaths) {
    await rm(path, { recursive: true, force: true });
  }

  return {
    schema: "bizra.dema.setup_remove.v0.1",
    root,
    removed: true,
    reason: "consent_verified",
    removed_paths: validation.removablePaths,
    dry_run: false,
  };
}

export { REMOVE_CONSENT_PHRASE, EXPECTED_DIRS, EXPECTED_FILES };
