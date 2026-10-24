import { logError } from 'express-secure-logger';
import configVars from '@/config/env';
import { security } from '@/app';
import { adminAuth } from '@/lib/firebase';
import userRepository from '@/modules/auth/repository/user';
import { firebaseUID } from '@/modules/auth/validators/common';
import { signJWT, verifyJWT } from '@/utils/jwt';
import { getFirebaseErrorCode } from '@/utils/firebase-error';
import type { Request, Response, NextFunction } from 'express';

function verifySessionCookie(req: Request): string | null {
    try {
        const sessionCookie = req.cookies?.session;
        if (!sessionCookie) return null;
        const result = verifyJWT(sessionCookie);
        if (!result.valid || typeof result.decoded === 'string') return null;

        const parsed = firebaseUID.safeParse(result.decoded.uid);
        return parsed.success ? parsed.data : null;
    } catch (error) {
        return null;
    }
}

function setSessionCookie(res: Response, token: string) {
    res.cookie('session', token, {
        httpOnly: true,
        secure: !configVars.isDev,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
    });
}

async function Protect(req: Request, res: Response, next: NextFunction) {
    const sessionCookie = req.cookies?.session;
    const uid = verifySessionCookie(req);
    if (uid) {
        req.user = { uid };
        return next();
    }

    const authorization = req.headers.authorization;
    const token = authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
        res.clearCookie('session', { path: '/' });
        const reason = authorization
            ? 'malformed_authorization'
            : sessionCookie
              ? 'invalid_session'
              : 'missing_token';
        security.unauthorized(req, { reason });
        return res.status(401).json({ message: 'Unauthorized' });
    }

    let decodedToken;
    try {
        decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
        const code = getFirebaseErrorCode(error);
        if (code === 'auth/id-token-expired') {
            security.tokenExpired(req, { reason: code });
        } else {
            security.tokenInvalid(req, { reason: code });
        }
        res.clearCookie('session', { path: '/' });
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const parsedUID = firebaseUID.safeParse(decodedToken.uid);
        if (!parsedUID.success) {
            security.signIn(req, 'failure', { reason: 'invalid_uid' });
            res.clearCookie('session', { path: '/' });
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await userRepository.findAccountByUid(parsedUID.data);
        if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
            const reason = !user
                ? 'user_not_found'
                : user.deletedAt
                  ? 'account_deleted'
                  : `status_${String(user.status).toLowerCase()}`;
            security.signIn(req, 'failure', {
                userId: parsedUID.data,
                reason,
            });
            res.clearCookie('session', { path: '/' });
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.user = {
            uid: decodedToken.uid,
        };

        const newSignedToken = signJWT({ uid: decodedToken.uid });
        setSessionCookie(res, newSignedToken);
        next();
    } catch (error) {
        res.clearCookie('session', { path: '/' });
        logError(req, error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export { setSessionCookie };
export default Protect;
