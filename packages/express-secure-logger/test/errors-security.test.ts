import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createErrorHandler, createRequestLogger, createSecurityLogger, logError, rateLimitHandler, type ErrorHandlerOptions,
} from '../src';
import { captureLogger, expectNoSecrets, sleep, SYNTH, waitFor, type Capture } from './helpers';

function build(cap: Capture, routes: (app: Express, sec: ReturnType<typeof createSecurityLogger>) => void, eh: ErrorHandlerOptions = {}) {
  const app = express();
  const sec = createSecurityLogger(cap.logger, { ipMode: cap.config.ipMode });
  app.use(createRequestLogger({ logger: cap.logger, config: cap.config }));
  app.use(express.json());
  routes(app, sec);
  app.use(createErrorHandler({ ...eh, security: eh.security ?? sec }));
  return app;
}
const errs = (cap: Capture) => cap.records().filter((r) => r.event === 'request_error');
const sec = (cap: Capture) => cap.records().filter((r) => r.event === 'security');

describe('error handler', () => {
  it('logs unexpected errors with a stack but returns a safe generic body', async () => {
    const cap = captureLogger();
    const app = build(cap, (a) => a.get('/x', () => { throw new Error(`pg: relation users failed; Bearer ${SYNTH.bearer}`); }));
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error', requestId: res.headers['x-request-id'] } });
    expect(JSON.stringify(res.body)).not.toMatch(/pg:|relation|stack/);
    const [e] = errs(cap);
    expect(e).toMatchObject({ level: 'error', expected: false, statusCode: 500, route: '/x', requestId: res.headers['x-request-id'] });
    expect(e!.err.stack).toContain('at ');
    expectNoSecrets(cap.text());
  });
  it('treats 4xx as expected: warn level, no stack, exposes only opted-in messages', async () => {
    const cap = captureLogger();
    const app = build(cap, (a) => {
      a.get('/exposed', () => { throw Object.assign(new Error('Email is invalid'), { statusCode: 400, expose: true }); });
      a.get('/hidden', () => { throw Object.assign(new Error('internal zod path details'), { statusCode: 422 }); });
    });
    const exposed = await request(app).get('/exposed');
    const hidden = await request(app).get('/hidden');
    expect(exposed.body.error).toMatchObject({ code: 'BAD_REQUEST', message: 'Email is invalid' });
    expect(hidden.body.error).toMatchObject({ code: 'UNPROCESSABLE_ENTITY', message: 'Unprocessable Entity' });
    expect(errs(cap).every((r) => r.level === 'warn' && r.expected === true && r.err.stack === undefined)).toBe(true);
    expect(errs(cap)).toHaveLength(2);
  });
  it('handles malformed JSON as an expected 400', async () => {
    const cap = captureLogger();
    const app = build(cap, (a) => a.post('/j', (_req, res) => { res.json({}); }));
    const res = await request(app).post('/j').set('Content-Type', 'application/json').send('{"password": "SYNTH-PASSWORD-hunter2"');
    expect(res.status).toBe(400);
    expect(errs(cap)[0]).toMatchObject({ level: 'warn', expected: true });
    expectNoSecrets(cap.text());
  });
  it('supports classify() for application error types', async () => {
    class NotFoundError extends Error {}
    const cap = captureLogger();
    const app = build(cap, (a) => a.get('/nf', () => { throw new NotFoundError('row 17 missing'); }), {
      classify: (e) => (e instanceof NotFoundError ? { status: 404, code: 'NOT_FOUND', publicMessage: 'Resource not found' } : undefined),
    });
    const res = await request(app).get('/nf');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Resource not found' });
    expect(errs(cap)[0]).toMatchObject({ level: 'warn', expected: true });
  });
  it('never logs the same error twice across controller, asyncHandler-style wrapper and global handler', async () => {
    const cap = captureLogger();
    const app = build(cap, (a) => a.get('/dup', (req, _res, next) => {
      const err = new Error('once only');
      logError(req, err);
      Promise.reject(err).catch(next);
    }));
    await request(app).get('/dup');
    expect(errs(cap)).toHaveLength(1);
  });
  it('survives logger failures and still responds', async () => {
    const cap = captureLogger();
    const broken = { info() { throw new Error('x'); }, warn() { throw new Error('x'); }, error() { throw new Error('x'); } };
    const app = express();
    app.use((req, _res, next) => { req.id = 'rid-12345678'; req.log = broken as never; next(); });
    app.get('/x', () => { throw new Error('boom'); });
    app.use(createErrorHandler({ logger: cap.logger }));
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.body.error.requestId).toBe('rid-12345678');
  });
  it('drops the connection instead of corrupting a response whose headers were already sent', async () => {
    const cap = captureLogger();
    const app = build(cap, (a) => a.get('/partial', (_req, res) => { res.write('partial'); setTimeout(() => res.emit('error', new Error('late failure')), 5); throw new Error('mid-stream'); }));
    await request(app).get('/partial').catch(() => undefined);
    await sleep(50);
    expect(errs(cap)).toHaveLength(1);
  });
});

