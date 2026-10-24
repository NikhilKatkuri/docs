import { z, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { security } from '@/app';

const validate =
    (schema: z.ZodObject<any>) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            if (parsed.body !== undefined) req.body = parsed.body;
            if ((parsed as any).query !== undefined) {
                Object.defineProperty(req, 'query', {
                    value: (parsed as any).query,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            }
            if ((parsed as any).params !== undefined)
                req.params = (parsed as any).params as any;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const issues = error.issues.map((issue) => ({
                    path: issue.path.join('.') || '(root)',
                    message: issue.message,
                }));

                const fields = Array.from(
                    new Set(
                        error.issues.map((issue) => {
                            const path = issue.path.map(String);
                            const withoutRoot = [
                                'body',
                                'query',
                                'params',
                            ].includes(path[0] ?? '')
                                ? path.slice(1)
                                : path;
                            return withoutRoot.join('.') || '(root)';
                        })
                    )
                );
                security.validationFailed(req, fields);

                res.status(400).json({
                    success: false,
                    errors: error.flatten(),
                    issues,
                    message: issues.length
                        ? `Validation failed: ${issues
                              .map((i) => `${i.path} - ${i.message}`)
                              .join('; ')}`
                        : 'Validation failed',
                });
                return;
            }
            next(error);
        }
    };

export default validate;
