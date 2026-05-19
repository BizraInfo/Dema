// Homebase Language Picker — ADR-011 Phase 2
//
// Laws enforced:
//   Law #9  → Returning-user language loads silently from profile; no prompt
//   Law #10 → Second language is offered after first-run pick; default is skip
//
// No external deps beyond node:readline and node:fs/promises.
// No process.env reads except for DEMA_HOME fallback inside operator-profile.
// All I/O is injected via { stdin, stdout } — pure testable boundary.

import { createInterface } from "node:readline";
import { readOperatorLanguage, writeOperatorLanguage } from "./operator-profile.js";

export const LANGUAGE_OPTIONS = Object.freeze([
  Object.freeze({ code: "ar", label: "العربية (Arabic)" }),
  Object.freeze({ code: "en", label: "English" }),
  Object.freeze({ code: "fr", label: "Français (French)" }),
  Object.freeze({ code: "es", label: "Español (Spanish)" }),
  Object.freeze({ code: "ur", label: "اردو (Urdu)" }),
  Object.freeze({ code: "hi", label: "हिन्दी (Hindi)" }),
  Object.freeze({ code: "other", label: "Other (text input)" }),
]);

const VALID_CODES = new Set(LANGUAGE_OPTIONS.map((o) => o.code));

// Templates keyed by language code.
// truth_label per ADR-011 authoring guidance:
//   DECLARED                     — authored with high confidence
//   DECLARED_NEEDS_NATIVE_REVIEW — structure sound; cultural-fluency review downstream
//   PLACEHOLDER_PENDING_NATIVE_AUTHOR — English placeholders; not authored in target language
export const GREETING_TEMPLATES = Object.freeze(
  Object.fromEntries(
    Object.entries({
      ar: Object.freeze({
        truth_label: "DECLARED_NEEDS_NATIVE_REVIEW",
        welcome_back: "أهلاً، {name}.",
        welcome_new: "أهلاً بك في ديما.",
        picker_prompt: "ما هي لغتك المفضلة؟",
        selection_confirmed: "تم تعيين اللغة إلى {language_label}.",
        second_language_prompt: "اختر لغة ثانوية اختياريًا (اضغط Enter للتخطي).",
        second_language_skipped: "تم التخطي. اللغة الأساسية فقط.",
      }),
      en: Object.freeze({
        truth_label: "DECLARED",
        welcome_back: "Welcome back, {name}.",
        welcome_new: "Welcome to Dema.",
        picker_prompt: "What is your preferred language?",
        selection_confirmed: "Language set to {language_label}.",
        second_language_prompt:
          "Optionally, a second language for fallback display? (Press Enter to skip.)",
        second_language_skipped: "Skipped. Primary language only.",
      }),
      fr: Object.freeze({
        truth_label: "DECLARED",
        welcome_back: "Bon retour, {name}.",
        welcome_new: "Bienvenue sur Dema.",
        picker_prompt: "Quelle est votre langue préférée ?",
        selection_confirmed: "Langue définie sur {language_label}.",
        second_language_prompt:
          "Optionnellement, une deuxième langue pour l'affichage de secours ? (Appuyez sur Entrée pour ignorer.)",
        second_language_skipped: "Ignoré. Langue principale uniquement.",
      }),
      es: Object.freeze({
        truth_label: "DECLARED",
        welcome_back: "Bienvenido de nuevo, {name}.",
        welcome_new: "Bienvenido a Dema.",
        picker_prompt: "¿Cuál es tu idioma preferido?",
        selection_confirmed: "Idioma establecido en {language_label}.",
        second_language_prompt:
          "Opcionalmente, ¿un segundo idioma para visualización de respaldo? (Presiona Enter para omitir.)",
        second_language_skipped: "Omitido. Solo idioma principal.",
      }),
      ur: Object.freeze({
        truth_label: "PLACEHOLDER_PENDING_NATIVE_AUTHOR",
        welcome_back: "Welcome back, {name}.",
        welcome_new: "Welcome to Dema.",
        picker_prompt: "What is your preferred language?",
        selection_confirmed: "Language set to {language_label}.",
        second_language_prompt:
          "Optionally, a second language for fallback display? (Press Enter to skip.)",
        second_language_skipped: "Skipped. Primary language only.",
      }),
      hi: Object.freeze({
        truth_label: "PLACEHOLDER_PENDING_NATIVE_AUTHOR",
        welcome_back: "Welcome back, {name}.",
        welcome_new: "Welcome to Dema.",
        picker_prompt: "What is your preferred language?",
        selection_confirmed: "Language set to {language_label}.",
        second_language_prompt:
          "Optionally, a second language for fallback display? (Press Enter to skip.)",
        second_language_skipped: "Skipped. Primary language only.",
      }),
      other: Object.freeze({
        // "other" falls back to English — no greeting template for an unknown free-text code
        truth_label: "DECLARED",
        welcome_back: "Welcome back, {name}.",
        welcome_new: "Welcome to Dema.",
        picker_prompt: "What is your preferred language?",
        selection_confirmed: "Language set to {language_label}.",
        second_language_prompt:
          "Optionally, a second language for fallback display? (Press Enter to skip.)",
        second_language_skipped: "Skipped. Primary language only.",
      }),
    }).map(([k, v]) => [k, Object.freeze(v)])
  )
);

