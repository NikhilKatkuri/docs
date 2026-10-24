import rateLimit, {
    type Options,
    type RateLimitRequestHandler,
} from 'express-rate-limit';

import {
    baseRateLimitOptions,
    buildRateLimitHandler,
    buildRateLimitMessage,
    rateLimitConfig,
    type ConfigKey,
} from '@/config/rateLimit';

const createLimiter = (key: ConfigKey): RateLimitRequestHandler => {
    const config = rateLimitConfig[key];
    if (!config) {
        throw new Error(`Rate limit configuration for key "${key}" not found.`);
    }

    return rateLimit({
        ...baseRateLimitOptions,
        windowMs: config.windowMs,
        limit: config.limit,
        handler: buildRateLimitHandler(key, config),
        message: buildRateLimitMessage(config.message),
    } satisfies Partial<Options>);
};

export const limiter = createLimiter('default');
export const veryStrictLimiter = createLimiter('veryStrict');
export const lowLimiter = createLimiter('low');
export const moderateLimiter = createLimiter('moderate');
export const readLimiter = createLimiter('read');
export const authLimiter = createLimiter('auth');
export const healthCheckLimiter = createLimiter('healthCheck');
