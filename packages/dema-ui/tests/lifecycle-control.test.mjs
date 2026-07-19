import test from "node:test";
import assert from "node:assert/strict";

import {
  getClientHydrationSnapshot,
  getServerHydrationSnapshot,
  subscribeHydration,
} from "../src/lib/browser/hydration-store.js";
import {
  readStoredLang,
  writeStoredLang,
} from "../src/lib/browser/lang-preference.js";
import { createMediaQueryStore } from "../src/lib/browser/mobile-media.js";
import {
  getCarouselNavigationSnapshot,
  subscribeCarouselNavigation,
} from "../src/lib/browser/carousel-navigation.js";
import { fetchNodeResources } from "../src/lib/browser/node-resources.js";
import { createRaidRun } from "../src/lib/game/raid-run.js";

test("hydration store has stable server/client snapshots and a no-op cleanup", () => {
  assert.equal(getServerHydrationSnapshot(), false);
  assert.equal(getClientHydrationSnapshot(), true);
  assert.doesNotThrow(() => subscribeHydration()());
});

test("language preference accepts only the supported local values", () => {
  const values = new Map([["dema.lang", "ar"]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(readStoredLang(storage), "ar");
  values.set("dema.lang", "fr");
  assert.equal(readStoredLang(storage), "en");
  assert.equal(writeStoredLang(storage, "en"), true);
  assert.equal(values.get("dema.lang"), "en");
});

test("language preference fails closed when storage is unavailable", () => {
  const storage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };

  assert.equal(readStoredLang(storage), "en");
  assert.equal(writeStoredLang(storage, "ar"), false);
});

test("mobile media store subscribes and removes the exact listener", () => {
  const listeners = new Set();
  const media = {
    matches: true,
    addEventListener: (event, listener) => {
      assert.equal(event, "change");
      listeners.add(listener);
    },
    removeEventListener: (event, listener) => {
      assert.equal(event, "change");
      listeners.delete(listener);
    },
  };
  const store = createMediaQueryStore(() => media, "(max-width: 767px)");
  const listener = () => {};

  assert.equal(store.getSnapshot(), true);
  const unsubscribe = store.subscribe(listener);
  assert.equal(listeners.has(listener), true);
  unsubscribe();
  assert.equal(listeners.size, 0);
});

test("carousel navigation store cleans both Embla listeners", () => {
  const calls = [];
  const api = {
    canScrollPrev: () => true,
    canScrollNext: () => false,
    on: (event, listener) => calls.push(["on", event, listener]),
    off: (event, listener) => calls.push(["off", event, listener]),
  };
  const listener = () => {};

  assert.equal(getCarouselNavigationSnapshot(api), 1);
  const unsubscribe = subscribeCarouselNavigation(api, listener);
  unsubscribe();
  assert.deepEqual(
    calls.map(([verb, event]) => [verb, event]),
    [
      ["on", "reInit"],
      ["on", "select"],
      ["off", "reInit"],
      ["off", "select"],
    ],
  );
});

test("carousel navigation store handles an unavailable API", () => {
  assert.equal(getCarouselNavigationSnapshot(undefined), 0);
  assert.doesNotThrow(() => subscribeCarouselNavigation(undefined, () => {})());
});

test("node resources fetch binds no-store cache and the abort signal", async () => {
  const controller = new AbortController();
  let observedOptions;
  const payload = { schema: "test" };
  const fetchImpl = async (_url, options) => {
    observedOptions = options;
    return { ok: true, json: async () => payload };
  };

  assert.strictEqual(
    await fetchNodeResources(fetchImpl, controller.signal),
    payload,
  );
  assert.equal(observedOptions.cache, "no-store");
  assert.strictEqual(observedOptions.signal, controller.signal);
});

test("node resources fetch rejects a non-success response", async () => {
  await assert.rejects(
    fetchNodeResources(async () => ({ ok: false, status: 503 })),
    /HTTP 503/,
  );
});

test("raid run cancellation resolves pending work without completion", async () => {
  const raid = createRaidRun();
  const pending = raid.wait(1_000);
  raid.cancel();

  assert.equal(await pending, false);
  assert.equal(raid.cancelled, true);
});

test("raid run completes a live bounded delay", async () => {
  const raid = createRaidRun();

  assert.equal(await raid.wait(1), true);
  assert.equal(raid.cancelled, false);
});
