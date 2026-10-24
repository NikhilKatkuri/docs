import type { ConfigVars } from '../types/config';

function getString(key: string): string {
    const value = import.meta.env[key]?.trim();

    if (!value) {
        throw new Error(`Missing or empty environment variable: ${key}`);
    }

    return value;
}

const configVars = {
    firebase: {
        apiKey: getString('VITE_FIREBASE_API_KEY'),
        authDomain: getString('VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: getString('VITE_FIREBASE_PROJECT_ID'),
        storageBucket: getString('VITE_FIREBASE_STORAGE_BUCKET'),
        messagingSenderId: getString('VITE_FIREBASE_MESSAGING_SENDER_ID'),
        appId: getString('VITE_FIREBASE_APP_ID'),
    },
    serverUrl: getString('VITE_API_BASE_URL'),
} satisfies ConfigVars;

export { configVars };
