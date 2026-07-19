const LANG_STORAGE_KEY = "dema.lang";

export function readStoredLang(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const stored = target?.getItem(LANG_STORAGE_KEY);
    return stored === "ar" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

export function writeStoredLang(storage, lang) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(LANG_STORAGE_KEY, lang);
    return true;
  } catch {
    return false;
  }
}
