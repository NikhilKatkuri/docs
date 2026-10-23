import { AuditFeilds } from '../common';

type AuthProvider = 'google' | 'password' | 'github';

interface UserSnap {
    uid: string;
    email: string;
    displayName: string;
    avatarUrl: string;
    provider: AuthProvider;
}

interface UserDoc extends UserSnap, AuditFeilds {}
export type { AuthProvider, UserSnap, UserDoc };
