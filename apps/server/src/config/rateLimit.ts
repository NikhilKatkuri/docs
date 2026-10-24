import type { Options } from 'express-rate-limit';
import configVars from './env';

type LimiterPreset = {
    windowMs: number;
    limit: number;
    message?: string;
    severity?: 'low' | 'medium' | 'high';
};

const devMultiplier = 1000;

const scale = (value: number) =>
    configVars.isDev ? value * devMultiplier : value;

export const rateLimitConfig: Record<string, LimiterPreset> = {
    default: {
        windowMs: 15 * 60 * 1000,
        limit: scale(100),
        severity: 'low',
    },
    veryStrict: {
        windowMs: 15 * 60 * 1000,
        limit: scale(10),
        severity: 'low',
    },
    low: {
        windowMs: 15 * 60 * 1000,
        limit: scale(30),
        severity: 'low',
    },
    moderate: {
        windowMs: 15 * 60 * 1000,
        limit: scale(50),
        severity: 'medium',
    },
    read: {
        windowMs: 15 * 60 * 1000,
        limit: scale(100),
        severity: 'low',
    },
    auth: {
        windowMs: 15 * 60 * 1000,
        limit: scale(5),
        message:
            'Too many authentication attempts. Please try again in 15 minutes.',
        severity: 'high',
    },
    profileRequests: {
        windowMs: 15 * 60 * 1000,
        limit: scale(50),
        severity: 'medium',
    },
    profileUpdates: {
        windowMs: 15 * 60 * 1000,
        limit: scale(10),
        severity: 'medium',
    },
    healthCheck: {
        windowMs: 15 * 60 * 1000,
        limit: scale(30),
        severity: 'low',
    },
} satisfies Record<string, LimiterPreset>;

export const baseRateLimitOptions: Partial<Options> = {
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: false,
};

export type ConfigKey = keyof typeof rateLimitConfig;
