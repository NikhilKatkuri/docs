import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createErrorHandler, createRequestLogger, getRequestId, type RequestLoggerOptions } from '../src';
import { captureLogger, expectNoSecrets, sleep, SYNTH, waitFor, type Capture } from './helpers';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };

function makeApp(cap: Capture, opts: Partial<RequestLoggerOptions> = {}, trustProxy: unknown = false): Express {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(createRequestLogger({ logger: cap.logger, config: cap.config, ...opts }));
  app.use(express.json());
  app.get('/ok', (req, res) => { req.log.info('inside handler'); res.json({ id: req.id, als: getRequestId() }); });
  app.get('/users/:id', (_req, res) => { res.json({ ok: true }); });
  app.post('/orders', (_req, res) => { res.status(201).json({ ok: true }); });
  app.get('/slowish', async (_req, res) => { await sleep(50); res.send('done'); });
  app.get('/missing-user', (_req, res) => { res.status(404).json({}); });
  app.get('/timeout', (_req, res) => { res.locals.requestTimedOut = true; res.status(503).end(); });
  app.get('/gateway', (_req, res) => { res.status(504).end(); });
  app.get('/health', (_req, res) => { res.json({ up: true }); });
  app.get('/health/deep', (_req, res) => { res.status(500).json({ up: false }); });
  app.get('/ping', (_req, res) => { res.send('pong'); });
  app.get('/boom', asyncHandler(async () => { throw new Error('kaboom'); }));
  app.get('/authed', (req, res) => { (req as unknown as { user: unknown }).user = { uid: 'user-42' }; res.json({}); });
  app.use(createErrorHandler());
  return app;
}
const completions = (cap: Capture) => cap.records().filter((r) => r.event === 'http_request');

describe('request logging: success and failure', () => {
  it('logs one completion record with all expected fields', async () => {
    const cap = captureLogger();
    const res = await request(makeApp(cap)).get('/ok').set('User-Agent', 'vitest-agent');
    expect(res.status).toBe(200);
    await waitFor(() => completions(cap).length === 1);
    const r = completions(cap)[0]!;
    expect(r).toMatchObject({
      level: 'info', method: 'GET', route: '/ok', statusCode: 200, outcome: 'success', userAgent: 'vitest-agent', msg: 'request completed',
    });
    expect(typeof r.durationMs).toBe('number');
    expect(r.responseContentLength).toBeGreaterThan(0);
    expect(r.requestId).toBe(res.body.id);
    expect(new Date(r.time).getTime()).toBeGreaterThan(0);
  });
  it('classifies client errors, server errors and timeouts', async () => {
    const cap = captureLogger();
    const app = makeApp(cap);
    await request(app).get('/missing-user');
    await request(app).get('/boom');
    await request(app).get('/timeout');
    await request(app).get('/gateway');
    await waitFor(() => completions(cap).length === 4);
    const by = Object.fromEntries(completions(cap).map((r) => [r.route, r]));
    expect(by['/missing-user']).toMatchObject({ outcome: 'client_error', level: 'warn', statusCode: 404 });
    expect(by['/boom']).toMatchObject({ outcome: 'server_error', level: 'error', statusCode: 500 });
    expect(by['/timeout']).toMatchObject({ outcome: 'timeout', level: 'warn' });
    expect(by['/gateway']).toMatchObject({ outcome: 'timeout' });
  });
  it('measures duration with a monotonic timer', async () => {
    const cap = captureLogger();
    await request(makeApp(cap)).get('/slowish');
    await waitFor(() => completions(cap).length === 1);
    const d = completions(cap)[0]!.durationMs as number;
    expect(d).toBeGreaterThanOrEqual(45);
    expect(d).toBeLessThan(1000);
  });
  it('records the authenticated user ID only', async () => {
    const cap = captureLogger();
    await request(makeApp(cap)).get('/authed');
    await waitFor(() => completions(cap).length === 1);
    expect(completions(cap)[0]!.userId).toBe('user-42');
  });
  it('logs the request-content-length and survives missing optional metadata', async () => {
    const cap = captureLogger();
    await request(makeApp(cap)).post('/orders').unset('User-Agent').send({ a: 1 });
    await waitFor(() => completions(cap).length === 1);
    const r = completions(cap)[0]!;
    expect(r.requestContentLength).toBeGreaterThan(0);
    expect(r.userAgent).toBeUndefined();
    expect(r.userId).toBeUndefined();
    expect(r.geo).toBeUndefined();
  });
});

