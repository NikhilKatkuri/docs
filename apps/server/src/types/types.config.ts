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
    TRUST_PROXY: boolean;
    cors: {
        origins: {
            urls: string[];
        };
    };
}

export type { ConfigVars };
