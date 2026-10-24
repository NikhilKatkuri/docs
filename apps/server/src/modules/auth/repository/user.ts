import { prisma } from '@/config';
import type { UserSnap } from '@docs/types';

class UserRepository {
    create(newUser: UserSnap) {
        return prisma.user.create({
            data: {
                uid: newUser.uid,
                email: newUser.email,
                displayName: newUser.displayName,
                avatarUrl: newUser.avatarUrl,
                provider: newUser.provider,
            },
        });
    }

    update(
        uid: string,
        updatedUser: Parameters<typeof prisma.user.update>[0]['data']
    ) {
        return prisma.user.update({
            where: { uid },
            data: updatedUser,
        });
    }

    delete(uid: string) {
        return prisma.user.update({
            where: { uid },
            data: {
                status: 'DELETED',
                deletedAt: new Date(),
            },
        });
    }

    findAll() {
        return prisma.user.findMany({
            where: { deletedAt: null, status: 'ACTIVE' },
        });
    }

    findByUid(uid: string) {
        return prisma.user.findFirst({
            where: { uid, deletedAt: null, status: 'ACTIVE' },
        });
    }

    /**
     * Unfiltered lookup for authentication decisions. Needed so sign-in can
     * distinguish a suspended/deleted account from a missing one without
     * exposing that distinction to the client.
     */
    findAccountByUid(uid: string) {
        return prisma.user.findUnique({ where: { uid } });
    }

    findByEmail(email: string) {
        return prisma.user.findFirst({
            where: { email, deletedAt: null, status: 'ACTIVE' },
        });
    }

    updateLastLogin(uid: string) {
        return prisma.user.update({
            where: { uid },
            data: { lastLoginAt: new Date() },
        });
    }

    updateLastActive(uid: string) {
        return prisma.user.update({
            where: { uid },
            data: { lastActiveAt: new Date() },
        });
    }
}

const userRepository = new UserRepository();
export default userRepository;
