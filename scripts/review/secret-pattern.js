// CONFIG-SLICE-A — secret-shaped content predicate.
//
// Extracted from repo-claude-config-check.mjs so the predicate can be tested
// without executing the gate (which reads .gitignore, spawns git, and exits
// non-zero). Sibling-module precedent: kernel-purity-allowlist.js.
//
// Pure: no fs, no network, no process, no clock, no random.

// Credential shapes worth failing a tracked-file review over.
//
// The previous form, `sk-[A-Za-z0-9]{10}`, was wrong in BOTH directions and had
// no test to catch either half (TASK-038):
//
//   False positive — unanchored, so it matched inside ordinary words. The prose
//   "backlog instructions task-finalization" contains "sk-finalizati", which
//   failed this gate closed on a file holding no credential at all. Same class
//   fired on "risk-management" and "disk-utilization".
//
//   False negative — `[A-Za-z0-9]{10}` demanded ten CONSECUTIVE alphanumerics
//   directly after "sk-", but every modern key is segmented: sk-proj-…,
//   sk-ant-api03-…. The hyphen inside the first ten characters broke the match,
//   so the shapes most worth catching were the ones it silently let through.
//
// Fixed by anchoring the prefixes to a token boundary (real keys always start
// one) and letting the key body carry the separators it actually contains.
// `ghp_` keeps its single-character tail: no prose contains "ghp_", so raising
// its minimum length would narrow detection for nothing.
export const SECRET_PATTERN =
  /GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|PRIVATE KEY|(?<![A-Za-z0-9])ghp_[A-Za-z0-9]|(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{10,}/i;

// True when `text` contains secret-shaped content.
export function hasSecretPattern(text) {
  return SECRET_PATTERN.test(String(text ?? ""));
}
