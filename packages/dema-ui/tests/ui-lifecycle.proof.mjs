// Execute the current UI source with controlled hook/platform callbacks. This
// verifies lifecycle contracts; it is not a browser usability or runtime proof.
// Package-only: after npm ci run node --test tests/ui-lifecycle.proof.mjs.
// The .proof.mjs suffix keeps package TypeScript out of root auto-discovery.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const flush = () => new Promise((resolve) => setImmediate(resolve));

function hooks() {
  const slots = [];
  const stores = [];
  const effects = [];
  let cursor = 0;
  let inEffect = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], (value) => {
        assert.equal(inEffect, false, "state must not be synchronously reset by an effect");
        slots[i] = typeof value === "function" ? value(slots[i]) : value;
      }];
    },
    useRef(initial) {
      const i = cursor++;
      return slots[i] ??= { current: initial };
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { callback, deps };
      return slots[i].callback;
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) effects.push({ i, callback, deps });
    },
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
      stores.push({ subscribe, getSnapshot, getServerSnapshot });
      return getSnapshot();
    },
    createContext: () => ({ Provider: "provider" }),
  };
  return {
    react, stores,
    render(component) { cursor = 0; stores.length = 0; return component(); },
    commit() {
      for (const { i, callback, deps } of effects.splice(0)) {
        slots[i]?.cleanup?.();
        inEffect = true;
        try { slots[i] = { effect: true, deps, callback, cleanup: callback() }; }
        finally { inEffect = false; }
      }
    },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    replayEffects() {
      for (const slot of slots) if (slot?.effect) {
        slot.cleanup?.();
        inEffect = true;
        try { slot.cleanup = slot.callback(); }
        finally { inEffect = false; }
      }
    },
  };
}

