// Rate limiter for gateway HTTP adapter per NIST SSDF PO.4.3 (DoS mitigation).
//
// Doctrine: Protect upstream services from overwhelming request volumes,
// whether caused by bugs, loops, or malicious actors. This implements a
// token bucket algorithm with deterministic, schema-tagged rejection events.
//
// Design principles:
// - Zero dependencies (Node.js built-ins only)
// - Deterministic rate limiting (same request pattern → same throttling)
// - Truth-labeled rejections (DECLARED_THROTTLED for audit trails)
// - Receipt-aware (throttle events can be logged as structured envelopes)
// - Configurable per-endpoint (different limits for /health vs /chain)

const RATE_LIMIT_SCHEMA = "bizra.dema.rate_limit_verdict.v0.1";

/**
 * Token bucket rate limiter implementation.
 * 
 * Algorithm: Token Bucket
 * - Bucket starts full (capacity tokens)
 * - Tokens replenish at fixed rate (refillRate per second)
 * - Each request consumes 1 token
 * - If no tokens available, request is rejected
 * 
 * Why Token Bucket over Sliding Window:
 * - Allows controlled bursts (more realistic usage patterns)
 * - Simpler state management (no timestamp history)
 * - Deterministic behavior (easier to test and reason about)
 */
class TokenBucket {
  /**
   * @param {number} capacity - Maximum tokens in bucket
   * @param {number} refillRate - Tokens added per second
   */
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time.
   * Called before each acquire attempt.
   */
  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
    const refillAmount = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
    this.lastRefill = now;
  }

  /**
   * Attempt to acquire a token.
   * @returns {{ acquired: boolean, waitMs: number }}
   */
  acquire() {
    this._refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { acquired: true, waitMs: 0 };
    }
    
    // Calculate wait time until next token available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate * 1000);
    return { acquired: false, waitMs };
  }

  /**
   * Get current bucket state (for observability).
   * @returns {{ tokens: number, capacity: number, refillRate: number }}
   */
  getState() {
    this._refill();
    return {
      tokens: Math.floor(this.tokens * 100) / 100, // Round to 2 decimals
      capacity: this.capacity,
      refillRate: this.refillRate
    };
  }
}

/**
 * Rate limit verdict envelope — schema-tagged for observability.
 * @typedef {Object} RateLimitVerdict
 * @property {string} schema - Always RATE_LIMIT_SCHEMA
 * @property {boolean} allowed - True if request is permitted
 * @property {string|null} rejected_reason - Null if allowed, else reason code
 * @property {string|null} rejected_detail - Human-readable explanation
 * @property {string} truth_label - Always "MEASURED_ALLOWED" or "DECLARED_THROTTLED"
 * @property {string} decided_at - ISO 8601 timestamp
 * @property {number|null} retry_after_ms - Suggested wait time before retry
 * @property {Record<string, any>} limits - Applied limits snapshot
 */

/**
 * Create a rate limit verdict envelope.
 * @param {Object} options
 * @param {boolean} options.allowed
 * @param {string|null} options.rejected_reason
 * @param {string|null} options.rejected_detail
 * @param {number|null} options.retryAfterMs
 * @param {Record<string, any>} options.limits
 * @returns {RateLimitVerdict}
 */
function rateLimitVerdict({ allowed, rejected_reason, rejected_detail, retryAfterMs = null, limits }) {
  return {
    schema: RATE_LIMIT_SCHEMA,
    allowed,
    rejected_reason: allowed ? null : rejected_reason,
    rejected_detail: allowed ? null : rejected_detail,
    truth_label: allowed ? "MEASURED_ALLOWED" : "DECLARED_THROTTLED",
    decided_at: new Date().toISOString(),
    retry_after_ms: retryAfterMs,
    limits: Object.freeze(limits)
  };
}

/**
 * Default rate limit configurations per endpoint type.
 * These are conservative defaults suitable for local-first single-node operation.
 * Can be overridden via environment variables or config file.
 */
export const DEFAULT_RATE_LIMITS = Object.freeze({
  // Health checks: frequent but lightweight
  health: { capacity: 60, refillRate: 10 },    // 60 burst, 10/sec sustained
  
  // Chain queries: moderate frequency
  chain: { capacity: 30, refillRate: 5 },      // 30 burst, 5/sec sustained
  
  // PoI summaries: less frequent, heavier computation
  poi: { capacity: 20, refillRate: 2 },        // 20 burst, 2/sec sustained
  
  // Resource listings: infrequent
  resources: { capacity: 15, refillRate: 1 },  // 15 burst, 1/sec sustained
  
  // Generic fallback for unknown endpoints
  default: { capacity: 30, refillRate: 3 }     // 30 burst, 3/sec sustained
});

/**
 * Multi-bucket rate limiter for multiple endpoints.
 * Maintains separate token buckets per endpoint key.
 */
