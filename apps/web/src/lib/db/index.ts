import { Dexie, type EntityTable } from 'dexie';
import type { UserSnap } from '@docs/types';

export interface ApiQueueJob {
    id: string;
    type: 'auth.signup';
    payload: {
        user: UserSnap;
    };
    createdAt: number;
    attempts: number;
    status: 'pending' | 'processing';
    nextRetryAt: number;
}

export const db = new Dexie('DocsDatabase') as Dexie & {
    apiQueue: EntityTable<ApiQueueJob, 'id'>;
};

db.version(1).stores({
    apiQueue: 'id, type, status, nextRetryAt, createdAt',
});
