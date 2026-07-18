// Serialize a value to JSON that is safe to embed inside an HTML <script> tag.
//
// SECURITY: JSON.stringify does NOT escape `<`, so a string field containing
// `</script>` would close the surrounding script element and let arbitrary
// markup/script run in the page. Escaping `<` (and `>`/`&` for tidiness) is the
// script-element breakout prevention — the only way to terminate a raw-text
// <script> element is a literal `<` + `/script`.
//
// COMPATIBILITY: JSON.stringify also leaves the line/paragraph separators
// U+2028/U+2029 raw. Since ES2019 (the JSON-superset revision) these are legal
// unescaped inside JS string literals, so this is NOT a modern-syntax fix;
// escaping them normalizes the generated script text for portability and older
// parsers/tools and avoids raw Unicode separators in the emitted document.
//
// Escaping all five keeps the output valid JSON (JSON.parse round-trips it).
// The separators are referenced via String.fromCharCode so this source file
// stays pure ASCII (raw separators would corrupt a regex literal / string here).
const ASCII_ESCAPES = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" };

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const SEP_RE = new RegExp("[" + LINE_SEP + PARA_SEP + "]", "g");
const SEP_ESCAPES = { [LINE_SEP]: "\\u2028", [PARA_SEP]: "\\u2029" };

export function htmlSafeJson(value) {
  // JSON.stringify returns undefined for a top-level undefined/function/symbol.
  // Fail closed with a stable error rather than crash on .replace or silently
  // emit non-JSON `undefined` into the script context. (Native JSON.stringify
  // failures — BigInt, cyclic structures — still throw their own errors.)
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError("htmlSafeJson: top-level value is not JSON-serializable");
  }
  return json
    .replace(/[<>&]/g, (ch) => ASCII_ESCAPES[ch])
    .replace(SEP_RE, (ch) => SEP_ESCAPES[ch]);
}
