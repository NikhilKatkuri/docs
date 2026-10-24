/**
 * Sanitisation primitives. Everything that reaches the logs from an untrusted
 * source (headers, paths, query values, error messages, ad-hoc objects) goes
 * through these functions.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const URL_USERINFO = /(\/\/)[^/\s:@]+:[^/\s@]+@/g;
const SECRET_PAIR =
  /\b(password|passwd|pwd|secret|token|access_token|refresh_token|id_token|api[_-]?key|apikey|auth|authorization|otp|code|signature|sig)=([^&\s"']+)/gi;

export const REDACTED = '[REDACTED]';

/** Keys whose values are never logged, matched case-insensitively as substrings (deliberately over-inclusive). */
const SENSITIVE_KEY =
  /pass|secret|token|authori[sz]ation|cookie|api[-_]?key|private[-_]?key|credential|otp|mfa|totp|session|jwt|bearer|signature|ssn|cvv|card/i;
const SENSITIVE_EXACT_KEY = /^(auth|key|pin)$/i;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key) || SENSITIVE_EXACT_KEY.test(key);
}

/** Masks credential-looking substrings (JWTs, Bearer/Basic values, URL userinfo, `token=...` pairs). */
export function scrubSecrets(value: string): string {
  return value
    .replace(JWT, '[REDACTED_JWT]')
    .replace(AUTH_SCHEME, '$1 [REDACTED]')
    .replace(URL_USERINFO, '$1[REDACTED]@')
    .replace(SECRET_PAIR, '$1=[REDACTED]');
}

export function escapeControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * Makes an untrusted string safe to log: scrubs secrets, escapes control
 * characters (log-injection / ANSI-escape defence) and truncates.
 */
export function sanitizeString(value: string, max = 500): string {
  const bounded = value.length > max * 4 ? value.slice(0, max * 4) : value;
  const cleaned = escapeControlChars(scrubSecrets(bounded));
  return cleaned.length > max ? `${cleaned.slice(0, max)}…[truncated]` : cleaned;
}

export interface RedactOptions {
  maxDepth?: number;
  maxKeys?: number;
  maxItems?: number;
  maxString?: number;
  /** Extra key names (exact, case-insensitive) to always redact. */
  extraSensitiveKeys?: readonly string[];
}

/**
 * Recursively copies `value` into a log-safe structure: redacts sensitive keys,
 * sanitises strings, breaks cycles, bounds depth/size and never throws.
 */
export function redactDeep(value: unknown, opts: RedactOptions = {}): unknown {
  const o = { maxDepth: 6, maxKeys: 50, maxItems: 50, maxString: 500, ...opts };
  const extra = new Set((opts.extraSensitiveKeys ?? []).map((k) => k.toLowerCase()));
  const seen = new WeakSet<object>();

  const walk = (v: unknown, depth: number): unknown => {
    switch (typeof v) {
      case 'string':
        return sanitizeString(v, o.maxString);
      case 'number':
        return Number.isFinite(v) ? v : String(v);
      case 'boolean':
      case 'undefined':
        return v;
      case 'bigint':
        return v.toString();
      case 'function':
        return '[Function]';
      case 'symbol':
        return '[Symbol]';
    }
    if (v === null) return null;
    const obj = v as object;
    if (seen.has(obj)) return '[Circular]';
    if (depth >= o.maxDepth) return '[MaxDepth]';
    seen.add(obj);
    try {
      if (obj instanceof Date) return Number.isNaN(obj.getTime()) ? 'Invalid Date' : obj.toISOString();
      if (obj instanceof Error) return serializeError(obj, { includeStack: false });
      if (ArrayBuffer.isView(obj)) return `[Binary ${obj.byteLength} bytes]`;
      if (obj instanceof ArrayBuffer) return `[Binary ${obj.byteLength} bytes]`;
      if (Array.isArray(obj)) {
        const out = obj.slice(0, o.maxItems).map((item) => walk(item, depth + 1));
        if (obj.length > o.maxItems) out.push(`[+${obj.length - o.maxItems} more]`);
        return out;
      }
      const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      const keys = Object.keys(obj);
      for (const key of keys.slice(0, o.maxKeys)) {
        const safeKey = sanitizeString(key, 100);
        if (isSensitiveKey(key) || extra.has(key.toLowerCase())) {
          out[safeKey] = REDACTED;
          continue;
        }
        try {
          out[safeKey] = walk((obj as Record<string, unknown>)[key], depth + 1);
        } catch {
          out[safeKey] = '[Unreadable]';
        }
      }
      if (keys.length > o.maxKeys) out['[truncated]'] = `+${keys.length - o.maxKeys} keys`;
      return out;
    } catch {
      return '[Unserializable]';
    } finally {
      seen.delete(obj); // only cycles (ancestors) are flagged; repeated siblings are fine
    }
  };

  try {
    return walk(value, 0);
  } catch {
    return '[Unserializable]';
  }
}

