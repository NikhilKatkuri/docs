import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startServer, type TestServer } from '../helpers/server';

describe('application wiring', () => {
    let app: Express;
    let server: TestServer;

    beforeAll(async () => {
        // Keep the app's own logger silent during tests; log assertions use the
        // captured logger in the integration harness.
        process.env.NODE_ENV = 'test';
        process.env.LOG_LEVEL = 'silent';
        process.env.LOG_PRETTY = 'false';

        const module = await import('@/app');
        app = module.default;
        server = await startServer(app);
    });

    afterAll(async () => {
        await server.close();
    });

    it('mounts the request logger first and echoes a supplied request ID', async () => {
        const response = await fetch(`${server.url}/api/v1/health`, {
            headers: { 'x-request-id': 'app-req-12345' },
        });
        const body = (await response.json()) as { status: string };

        expect(response.status).toBe(200);
        expect(body).toEqual({ status: 'ok' });
        expect(response.headers.get('x-request-id')).toBe('app-req-12345');
    });

    it('returns a 401 through the real validation, rate-limit and auth stack', async () => {
        const response = await fetch(`${server.url}/api/v1/auth/sign-in`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ uid: 'test-uid', provider: 'password' }),
        });
        const body = (await response.json()) as { message: string };

        expect(response.status).toBe(401);
        expect(body).toEqual({ message: 'Unauthorized' });
        expect(response.headers.get('x-request-id')).toBeTruthy();
    });
});
