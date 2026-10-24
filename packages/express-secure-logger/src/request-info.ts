import net from 'node:net';
import type { Request } from 'express';
import type { IpMode } from './config';
import { sanitizeString } from './redact';

const nonPublic = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) nonPublic.addSubnet(addr, prefix, 'ipv4');
nonPublic.addAddress('::', 'ipv6');
for (const [addr, prefix] of [
  ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32],
] as const) nonPublic.addSubnet(addr, prefix, 'ipv6');

/** Validates an IP string (v4 or v6), strips zone IDs and unwraps IPv4-mapped IPv6. */
export function normalizeIp(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return undefined;
  let ip = raw.trim();
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1]) ip = mapped[1];
  return net.isIP(ip) ? ip : undefined;
}

export function isPublicIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return false;
  return !nonPublic.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

function expandIPv6(ip: string): string[] {
  let s = ip;
  if (s.includes('.')) {
    const i = s.lastIndexOf(':');
    const v4 = s.slice(i + 1).split('.').map(Number);
    const hi = (((v4[0] ?? 0) << 8) | (v4[1] ?? 0)).toString(16);
    const lo = (((v4[2] ?? 0) << 8) | (v4[3] ?? 0)).toString(16);
    s = `${s.slice(0, i + 1)}${hi}:${lo}`;
  }
  const [head, tail] = s.split('::');
  const h = head ? head.split(':') : [];
  if (tail === undefined) return h.map((x) => x.padStart(4, '0'));
  const t = tail ? tail.split(':') : [];
  const fill = Math.max(8 - h.length - t.length, 0);
  return [...h, ...Array<string>(fill).fill('0'), ...t].map((x) => x.padStart(4, '0'));
}

/** IPv4 -> /24 (last octet zeroed); IPv6 -> /48. */
export function anonymizeIp(ip: string): string {
  if (net.isIPv4(ip)) return `${ip.split('.').slice(0, 3).join('.')}.0`;
  const g = expandIPv6(ip);
  return `${g[0]}:${g[1]}:${g[2]}::`;
}

/**
 * Best-effort client IP. Relies solely on Express's `req.ip`, which honours the
 * app's `trust proxy` setting; client-supplied headers are never read directly.
 */
export function clientIp(req: Request): string | undefined {
  return normalizeIp(req.ip) ?? normalizeIp(req.socket?.remoteAddress);
}

export function loggableIp(ip: string | undefined, mode: IpMode): string | undefined {
  if (!ip || mode === 'none') return undefined;
  return mode === 'anonymized' ? anonymizeIp(ip) : ip;
}

export function pathOf(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

/** Route *pattern* (e.g. `/users/:id`), never the raw URL, so IDs/tokens in paths are not logged. */
export function routeLabel(req: Request): string {
  const route = (req.route as { path?: unknown } | undefined)?.path;
  if (typeof route === 'string') {
    const base = req.baseUrl ?? '';
    return sanitizeString(route === '/' && base ? base : base + route, 200);
  }
  return route === undefined ? '(unmatched)' : '(pattern)';
}

export function parseContentLength(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Default authenticated-user lookup: `req.user.uid|id`, `req.auth.userId|uid`. IDs only, never tokens. */
export function defaultGetUserId(req: Request): string | undefined {
  const r = req as unknown as {
    user?: { uid?: unknown; id?: unknown };
    auth?: { userId?: unknown; uid?: unknown };
  };
  const v = r.user?.uid ?? r.user?.id ?? r.auth?.userId ?? r.auth?.uid;
  if (typeof v === 'string' && v.length > 0) return sanitizeString(v, 128);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}
