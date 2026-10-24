import { adminAuth } from '@/lib/firebase';
import type { Request, Response } from 'express';
import userRepository from '../repository/user';
import { signJWT } from '@/utils/jwt';
import { setSessionCookie } from '@/middleware/protect';
import { security } from '@/app';
import { logError } from 'express-secure-logger';
import { getFirebaseErrorCode } from '@/utils/firebase-error';

async function SignUpController(req: Request, res: Response) {
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
            return res.status(401).json({ message: 'Invalid Firebase token' });
        }

        const uid = decodedToken.uid;
        const existingUser = await userRepository.findByUid(uid);

        if (existingUser) {
            security.signUp(req, 'failure', {
                userId: uid,
                reason: 'account_exists',
            });
            return res.status(409).json({ message: 'Account already exists' });
        }

        const firebaseUser = await adminAuth.getUser(uid);

        if (!firebaseUser.email) {
            security.signUp(req, 'failure', {
                userId: uid,
                reason: 'missing_email',
            });
            return res.status(400).json({ message: 'Email is required' });
        }

        if (
            req.body.uid !== firebaseUser.uid ||
            req.body.email?.toLowerCase() !== firebaseUser.email.toLowerCase()
        ) {
            security.signUp(req, 'failure', {
                userId: uid,
                reason: 'profile_mismatch',
            });
            return res.status(400).json({
                message: 'User profile does not match Firebase account',
            });
        }

        const user = await userRepository.create({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: req.body.displayName,
            avatarUrl: req.body.avatarUrl ?? null,
            provider: req.body.provider,
        });

        const sessionToken = signJWT({ uid: user.uid });
        setSessionCookie(res, sessionToken);

        security.signUp(req, 'success', { userId: user.uid });

        return res.status(201).json({
            message: 'Account created successfully',
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                provider: user.provider,
            },
        });
    } catch (error) {
        logError(req, error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export default SignUpController;
