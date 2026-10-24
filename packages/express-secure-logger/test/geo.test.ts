import { describe, expect, it, vi } from 'vitest';
import { GeoResolver, anonymizeIp, isPublicIp, normalizeIp } from '../src';
import { sleep } from './helpers';

const place = { country: 'Testland', countryCode: 'tl', region: 'TS', city: 'Testville' };

describe('ip utilities', () => {
  it('normalizes IPv4, IPv6 and mapped addresses; rejects junk', () => {
    expect(normalizeIp('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(normalizeIp('2606:4700:4700::1111')).toBe('2606:4700:4700::1111');
    expect(normalizeIp('fe80::1%eth0')).toBe('fe80::1');
    expect(normalizeIp('not-an-ip')).toBeUndefined();
    expect(normalizeIp('1.2.3.4, 5.6.7.8')).toBeUndefined();
  });
  it('anonymizes v4 to /24 and v6 to /48', () => {
    expect(anonymizeIp('203.0.113.9')).toBe('203.0.113.0');
    expect(anonymizeIp('2606:4700:4700::1111')).toBe('2606:4700:4700::');
  });
  it('classifies private/reserved addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.0.1', '::1', 'fd00::1', 'fe80::1']) expect(isPublicIp(ip)).toBe(false);
    for (const ip of ['8.8.8.8', '203.0.113.9', '2606:4700:4700::1111']) expect(isPublicIp(ip)).toBe(true);
  });
});

describe('GeoResolver', () => {
  it('returns a normalized location and caches it', async () => {
    const provider = vi.fn(() => place);
    const g = new GeoResolver({ provider });
    expect(await g.lookup('8.8.8.8')).toEqual({ country: 'Testland', countryCode: 'TL', region: 'TS', city: 'Testville' });
    await g.lookup('8.8.8.8');
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('never looks up private addresses', async () => {
    const provider = vi.fn(() => place);
    const g = new GeoResolver({ provider });
    expect(await g.lookup('127.0.0.1')).toBeUndefined();
    expect(provider).not.toHaveBeenCalled();
  });
  it('bounds the cache (LRU eviction)', async () => {
    const g = new GeoResolver({ provider: () => place, cacheSize: 2 });
    for (const ip of ['8.8.8.1', '8.8.8.2', '8.8.8.3']) await g.lookup(ip);
    expect(g.size).toBe(2);
  });
  it('expires entries by TTL', async () => {
    let t = 0;
    const provider = vi.fn(() => place);
    const g = new GeoResolver({ provider, ttlMs: 100, now: () => t });
    await g.lookup('8.8.8.8'); t = 50; await g.lookup('8.8.8.8'); t = 500; await g.lookup('8.8.8.8');
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('tolerates provider failure, negative-caches, and opens a circuit breaker', async () => {
    const provider = vi.fn(() => { throw new Error('db down'); });
    const g = new GeoResolver({ provider, breakerThreshold: 2, breakerCooldownMs: 10_000 });
    expect(await g.lookup('8.8.8.1')).toBeUndefined();
    expect(await g.lookup('8.8.8.1')).toBeUndefined(); // negative cache
    expect(provider).toHaveBeenCalledTimes(1);
    await g.lookup('8.8.8.2'); // second failure opens the breaker
    await g.lookup('8.8.8.3'); // short-circuited
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('times out slow providers but still warms the cache', async () => {
    const g = new GeoResolver({ provider: async () => { await sleep(60); return place; }, timeoutMs: 10 });
    expect(await g.lookup('8.8.8.8')).toBeUndefined();
    await sleep(100);
    expect((await g.lookup('8.8.8.8'))?.city).toBe('Testville');
  });
  it('caps concurrent in-flight lookups', async () => {
    const g = new GeoResolver({ provider: async () => { await sleep(50); return place; }, maxInFlight: 1, timeoutMs: 5 });
    void g.lookup('8.8.8.1');
    expect(await g.lookup('8.8.8.2')).toBeUndefined();
  });
});
