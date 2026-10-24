import type { UserSnap } from '@docs/types';
import { db, type ApiQueueJob } from './index';

export async function enqueueJob(
    job: Omit<ApiQueueJob, 'createdAt' | 'attempts' | 'status' | 'nextRetryAt'>
): Promise<void> {
    const now = Date.now();

    await db.apiQueue.put({
        ...job,
        createdAt: now,
        attempts: 0,
        status: 'pending',
        nextRetryAt: now,
    });
}

export async function enqueueSignup(user: UserSnap): Promise<void> {
    await enqueueJob({
        id: `signup:${user.uid}`,
        type: 'auth.signup',
        payload: { user },
    });
}

export async function getPendingJobs(): Promise<ApiQueueJob[]> {
    return db.apiQueue.where('status').equals('pending').toArray();
}

export async function removeJob(id: string): Promise<void> {
    await db.apiQueue.delete(id);
}
