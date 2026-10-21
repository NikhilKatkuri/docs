import { AuditFeilds } from '../common';

type authProvider = 'google' | 'password' | 'microsoft';

interface UserSnap extends AuditFeilds {
    uid: string;
    email: string;
    displayName: string;
    avatarUrl: string;
    provider: authProvider;
}

export type { authProvider, UserSnap };
