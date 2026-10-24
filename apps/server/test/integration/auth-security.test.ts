import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SYNTH } from '../helpers/capture';

const mocks = vi.hoisted(() => ({
    security: {
        log: vi.fn(),
        signIn: vi.fn(),
        signUp: vi.fn(),
        invalidCredentials: vi.fn(),
        tokenExpired: vi.fn(),
        tokenInvalid: vi.fn(),
        unauthorized: vi.fn(),
        forbidden: vi.fn(),
        rateLimited: vi.fn(),
        validationFailed: vi.fn(),
        accountDeleted: vi.fn(),
        accountSuspended: vi.fn(),
        authorizationFailure: vi.fn(),
    },
    verifyIdToken: vi.fn(),
    findAccountByUid: vi.fn(),
    findByUid: vi.fn(),
    updateLastLogin: vi.fn(),
    create: vi.fn(),
}));

vi.mock('@/app', () => ({ security: mocks.security }));
vi.mock('@/lib/firebase', () => ({
    adminAuth: {
        verifyIdToken: mocks.verifyIdToken,
        getUser: vi.fn(),
    },
}));
vi.mock('@/modules/auth/repository/user', () => ({
    default: {
        findAccountByUid: mocks.findAccountByUid,
        findByUid: mocks.findByUid,
        updateLastLogin: mocks.updateLastLogin,
        create: mocks.create,
    },
}));

import Protect from '@/middleware/protect';
import SignInController from '@/modules/auth/controller/sign-in.controller';
import validate from '@/middleware/validator';
import { signInValidatorSchema } from '@/modules/auth/validators/sign-in.validator';

function request(overrides: Record<string, unknown> = {}) {
    return {
        headers: {},
        cookies: {},
        params: {},
        query: {},
        body: {},
        ip: '127.0.0.1',
        method: 'POST',
        originalUrl: '/api/v1/auth/sign-in',
        baseUrl: '',
        log: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
        ...overrides,
    } as any;
}

function response() {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    res.clearCookie = vi.fn(() => res);
    res.cookie = vi.fn(() => res);
    return res as Response & typeof res;
}

