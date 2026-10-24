import { z } from 'zod';
import { baseAuthSchema } from './common';

const baseAuthWithoutUidSchema = baseAuthSchema.omit({ uid: true });

export const userValidatorSchema = z.object({
    body: baseAuthWithoutUidSchema.optional(),
});