function load(relative, { react, imports = {}, jsxRuntime, ...globals } = {}) {
  const source = readFileSync(new URL(`../src/${relative}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const fallback = new Proxy({}, { get: (_target, key) => key === "__esModule" ? true : String(key) });
  vm.runInNewContext(output, {
    exports, AbortController, setTimeout, clearTimeout, ...globals,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return jsxRuntime ?? { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "@/lib/utils") return { cn: (...items) => items.join(" ") };
      return imports[name] ?? fallback;
    },
  }, { filename: relative });
  return exports;
}

function browser(storage) {
  const listeners = new Map();
  return {
    localStorage: storage,
    addEventListener(event, callback) { (listeners.get(event) ?? listeners.set(event, new Set()).get(event)).add(callback); },
    removeEventListener(event, callback) { listeners.get(event)?.delete(callback); },
    emit(event, value) { for (const callback of listeners.get(event) ?? []) callback(value); },
    count(event) { return listeners.get(event)?.size ?? 0; },
  };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

test("realm preserves NowSurface and keeps GameShell behind the client-only boundary", () => {
  const h = hooks();
  const NowSurface = () => "NowSurface";
  let gameShellSsr;
  const GameShellBoundary = () => null;
  const { default: Realm } = load("app/realm/page.tsx", { react: h.react, imports: {
    "@/components/situation/NowSurface": { NowSurface },
    "next/dynamic": { default: (_loader, options) => {
      gameShellSsr = options.ssr;
      return GameShellBoundary;
    } },
  } });
  const tree = h.render(Realm);
  assert.equal(gameShellSsr, false);
  assert.ok(find(tree, (node) => node.type === NowSurface));
  assert.ok(find(tree, (node) => node.type === GameShellBoundary));
});

test("mobile reads matchMedia and removes its exact change subscription", () => {
  const h = hooks();
  const media = { matches: true, ...browser() };
  const window = { innerWidth: 1000, matchMedia(query) {
    assert.equal(query, "(max-width: 767px)"); return media;
  } };
  const { useIsMobile } = load("hooks/use-mobile.ts", { react: h.react, window });
  assert.equal(h.render(useIsMobile), true, "query result owns mobile state");
  h.commit();
  const store = h.stores[0];
  assert.equal(store.getServerSnapshot(), false);
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);
  media.matches = false;
  media.emit("change", {});
  assert.equal(store.getSnapshot(), false);
  assert.equal(notified, 1);
  unsubscribe();
  assert.equal(media.count("change"), 0);
});

test("language storage synchronizes local/cross-tab changes and cleans listeners", () => {
  const h = hooks();
  let value = "ar";
  const window = browser({ getItem: () => value, setItem: (_key, lang) => { value = lang; } });
  const { useLang } = load("hooks/use-lang.ts", { react: h.react, window });
  const [lang, setLang] = h.render(useLang);
  assert.equal(lang, "ar");
  h.commit();
  const store = h.stores[0];
  assert.equal(store.getServerSnapshot(), "en");
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);
  setLang("en");
  assert.equal(value, "en");
  assert.equal(store.getSnapshot(), "en");
  assert.equal(notified, 1);
  value = "ar";
  window.emit("storage", { key: "other.preference" });
  assert.equal(notified, 1);
  window.emit("storage", { key: "dema.lang" });
  assert.equal(store.getSnapshot(), "ar");
  assert.equal(notified, 2);
  value = null;
  window.emit("storage", { key: null });
  assert.equal(store.getSnapshot(), "en");
  unsubscribe();
  assert.equal(window.count("storage"), 0);
  setLang("ar");
  assert.equal(notified, 3, "removed local listener must not be called");
});

test("language stays usable in memory when storage denies access", () => {
  const h = hooks();
  const window = browser({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } });
  const { useLang } = load("hooks/use-lang.ts", { react: h.react, window });
  const [lang, setLang] = h.render(useLang);
  assert.equal(lang, "en");
  setLang("ar");
  assert.equal(h.render(useLang)[0], "ar");
});

test("language keeps the selected preference when reads work but writes are denied", () => {
  const h = hooks();
  const window = browser({ getItem: () => "en", setItem() { throw new Error("quota exceeded"); } });
  const { useLang } = load("hooks/use-lang.ts", { react: h.react, window });
  const [, setLang] = h.render(useLang);
  setLang("ar");
  assert.equal(h.render(useLang)[0], "ar");
  const store = h.stores[0];
  const unsubscribe = store.subscribe(() => {});
  window.emit("storage", { key: "dema.lang" });
  assert.equal(h.render(useLang)[0], "en", "an external update supersedes the failed-write fallback");
  unsubscribe();
});

test("real React server rendering uses deterministic snapshots without browser globals", () => {
  const react = require("react");
  const jsxRuntime = require("react/jsx-runtime");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { useLang } = load("hooks/use-lang.ts", { react, jsxRuntime });
  const { useIsMobile } = load("hooks/use-mobile.ts", { react, jsxRuntime });
  const { default: Realm } = load("app/realm/page.tsx", { react, jsxRuntime, imports: {
    "@/components/situation/NowSurface": {
      NowSurface: () => react.createElement("div", { "data-surface": "now" }, "NowSurface"),
    },
    "next/dynamic": { default: (_loader, options) => function GameShellBoundary() {
      return options.ssr ? react.createElement("div", null, "GameShell") : null;
    } },
  } });
  const Probe = () => `${useLang()[0]}:${useIsMobile()}`;
  assert.equal(renderToStaticMarkup(react.createElement(Probe)), "en:false");
  assert.equal(renderToStaticMarkup(react.createElement(Realm)), '<div data-surface="now">NowSurface</div>');
});

test("carousel snapshots initial navigation and cleans both Embla subscriptions", () => {
  const h = hooks();
  const events = browser();
  let previous = true;
  let next = false;
  const api = {
    canScrollPrev: () => previous, canScrollNext: () => next,
    on: events.addEventListener, off: events.removeEventListener,
  };
  // Bind methods because Embla's event emitter is the external owner.
  api.on = events.addEventListener.bind(events);
  api.off = events.removeEventListener.bind(events);
  const { Carousel } = load("components/ui/carousel.tsx", { react: h.react,
    imports: { "embla-carousel-react": { default: () => [() => {}, api], __esModule: true } },
  });
  const render = () => Carousel({});
  let tree = h.render(render);
  h.commit();
  assert.equal(tree.props.value.canScrollPrev, true);
  assert.equal(tree.props.value.canScrollNext, false);
  const store = h.stores[0];
  const server = store.getServerSnapshot();
  assert.equal(store.getServerSnapshot(), server, "server snapshot is stable");
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);
  previous = false; next = true;
  events.emit("reInit", api);
  events.emit("select", api);
  tree = h.render(render);
  assert.equal(tree.props.value.canScrollPrev, false);
  assert.equal(tree.props.value.canScrollNext, true);
  assert.equal(notified, 2);
  unsubscribe();
  assert.equal(events.count("reInit"), 0);
  assert.equal(events.count("select"), 0);
});

test("telemetry begins loading, binds abort, and rejects post-unmount results", async () => {
  const h = hooks();
  let resolveFetch;
  let options;
  const fetch = (_url, supplied) => { options = supplied; return new Promise((resolve) => { resolveFetch = resolve; }); };
  const { RealResources } = load("components/game/RealResources.tsx", { react: h.react, fetch });
  const tree = h.render(RealResources);
  const refresh = find(tree.props.right, (node) => node.props?.["aria-label"] === "Refresh telemetry");
  assert.equal(refresh.props.disabled, true);
  h.commit();
  assert.equal(options.cache, "no-store");
  assert.ok(options.signal instanceof AbortSignal);
  h.unmount();
  assert.equal(options.signal.aborted, true);
  resolveFetch({ ok: true, json: async () => ({ measured_at: "late" }) });
  await flush();
  assert.equal(h.render(RealResources).props.right.props.children[0], null);
});

test("telemetry reports HTTP failures and aborts a refresh on unmount", async () => {
  const h = hooks();
  const calls = [];
  const fetch = (_url, options) => new Promise((resolve) => calls.push({ options, resolve }));
  const { RealResources } = load("components/game/RealResources.tsx", { react: h.react, fetch });
  h.render(RealResources); h.commit();
  calls[0].resolve({ ok: false, status: 503 });
  await flush();
  let tree = h.render(RealResources);
  assert.ok(find(tree, (node) => JSON.stringify(node.props?.children).includes("HTTP 503")));
  const refresh = find(tree.props.right, (node) => node.props?.["aria-label"] === "Refresh telemetry");
  assert.equal(refresh.props.disabled, false);
  refresh.props.onClick();
  assert.equal(calls.length, 2);
  h.unmount();
  assert.equal(calls[1].options.signal.aborted, true);
  calls[1].resolve({ ok: false, status: 500 });
  await flush();
});

test("telemetry accepts only the latest observation across overlapping refreshes", async () => {
  const h = hooks();
  const calls = [];
  const fetch = (_url, options) => new Promise((resolve) => calls.push({ options, resolve }));
  const { RealResources } = load("components/game/RealResources.tsx", { react: h.react, fetch });
  const obs = { status: "UNKNOWN", value: null };
  const payload = (measured_at) => ({ measured_at,
    system: { cpu: obs, memory: obs, load: obs, host: obs }, storage: obs, gpu: obs,
    models: obs, receipts: obs, node0_boundary: {
      daemon_started: obs, federation_enabled: obs, minting_enabled: obs, public_network_enabled: obs,
    },
  });
  let tree = h.render(RealResources); h.commit();
  const refresh = find(tree.props.right, (node) => node.props?.["aria-label"] === "Refresh telemetry").props.onClick;
  refresh();
  assert.equal(calls[0].options.signal.aborted, true);
  calls[1].resolve({ ok: true, json: async () => payload("latest") });
  await flush();
  calls[0].resolve({ ok: true, json: async () => payload("obsolete") });
  await flush();
  tree = h.render(RealResources);
  const text = JSON.stringify(tree);
  assert.ok(text.includes("latest"));
  assert.equal(text.includes("obsolete"), false);
  h.unmount();
});

function raidFixture() {
  const h = hooks();
  let spent = 0;
  let receipts = 0;
  let nextTimer = 0;
  const timers = new Map();
  const state = {
    resources: { compute: 100 }, completedMissions: {},
    spendResources: () => { spent++; state.resources.compute -= 4; }, addResource() {}, awardXp() {}, setRail() {}, completeMission() {},
    forgeReceipt: () => { receipts++; return { hash: "fixture-demo-reference" }; },
  };
  const useGame = (selector) => selector(state);
  useGame.getState = () => state;
  const { CiRaid } = load("components/game/CiRaid.tsx", {
    react: h.react,
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(timer) { timers.delete(timer); },
    imports: {
      "@/lib/game/store": { useGame },
      "@/lib/game/data": { CI_GATES: [{ id: "a", name: "A", weight: 1 }, { id: "b", name: "B", weight: 1 }],
        COLOR_CLASS: { proof: {}, verified: {}, fail: {} } },
      "sonner": { toast: { success() {}, error() {} } },
      "framer-motion": { motion: { span: "span" } },
    },
  });
  const render = () => { const tree = h.render(CiRaid); h.commit(); return tree; };
  return {
    h, render, timers, state, spent: () => spent, receipts: () => receipts,
    next: async () => {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id); callback(); await flush();
    },
  };
}

test("raid reset and unmount cancel pending work without a demo completion", async () => {
  const raid = raidFixture();
  let tree = raid.render();
  const runAll = find(tree, (node) => node.props?.onClick?.name === "runAll").props.onClick;
  const pending = runAll();
  runAll();
  assert.equal(raid.spent(), 1, "two immediate clicks must not start competing raids");
  tree = raid.render();
  find(tree, (node) => node.props?.onClick?.name === "reset").props.onClick();
  assert.equal(raid.timers.size, 0);
  await pending;
  assert.equal(raid.receipts(), 0);
  tree = raid.render();
  const second = find(tree, (node) => node.props?.onClick?.name === "runAll").props.onClick();
  raid.h.unmount();
  assert.equal(raid.timers.size, 0);
  await second;
  assert.equal(raid.receipts(), 0);
});

test("raid completes once per local run and effect replay cannot duplicate the demo receipt", async () => {
  const raid = raidFixture();
  let tree = raid.render();
  const pending = find(tree, (node) => node.props?.onClick?.name === "runAll").props.onClick();
  await raid.next();
  assert.equal(raid.receipts(), 0);
  await raid.next();
  await pending;
  tree = raid.render();
  assert.equal(raid.receipts(), 1);
  raid.h.replayEffects();
  raid.render();
  assert.equal(raid.receipts(), 1);
  assert.equal(raid.spent(), 2);
});

test("individual raid gates cancel on reset and can complete after restart", async () => {
  const raid = raidFixture();
  let tree = raid.render();
  const runButton = () => find(tree, (node) => node.props?.children === "Run" && !node.props.disabled);
  runButton().props.onClick();
  find(tree, (node) => node.props?.onClick?.name === "reset").props.onClick();
  assert.equal(raid.timers.size, 0);
  await flush();
  assert.equal(raid.receipts(), 0);
  tree = raid.render(); runButton().props.onClick(); await raid.next();
  tree = raid.render(); runButton().props.onClick(); await raid.next();
  raid.render();
  assert.equal(raid.receipts(), 1);
  raid.h.unmount();
});

test("raid budget exhaustion halts without a demo receipt or pending timer", async () => {
  const raid = raidFixture();
  raid.state.resources.compute = 4;
  let tree = raid.render();
  const pending = find(tree, (node) => node.props?.onClick?.name === "runAll").props.onClick();
  await raid.next(); await pending;
  tree = raid.render();
  assert.equal(raid.receipts(), 0);
  assert.equal(raid.timers.size, 0);
  assert.ok(JSON.stringify(tree).includes("RAID HALTED"));
  raid.h.unmount();
});
