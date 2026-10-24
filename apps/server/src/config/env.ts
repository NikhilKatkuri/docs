import type { ConfigVars } from '@/types';
import 'dotenv/config';

function getString(key: string): string {
    const value = process.env[key]?.trim();

    if (!value) {
        throw new Error(`Missing or empty environment variable: ${key}`);
    }

    return value;
}

function getPort(key: string): number {
    const raw = getString(key);
    const port = Number(raw);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(
            `Invalid port in environment variable ${key}: "${raw}"`
        );
    }

    return port;
}

const configVars = {
    NODE_ENV: getString('NODE_ENV'),
    isDev: getString('NODE_ENV') === 'development',
    HOST: getString('HOST'),
    PORT: getPort('PORT'),
    POSTGRES_HOST: getString('POSTGRES_HOST'),
    POSTGRES_USER: getString('POSTGRES_USER'),
    POSTGRES_PASSWORD: getString('POSTGRES_PASSWORD'),
    POSTGRES_DB: getString('POSTGRES_DB'),
    POSTGRES_PORT: getPort('POSTGRES_PORT'),
    TRUST_PROXY: getString('TRUST_PROXY') === 'true',
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
} satisfies ConfigVars;

export default configVars;