describe('request ID propagation', () => {
  it('accepts a valid incoming ID, echoes it, and binds it to req.log and AsyncLocalStorage', async () => {
    const cap = captureLogger();
    const res = await request(makeApp(cap)).get('/ok').set('X-Request-Id', 'client-req-12345');
    expect(res.headers['x-request-id']).toBe('client-req-12345');
    expect(res.body).toMatchObject({ id: 'client-req-12345', als: 'client-req-12345' });
    await waitFor(() => completions(cap).length === 1);
    const ids = cap.records().filter((r) => ['inside handler', 'request completed'].includes(r.msg)).map((r) => r.requestId);
    expect(ids).toEqual(['client-req-12345', 'client-req-12345']);
  });
  it('replaces malformed incoming IDs with a generated UUID', async () => {
    const cap = captureLogger();
    const res = await request(makeApp(cap)).get('/ok').set('X-Request-Id', 'bad id with spaces & <script>');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('ignores incoming IDs when trust is disabled', async () => {
    const cap = captureLogger({ trustRequestIdHeader: false });
    const res = await request(makeApp(cap)).get('/ok').set('X-Request-Id', 'client-req-12345');
    expect(res.headers['x-request-id']).not.toBe('client-req-12345');
  });
});

describe('client IP and proxy trust', () => {
  it('ignores X-Forwarded-For when trust proxy is off, and warns once', async () => {
    const cap = captureLogger();
    const app = makeApp(cap, {}, false);
    await request(app).get('/ok').set('X-Forwarded-For', '203.0.113.9');
    await request(app).get('/ok').set('X-Forwarded-For', '203.0.113.9');
    await waitFor(() => completions(cap).length === 2);
    expect(completions(cap).every((r) => r.ip !== '203.0.113.9')).toBe(true);
    expect(cap.records().filter((r) => r.event === 'config_warning')).toHaveLength(1);
  });
  it('uses the forwarded client IP when proxy trust is configured (IPv4 and IPv6)', async () => {
    const cap = captureLogger();
    const app = makeApp(cap, {}, 1);
    await request(app).get('/ok').set('X-Forwarded-For', '203.0.113.9');
    await request(app).get('/ok').set('X-Forwarded-For', '2606:4700:4700::1111');
    await waitFor(() => completions(cap).length === 2);
    expect(completions(cap).map((r) => r.ip)).toEqual(['203.0.113.9', '2606:4700:4700::1111']);
    expect(cap.records().some((r) => r.event === 'config_warning')).toBe(false);
  });
  it('rejects garbage forwarded values and falls back to the socket address', async () => {
    const cap = captureLogger();
    await request(makeApp(cap, {}, 1)).get('/ok').set('X-Forwarded-For', 'drop table; <b>');
    await waitFor(() => completions(cap).length === 1);
    expect(completions(cap)[0]!.ip).toMatch(/^(127\.0\.0\.1|::1)$/);
  });
  it('supports anonymized and disabled IP logging', async () => {
    const anon = captureLogger({ ipMode: 'anonymized' });
    await request(makeApp(anon, {}, 1)).get('/ok').set('X-Forwarded-For', '203.0.113.9');
    const none = captureLogger({ ipMode: 'none' });
    await request(makeApp(none, {}, 1)).get('/ok').set('X-Forwarded-For', '203.0.113.9');
    await waitFor(() => completions(anon).length === 1 && completions(none).length === 1);
    expect(completions(anon)[0]!.ip).toBe('203.0.113.0');
    expect(completions(none)[0]!.ip).toBeUndefined();
    expect(none.text()).not.toContain('203.0.113.9');
  });
});

describe('privacy: headers, query strings, bodies, paths', () => {
  it('never logs credentials, cookies, raw query strings or bodies by default', async () => {
    const cap = captureLogger();
    await request(makeApp(cap))
      .post(`/orders?token=${SYNTH.queryToken}&page=2`)
      .set('Authorization', `Bearer ${SYNTH.bearer}`)
      .set('Cookie', `session=${SYNTH.cookie}`)
      .send({ password: SYNTH.password, idToken: SYNTH.jwt, apiKey: SYNTH.apiKey });
    await waitFor(() => completions(cap).length === 1);
    expectNoSecrets(cap.text());
    const r = completions(cap)[0]!;
    expect(r.query).toBeUndefined();
    expect(r.body).toBeUndefined();
  });
  it('logs only allowlisted, sanitized query params when configured', async () => {
    const cap = captureLogger({ queryAllowlist: ['page', 'token'] });
    await request(makeApp(cap)).get(`/ok?page=2&token=${SYNTH.queryToken}&secret=${SYNTH.password}`);
    await waitFor(() => completions(cap).length === 1);
    expect(completions(cap)[0]!.query).toEqual({ page: '2', token: '[REDACTED]' });
    expectNoSecrets(cap.text());
  });
  it('logs a route pattern, not IDs from the path; unmatched paths are not echoed', async () => {
    const cap = captureLogger();
    const app = makeApp(cap);
    await request(app).get('/users/987654321');
    await request(app).get(`/reset/${SYNTH.queryToken}`);
    await waitFor(() => completions(cap).length === 2);
    expect(completions(cap).map((r) => r.route)).toEqual(['/users/:id', '(unmatched)']);
    expect(cap.text()).not.toContain('987654321');
    expectNoSecrets(cap.text());
  });
  it('logs bodies only for explicitly allowlisted routes, redacting recursively', async () => {
    const cap = captureLogger();
    const app = makeApp(cap, { logBody: { 'POST /orders': ['item', 'password'] } });
    await request(app).post('/orders').send({ item: 'book', password: SYNTH.password, extra: 'DROP-ME' });
    await waitFor(() => completions(cap).length === 1);
    expect(completions(cap)[0]!.body).toEqual({ item: 'book', password: '[REDACTED]' });
    expect(cap.text()).not.toContain('DROP-ME');
    expectNoSecrets(cap.text());
  });
  it('truncates oversized user agents', async () => {
    const cap = captureLogger();
    await request(makeApp(cap)).get('/ok').set('User-Agent', 'A'.repeat(4000));
    await waitFor(() => completions(cap).length === 1);
    expect((completions(cap)[0]!.userAgent as string).length).toBeLessThan(330);
  });
});

describe('quiet and ignored routes', () => {
  it('logs successful health checks at trace, failures at normal levels, and skips ignored paths', async () => {
    const cap = captureLogger({ ignorePaths: ['/ping'] });
    const app = makeApp(cap);
    await request(app).get('/health');
    await request(app).get('/health/deep');
    await request(app).get('/ping');
    await waitFor(() => completions(cap).length === 2);
    await sleep(30);
    const [ok, fail] = completions(cap);
    expect(ok).toMatchObject({ route: '/health', level: 'trace' });
    expect(fail).toMatchObject({ route: '/health/deep', level: 'error' });
    expect(completions(cap)).toHaveLength(2);
  });
});

describe('aborted requests and duplicate prevention', () => {
  it('logs a client abort exactly once with outcome "aborted"', async () => {
    const cap = captureLogger();
    const app = express();
    app.use(createRequestLogger({ logger: cap.logger, config: cap.config }));
    app.get('/slow', (_req, res) => { setTimeout(() => { try { res.send('late'); } catch { /* socket gone */ } }, 200); });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((resolve) => {
      const r = http.get({ port, path: '/slow' });
      r.on('error', () => undefined);
      setTimeout(() => { r.destroy(); resolve(); }, 40);
    });
    await waitFor(() => completions(cap).length >= 1);
    await sleep(300);
    server.close();
    expect(completions(cap)).toHaveLength(1);
    expect(completions(cap)[0]).toMatchObject({ outcome: 'aborted', level: 'warn', statusCode: null, msg: 'request aborted by client' });
  });
  it('emits a single record for a normal finish followed by close', async () => {
    const cap = captureLogger();
    await request(makeApp(cap)).get('/ok');
    await sleep(50);
    expect(completions(cap)).toHaveLength(1);
  });
});

describe('geolocation', () => {
  const place = { country: 'Testland', region: 'TS', city: 'Testville' };
  const geoCfg = (over = {}) => ({ geo: { enabled: true, cacheSize: 100, ttlMs: 60_000, timeoutMs: 30, ...over } });

  it('adds approximate location when enabled, and caches lookups', async () => {
    const provider = vi.fn(() => place);
    const cap = captureLogger(geoCfg());
    const app = makeApp(cap, { geoProvider: provider }, 1);
    await request(app).get('/ok').set('X-Forwarded-For', '198.51.100.7');
    await request(app).get('/ok').set('X-Forwarded-For', '198.51.100.7');
    await waitFor(() => completions(cap).length === 2);
    expect(completions(cap)[0]!.geo).toEqual({ ...place, approximate: true });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('does nothing when disabled', async () => {
    const provider = vi.fn(() => place);
    const cap = captureLogger();
    await request(makeApp(cap, { geoProvider: provider }, 1)).get('/ok').set('X-Forwarded-For', '198.51.100.7');
    await waitFor(() => completions(cap).length === 1);
    expect(provider).not.toHaveBeenCalled();
    expect(completions(cap)[0]!.geo).toBeUndefined();
  });
  it('fails clearly when enabled without a provider', () => {
    const cap = captureLogger(geoCfg());
    expect(() => createRequestLogger({ logger: cap.logger, config: cap.config })).toThrow(/geoProvider/);
  });
  it('still logs the request when the provider fails or is too slow', async () => {
    const failing = captureLogger(geoCfg());
    await request(makeApp(failing, { geoProvider: () => { throw new Error('mmdb corrupt'); } }, 1)).get('/ok').set('X-Forwarded-For', '198.51.100.7');
    const slow = captureLogger(geoCfg());
    const started = Date.now();
    await request(makeApp(slow, { geoProvider: async () => { await sleep(300); return place; } }, 1)).get('/ok').set('X-Forwarded-For', '198.51.100.8');
    expect(Date.now() - started).toBeLessThan(250); // response was not delayed by geo
    await waitFor(() => completions(failing).length === 1 && completions(slow).length === 1);
    expect(completions(failing)[0]!.geo).toBeUndefined();
    expect(completions(slow)[0]!.geo).toBeUndefined();
  });
  it('skips private addresses', async () => {
    const provider = vi.fn(() => place);
    const cap = captureLogger(geoCfg());
    await request(makeApp(cap, { geoProvider: provider })).get('/ok');
    await waitFor(() => completions(cap).length === 1);
    expect(provider).not.toHaveBeenCalled();
  });
});

describe('log record shape', () => {
  it('never emits duplicate JSON keys (requestId is bound once via the child logger)', async () => {
    const cap = captureLogger();
    await request(makeApp(cap)).get('/boom');
    await waitFor(() => completions(cap).length === 1);
    for (const line of cap.lines) expect((line.match(/"requestId"/g) ?? []).length).toBe(1);
  });
});
