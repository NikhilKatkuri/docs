import { adminAuth } from '@/lib/firebase';
import type { Request, Response } from 'express';
import userRepository from '../repository/user';
import { signJWT } from '@/utils/jwt';
import { setSessionCookie } from '@/middleware/protect';

async function SignUpController(req: Request, res: Response) {
    try {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];

        if (!token) {
            res.clearCookie('session', { path: '/' });
            return res.status(401).json({ message: 'Unauthorized' });
        }

        let decodedToken;

        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch {
            return res.status(401).json({ message: 'Invalid Firebase token' });
        }

        const uid = decodedToken.uid;
        const existingUser = await userRepository.findByUid(uid);

        if (existingUser) {
            return res.status(409).json({ message: 'Account already exists' });
        }

        const firebaseUser = await adminAuth.getUser(uid);

        if (!firebaseUser.email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (
            req.body.uid !== firebaseUser.uid ||
            req.body.email?.toLowerCase() !== firebaseUser.email.toLowerCase()
        ) {
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
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export default SignUpController;
