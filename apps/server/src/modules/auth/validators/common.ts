import { z } from 'zod';

export const firebaseUID = z
    .string()
    .trim()
    .min(1, 'UID is required')
    .max(128, 'UID is too long');

export const baseAuthSchema = z.object({
    uid: firebaseUID,
    email: z.email('Invalid email address'),
    displayName: z.string().min(1, 'Display name is required'),
    avatarUrl: z
        .url('Invalid avatar URL')
        .refine(
            (url) =>
                url.startsWith('https://') || url.startsWith('inner_profile'),
            'Avatar URL must use HTTPS'
        )
        .nullable(),
    provider: z.enum(['google', 'password', 'github']),
});
