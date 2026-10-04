import test from "node:test";
import assert from "node:assert/strict";

const scannerUrl = new URL(
  "../scripts/audit/public-link-scan.mjs",
  import.meta.url,
);

let scanner = {};
try {
  scanner = await import(scannerUrl);
} catch (error) {
  scanner = { loadError: error };
}

function requireFunction(name) {
  assert.equal(
    typeof scanner[name],
    "function",
    `${name} must be exported by public-link-scan.mjs`,
  );
  return scanner[name];
}

function response(body, { status = 200, headers = {} } = {}) {
  const bytes = Buffer.from(body);
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      String(value),
    ]),
  );
  return {
    status,
    headers: {
      get(name) {
        return normalizedHeaders.get(name.toLowerCase()) ?? null;
      },
    },
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    },
  };
}

function oneRouteCapture() {
  return {
    schemaVersion: 2,
    capturedAt: "2026-07-24T16:20:00.000Z",
    baseUrl: "https://bizra.ai",
    declaredSourceReviewCommit:
      "6f7f545e6a1ac044cbb8d29a0a215e8a9f2885bf",
    surfaces: [
      {
        id: "page:/",
        kind: "page",
        requestMethod: "GET",
        requestPath: "/",
        sourcePath: "app/page.tsx",
        inventoryDisposition: "reviewed",
      },
    ],
  };
}

test("normalizes only a fixed, same-origin GET inventory", () => {
  const normalizeFixedInventory = requireFunction("normalizeFixedInventory");
  const capture = oneRouteCapture();
  const normalized = normalizeFixedInventory(capture, {
    expectedSurfaceCount: 1,
  });

  assert.deepEqual(normalized, {
    origin: "https://bizra.ai",
    declaredSiteCommit: capture.declaredSourceReviewCommit,
    routes: [
      {
        id: "page:/",
        kind: "page",
        requestPath: "/",
        sourcePath: "app/page.tsx",
        inventoryDisposition: "reviewed",
      },
    ],
  });

  assert.throws(
    () =>
      normalizeFixedInventory(
        {
          ...capture,
          surfaces: [...capture.surfaces, { ...capture.surfaces[0] }],
        },
        { expectedSurfaceCount: 2 },
      ),
    /duplicate_inventory_id/,
  );
  assert.throws(
    () =>
      normalizeFixedInventory(
        {
          ...capture,
          surfaces: [
            {
              ...capture.surfaces[0],
              requestPath: "//attacker.example/escape",
            },
          ],
        },
        { expectedSurfaceCount: 1 },
      ),
    /cross_origin_inventory_path/,
  );
  assert.throws(
    () =>
      normalizeFixedInventory(
        {
          ...capture,
          surfaces: [{ ...capture.surfaces[0], requestMethod: "POST" }],
        },
        { expectedSurfaceCount: 1 },
      ),
    /non_get_inventory_route/,
  );
});

test("extracts bounded normalized links and classifies receipt/key paths", () => {
  const extractLinkTargets = requireFunction("extractLinkTargets");
  const classifyLinkTargets = requireFunction("classifyLinkTargets");
  const body = Buffer.from(`
    <a href="/receipts/alpha?token=do-not-retain&amp;x=1">receipt</a>
    <img src='https://bizra.ai/assets/logo.svg#fragment'>
    <form action=/submit>submit</form>
    <loc>https://bizra.ai/keys/revocation.xml</loc>
    Sitemap: https://bizra.ai/sitemap.xml
    Host: bizra.ai
    literal https://example.test/retired-key.json.
    <a href="mailto:private@example.test">ignored</a>
  `);

  const links = extractLinkTargets(body, {
    baseUrl: "https://bizra.ai/",
    contentType: "text/html; charset=utf-8",
  });

  assert.deepEqual(links, [
    "https://bizra.ai/",
    "https://bizra.ai/assets/logo.svg",
    "https://bizra.ai/keys/revocation.xml",
    "https://bizra.ai/receipts/alpha",
    "https://bizra.ai/sitemap.xml",
    "https://bizra.ai/submit",
    "https://example.test/retired-key.json",
  ]);
  assert.ok(!JSON.stringify(links).includes("do-not-retain"));

  const matches = classifyLinkTargets([
    ...links,
    "https://bizra.ai/prereceipts/no",
    "https://bizra.ai/receiptology/no",
    "https://bizra.ai/claim-receipt.json",
  ]);
  assert.deepEqual(matches.publicReceiptLinkMatches, [
    "https://bizra.ai/claim-receipt.json",
    "https://bizra.ai/receipts/alpha",
  ]);
  assert.deepEqual(matches.revokedKeyLinkMatches, [
    "https://bizra.ai/keys/revocation.xml",
    "https://example.test/retired-key.json",
  ]);
});

test("known forbidden phrase matching is exact and deterministic", () => {
  const findKnownForbiddenPhrases = requireFunction(
    "findKnownForbiddenPhrases",
  );
  const body = Buffer.from(
    "Live Receipt Chain\nlive receipt chain\nSEED minted\nSEED mint",
  );

  assert.deepEqual(
    findKnownForbiddenPhrases(body, [
      "SEED minted",
      "Live Receipt Chain",
      "Live Receipt Chain",
    ]),
    ["Live Receipt Chain", "SEED minted"],
  );
});

