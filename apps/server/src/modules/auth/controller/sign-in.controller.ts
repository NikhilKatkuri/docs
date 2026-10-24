import { adminAuth } from '@/lib/firebase';
import type { Request, Response } from 'express';
import userRepository from '../repository/user';
import { signJWT } from '@/utils/jwt';
import { setSessionCookie } from '@/middleware/protect';
import { security } from '@/app';
import { logError } from 'express-secure-logger';
import { getFirebaseErrorCode } from '@/utils/firebase-error';

async function SignInController(req: Request, res: Response) {
    try {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token) {
            security.unauthorized(req, { reason: 'missing_token' });
            res.clearCookie('session', { path: '/' });
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
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const uid = decodedToken.uid;
        const validUser = await userRepository.findAccountByUid(uid);
        if (
            !validUser ||
            validUser.status !== 'ACTIVE' ||
            validUser.deletedAt
        ) {
            const reason = !validUser
                ? 'user_not_found'
                : validUser.deletedAt || validUser.status === 'DELETED'
                  ? 'account_deleted'
                  : `status_${String(validUser.status).toLowerCase()}`;
            security.signIn(req, 'failure', { userId: uid, reason });
            return res.status(403).json({ message: 'Account unavailable' });
        }

        await userRepository.updateLastLogin(uid);
        const sessionToken = signJWT({ uid });
        setSessionCookie(res, sessionToken);

        security.signIn(req, 'success', { userId: uid });

        return res.status(200).json({ message: 'Sign-in successful' });
    } catch (error) {
        logError(req, error);
        return res.status(500).json({ message: 'Internal server Error' });
    }
}

export default SignInController;