describe('auth security events', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logs unauthorized when the bearer token is missing', async () => {
        const req = request();
        const res = response();
        const next = vi.fn();

        await Protect(req, res, next);

        expect(mocks.security.unauthorized).toHaveBeenCalledWith(req, {
            reason: 'missing_token',
        });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('distinguishes an expired Firebase token from an invalid one', async () => {
        mocks.verifyIdToken.mockRejectedValueOnce(
            Object.assign(new Error('expired'), {
                code: 'auth/id-token-expired',
            })
        );
        const expiredResponse = response();
        await Protect(
            request({ headers: { authorization: 'Bearer SYNTH-TOKEN' } }),
            expiredResponse,
            vi.fn()
        );

        expect(mocks.security.tokenExpired).toHaveBeenCalledWith(
            expect.anything(),
            { reason: 'auth/id-token-expired' }
        );
        expect(mocks.security.tokenInvalid).not.toHaveBeenCalled();
        expect(expiredResponse.status).toHaveBeenCalledWith(401);

        mocks.verifyIdToken.mockRejectedValueOnce(
            Object.assign(new Error('bad token'), {
                code: 'auth/invalid-id-token',
            })
        );
        const invalidResponse = response();
        await Protect(
            request({ headers: { authorization: 'Bearer SYNTH-TOKEN' } }),
            invalidResponse,
            vi.fn()
        );

        expect(mocks.security.tokenInvalid).toHaveBeenCalledWith(
            expect.anything(),
            { reason: 'auth/invalid-id-token' }
        );
        expect(invalidResponse.status).toHaveBeenCalledWith(401);
    });

    it('logs a failed sign-in for a suspended account with a server-side reason', async () => {
        mocks.verifyIdToken.mockResolvedValueOnce({ uid: 'uid-1' });
        mocks.findAccountByUid.mockResolvedValueOnce({
            uid: 'uid-1',
            status: 'SUSPENDED',
            deletedAt: null,
        });
        const req = request({
            headers: { authorization: 'Bearer SYNTH-TOKEN' },
        });
        const res = response();
        const next = vi.fn();

        await Protect(req, res, next);

        expect(mocks.security.signIn).toHaveBeenCalledWith(
            req,
            'failure',
            { userId: 'uid-1', reason: 'status_suspended' }
        );
        expect(res.status).toHaveBeenCalledWith(401);
        expect(JSON.stringify(res.json.mock.calls)).not.toContain('suspended');
        expect(next).not.toHaveBeenCalled();
    });

    it('does not log sign-in success for every protected request', async () => {
        mocks.verifyIdToken.mockResolvedValueOnce({ uid: 'uid-1' });
        mocks.findAccountByUid.mockResolvedValueOnce({
            uid: 'uid-1',
            status: 'ACTIVE',
            deletedAt: null,
        });
        const req = request({
            headers: { authorization: 'Bearer SYNTH-TOKEN' },
        });
        const res = response();
        const next = vi.fn();

        await Protect(req, res, next);

        expect(mocks.security.signIn).not.toHaveBeenCalled();
        expect(req.user).toEqual({ uid: 'uid-1' });
        expect(res.cookie).toHaveBeenCalledWith(
            'session',
            expect.any(String),
            expect.objectContaining({ httpOnly: true, path: '/' })
        );
        expect(next).toHaveBeenCalledOnce();
    });

    it('logs the sign-in controller success event', async () => {
        mocks.verifyIdToken.mockResolvedValueOnce({ uid: 'uid-1' });
        mocks.findAccountByUid.mockResolvedValueOnce({
            uid: 'uid-1',
            status: 'ACTIVE',
            deletedAt: null,
        });
        mocks.updateLastLogin.mockResolvedValueOnce({});
        const req = request({
            headers: { authorization: 'Bearer SYNTH-TOKEN' },
        });
        const res = response();

        await SignInController(req, res);

        expect(mocks.security.signIn).toHaveBeenCalledWith(req, 'success', {
            userId: 'uid-1',
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('logs the controller 403 for a deleted account without exposing the reason', async () => {
        mocks.verifyIdToken.mockResolvedValueOnce({ uid: 'uid-1' });
        mocks.findAccountByUid.mockResolvedValueOnce({
            uid: 'uid-1',
            status: 'DELETED',
            deletedAt: new Date(),
        });
        const req = request({
            headers: { authorization: 'Bearer SYNTH-TOKEN' },
        });
        const res = response();

        await SignInController(req, res);

        expect(mocks.security.signIn).toHaveBeenCalledWith(
            req,
            'failure',
            { userId: 'uid-1', reason: 'account_deleted' }
        );
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Account unavailable',
        });
    });

    it('logs and returns a safe 500 for an unexpected controller failure', async () => {
        mocks.verifyIdToken.mockResolvedValueOnce({ uid: 'uid-1' });
        mocks.findAccountByUid.mockRejectedValueOnce(
            new Error(`database failed password=${SYNTH.password}`)
        );
        const req = request({
            headers: { authorization: 'Bearer SYNTH-TOKEN' },
        });
        const res = response();

        await SignInController(req, res);

        expect(req.log.error).toHaveBeenCalledOnce();
        expect(JSON.stringify(req.log.error.mock.calls)).not.toContain(
            SYNTH.password
        );
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server Error',
        });
        expect(JSON.stringify(res.json.mock.calls)).not.toContain('database');
    });

    it('logs validation failures with field names only', async () => {
        const req = request({
            body: { uid: '', provider: 'password' },
        });
        const res = response();
        const next = vi.fn();

        await validate(signInValidatorSchema)(req, res, next);

        expect(mocks.security.validationFailed).toHaveBeenCalledWith(req, [
            'uid',
        ]);
        const fields = mocks.security.validationFailed.mock.calls[0]![1];
        expect(JSON.stringify(fields)).not.toContain(SYNTH.password);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });
});
