// Serialize a value to JSON that is safe to embed inside an HTML <script> tag.
//
// JSON.stringify does NOT escape `<`, so a string field containing `</script>`
// would close the surrounding script element and let arbitrary markup/script
// run in the page. It also leaves the line/paragraph separators U+2028/U+2029
// raw (verified on V8/Node 22), which are illegal as raw chars in a JS string
// literal. Escaping all five yields output that is still valid JSON
// (JSON.parse round-trips it) yet cannot break out of the script context.
//
// The separators are referenced via String.fromCharCode so this source file
// stays pure ASCII — as raw characters they are ECMAScript line terminators
// and would corrupt a regex literal / string here.
const ASCII_ESCAPES = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" };

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const SEP_RE = new RegExp("[" + LINE_SEP + PARA_SEP + "]", "g");
const SEP_ESCAPES = { [LINE_SEP]: "\\u2028", [PARA_SEP]: "\\u2029" };

export function htmlSafeJson(value) {
  return JSON.stringify(value)
    .replace(/[<>&]/g, (ch) => ASCII_ESCAPES[ch])
    .replace(SEP_RE, (ch) => SEP_ESCAPES[ch]);
}
