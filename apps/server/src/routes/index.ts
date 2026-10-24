import authRouter from '@/modules/auth/routes';
import express from 'express';

const baseApiPath = (path: string) => `/api/v1${path}`;
const router = express.Router();

router.use(baseApiPath('/auth'), authRouter);
router.get(baseApiPath('/health'), (_, res) => {
    res.status(200).json({ status: 'ok' });
});

export default router;
