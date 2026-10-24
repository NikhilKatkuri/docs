import type { IpMode, LogLevel } from 'express-secure-logger';

interface ConfigVars {
    NODE_ENV: string;
    isDev: boolean;
    HOST: string;
    PORT: number;
    POSTGRES_HOST: string;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DB: string;
    POSTGRES_PORT: number;
    /** Number of trusted proxy hops, or `false` when directly exposed. Never `true`. */
    TRUST_PROXY: number | false;
    cors: {
        origins: {
            urls: string[];
        };
    };
    firebase: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    APP_NAME: string;
    SERVICE_VERSION?: string;
    LOG_LEVEL: LogLevel;
    LOG_PRETTY: boolean;
    LOG_IP_MODE: IpMode;
    LOG_TRUST_REQUEST_ID: boolean;
    LOG_QUIET_PATHS: string[];
    LOG_IGNORE_PATHS: string[];
    LOG_QUERY_ALLOWLIST: string[];
    LOG_GEO_ENABLED: boolean;
}

export type { ConfigVars };
