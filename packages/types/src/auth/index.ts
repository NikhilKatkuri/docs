import { AuditFeilds } from '../common';

type authProvider = 'google' | 'password' | 'microsoft';

interface UserSnap {
    uid: string;
    email: string;
    displayName: string;
    avatarUrl: string;
    provider: authProvider;
}

interface UserDoc extends UserSnap, AuditFeilds {}
export type { authProvider, UserSnap, UserDoc };