export interface SerializeErrorOptions {
  includeStack?: boolean;
  depth?: number;
}

/**
 * Whitelist-based error serializer. Only name, message, code, status, syscall,
 * stack frames and `cause` are emitted, so request/response/config objects that
 * libraries attach to errors (axios, fetch, DB drivers) can never leak.
 */
export function serializeError(err: unknown, opts: SerializeErrorOptions = {}): Record<string, unknown> {
  const { includeStack = true, depth = 0 } = opts;
  try {
    if (!(err instanceof Error)) {
      if (typeof err === 'string') return { type: 'NonError', message: sanitizeString(err, 500) };
      return { type: 'NonError', value: redactDeep(err) };
    }
    const out: Record<string, unknown> = {
      type: sanitizeString(String(err.name || err.constructor?.name || 'Error'), 100),
      message: sanitizeString(String(err.message ?? ''), 1000),
    };
    const e = err as unknown as Record<string, unknown>;
    for (const field of ['code', 'statusCode', 'status', 'syscall', 'errno'] as const) {
      try {
        const v = e[field];
        if (typeof v === 'number' && Number.isFinite(v)) out[field] = v;
        else if (typeof v === 'string') out[field] = sanitizeString(v, 100);
      } catch {
        /* ignore unreadable property */
      }
    }
    if (includeStack && typeof err.stack === 'string') {
      // Keep only frame lines: avoids re-emitting multi-line (injected) messages.
      out.stack = err.stack
        .split('\n')
        .filter((l) => /^\s+at\s/.test(l))
        .slice(0, 50)
        .map((l) => sanitizeString(l.trim(), 300))
        .join('\n');
    }
    if (err.cause !== undefined && depth < 3) {
      out.cause = serializeError(err.cause, { includeStack, depth: depth + 1 });
    }
    return out;
  } catch {
    return { type: 'SerializationFailure', message: 'failed to serialize error' };
  }
}

/** Headers that may be logged when header logging is explicitly requested. */
export const DEFAULT_HEADER_ALLOWLIST: readonly string[] = [
  'accept',
  'accept-language',
  'content-type',
  'content-length',
  'user-agent',
  'x-request-id',
];

/**
 * Allowlist-based header sanitiser. Sensitive header names are redacted even if
 * someone adds them to the allowlist; everything not allowlisted is dropped.
 */
export function safeHeaders(
  headers: Record<string, unknown> | undefined,
  allow: readonly string[] = DEFAULT_HEADER_ALLOWLIST,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  const allowed = new Set(allow.map((h) => h.toLowerCase()));
  for (const [name, raw] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (!allowed.has(lower)) continue;
    if (isSensitiveKey(lower)) {
      out[lower] = REDACTED;
      continue;
    }
    const v = Array.isArray(raw) ? raw.join(', ') : String(raw ?? '');
    out[lower] = sanitizeString(v, 300);
  }
  return out;
}

/** Picks only allowlisted (dotted) paths from a body, then redacts recursively. */
export function pickAllowlisted(source: unknown, paths: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof source !== 'object' || source === null) return out;
  for (const path of paths) {
    const segments = path.split('.');
    let cur: unknown = source;
    for (const s of segments) {
      if (typeof cur !== 'object' || cur === null || !Object.prototype.hasOwnProperty.call(cur, s)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[s];
    }
    if (cur === undefined) continue;
    out[sanitizeString(path, 100)] = isSensitiveKey(segments[segments.length - 1] ?? '')
      ? REDACTED
      : redactDeep(cur);
  }
  return out;
}

/** Returns only allowlisted query parameters with sanitised, truncated values. */
export function sanitizeQuery(query: unknown, allowlist: readonly string[]): Record<string, unknown> | undefined {
  if (typeof query !== 'object' || query === null || allowlist.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of allowlist) {
    if (!Object.prototype.hasOwnProperty.call(query, key)) continue;
    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    const raw = (query as Record<string, unknown>)[key];
    const first = Array.isArray(raw) ? raw.slice(0, 5) : raw;
    if (typeof first === 'string') out[key] = sanitizeString(first, 100);
    else if (Array.isArray(first)) out[key] = first.filter((x) => typeof x === 'string').map((x) => sanitizeString(x as string, 100));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
