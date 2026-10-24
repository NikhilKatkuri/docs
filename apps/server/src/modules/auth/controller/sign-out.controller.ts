import type { Request, Response } from 'express';
import { logError } from 'express-secure-logger';

async function signOutController(req: Request, res: Response) {
    try {
        res.clearCookie('session', { path: '/' });
        return res.status(200).json({ message: 'Signed out successfully' });
    } catch (error) {
        logError(req, error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export default signOutController;
