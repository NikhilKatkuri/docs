import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import type { LoggerConfig } from './config';
import { redactDeep, serializeError } from './redact';
import type { AppLogger } from './types';

/** Defence in depth for ad-hoc objects passed to the logger (pino fast-redact, fixed paths). */
const REDACT_PATHS = [
  'password', '*.password', 'newPassword', '*.newPassword', 'currentPassword', '*.currentPassword',
  'token', '*.token', 'accessToken', '*.accessToken', 'refreshToken', '*.refreshToken',
  'idToken', '*.idToken', 'secret', '*.secret', 'clientSecret', '*.clientSecret',
  'apiKey', '*.apiKey', 'otp', '*.otp', 'authorization', '*.authorization', 'cookie', '*.cookie',
  'headers.authorization', 'headers.cookie', 'headers["set-cookie"]',
  'req.headers.authorization', 'req.headers.cookie', 'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
];

const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

function createPrettyStream(): DestinationStream | undefined {
  try {
    // Optional peer dependency; resolved lazily so production installs don't need it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('pino-pretty') as unknown;
    const build = (typeof mod === 'function' ? mod : (mod as { default: unknown }).default) as (o: object) => DestinationStream;
    return build({ colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname', sync: true });
  } catch {
    return undefined;
  }
}

/**
 * Creates the application logger.
 *  - production: JSON to stdout through an async, size-bounded SonicBoom destination.
 *  - development: colorized output via pino-pretty (falls back to JSON if not installed).
 * Pass `destination` to capture output (tests) or to ship logs elsewhere.
 */
export function createLogger(config: LoggerConfig, destination?: DestinationStream): AppLogger {
  let stream = destination;
  let prettyMissing = false;
  if (!stream && config.pretty) {
    stream = createPrettyStream();
    prettyMissing = stream === undefined;
  }
  const usePretty = config.pretty && !destination && !prettyMissing;

  stream ??= pino.destination({
    dest: 1,
    sync: false,
    // Bounded in-memory buffer: if stdout is stalled, drop instead of growing without limit.
    maxLength: MAX_BUFFERED_BYTES,
  } as Parameters<typeof pino.destination>[0]);

  // A broken pipe on the log destination must never take the process down.
  const maybeEmitter = stream as unknown as { on?: (e: string, l: (err: unknown) => void) => void };
  maybeEmitter.on?.('error', () => undefined);

  const safeErr = (e: unknown): unknown => {
    try {
      return e instanceof Error ? serializeError(e) : redactDeep(e);
    } catch {
      return { type: 'SerializationFailure' };
    }
  };

  const options: LoggerOptions = {
    level: config.level,
    base: {
      service: config.appName,
      env: config.environment,
      ...(config.serviceVersion ? { version: config.serviceVersion } : {}),
      pid: process.pid,
      hostname: config.hostname,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: { err: safeErr, error: safeErr },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    ...(usePretty ? {} : { formatters: { level: (label: string) => ({ level: label }) } }),
  };

  const logger = pino(options, stream);
  if (prettyMissing) {
    logger.warn('LOG_PRETTY requested but pino-pretty is not installed; falling back to JSON output');
  }
  return logger;
}

/** Flushes buffered log output (best effort, bounded by `timeoutMs`). */
export function flushLogger(logger: AppLogger, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
    try {
      logger.flush((err?: Error) => {
        void err;
        clearTimeout(timer);
        resolve();
      });
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}
