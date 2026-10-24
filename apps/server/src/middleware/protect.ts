import configVars from '@/config/env';
import { adminAuth } from '@/lib/firebase';
import userRepository from '@/modules/auth/repository/user';
import { firebaseUID } from '@/modules/auth/validators/common';
import { signJWT, verifyJWT } from '@/utils/jwt';
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
    const uid = verifySessionCookie(req);
    if (uid) {
        req.user = { uid };
        return next();
    }

    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
        res.clearCookie('session', { path: '/' });
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        const parsedUID = firebaseUID.safeParse(decodedToken.uid);
        if (!parsedUID.success) {
            res.clearCookie('session', { path: '/' });
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await userRepository.findByUid(parsedUID.data);

        if (!user) {
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
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

export { setSessionCookie };
export default Protect;
