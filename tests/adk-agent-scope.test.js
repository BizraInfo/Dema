import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_SCOPES,
  PRIVACY_CLASSES,
  isKnownScope,
  scopePrivacyAligned,
} from "../packages/adk/src/agent-scope.js";

test("scope enum includes PAT and SAT summary scopes", () => {
  assert.equal(isKnownScope(AGENT_SCOPES.PRIVATE_PAT), true);
  assert.equal(isKnownScope(AGENT_SCOPES.SYSTEM_SAT_SUMMARY), true);
  assert.equal(isKnownScope("PUBLIC_AGENT"), false);
});

test("scope and privacy_class must align", () => {
  assert.equal(
    scopePrivacyAligned(
      AGENT_SCOPES.PRIVATE_PAT,
      PRIVACY_CLASSES.PAT_RAW_LOCAL,
    ),
    true,
  );
  assert.equal(
    scopePrivacyAligned(
      AGENT_SCOPES.SYSTEM_SAT_SUMMARY,
      PRIVACY_CLASSES.SAT_SUMMARY_ONLY,
    ),
    true,
  );
  assert.equal(
    scopePrivacyAligned(
      AGENT_SCOPES.PRIVATE_PAT,
      PRIVACY_CLASSES.SAT_SUMMARY_ONLY,
    ),
    false,
  );
});
