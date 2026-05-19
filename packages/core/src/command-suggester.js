// Levenshtein distance: standard DP implementation, no deps.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

const NATURAL_LANGUAGE_STARTERS = new Set([
  "tell", "what", "how", "why", "when", "who", "where",
  "is", "are", "can", "do", "does"
]);

/**
 * Suggest commands for unknown input.
 *
 * @param {string} rawInput - The full user-typed string (e.g. "staus" or "tell me what is bizra")
 * @param {Array<{command: string, description: string}>} registeredCommands
 * @returns {{ matched: 'exact'|'close'|'natural-language'|'unknown', suggestions: Array<{command, description}>, originalInput: string, missingToken: string }}
 */
function suggestCommands(rawInput, registeredCommands) {
  const trimmed = (rawInput ?? "").trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const firstToken = (tokens[0] ?? "").toLowerCase();
  const originalInput = trimmed;
  const missingToken = firstToken;

  // Empty input
  if (!firstToken) {
    return { matched: "unknown", suggestions: [], originalInput, missingToken: "" };
  }

  // Natural-language detection: starts with question word or contains '?'
  if (NATURAL_LANGUAGE_STARTERS.has(firstToken) || trimmed.includes("?")) {
    return {
      matched: "natural-language",
      suggestions: [
        { command: "memory show bizra-context", description: "read what I know about BIZRA" },
        { command: "help", description: "full command list" }
      ],
      originalInput,
      missingToken
    };
  }

  // Exact match check (case-insensitive)
  const exactMatch = registeredCommands.find(
    (c) => c.command.toLowerCase() === firstToken
  );
  if (exactMatch) {
    return {
      matched: "exact",
      suggestions: [exactMatch],
      originalInput,
      missingToken
    };
  }

  // Levenshtein typo matching
  // Threshold: ≤2 for short commands (<6 chars), ≤3 for longer
  const threshold = firstToken.length < 6 ? 2 : 3;

  const scored = registeredCommands
    .map((c) => ({ ...c, dist: levenshtein(firstToken, c.command.toLowerCase()) }))
    .filter((c) => c.dist <= threshold)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  if (scored.length > 0) {
    return {
      matched: "close",
      suggestions: scored.map(({ command, description }) => ({ command, description })),
      originalInput,
      missingToken
    };
  }

  return { matched: "unknown", suggestions: [], originalInput, missingToken };
}

export { suggestCommands };