// ─── Internal helpers ────────────────────────────────────────────────────────

const EOF = Symbol("EOF");

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

function templateFor(code) {
  return GREETING_TEMPLATES[code] ?? GREETING_TEMPLATES.en;
}

function isValidIso639_1(s) {
  return typeof s === "string" && /^[a-z]{2}$/.test(s);
}

function isValidLanguageInput(s) {
  return VALID_CODES.has(s) || isValidIso639_1(s);
}

async function runInteractivePicker(lq, stdout, onboarding_trigger) {
  const tmpl = templateFor("en"); // picker always prompts in English until language is chosen
  const warnings = [];

  // Print picker prompt + numbered list
  stdout.write(`\n${tmpl.picker_prompt}\n`);
  LANGUAGE_OPTIONS.forEach((opt, i) => {
    stdout.write(`  ${i + 1}. ${opt.label}\n`);
  });
  stdout.write("\nEnter number or code: ");

  let primary_code = null;
  let primary_label = null;

  while (true) {
    const raw = await lq.nextLine();
    if (raw === lq.EOF) {
      warnings.push("stdin closed before language selection");
      return { primary_code: null, primary_label: null, warnings, eof: true };
    }
    const value = raw.trim().toLowerCase();

    // Numeric selection
    const num = parseInt(value, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= LANGUAGE_OPTIONS.length) {
      const opt = LANGUAGE_OPTIONS[num - 1];
      primary_code = opt.code;
      primary_label = opt.label;
      break;
    }

    // Direct code match
    if (VALID_CODES.has(value)) {
      const opt = LANGUAGE_OPTIONS.find((o) => o.code === value);
      primary_code = opt.code;
      primary_label = opt.label;
      break;
    }

    // "other" free-text branch: if they typed something that looks ISO 639-1
    if (value === "other") {
      stdout.write("Enter your language code (2 lowercase letters, e.g. 'sw'): ");
      const freeRaw = await lq.nextLine();
      if (freeRaw === lq.EOF) {
        warnings.push("stdin closed before language selection");
        return { primary_code: null, primary_label: null, warnings, eof: true };
      }
      const freeVal = freeRaw.trim().toLowerCase();
      if (isValidIso639_1(freeVal)) {
        primary_code = freeVal;
        primary_label = `other (${freeVal})`;
        break;
      }
      stdout.write(
        `  Invalid code "${freeVal}". Must be exactly 2 lowercase letters. Try again.\n`
      );
      stdout.write("Enter number or code: ");
      continue;
    }

    // If they typed a 2-letter ISO code that's not in our list, treat as "other"
    if (isValidIso639_1(value)) {
      primary_code = value;
      primary_label = `other (${value})`;
      break;
    }

    stdout.write(
      `  Invalid. Enter a number (1-${LANGUAGE_OPTIONS.length}) or a language code.\n`
    );
    stdout.write("Enter number or code: ");
  }

  // Print selection_confirmed in chosen language
  const chosenTmpl = templateFor(primary_code);
  stdout.write(
    `\n${chosenTmpl.selection_confirmed.replace("{language_label}", primary_label)}\n`
  );

  return { primary_code, primary_label, warnings, eof: false };
}

