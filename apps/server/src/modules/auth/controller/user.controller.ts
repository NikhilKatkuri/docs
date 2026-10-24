import type { UserSnap } from '@docs/types';
import userRepository from '../repository/user';
import { security } from '@/app';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        security.unauthorized(req, { reason: 'missing_user_context' });
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const user = await userRepository.findByUid(req.user.uid);

    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    res.status(200).json({ user });
});

function safeUserData<T extends Omit<UserSnap, 'uid'>>(
    data: Partial<T>
): Partial<T> {
    const safeData: Partial<T> = {};

    if (data.email !== undefined) safeData.email = data.email;
    if (data.displayName !== undefined) safeData.displayName = data.displayName;
    if (data.avatarUrl !== undefined) safeData.avatarUrl = data.avatarUrl;
    if (data.provider !== undefined) safeData.provider = data.provider;

    return safeData;
}

const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        security.unauthorized(req, { reason: 'missing_user_context' });
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const partialUserData = req.body;

    await userRepository.update(req.user.uid, safeUserData(partialUserData));
    res.status(200).json({ message: 'Profile updated successfully' });
});

const deleteUserAccount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        security.unauthorized(req, { reason: 'missing_user_context' });
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    await userRepository.delete(req.user.uid);

    security.accountDeleted(req, { userId: req.user.uid });

    res.clearCookie('session', { path: '/' });
    res.status(200).json({ message: 'Account deleted successfully' });
});

export { getUserProfile, updateUserProfile, deleteUserAccount };
