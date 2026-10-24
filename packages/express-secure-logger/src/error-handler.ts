import { STATUS_CODES } from 'node:http';
import type { ErrorRequestHandler, Request } from 'express';
import { sanitizeString, serializeError } from './redact';
import { routeLabel } from './request-info';
import { hasSecurityEvent, type SecurityLogger } from './security-events';
import type { AppLogger } from './types';

const logged = new WeakSet<object>();

export interface ClassifiedError {
  status?: number;
  /** Stable machine-readable code returned to clients. */
  code?: string;
  /** A message that is safe to show to clients. */
  publicMessage?: string;
  /** Force the "expected" (non-5xx-style) treatment. */
  expected?: boolean;
}

export function getErrorStatus(err: unknown): number {
  const e = err as { statusCode?: unknown; status?: unknown } | null | undefined;
  const s = typeof e?.statusCode === 'number' ? e.statusCode : e?.status;
  return typeof s === 'number' && Number.isInteger(s) && s >= 400 && s <= 599 ? s : 500;
}

function isLogger(x: unknown): x is AppLogger {
  return typeof (x as AppLogger | undefined)?.info === 'function';
}

/**
 * Logs an error once. Safe to call from controllers, `asyncHandler` or the
 * global handler: the same Error instance is only ever logged one time.
 * Expected (<500) errors log at `warn` without a stack; unexpected errors log
 * at `error` with the stack. Never throws.
 * @returns true if a log line was written.
 */
export function logError(
  source: Request | AppLogger,
  err: unknown,
  info: { status?: number; expected?: boolean } = {},
): boolean {
  try {
    if (typeof err === 'object' && err !== null) {
      if (logged.has(err)) return false;
      logged.add(err);
    }
    const status = info.status ?? getErrorStatus(err);
    const expected = info.expected ?? status < 500;
    const req = isLogger(source) ? undefined : source;
    const log = req?.log ?? (isLogger(source) ? source : undefined);
    if (!log) return false;
    const entry = {
      event: 'request_error',
      requestId: req && !req.log ? req.id : undefined,
      method: req?.method,
      route: req ? routeLabel(req) : undefined,
      statusCode: status,
      expected,
      err: serializeError(err, { includeStack: !expected }),
    };
    if (expected) log.warn(entry, 'request failed (expected error)');
    else log.error(entry, 'unhandled error while processing request');
    return true;
  } catch {
    return false;
  }
}

export interface ErrorHandlerOptions {
  logger?: AppLogger;
  /** Map your own error classes to status/code/public message. */
  classify?: (err: unknown) => ClassifiedError | undefined;
  /** If set, 401/403 errors not already recorded as security events are recorded once. */
  security?: SecurityLogger;
}

const codeFor = (status: number): string =>
  (STATUS_CODES[status] ?? 'Error').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Centralised Express error handler (mount LAST). Logs once, then returns a
 * consistent body: `{ error: { code, message, requestId } }`.
 * Internal messages, stacks and DB details are never sent to clients; messages
 * of <500 errors are only echoed when the error opts in with `expose: true`
 * (the http-errors / body-parser convention) or via `classify().publicMessage`.
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}): ErrorRequestHandler {
  return (err, req, res, next) => {
    void next;
    let classified: ClassifiedError | undefined;
    try {
      classified = options.classify?.(err);
    } catch {
      classified = undefined;
    }
    const status = classified?.status ?? getErrorStatus(err);
    const source: Request | AppLogger = req.log ? req : (options.logger ?? req);

    logError(source, err, {
      status,
      ...(classified?.expected !== undefined ? { expected: classified.expected } : {}),
    });

    if (options.security) {
      try {
        if (status === 401 && !hasSecurityEvent(req, 'unauthorized')) options.security.unauthorized(req, { reason: 'error_handler' });
        if (status === 403 && !hasSecurityEvent(req, 'forbidden')) options.security.forbidden(req, { reason: 'error_handler' });
      } catch {
        /* ignore */
      }
    }

    if (res.headersSent) {
      // Cannot send a clean error body; drop the connection rather than leave a half-written response.
      try {
        res.destroy();
      } catch {
        /* ignore */
      }
      return;
    }

    const exposeFlag = (err as { expose?: unknown } | null)?.expose === true;
    const message =
      status >= 500
        ? (STATUS_CODES[500] as string)
        : (classified?.publicMessage ??
          (exposeFlag && err instanceof Error ? sanitizeString(err.message, 200) : (STATUS_CODES[status] ?? 'Error')));

    res.status(status).json({
      error: { code: classified?.code ?? codeFor(status), message, requestId: req.id },
    });
  };
}
