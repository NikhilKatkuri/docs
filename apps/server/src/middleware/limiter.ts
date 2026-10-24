import rateLimit, {
    type Options,
    type RateLimitRequestHandler,
} from 'express-rate-limit';
import { rateLimitHandler } from 'express-secure-logger';
import type { RequestHandler } from 'express';

import { security } from '@/app';
import {
    baseRateLimitOptions,
    rateLimitConfig,
    type ConfigKey,
} from '@/config/rateLimit';

// `security` comes from app.ts via a circular import. It is only read when the
// first request hits a limiter, by which point app.ts has finished initialising.
let secureHandler: RequestHandler | undefined;
const handler: RequestHandler = (req, res, next) => {
    secureHandler ??= rateLimitHandler(security);
    secureHandler(req, res, next);
};

const createLimiter = (key: ConfigKey): RateLimitRequestHandler => {
    const config = rateLimitConfig[key];
    if (!config) {
        throw new Error(`Rate limit configuration for key "${key}" not found.`);
    }

    return rateLimit({
        ...baseRateLimitOptions,
        windowMs: config.windowMs,
        limit: config.limit,
        handler,
    } satisfies Partial<Options>);
};

export const limiter = createLimiter('default');
export const veryStrictLimiter = createLimiter('veryStrict');
export const lowLimiter = createLimiter('low');
export const moderateLimiter = createLimiter('moderate');
export const readLimiter = createLimiter('read');
export const authLimiter = createLimiter('auth');
export const healthCheckLimiter = createLimiter('healthCheck');
