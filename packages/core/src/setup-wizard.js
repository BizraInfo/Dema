import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const VALID_LANGUAGES = ["ar", "en", "fr", "es", "ur", "hi", "other"];
const VALID_MEMORY_CHOICES = ["1", "2", "3"];
const DAUGHTER_TEST_PHRASE = "I acknowledge";
const EOF = Symbol("EOF");

async function defaultWriteProfile(profile) {
  const root = process.env.DEMA_HOME || join(homedir(), ".dema");
  const profilePath = join(root, "profile.json");
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  return profilePath;
}

function buildLineQueue(stdin) {
  const queue = [];
  const waiters = [];
  let closed = false;

  const rl = createInterface({ input: stdin, output: null, terminal: false });

  rl.on("line", (line) => {
    if (waiters.length > 0) {
      waiters.shift()(line);
    } else {
      queue.push(line);
    }
  });

  rl.once("close", () => {
    closed = true;
    while (waiters.length > 0) {
      waiters.shift()(EOF);
    }
  });

  rl.once("SIGINT", () => {
    closed = true;
    rl.close();
  });

  function nextLine() {
    return new Promise((resolve) => {
      if (queue.length > 0) {
        resolve(queue.shift());
        return;
      }
      if (closed) {
        resolve(EOF);
        return;
      }
      waiters.push(resolve);
    });
  }

  function close() {
    rl.close();
  }

  return { nextLine, close, EOF };
}

async function askPreferredName(lq, stdout, defaultName) {
  const defaultLabel = defaultName ? `"${defaultName}"` : null;
  while (true) {
    const hint = defaultLabel
      ? `[Enter for ${defaultLabel}]: `
      : "[Required]: ";
    stdout.write(`   ${hint}▸ `);
    const raw = await lq.nextLine();
    if (raw === lq.EOF) return lq.EOF;
    const value = raw.trim();
    if (value === "" && defaultName) return defaultName;
    if (value === "") {
      stdout.write(
        "   A name is required. Please enter your preferred name.\n",
      );
      continue;
    }
    return value;
  }
}

async function askDeviceLabel(lq, stdout) {
  stdout.write("   [Enter to skip]: ▸ ");
  const raw = await lq.nextLine();
  if (raw === lq.EOF) return lq.EOF;
  return raw.trim() === "" ? null : raw.trim();
}

async function askLanguage(lq, stdout, defaultLang) {
  const defaultLabel = defaultLang || "en";
  while (true) {
    stdout.write(`   [Enter for "${defaultLabel}"]: ▸ `);
    const raw = await lq.nextLine();
    if (raw === lq.EOF) return lq.EOF;
    const value = raw.trim().toLowerCase();
    if (value === "") return defaultLabel;
    if (VALID_LANGUAGES.includes(value)) return value;
    stdout.write(
      `   Invalid language code. Valid codes: ${VALID_LANGUAGES.join(" / ")}.\n`,
    );
  }
}

async function askMemoryConsent(lq, stdout) {
  while (true) {
    stdout.write('   [Enter for "1"]: ▸ ');
    const raw = await lq.nextLine();
    if (raw === lq.EOF) return lq.EOF;
    const value = raw.trim();
    if (value === "") return "local";
    if (!VALID_MEMORY_CHOICES.includes(value)) {
      stdout.write("   Invalid choice. Enter 1, 2, or 3.\n");
      continue;
    }
    if (value === "1") return "local";
    if (value === "2") return "local-encrypted";
    return "none";
  }
}

async function askDaughterTest(lq, stdout) {
  stdout.write('   Type "I acknowledge" (or Enter to defer): ▸ ');
  const raw = await lq.nextLine();
  if (raw === lq.EOF) return lq.EOF;
  return raw.trim() === DAUGHTER_TEST_PHRASE;
}

export async function runSetupWizard({
  stdin = process.stdin,
  stdout = process.stdout,
  defaults = {},
  writeProfile = defaultWriteProfile,
} = {}) {
  const lq = buildLineQueue(stdin);

  function write(text) {
    stdout.write(text);
  }

  function canceled(val) {
    return val === lq.EOF;
  }

  write("Welcome to Dema setup.\n\n");
  write(
    "Dema is local-first. Nothing leaves this machine unless you type explicit\n" +
      "consent. This wizard creates the local skeleton at ~/.dema and writes your\n" +
      "operator profile. Everything is reversible — you can edit ~/.dema/profile.json\n" +
      "or re-run setup.\n\n",
  );

  write("Q1 of 5 — Your preferred name (what should Dema call you?)\n");
  write("   This is local-only; it's not posted anywhere.\n");
  const preferredName = await askPreferredName(
    lq,
    stdout,
    defaults.preferred_name || null,
  );
  if (canceled(preferredName)) {
    lq.close();
    stdout.write("Setup canceled. No changes written.\n");
    return null;
  }

  write(
    '\nQ2 of 5 — Device label (a short name for this machine, e.g., "MSI-Titan")\n',
  );
  write("   Optional; used for multi-device companion identity.\n");
  const deviceLabel = await askDeviceLabel(lq, stdout);
  if (canceled(deviceLabel)) {
    lq.close();
    stdout.write("Setup canceled. No changes written.\n");
    return null;
  }

  write(
    "\nQ3 of 5 — Preferred language (ar / en / fr / es / ur / hi / other)\n",
  );
  write("   Affects display only. Identity is language-independent.\n");
  const language = await askLanguage(lq, stdout, defaults.language || "en");
  if (canceled(language)) {
    lq.close();
    stdout.write("Setup canceled. No changes written.\n");
    return null;
  }

  write("\nQ4 of 5 — Memory consent\n");
  write("   Dema stores memory entries under ~/.dema/memory/. Choose:\n");
  write(
    "     (1) local-only      — nothing leaves this machine (recommended)\n",
  );
  write(
    "     (2) local-encrypted — same as (1) plus at-rest encryption (preview)\n",
  );
  write("     (3) skip            — no memory store created\n");
  const memoryConsent = await askMemoryConsent(lq, stdout);
  if (canceled(memoryConsent)) {
    lq.close();
    stdout.write("Setup canceled. No changes written.\n");
    return null;
  }

  write("\nQ5 of 5 — Daughter Test acknowledgment\n");
  write(
    '   Daughter Test (BIZRA canon): "Would you be willing to subject your own\n' +
      '   family to this output?" Acknowledging means you commit to applying this\n' +
      "   test before sharing any Dema output externally.\n",
  );
  const daughterTestAcknowledged = await askDaughterTest(lq, stdout);
  if (canceled(daughterTestAcknowledged)) {
    lq.close();
    stdout.write("Setup canceled. No changes written.\n");
    return null;
  }

  lq.close();

  const profile = {
    schema: "bizra.dema.profile.v0.1",
    preferred_name: preferredName,
    memory_consent: memoryConsent,
    hidden_autonomy: false,
    created_at: new Date().toISOString(),
    device_label: deviceLabel,
    language,
    daughter_test_acknowledged: daughterTestAcknowledged,
  };

  const profilePath = await writeProfile(profile);

  const root = process.env.DEMA_HOME || join(homedir(), ".dema");
  const displayPath =
    typeof profilePath === "string" ? profilePath : join(root, "profile.json");

  write(`\nSetup complete. Profile written to ${displayPath}\n`);
  write("Next: dema doctor    — verify readiness\n");
  write("       dema status    — see current state\n");
  write("       dema explain   — browse the canon\n");

  return profile;
}
