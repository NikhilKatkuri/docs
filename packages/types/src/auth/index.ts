import { AuditFields } from '../common';

type AuthProvider = 'google' | 'password' | 'github';

type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

interface UserSnap {
    uid: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    provider: AuthProvider;
}

interface UserDoc extends UserSnap, AuditFields {
    lastLoginAt: Date | null;
    lastActiveAt: Date | null;
    emailVerified: boolean;
    status: UserStatus;
}

export type { AuthProvider, UserStatus, UserSnap, UserDoc };