describe('security events', () => {
  it('records structured events with request context and never credentials', async () => {
    const cap = captureLogger();
    const app = build(cap, (a, s) => a.post('/login', (req, res) => {
      s.invalidCredentials(req, { reason: 'bad_password', details: { email_domain: 'example.com', password: req.body.password, token: SYNTH.jwt } });
      res.status(401).json({});
    }));
    const res = await request(app).post('/login').send({ password: SYNTH.password }).set('Authorization', `Bearer ${SYNTH.bearer}`);
    await waitFor(() => cap.records().some((r) => r.event === 'http_request'));
    const [e] = sec(cap);
    expect(e).toMatchObject({
      level: 'warn', securityEvent: 'invalid_credentials', outcome: 'failure', requestId: res.headers['x-request-id'], route: '/login', method: 'POST', reason: 'bad_password',
    });
    expect(e!.details).toEqual({ email_domain: 'example.com', password: '[REDACTED]', token: '[REDACTED]' });
    expectNoSecrets(cap.text());
  });
  it('correlates with the HTTP completion log instead of duplicating it', async () => {
    const cap = captureLogger();
    const app = build(cap, (a, s) => a.get('/forbidden', (req, res) => { s.forbidden(req); res.status(403).json({}); }));
    await request(app).get('/forbidden');
    await waitFor(() => cap.records().some((r) => r.event === 'http_request'));
    expect(cap.records().find((r) => r.event === 'http_request')!.securityEvents).toEqual(['forbidden']);
    expect(sec(cap)).toHaveLength(1);
  });
  it('error handler records 401/403 once, and not at all if already recorded', async () => {
    const cap = captureLogger();
    const app = build(cap, (a, s) => {
      a.get('/auto', () => { throw Object.assign(new Error('nope'), { statusCode: 401 }); });
      a.get('/manual', (req) => { s.unauthorized(req, { reason: 'manual' }); throw Object.assign(new Error('nope'), { statusCode: 401 }); });
    });
    await request(app).get('/auto');
    await request(app).get('/manual');
    expect(sec(cap).map((e) => [e.route, e.reason])).toEqual([['/auto', 'error_handler'], ['/manual', 'manual']]);
  });
  it('validation failures log field names only', async () => {
    const cap = captureLogger();
    const app = build(cap, (a, s) => a.post('/v', (req, res) => { s.validationFailed(req, ['email', 'password']); res.status(422).json({}); }));
    await request(app).post('/v').send({ email: 'not-an-email', password: SYNTH.password });
    expect(sec(cap)[0]!.details).toEqual({ fields: ['email', 'password'] });
    expectNoSecrets(cap.text());
  });
  it('rate limit handler logs a blocked event and returns a safe 429', async () => {
    const cap = captureLogger();
    const app = build(cap, (a, s) => a.get('/rl', rateLimitHandler(s)));
    const res = await request(app).get('/rl');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(sec(cap)[0]).toMatchObject({ securityEvent: 'rate_limited', outcome: 'blocked' });
  });
  it('works without a request (e.g. background jobs) and records anonymized IPs when configured', async () => {
    const cap = captureLogger({ ipMode: 'anonymized' });
    const s = createSecurityLogger(cap.logger, { ipMode: 'anonymized' });
    s.accountSuspended(undefined, { userId: 'u-9', reason: 'admin_action' });
    expect(sec(cap)[0]).toMatchObject({ securityEvent: 'account_suspended', userId: 'u-9', outcome: 'success', level: 'info' });
    expect(sec(cap)[0]!.requestId).toBeUndefined();
  });
});
