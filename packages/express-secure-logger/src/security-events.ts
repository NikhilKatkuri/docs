import type { Request, RequestHandler } from 'express';
import type { IpMode } from './config';
import { redactDeep, sanitizeString } from './redact';
import { clientIp, defaultGetUserId, loggableIp, routeLabel } from './request-info';
import type { AppLogger } from './types';

export type SecurityEventType =
  | 'sign_in'
  | 'sign_up'
  | 'invalid_credentials'
  | 'token_expired'
  | 'token_invalid'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'validation_failed'
  | 'account_deleted'
  | 'account_suspended'
  | 'authorization_failure';

export type SecurityOutcome = 'success' | 'failure' | 'blocked';

export interface SecurityEventInput {
  type: SecurityEventType;
  outcome: SecurityOutcome;
  /** Authenticated/affected user ID. Falls back to the request's user when omitted. */
  userId?: string | number;
  /** Short machine-readable reason code, e.g. `token_expired`. Never a raw error message. */
  reason?: string;
  /** Extra context; always passed through recursive redaction. Never put credentials here. */
  details?: Record<string, unknown>;
}

/** Event types already emitted per request, so the HTTP log can correlate and others can de-duplicate. */
const emitted = new WeakMap<object, string[]>();

export function getSecurityEventTypes(req: Request): readonly string[] | undefined {
  return emitted.get(req);
}

export function hasSecurityEvent(req: Request, type: SecurityEventType): boolean {
  return emitted.get(req)?.includes(type) ?? false;
}

type Shortcut = (req: Request | undefined, extra?: Partial<Omit<SecurityEventInput, 'type' | 'outcome'>>) => void;

export interface SecurityLogger {
  log(req: Request | undefined, input: SecurityEventInput): void;
  signIn(req: Request | undefined, outcome: SecurityOutcome, extra?: Partial<Omit<SecurityEventInput, 'type' | 'outcome'>>): void;
  signUp(req: Request | undefined, outcome: SecurityOutcome, extra?: Partial<Omit<SecurityEventInput, 'type' | 'outcome'>>): void;
  invalidCredentials: Shortcut;
  tokenExpired: Shortcut;
  tokenInvalid: Shortcut;
  unauthorized: Shortcut;
  forbidden: Shortcut;
  rateLimited: Shortcut;
  accountDeleted: Shortcut;
  accountSuspended: Shortcut;
  authorizationFailure: Shortcut;
  /** Logs only the *names* of the failing fields, never submitted values. */
  validationFailed(req: Request | undefined, fields: readonly string[]): void;
}

/**
 * Dedicated security-event logger. Events carry `event: "security"` plus the
 * `requestId`, so they correlate with the single HTTP completion log rather
 * than duplicating it. Credentials and payloads are never accepted.
 */
export function createSecurityLogger(logger: AppLogger, options: { ipMode?: IpMode } = {}): SecurityLogger {
  const ipMode = options.ipMode ?? 'full';

  const log = (req: Request | undefined, input: SecurityEventInput): void => {
    try {
      const userId =
        input.userId !== undefined ? sanitizeString(String(input.userId), 128) : req ? defaultGetUserId(req) : undefined;
      const ip = req ? loggableIp(clientIp(req), ipMode) : undefined;
      const entry = {
        event: 'security',
        securityEvent: input.type,
        outcome: input.outcome,
        // req.log already binds requestId; only add it when falling back to the root logger
        requestId: req && !req.log ? req.id : undefined,
        method: req?.method,
        route: req ? routeLabel(req) : undefined,
        userId,
        ip,
        reason: input.reason ? sanitizeString(input.reason, 100) : undefined,
        details: input.details ? redactDeep(input.details) : undefined,
      };
      const level = input.outcome === 'success' ? 'info' : 'warn';
      (req?.log ?? logger)[level](entry, `security: ${input.type} ${input.outcome}`);
      if (req) {
        const list = emitted.get(req) ?? [];
        if (list.length < 20) list.push(input.type);
        emitted.set(req, list);
      }
    } catch {
      /* security logging must never break request handling */
    }
  };

  const shortcut = (type: SecurityEventType, outcome: SecurityOutcome): Shortcut => (req, extra = {}) =>
    log(req, { type, outcome, ...extra });

  return {
    log,
    signIn: (req, outcome, extra = {}) => log(req, { type: 'sign_in', outcome, ...extra }),
    signUp: (req, outcome, extra = {}) => log(req, { type: 'sign_up', outcome, ...extra }),
    invalidCredentials: shortcut('invalid_credentials', 'failure'),
    tokenExpired: shortcut('token_expired', 'failure'),
    tokenInvalid: shortcut('token_invalid', 'failure'),
    unauthorized: shortcut('unauthorized', 'failure'),
    forbidden: shortcut('forbidden', 'failure'),
    rateLimited: shortcut('rate_limited', 'blocked'),
    accountDeleted: shortcut('account_deleted', 'success'),
    accountSuspended: shortcut('account_suspended', 'success'),
    authorizationFailure: shortcut('authorization_failure', 'failure'),
    validationFailed: (req, fields) =>
      log(req, {
        type: 'validation_failed',
        outcome: 'failure',
        details: { fields: fields.slice(0, 20).map((f) => sanitizeString(f, 100)) },
      }),
  };
}

/** Handler for express-rate-limit's `handler` option: logs the event and returns a safe 429. */
export function rateLimitHandler(security: SecurityLogger): RequestHandler {
  return (req, res) => {
    security.rateLimited(req);
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too Many Requests', requestId: req.id } });
  };
}
