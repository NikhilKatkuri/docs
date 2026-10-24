import { adminAuth } from '@/lib/firebase';
import type { Request, Response } from 'express';
import userRepository from '../repository/user';
import { signJWT } from '@/utils/jwt';
import { setSessionCookie } from '@/middleware/protect';

async function SignInController(req: Request, res: Response) {
    try {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token) {
            res.clearCookie('session', { path: '/' });
            return res.status(401).json({ message: 'Unauthorized' });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (error) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const uid = decodedToken.uid;
        const validUser = await userRepository.findByUid(uid);
        if (!validUser || validUser.status != 'ACTIVE' || validUser.deletedAt) {
            return res.status(403).json({ message: 'Account unavailable' });
        }

        await userRepository.updateLastLogin(uid);
        const sessionToken = signJWT({ uid });

        setSessionCookie(res, sessionToken);

        return res.status(200).json({ message: 'Sign-in successful' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server Error' });
    }
}

export default SignInController;
