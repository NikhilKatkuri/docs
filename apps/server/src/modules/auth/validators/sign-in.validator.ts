import { z } from 'zod';
import { firebaseUID } from './common';

const _signInSchema = z.discriminatedUnion('provider', [
    z.object({
        uid: firebaseUID,
        provider: z.literal('password'),
    }),
    z.object({
        uid: firebaseUID,
        provider: z.literal('google'),
    }),
    z.object({
        uid: firebaseUID,
        provider: z.literal('github'),
    }),
]);
const signInValidatorSchema = z.object({
    body: _signInSchema,
});

type SignInValidatorSchema = z.infer<typeof _signInSchema>;

export { signInValidatorSchema, type SignInValidatorSchema };
