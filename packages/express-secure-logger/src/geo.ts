import { isPublicIp } from './request-info';
import { sanitizeString } from './redact';

export interface GeoLocation {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
}

/** Plug in a local GeoIP database (e.g. MaxMind GeoLite2) or any other lookup. */
export type GeoProvider = (ip: string) => Promise<GeoLocation | null | undefined> | GeoLocation | null | undefined;

export interface GeoResolverOptions {
  provider: GeoProvider;
  cacheSize?: number;
  ttlMs?: number;
  negativeTtlMs?: number;
  timeoutMs?: number;
  maxInFlight?: number;
  breakerThreshold?: number;
  breakerCooldownMs?: number;
  now?: () => number;
}

interface CacheEntry {
  value: GeoLocation | undefined;
  expiresAt: number;
}

function normalize(loc: GeoLocation | null | undefined): GeoLocation | undefined {
  if (!loc || typeof loc !== 'object') return undefined;
  const out: GeoLocation = {};
  const s = (v: unknown): string | undefined => (typeof v === 'string' && v ? sanitizeString(v, 100) : undefined);
  const country = s(loc.country);
  const region = s(loc.region);
  const city = s(loc.city);
  if (country) out.country = country;
  if (typeof loc.countryCode === 'string' && /^[A-Za-z]{2}$/.test(loc.countryCode)) out.countryCode = loc.countryCode.toUpperCase();
  if (region) out.region = region;
  if (city) out.city = city;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Non-blocking, failure-tolerant, bounded geolocation lookup.
 * - LRU cache (size-bounded) with TTL, plus short negative caching.
 * - Per-lookup timeout; a slow lookup keeps running to warm the cache.
 * - In-flight de-duplication and a hard concurrency cap.
 * - Circuit breaker after repeated provider failures.
 * - Private/reserved addresses are never looked up. Coordinates are never recorded.
 */
export class GeoResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<GeoLocation | undefined>>();
  private failures = 0;
  private breakerOpenUntil = 0;
  private readonly o: Required<Omit<GeoResolverOptions, 'provider'>> & { provider: GeoProvider };

  constructor(options: GeoResolverOptions) {
    this.o = {
      cacheSize: 5000,
      ttlMs: 86_400_000,
      negativeTtlMs: 300_000,
      timeoutMs: 50,
      maxInFlight: 50,
      breakerThreshold: 5,
      breakerCooldownMs: 30_000,
      now: Date.now,
      ...options,
    };
  }

  get size(): number {
    return this.cache.size;
  }

  async lookup(ip: string): Promise<GeoLocation | undefined> {
    try {
      if (!isPublicIp(ip)) return undefined;
      const now = this.o.now();
      const hit = this.cache.get(ip);
      if (hit) {
        if (hit.expiresAt > now) {
          this.cache.delete(ip);
          this.cache.set(ip, hit); // refresh LRU position
          return hit.value;
        }
        this.cache.delete(ip);
      }
      if (now < this.breakerOpenUntil) return undefined;

      let pending = this.inFlight.get(ip);
      if (!pending) {
        if (this.inFlight.size >= this.o.maxInFlight) return undefined;
        pending = this.fetch(ip);
        this.inFlight.set(ip, pending);
        void pending.finally(() => this.inFlight.delete(ip));
      }
      return await this.withTimeout(pending);
    } catch {
      return undefined;
    }
  }

  private async fetch(ip: string): Promise<GeoLocation | undefined> {
    try {
      const value = normalize(await Promise.resolve().then(() => this.o.provider(ip)));
      this.failures = 0;
      this.store(ip, value, value ? this.o.ttlMs : this.o.negativeTtlMs);
      return value;
    } catch {
      this.failures += 1;
      if (this.failures >= this.o.breakerThreshold) {
        this.breakerOpenUntil = this.o.now() + this.o.breakerCooldownMs;
        this.failures = 0;
      }
      this.store(ip, undefined, this.o.negativeTtlMs);
      return undefined;
    }
  }

  private store(ip: string, value: GeoLocation | undefined, ttl: number): void {
    while (this.cache.size >= this.o.cacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    this.cache.set(ip, { value, expiresAt: this.o.now() + ttl });
  }

  private withTimeout(p: Promise<GeoLocation | undefined>): Promise<GeoLocation | undefined> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(undefined), this.o.timeoutMs);
      timer.unref?.();
      p.then(
        (v) => { clearTimeout(timer); resolve(v); },
        () => { clearTimeout(timer); resolve(undefined); },
      );
    });
  }
}