export class RateLimiter {
  /**
   * @param {Object} options
   * @param {Record<string, { capacity: number, refillRate: number }>} options.limits - Per-endpoint limits
   */
  constructor(options = {}) {
    const limits = options.limits ?? DEFAULT_RATE_LIMITS;
    this.buckets = new Map();
    this.limitsConfig = limits;
    
    // Initialize buckets for all configured endpoints
    for (const [key, config] of Object.entries(limits)) {
      this.buckets.set(key, new TokenBucket(config.capacity, config.refillRate));
    }
  }

  /**
   * Acquire permission for a request to the specified endpoint.
   * @param {string} endpointKey - Endpoint identifier (e.g., "health", "chain")
   * @returns {Promise<RateLimitVerdict>}
   */
  async acquire(endpointKey = "default") {
    // Get or create bucket for this endpoint
    let bucket = this.buckets.get(endpointKey);
    if (!bucket) {
      // Unknown endpoint: use default limits and create bucket
      const defaultConfig = this.limitsConfig.default || DEFAULT_RATE_LIMITS.default;
      bucket = new TokenBucket(defaultConfig.capacity, defaultConfig.refillRate);
      this.buckets.set(endpointKey, bucket);
    }

    const result = bucket.acquire();
    const limits = bucket.getState();

    if (result.acquired) {
      return rateLimitVerdict({
        allowed: true,
        rejected_reason: null,
        rejected_detail: null,
        retryAfterMs: null,
        limits
      });
    }

    return rateLimitVerdict({
      allowed: false,
      rejected_reason: "rate_limit_exceeded",
      rejected_detail: `Endpoint '${endpointKey}' rate limit exceeded. Retry after ${result.waitMs}ms.`,
      retryAfterMs: result.waitMs,
      limits
    });
  }

  /**
   * Get current rate limit state for all endpoints (for observability).
   * @returns {Record<string, { tokens: number, capacity: number, refillRate: number }>}
   */
  getState() {
    const state = {};
    for (const [key, bucket] of this.buckets.entries()) {
      state[key] = bucket.getState();
    }
    return state;
  }

  /**
   * Reset all buckets to full capacity (for testing or manual recovery).
   */
  reset() {
    for (const [key, config] of Object.entries(this.limitsConfig)) {
      this.buckets.set(key, new TokenBucket(config.capacity, config.refillRate));
    }
  }
}

/**
 * Create a rate-limited fetch wrapper for gateway HTTP adapter.
 * Wraps fetch calls with automatic rate limiting and retry-after handling.
 * 
 * @param {Function} originalFetch - Original fetch function
 * @param {RateLimiter} rateLimiter - Rate limiter instance
 * @param {string} endpointKey - Endpoint identifier for rate limiting
 * @returns {Function} Wrapped fetch function
 */
export function createRateLimitedFetch(originalFetch, rateLimiter, endpointKey) {
  return async function(...args) {
    const verdict = await rateLimiter.acquire(endpointKey);
    
    if (!verdict.allowed) {
      // Return a synthetic response indicating rate limit hit
      return {
        ok: false,
        status: 429, // Too Many Requests
        statusText: "Too Many Requests",
        headers: new Map([["retry-after", String(verdict.retry_after_ms / 1000)]]),
        json: async () => ({
          error: "rate_limit_exceeded",
          message: verdict.rejected_detail,
          retry_after_ms: verdict.retry_after_ms,
          schema: RATE_LIMIT_SCHEMA
        }),
        text: async () => JSON.stringify({
          error: "rate_limit_exceeded",
          message: verdict.rejected_detail
        })
      };
    }
    
    // Proceed with original fetch
    return originalFetch(...args);
  };
}

/**
 * Parse rate limit configuration from environment variables.
 * Format: DEMA_RATE_LIMIT_<ENDPOINT>=<capacity>,<refillRate>
 * Example: DEMA_RATE_LIMIT_HEALTH=60,10
 * 
 * @returns {Record<string, { capacity: number, refillRate: number }>}
 */
export function parseRateLimitsFromEnv() {
  const limits = { ...DEFAULT_RATE_LIMITS };
  
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^DEMA_RATE_LIMIT_([A-Z_]+)$/);
    if (!match || typeof value !== "string") continue;
    
    const endpoint = match[1].toLowerCase();
    const parts = value.split(",").map(s => parseInt(s.trim(), 10));
    
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      limits[endpoint] = {
        capacity: Math.max(1, parts[0]),
        refillRate: Math.max(0.1, parts[1])
      };
    }
  }
  
  return limits;
}

/**
 * Default export: convenience factory function.
 */
export default function createRateLimiter(options) {
  const limits = options?.limits ?? parseRateLimitsFromEnv();
  return new RateLimiter({ limits });
}
