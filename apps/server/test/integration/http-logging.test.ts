import express, { type Express } from 'express';
import {
    createErrorHandler,
    createRequestLogger,
    createSecurityLogger,
    redactDeep,
    type SecurityLogger,
} from 'express-secure-logger';
import { afterEach, describe, expect, it } from 'vitest';

import {
    captureLogger,
    expectNoSecrets,
    sleep,
    SYNTH,
    waitFor,
    type Capture,
} from '../helpers/capture';
import { startServer, type TestServer } from '../helpers/server';

function buildHarness(cap: Capture): {
    app: Express;
    security: SecurityLogger;
} {
    const security = createSecurityLogger(cap.logger, {
        ipMode: cap.config.ipMode,
    });
    const app = express();

    app.set('trust proxy', 1);
    app.use(createRequestLogger({ logger: cap.logger, config: cap.config }));
    app.use(express.json());

    app.get('/ok', (req, res) => {
        req.log.info('inside handler');
        res.json({ requestId: req.id });
    });

    app.get('/unauthorized', (req, res) => {
        security.unauthorized(req, { reason: 'missing_token' });
        res.status(401).json({ message: 'Unauthorized' });
    });

    app.get('/forbidden', (req, res) => {
        security.forbidden(req, { reason: 'insufficient_role' });
        res.status(403).json({ message: 'Forbidden' });
    });

    app.get('/boom', () => {
        throw new Error(`database failed; Bearer ${SYNTH.token}`);
    });

    app.post('/secret', (req, res) => {
        security.invalidCredentials(req, { reason: 'bad_password' });
        res.status(401).json({ message: 'Unauthorized' });
    });

    app.post('/redacted', (req, res) => {
        req.log.info({ payload: redactDeep(req.body) }, 'redacted payload');
        res.json({ ok: true });
    });

    app.use(createErrorHandler({ logger: cap.logger, security }));
    return { app, security };
}

const completions = (cap: Capture) =>
    cap.records().filter((record) => record.event === 'http_request');
const securityEvents = (cap: Capture) =>
    cap.records().filter((record) => record.event === 'security');
const errors = (cap: Capture) =>
    cap.records().filter((record) => record.event === 'request_error');

describe('HTTP logging integration', () => {
    let server: TestServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    it('returns x-request-id and propagates it to handler and completion logs', async () => {
        const cap = captureLogger();
        const { app } = buildHarness(cap);
        server = await startServer(app);

        const response = await fetch(`${server.url}/ok`, {
            headers: { 'x-request-id': 'client-req-12345' },
        });
        const body = (await response.json()) as { requestId: string };

        expect(response.status).toBe(200);
        expect(response.headers.get('x-request-id')).toBe('client-req-12345');
        expect(body.requestId).toBe('client-req-12345');

        await waitFor(() => completions(cap).length === 1);
        await sleep(30);

        const handlerLog = cap
            .records()
            .find((record) => record.msg === 'inside handler');
        expect(handlerLog?.requestId).toBe('client-req-12345');
        expect(completions(cap)).toHaveLength(1);
        expect(completions(cap)[0]).toMatchObject({
            event: 'http_request',
            method: 'GET',
            route: '/ok',
            statusCode: 200,
            outcome: 'success',
            requestId: 'client-req-12345',
        });
        expect(typeof completions(cap)[0]!.durationMs).toBe('number');
    });

    it('generates a UUID when no valid request ID is supplied', async () => {
        const cap = captureLogger();
        const { app } = buildHarness(cap);
        server = await startServer(app);

        const response = await fetch(`${server.url}/ok`);
        const body = (await response.json()) as { requestId: string };

        expect(response.headers.get('x-request-id')).toMatch(
            /^[0-9a-f-]{36}$/
        );
        expect(body.requestId).toBe(response.headers.get('x-request-id'));
    });

    it('emits one security event for 401/403 and one error log for 500', async () => {
        const cap = captureLogger();
        const { app } = buildHarness(cap);
        server = await startServer(app);

        const unauthorized = await fetch(`${server.url}/unauthorized`);
        const forbidden = await fetch(`${server.url}/forbidden`);
        const failed = await fetch(`${server.url}/boom`);

        expect(unauthorized.status).toBe(401);
        expect(forbidden.status).toBe(403);
        expect(failed.status).toBe(500);

        await waitFor(() => completions(cap).length === 3);
        await sleep(30);
        expect(completions(cap)).toHaveLength(3);

        expect(
            securityEvents(cap).map((event) => [
                event.securityEvent,
                event.outcome,
            ])
        ).toEqual([
            ['unauthorized', 'failure'],
            ['forbidden', 'failure'],
        ]);
        expect(securityEvents(cap)[0]).toMatchObject({
            reason: 'missing_token',
            requestId: unauthorized.headers.get('x-request-id'),
        });
        expect(securityEvents(cap)[1]).toMatchObject({
            reason: 'insufficient_role',
            requestId: forbidden.headers.get('x-request-id'),
        });

        expect(errors(cap)).toHaveLength(1);
        expect(errors(cap)[0]).toMatchObject({
            statusCode: 500,
            expected: false,
            route: '/boom',
            requestId: failed.headers.get('x-request-id'),
        });
        expect(errors(cap)[0]!.err.stack).toContain('at ');
        expect(errors(cap).some((record) => record.statusCode === 401)).toBe(
            false
        );
        expect(errors(cap).some((record) => record.statusCode === 403)).toBe(
            false
        );

        const failedBody = (await failed.json()) as {
            error: { code: string; message: string; requestId: string };
        };
        expect(failedBody).toEqual({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal Server Error',
                requestId: failed.headers.get('x-request-id'),
            },
        });
        expect(JSON.stringify(failedBody)).not.toMatch(
            /boom|database failed|stack|at /
        );
        expectNoSecrets(cap.text());
    });

    it('never captures Authorization, cookies, passwords, tokens or raw query strings', async () => {
        const cap = captureLogger();
        const { app } = buildHarness(cap);
        server = await startServer(app);

        const secret = await fetch(
            `${server.url}/secret?token=${SYNTH.query}&page=2`,
            {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${SYNTH.token}`,
                    cookie: `session=${SYNTH.cookie}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    password: SYNTH.password,
                    idToken: SYNTH.token,
                }),
            }
        );
        expect(secret.status).toBe(401);

        const redacted = await fetch(`${server.url}/redacted`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'user@example.com',
                password: SYNTH.password,
                nested: { session: SYNTH.cookie, token: SYNTH.token },
            }),
        });
        expect(redacted.status).toBe(200);

        const boom = await fetch(`${server.url}/boom`);
        expect(boom.status).toBe(500);

        await waitFor(() => completions(cap).length === 3);
        await sleep(30);
        expect(completions(cap)).toHaveLength(3);

        expectNoSecrets(cap.text());
        const secretCompletion = completions(cap).find(
            (record) => record.route === '/secret'
        );
        expect(secretCompletion?.query).toBeUndefined();
        expect(secretCompletion?.body).toBeUndefined();

        const redactedLog = cap
            .records()
            .find((record) => record.msg === 'redacted payload');
        expect(redactedLog?.payload).toEqual({
            email: 'user@example.com',
            password: '[REDACTED]',
            nested: { session: '[REDACTED]', token: '[REDACTED]' },
        });
    });
});
