import type { Request, RequestHandler, Response } from 'express';
import type { LoggerConfig } from './config';
import { runWithRequestContext } from './context';
import { GeoResolver, type GeoLocation, type GeoProvider } from './geo';
import { pickAllowlisted, redactDeep, sanitizeQuery, sanitizeString } from './redact';
import { resolveRequestId } from './request-id';
import {
  clientIp,
  defaultGetUserId,
  loggableIp,
  parseContentLength,
  pathOf,
  routeLabel,
} from './request-info';
import { getSecurityEventTypes } from './security-events';
import type { AppLogger, RequestOutcome } from './types';

export interface RequestLoggerOptions {
  logger: AppLogger;
  config: LoggerConfig;
  /** Required when `config.geo.enabled` is true. Use a local GeoIP DB adapter. */
  geoProvider?: GeoProvider;
  /** Override how the authenticated user ID is read. Must return an ID only, never a credential. */
  getUserId?: (req: Request) => string | number | undefined;
  /** Explicit opt-in body logging: `{ 'POST /orders': ['item', 'qty'] }` (route pattern -> allowlisted fields). */
  logBody?: Record<string, readonly string[]>;
  /** Response header carrying the request ID. Default `x-request-id`. */
  requestIdHeader?: string;
  /** Custom timeout detection. Default: status 408/504 or `res.locals.requestTimedOut === true`. */
  isTimeout?: (req: Request, res: Response) => boolean;
}

function matches(path: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`));
}

function outcomeFor(status: number, timedOut: boolean): RequestOutcome {
  if (timedOut) return 'timeout';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  return 'success';
}

/**
 * Request logging middleware. Mount it FIRST (after `app.set('trust proxy', ...)`),
 * before body parsers, rate limiters and auth, so rejected requests are logged
 * and `req.id` / `req.log` exist everywhere downstream.
 *
 * Emits exactly one completion log per request, when the response finishes, is
 * aborted by the client, or errors.
 */
export function createRequestLogger(options: RequestLoggerOptions): RequestHandler {
  const { logger, config } = options;
  if (config.geo.enabled && !options.geoProvider) {
    throw new Error('LOG_GEO_ENABLED is true but no geoProvider was supplied to createRequestLogger()');
  }
  const geo =
    config.geo.enabled && options.geoProvider
      ? new GeoResolver({
          provider: options.geoProvider,
          cacheSize: config.geo.cacheSize,
          ttlMs: config.geo.ttlMs,
          timeoutMs: config.geo.timeoutMs,
        })
      : undefined;
  const header = (options.requestIdHeader ?? 'x-request-id').toLowerCase();
  const getUserId = options.getUserId ?? defaultGetUserId;
  const isTimeout =
    options.isTimeout ??
    ((_req: Request, res: Response) =>
      res.statusCode === 408 || res.statusCode === 504 || res.locals?.requestTimedOut === true);
  let proxyWarned = false;

  return function requestLoggingMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    const requestId = resolveRequestId(req.get(header), config.trustRequestIdHeader);
    req.id = requestId;
    const log = logger.child({ requestId });
    req.log = log;
    res.setHeader(header, requestId);

    if (!proxyWarned && req.headers['x-forwarded-for'] !== undefined && !req.app?.get('trust proxy')) {
      proxyWarned = true;
      logger.warn(
        { event: 'config_warning' },
        "X-Forwarded-For received but Express 'trust proxy' is not set; client IPs will be the proxy's address",
      );
    }

    const path = pathOf(req.originalUrl || req.url || '');
    if (matches(path, config.ignorePaths)) {
      runWithRequestContext({ requestId, log }, next);
      return;
    }
    const quiet = matches(path, config.quietPaths);

    let logged = false;
    const complete = (kind: 'finish' | 'aborted' | 'error'): void => {
      if (logged) return;
      logged = true;
      try {
        const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e3) / 1e3;
        const statusCode = res.statusCode;
        const aborted = kind === 'aborted';
        const outcome: RequestOutcome = aborted
          ? 'aborted'
          : kind === 'error'
            ? 'response_error'
            : outcomeFor(statusCode, safe(() => isTimeout(req, res), false));
        const route = routeLabel(req);
        const ip = clientIp(req);
        const bodyAllow = options.logBody?.[`${req.method} ${route}`];
        const userId = safe(() => getUserId(req), undefined);
        const ua = req.headers['user-agent'];
        const resLength = parseContentLength(res.getHeader('content-length'));

        const entry: Record<string, unknown> = {
          event: 'http_request',
          method: sanitizeString(req.method, 16),
          route,
          statusCode: aborted && !res.headersSent ? null : statusCode,
          outcome,
          durationMs,
          ip: loggableIp(ip, config.ipMode),
          userAgent: typeof ua === 'string' ? sanitizeString(ua, 300) : undefined,
          requestContentLength: parseContentLength(req.headers['content-length']),
          responseContentLength: resLength,
          userId: userId !== undefined ? sanitizeString(String(userId), 128) : undefined,
          query: sanitizeQuery(req.query, config.queryAllowlist),
          body: bodyAllow ? redactDeep(pickAllowlisted(req.body, bodyAllow)) : undefined,
          securityEvents: getSecurityEventTypes(req),
        };

        const level =
          outcome === 'success' ? (quiet ? 'trace' : 'info') : outcome === 'server_error' || outcome === 'response_error' ? 'error' : 'warn';
        const message =
          outcome === 'aborted' ? 'request aborted by client' : outcome === 'response_error' ? 'response stream error' : 'request completed';

        const emit = (location?: GeoLocation): void => {
          try {
            if (location) entry.geo = { ...location, approximate: true };
            log[level](entry, message);
          } catch {
            /* never let logging crash the process */
          }
        };

        if (geo && ip) {
          // Runs after the response is sent, so it can never delay the client.
          void geo.lookup(ip).then(emit, () => emit());
        } else {
          emit();
        }
      } catch {
        /* never let logging crash the process */
      }
    };

    res.once('finish', () => complete('finish'));
    res.once('error', () => complete('error'));
    res.once('close', () => complete(res.writableFinished ? 'finish' : 'aborted'));

    runWithRequestContext({ requestId, log }, next);
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
