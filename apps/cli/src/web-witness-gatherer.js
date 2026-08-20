// DEMA-WEB-WITNESS-1A — read-only gatherer.
//
// The ONLY network surface of the witness: one GET, no credentials, no
// cookies, no script execution, bounded body. fetch is injected so tests
// never touch the network and the kernel never owns I/O.

import { createHash } from "node:crypto";

export const WEB_WITNESS_BODY_CAP_BYTES = 2 * 1024 * 1024; // 2 MiB
export const WEB_WITNESS_USER_AGENT = "BIZRA-Dema-Web-Witness/0.1";
const DEFAULT_TIMEOUT_MS = 8000;

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]{0,300})<\/title>/i);
  return m ? m[1].trim() : null;
}

/// Crude, honest visible-text extraction: strip script/style blocks and tags,
/// collapse whitespace. A witness excerpt is a reading aid, not a parse claim.
function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html, baseUrl) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#][^"']*)["']/gi)) {
    let resolved;
    try {
      resolved = new URL(m[1], baseUrl);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(resolved.protocol)) continue;
    resolved.username = "";
    resolved.password = "";
    const href = resolved.href;
    if (!seen.has(href)) {
      seen.add(href);
      out.push(href);
    }
  }
  return out;
}

export async function gatherWebWitnessObservation(
  requestUrl,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, now = () => new Date() } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(requestUrl, {
      method: "GET",
      redirect: "follow",
      credentials: "omit",
      signal: controller.signal,
      headers: { "user-agent": WEB_WITNESS_USER_AGENT, accept: "*/*" },
    });
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      reason: "request_failed",
      detail: err?.cause?.code ?? err?.name ?? "fetch_error",
    };
  }
  clearTimeout(timer);

  const buf = Buffer.from(await response.arrayBuffer());
  const overflow = buf.byteLength > WEB_WITNESS_BODY_CAP_BYTES;
  const contentType = response.headers?.get?.("content-type") ?? null;
  const textual =
    !overflow && /text|html|json|xml|javascript|css/i.test(contentType ?? "");
  const html = textual ? buf.toString("utf8") : "";
  const finalUrl = response.url || requestUrl;
  const allLinks = textual ? extractLinks(html, finalUrl) : [];

  return {
    ok: true,
    observation: {
      request_url: requestUrl,
      final_url: finalUrl,
      redirected: response.redirected === true,
      fetched_at_iso: now().toISOString(),
      status: response.status,
      content_type: contentType,
      // A hash of partial bytes would misrepresent the page: on overflow the
      // witness declares overflow and carries no body hash at all.
      body_sha256: overflow ? null : sha256Hex(buf),
      body_byte_length: buf.byteLength,
      body_overflow: overflow,
      title: textual ? extractTitle(html) : null,
      text_excerpt: textual ? extractText(html) : null,
      links: allLinks,
      link_count_total: allLinks.length,
    },
  };
}
