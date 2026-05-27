import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { generateEd25519Keypair } from "./authorship-signature.js";

export const KEY_INIT_CONSENT_PHRASE = "GENERATE AUTHORSHIP KEY";
export const KEY_INIT_SCHEMA = "bizra.dema.authorship_key_init.v0.1";

const PRIVATE_KEY_FILENAME = "node0-ed25519.pem";
const PUBLIC_KEY_FILENAME = "node0-ed25519.pub.pem";

function keysDir(demaHome) {
  const home =
    typeof demaHome === "string" && demaHome.length > 0
      ? demaHome
      : process.env.DEMA_HOME || join(homedir(), ".dema");
  return join(home, "keys");
}

export function keyPaths(demaHome) {
  const dir = keysDir(demaHome);
  return {
    dir,
    privateKey: join(dir, PRIVATE_KEY_FILENAME),
    publicKey: join(dir, PUBLIC_KEY_FILENAME),
  };
}

async function keyExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function initAuthorshipKey({
  consent,
  demaHome,
  force = false,
} = {}) {
  if (consent !== KEY_INIT_CONSENT_PHRASE) {
    return Object.freeze({
      schema: KEY_INIT_SCHEMA,
      initialized: false,
      error: "consent_required",
      required_phrase: KEY_INIT_CONSENT_PHRASE,
      boundary: buildBoundary(false),
    });
  }

  const paths = keyPaths(demaHome);

  if (!force && (await keyExists(paths.privateKey))) {
    return Object.freeze({
      schema: KEY_INIT_SCHEMA,
      initialized: false,
      error: "key_already_exists",
      private_key_path: paths.privateKey,
      boundary: buildBoundary(false),
    });
  }

  const keys = generateEd25519Keypair();

  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.privateKey, keys.private_key_pem, {
    mode: 0o600,
    flag: "w",
  });
  await writeFile(paths.publicKey, keys.public_key_pem, {
    mode: 0o644,
    flag: "w",
  });

  return Object.freeze({
    schema: KEY_INIT_SCHEMA,
    initialized: true,
    public_key_fingerprint: keys.public_key_fingerprint,
    private_key_path: paths.privateKey,
    public_key_path: paths.publicKey,
    boundary: buildBoundary(true),
  });
}

export async function loadPrivateKey(demaHome) {
  const paths = keyPaths(demaHome);
  try {
    return await readFile(paths.privateKey, "utf8");
  } catch {
    return null;
  }
}

export async function loadPublicKey(demaHome) {
  const paths = keyPaths(demaHome);
  try {
    return await readFile(paths.publicKey, "utf8");
  } catch {
    return null;
  }
}

export async function hasAuthorshipKey(demaHome) {
  const paths = keyPaths(demaHome);
  return keyExists(paths.privateKey);
}

function buildBoundary(wrote) {
  return Object.freeze({
    key_persisted: wrote,
    network_used: false,
    federation_used: false,
    token_minted: false,
    receipt_signed: false,
  });
}
