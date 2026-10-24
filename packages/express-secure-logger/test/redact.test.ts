import { describe, expect, it } from 'vitest';
import { pickAllowlisted, redactDeep, safeHeaders, sanitizeQuery, sanitizeString, serializeError } from '../src';
import { SYNTH } from './helpers';

describe('sanitizeString', () => {
  it('escapes control characters and ANSI/newline injection', () => {
    const out = sanitizeString('ok\n{"level":"fatal","msg":"forged"}\u001b[31mred\r\u2028');
    // eslint-disable-next-line no-control-regex
    expect(out).not.toMatch(/[\n\r\u001b\u2028]/);
    expect(out).toContain('\\u000a');
    expect(out).toContain('\\u001b');
  });
  it('truncates long values', () => {
    const out = sanitizeString('a'.repeat(5000), 100);
    expect(out.length).toBeLessThan(130);
    expect(out).toContain('[truncated]');
  });
  it('scrubs JWTs, bearer values, userinfo and token pairs', () => {
    const out = sanitizeString(
      `Bearer ${SYNTH.bearer} ${SYNTH.jwt} https://u:${SYNTH.password}@host/?token=${SYNTH.queryToken}&page=1`,
    );
    for (const v of [SYNTH.bearer, SYNTH.jwt, SYNTH.password, SYNTH.queryToken]) expect(out).not.toContain(v);
    expect(out).toContain('page=1');
  });
});

describe('redactDeep', () => {
  it('redacts sensitive keys recursively and case-insensitively', () => {
    const out = redactDeep({
      user: 'a', Password: SYNTH.password, nested: { refreshToken: SYNTH.jwt, list: [{ apiKey: SYNTH.apiKey, ok: 1 }] },
      headers: { Authorization: SYNTH.bearer, Cookie: SYNTH.cookie },
    });
    const text = JSON.stringify(out);
    for (const v of [SYNTH.password, SYNTH.jwt, SYNTH.apiKey, SYNTH.bearer, SYNTH.cookie]) expect(text).not.toContain(v);
    expect(text).toContain('"ok":1');
  });
  it('handles circular references, throwing getters, bigint and binary', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a.self = a;
    Object.defineProperty(a, 'boom', { enumerable: true, get() { throw new Error('nope'); } });
    a.big = 10n;
    a.buf = Buffer.from('secret-bytes');
    const out = redactDeep(a) as Record<string, unknown>;
    expect(out.self).toBe('[Circular]');
    expect(out.boom).toBe('[Unreadable]');
    expect(out.big).toBe('10');
    expect(out.buf).toBe('[Binary 12 bytes]');
    expect(() => JSON.stringify(out)).not.toThrow();
  });
  it('bounds depth and size', () => {
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 20; i++) { deep.n = {}; deep = deep.n as Record<string, unknown>; }
    expect(JSON.stringify(redactDeep(root))).toContain('[MaxDepth]');
    expect((redactDeep(Array.from({ length: 500 }, (_, i) => i)) as unknown[]).length).toBe(51);
  });
});

describe('serializeError', () => {
  it('whitelists fields and never leaks attached request/config objects', () => {
    const err = Object.assign(new Error(`failed with Bearer ${SYNTH.bearer}`), {
      code: 'E_FAIL',
      config: { headers: { Authorization: SYNTH.bearer } },
      request: { headers: { cookie: SYNTH.cookie } },
      cause: new TypeError('inner'),
    });
    const out = serializeError(err);
    const text = JSON.stringify(out);
    expect(text).not.toContain(SYNTH.bearer);
    expect(text).not.toContain(SYNTH.cookie);
    expect(out.code).toBe('E_FAIL');
    expect(String(out.stack)).toContain('at ');
    expect((out.cause as Record<string, unknown>).type).toBe('TypeError');
    expect(out.config).toBeUndefined();
  });
  it('does not emit injected newlines from messages via the stack', () => {
    const out = serializeError(new Error('line1\nFORGED LINE at evil'));
    expect(String(out.message)).not.toContain('\n');
    expect(String(out.stack)).not.toContain('FORGED');
  });
  it('handles non-Error throwables', () => {
    expect(serializeError('just a string').type).toBe('NonError');
    expect(JSON.stringify(serializeError({ password: SYNTH.password }))).not.toContain(SYNTH.password);
  });
});

describe('headers, query, body helpers', () => {
  it('drops non-allowlisted headers and redacts sensitive ones even if allowlisted', () => {
    const out = safeHeaders(
      { authorization: SYNTH.bearer, cookie: SYNTH.cookie, 'set-cookie': [SYNTH.cookie], 'user-agent': 'ua', accept: '*/*' },
      ['user-agent', 'authorization', 'cookie'],
    );
    expect(out).toEqual({ 'user-agent': 'ua', authorization: '[REDACTED]', cookie: '[REDACTED]' });
  });
  it('only returns allowlisted query params', () => {
    const q = { page: '2', token: SYNTH.queryToken, other: 'x' };
    expect(sanitizeQuery(q, ['page'])).toEqual({ page: '2' });
    expect(sanitizeQuery(q, ['token'])).toEqual({ token: '[REDACTED]' });
    expect(sanitizeQuery(q, [])).toBeUndefined();
  });
  it('picks only allowlisted dotted body paths', () => {
    const body = { item: 'a', address: { city: 'X', secretNote: 'n' }, password: SYNTH.password, extra: 'drop' };
    expect(pickAllowlisted(body, ['item', 'address.city', 'password', 'missing'])).toEqual({
      item: 'a', 'address.city': 'X', password: '[REDACTED]',
    });
  });
});
