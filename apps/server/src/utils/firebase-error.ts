/**
 * Returns only the machine-readable Firebase error code. Raw error messages
 * can contain token fragments, so they must never be logged or returned.
 */
function getFirebaseErrorCode(error: unknown): string {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' && code.length > 0 ? code : 'unknown';
}

export { getFirebaseErrorCode };
