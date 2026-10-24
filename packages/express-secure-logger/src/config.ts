import os from 'node:os';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type IpMode = 'full' | 'anonymized' | 'none';

export class LoggerConfigError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid logger configuration:\n - ${issues.join('\n - ')}`);
    this.name = 'LoggerConfigError';
    this.issues = issues;
  }
}

export interface LoggerConfig {
  appName: string;
  environment: string;
  serviceVersion?: string;
  hostname: string;
  level: LogLevel;
  /** Human-readable colorized output (development only by default). */
  pretty: boolean;
  /** How the client IP is recorded. */
  ipMode: IpMode;
  /** Accept a client-supplied request ID header if it passes strict validation. */
  trustRequestIdHeader: boolean;
  /** Successful requests to these paths are logged at `trace`; failures log normally. */
  quietPaths: string[];
  /** Requests to these paths are never logged. */
  ignorePaths: string[];
  /** Only these query parameters are ever logged (values sanitised). */
  queryAllowlist: string[];
  geo: { enabled: boolean; cacheSize: number; ttlMs: number; timeoutMs: number };
}

type Env = Record<string, string | undefined>;

const DEFAULT_QUIET = ['/health', '/healthz', '/livez', '/readyz', '/ready', '/metrics'];

/**
 * Reads and validates logger settings from environment variables.
 * Never echoes variable values in errors. Pass any env-like object (e.g. the
 * output of your existing zod/envalid parser) instead of process.env.
 */
export function loadLoggerConfig(env: Env = process.env): LoggerConfig {
  const issues: string[] = [];
  const get = (k: string): string | undefined => {
    const v = env[k]?.trim();
    return v === undefined || v === '' ? undefined : v;
  };
  const bool = (k: string, def: boolean): boolean => {
    const v = get(k)?.toLowerCase();
    if (v === undefined) return def;
    if (['true', '1', 'yes'].includes(v)) return true;
    if (['false', '0', 'no'].includes(v)) return false;
    issues.push(`${k} must be a boolean (true/false)`);
    return def;
  };
  const int = (k: string, def: number, min: number, max: number): number => {
    const v = get(k);
    if (v === undefined) return def;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      issues.push(`${k} must be an integer between ${min} and ${max}`);
      return def;
    }
    return n;
  };
  const csv = (k: string, def: string[]): string[] => {
    const raw = env[k];
    if (raw === undefined) return def;
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const environment = get('NODE_ENV') ?? 'development';
  if (!/^[a-z0-9_-]{1,32}$/i.test(environment)) issues.push('NODE_ENV has an invalid format');

  const appName = get('APP_NAME') ?? 'app';
  if (!/^[\w.@/-]{1,64}$/.test(appName)) issues.push('APP_NAME must be 1-64 chars of [A-Za-z0-9_.@/-]');

  const defaultLevel: LogLevel = environment === 'test' ? 'silent' : environment === 'production' ? 'info' : 'debug';
  const levelRaw = get('LOG_LEVEL')?.toLowerCase();
  let level: LogLevel = defaultLevel;
  if (levelRaw !== undefined) {
    if ((LOG_LEVELS as readonly string[]).includes(levelRaw)) level = levelRaw as LogLevel;
    else issues.push(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}`);
  }

  const ipRaw = get('LOG_IP_MODE')?.toLowerCase() ?? 'full';
  let ipMode: IpMode = 'full';
  if (ipRaw === 'full' || ipRaw === 'anonymized' || ipRaw === 'none') ipMode = ipRaw;
  else issues.push('LOG_IP_MODE must be one of: full, anonymized, none');

  const pretty = bool('LOG_PRETTY', environment === 'development');
  const geoEnabled = bool('LOG_GEO_ENABLED', false);

  const config: LoggerConfig = {
    appName,
    environment,
    hostname: os.hostname(),
    level,
    pretty,
    ipMode,
    trustRequestIdHeader: bool('LOG_TRUST_REQUEST_ID', true),
    quietPaths: csv('LOG_QUIET_PATHS', DEFAULT_QUIET),
    ignorePaths: csv('LOG_IGNORE_PATHS', []),
    queryAllowlist: csv('LOG_QUERY_ALLOWLIST', []),
    geo: {
      enabled: geoEnabled,
      cacheSize: int('LOG_GEO_CACHE_SIZE', 5000, 1, 1_000_000),
      ttlMs: int('LOG_GEO_TTL_SECONDS', 86_400, 1, 30 * 86_400) * 1000,
      timeoutMs: int('LOG_GEO_TIMEOUT_MS', 50, 1, 5000),
    },
  };
  const version = get('SERVICE_VERSION');
  if (version !== undefined) config.serviceVersion = version.slice(0, 64);

  if (issues.length > 0) throw new LoggerConfigError(issues);
  return config;
}
