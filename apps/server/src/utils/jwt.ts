import configVars from '@/config/env';
import jwt, { type JwtPayload } from 'jsonwebtoken';

const verifyJWT = (token: string): JwtPayload => {
    try {
        const decoded = jwt.verify(token, configVars.jwt.secret, {
            algorithms: ['HS256'],
        });

        return { valid: true as const, decoded };
    } catch {
        return { valid: false as const };
    }
};

const signJWT = (payload: object) => {
    return jwt.sign(payload, configVars.jwt.secret, {
        expiresIn: configVars.jwt.expiresIn as jwt.SignOptions['expiresIn'],
        algorithm: 'HS256',
        issuer: 'docs-api',
        audience: 'docs-web',
    });
};

export { verifyJWT, signJWT };
