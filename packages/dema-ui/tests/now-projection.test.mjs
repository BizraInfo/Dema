import assert from "node:assert/strict";
import test from "node:test";
import { aggregateSituationState } from "../src/lib/situation/situation-aggregator.ts";
import { NOW_PROJECTION_SCHEMA, projectNow, renderNowText } from "../src/lib/situation/now-projection.ts";

const NOW = "2026-09-14T02:05:00.000Z";

test("NOW projects unknown state without inventing health, attention absence, or authority", () => {
  const projection = projectNow(aggregateSituationState({}, { observedAt: NOW }));
  assert.equal(projection.schema, NOW_PROJECTION_SCHEMA);
  assert.equal(projection.title, "NOW");
  assert.equal(projection.identity.value, "UNKNOWN");
  assert.equal(projection.identity.truth, "UNKNOWN");
  assert.equal(projection.attention.value, "UNKNOWN");
  assert.equal(projection.attention.truth, "UNKNOWN");
  assert.equal(projection.authority.value, "UNKNOWN");
  assert.equal(projection.authority.truth, "UNKNOWN");
  assert.match(projection.resources.value, /0 measured/);
  assert.equal(projection.resources.truth, "UNKNOWN");
  assert.equal(projection.next.value, "UNKNOWN — no recommendation basis");
});

test("NOW preserves measured resource evidence without promoting it to mission truth", () => {
  const state = aggregateSituationState({
    resources: {
      cpu: { status: "MEASURED", value: { cores: 8 }, source: "os.cpus()", measured_at: NOW, stale_after_ms: 5000 },
    },
  }, { observedAt: NOW });
  const projection = projectNow(state);
  assert.equal(projection.freshness.status, "CURRENT");
  assert.match(projection.resources.value, /1 measured/);
  assert.equal(projection.resources.truth, "MEASURED");
  assert.equal(projection.mission.value, "UNKNOWN");
  assert.equal(projection.mission.truth, "UNKNOWN");
  assert.equal(projection.authority.value, "UNKNOWN");
});

test("NOW text exposes truth labels, freshness, gaps and limits", () => {
  const text = renderNowText(projectNow(aggregateSituationState({}, { observedAt: NOW })));
  assert.match(text, /DEMA · NOW/);
  assert.match(text, /FRESHNESS  CURRENT/);
  assert.match(text, /OPEN GAPS/);
  assert.match(text, /NOT ESTABLISHED/);
  assert.doesNotMatch(text, /VERIFIED.*ACTIVE/);
});

test("NOW keeps stale source semantics visible", () => {
  const state = aggregateSituationState({
    resources: {
      gateway: { status: "MEASURED", value: "ok", source: "gateway.health", measured_at: "2026-09-14T00:00:00.000Z", stale_after_ms: 1000 },
    },
  }, { observedAt: NOW });
  const projection = projectNow(state);
  assert.equal(projection.freshness.status, "CURRENT");
  assert.equal(state.resources.gateway.truth, "STALE");
  assert.equal(state.resources.gateway.freshness.status, "STALE");
});