async function runSecondLanguagePicker(lq, stdout, primary_code) {
  const tmpl = templateFor(primary_code);
  stdout.write(`\n${tmpl.second_language_prompt}\n`);
  stdout.write("Second language code or Enter to skip: ");

  const raw = await lq.nextLine();
  if (raw === lq.EOF) {
    // EOF during second language — treat as skip, not fatal
    return { secondary_code: null, offered: true };
  }

  const value = raw.trim().toLowerCase();
  if (value === "") {
    stdout.write(`${tmpl.second_language_skipped}\n`);
    return { secondary_code: null, offered: true };
  }

  if (VALID_CODES.has(value) || isValidIso639_1(value)) {
    return { secondary_code: value, offered: true };
  }

  // Invalid secondary — treat as skip (Law #10: NEVER block advancement)
  stdout.write(
    `  Invalid secondary code. ${tmpl.second_language_skipped}\n`
  );
  return { secondary_code: null, offered: true };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function resolveOperatorLanguage({
  home,
  stdin = process.stdin,
  stdout = process.stdout,
  resetLanguage = false,
  skipPrompt = false,
} = {}) {
  const warnings = [];

  // Law #9: Returning-user load
  let profileLang = null;
  let profileSecondary = null;
  let profileSource = "absent";

  try {
    const result = await readOperatorLanguage(home);
    profileSource = result.source;
    if (result.source !== "absent" && result.source !== "malformed") {
      profileLang = result.language_code;
      profileSecondary = result.secondary_language_code;
    }
    if (result.source === "malformed") {
      warnings.push("profile.json malformed; treating as absent");
    }
  } catch {
    warnings.push("profile.json read error; treating as absent");
  }

  const profileHasValidLanguage =
    profileLang !== null && isValidLanguageInput(profileLang);

  // Silent profile load path (Law #9)
  if (!resetLanguage && profileHasValidLanguage) {
    return {
      language_code: profileLang,
      secondary_language_code: profileSecondary,
      secondary_language_offered: false,
      returning_user_load: true,
      language_source: "profile_load",
      candidate_lifecycle: {
        is_first_run: false,
        is_returning_user: true,
        onboarding_trigger: "first_run",
      },
      warnings,
    };
  }

  // Non-TTY safety: if stdin/stdout not TTY and no valid profile language → bail
  const isTTY = stdout.isTTY && stdin.isTTY;
  if (!isTTY) {
    warnings.push(
      "non-TTY context: language not interactively pickable; profile.json absent or missing language_code"
    );
    return {
      language_code: null,
      secondary_language_code: null,
      secondary_language_offered: false,
      returning_user_load: false,
      language_source: "non_tty_default",
      candidate_lifecycle: {
        is_first_run: true,
        is_returning_user: false,
        onboarding_trigger: "non_tty",
      },
      warnings,
    };
  }

  // skipPrompt=true means banner context — silent load only, never interactive
  if (skipPrompt) {
    return {
      language_code: null,
      secondary_language_code: null,
      secondary_language_offered: false,
      returning_user_load: false,
      language_source: "non_tty_default",
      candidate_lifecycle: {
        is_first_run: true,
        is_returning_user: false,
        onboarding_trigger: "first_run",
      },
      warnings,
    };
  }

  // Interactive picker
  const language_source = resetLanguage ? "reset_explicit" : "first_run_picker";
  const onboarding_trigger = resetLanguage ? "reset_explicit" : "first_run";

  const lq = buildLineQueue(stdin);

  const pickerResult = await runInteractivePicker(lq, stdout, onboarding_trigger);

  if (pickerResult.eof || pickerResult.primary_code === null) {
    lq.close();
    return {
      language_code: null,
      secondary_language_code: null,
      secondary_language_offered: false,
      returning_user_load: false,
      language_source: "non_tty_default",
      candidate_lifecycle: {
        is_first_run: true,
        is_returning_user: false,
        onboarding_trigger,
      },
      warnings: [...warnings, ...(pickerResult.warnings ?? [])],
    };
  }

  warnings.push(...(pickerResult.warnings ?? []));
  const primary_code = pickerResult.primary_code;

  // Law #10: Second language (only on first-run picker)
  let secondary_code = null;
  let secondary_offered = false;

  const secondResult = await runSecondLanguagePicker(lq, stdout, primary_code);
  secondary_code = secondResult.secondary_code;
  secondary_offered = secondResult.offered;

  lq.close();

  // Persist to profile.json (atomic write inside writeOperatorLanguage)
  await writeOperatorLanguage({
    home,
    language_code: primary_code,
    secondary_language_code: secondary_code,
  });

  return {
    language_code: primary_code,
    secondary_language_code: secondary_code,
    secondary_language_offered: secondary_offered,
    returning_user_load: false,
    language_source,
    candidate_lifecycle: {
      is_first_run: !resetLanguage,
      is_returning_user: false,
      onboarding_trigger,
    },
    warnings,
  };
}
