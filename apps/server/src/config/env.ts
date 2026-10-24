import type { ConfigVars } from '@/types';
import 'dotenv/config';

const LOG_LEVELS = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent',
] as const;
const IP_MODES = ['full', 'anonymized', 'none'] as const;

const DEFAULT_QUIET_PATHS = [
    '/api/v1/health',
    '/health',
    '/healthz',
    '/livez',
    '/readyz',
    '/ready',
    '/metrics',
];

function getString(key: string): string {
    const value = process.env[key]?.trim();

    if (!value) {
        throw new Error(`Missing or empty environment variable: ${key}`);
    }

    return value;
}

function getOptionalString(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
}

function getPort(key: string): number {
    const raw = getString(key);
    const port = Number(raw);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(
            `Invalid port in environment variable ${key}: expected an integer between 1 and 65535`
        );
    }

    return port;
}

function getBoolean(key: string, fallback: boolean): boolean {
    const raw = process.env[key]?.trim().toLowerCase();

    if (!raw) return fallback;
    if (['true', '1', 'yes'].includes(raw)) return true;
    if (['false', '0', 'no'].includes(raw)) return false;

    throw new Error(
        `Invalid value for environment variable ${key}: expected a boolean (true/false)`
    );
}

function getEnum<T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T
): T {
    const raw = process.env[key]?.trim();

    if (!raw) return fallback;
    if ((allowed as readonly string[]).includes(raw)) return raw as T;

    throw new Error(
        `Invalid value for environment variable ${key}: expected one of ${allowed.join(', ')}`
    );
}

function getCsv(key: string, fallback: string[]): string[] {
    const raw = process.env[key];

    if (raw === undefined) return fallback;
    return raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

function getTrustProxy(key: string): number | false {
    const raw = process.env[key]?.trim().toLowerCase();

    if (!raw || raw === 'false' || raw === '0') return false;
    // Express's boolean `true` trusts every hop. Map legacy "true" to one
    // trusted hop so client IPs cannot be spoofed by arbitrary forwarding.
    if (raw === 'true') return 1;

    const hops = Number(raw);
    if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
        throw new Error(
            `Invalid value for environment variable ${key}: expected false or an integer hop count between 1 and 10`
        );
    }

    return hops;
}

const nodeEnv = getString('NODE_ENV');
const isDev = nodeEnv === 'development';
const defaultLogLevel =
    nodeEnv === 'production' ? 'info' : nodeEnv === 'test' ? 'silent' : 'debug';

const configVars = {
    NODE_ENV: nodeEnv,
    isDev,
    HOST: getString('HOST'),
    PORT: getPort('PORT'),
    POSTGRES_HOST: getString('POSTGRES_HOST'),
    POSTGRES_USER: getString('POSTGRES_USER'),
    POSTGRES_PASSWORD: getString('POSTGRES_PASSWORD'),
    POSTGRES_DB: getString('POSTGRES_DB'),
    POSTGRES_PORT: getPort('POSTGRES_PORT'),
    TRUST_PROXY: getTrustProxy('TRUST_PROXY'),
    cors: {
        origins: {
            urls: getString('CORS_ORIGINS').split(','),
        },
    },
    firebase: {
        apiKey: getString('SECRET_FIREBASE_API_KEY'),
        authDomain: getString('SECRET_FIREBASE_AUTH_DOMAIN'),
        projectId: getString('SECRET_FIREBASE_PROJECT_ID'),
        storageBucket: getString('SECRET_FIREBASE_STORAGE_BUCKET'),
        messagingSenderId: getString('SECRET_FIREBASE_MESSAGING_SENDER_ID'),
        appId: getString('SECRET_FIREBASE_APP_ID'),
    },
    jwt: {
        secret: getString('JWT_SECRET'),
        expiresIn: getString('JWT_EXPIRES_IN'),
    },
    APP_NAME: getOptionalString('APP_NAME') ?? 'docs-server',
    SERVICE_VERSION: getOptionalString('SERVICE_VERSION'),
    LOG_LEVEL: getEnum('LOG_LEVEL', LOG_LEVELS, defaultLogLevel),
    LOG_PRETTY: getBoolean('LOG_PRETTY', isDev),
    LOG_IP_MODE: getEnum('LOG_IP_MODE', IP_MODES, 'anonymized'),
    LOG_TRUST_REQUEST_ID: getBoolean('LOG_TRUST_REQUEST_ID', true),
    LOG_QUIET_PATHS: getCsv('LOG_QUIET_PATHS', DEFAULT_QUIET_PATHS),
    LOG_IGNORE_PATHS: getCsv('LOG_IGNORE_PATHS', []),
    LOG_QUERY_ALLOWLIST: getCsv('LOG_QUERY_ALLOWLIST', []),
    LOG_GEO_ENABLED: getBoolean('LOG_GEO_ENABLED', false),
} satisfies ConfigVars;

/**
 * Flat, validated view of the logging environment. `loadLoggerConfig` accepts
 * env-like strings, so we map the parsed config explicitly instead of passing
 * the whole object (which also contains secrets and nested values).
 */
const loggerEnv: Record<string, string | undefined> = {
    NODE_ENV: configVars.NODE_ENV,
    APP_NAME: configVars.APP_NAME,
    SERVICE_VERSION: configVars.SERVICE_VERSION,
    LOG_LEVEL: configVars.LOG_LEVEL,
    LOG_PRETTY: String(configVars.LOG_PRETTY),
    LOG_IP_MODE: configVars.LOG_IP_MODE,
    LOG_TRUST_REQUEST_ID: String(configVars.LOG_TRUST_REQUEST_ID),
    LOG_QUIET_PATHS: configVars.LOG_QUIET_PATHS.join(','),
    LOG_IGNORE_PATHS: configVars.LOG_IGNORE_PATHS.join(','),
    LOG_QUERY_ALLOWLIST: configVars.LOG_QUERY_ALLOWLIST.join(','),
    LOG_GEO_ENABLED: String(configVars.LOG_GEO_ENABLED),
};

export { loggerEnv };
export default configVars;