test("aggregate digests are canonical, order-stable, and recomputable", () => {
  const buildAggregateDigests = requireFunction("buildAggregateDigests");
  const canonicalJson = requireFunction("canonicalJson");
  const projectResponseDigestRecords = requireFunction(
    "projectResponseDigestRecords",
  );
  const projectRouteDigestRecords = requireFunction(
    "projectRouteDigestRecords",
  );
  const sha256Hex = requireFunction("sha256Hex");
  const routeResults = [
    {
      id: "page:/b",
      kind: "page",
      request_path: "/b",
      source_path: "app/b/page.tsx",
      inventory_disposition: "contain",
      status: 307,
      body_byte_length: 3,
      body_sha256: "b".repeat(64),
      content_type: "application/json",
      location: "https://bizra.ai/",
      extracted_links: [],
      public_receipt_link_matches: [],
      revoked_key_link_matches: [],
      known_forbidden_phrase_matches: [],
      request_error: null,
    },
    {
      id: "page:/a",
      kind: "page",
      request_path: "/a",
      source_path: "app/a/page.tsx",
      inventory_disposition: "reviewed",
      status: 200,
      body_byte_length: 2,
      body_sha256: "a".repeat(64),
      content_type: "text/html",
      location: null,
      extracted_links: ["https://bizra.ai/"],
      public_receipt_link_matches: [],
      revoked_key_link_matches: [],
      known_forbidden_phrase_matches: [],
      request_error: null,
    },
  ];

  const digests = buildAggregateDigests(routeResults);
  const reversed = buildAggregateDigests([...routeResults].reverse());

  assert.deepEqual(digests, reversed);
  assert.equal(
    digests.responseDigestSetSha256,
    sha256Hex(canonicalJson(projectResponseDigestRecords(routeResults))),
  );
  assert.equal(
    digests.routeResultSetSha256,
    sha256Hex(canonicalJson(projectRouteDigestRecords(routeResults))),
  );

  const changed = structuredClone(routeResults);
  changed[0].status = 200;
  assert.notEqual(
    buildAggregateDigests(changed).routeResultSetSha256,
    digests.routeResultSetSha256,
  );
});

test("scan timestamps bracket requests and output retains no raw body", async () => {
  const scanPublicLinkInventory = requireFunction("scanPublicLinkInventory");
  const capture = oneRouteCapture();
  const inventory = requireFunction("normalizeFixedInventory")(capture, {
    expectedSurfaceCount: 1,
  });
  const times = [
    new Date("2026-07-24T17:00:00.000Z"),
    new Date("2026-07-24T17:00:02.000Z"),
  ];
  const calls = [];
  const secretBody =
    'TOP_SECRET_BODY<a href="/receipt/alpha?credential=hunter2">ok</a>';

  const report = await scanPublicLinkInventory({
    ...inventory,
    expectedSurfaceCount: 1,
    timeoutMs: 50,
    now: () => times.shift(),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response(secretBody, {
        headers: {
          "content-type": "text/html",
          location: "/next?token=do-not-retain",
        },
      });
    },
  });

  assert.equal(report.schema, "bizra.dema.public_link_scan.v0.2");
  assert.equal(report.scan_started_at, "2026-07-24T17:00:00.000Z");
  assert.equal(report.scan_completed_at, "2026-07-24T17:00:02.000Z");
  assert.equal(report.observed_at, report.scan_completed_at);
  assert.equal(report.duration_ms, 2_000);
  assert.equal(report.surface_count, 1);
  assert.equal(report.request_error_count, 0);
  assert.match(report.route_results[0].body_sha256, /^[0-9a-f]{64}$/);
  assert.equal(
    report.route_results[0].body_byte_length,
    Buffer.byteLength(secretBody),
  );
  assert.deepEqual(report.route_results[0].public_receipt_link_matches, [
    "https://bizra.ai/receipt/alpha",
  ]);
  assert.equal(report.request_policy.credentials, "omit");
  assert.equal(report.request_policy.redirects, "manual");
  assert.equal(report.request_policy.timeout_ms, 50);
  assert.equal(report.scan_policy.raw_bodies_retained, false);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://bizra.ai/");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.redirect, "manual");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal("Authorization" in calls[0].options.headers, false);

  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes("TOP_SECRET_BODY"));
  assert.ok(!serialized.includes("hunter2"));
  assert.ok(!serialized.includes("do-not-retain"));
  for (const forbiddenKey of ["body", "raw_body", "public_text"]) {
    assert.equal(forbiddenKey in report.route_results[0], false);
  }
});

test("scan refuses a completion timestamp before its internal start", async () => {
  const scanPublicLinkInventory = requireFunction("scanPublicLinkInventory");
  const inventory = requireFunction("normalizeFixedInventory")(
    oneRouteCapture(),
    { expectedSurfaceCount: 1 },
  );
  const times = [
    new Date("2026-07-24T17:00:02.000Z"),
    new Date("2026-07-24T17:00:00.000Z"),
  ];

  await assert.rejects(
    scanPublicLinkInventory({
      ...inventory,
      expectedSurfaceCount: 1,
      now: () => times.shift(),
      fetchImpl: async () => response("ok"),
    }),
    /scan_clock_moved_backwards/,
  );
});

test("per-route timeout is bounded and records no exception details", async () => {
  const scanPublicLinkInventory = requireFunction("scanPublicLinkInventory");
  const inventory = requireFunction("normalizeFixedInventory")(
    oneRouteCapture(),
    { expectedSurfaceCount: 1 },
  );

  const report = await scanPublicLinkInventory({
    ...inventory,
    expectedSurfaceCount: 1,
    timeoutMs: 5,
    now: () => new Date("2026-07-24T17:00:00.000Z"),
    fetchImpl: async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => {
            const error = new Error(
              "credential=must-not-leak from timeout details",
            );
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      }),
  });

  assert.equal(report.request_error_count, 1);
  assert.equal(report.route_results[0].request_error, "request_timeout");
  assert.equal(report.route_results[0].status, null);
  assert.ok(!JSON.stringify(report).includes("must-not-leak"));
});
