import validator from '@/middleware/validator';
import express from 'express';
import { signInValidatorSchema } from '../validators/sign-in.validator';
import SignInController from '../controller/sign-in.controller';
import {
    authLimiter,
    moderateLimiter,
    readLimiter,
    veryStrictLimiter,
} from '@/middleware/limiter';
import { signUpValidatorSchema } from '../validators/sign-up.validator';
import SignUpController from '../controller/sign-up.controller';
import protect from '@/middleware/protect';
import signOutController from '../controller/sign-out.controller';
import * as UserController from '../controller/user.controller';
import { userValidatorSchema } from '../validators/user.validator';

const authRouter = express.Router();

authRouter.post(
    '/sign-in',
    authLimiter,
    validator(signInValidatorSchema),
    SignInController
);

authRouter.post(
    '/sign-up',
    authLimiter,
    validator(signUpValidatorSchema),
    SignUpController
);

authRouter.post('/sign-out', authLimiter, signOutController);
authRouter.get('/me', readLimiter, protect, UserController.getUserProfile);
authRouter.patch(
    '/me',
    moderateLimiter,
    protect,
    validator(userValidatorSchema),
    UserController.updateUserProfile
);
authRouter.delete(
    '/me',
    veryStrictLimiter,
    protect,
    UserController.deleteUserAccount
);

export default authRouter;
