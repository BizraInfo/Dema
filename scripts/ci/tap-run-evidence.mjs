// Structural TAP evidence analysis for the G8 classifier. This module does not
// decide allowlisting; it only binds each run's points, plan, and Node trailer.

function collect(lines, pattern) {
  const found = [];
  for (const [lineIndex, line] of lines.entries()) {
    const match = line.match(pattern);
    if (match) found.push({ lineIndex, value: Number(match[1]) });
  }
  return found;
}

export function evaluateTapRunEvidence(lines, lastNotOkLine = -1) {
  const versionLines = lines
    .map((line, lineIndex) =>
      /^TAP version \d+\s*$/i.test(line) ? lineIndex : null,
    )
    .filter((lineIndex) => lineIndex !== null);
  const plans = collect(lines, /^1\.\.(\d+)\s*$/);
  const tests = collect(lines, /^#\s*tests\s+(\d+)\s*$/);
  const passes = collect(lines, /^#\s*pass\s+(\d+)\s*$/);
  const failures = collect(lines, /^#\s*fail\s+(\d+)\s*$/);
  const markerRunCount = Math.max(
    plans.length,
    tests.length,
    passes.length,
    failures.length,
  );
  const expectedRunCount = versionLines.length || markerRunCount;
  const trailersPresent =
    expectedRunCount > 0 &&
    plans.length === expectedRunCount &&
    tests.length === expectedRunCount &&
    passes.length === expectedRunCount &&
    failures.length === expectedRunCount;
  let complete = trailersPresent;
  complete &&= versionLines.length > 0 || expectedRunCount === 1;
  let inconsistentFailureCount = 0;
  let uncapturedFailures = 0;
  const allPointLines = new Set();
  const ownedPointLines = new Set();
  for (const [lineIndex, line] of lines.entries()) {
    if (/^(?:ok|not ok) \d+(?:\s|$)/.test(line)) {
      allPointLines.add(lineIndex);
    }
  }

  for (let i = 0; trailersPresent && i < expectedRunCount; i++) {
    const versionLine = versionLines[i] ?? -1;
    const nextVersionLine = versionLines[i + 1] ?? Number.POSITIVE_INFINITY;
    const runStartLine =
      versionLines[i] ?? (i === 0 ? -1 : failures[i - 1].lineIndex);
    const pointNumbers = [];
    let runNotOkCount = 0;
    for (
      let lineIndex = runStartLine + 1;
      lineIndex < plans[i].lineIndex;
      lineIndex++
    ) {
      const point = lines[lineIndex].match(/^(ok|not ok) (\d+)(?:\s|$)/);
      if (point) {
        ownedPointLines.add(lineIndex);
        pointNumbers.push(Number(point[2]));
        if (point[1] === "not ok") runNotOkCount++;
      }
    }
    inconsistentFailureCount += Math.abs(
      failures[i].value - runNotOkCount,
    );
    uncapturedFailures += Math.max(0, failures[i].value - runNotOkCount);
    complete &&=
      versionLine < plans[i].lineIndex &&
      plans[i].lineIndex < tests[i].lineIndex &&
      tests[i].lineIndex < passes[i].lineIndex &&
      passes[i].lineIndex < failures[i].lineIndex &&
      failures[i].lineIndex < nextVersionLine &&
      plans[i].value > 0 &&
      pointNumbers.length === plans[i].value &&
      pointNumbers.every((number, index) => number === index + 1) &&
      // The plan counts top-level points; # tests also includes nested tests.
      plans[i].value <= tests[i].value &&
      passes[i].value <= tests[i].value &&
      failures[i].value <= tests[i].value &&
      passes[i].value + failures[i].value <= tests[i].value;
  }
  complete &&=
    ownedPointLines.size === allPointLines.size &&
    [...allPointLines].every((lineIndex) => ownedPointLines.has(lineIndex));
  if (trailersPresent) complete &&= failures.at(-1).lineIndex > lastNotOkLine;

  return Object.freeze({
    complete,
    reportedFailCount: failures.reduce((sum, marker) => sum + marker.value, 0),
    inconsistentFailureCount,
    uncapturedFailures,
  });
}
