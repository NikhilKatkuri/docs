import { FirebaseError } from 'firebase/app';
import { GoogleAuthProvider } from 'firebase/auth';

export type AuthErrorCode =
    | 'account-exists'
    | 'popup-blocked'
    | 'network'
    | 'too-many-requests'
    | 'user-disabled'
    | 'missing-email'
    | 'password-too-weak'
    | 'unknown';

interface AuthErrorDetails {
    email?: string;
    pendingCredential?: ReturnType<
        typeof GoogleAuthProvider.credentialFromError
    >;
    cause?: unknown;
}

export class AuthError extends Error {
    public readonly code: AuthErrorCode;
    public readonly details?: AuthErrorDetails;
    constructor(
        code: AuthErrorCode,
        message: string,
        details?: AuthErrorDetails
    ) {
        super(message, { cause: details?.cause });
        this.code = code;
        this.details = details;
        this.name = 'AuthError';
    }
}

const cancelledCodes = new Set([
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
]);

interface ErrorObj {
    code: AuthErrorCode;
    message: string;
}

type ErrorMap = Record<string, ErrorObj>;

const ERROR_MAP: ErrorMap = {
    'auth/network-request-failed': {
        code: 'network',
        message: 'Network error. Check your connection and try again.',
    },
    'auth/too-many-requests': {
        code: 'too-many-requests',
        message: 'Too many attempts. Please wait a moment and try again.',
    },
    'auth/user-disabled': {
        code: 'user-disabled',
        message: 'This account has been disabled.',
    },
};

function toAuthError(error: unknown): AuthError {
    if (error instanceof AuthError) return error;

    if (error instanceof FirebaseError) {
        const mapped = ERROR_MAP[error.code];
        if (mapped) {
            return new AuthError(mapped.code, mapped.message, { cause: error });
        }

        if (error.code === 'auth/account-exists-with-different-credential') {
            return new AuthError(
                'account-exists',
                'An account already exists with the same email address but different sign-in credentials. Please use a different sign-in method.',
                {
                    email: error.customData?.email as string | undefined,
                    pendingCredential:
                        GoogleAuthProvider.credentialFromError(error),
                    cause: error,
                }
            );
        }
    }

    return new AuthError(
        'unknown',
        'Something went wrong signing in. Please try again.',
        {
            cause: error,
        }
    );
}

export { toAuthError, cancelledCodes };
