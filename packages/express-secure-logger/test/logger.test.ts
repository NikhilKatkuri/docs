import { describe, expect, it } from 'vitest';
import { createLogger, flushLogger, getLogger, loadLoggerConfig } from '../src';
import { captureLogger, expectNoSecrets, SYNTH } from './helpers';

describe('createLogger', () => {
  it('emits JSON with timestamp, service metadata and level labels', () => {
    const cap = captureLogger({ serviceVersion: '9.9.9' });
    cap.logger.info('hello');
    const [r] = cap.records();
    expect(r).toMatchObject({ level: 'info', msg: 'hello', service: 'test-app', env: 'production', version: '9.9.9' });
    expect(new Date(r!.time).toISOString()).toBe(r!.time);
  });
  it('supports all levels and honours the configured level', () => {
    const cap = captureLogger();
    for (const l of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) cap.logger[l](l);
    expect(cap.records().map((r) => r.level)).toEqual(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
    const warnOnly = captureLogger({}, { LOG_LEVEL: 'warn' });
    warnOnly.logger.info('x'); warnOnly.logger.warn('y');
    expect(warnOnly.records().map((r) => r.msg)).toEqual(['y']);
  });
  it('serializes errors with stack traces server-side and no attached secrets', () => {
    const cap = captureLogger();
    const err = Object.assign(new Error('db exploded'), { config: { auth: SYNTH.bearer } });
    cap.logger.error({ err }, 'failed');
    const r = cap.records()[0]!;
    expect(r.err.type).toBe('Error');
    expect(r.err.stack).toContain('at ');
    expectNoSecrets(cap.text());
  });
  it('redacts sensitive fields in ad-hoc objects (defence in depth)', () => {
    const cap = captureLogger();
    cap.logger.info({ password: SYNTH.password, user: { token: SYNTH.jwt }, headers: { authorization: SYNTH.bearer, cookie: SYNTH.cookie } }, 'x');
    expectNoSecrets(cap.text());
  });
  it('does not throw on circular structures', () => {
    const cap = captureLogger();
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => cap.logger.info({ a }, 'circ')).not.toThrow();
    expect(cap.records()).toHaveLength(1);
  });
  it('works with minimal config (no version) and child loggers inherit context', () => {
    const cap = captureLogger();
    delete (cap.config as { serviceVersion?: string }).serviceVersion;
    cap.logger.child({ requestId: 'r-1' }).info('child');
    const r = cap.records()[0]!;
    expect(r.requestId).toBe('r-1');
    expect(r.version).toBeUndefined();
  });
  it('flushLogger resolves, and getLogger falls back outside a request', async () => {
    const cap = captureLogger();
    await expect(flushLogger(cap.logger)).resolves.toBeUndefined();
    expect(getLogger(cap.logger)).toBe(cap.logger);
  });
  it('falls back to JSON when pretty is requested without a destination', () => {
    const config = loadLoggerConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', LOG_PRETTY: 'true' });
    expect(() => createLogger(config)).not.toThrow();
  });
});
