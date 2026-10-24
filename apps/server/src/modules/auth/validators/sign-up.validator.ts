import { z } from 'zod';
import { baseAuthSchema } from './common';

const _signUpSchema = z.object({
    ...baseAuthSchema.shape,
});

const signUpValidatorSchema = z.object({
    body: _signUpSchema,
});

type SignUpValidatorSchema = z.infer<typeof _signUpSchema>;

export { signUpValidatorSchema, type SignUpValidatorSchema };
