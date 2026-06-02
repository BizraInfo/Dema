import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
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
      schema: "bizra.dema.profile.v0.1",
      preferred_name: null,
      memory_consent: "local",
      hidden_autonomy: false,
      created_at: new Date().toISOString(),
    }),
  );

  const configPath = join(root, "config.local.json");
  entries.push(
    await writeJsonIfMissing(configPath, {
      schema: "bizra.dema.local_config.v0.1",
      mode: "local",
      noHiddenDaemon: true,
      requireExplicitConsent: true,
      nextArtifact: "ARTIFACT-011",
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
const EXPECTED_FILES = ["profile.json", "config.local.json"];

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

  const present = await exists(root);
  if (!present) {
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
      would_remove: root,
      dry_run: true,
    };
  }

  await rm(root, { recursive: true, force: true });

  return {
    schema: "bizra.dema.setup_remove.v0.1",
    root,
    removed: true,
    reason: "consent_verified",
    dry_run: false,
  };
}

export { REMOVE_CONSENT_PHRASE, EXPECTED_DIRS, EXPECTED_FILES };
